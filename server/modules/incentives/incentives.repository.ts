/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncentiveRecord, IncentiveStatus, IncentiveType } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toDateOnlyString, toIsoString } from '../../shared/utils/date.ts';
import { toNumber } from '../../shared/utils/decimal.ts';
import { calculateIncentiveOutstanding } from './incentive.calculator.ts';

export function mapIncentive(row: any): IncentiveRecord {
  const claimedAmount = toNumber(row.claimedAmount);
  const receivedAmount = toNumber(row.receivedAmount);
  return {
    id: row.id,
    shipmentId: row.shipmentId,
    type: row.type as IncentiveType,
    claimedAmount,
    status: row.status as IncentiveStatus,
    receivedAmount,
    receivedDate: toDateOnlyString(row.receivedDate),
    scrollNumber: row.scrollNumber || undefined,
    remarks: row.remarks || undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    outstandingBalance: calculateIncentiveOutstanding(claimedAmount, receivedAmount),
  };
}

export const incentivesRepository = {
  async findById(id: string, db: DbClient = getPrisma()): Promise<IncentiveRecord | null> {
    const row = await db.incentiveRecord.findUnique({ where: { id } });
    return row ? mapIncentive(row) : null;
  },

  async findByShipmentAndType(
    shipmentId: string,
    type: IncentiveType,
    db: DbClient = getPrisma()
  ): Promise<IncentiveRecord | null> {
    const row = await db.incentiveRecord.findFirst({ where: { shipmentId, type } });
    return row ? mapIncentive(row) : null;
  },

  async shipmentExists(shipmentId: string, db: DbClient = getPrisma()): Promise<boolean> {
    const count = await db.shipment.count({ where: { id: shipmentId } });
    return count > 0;
  },

  async create(
    data: {
      id?: string;
      shipmentId: string;
      type: IncentiveType;
      claimedAmount: number;
      receivedAmount: number;
      status: IncentiveStatus;
      receivedDate?: Date | null;
      scrollNumber?: string | null;
      remarks?: string | null;
    },
    db: DbClient = getPrisma()
  ): Promise<IncentiveRecord> {
    const created = await db.incentiveRecord.create({ data });
    return mapIncentive(created);
  },

  async update(
    id: string,
    data: Partial<{
      claimedAmount: number;
      receivedAmount: number;
      status: IncentiveStatus;
      receivedDate: Date | null;
      scrollNumber: string | null;
      remarks: string | null;
    }>,
    db: DbClient = getPrisma()
  ): Promise<IncentiveRecord> {
    const updated = await db.incentiveRecord.update({ where: { id }, data });
    return mapIncentive(updated);
  },

  async delete(id: string, db: DbClient = getPrisma()): Promise<void> {
    await db.incentiveRecord.delete({ where: { id } });
  },
};
