/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BrcRecord, BrcStatus, BrcUploadMode } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { parseDateOptional } from '../../shared/utils/date.ts';
import { round2 } from '../../shared/utils/decimal.ts';
import { documentsRepository } from '../documents/documents.repository.ts';
import { calculateStatutoryDeadline, deriveBrcStatus } from './brc.calculator.ts';
import { brcRepository } from './brc.repository.ts';

export const brcService = {
  async createDefaultForShipment(
    shipmentId: string,
    shippingBillDate: string,
    statutoryDays = 270,
    options?: { uploadMode?: BrcUploadMode; statutoryDeadline?: string; remarks?: string },
    db?: DbClient
  ): Promise<BrcRecord> {
    const deadlineStr = options?.statutoryDeadline || calculateStatutoryDeadline(shippingBillDate, statutoryDays);
    return brcRepository.create(
      {
        shipmentId,
        uploadMode: options?.uploadMode || 'SINGLE',
        statutoryDeadline: parseDateOptional(deadlineStr),
        status: 'PENDING',
        remarks: options?.remarks?.trim() || null,
      },
      db
    );
  },

  async updateBrcRecord(
    idOrShipmentId: string,
    updates: {
      brcNumber?: string | null;
      issueDate?: string | null;
      realisationDate?: string | null;
      realisedAmount?: number | null;
      realisedCurrency?: string;
      uploadMode?: BrcUploadMode;
      statutoryDeadline?: string | null;
      status?: BrcStatus;
      remarks?: string | null;
    },
    db: DbClient = getPrisma()
  ): Promise<BrcRecord> {
    let existing = await brcRepository.findByIdOrShipmentId(idOrShipmentId, db);
    if (!existing) {
      const shipment = await db.shipment.findUnique({ where: { id: idOrShipmentId } });
      if (!shipment) {
        throw new NotFoundError('Shipment or BRC record not found.');
      }
      existing = await brcRepository.create(
        {
          shipmentId: shipment.id,
          uploadMode: updates.uploadMode || 'SINGLE',
          status: 'PENDING',
        },
        db
      );
    }

    const nextDeadline =
      updates.statutoryDeadline !== undefined
        ? updates.statutoryDeadline || undefined
        : existing.statutoryDeadline;
    const baseStatus = updates.status !== undefined ? updates.status : existing.status;
    const finalStatus = deriveBrcStatus(baseStatus, nextDeadline);
    const targetMode: BrcUploadMode = updates.uploadMode ?? existing.uploadMode;

    const currentBrcDocs = await documentsRepository.findCurrentBrcDocsForShipment(existing.shipmentId, db);
    const hasCopy1 = currentBrcDocs.some((d) => d.category === 'BRC_COPY_1');
    const hasCopy2 = currentBrcDocs.some((d) => d.category === 'BRC_COPY_2');

    if (targetMode === 'SINGLE') {
      if (hasCopy2 || currentBrcDocs.length > 1) {
        throw new ValidationError(
          'SINGLE BRC mode permits exactly one BRC document (BRC Copy 1). Remove BRC Copy 2 before switching to SINGLE mode.'
        );
      }
      if (finalStatus === 'REALISED' && (!hasCopy1 || currentBrcDocs.length !== 1)) {
        throw new ValidationError(
          'Cannot mark BRC as REALISED in SINGLE mode: exactly 1 current BRC document (BRC Copy 1) must be attached.'
        );
      }
    } else if (targetMode === 'MULTIPLE') {
      if (finalStatus === 'REALISED' && (!hasCopy1 || !hasCopy2 || currentBrcDocs.length !== 2)) {
        throw new ValidationError(
          'Cannot mark BRC as REALISED in MULTIPLE mode: exactly 2 current BRC documents (BRC Copy 1 and BRC Copy 2) must be attached.'
        );
      }
    }

    return brcRepository.update(
      existing.id,
      {
        ...(updates.brcNumber !== undefined ? { brcNumber: updates.brcNumber?.trim() || null } : {}),
        ...(updates.issueDate !== undefined ? { issueDate: parseDateOptional(updates.issueDate) } : {}),
        ...(updates.realisationDate !== undefined ? { realisationDate: parseDateOptional(updates.realisationDate) } : {}),
        ...(updates.realisedAmount !== undefined
          ? { realisedAmount: updates.realisedAmount !== null ? round2(updates.realisedAmount) : null }
          : {}),
        ...(updates.realisedCurrency !== undefined ? { realisedCurrency: updates.realisedCurrency || 'USD' } : {}),
        ...(updates.uploadMode !== undefined ? { uploadMode: updates.uploadMode } : {}),
        ...(updates.statutoryDeadline !== undefined ? { statutoryDeadline: parseDateOptional(updates.statutoryDeadline) } : {}),
        ...(updates.remarks !== undefined ? { remarks: updates.remarks?.trim() || null } : {}),
        status: finalStatus,
      },
      db
    );
  },

  async resetBrcRecord(idOrShipmentId: string, db?: DbClient): Promise<BrcRecord> {
    const existing = await brcRepository.findByIdOrShipmentId(idOrShipmentId, db);
    if (!existing) throw new NotFoundError('BRC record not found.');

    return brcRepository.update(
      existing.id,
      {
        brcNumber: null,
        issueDate: null,
        realisationDate: null,
        realisedAmount: null,
        status: 'PENDING',
        remarks: null,
      },
      db
    );
  },
};
