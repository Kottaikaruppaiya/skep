/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  B2bDashboardMetrics,
  B2bImportPreview,
  B2bInvoice,
  B2bMonthlySummary,
  ImportBatch,
  Supplier,
} from '../../../src/types/index.ts';
import { withTransaction, type DbClient } from '../../config/prisma.ts';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { parseDateOptional, parseDateRequired } from '../../shared/utils/date.ts';
import { dAdd, round2 } from '../../shared/utils/decimal.ts';
import { isValidGstin, normalizeGstin } from '../../shared/utils/gstin.ts';
import { getCurrentIndianFinancialYearLabel, normalizeGstrPeriod } from '../../shared/utils/gstr-period.ts';
import {
  buildB2bDashboardMetrics,
  buildB2bMonthlySummaries,
  calculateB2bInvoiceTaxTotals,
  computeMonthlySummaryBlock,
} from './b2b.calculator.ts';
import { previewB2bWorkbook } from './b2b.excel.ts';
import { b2bRepository, type B2bInvoiceQueryFilters } from './b2b.repository.ts';

export const b2bService = {
  // --- Suppliers ---
  async listSuppliers(search?: string): Promise<Supplier[]> {
    return b2bRepository.findSuppliers(search);
  },

  async getSupplierById(id: string): Promise<Supplier | null> {
    return b2bRepository.findSupplierById(id);
  },

  async createSupplier(
    data: { gstin: string; legalName: string; tradeName?: string; address?: string; state?: string },
    db?: DbClient
  ): Promise<Supplier> {
    const gstin = normalizeGstin(data.gstin);
    if (!isValidGstin(gstin)) {
      throw new ValidationError('Valid 15-character GSTIN is required.');
    }
    const legalName = data.legalName.trim();
    if (!legalName) {
      throw new ValidationError('Supplier legal name is required.');
    }

    const existing = await b2bRepository.findSupplierByGstin(gstin, db);
    if (existing) {
      throw new ConflictError(`Supplier with GSTIN "${gstin}" already exists (${existing.legalName}).`);
    }

    return b2bRepository.createSupplier({ gstin, legalName, tradeName: data.tradeName, address: data.address, state: data.state }, db);
  },

  async updateSupplier(
    id: string,
    updates: Partial<{ legalName: string; tradeName?: string; address?: string; state?: string }>
  ): Promise<Supplier> {
    return withTransaction(async (tx) => {
      const existing = await b2bRepository.findSupplierById(id, tx);
      if (!existing) throw new NotFoundError('Supplier not found.');

      const patch: Record<string, any> = {};
      if (updates.legalName !== undefined) {
        const name = updates.legalName.trim();
        if (!name) throw new ValidationError('Legal name cannot be empty.');
        patch.legalName = name;
        await b2bRepository.updateSupplierNameOnInvoices(id, name, tx);
      }
      if (updates.tradeName !== undefined) patch.tradeName = updates.tradeName.trim() || null;
      if (updates.address !== undefined) patch.address = updates.address.trim() || null;
      if (updates.state !== undefined) patch.state = updates.state.trim() || null;

      return b2bRepository.updateSupplier(id, patch, tx);
    });
  },

  async deleteSupplier(id: string): Promise<boolean> {
    const existing = await b2bRepository.findSupplierById(id);
    if (!existing) return false;

    const linkedCount = await b2bRepository.countInvoicesForSupplier(id);
    if (linkedCount > 0) {
      throw new ConflictError(`Cannot delete supplier "${existing.legalName}" as it has linked B2B invoices.`);
    }

    return b2bRepository.deleteSupplier(id);
  },

  // --- Invoices ---
  async listInvoices(
    filters?: B2bInvoiceQueryFilters & { page?: number; limit?: number }
  ): Promise<{
    data: B2bInvoice[];
    total: number;
    page: number;
    limit: number;
    totalTaxableValue: number;
    totalGst: number;
    totalInvoiceValue: number;
  }> {
    const allFiltered = await b2bRepository.findInvoices(filters);

    let totalTaxableValue = 0;
    let totalGst = 0;
    let totalInvoiceValue = 0;
    for (const inv of allFiltered) {
      totalTaxableValue = dAdd(totalTaxableValue, inv.taxableValue || 0);
      totalGst = dAdd(totalGst, inv.totalGst || 0);
      totalInvoiceValue = dAdd(totalInvoiceValue, inv.invoiceValue || 0);
    }

    const total = allFiltered.length;
    const page = Math.max(1, filters?.page || 1);
    const limit = filters?.limit === 0 ? total : Math.max(1, filters?.limit || 50);
    const start = (page - 1) * limit;
    const data = limit > 0 ? allFiltered.slice(start, start + limit) : allFiltered;

    return {
      data,
      total,
      page,
      limit,
      totalTaxableValue: round2(totalTaxableValue),
      totalGst: round2(totalGst),
      totalInvoiceValue: round2(totalInvoiceValue),
    };
  },

  async getInvoiceById(id: string): Promise<B2bInvoice | null> {
    return b2bRepository.findInvoiceById(id);
  },

  async createInvoiceWithTx(tx: DbClient, data: any, userId?: string): Promise<B2bInvoice> {
    const supplierGstin = normalizeGstin(data.supplierGstin);
    if (!isValidGstin(supplierGstin)) {
      throw new ValidationError('Valid 15-character Supplier GSTIN is required.');
    }

    const invoiceNumber = String(data.invoiceNumber || '').trim();
    if (!invoiceNumber) {
      throw new ValidationError('Invoice Number is required.');
    }

    const invoiceType = String(data.invoiceType || 'Regular').trim() || 'Regular';
    const existing = await b2bRepository.findInvoiceByCompositeKey(supplierGstin, invoiceNumber, invoiceType, undefined, tx);
    if (existing) {
      throw new ConflictError(
        `Duplicate invoice detected: Invoice "${invoiceNumber}" for supplier "${supplierGstin}" already exists in GSTR Period ${existing.gstrPeriod}.`
      );
    }

    const parsedPeriod = normalizeGstrPeriod(data.gstrPeriod);
    if (!parsedPeriod) {
      throw new ValidationError(
        `Invalid GSTR Period: "${data.gstrPeriod}". Must be a valid period like "08-2026" or "Aug 2026".`
      );
    }

    const numericChecks = [
      data.invoiceValue,
      data.taxableValue,
      data.integratedTax,
      data.centralTax,
      data.stateUtTax,
      data.cess,
    ];
    if (numericChecks.some((v) => v !== undefined && v !== null && (!Number.isFinite(Number(v)) || Number(v) < 0))) {
      throw new ValidationError('Invoice and GST tax amounts must be non-negative finite numbers.');
    }

    let supplier = await b2bRepository.findSupplierByGstin(supplierGstin, tx);
    if (!supplier) {
      const supplierName = String(data.supplierName || `SUPPLIER ${supplierGstin}`).trim();
      const state = data.placeOfSupply ? String(data.placeOfSupply).replace(/^\d+-/, '').trim() : undefined;
      supplier = await b2bRepository.createSupplier(
        {
          gstin: supplierGstin,
          legalName: supplierName,
          tradeName: supplierName,
          state: state || undefined,
        },
        tx
      );
    }

    const taxes = calculateB2bInvoiceTaxTotals(data);
    const parsedTaxRate =
      data.applicableTaxRate !== undefined && data.applicableTaxRate !== null && data.applicableTaxRate !== ''
        ? Number(data.applicableTaxRate)
        : null;

    return b2bRepository.createInvoice(
      {
        supplierId: supplier.id,
        supplierGstin,
        supplierName: supplier.legalName,
        invoiceNumber,
        invoiceType,
        invoiceDate: parseDateRequired(data.invoiceDate, 'invoiceDate'),
        invoiceValue: taxes.invoiceValue,
        placeOfSupply: data.placeOfSupply?.trim() || null,
        reverseCharge: String(data.reverseCharge || '').toUpperCase() === 'Y' ? 'Y' : 'N',
        taxableValue: taxes.taxableValue,
        integratedTax: taxes.integratedTax,
        centralTax: taxes.centralTax,
        stateUtTax: taxes.stateUtTax,
        cess: taxes.cess,
        totalGst: taxes.totalGst,
        gstrPeriod: parsedPeriod.displayPeriod,
        periodKey: parsedPeriod.periodKey,
        financialYear: parsedPeriod.financialYear,
        filingDate: parseDateOptional(data.filingDate),
        itcAvailability: data.itcAvailability === 'No' ? 'No' : 'Yes',
        reason: data.reason?.trim() || null,
        applicableTaxRate: parsedTaxRate,
        source: data.source?.trim() || null,
        irn: data.irn?.trim() || null,
        irnDate: parseDateOptional(data.irnDate),
        importBatchId: data.importBatchId || null,
        createdBy: userId || null,
      },
      tx
    );
  },

  async createInvoice(data: any, userId?: string): Promise<B2bInvoice> {
    return withTransaction((tx) => this.createInvoiceWithTx(tx, data, userId));
  },

  async updateInvoiceWithTx(tx: DbClient, id: string, updates: any, userId?: string): Promise<B2bInvoice> {
    const invoice = await b2bRepository.findInvoiceById(id, tx);
    if (!invoice) throw new NotFoundError('B2B Invoice not found.');

    const newGstin = normalizeGstin(updates.supplierGstin || invoice.supplierGstin);
    if (!isValidGstin(newGstin)) {
      throw new ValidationError('Valid 15-character Supplier GSTIN is required.');
    }
    const newInvoiceNumber = String(updates.invoiceNumber || invoice.invoiceNumber).trim();
    const newInvoiceType = String(updates.invoiceType || invoice.invoiceType).trim();

    if (
      newGstin !== invoice.supplierGstin ||
      newInvoiceNumber.toUpperCase() !== invoice.invoiceNumber.toUpperCase() ||
      newInvoiceType.toUpperCase() !== invoice.invoiceType.toUpperCase()
    ) {
      const dup = await b2bRepository.findInvoiceByCompositeKey(newGstin, newInvoiceNumber, newInvoiceType, id, tx);
      if (dup) {
        throw new ConflictError(
          `Duplicate conflict: Another invoice with number "${newInvoiceNumber}" for supplier "${newGstin}" already exists.`
        );
      }
    }

    const patch: Record<string, any> = {};

    if (updates.gstrPeriod !== undefined) {
      const parsed = normalizeGstrPeriod(updates.gstrPeriod);
      if (!parsed) throw new ValidationError(`Invalid GSTR Period: "${updates.gstrPeriod}"`);
      patch.gstrPeriod = parsed.displayPeriod;
      patch.periodKey = parsed.periodKey;
      patch.financialYear = parsed.financialYear;
    }

    if (updates.supplierGstin !== undefined) {
      patch.supplierGstin = newGstin;
      let sup = await b2bRepository.findSupplierByGstin(newGstin, tx);
      if (!sup) {
        sup = await b2bRepository.createSupplier(
          { gstin: newGstin, legalName: updates.supplierName || `SUPPLIER ${newGstin}` },
          tx
        );
      }
      patch.supplierId = sup.id;
      patch.supplierName = updates.supplierName || sup.legalName;
    } else if (updates.supplierName !== undefined) {
      patch.supplierName = String(updates.supplierName).trim();
    }

    if (updates.invoiceNumber !== undefined) patch.invoiceNumber = newInvoiceNumber;
    if (updates.invoiceType !== undefined) patch.invoiceType = newInvoiceType;
    if (updates.invoiceDate !== undefined) patch.invoiceDate = parseDateRequired(updates.invoiceDate, 'invoiceDate');
    if (updates.placeOfSupply !== undefined) patch.placeOfSupply = String(updates.placeOfSupply || '').trim() || null;
    if (updates.reverseCharge !== undefined) {
      patch.reverseCharge = String(updates.reverseCharge || '').toUpperCase() === 'Y' ? 'Y' : 'N';
    }

    const taxes = calculateB2bInvoiceTaxTotals({
      taxableValue: updates.taxableValue !== undefined ? updates.taxableValue : invoice.taxableValue,
      integratedTax: updates.integratedTax !== undefined ? updates.integratedTax : invoice.integratedTax,
      centralTax: updates.centralTax !== undefined ? updates.centralTax : invoice.centralTax,
      stateUtTax: updates.stateUtTax !== undefined ? updates.stateUtTax : invoice.stateUtTax,
      cess: updates.cess !== undefined ? updates.cess : invoice.cess,
      invoiceValue: updates.invoiceValue !== undefined ? updates.invoiceValue : invoice.invoiceValue,
    });

    patch.taxableValue = taxes.taxableValue;
    patch.integratedTax = taxes.integratedTax;
    patch.centralTax = taxes.centralTax;
    patch.stateUtTax = taxes.stateUtTax;
    patch.cess = taxes.cess;
    patch.totalGst = taxes.totalGst;
    patch.invoiceValue = taxes.invoiceValue;

    if (updates.filingDate !== undefined) patch.filingDate = parseDateOptional(updates.filingDate);
    if (updates.itcAvailability !== undefined) {
      patch.itcAvailability = updates.itcAvailability === 'No' ? 'No' : 'Yes';
    }
    if (updates.reason !== undefined) patch.reason = String(updates.reason || '').trim() || null;
    if (updates.applicableTaxRate !== undefined) {
      patch.applicableTaxRate =
        updates.applicableTaxRate === null || updates.applicableTaxRate === ''
          ? null
          : Number(updates.applicableTaxRate);
    }
    if (updates.source !== undefined) patch.source = String(updates.source || '').trim() || null;
    if (updates.irn !== undefined) patch.irn = String(updates.irn || '').trim() || null;
    if (updates.irnDate !== undefined) patch.irnDate = parseDateOptional(updates.irnDate);
    if (updates.importBatchId !== undefined) patch.importBatchId = updates.importBatchId || null;

    patch.updatedBy = userId || null;

    return b2bRepository.updateInvoice(id, patch, tx);
  },

  async updateInvoice(id: string, updates: any, userId?: string): Promise<B2bInvoice> {
    return withTransaction((tx) => this.updateInvoiceWithTx(tx, id, updates, userId));
  },

  async deleteInvoice(id: string): Promise<boolean> {
    return b2bRepository.deleteInvoice(id);
  },

  // --- Aggregations ---
  async getMonthlySummaries(financialYear?: string): Promise<B2bMonthlySummary[]> {
    const invoices = await b2bRepository.findInvoices();
    return buildB2bMonthlySummaries(invoices, financialYear);
  },

  async getMonthDetail(periodKey: string) {
    const invoices = await b2bRepository.findInvoices({ periodKey });
    const parsed = normalizeGstrPeriod(periodKey);
    const displayPeriod = parsed?.displayPeriod || periodKey;
    const financialYear = parsed?.financialYear || getCurrentIndianFinancialYearLabel();

    const summary = computeMonthlySummaryBlock(periodKey, displayPeriod, financialYear, invoices);

    const supMap = new Map<
      string,
      { gstin: string; name: string; invoiceCount: number; invoiceValue: number; taxableValue: number; totalGst: number }
    >();

    for (const inv of invoices) {
      const gstin = inv.supplierGstin.toUpperCase();
      const existing = supMap.get(gstin) || {
        gstin,
        name: inv.supplierName,
        invoiceCount: 0,
        invoiceValue: 0,
        taxableValue: 0,
        totalGst: 0,
      };
      existing.invoiceCount += 1;
      existing.invoiceValue = round2(dAdd(existing.invoiceValue, inv.invoiceValue || 0));
      existing.taxableValue = round2(dAdd(existing.taxableValue, inv.taxableValue || 0));
      existing.totalGst = round2(dAdd(existing.totalGst, inv.totalGst || 0));
      supMap.set(gstin, existing);
    }

    const topSuppliers = Array.from(supMap.values()).sort((a, b) => b.taxableValue - a.taxableValue);

    return {
      summary,
      invoices,
      topSuppliers,
    };
  },

  async getDashboardMetrics(financialYear?: string): Promise<B2bDashboardMetrics> {
    const invoices = await b2bRepository.findInvoices();
    return buildB2bDashboardMetrics(invoices, financialYear);
  },

  // --- Import Workflow ---
  async previewImport(buffer: Buffer, fileName: string): Promise<B2bImportPreview> {
    const [existingInvoices, existingSuppliers] = await Promise.all([
      b2bRepository.findInvoices(),
      b2bRepository.findSuppliers(),
    ]);
    return previewB2bWorkbook(buffer, fileName, existingInvoices, existingSuppliers);
  },

  async commitImport(
    batchMeta: { fileName: string; fileSizeBytes?: number },
    previewData: any,
    mode: 'SKIP_EXISTING' | 'OVERWRITE_EXISTING' | 'INSERT_ALL',
    userId?: string
  ): Promise<{ batchId: string; totalProcessed: number; inserted: number; updated: number; skipped: number; failed: number }> {
    const rowsToProcess = Array.isArray(previewData.allParsedRecords)
      ? previewData.allParsedRecords
      : Array.isArray(previewData.sampleRows)
        ? previewData.sampleRows
        : [];

    if (rowsToProcess.length === 0) {
      throw new ValidationError(
        'No valid parsed invoice rows available to import. Please check validation errors in the uploaded workbook.'
      );
    }

    return withTransaction(async (tx) => {
      const batchId = `batch-${Date.now()}`;
      const previewErrorsCount = Array.isArray(previewData.errors) ? previewData.errors.length : 0;
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const gstrPeriodSummary: Record<string, number> = {};

      // Create the ImportBatch record first so foreign keys on B2bInvoice resolve cleanly
      await b2bRepository.createImportBatch(
        {
          id: batchId,
          fileName: batchMeta.fileName,
          fileSizeBytes: batchMeta.fileSizeBytes,
          uploadedBy: userId,
          totalRows: rowsToProcess.length + previewErrorsCount,
          successfulRows: 0,
          failedRows: previewErrorsCount,
          duplicateRows: (previewData.duplicates || []).length,
          importStatus: 'COMPLETED',
          gstrPeriodSummary: {},
        },
        tx
      );

      for (const row of rowsToProcess) {
        const supplierGstin = normalizeGstin(row.supplierGstin);
        const invoiceNumber = String(row.invoiceNumber || '').trim();
        const invoiceType = String(row.invoiceType || 'Regular').trim() || 'Regular';
        const parsedPeriod = normalizeGstrPeriod(row.gstrPeriod);
        const parsedInvoiceDate = parseDateOptional(row.invoiceDate);

        const numericInvalid = [
          row.invoiceValue,
          row.taxableValue,
          row.integratedTax,
          row.centralTax,
          row.stateUtTax,
          row.cess,
        ].some((v) => v !== undefined && v !== null && (!Number.isFinite(Number(v)) || Number(v) < 0));

        if (!isValidGstin(supplierGstin) || !invoiceNumber || !parsedPeriod || !parsedInvoiceDate || numericInvalid) {
          failed++;
          continue;
        }

        const existing = await b2bRepository.findInvoiceByCompositeKey(
          supplierGstin,
          invoiceNumber,
          invoiceType,
          undefined,
          tx
        );

        if (existing) {
          if (mode === 'SKIP_EXISTING') {
            skipped++;
            continue;
          }

          if (mode === 'OVERWRITE_EXISTING') {
            const updatedInv = await this.updateInvoiceWithTx(
              tx,
              existing.id,
              {
                ...row,
                importBatchId: batchId,
              },
              userId
            );
            updated++;
            const pKey = updatedInv.periodKey || parsedPeriod.periodKey;
            gstrPeriodSummary[pKey] = (gstrPeriodSummary[pKey] || 0) + 1;
            continue;
          }

          // INSERT_ALL preserves existing records and inserts a new disambiguated entry
          let copyIndex = 2;
          let distinctInvoiceType = `${invoiceType} (Copy ${copyIndex})`;
          while (
            await b2bRepository.findInvoiceByCompositeKey(supplierGstin, invoiceNumber, distinctInvoiceType, undefined, tx)
          ) {
            copyIndex++;
            distinctInvoiceType = `${invoiceType} (Copy ${copyIndex})`;
          }

          const createdCopy = await this.createInvoiceWithTx(
            tx,
            {
              ...row,
              invoiceType: distinctInvoiceType,
              importBatchId: batchId,
            },
            userId
          );
          inserted++;
          gstrPeriodSummary[createdCopy.periodKey] = (gstrPeriodSummary[createdCopy.periodKey] || 0) + 1;
          continue;
        }

        const created = await this.createInvoiceWithTx(
          tx,
          {
            ...row,
            importBatchId: batchId,
          },
          userId
        );
        inserted++;
        gstrPeriodSummary[created.periodKey] = (gstrPeriodSummary[created.periodKey] || 0) + 1;
      }

      const totalFailed = previewErrorsCount + failed;
      const finalStatus =
        inserted + updated > 0
          ? totalFailed > 0
            ? 'PARTIAL'
            : 'COMPLETED'
          : skipped > 0 && totalFailed === 0
            ? 'COMPLETED'
            : 'FAILED';

      await tx.importBatch.update({
        where: { id: batchId },
        data: {
          successfulRows: inserted + updated,
          failedRows: totalFailed,
          importStatus: finalStatus,
          gstrPeriodSummary,
        },
      });

      return {
        batchId,
        totalProcessed: rowsToProcess.length,
        inserted,
        updated,
        skipped,
        failed: totalFailed,
      };
    });
  },

  async listImportBatches(): Promise<ImportBatch[]> {
    return b2bRepository.findImportBatches();
  },
};
