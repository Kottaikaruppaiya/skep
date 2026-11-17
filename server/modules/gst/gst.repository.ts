/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GstEntry as PrismaGstEntry } from '@prisma/client';
import type { GstEntry, GstResult } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { parseDateRequired, toDateOnlyString } from '../../shared/utils/date.ts';
import { toNumber } from '../../shared/utils/decimal.ts';

function mapGstEntry(row: PrismaGstEntry): GstEntry {
  return {
    id: row.id,
    entryDate: toDateOnlyString(row.entryDate) || '',
    consigneeId: row.consigneeId,
    consigneeName: row.consigneeName,
    igst: toNumber(row.igst),
    cgst: toNumber(row.cgst),
    sgst: toNumber(row.sgst),
    totalGst: toNumber(row.totalGst),
    refundEligible: toNumber(row.refundEligible),
    difference: toNumber(row.difference),
    result: row.result as GstResult,
    remarks: row.remarks ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface GstQueryFilters {
  consigneeId?: string;
  result?: GstResult;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'entryDate' | 'consigneeName' | 'totalGst' | 'refundEligible' | 'difference';
  sortOrder?: 'asc' | 'desc';
}

export const gstRepository = {
  async findAll(filters?: GstQueryFilters, db: DbClient = getPrisma()): Promise<GstEntry[]> {
    const where: Record<string, any> = {};

    if (filters?.consigneeId && filters.consigneeId !== 'ALL') {
      where.consigneeId = filters.consigneeId;
    }

    if (filters?.result && filters.result !== ('ALL' as any)) {
      where.result = filters.result;
    }

    if (filters?.startDate || filters?.endDate) {
      where.entryDate = {};
      if (filters.startDate) where.entryDate.gte = parseDateRequired(filters.startDate, 'startDate');
      if (filters.endDate) where.entryDate.lte = parseDateRequired(filters.endDate, 'endDate');
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { consigneeName: { contains: q, mode: 'insensitive' } },
        { remarks: { contains: q, mode: 'insensitive' } },
      ];
    }

    const sortBy = filters?.sortBy || 'entryDate';
    const sortOrder = filters?.sortOrder || 'desc';

    const rows = await db.gstEntry.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    });

    return rows.map(mapGstEntry);
  },

  async findById(id: string, db: DbClient = getPrisma()): Promise<GstEntry | null> {
    const row = await db.gstEntry.findUnique({ where: { id } });
    return row ? mapGstEntry(row) : null;
  },

  async generateNextReadableId(year: number, db: DbClient = getPrisma()): Promise<string> {
    const prefix = `GST-${year}-`;
    const existing = await db.gstEntry.findMany({
      where: { id: { startsWith: prefix } },
      select: { id: true },
    });

    let maxSeq = 0;
    for (const row of existing) {
      const suffix = parseInt(row.id.slice(prefix.length), 10);
      if (!isNaN(suffix) && suffix > maxSeq) {
        maxSeq = suffix;
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  },

  async create(
    data: {
      id: string;
      entryDate: Date;
      consigneeId: string;
      consigneeName: string;
      igst: number;
      cgst: number;
      sgst: number;
      totalGst: number;
      refundEligible: number;
      difference: number;
      result: GstResult;
      remarks?: string;
    },
    db: DbClient = getPrisma()
  ): Promise<GstEntry> {
    const created = await db.gstEntry.create({
      data: {
        id: data.id,
        entryDate: data.entryDate,
        consigneeId: data.consigneeId,
        consigneeName: data.consigneeName,
        igst: data.igst,
        cgst: data.cgst,
        sgst: data.sgst,
        totalGst: data.totalGst,
        refundEligible: data.refundEligible,
        difference: data.difference,
        result: data.result,
        remarks: data.remarks || null,
      },
    });
    return mapGstEntry(created);
  },

  async update(id: string, data: Record<string, any>, db: DbClient = getPrisma()): Promise<GstEntry> {
    const updated = await db.gstEntry.update({
      where: { id },
      data,
    });
    return mapGstEntry(updated);
  },

  async delete(id: string, db: DbClient = getPrisma()): Promise<boolean> {
    const existing = await db.gstEntry.findUnique({ where: { id } });
    if (!existing) return false;
    await db.gstEntry.delete({ where: { id } });
    return true;
  },
};
