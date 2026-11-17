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

  async checkUniqueInvoice(invoiceNumber: string, financialYearId = 'fy-2026-27') {
    const cleanInv = invoiceNumber.trim();
    if (!cleanInv) {
      return { isUnique: true, normalizedKey: '', existingInvoiceNumber: null };
    }
    const normalizedKey = normalizeInvoiceKey(cleanInv);
    const existing = await shipmentsRepository.findByNormalizedKey(normalizedKey, financialYearId);
    return {
      isUnique: !existing,
      normalizedKey,
      existingInvoiceNumber: existing ? existing.invoiceNumber : null,
    };
  },

  async createShipmentWithTx(tx: DbClient, data: CreateShipmentInput, actorUserId: string): Promise<Shipment> {
    const normalizedKey = normalizeInvoiceKey(data.invoiceNumber);
    const fyId = data.financialYearId || (await mastersService.getCurrentFinancialYear(tx)).id;

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
    const invVal = round2(data.invoiceValueUsd || 0);
    const exRate = Number(data.sbExchangeRate || 84.5);
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
        if (amount !== undefined && amount >= 0) {
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

    // Handle optional initial FIRC payment allocation
    if (data.initialFircPaymentId) {
      const allocAmount = data.initialFircAllocationAmount || invVal;
      if (allocAmount > 0) {
        await allocationService.allocateWithTx(
          tx,
          {
            paymentId: data.initialFircPaymentId,
            shipmentId: created.id,
            allocatedAmountUsd: allocAmount,
            notes: 'Initial allocation on shipment creation',
          },
          actorUserId
        );
      }
    }

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
      financialYearId = 'fy-2026-27',
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
      fircIrmNumber,
      fircSenderRef,
      fircAmountUsd,
      fircExchangeRate,
      fircInrAmount,
      fircValueDate,
      fircCreditDate,
      fircBankName,
    } = body;

    // Mandatory Rule: Require FIRC/payment linkage before saving a shipment
    const hasFircEvidence = Boolean(files?.fircDoc?.[0] || fircIrmNumber);
    if (!hasFircEvidence) {
      throw new ValidationError(
        'Mandatory Rule Violation: A valid FIRC/payment document or IRM reference must be linked before saving a shipment.'
      );
    }

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

    const invVal = Number(invoiceValueUsd || extractions.invoiceDoc?.fields?.invoiceValueUsd?.value || 0);
    const exRate = Number(sbExchangeRate || extractions.shippingBillDoc?.fields?.sbExchangeRate?.value || 92.1);
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
            initialFircDocumentUploaded: hasFircEvidence,
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

        // Handle FIRC payment creation & allocation
        const finalIrm = fircIrmNumber || extractions.fircDoc?.fields?.irmNumber?.value;
        if (finalIrm) {
          const cleanIrm = String(finalIrm).trim().toUpperCase();
          let payment = await paymentsService.findByIrmNumber(cleanIrm, tx);
          const fircAmt = Number(fircAmountUsd || extractions.fircDoc?.fields?.verifiedAmount?.value || invVal);

          if (!payment && fircAmt > 0) {
            const bankId = await mastersService.resolveBankId(undefined, fircBankName, tx);
            const fircRate = Number(fircExchangeRate || extractions.fircDoc?.fields?.exchangeRate?.value || 93.28);
            const fircInr = Number(
              fircInrAmount || extractions.fircDoc?.fields?.inrAmount?.value || calculateFobInr(fircAmt, fircRate)
            );
            payment = await paymentsService.createPayment(
              {
                irmNumber: cleanIrm,
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

          if (payment) {
            const allocAmount = Math.min(fircAmt, invVal, payment.availableBalanceUsd ?? fircAmt);
            if (allocAmount > 0) {
              await allocationService.allocateWithTx(
                tx,
                {
                  paymentId: payment.id,
                  shipmentId: shipment.id,
                  allocatedAmountUsd: allocAmount,
                  notes: `Auto-allocated on shipment creation (${invoiceNumber})`,
                },
                actorUserId
              );
            }
          }
        }

        // Handle BRC details if extracted/supplied
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

        // Save physical files inside STORAGE_ROOT and register documents
        const fy = await mastersService.getFinancialYearById(shipment.financialYearId, tx);
        const fyLabel = fy?.label || '2026-27';

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
    const existing = await shipmentsRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Shipment not found.');

    const patch: Record<string, any> = {};

    if (updates.invoiceNumber && updates.invoiceNumber.trim() !== existing.invoiceNumber) {
      const newKey = normalizeInvoiceKey(updates.invoiceNumber);
      const fyId = updates.financialYearId || existing.financialYearId;
      const dup = await shipmentsRepository.findByNormalizedKey(newKey, fyId, tx);
      if (dup && dup.id !== id) {
        throw new ConflictError(`Another shipment with key '${newKey}' exists in this Financial Year.`);
      }
      patch.invoiceNumber = updates.invoiceNumber.trim();
      patch.normalizedInvoiceKey = newKey;
    }

    if (updates.consigneeId) {
      patch.consigneeId = updates.consigneeId;
    } else if (updates.consigneeName) {
      const consignee = await mastersService.resolveOrCreateConsignee(
        { consigneeName: updates.consigneeName },
        tx
      );
      patch.consigneeId = consignee.id;
    }

    if (updates.financialYearId) patch.financialYearId = updates.financialYearId;
    if (updates.invoiceDate) patch.invoiceDate = parseDateRequired(updates.invoiceDate, 'invoiceDate');
    if (updates.portCode) patch.portCode = normalizePortCode(updates.portCode);
    if (updates.packageCount !== undefined) patch.packageCount = Number(updates.packageCount);

    let nextInvVal = existing.invoiceValueUsd;
    if (updates.invoiceValueUsd !== undefined) {
      const newInvVal = round2(updates.invoiceValueUsd);
      if (newInvVal < 0) throw new ValidationError('Invoice Value cannot be negative.');
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

    const nextRate = updates.sbExchangeRate !== undefined ? Number(updates.sbExchangeRate) : existing.sbExchangeRate;
    if (updates.sbExchangeRate !== undefined) patch.sbExchangeRate = nextRate;

    if (updates.fobValueInr !== undefined) {
      patch.fobValueInr = round2(updates.fobValueInr);
    } else if (updates.invoiceValueUsd !== undefined || updates.sbExchangeRate !== undefined) {
      patch.fobValueInr = calculateFobInr(nextInvVal, nextRate);
    }

    if (updates.blNumber !== undefined) patch.blNumber = updates.blNumber ? String(updates.blNumber).trim() : null;
    if (updates.blDate !== undefined) patch.blDate = parseDateOptional(updates.blDate);
    if (updates.vesselName !== undefined) patch.vesselName = updates.vesselName ? String(updates.vesselName).trim() : null;
    if (updates.remarks !== undefined) patch.remarks = updates.remarks ? String(updates.remarks).trim() : null;
    if (updates.reviewStatus) patch.reviewStatus = updates.reviewStatus;

    patch.paymentStatus = deriveShipmentPaymentStatus(nextInvVal, existing.totalPaidUsd || 0);

    if (Object.keys(patch).length > 0) {
      await shipmentsRepository.updateRaw(id, patch, tx);
    }

    // Inline incentive updates
    if (updates.dbkClaimed !== undefined || updates.dbkReceived !== undefined || updates.dbkReceivedDate !== undefined) {
      await incentivesService.upsertIncentiveForShipment(
        id,
        'DRAWBACK',
        {
          claimedAmount: updates.dbkClaimed !== undefined ? Number(updates.dbkClaimed) : undefined,
          receivedAmount: updates.dbkReceived !== undefined ? Number(updates.dbkReceived) : undefined,
          receivedDate: updates.dbkReceivedDate,
        },
        tx
      );
    }
    if (updates.rodtepClaimed !== undefined || updates.rodtepReceived !== undefined) {
      await incentivesService.upsertIncentiveForShipment(
        id,
        'RODTEP',
        {
          claimedAmount: updates.rodtepClaimed !== undefined ? Number(updates.rodtepClaimed) : undefined,
          receivedAmount: updates.rodtepReceived !== undefined ? Number(updates.rodtepReceived) : undefined,
        },
        tx
      );
    }
    if (updates.rosctlClaimed !== undefined || updates.rosctlReceived !== undefined) {
      await incentivesService.upsertIncentiveForShipment(
        id,
        'ROSCTL',
        {
          claimedAmount: updates.rosctlClaimed !== undefined ? Number(updates.rosctlClaimed) : undefined,
          receivedAmount: updates.rosctlReceived !== undefined ? Number(updates.rosctlReceived) : undefined,
        },
        tx
      );
    }

    if (updates.brcNumber !== undefined || updates.brcDate !== undefined) {
      await brcService.updateBrcRecord(
        id,
        {
          brcNumber: updates.brcNumber ?? null,
          realisationDate: updates.brcDate ?? null,
          status: updates.brcNumber ? 'REALISED' : undefined,
        },
        tx
      );
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
    const shipment = await shipmentsRepository.findById(id);
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

    const docPaths = (shipment.documents || []).map((d) => d.storedPath);
    await shipmentsRepository.delete(id);

    for (const storedPath of docPaths) {
      fileStorageService.deletePrivateFile(storedPath);
    }

    return { success: true };
  },
};
