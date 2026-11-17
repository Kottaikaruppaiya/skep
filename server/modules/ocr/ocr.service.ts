/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import type { DocumentCategory, OcrJob, Payment, Shipment } from '../../../src/types/index.ts';
import { withTransaction } from '../../config/prisma.ts';
import { getStagingDir } from '../../config/storage.ts';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { normalizeInvoiceKey } from '../../shared/utils/normalizer.ts';
import { documentsService } from '../documents/documents.service.ts';
import { mastersService } from '../masters/masters.service.ts';
import { paymentsService } from '../payments/payments.service.ts';
import { shipmentsService } from '../shipments/shipments.service.ts';
import { ocrRepository } from './ocr.repository.ts';

export const ocrService = {
  async listJobs(filters?: { status?: string; category?: string }): Promise<OcrJob[]> {
    return ocrRepository.findAll(filters);
  },

  async getJobById(id: string): Promise<OcrJob | null> {
    return ocrRepository.findById(id);
  },

  async enqueueJob(
    input: {
      originalFilename: string;
      fileSizeBytes: number;
      category: DocumentCategory;
      financialYearId?: string;
      documentId?: string;
      buffer?: Buffer;
    }
  ): Promise<OcrJob> {
    const job = await ocrRepository.create({
      documentId: input.documentId,
      originalFilename: input.originalFilename,
      fileSizeBytes: input.fileSizeBytes,
      category: input.category,
      financialYearId: input.financialYearId || 'fy-2026-27',
    });

    if (input.buffer) {
      const stagingPath = path.resolve(getStagingDir(), `${job.id}.bin`);
      fs.writeFileSync(stagingPath, input.buffer);
    }

    return job;
  },

  async claimNextJob(workerId: string, leaseDurationMs = 60000): Promise<OcrJob | null> {
    return ocrRepository.claimNextJob(workerId, leaseDurationMs);
  },

  async renewLease(jobId: string, workerId: string, additionalMs = 60000): Promise<boolean> {
    return ocrRepository.renewLease(jobId, workerId, additionalMs);
  },

  async completeJob(
    jobId: string,
    workerId: string,
    result: Parameters<typeof ocrRepository.completeJob>[2]
  ): Promise<OcrJob> {
    return ocrRepository.completeJob(jobId, workerId, result);
  },

  async failJob(jobId: string, workerId: string, errorMsg: string, executionTimeMs?: number): Promise<OcrJob> {
    return ocrRepository.failJob(jobId, workerId, errorMsg, executionTimeMs);
  },

  async retryJob(id: string): Promise<OcrJob> {
    return ocrRepository.resetForRetry(id);
  },

  async deleteJob(id: string): Promise<{ success: boolean }> {
    const job = await ocrRepository.findById(id);
    if (!job) throw new NotFoundError('OCR Job not found.');

    await ocrRepository.delete(id);

    const stagingPath = path.resolve(getStagingDir(), `${id}.bin`);
    if (fs.existsSync(stagingPath)) {
      try {
        fs.unlinkSync(stagingPath);
      } catch {}
    }

    return { success: true };
  },

  async approveJob(
    jobId: string,
    reviewedValues: Record<string, any>,
    actor: { id: string; name: string }
  ): Promise<{ shipment?: Shipment; payment?: Payment; job: OcrJob }> {
    return withTransaction(async (tx) => {
      const job = await ocrRepository.findByIdForUpdate(tx, jobId);
      if (!job) throw new NotFoundError('OCR job not found.');

      if (job.approvedAt) {
        throw new ConflictError('OCR job has already been approved and committed.');
      }

      let targetShipment: Shipment | undefined;
      let targetPayment: Payment | undefined;

      if (
        job.category === 'COMMERCIAL_INVOICE' ||
        job.category === 'SHIPPING_BILL' ||
        job.category === 'BILL_OF_LADING' ||
        job.category === 'ADDITIONAL_DOC'
      ) {
        const invoiceNumber = String(reviewedValues.invoiceNumber || job.candidateDraft?.invoiceNumber || '').trim();
        if (!invoiceNumber) {
          throw new ValidationError('Invoice Number is required to commit approved shipment data.');
        }

        const fyId = job.financialYearId || 'fy-2026-27';
        const normalizedKey = normalizeInvoiceKey(invoiceNumber);
        const existing = await shipmentsService.getShipmentByNormalizedKey(normalizedKey, fyId, tx);

        if (existing) {
          targetShipment = await shipmentsService.updateShipmentWithTx(tx, existing.id, {
            invoiceDate: reviewedValues.invoiceDate || existing.invoiceDate,
            invoiceValueUsd:
              reviewedValues.invoiceValueUsd !== undefined
                ? Number(reviewedValues.invoiceValueUsd)
                : existing.invoiceValueUsd,
            shippingBillNumber: reviewedValues.shippingBillNumber || existing.shippingBillNumber,
            shippingBillDate: reviewedValues.shippingBillDate || existing.shippingBillDate,
            sbExchangeRate:
              reviewedValues.sbExchangeRate !== undefined
                ? Number(reviewedValues.sbExchangeRate)
                : existing.sbExchangeRate,
            fobValueInr:
              reviewedValues.fobValueInr !== undefined ? Number(reviewedValues.fobValueInr) : existing.fobValueInr,
            blNumber: reviewedValues.blNumber !== undefined ? reviewedValues.blNumber : existing.blNumber,
            blDate: reviewedValues.blDate !== undefined ? reviewedValues.blDate : existing.blDate,
            vesselName: reviewedValues.vesselName !== undefined ? reviewedValues.vesselName : existing.vesselName,
            packageCount:
              reviewedValues.packageCount !== undefined ? Number(reviewedValues.packageCount) : existing.packageCount,
            portCode: reviewedValues.portCode || existing.portCode,
            reviewStatus: 'CONFIRMED',
          });
        } else {
          const consignee = await mastersService.resolveOrCreateConsignee(
            {
              consigneeId: reviewedValues.consigneeId,
              consigneeName: reviewedValues.consigneeName || job.candidateDraft?.consigneeName,
              portOfDischarge: reviewedValues.portCode || 'LKCMB',
            },
            tx
          );

          targetShipment = await shipmentsService.createShipmentWithTx(
            tx,
            {
              financialYearId: fyId,
              invoiceNumber,
              invoiceDate: reviewedValues.invoiceDate || new Date().toISOString().split('T')[0],
              consigneeId: consignee.id,
              portCode: reviewedValues.portCode || 'INMAA1',
              packageCount: Number(reviewedValues.packageCount || 0),
              invoiceValueUsd: Number(reviewedValues.invoiceValueUsd || 0),
              shippingBillNumber: reviewedValues.shippingBillNumber || 'PENDING',
              shippingBillDate: reviewedValues.shippingBillDate || new Date().toISOString().split('T')[0],
              sbExchangeRate: Number(reviewedValues.sbExchangeRate || 92.1),
              fobValueInr: Number(reviewedValues.fobValueInr || 0),
              blNumber: reviewedValues.blNumber,
              blDate: reviewedValues.blDate,
              vesselName: reviewedValues.vesselName,
              remarks: reviewedValues.remarks,
              reviewStatus: 'CONFIRMED',
              initialFircPaymentId: reviewedValues.initialFircPaymentId,
              initialFircDocumentUploaded: Boolean(
                reviewedValues.initialFircPaymentId || reviewedValues.initialFircDocumentUploaded
              ),
              incentives: {
                dbkClaimed: Number(reviewedValues.dbkClaimed || 0),
                rodtepClaimed: Number(reviewedValues.rodtepClaimed || 0),
                rosctlClaimed: Number(reviewedValues.rosctlClaimed || 0),
              },
            },
            actor.id
          );
        }
      } else if (job.category === 'FIRC_PAYMENT') {
        const irmNumber = String(reviewedValues.irmNumber || job.candidateFields?.irmNumber?.value || '')
          .trim()
          .toUpperCase();
        if (!irmNumber) {
          throw new ValidationError('Inward Remittance Number (IRM) is required to commit payment data.');
        }

        const existingPayment = await paymentsService.findByIrmNumber(irmNumber, tx);
        if (existingPayment) {
          targetPayment = await paymentsService.updatePayment(
            existingPayment.id,
            {
              verifiedAmount:
                reviewedValues.verifiedAmount !== undefined
                  ? Number(reviewedValues.verifiedAmount)
                  : existingPayment.verifiedAmount,
              exchangeRate:
                reviewedValues.exchangeRate !== undefined
                  ? Number(reviewedValues.exchangeRate)
                  : existingPayment.exchangeRate,
              inrAmount:
                reviewedValues.inrAmount !== undefined ? Number(reviewedValues.inrAmount) : existingPayment.inrAmount,
              valueDate: reviewedValues.valueDate || existingPayment.valueDate,
              creditDate: reviewedValues.creditDate || existingPayment.creditDate,
            },
            tx
          );
        } else {
          const resolvedBankId = await mastersService.resolveBankId(reviewedValues.bankId, undefined, tx);
          targetPayment = await paymentsService.createPayment(
            {
              irmNumber,
              senderReference: reviewedValues.senderReference,
              currency: reviewedValues.currency || 'USD',
              verifiedAmount: Number(reviewedValues.verifiedAmount || 0),
              exchangeRate: Number(reviewedValues.exchangeRate || 93.28),
              inrAmount: Number(reviewedValues.inrAmount || 0),
              valueDate: reviewedValues.valueDate || new Date().toISOString().split('T')[0],
              creditDate: reviewedValues.creditDate || new Date().toISOString().split('T')[0],
              bankId: resolvedBankId,
              purposeCode: reviewedValues.purposeCode || 'P0103',
              remarks: reviewedValues.remarks,
            },
            tx
          );
        }
      }

      if (job.documentId) {
        await documentsService.linkAndConfirmDocument(
          job.documentId,
          {
            shipmentId: targetShipment?.id,
            paymentId: targetPayment?.id,
            reviewStatus: 'CONFIRMED',
          },
          tx
        );
      }

      const approvedJob = await ocrRepository.markApproved(
        job.id,
        {
          targetShipmentId: targetShipment?.id,
          targetPaymentId: targetPayment?.id,
          approvedByUserId: actor.id,
          approvedByName: actor.name || 'Administrator',
        },
        tx
      );

      return { shipment: targetShipment, payment: targetPayment, job: approvedJob };
    });
  },
};
