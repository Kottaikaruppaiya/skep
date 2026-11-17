/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BrcUploadMode,
  DocumentCategory,
  DocumentExtractionResult,
  IncentiveType,
  ReviewStatus,
  Shipment,
} from '../../../src/types/index.ts';
import { withTransaction, type DbClient } from '../../config/prisma.ts';
import { extractDocumentData } from '../ocr/ocr.extractor.ts';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { parseDateOptional, parseDateRequired, toDateOnlyString } from '../../shared/utils/date.ts';
import { round2 } from '../../shared/utils/decimal.ts';
import { normalizeInvoiceKey, normalizePortCode } from '../../shared/utils/normalizer.ts';
import { brcService } from '../brc/brc.service.ts';
import { documentsService } from '../documents/documents.service.ts';
import { fileStorageService } from '../documents/file-storage.service.ts';
import { incentivesService } from '../incentives/incentives.service.ts';
import { mastersService } from '../masters/masters.service.ts';
import { allocationService } from '../payments/allocation.service.ts';
import { paymentsService } from '../payments/payments.service.ts';
import { settingsRepository } from '../settings/settings.repository.ts';
import { calculateFobInr, deriveShipmentPaymentStatus } from './shipment.calculator.ts';
import { shipmentsRepository } from './shipments.repository.ts';

export interface CreateShipmentInput {
  financialYearId: string;
  invoiceNumber: string;
  invoiceDate?: string;
  consigneeId?: string;
  consigneeName?: string;
  portCode?: string;
  packageCount?: number;
  invoiceValueUsd: number;
  shippingBillNumber?: string;
  shippingBillDate?: string;
  sbExchangeRate?: number;
  fobValueInr?: number;
  blNumber?: string;
  blDate?: string;
  vesselName?: string;
  remarks?: string;
  reviewStatus?: ReviewStatus;
  initialFircPaymentId?: string;
  initialFircAllocationAmount?: number;
  initialFircDocumentUploaded?: boolean;
  incentives?: {
    dbkClaimed?: number;
    rodtepClaimed?: number;
    rosctlClaimed?: number;
  };
  brc?: {
    uploadMode?: BrcUploadMode;
    statutoryDeadline?: string;
    remarks?: string;
  };
}

