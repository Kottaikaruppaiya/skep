/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GstEntry, GstResult, GstSummary } from '../../../src/types/index.ts';
import { withTransaction } from '../../config/prisma.ts';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { parseDateRequired } from '../../shared/utils/date.ts';
import { mastersRepository } from '../masters/masters.repository.ts';
import { calculateGstSummary, computeGstEntryMetrics } from './gst.calculator.ts';
import { gstRepository, type GstQueryFilters } from './gst.repository.ts';

export const gstService = {
  async listEntries(
    filters?: GstQueryFilters & { page?: number; limit?: number }
  ): Promise<{ entries: GstEntry[]; total: number; summary: GstSummary }> {
    const allFiltered = await gstRepository.findAll(filters);
    const summary = calculateGstSummary(allFiltered);

    const total = allFiltered.length;
    const page = Math.max(1, filters?.page || 1);
    const limit = filters?.limit ? Math.max(1, filters.limit) : total || 50;
    const startIndex = (page - 1) * limit;
    const entries = filters?.limit ? allFiltered.slice(startIndex, startIndex + limit) : allFiltered;

    return { entries, total, summary };
  },

  async getSummary(filters?: { consigneeId?: string; startDate?: string; endDate?: string }): Promise<GstSummary> {
    const entries = await gstRepository.findAll(filters);
    return calculateGstSummary(entries);
  },

  async getEntryById(id: string): Promise<GstEntry | null> {
    return gstRepository.findById(id);
  },

  async createEntry(input: {
    entryDate: string;
    consigneeId: string;
    igst: number;
    cgst: number;
    sgst: number;
    refundEligible: number;
    remarks?: string;
  }): Promise<GstEntry> {
    const entryDate = parseDateRequired(input.entryDate, 'entryDate');
    if (input.igst < 0 || input.cgst < 0 || input.sgst < 0 || input.refundEligible < 0) {
      throw new ValidationError('GST amounts and refund eligible cannot be negative.');
    }

    return withTransaction(async (tx) => {
      const consignee = await mastersRepository.findConsigneeById(input.consigneeId, tx);
      if (!consignee) {
        throw new ValidationError('Selected consignee does not exist in master records.');
      }

      const metrics = computeGstEntryMetrics(input);
      const year = entryDate.getUTCFullYear();
      const readableId = await gstRepository.generateNextReadableId(year, tx);

      return gstRepository.create(
        {
          id: readableId,
          entryDate,
          consigneeId: consignee.id,
          consigneeName: consignee.name,
          igst: metrics.igst,
          cgst: metrics.cgst,
          sgst: metrics.sgst,
          totalGst: metrics.totalGst,
          refundEligible: metrics.refundEligible,
          difference: metrics.difference,
          result: metrics.result,
          remarks: input.remarks?.trim() || undefined,
        },
        tx
      );
    });
  },

  async updateEntry(
    id: string,
    updates: Partial<{
      entryDate: string;
      consigneeId: string;
      igst: number;
      cgst: number;
      sgst: number;
      refundEligible: number;
      remarks?: string;
    }>
  ): Promise<GstEntry> {
    return withTransaction(async (tx) => {
      const existing = await gstRepository.findById(id, tx);
      if (!existing) throw new NotFoundError('GST entry not found.');

      const patch: Record<string, any> = {};

      if (updates.entryDate !== undefined) {
        patch.entryDate = parseDateRequired(updates.entryDate, 'entryDate');
      }

      if (updates.consigneeId !== undefined) {
        const consignee = await mastersRepository.findConsigneeById(updates.consigneeId, tx);
        if (!consignee) {
          throw new ValidationError('Selected consignee does not exist in master records.');
        }
        patch.consigneeId = consignee.id;
        patch.consigneeName = consignee.name;
      }

      const nextIgst = updates.igst !== undefined ? Number(updates.igst) : existing.igst;
      const nextCgst = updates.cgst !== undefined ? Number(updates.cgst) : existing.cgst;
      const nextSgst = updates.sgst !== undefined ? Number(updates.sgst) : existing.sgst;
      const nextRefund =
        updates.refundEligible !== undefined ? Number(updates.refundEligible) : existing.refundEligible;

      if (nextIgst < 0 || nextCgst < 0 || nextSgst < 0 || nextRefund < 0) {
        throw new ValidationError('GST amounts and refund eligible cannot be negative.');
      }

      const metrics = computeGstEntryMetrics({
        igst: nextIgst,
        cgst: nextCgst,
        sgst: nextSgst,
        refundEligible: nextRefund,
      });

      patch.igst = metrics.igst;
      patch.cgst = metrics.cgst;
      patch.sgst = metrics.sgst;
      patch.totalGst = metrics.totalGst;
      patch.refundEligible = metrics.refundEligible;
      patch.difference = metrics.difference;
      patch.result = metrics.result as GstResult;

      if (updates.remarks !== undefined) {
        patch.remarks = updates.remarks.trim() || null;
      }

      return gstRepository.update(id, patch, tx);
    });
  },

  async deleteEntry(id: string): Promise<boolean> {
    return gstRepository.delete(id);
  },
};
