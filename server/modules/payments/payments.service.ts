/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Payment } from '../../../src/types/index.ts';
import type { DbClient } from '../../config/prisma.ts';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { parseDateOptional, parseDateRequired } from '../../shared/utils/date.ts';
import { round2 } from '../../shared/utils/decimal.ts';
import { paymentsRepository } from './payments.repository.ts';

export const paymentsService = {
  async listPayments(db?: DbClient): Promise<Payment[]> {
    return paymentsRepository.findAll(db);
  },

  async getPaymentById(id: string, db?: DbClient): Promise<Payment | null> {
    return paymentsRepository.findById(id, db);
  },

  async findByIrmNumber(irmNumber: string, db?: DbClient): Promise<Payment | null> {
    return paymentsRepository.findByIrmNumber(irmNumber, db);
  },

  async createPayment(
    data: {
      irmNumber: string;
      senderReference?: string;
      currency?: string;
      verifiedAmount: number;
      inrAmount?: number;
      exchangeRate?: number;
      valueDate: string;
      creditDate: string;
      fircIssueDate?: string;
      bankId: string;
      purposeCode?: string;
      remarks?: string;
    },
    db?: DbClient
  ): Promise<Payment> {
    const cleanIrm = data.irmNumber.trim().toUpperCase();
    const existing = await paymentsRepository.findByIrmNumber(cleanIrm, db);
    if (existing) {
      throw new ConflictError(`Inward Remittance / IRM '${cleanIrm}' already exists in payments register.`);
    }

    const verifiedAmount = round2(data.verifiedAmount);
    if (verifiedAmount <= 0) {
      throw new ValidationError('Payment verified amount must be greater than zero.');
    }

    return paymentsRepository.create(
      {
        irmNumber: cleanIrm,
        senderReference: data.senderReference,
        currency: data.currency || 'USD',
        verifiedAmount,
        inrAmount: data.inrAmount !== undefined ? round2(data.inrAmount) : null,
        exchangeRate: data.exchangeRate !== undefined ? Number(data.exchangeRate) : null,
        valueDate: parseDateRequired(data.valueDate, 'valueDate'),
        creditDate: parseDateRequired(data.creditDate, 'creditDate'),
        fircIssueDate: parseDateOptional(data.fircIssueDate),
        bankId: data.bankId,
        purposeCode: data.purposeCode || 'P0102',
        remarks: data.remarks,
      },
      db
    );
  },

  async updatePayment(id: string, updates: Partial<Payment>, db?: DbClient): Promise<Payment> {
    const existing = await paymentsRepository.findById(id, db);
    if (!existing) throw new NotFoundError('Payment not found.');

    const patch: Record<string, any> = {};

    if (updates.irmNumber && updates.irmNumber.trim().toUpperCase() !== existing.irmNumber.toUpperCase()) {
      const cleanIrm = updates.irmNumber.trim().toUpperCase();
      const dup = await paymentsRepository.findByIrmNumber(cleanIrm, db);
      if (dup && dup.id !== id) {
        throw new ConflictError(`Inward Remittance / IRM '${cleanIrm}' already exists.`);
      }
      patch.irmNumber = cleanIrm;
    }

    if (updates.senderReference !== undefined) patch.senderReference = updates.senderReference?.trim() || null;
    if (updates.verifiedAmount !== undefined) {
      const newAmt = round2(updates.verifiedAmount);
      if (newAmt <= 0) throw new ValidationError('Payment verified amount must be greater than zero.');
      const totalAllocated = existing.totalAllocatedUsd || 0;
      if (newAmt < totalAllocated - 0.001) {
        throw new ConflictError(
          `Cannot reduce payment verified amount ($${newAmt.toFixed(2)}) below active allocations ($${totalAllocated.toFixed(2)} across ${existing.allocations?.length || 0} invoice(s)). Please reverse excess allocations first.`
        );
      }
      patch.verifiedAmount = newAmt;
    }
    if (updates.exchangeRate !== undefined) patch.exchangeRate = Number(updates.exchangeRate);
    if (updates.inrAmount !== undefined) patch.inrAmount = round2(updates.inrAmount);
    if (updates.valueDate) patch.valueDate = parseDateRequired(updates.valueDate, 'valueDate');
    if (updates.creditDate) patch.creditDate = parseDateRequired(updates.creditDate, 'creditDate');
    if (updates.fircIssueDate !== undefined) patch.fircIssueDate = parseDateOptional(updates.fircIssueDate);
    if (updates.bankId) patch.bankId = updates.bankId;
    if (updates.purposeCode !== undefined) patch.purposeCode = updates.purposeCode || null;
    if (updates.remarks !== undefined) patch.remarks = updates.remarks || null;

    return paymentsRepository.update(id, patch, db);
  },

  async deletePayment(id: string): Promise<{ success: boolean }> {
    const payment = await paymentsRepository.findById(id);
    if (!payment) throw new NotFoundError('Payment not found.');

    const allocs = payment.allocations || [];
    if (allocs.length > 0) {
      const totalAllocated = payment.totalAllocatedUsd || 0;
      throw new ConflictError(
        `Cannot delete FIRC payment "${payment.irmNumber}": It has ${allocs.length} active allocation(s) totaling $${totalAllocated.toFixed(2)} USD. Please reverse all invoice allocations first before deleting this payment.`
      );
    }

    await paymentsRepository.delete(id);
    return { success: true };
  },
};