export const shipmentsService = {
  async listShipments(filters?: {
    financialYearId?: string;
    consigneeId?: string;
    paymentStatus?: string;
    reviewStatus?: string;
    search?: string;
  }): Promise<Shipment[]> {
    return shipmentsRepository.findAll(filters);
  },

  async getShipmentById(id: string, db?: DbClient): Promise<Shipment | null> {
    return shipmentsRepository.findById(id, db);
  },

  async getShipmentByNormalizedKey(
    normalizedKey: string,
    financialYearId: string,
    db?: DbClient
  ): Promise<Shipment | null> {
    return shipmentsRepository.findByNormalizedKey(normalizedKey, financialYearId, db);
  },

  async lookupShipments(q: string, financialYearId?: string) {
    const cleanQ = q.trim();
    if (!cleanQ) return { normalizedQueryKey: '', matches: [] };
    const normalizedQueryKey = normalizeInvoiceKey(cleanQ);
    const all = await shipmentsRepository.findAll(
      financialYearId && financialYearId !== 'ALL' ? { financialYearId } : undefined
    );
    const matches = all.filter(
      (s) =>
        s.normalizedInvoiceKey === normalizedQueryKey ||
        s.invoiceNumber.toLowerCase().includes(cleanQ.toLowerCase()) ||
        s.shippingBillNumber.includes(cleanQ) ||
        (s.blNumber && s.blNumber.toLowerCase().includes(cleanQ.toLowerCase()))
    );
    return { normalizedQueryKey, matches };
  },

  async checkUniqueInvoice(invoiceNumber: string, financialYearId?: string) {
    const cleanInv = invoiceNumber.trim();
    if (!cleanInv) {
      return { isUnique: true, normalizedKey: '', existingInvoiceNumber: null };
    }
    const fyId = financialYearId?.trim() || (await mastersService.getCurrentFinancialYear()).id;
    const normalizedKey = normalizeInvoiceKey(cleanInv);
    const existing = await shipmentsRepository.findByNormalizedKey(normalizedKey, fyId);
    return {
      isUnique: !existing,
      normalizedKey,
      existingInvoiceNumber: existing ? existing.invoiceNumber : null,
    };
  },

  async createShipmentWithTx(tx: DbClient, data: CreateShipmentInput, actorUserId: string): Promise<Shipment> {
    const normalizedKey = normalizeInvoiceKey(data.invoiceNumber);
    let fyId: string;
    if (data.financialYearId && data.financialYearId.trim()) {
      const fy = await mastersService.getFinancialYearById(data.financialYearId.trim(), tx);
      if (!fy) {
        throw new NotFoundError(`Financial Year '${data.financialYearId}' not found.`);
      }
      fyId = fy.id;
    } else {
      fyId = (await mastersService.getCurrentFinancialYear(tx)).id;
    }

    const invVal = round2(data.invoiceValueUsd);
    if (!Number.isFinite(invVal) || invVal <= 0) {
      throw new ValidationError('Invoice Value (USD) must be greater than zero.');
    }

    const exRate = Number(data.sbExchangeRate);
    if (!Number.isFinite(exRate) || exRate <= 0) {
      throw new ValidationError('Customs Exchange Rate (sbExchangeRate) must be greater than zero.');
    }

    if (!data.initialFircPaymentId || !data.initialFircPaymentId.trim()) {
      throw new ValidationError(
        'Mandatory Rule Violation: A valid linked FIRC / inward remittance payment record (initialFircPaymentId) is required before creating a shipment.'
      );
    }

    const duplicate = await shipmentsRepository.findByNormalizedKey(normalizedKey, fyId, tx);
    if (duplicate) {
      throw new ConflictError(
        `Duplicate Invoice Identity: An invoice with key '${normalizedKey}' already exists in Financial Year '${fyId}'. (Existing: ${duplicate.invoiceNumber})`
      );
    }

    const consignee = await mastersService.resolveOrCreateConsignee(
      {
        consigneeId: data.consigneeId,
        consigneeName: data.consigneeName,
        portOfDischarge: data.portCode,
      },
      tx
    );

    const today = new Date().toISOString().split('T')[0];
    const fobVal =
      data.fobValueInr !== undefined && data.fobValueInr > 0
        ? round2(data.fobValueInr)
        : calculateFobInr(invVal, exRate);
    const sbDateStr = data.shippingBillDate || today;

    const created = await shipmentsRepository.create(
      {
        financialYearId: fyId,
        invoiceNumber: data.invoiceNumber.trim(),
        normalizedInvoiceKey: normalizedKey,
        invoiceDate: parseDateRequired(data.invoiceDate || today, 'invoiceDate'),
        consigneeId: consignee.id,
        portCode: normalizePortCode(data.portCode, 'INNSA1'),
        packageCount: data.packageCount ?? 0,
        invoiceValueUsd: invVal,
        shippingBillNumber: (data.shippingBillNumber || 'PENDING').trim(),
        shippingBillDate: parseDateRequired(sbDateStr, 'shippingBillDate'),
        sbExchangeRate: exRate,
        fobValueInr: fobVal,
        blNumber: data.blNumber?.trim() || null,
        blDate: parseDateOptional(data.blDate),
        vesselName: data.vesselName?.trim() || null,
        paymentStatus: 'UNPAID',
        reviewStatus: data.reviewStatus || 'CONFIRMED',
        remarks: data.remarks?.trim() || null,
      },
      tx
    );

    // Create requested incentive claims
    if (data.incentives) {
      const incentivePairs: Array<[IncentiveType, number | undefined]> = [
        ['DRAWBACK', data.incentives.dbkClaimed],
        ['RODTEP', data.incentives.rodtepClaimed],
        ['ROSCTL', data.incentives.rosctlClaimed],
      ];
      for (const [type, amount] of incentivePairs) {
        if (amount !== undefined && amount > 0) {
          await incentivesService.createIncentive(
            { shipmentId: created.id, type, claimedAmount: amount },
            tx
          );
        }
      }
    }

    // Create default BRC record
    const settings = await settingsRepository.getSettings(tx);
    await brcService.createDefaultForShipment(
      created.id,
      sbDateStr,
      settings.statutoryBrcDays || 270,
      data.brc,
      tx
    );

    // Mandatory FIRC payment allocation
    const allocAmount =
      data.initialFircAllocationAmount !== undefined
        ? round2(data.initialFircAllocationAmount)
        : invVal;
    if (!Number.isFinite(allocAmount) || allocAmount <= 0) {
      throw new ValidationError('Initial FIRC allocation amount must be greater than zero.');
    }

    await allocationService.allocateWithTx(
      tx,
      {
        paymentId: data.initialFircPaymentId.trim(),
        shipmentId: created.id,
        allocatedAmountUsd: allocAmount,
        notes: 'Initial allocation on shipment creation',
      },
      actorUserId
    );

    const hydrated = await shipmentsRepository.findById(created.id, tx);
    return hydrated!;
  },

  async createShipment(data: CreateShipmentInput, actorUserId: string): Promise<Shipment> {
    return withTransaction((tx) => this.createShipmentWithTx(tx, data, actorUserId));
  },

  async createShipmentWithDocuments(
    body: Record<string, any>,
    files: { [fieldname: string]: Express.Multer.File[] } | undefined,
    actorUserId: string
  ): Promise<Shipment> {
    const invoiceNumber = String(body.invoiceNumber || '').trim();
    if (!invoiceNumber) {
      throw new ValidationError('Invoice Number is required and must be unique.');
    }

    const {
      financialYearId,
      invoiceDate,
      consigneeId: rawConsigneeId,
      consigneeName,
      portCode,
      packageCount,
      invoiceValueUsd,
      shippingBillNumber,
      shippingBillDate,
      sbExchangeRate,
      fobValueInr,
      blNumber,
      blDate,
      vesselName,
      remarks,
      dbkClaimed,
      rodtepClaimed,
      rosctlClaimed,
      brcUploadMode = 'SINGLE',
      brcNumber,
      brcIssueDate,
      brcRealisationDate,
      brcRealisedAmount,
      statutoryDeadline,
      initialFircPaymentId,
      initialFircAllocationAmount,
      fircIrmNumber,
      fircSenderRef,
      fircAmountUsd,
      fircExchangeRate,
      fircInrAmount,
      fircValueDate,
      fircCreditDate,
      fircBankId,
      fircBankName,
    } = body;

    // Mandatory Rule: BRC Mode validation
    if (brcUploadMode === 'SINGLE' && files?.brcDoc2?.[0]) {
      throw new ValidationError(
        'Single BRC Mode accepts exactly one BRC document. BRC Copy 2 is not permitted in Single mode.'
      );
    }
    if (brcUploadMode === 'MULTIPLE' && (!files?.brcDoc1?.[0] || !files?.brcDoc2?.[0])) {
      throw new ValidationError(
        'Multiple BRC Mode requires exactly two BRC documents (both BRC Copy 1 and BRC Copy 2 must be uploaded).'
      );
    }

    const fileSpecs: { file?: Express.Multer.File; category: DocumentCategory; key: string }[] = [
      { file: files?.invoiceDoc?.[0], category: 'COMMERCIAL_INVOICE', key: 'invoiceDoc' },
      { file: files?.shippingBillDoc?.[0], category: 'SHIPPING_BILL', key: 'shippingBillDoc' },
      { file: files?.blDoc?.[0], category: 'BILL_OF_LADING', key: 'blDoc' },
      { file: files?.brcDoc1?.[0], category: 'BRC_COPY_1', key: 'brcDoc1' },
      { file: files?.brcDoc2?.[0], category: 'BRC_COPY_2', key: 'brcDoc2' },
      { file: files?.fircDoc?.[0], category: 'FIRC_PAYMENT', key: 'fircDoc' },
      { file: files?.additionalDoc?.[0], category: 'ADDITIONAL_DOC', key: 'additionalDoc' },
    ];

    // Extract documents prior to opening DB transaction so long OCR doesn't hold row locks
    const extractions: Record<string, DocumentExtractionResult> = {};
    for (const spec of fileSpecs) {
      if (!spec.file) continue;
      try {
        extractions[spec.key] = await extractDocumentData(spec.file.buffer, spec.category, spec.file.originalname);
      } catch (e) {
        console.warn(`[ShipmentsService] Extraction error for ${spec.category}:`, e);
      }
    }

    const invVal = round2(Number(invoiceValueUsd ?? extractions.invoiceDoc?.fields?.invoiceValueUsd?.value ?? 0));
    if (!Number.isFinite(invVal) || invVal <= 0) {
      throw new ValidationError('Invoice Value (USD) must be greater than zero.');
    }

    const rawRate = sbExchangeRate ?? extractions.shippingBillDoc?.fields?.sbExchangeRate?.value;
    const exRate = Number(rawRate);
    if (!Number.isFinite(exRate) || exRate <= 0) {
      throw new ValidationError('Customs Exchange Rate (sbExchangeRate) must be provided and greater than zero.');
    }

    const resolvedFircId = typeof initialFircPaymentId === 'string' ? initialFircPaymentId.trim() : '';
    const finalIrmRaw = fircIrmNumber || extractions.fircDoc?.fields?.irmNumber?.value || '';
    const finalIrm = String(finalIrmRaw).trim().toUpperCase();

    if (!resolvedFircId && !finalIrm) {
      throw new ValidationError(
        'Mandatory Rule Violation: A linked FIRC payment record (initialFircPaymentId) or valid FIRC IRM reference with payment details is required before saving a shipment. Uploading a file alone is insufficient.'
      );
    }

    const fobVal = Number(
      fobValueInr || extractions.shippingBillDoc?.fields?.fobValueInr?.value || calculateFobInr(invVal, exRate)
    );
    const invDate = String(
      invoiceDate || extractions.invoiceDoc?.fields?.invoiceDate?.value || new Date().toISOString().split('T')[0]
    );
    const sbNo = String(shippingBillNumber || extractions.shippingBillDoc?.fields?.shippingBillNumber?.value || 'PENDING');
    const sbDate = String(
      shippingBillDate || extractions.shippingBillDoc?.fields?.shippingBillDate?.value || new Date().toISOString().split('T')[0]
    );
    const pkgs = Number(packageCount || extractions.invoiceDoc?.fields?.packageCount?.value || 0);
    const resolvedBlNo = blNumber || extractions.blDoc?.fields?.blNumber?.value || undefined;
    const resolvedBlDate = blDate || extractions.blDoc?.fields?.blDate?.value || undefined;
    const resolvedVessel =
      vesselName ||
      extractions.shippingBillDoc?.fields?.vesselName?.value ||
      extractions.blDoc?.fields?.vesselName?.value ||
      undefined;

    const writtenPaths: string[] = [];

    try {
      return await withTransaction(async (tx) => {
        // Resolve or create the mandatory FIRC payment record first
        let payment = resolvedFircId ? await paymentsService.getPaymentById(resolvedFircId, tx) : null;
        if (resolvedFircId && !payment) {
          throw new NotFoundError(`Linked FIRC payment '${resolvedFircId}' not found.`);
        }

        if (!payment && finalIrm) {
          payment = await paymentsService.findByIrmNumber(finalIrm, tx);
          if (!payment) {
            const fircAmt = round2(Number(fircAmountUsd ?? extractions.fircDoc?.fields?.verifiedAmount?.value ?? 0));
            if (!Number.isFinite(fircAmt) || fircAmt <= 0) {
              throw new ValidationError(
                'Mandatory Rule Violation: Creating a new FIRC payment requires a positive Verified Remittance Amount (USD).'
              );
            }
            const bankId = await mastersService.resolveBankId(
              fircBankId ? String(fircBankId).trim() : undefined,
              fircBankName
                ? String(fircBankName).trim()
                : (extractions.fircDoc?.fields?.bankName?.value as string | undefined),
              tx
            );
            const rawFircRate = fircExchangeRate ?? extractions.fircDoc?.fields?.exchangeRate?.value;
            const parsedFircRate = rawFircRate !== undefined && rawFircRate !== null && rawFircRate !== '' ? Number(rawFircRate) : undefined;
            const fircRate = parsedFircRate && Number.isFinite(parsedFircRate) && parsedFircRate > 0 ? parsedFircRate : undefined;

            const rawFircInr = fircInrAmount ?? extractions.fircDoc?.fields?.inrAmount?.value;
            const parsedFircInr = rawFircInr !== undefined && rawFircInr !== null && rawFircInr !== '' ? Number(rawFircInr) : undefined;
            const fircInr =
              parsedFircInr && Number.isFinite(parsedFircInr) && parsedFircInr > 0
                ? parsedFircInr
                : fircRate
                  ? calculateFobInr(fircAmt, fircRate)
                  : undefined;

            payment = await paymentsService.createPayment(
              {
                irmNumber: finalIrm,
                senderReference:
                  fircSenderRef ||
                  (extractions.fircDoc?.fields?.senderReference?.value as string | undefined) ||
                  undefined,
                currency: 'USD',
                verifiedAmount: fircAmt,
                inrAmount: fircInr,
                exchangeRate: fircRate,
                valueDate: String(fircValueDate || extractions.fircDoc?.fields?.valueDate?.value || invDate),
                creditDate: String(fircCreditDate || extractions.fircDoc?.fields?.creditDate?.value || invDate),
                fircIssueDate: String(fircCreditDate || extractions.fircDoc?.fields?.creditDate?.value || invDate),
                bankId,
                purposeCode: 'P0103',
                remarks: `Payment for invoice ${invoiceNumber}`,
              },
              tx
            );
          }
        }

        if (!payment) {
          throw new ValidationError('Mandatory Rule Violation: A valid FIRC payment record is required.');
        }

        const availableOnPayment = payment.availableBalanceUsd ?? payment.verifiedAmount;
        const requestedAlloc =
          initialFircAllocationAmount !== undefined && Number(initialFircAllocationAmount) > 0
            ? round2(Number(initialFircAllocationAmount))
            : Math.min(invVal, availableOnPayment);

        if (requestedAlloc <= 0) {
          throw new ValidationError(
            `Linked FIRC payment '${payment.irmNumber}' has insufficient available balance ($${availableOnPayment.toFixed(2)}) to allocate to this shipment.`
          );
        }

        const shipment = await this.createShipmentWithTx(
          tx,
          {
            financialYearId,
            invoiceNumber,
            invoiceDate: invDate,
            consigneeId: rawConsigneeId,
            consigneeName,
            portCode: normalizePortCode(portCode, 'INMAA1'),
            packageCount: pkgs,
            invoiceValueUsd: invVal,
            shippingBillNumber: sbNo,
            shippingBillDate: sbDate,
            sbExchangeRate: exRate,
            fobValueInr: fobVal,
            blNumber: resolvedBlNo ? String(resolvedBlNo).trim() : undefined,
            blDate: resolvedBlDate ? String(resolvedBlDate) : undefined,
            vesselName: resolvedVessel ? String(resolvedVessel).trim() : undefined,
            remarks: remarks?.trim() || undefined,
            initialFircPaymentId: payment.id,
            initialFircAllocationAmount: requestedAlloc,
            incentives: {
              dbkClaimed: Number(dbkClaimed || extractions.shippingBillDoc?.fields?.dbkClaimed?.value || 0),
              rodtepClaimed: Number(rodtepClaimed || extractions.shippingBillDoc?.fields?.rodtepClaimed?.value || 0),
              rosctlClaimed: Number(rosctlClaimed || extractions.shippingBillDoc?.fields?.rosctlClaimed?.value || 0),
            },
            brc: {
              uploadMode: brcUploadMode === 'MULTIPLE' ? 'MULTIPLE' : 'SINGLE',
              statutoryDeadline:
                statutoryDeadline ||
                (extractions.shippingBillDoc?.fields?.statutoryDeadline?.value as string | undefined) ||
                undefined,
              remarks: remarks?.trim(),
            },
          },
          actorUserId
        );

        // Save physical files inside STORAGE_ROOT and register documents BEFORE updating BRC to REALISED
        const fy = await mastersService.getFinancialYearById(shipment.financialYearId, tx);
        const fyLabel = fy?.label || (await mastersService.getCurrentFinancialYear(tx)).label;

        for (const spec of fileSpecs) {
          if (!spec.file) continue;
          const { relativePath } = fileStorageService.writeDocumentFile(
            fyLabel,
            shipment.normalizedInvoiceKey,
            spec.category,
            spec.file.originalname,
            spec.file.buffer
          );
          writtenPaths.push(relativePath);

          const ext = extractions[spec.key];
          await documentsService.registerDocument(
            {
              shipmentId: shipment.id,
              paymentId: spec.category === 'FIRC_PAYMENT' ? payment.id : undefined,
              category: spec.category,
              originalFilename: spec.file.originalname,
              storedPath: relativePath,
              mimeType: spec.file.mimetype,
              fileSizeBytes: spec.file.size,
              extractedData: ext,
              reviewStatus: ext?.reviewStatus || 'CONFIRMED',
              ocrApplied: ext?.ocrApplied || false,
              ocrConfidence: ext?.ocrConfidence,
              ocrTextPreview: ext?.ocrTextPreview,
              extractionMethod: ext?.extractionMethod || 'PDF_TEXT',
              uploadedByUserId: actorUserId,
            },
            tx
          );
        }

        // Handle BRC details after documents are registered so SINGLE/MULTIPLE doc rules verify accurately
        const finalBrcNo =
          brcNumber ||
          extractions.brcDoc1?.fields?.brcNumber?.value ||
          extractions.brcDoc2?.fields?.brcNumber?.value;
        if (finalBrcNo) {
          await brcService.updateBrcRecord(
            shipment.id,
            {
              brcNumber: String(finalBrcNo).trim(),
              issueDate: (brcIssueDate || extractions.brcDoc1?.fields?.issueDate?.value) as string | undefined,
              realisationDate: (brcRealisationDate || extractions.brcDoc1?.fields?.realisationDate?.value) as
                | string
                | undefined,
              realisedAmount: Number(brcRealisedAmount || extractions.brcDoc1?.fields?.realisedAmount?.value || invVal),
              realisedCurrency: 'USD',
              status: 'REALISED',
            },
            tx
          );
        }

        return (await shipmentsRepository.findById(shipment.id, tx))!;
      });
    } catch (err) {
      for (const relPath of writtenPaths) {
        fileStorageService.deletePrivateFile(relPath);
      }
      throw err;
    }
  },

  async updateShipmentWithTx(tx: DbClient, id: string, updates: Record<string, any>): Promise<Shipment> {
    await shipmentsRepository.lockShipmentForUpdate(id, tx);
    const existing = await shipmentsRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Shipment not found.');

    const patch: Record<string, any> = {};

    let targetFyId = existing.financialYearId;
    if (updates.financialYearId !== undefined) {
      const fy = await mastersService.getFinancialYearById(String(updates.financialYearId), tx);
      if (!fy) throw new NotFoundError(`Financial Year '${updates.financialYearId}' not found.`);
      patch.financialYearId = fy.id;
      targetFyId = fy.id;
    }

    if (updates.invoiceNumber && updates.invoiceNumber.trim() !== existing.invoiceNumber) {
      const newKey = normalizeInvoiceKey(updates.invoiceNumber);
      const dup = await shipmentsRepository.findByNormalizedKey(newKey, targetFyId, tx);
      if (dup && dup.id !== id) {
        throw new ConflictError(`Another shipment with key '${newKey}' exists in this Financial Year.`);
      }
      patch.invoiceNumber = updates.invoiceNumber.trim();
      patch.normalizedInvoiceKey = newKey;
    }

    if (updates.consigneeId !== undefined) {
      const consignee = await mastersService.resolveOrCreateConsignee({ consigneeId: String(updates.consigneeId) }, tx);
      patch.consigneeId = consignee.id;
    } else if (updates.consigneeName) {
      const consignee = await mastersService.resolveOrCreateConsignee(
        { consigneeName: updates.consigneeName },
        tx
      );
      patch.consigneeId = consignee.id;
    }

    if (updates.invoiceDate) patch.invoiceDate = parseDateRequired(updates.invoiceDate, 'invoiceDate');
    if (updates.portCode) patch.portCode = normalizePortCode(updates.portCode);
    if (updates.packageCount !== undefined) patch.packageCount = Number(updates.packageCount);

    let nextInvVal = existing.invoiceValueUsd;
    if (updates.invoiceValueUsd !== undefined) {
      const newInvVal = round2(updates.invoiceValueUsd);
      if (!Number.isFinite(newInvVal) || newInvVal <= 0) {
        throw new ValidationError('Invoice Value (USD) must be greater than zero.');
      }
      const totalAllocated = existing.totalPaidUsd || 0;
      if (newInvVal < totalAllocated - 0.001) {
        throw new ConflictError(
          `Cannot reduce Invoice Value ($${newInvVal.toFixed(2)}) below already allocated payment amount ($${totalAllocated.toFixed(2)}) on Invoice ${existing.invoiceNumber}. Please reverse excess payment allocations first.`
        );
      }
      patch.invoiceValueUsd = newInvVal;
      nextInvVal = newInvVal;
    }

    if (updates.shippingBillNumber) patch.shippingBillNumber = String(updates.shippingBillNumber).trim();
    if (updates.shippingBillDate) patch.shippingBillDate = parseDateRequired(updates.shippingBillDate, 'shippingBillDate');

    let nextRate = existing.sbExchangeRate;
    if (updates.sbExchangeRate !== undefined) {
      const parsedRate = Number(updates.sbExchangeRate);
      if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
        throw new ValidationError('Customs Exchange Rate must be greater than zero.');
      }
      patch.sbExchangeRate = parsedRate;
      nextRate = parsedRate;
    }

    if (updates.fobValueInr !== undefined) {
      patch.fobValueInr = round2(updates.fobValueInr);
    } else if (updates.invoiceValueUsd !== undefined || updates.sbExchangeRate !== undefined) {
      patch.fobValueInr = calculateFobInr(nextInvVal, nextRate);
    }

    const cleanOptionalText = (v: any) => (v === null || v === 'DEL' || String(v).trim() === '' ? null : String(v).trim());
    if (updates.blNumber !== undefined) patch.blNumber = cleanOptionalText(updates.blNumber);
    if (updates.blDate !== undefined) patch.blDate = updates.blDate === 'DEL' ? null : parseDateOptional(updates.blDate);
    if (updates.vesselName !== undefined) patch.vesselName = cleanOptionalText(updates.vesselName);
    if (updates.remarks !== undefined) patch.remarks = cleanOptionalText(updates.remarks);
    if (updates.reviewStatus) patch.reviewStatus = updates.reviewStatus;

    patch.paymentStatus = deriveShipmentPaymentStatus(nextInvVal, existing.totalPaidUsd || 0);

    if (Object.keys(patch).length > 0) {
      await shipmentsRepository.updateRaw(id, patch, tx);
    }

    const parseOptionalNum = (val: any): number | undefined => {
      if (val === undefined) return undefined;
      if (val === null || val === 'DEL' || String(val).trim() === '') return 0;
      const n = Number(val);
      if (!Number.isFinite(n)) throw new ValidationError('Invalid numeric incentive value.');
      return n;
    };

    // Inline incentive updates
    if (updates.dbkClaimed !== undefined || updates.dbkReceived !== undefined || updates.dbkReceivedDate !== undefined) {
      await incentivesService.upsertIncentiveForShipment(
        id,
        'DRAWBACK',
        {
          claimedAmount: parseOptionalNum(updates.dbkClaimed),
          receivedAmount: parseOptionalNum(updates.dbkReceived),
          receivedDate: updates.dbkReceivedDate === 'DEL' ? undefined : updates.dbkReceivedDate,
        },
        tx
      );
    }
    if (updates.rodtepClaimed !== undefined || updates.rodtepReceived !== undefined) {
      await incentivesService.upsertIncentiveForShipment(
        id,
        'RODTEP',
        {
          claimedAmount: parseOptionalNum(updates.rodtepClaimed),
          receivedAmount: parseOptionalNum(updates.rodtepReceived),
        },
        tx
      );
    }
    if (updates.rosctlClaimed !== undefined || updates.rosctlReceived !== undefined) {
      await incentivesService.upsertIncentiveForShipment(
        id,
        'ROSCTL',
        {
          claimedAmount: parseOptionalNum(updates.rosctlClaimed),
          receivedAmount: parseOptionalNum(updates.rosctlReceived),
        },
        tx
      );
    }

    if (
      updates.brcNumber !== undefined ||
      updates.brcDate !== undefined ||
      updates.realisationDate !== undefined ||
      updates.brcStatus !== undefined
    ) {
      const brcPatch: Parameters<typeof brcService.updateBrcRecord>[1] = {};
      if (updates.brcNumber !== undefined) {
        brcPatch.brcNumber = cleanOptionalText(updates.brcNumber);
      }
      if (updates.brcDate !== undefined) {
        brcPatch.issueDate = updates.brcDate === 'DEL' || updates.brcDate === '' ? null : updates.brcDate;
      }
      if (updates.realisationDate !== undefined) {
        brcPatch.realisationDate =
          updates.realisationDate === 'DEL' || updates.realisationDate === '' ? null : updates.realisationDate;
      }
      if (updates.brcStatus !== undefined) {
        brcPatch.status = updates.brcStatus;
      }
      await brcService.updateBrcRecord(id, brcPatch, tx);
    }

    return (await shipmentsRepository.findById(id, tx))!;
  },

  async updateShipment(id: string, updates: Record<string, any>): Promise<Shipment> {
    return withTransaction((tx) => this.updateShipmentWithTx(tx, id, updates));
  },

  async archiveShipment(id: string, reason: string | undefined, actorUserId: string): Promise<Shipment> {
    const existing = await shipmentsRepository.findById(id);
    if (!existing) throw new NotFoundError('Shipment not found.');

    await shipmentsRepository.updateRaw(id, {
      isArchived: true,
      archivedAt: new Date(),
      archivedReason: reason?.trim() || 'Archived by administrator',
      archivedBy: actorUserId,
    });

    return (await shipmentsRepository.findById(id))!;
  },

  async restoreShipment(id: string): Promise<Shipment> {
    const existing = await shipmentsRepository.findById(id);
    if (!existing) throw new NotFoundError('Shipment not found.');

    await shipmentsRepository.updateRaw(id, {
      isArchived: false,
      archivedAt: null,
      archivedReason: null,
      archivedBy: null,
    });

    return (await shipmentsRepository.findById(id))!;
  },

  async deleteShipment(id: string): Promise<{ success: boolean }> {
    const docPaths = await withTransaction(async (tx) => {
      await shipmentsRepository.lockShipmentForUpdate(id, tx);
      const shipment = await shipmentsRepository.findById(id, tx);
      if (!shipment) throw new NotFoundError('Shipment not found.');

      const allocs = shipment.allocations || [];
      if (allocs.length > 0) {
        const totalPaid = shipment.totalPaidUsd || 0;
        throw new ConflictError(
          `Cannot delete shipment "${shipment.invoiceNumber}": It has active FIRC payment allocations totaling $${totalPaid.toFixed(2)} USD across ${allocs.length} payment(s). Please reverse all payment allocations first, or archive this shipment.`
        );
      }

      const receivedIncentives = (shipment.incentives || []).filter((i) => i.receivedAmount > 0);
      if (receivedIncentives.length > 0) {
        throw new ConflictError(
          `Cannot delete shipment "${shipment.invoiceNumber}": Incentive funds have already been credited for this shipment. Deletion is blocked to preserve statutory customs history. Please archive this shipment instead.`
        );
      }

      const brc = shipment.brcRecord;
      if (brc && (brc.status === 'REALISED' || Boolean(brc.brcNumber))) {
        throw new ConflictError(
          `Cannot delete shipment "${shipment.invoiceNumber}": Bank Realisation Certificate (${brc.brcNumber || 'eBRC'}) is marked REALISED. Deletion of realised export records is prohibited under DGFT regulations. Please archive this shipment instead.`
        );
      }

      const paths = (shipment.documents || []).map((d) => d.storedPath);
      await shipmentsRepository.delete(id, tx);
      return paths;
    });

    for (const storedPath of docPaths) {
      fileStorageService.deletePrivateFile(storedPath);
    }

    return { success: true };
  },
};
