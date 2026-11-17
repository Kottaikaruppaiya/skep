/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BrcRecord, BrcStatus, BrcUploadMode } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toDateOnlyString, toIsoString } from '../../shared/utils/date.ts';
import { toNumber } from '../../shared/utils/decimal.ts';

export function mapBrc(row: any): BrcRecord {
  return {
    id: row.id,
    shipmentId: row.shipmentId,
    brcNumber: row.brcNumber || undefined,
    issueDate: toDateOnlyString(row.issueDate),
    realisationDate: toDateOnlyString(row.realisationDate),
    realisedAmount: row.realisedAmount !== null && row.realisedAmount !== undefined ? toNumber(row.realisedAmount) : undefined,
    realisedCurrency: row.realisedCurrency || 'USD',
    uploadMode: (row.uploadMode as BrcUploadMode) || 'SINGLE',
    statutoryDeadline: toDateOnlyString(row.statutoryDeadline),
    status: row.status as BrcStatus,
    remarks: row.remarks || undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export const brcRepository = {
  async findByIdOrShipmentId(idOrShipmentId: string, db: DbClient = getPrisma()): Promise<BrcRecord | null> {
    const row = await db.brcRecord.findFirst({
      where: {
        OR: [{ id: idOrShipmentId }, { shipmentId: idOrShipmentId }],
      },
    });
    return row ? mapBrc(row) : null;
  },

  async create(
    data: {
      id?: string;
      shipmentId: string;
      brcNumber?: string | null;
      issueDate?: Date | null;
      realisationDate?: Date | null;
      realisedAmount?: number | null;
      realisedCurrency?: string;
      uploadMode?: BrcUploadMode;
      statutoryDeadline?: Date | null;
      status?: BrcStatus;
      remarks?: string | null;
    },
    db: DbClient = getPrisma()
  ): Promise<BrcRecord> {
    const created = await db.brcRecord.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        shipmentId: data.shipmentId,
        brcNumber: data.brcNumber ?? null,
        issueDate: data.issueDate ?? null,
        realisationDate: data.realisationDate ?? null,
        realisedAmount: data.realisedAmount ?? null,
        realisedCurrency: data.realisedCurrency || 'USD',
        uploadMode: data.uploadMode || 'SINGLE',
        statutoryDeadline: data.statutoryDeadline ?? null,
        status: data.status || 'PENDING',
        remarks: data.remarks ?? null,
      },
    });
    return mapBrc(created);
  },

  async update(
    id: string,
    data: Partial<{
      brcNumber: string | null;
      issueDate: Date | null;
      realisationDate: Date | null;
      realisedAmount: number | null;
      realisedCurrency: string | null;
      uploadMode: BrcUploadMode;
      statutoryDeadline: Date | null;
      status: BrcStatus;
      remarks: string | null;
    }>,
    db: DbClient = getPrisma()
  ): Promise<BrcRecord> {
    const updated = await db.brcRecord.update({ where: { id }, data });
    return mapBrc(updated);
  },
};
