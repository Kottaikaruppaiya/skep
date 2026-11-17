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
    const resolvedFyId = input.financialYearId?.trim() || (await mastersService.getCurrentFinancialYear()).id;
    const job = await ocrRepository.create({
      documentId: input.documentId,
      originalFilename: input.originalFilename,
      fileSizeBytes: input.fileSizeBytes,
      category: input.category,
      financialYearId: resolvedFyId,
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

        const fyId = job.financialYearId || (await mastersService.getCurrentFinancialYear(tx)).id;
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
          const invoiceValueUsd = Number(reviewedValues.invoiceValueUsd || 0);
          if (!Number.isFinite(invoiceValueUsd) || invoiceValueUsd <= 0) {
            throw new ValidationError('Invoice Value (USD) must be greater than zero to create a shipment from OCR approval.');
          }
          const sbExchangeRate = Number(reviewedValues.sbExchangeRate || 0);
          if (!Number.isFinite(sbExchangeRate) || sbExchangeRate <= 0) {
            throw new ValidationError('Customs Exchange Rate must be greater than zero to create a shipment from OCR approval.');
          }

          let linkedFircPaymentId = reviewedValues.initialFircPaymentId
            ? String(reviewedValues.initialFircPaymentId).trim()
            : '';

          if (!linkedFircPaymentId) {
            const irmRef = String(reviewedValues.fircIrmNumber || reviewedValues.irmNumber || '').trim().toUpperCase();
            if (!irmRef) {
              throw new ValidationError(
                'Mandatory Rule Violation: Creating a new shipment via OCR approval requires linking an existing FIRC payment (initialFircPaymentId) or providing a valid FIRC IRM Number, positive remittance amount, and AD Bank.'
              );
            }

            let payment = await paymentsService.findByIrmNumber(irmRef, tx);
            if (!payment) {
              const fircAmt = Number(reviewedValues.fircAmountUsd || reviewedValues.verifiedAmount || 0);
              if (!Number.isFinite(fircAmt) || fircAmt <= 0) {
                throw new ValidationError('FIRC Verified Remittance Amount (USD) must be greater than zero.');
              }
              const resolvedBankId = await mastersService.resolveBankId(
                reviewedValues.fircBankId || reviewedValues.bankId,
                reviewedValues.fircBankName || reviewedValues.bankName,
                tx
              );
              const rawRate = reviewedValues.fircExchangeRate ?? reviewedValues.exchangeRate;
              const fircRate = rawRate !== undefined && rawRate !== null && rawRate !== '' && Number(rawRate) > 0
                ? Number(rawRate)
                : undefined;
              const rawInr = reviewedValues.fircInrAmount ?? reviewedValues.inrAmount;
              const fircInr = rawInr !== undefined && rawInr !== null && rawInr !== '' && Number(rawInr) > 0
                ? Number(rawInr)
                : fircRate
                  ? Math.round(fircAmt * fircRate * 100) / 100
                  : undefined;

              payment = await paymentsService.createPayment(
                {
                  irmNumber: irmRef,
                  senderReference: reviewedValues.fircSenderRef || undefined,
                  currency: 'USD',
                  verifiedAmount: fircAmt,
                  exchangeRate: fircRate,
                  inrAmount: fircInr,
                  valueDate: reviewedValues.fircValueDate || reviewedValues.invoiceDate || new Date().toISOString().split('T')[0],
                  creditDate: reviewedValues.fircCreditDate || reviewedValues.invoiceDate || new Date().toISOString().split('T')[0],
                  bankId: resolvedBankId,
                  purposeCode: 'P0103',
                  remarks: `Created during OCR approval for ${invoiceNumber}`,
                },
                tx
              );
            }
            linkedFircPaymentId = payment.id;
            targetPayment = payment;
          }

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
              invoiceValueUsd,
              shippingBillNumber: reviewedValues.shippingBillNumber || 'PENDING',
              shippingBillDate: reviewedValues.shippingBillDate || new Date().toISOString().split('T')[0],
              sbExchangeRate,
              fobValueInr: Number(reviewedValues.fobValueInr || 0),
              blNumber: reviewedValues.blNumber,
              blDate: reviewedValues.blDate,
              vesselName: reviewedValues.vesselName,
              remarks: reviewedValues.remarks,
              reviewStatus: 'CONFIRMED',
              initialFircPaymentId: linkedFircPaymentId,
              initialFircAllocationAmount: reviewedValues.initialFircAllocationAmount
                ? Number(reviewedValues.initialFircAllocationAmount)
                : undefined,
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
                reviewedValues.exchangeRate !== undefined && reviewedValues.exchangeRate !== ''
                  ? (reviewedValues.exchangeRate === null ? undefined : Number(reviewedValues.exchangeRate))
                  : existingPayment.exchangeRate,
              inrAmount:
                reviewedValues.inrAmount !== undefined && reviewedValues.inrAmount !== ''
                  ? (reviewedValues.inrAmount === null ? undefined : Number(reviewedValues.inrAmount))
                  : existingPayment.inrAmount,
              valueDate: reviewedValues.valueDate || existingPayment.valueDate,
              creditDate: reviewedValues.creditDate || existingPayment.creditDate,
            },
            tx
          );
        } else {
          const verifiedAmount = Number(reviewedValues.verifiedAmount || 0);
          if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0) {
            throw new ValidationError('Verified Remittance Amount (USD) must be greater than zero.');
          }
          const resolvedBankId = await mastersService.resolveBankId(
            reviewedValues.bankId,
            reviewedValues.bankName,
            tx
          );
          const rawRate = reviewedValues.exchangeRate;
          const exchangeRate = rawRate !== undefined && rawRate !== null && rawRate !== '' && Number(rawRate) > 0
            ? Number(rawRate)
            : undefined;
          const rawInr = reviewedValues.inrAmount;
          const inrAmount = rawInr !== undefined && rawInr !== null && rawInr !== '' && Number(rawInr) > 0
            ? Number(rawInr)
            : exchangeRate
              ? Math.round(verifiedAmount * exchangeRate * 100) / 100
              : undefined;

          targetPayment = await paymentsService.createPayment(
            {
              irmNumber,
              senderReference: reviewedValues.senderReference,
              currency: reviewedValues.currency || 'USD',
              verifiedAmount,
              exchangeRate,
              inrAmount,
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
