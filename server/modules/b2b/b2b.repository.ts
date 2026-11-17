/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  B2bInvoice as PrismaB2bInvoice,
  ImportBatch as PrismaImportBatch,
  Supplier as PrismaSupplier,
} from '@prisma/client';
import type { B2bInvoice, ImportBatch, Supplier } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toDateOnlyString } from '../../shared/utils/date.ts';
import { round2, toNumber } from '../../shared/utils/decimal.ts';

function mapB2bInvoice(row: PrismaB2bInvoice): B2bInvoice {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierGstin: row.supplierGstin,
    supplierName: row.supplierName,
    invoiceNumber: row.invoiceNumber,
    invoiceType: row.invoiceType,
    invoiceDate: toDateOnlyString(row.invoiceDate) || '',
    invoiceValue: toNumber(row.invoiceValue),
    placeOfSupply: row.placeOfSupply ?? undefined,
    reverseCharge: row.reverseCharge === 'Y' ? 'Y' : 'N',
    taxableValue: toNumber(row.taxableValue),
    integratedTax: toNumber(row.integratedTax),
    centralTax: toNumber(row.centralTax),
    stateUtTax: toNumber(row.stateUtTax),
    cess: toNumber(row.cess),
    totalGst: toNumber(row.totalGst),
    gstrPeriod: row.gstrPeriod,
    periodKey: row.periodKey,
    financialYear: row.financialYear,
    filingDate: toDateOnlyString(row.filingDate),
    itcAvailability: row.itcAvailability === 'No' ? 'No' : 'Yes',
    reason: row.reason ?? undefined,
    applicableTaxRate: row.applicableTaxRate !== null ? toNumber(row.applicableTaxRate) : undefined,
    source: row.source ?? undefined,
    irn: row.irn ?? undefined,
    irnDate: toDateOnlyString(row.irnDate),
    importBatchId: row.importBatchId ?? undefined,
    createdBy: row.createdBy ?? undefined,
    updatedBy: row.updatedBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapImportBatch(row: PrismaImportBatch): ImportBatch {
  return {
    id: row.id,
    fileName: row.fileName,
    fileSizeBytes: row.fileSizeBytes !== null ? Number(row.fileSizeBytes) : undefined,
    uploadedAt: row.uploadedAt.toISOString(),
    uploadedBy: row.uploadedBy ?? undefined,
    totalRows: row.totalRows,
    successfulRows: row.successfulRows,
    failedRows: row.failedRows,
    duplicateRows: row.duplicateRows,
    importStatus: row.importStatus as 'COMPLETED' | 'FAILED' | 'PARTIAL',
    gstrPeriodSummary: (row.gstrPeriodSummary as Record<string, number> | undefined) ?? undefined,
  };
}

function mapSupplierWithMetrics(
  sup: PrismaSupplier & { invoices?: PrismaB2bInvoice[] }
): Supplier {
  const invs = sup.invoices || [];
  let totalInvoiceValue = 0;
  let totalTaxableValue = 0;
  let totalGst = 0;
  let latestDate: string | undefined;

  for (const inv of invs) {
    totalInvoiceValue += toNumber(inv.invoiceValue);
    totalTaxableValue += toNumber(inv.taxableValue);
    totalGst += toNumber(inv.totalGst);
    const invDateStr = toDateOnlyString(inv.invoiceDate);
    if (invDateStr && (!latestDate || invDateStr > latestDate)) {
      latestDate = invDateStr;
    }
  }

  return {
    id: sup.id,
    gstin: sup.gstin,
    legalName: sup.legalName,
    tradeName: sup.tradeName ?? undefined,
    address: sup.address ?? undefined,
    state: sup.state ?? undefined,
    invoiceCount: invs.length,
    totalInvoiceValue: round2(totalInvoiceValue),
    totalTaxableValue: round2(totalTaxableValue),
    totalGst: round2(totalGst),
    latestInvoiceDate: latestDate,
    createdAt: sup.createdAt.toISOString(),
    updatedAt: sup.updatedAt.toISOString(),
  };
}

export interface B2bInvoiceQueryFilters {
  periodKey?: string;
  financialYear?: string;
  supplierGstin?: string;
  invoiceType?: string;
  reverseCharge?: string;
  itcAvailability?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const b2bRepository = {
  // --- Suppliers ---
  async findSuppliers(search?: string, db: DbClient = getPrisma()): Promise<Supplier[]> {
    const clean = search?.trim();
    const rows = await db.supplier.findMany({
      where: clean
        ? {
            OR: [
              { legalName: { contains: clean, mode: 'insensitive' } },
              { gstin: { contains: clean, mode: 'insensitive' } },
              { tradeName: { contains: clean, mode: 'insensitive' } },
              { state: { contains: clean, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { invoices: true },
      orderBy: { legalName: 'asc' },
    });

    return rows.map(mapSupplierWithMetrics);
  },

  async findSupplierById(id: string, db: DbClient = getPrisma()): Promise<Supplier | null> {
    const row = await db.supplier.findUnique({
      where: { id },
      include: { invoices: true },
    });
    return row ? mapSupplierWithMetrics(row) : null;
  },

  async findSupplierByGstin(gstin: string, db: DbClient = getPrisma()): Promise<Supplier | null> {
    const row = await db.supplier.findUnique({
      where: { gstin: gstin.trim().toUpperCase() },
      include: { invoices: true },
    });
    return row ? mapSupplierWithMetrics(row) : null;
  },

  async createSupplier(
    data: { id?: string; gstin: string; legalName: string; tradeName?: string; address?: string; state?: string },
    db: DbClient = getPrisma()
  ): Promise<Supplier> {
    const created = await db.supplier.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        gstin: data.gstin.trim().toUpperCase(),
        legalName: data.legalName.trim(),
        tradeName: data.tradeName?.trim() || null,
        address: data.address?.trim() || null,
        state: data.state?.trim() || null,
      },
      include: { invoices: true },
    });
    return mapSupplierWithMetrics(created);
  },

  async updateSupplier(
    id: string,
    data: Partial<{ legalName: string; tradeName: string | null; address: string | null; state: string | null }>,
    db: DbClient = getPrisma()
  ): Promise<Supplier> {
    const updated = await db.supplier.update({
      where: { id },
      data,
      include: { invoices: true },
    });
    return mapSupplierWithMetrics(updated);
  },

  async countInvoicesForSupplier(id: string, db: DbClient = getPrisma()): Promise<number> {
    return db.b2bInvoice.count({ where: { supplierId: id } });
  },

  async updateSupplierNameOnInvoices(supplierId: string, supplierName: string, db: DbClient = getPrisma()) {
    await db.b2bInvoice.updateMany({
      where: { supplierId },
      data: { supplierName },
    });
  },

  async deleteSupplier(id: string, db: DbClient = getPrisma()): Promise<boolean> {
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return false;
    await db.supplier.delete({ where: { id } });
    return true;
  },

  // --- B2B Invoices ---
  async findInvoices(filters?: B2bInvoiceQueryFilters, db: DbClient = getPrisma()): Promise<B2bInvoice[]> {
    const where: Record<string, any> = {};

    if (filters?.periodKey && filters.periodKey !== 'ALL') {
      where.periodKey = filters.periodKey;
    }
    if (filters?.financialYear && filters.financialYear !== 'ALL') {
      where.financialYear = filters.financialYear;
    }
    if (filters?.supplierGstin && filters.supplierGstin !== 'ALL') {
      where.supplierGstin = { equals: filters.supplierGstin.trim().toUpperCase(), mode: 'insensitive' };
    }
    if (filters?.invoiceType && filters.invoiceType !== 'ALL') {
      where.invoiceType = { equals: filters.invoiceType.trim(), mode: 'insensitive' };
    }
    if (filters?.reverseCharge && filters.reverseCharge !== 'ALL') {
      where.reverseCharge = filters.reverseCharge.trim().toUpperCase();
    }
    if (filters?.itcAvailability && filters.itcAvailability !== 'ALL') {
      where.itcAvailability = { equals: filters.itcAvailability.trim(), mode: 'insensitive' };
    }
    if (filters?.search && filters.search.trim()) {
      const s = filters.search.trim();
      where.OR = [
        { invoiceNumber: { contains: s, mode: 'insensitive' } },
        { supplierName: { contains: s, mode: 'insensitive' } },
        { supplierGstin: { contains: s, mode: 'insensitive' } },
        { irn: { contains: s, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = new Set([
      'invoiceDate',
      'invoiceValue',
      'taxableValue',
      'totalGst',
      'supplierName',
      'invoiceNumber',
      'gstrPeriod',
      'createdAt',
    ]);
    const sortBy = filters?.sortBy && allowedSortFields.has(filters.sortBy) ? filters.sortBy : 'invoiceDate';
    const sortOrder = filters?.sortOrder === 'asc' ? 'asc' : 'desc';

    const rows = await db.b2bInvoice.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    });

    return rows.map(mapB2bInvoice);
  },

  async findInvoiceById(id: string, db: DbClient = getPrisma()): Promise<B2bInvoice | null> {
    const row = await db.b2bInvoice.findUnique({ where: { id } });
    return row ? mapB2bInvoice(row) : null;
  },

  async findInvoiceByCompositeKey(
    supplierGstin: string,
    invoiceNumber: string,
    invoiceType: string,
    excludeId?: string,
    db: DbClient = getPrisma()
  ): Promise<B2bInvoice | null> {
    const row = await db.b2bInvoice.findFirst({
      where: {
        supplierGstin: { equals: supplierGstin.trim(), mode: 'insensitive' },
        invoiceNumber: { equals: invoiceNumber.trim(), mode: 'insensitive' },
        invoiceType: { equals: invoiceType.trim(), mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return row ? mapB2bInvoice(row) : null;
  },

  async createInvoice(
    data: {
      id?: string;
      supplierId: string;
      supplierGstin: string;
      supplierName: string;
      invoiceNumber: string;
      invoiceType: string;
      invoiceDate: Date;
      invoiceValue: number;
      placeOfSupply?: string | null;
      reverseCharge: string;
      taxableValue: number;
      integratedTax: number;
      centralTax: number;
      stateUtTax: number;
      cess: number;
      totalGst: number;
      gstrPeriod: string;
      periodKey: string;
      financialYear: string;
      filingDate?: Date | null;
      itcAvailability: string;
      reason?: string | null;
      applicableTaxRate?: number | null;
      source?: string | null;
      irn?: string | null;
      irnDate?: Date | null;
      importBatchId?: string | null;
      createdBy?: string | null;
    },
    db: DbClient = getPrisma()
  ): Promise<B2bInvoice> {
    const created = await db.b2bInvoice.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        supplierId: data.supplierId,
        supplierGstin: data.supplierGstin,
        supplierName: data.supplierName,
        invoiceNumber: data.invoiceNumber,
        invoiceType: data.invoiceType,
        invoiceDate: data.invoiceDate,
        invoiceValue: data.invoiceValue,
        placeOfSupply: data.placeOfSupply ?? null,
        reverseCharge: data.reverseCharge,
        taxableValue: data.taxableValue,
        integratedTax: data.integratedTax,
        centralTax: data.centralTax,
        stateUtTax: data.stateUtTax,
        cess: data.cess,
        totalGst: data.totalGst,
        gstrPeriod: data.gstrPeriod,
        periodKey: data.periodKey,
        financialYear: data.financialYear,
        filingDate: data.filingDate ?? null,
        itcAvailability: data.itcAvailability,
        reason: data.reason ?? null,
        applicableTaxRate: data.applicableTaxRate ?? 100,
        source: data.source ?? 'GSTR-1',
        irn: data.irn ?? null,
        irnDate: data.irnDate ?? null,
        importBatchId: data.importBatchId ?? null,
        createdBy: data.createdBy ?? null,
      },
    });
    return mapB2bInvoice(created);
  },

  async updateInvoice(id: string, data: Record<string, any>, db: DbClient = getPrisma()): Promise<B2bInvoice> {
    const updated = await db.b2bInvoice.update({
      where: { id },
      data,
    });
    return mapB2bInvoice(updated);
  },

  async deleteInvoice(id: string, db: DbClient = getPrisma()): Promise<boolean> {
    const existing = await db.b2bInvoice.findUnique({ where: { id } });
    if (!existing) return false;
    await db.b2bInvoice.delete({ where: { id } });
    return true;
  },

  // --- Import Batches ---
  async createImportBatch(
    data: {
      id: string;
      fileName: string;
      fileSizeBytes?: number;
      uploadedBy?: string;
      totalRows: number;
      successfulRows: number;
      failedRows: number;
      duplicateRows: number;
      importStatus: string;
      gstrPeriodSummary: Record<string, number>;
    },
    db: DbClient = getPrisma()
  ): Promise<ImportBatch> {
    const created = await db.importBatch.create({
      data: {
        id: data.id,
        fileName: data.fileName,
        fileSizeBytes: data.fileSizeBytes !== undefined ? BigInt(data.fileSizeBytes) : null,
        uploadedBy: data.uploadedBy ?? null,
        totalRows: data.totalRows,
        successfulRows: data.successfulRows,
        failedRows: data.failedRows,
        duplicateRows: data.duplicateRows,
        importStatus: data.importStatus,
        gstrPeriodSummary: data.gstrPeriodSummary,
      },
    });
    return mapImportBatch(created);
  },

  async findImportBatches(db: DbClient = getPrisma()): Promise<ImportBatch[]> {
    const rows = await db.importBatch.findMany({
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map(mapImportBatch);
  },
};
