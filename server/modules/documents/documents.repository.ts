/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DocumentCategory, DocumentRecord, ReviewStatus } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toIsoString } from '../../shared/utils/date.ts';

export function mapDocument(row: any): DocumentRecord {
  return {
    id: row.id,
    shipmentId: row.shipmentId || undefined,
    paymentId: row.paymentId || undefined,
    category: row.category as DocumentCategory,
    originalFilename: row.originalFilename,
    storedPath: row.storedPath,
    mimeType: row.mimeType,
    fileSizeBytes: typeof row.fileSizeBytes === 'bigint' ? Number(row.fileSizeBytes) : Number(row.fileSizeBytes || 0),
    version: row.version,
    isCurrent: row.isCurrent,
    reviewStatus: row.reviewStatus as ReviewStatus,
    ocrApplied: row.ocrApplied ?? false,
    ocrConfidence: row.ocrConfidence ?? undefined,
    ocrTextPreview: row.ocrTextPreview ?? undefined,
    extractionMethod: (row.extractionMethod as DocumentRecord['extractionMethod']) || undefined,
    extractedFieldsJson: row.extractedFieldsJson ?? undefined,
    extractedData: (row.extractedData as Record<string, any>) ?? undefined,
    uploadedByUserId: row.uploadedByUserId,
    uploadedByName: row.uploadedByUser?.name || undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export const documentsRepository = {
  async findAll(
    filter?: { shipmentId?: string; paymentId?: string },
    db: DbClient = getPrisma()
  ): Promise<DocumentRecord[]> {
    const rows = await db.document.findMany({
      where: {
        ...(filter?.shipmentId ? { shipmentId: filter.shipmentId } : {}),
        ...(filter?.paymentId ? { paymentId: filter.paymentId } : {}),
      },
      include: { uploadedByUser: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapDocument);
  },

  async findById(id: string, db: DbClient = getPrisma()): Promise<DocumentRecord | null> {
    const row = await db.document.findUnique({
      where: { id },
      include: { uploadedByUser: { select: { name: true } } },
    });
    return row ? mapDocument(row) : null;
  },

  async findCurrentBrcDocsForShipment(shipmentId: string, db: DbClient = getPrisma()): Promise<DocumentRecord[]> {
    const rows = await db.document.findMany({
      where: {
        shipmentId,
        isCurrent: true,
        category: { in: ['BRC_COPY_1', 'BRC_COPY_2'] },
      },
    });
    return rows.map(mapDocument);
  },

  async registerVersioned(
    data: {
      shipmentId?: string;
      paymentId?: string;
      category: DocumentCategory;
      originalFilename: string;
      storedPath: string;
      mimeType: string;
      fileSizeBytes: number;
      reviewStatus?: ReviewStatus;
      ocrApplied?: boolean;
      ocrConfidence?: number;
      ocrTextPreview?: string;
      extractionMethod?: string;
      extractedFieldsJson?: string;
      extractedData?: Record<string, any>;
      uploadedByUserId: string;
    },
    db: DbClient = getPrisma()
  ): Promise<DocumentRecord> {
    let nextVersion = 1;

    if (data.shipmentId || data.paymentId) {
      const existing = await db.document.findMany({
        where: {
          isCurrent: true,
          category: data.category,
          ...(data.shipmentId ? { shipmentId: data.shipmentId } : { paymentId: data.paymentId }),
        },
        select: { id: true, version: true },
      });

      if (existing.length > 0) {
        const maxVersion = existing.reduce((m, d) => Math.max(m, d.version), 0);
        nextVersion = maxVersion + 1;
        await db.document.updateMany({
          where: { id: { in: existing.map((d) => d.id) } },
          data: { isCurrent: false },
        });
      }
    }

    const created = await db.document.create({
      data: {
        shipmentId: data.shipmentId || null,
        paymentId: data.paymentId || null,
        category: data.category,
        originalFilename: data.originalFilename,
        storedPath: data.storedPath,
        mimeType: data.mimeType || 'application/octet-stream',
        fileSizeBytes: BigInt(data.fileSizeBytes || 0),
        version: nextVersion,
        isCurrent: true,
        reviewStatus: data.reviewStatus || 'EXTRACTED',
        ocrApplied: Boolean(data.ocrApplied),
        ocrConfidence: data.ocrConfidence ?? null,
        ocrTextPreview: data.ocrTextPreview ?? null,
        extractionMethod: data.extractionMethod || 'PDF_TEXT',
        extractedFieldsJson: data.extractedFieldsJson ?? null,
        extractedData: data.extractedData ?? undefined,
        uploadedByUserId: data.uploadedByUserId,
      },
      include: { uploadedByUser: { select: { name: true } } },
    });

    return mapDocument(created);
  },

  async updateReviewStatus(id: string, reviewStatus: ReviewStatus, db: DbClient = getPrisma()): Promise<DocumentRecord> {
    const updated = await db.document.update({
      where: { id },
      data: { reviewStatus },
      include: { uploadedByUser: { select: { name: true } } },
    });
    return mapDocument(updated);
  },

  async updateExtractionAndLink(
    id: string,
    updates: Partial<{
      shipmentId: string;
      paymentId: string;
      reviewStatus: ReviewStatus;
      ocrApplied: boolean;
      ocrConfidence: number;
      ocrTextPreview: string;
      extractionMethod: string;
      extractedData: Record<string, any>;
    }>,
    db: DbClient = getPrisma()
  ): Promise<DocumentRecord> {
    const updated = await db.document.update({
      where: { id },
      data: {
        ...(updates.shipmentId !== undefined ? { shipmentId: updates.shipmentId } : {}),
        ...(updates.paymentId !== undefined ? { paymentId: updates.paymentId } : {}),
        ...(updates.reviewStatus !== undefined ? { reviewStatus: updates.reviewStatus } : {}),
        ...(updates.ocrApplied !== undefined ? { ocrApplied: updates.ocrApplied } : {}),
        ...(updates.ocrConfidence !== undefined ? { ocrConfidence: updates.ocrConfidence } : {}),
        ...(updates.ocrTextPreview !== undefined ? { ocrTextPreview: updates.ocrTextPreview } : {}),
        ...(updates.extractionMethod !== undefined ? { extractionMethod: updates.extractionMethod } : {}),
        ...(updates.extractedData !== undefined ? { extractedData: updates.extractedData } : {}),
      },
      include: { uploadedByUser: { select: { name: true } } },
    });
    return mapDocument(updated);
  },

  async findLatestPriorVersion(
    filter: {
      excludeId: string;
      shipmentId?: string;
      paymentId?: string;
      category: DocumentCategory;
    },
    db: DbClient = getPrisma()
  ): Promise<DocumentRecord | null> {
    if (!filter.shipmentId && !filter.paymentId) return null;
    const row = await db.document.findFirst({
      where: {
        id: { not: filter.excludeId },
        category: filter.category,
        ...(filter.shipmentId ? { shipmentId: filter.shipmentId } : { paymentId: filter.paymentId }),
      },
      include: { uploadedByUser: { select: { name: true } } },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
    return row ? mapDocument(row) : null;
  },

  async markAsCurrent(id: string, db: DbClient = getPrisma()): Promise<DocumentRecord> {
    const updated = await db.document.update({
      where: { id },
      data: { isCurrent: true },
      include: { uploadedByUser: { select: { name: true } } },
    });
    return mapDocument(updated);
  },

  async delete(id: string, db: DbClient = getPrisma()): Promise<void> {
    await db.document.delete({ where: { id } });
  },
};
