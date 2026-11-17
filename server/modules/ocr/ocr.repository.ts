/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OcrJob as PrismaOcrJob } from '@prisma/client';
import type { DocumentCategory, OcrJob, OcrJobStatus } from '../../../src/types/index.ts';
import { getPrisma, withTransaction, type DbClient } from '../../config/prisma.ts';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error.ts';

function mapOcrJob(row: PrismaOcrJob): OcrJob {
  return {
    id: row.id,
    documentId: row.documentId ?? undefined,
    originalFilename: row.originalFilename,
    fileSizeBytes: Number(row.fileSizeBytes),
    category: row.category as DocumentCategory,
    financialYearId: row.financialYearId,
    status: row.status as OcrJobStatus,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lockedByWorkerId: row.lockedByWorkerId ?? undefined,
    lockedAt: row.lockedAt ? row.lockedAt.toISOString() : undefined,
    leaseExpiresAt: row.leaseExpiresAt ? row.leaseExpiresAt.toISOString() : undefined,
    executionTimeMs: row.executionTimeMs ?? undefined,
    ocrApplied: row.ocrApplied,
    ocrConfidence: row.ocrConfidence ?? undefined,
    ocrTextPreview: row.ocrTextPreview ?? undefined,
    extractionMethod: (row.extractionMethod as 'PDF_TEXT' | 'LOCAL_OCR' | undefined) ?? undefined,
    candidateFields: (row.candidateFields as any) ?? undefined,
    candidateDraft: (row.candidateDraft as any) ?? undefined,
    error: row.error ?? undefined,
    targetShipmentId: row.targetShipmentId ?? undefined,
    targetPaymentId: row.targetPaymentId ?? undefined,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
    approvedByUserId: row.approvedByUserId ?? undefined,
    approvedByName: row.approvedByName ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const ocrRepository = {
  async findAll(filters?: { status?: string; category?: string }, db: DbClient = getPrisma()): Promise<OcrJob[]> {
    const where: Record<string, any> = {};
    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.category && filters.category !== 'ALL') {
      where.category = filters.category;
    }

    const rows = await db.ocrJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapOcrJob);
  },

  async findById(id: string, db: DbClient = getPrisma()): Promise<OcrJob | null> {
    const row = await db.ocrJob.findUnique({ where: { id } });
    return row ? mapOcrJob(row) : null;
  },

  async findByIdForUpdate(tx: DbClient, id: string): Promise<OcrJob | null> {
    await tx.$queryRaw`SELECT id FROM "OcrJob" WHERE id = ${id} FOR UPDATE`;
    const row = await tx.ocrJob.findUnique({ where: { id } });
    return row ? mapOcrJob(row) : null;
  },

  async create(
    data: {
      id?: string;
      documentId?: string;
      originalFilename: string;
      fileSizeBytes: number;
      category: DocumentCategory;
      financialYearId: string;
      maxAttempts?: number;
    },
    db: DbClient = getPrisma()
  ): Promise<OcrJob> {
    const created = await db.ocrJob.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        documentId: data.documentId || null,
        originalFilename: data.originalFilename,
        fileSizeBytes: BigInt(data.fileSizeBytes || 0),
        category: data.category,
        financialYearId: data.financialYearId,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: data.maxAttempts ?? 3,
      },
    });
    return mapOcrJob(created);
  },

  /**
   * Atomically claims the next eligible OCR job using PostgreSQL FOR UPDATE SKIP LOCKED.
   * Reclaims expired leases when attempts < maxAttempts.
   */
  async claimNextJob(workerId: string, leaseDurationMs = 60000): Promise<OcrJob | null> {
    return withTransaction(async (tx) => {
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

      const claimedIds = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "OcrJob"
        WHERE "attempts" < "maxAttempts"
          AND (
            "status" = 'PENDING'
            OR (
              "status" = 'PROCESSING'
              AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < ${now})
            )
          )
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;

      if (!claimedIds || claimedIds.length === 0) {
        return null;
      }

      const targetId = claimedIds[0].id;
      const updated = await tx.ocrJob.update({
        where: { id: targetId },
        data: {
          status: 'PROCESSING',
          lockedByWorkerId: workerId,
          lockedAt: now,
          leaseExpiresAt,
          attempts: { increment: 1 },
        },
      });

      return mapOcrJob(updated);
    });
  },

  /**
   * Extends the active worker lease only if this worker currently holds it and it hasn't expired.
   */
  async renewLease(jobId: string, workerId: string, additionalMs = 60000, db: DbClient = getPrisma()): Promise<boolean> {
    const now = new Date();
    const newExpiry = new Date(now.getTime() + additionalMs);

    const res = await db.ocrJob.updateMany({
      where: {
        id: jobId,
        status: 'PROCESSING',
        lockedByWorkerId: workerId,
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { gte: now } }],
      },
      data: {
        leaseExpiresAt: newExpiry,
      },
    });

    return res.count === 1;
  },

  /**
   * Atomically marks a job COMPLETED only if this worker still holds a valid lease.
   */
  async completeJob(
    jobId: string,
    workerId: string,
    result: {
      executionTimeMs: number;
      ocrApplied?: boolean;
      ocrConfidence?: number;
      ocrTextPreview?: string;
      extractionMethod?: 'PDF_TEXT' | 'LOCAL_OCR';
      candidateFields?: any;
      candidateDraft?: any;
    }
  ): Promise<OcrJob> {
    return withTransaction(async (tx) => {
      const existing = await this.findByIdForUpdate(tx, jobId);
      if (!existing) throw new NotFoundError('OCR job not found.');

      if (existing.lockedByWorkerId && existing.lockedByWorkerId !== workerId) {
        throw new ConflictError(
          `Lease violation: OCR job ${jobId} was reclaimed by worker ${existing.lockedByWorkerId}; commit rejected.`
        );
      }

      if (existing.leaseExpiresAt && new Date(existing.leaseExpiresAt).getTime() < Date.now()) {
        throw new ConflictError(
          `Lease expired: OCR job ${jobId} lease expired at ${existing.leaseExpiresAt}; commit rejected.`
        );
      }

      if (existing.status !== 'PROCESSING') {
        throw new ConflictError(`OCR job ${jobId} is in state ${existing.status}; commit rejected.`);
      }

      const updated = await tx.ocrJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          lockedByWorkerId: null,
          leaseExpiresAt: null,
          executionTimeMs: result.executionTimeMs,
          ocrApplied: Boolean(result.ocrApplied),
          ocrConfidence: result.ocrConfidence ?? null,
          ocrTextPreview: result.ocrTextPreview ?? null,
          extractionMethod: result.extractionMethod ?? null,
          candidateFields: result.candidateFields ?? null,
          candidateDraft: result.candidateDraft ?? null,
          error: null,
        },
      });

      return mapOcrJob(updated);
    });
  },

  async failJob(jobId: string, workerId: string, errorMsg: string, executionTimeMs?: number): Promise<OcrJob> {
    return withTransaction(async (tx) => {
      const existing = await this.findByIdForUpdate(tx, jobId);
      if (!existing) throw new NotFoundError('OCR job not found.');

      if (existing.lockedByWorkerId && existing.lockedByWorkerId !== workerId) {
        return existing;
      }

      const maxAttempts = existing.maxAttempts || 3;
      const isFinalFailure = (existing.attempts || 0) >= maxAttempts;

      const updated = await tx.ocrJob.update({
        where: { id: jobId },
        data: {
          status: isFinalFailure ? 'FAILED' : 'PENDING',
          lockedByWorkerId: null,
          leaseExpiresAt: null,
          error: errorMsg,
          ...(executionTimeMs !== undefined ? { executionTimeMs } : {}),
        },
      });

      return mapOcrJob(updated);
    });
  },

  async resetForRetry(id: string, db: DbClient = getPrisma()): Promise<OcrJob> {
    const existing = await this.findById(id, db);
    if (!existing) throw new NotFoundError('OCR job not found.');

    const updated = await db.ocrJob.update({
      where: { id },
      data: {
        status: 'PENDING',
        attempts: 0,
        error: null,
        lockedByWorkerId: null,
        lockedAt: null,
        leaseExpiresAt: null,
      },
    });
    return mapOcrJob(updated);
  },

  async markApproved(
    id: string,
    data: {
      targetShipmentId?: string;
      targetPaymentId?: string;
      approvedByUserId: string;
      approvedByName: string;
    },
    db: DbClient = getPrisma()
  ): Promise<OcrJob> {
    const updated = await db.ocrJob.update({
      where: { id },
      data: {
        targetShipmentId: data.targetShipmentId ?? null,
        targetPaymentId: data.targetPaymentId ?? null,
        approvedAt: new Date(),
        approvedByUserId: data.approvedByUserId,
        approvedByName: data.approvedByName,
      },
    });
    return mapOcrJob(updated);
  },

  async delete(id: string, db: DbClient = getPrisma()): Promise<void> {
    await db.ocrJob.delete({ where: { id } });
  },
};
