/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncentiveRecord, IncentiveStatus, IncentiveType } from '../../../src/types/index.ts';
import type { DbClient } from '../../config/prisma.ts';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { parseDateOptional } from '../../shared/utils/date.ts';
import { round2 } from '../../shared/utils/decimal.ts';
import { deriveIncentiveStatus } from './incentive.calculator.ts';
import { incentivesRepository } from './incentives.repository.ts';

export const incentivesService = {
  async createIncentive(
    data: {
      shipmentId: string;
      type: IncentiveType;
      claimedAmount: number;
      receivedAmount?: number;
      receivedDate?: string;
      scrollNumber?: string;
      remarks?: string;
    },
    db?: DbClient
  ): Promise<IncentiveRecord> {
    const exists = await incentivesRepository.shipmentExists(data.shipmentId, db);
    if (!exists) throw new NotFoundError('Shipment not found.');

    const existingType = await incentivesRepository.findByShipmentAndType(data.shipmentId, data.type, db);
    if (existingType) {
      throw new ConflictError(
        `An incentive claim of type '${data.type}' already exists for this shipment. Update the existing claim instead.`
      );
    }

    const claimedAmount = round2(data.claimedAmount);
    const receivedAmount = round2(data.receivedAmount || 0);
    if (claimedAmount < 0 || receivedAmount < 0) {
      throw new ValidationError('Incentive claimed and received amounts cannot be negative.');
    }
    if (receivedAmount > claimedAmount + 0.001) {
      throw new ValidationError(
        `Received amount (₹${receivedAmount.toFixed(2)}) cannot exceed claimed amount (₹${claimedAmount.toFixed(2)}).`
      );
    }

    const status = deriveIncentiveStatus(claimedAmount, receivedAmount);

    return incentivesRepository.create(
      {
        shipmentId: data.shipmentId,
        type: data.type,
        claimedAmount,
        receivedAmount,
        status,
        receivedDate: parseDateOptional(data.receivedDate),
        scrollNumber: data.scrollNumber?.trim() || null,
        remarks: data.remarks?.trim() || null,
      },
      db
    );
  },

  async upsertIncentiveForShipment(
    shipmentId: string,
    type: IncentiveType,
    updates: { claimedAmount?: number; receivedAmount?: number; receivedDate?: string | null },
    db?: DbClient
  ): Promise<IncentiveRecord | null> {
    const existing = await incentivesRepository.findByShipmentAndType(shipmentId, type, db);
    if (!existing) {
      const claimed = round2(updates.claimedAmount || 0);
      const received = round2(updates.receivedAmount || 0);
      if (claimed === 0 && received === 0 && !updates.receivedDate) {
        return null;
      }
      return this.createIncentive(
        {
          shipmentId,
          type,
          claimedAmount: claimed,
          receivedAmount: received,
          receivedDate: updates.receivedDate || undefined,
        },
        db
      );
    }
    return this.updateIncentive(existing.id, updates, db);
  },

  async updateIncentive(
    id: string,
    updates: {
      claimedAmount?: number;
      receivedAmount?: number;
      receivedDate?: string | null;
      status?: IncentiveStatus;
      scrollNumber?: string | null;
      remarks?: string | null;
    },
    db?: DbClient
  ): Promise<IncentiveRecord> {
    const existing = await incentivesRepository.findById(id, db);
    if (!existing) throw new NotFoundError('Incentive record not found.');

    const claimedAmount = updates.claimedAmount !== undefined ? round2(updates.claimedAmount) : existing.claimedAmount;
    const receivedAmount = updates.receivedAmount !== undefined ? round2(updates.receivedAmount) : existing.receivedAmount;
    if (claimedAmount < 0 || receivedAmount < 0) {
      throw new ValidationError('Incentive claimed and received amounts cannot be negative.');
    }
    if (receivedAmount > claimedAmount + 0.001) {
      throw new ValidationError(
        `Received amount (₹${receivedAmount.toFixed(2)}) cannot exceed claimed amount (₹${claimedAmount.toFixed(2)}).`
      );
    }

    const status = deriveIncentiveStatus(claimedAmount, receivedAmount, updates.status);

    return incentivesRepository.update(
      id,
      {
        claimedAmount,
        receivedAmount,
        status,
        ...(updates.receivedDate !== undefined ? { receivedDate: parseDateOptional(updates.receivedDate) } : {}),
        ...(updates.scrollNumber !== undefined ? { scrollNumber: updates.scrollNumber?.trim() || null } : {}),
        ...(updates.remarks !== undefined ? { remarks: updates.remarks?.trim() || null } : {}),
      },
      db
    );
  },

  async deleteIncentive(id: string): Promise<{ success: boolean }> {
    const item = await incentivesRepository.findById(id);
    if (!item) throw new NotFoundError('Incentive record not found.');

    if (item.receivedAmount > 0) {
      throw new ConflictError(
        `Cannot delete incentive claim (${item.type}): Funds of ₹${item.receivedAmount.toLocaleString()} have already been credited. Deletion of received incentive funds is prohibited. Please adjust amounts or record a correction instead.`
      );
    }

    await incentivesRepository.delete(id);
    return { success: true };
  },
};
