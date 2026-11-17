/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DocumentCategory,
  DocumentExtractionResult,
  DocumentRecord,
  MergedShipmentDraft,
  ReviewStatus,
} from '../../../src/types/index.ts';
import { getPrisma, withTransaction, type DbClient } from '../../config/prisma.ts';
import { extractDocumentData, mergeExtractedDocuments } from '../ocr/ocr.extractor.ts';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { documentsRepository } from './documents.repository.ts';
import { fileStorageService } from './file-storage.service.ts';

export const documentsService = {
  async listDocuments(filter?: { shipmentId?: string; paymentId?: string }, db?: DbClient): Promise<DocumentRecord[]> {
    return documentsRepository.findAll(filter, db);
  },

  async getDocumentById(id: string, db?: DbClient): Promise<DocumentRecord | null> {
    return documentsRepository.findById(id, db);
  },

  async registerDocument(
    data: Parameters<typeof documentsRepository.registerVersioned>[0],
    db?: DbClient
  ): Promise<DocumentRecord> {
    return documentsRepository.registerVersioned(data, db);
  },

  async extractBatch(
    files: { file?: Express.Multer.File; category: DocumentCategory; key: string }[]
  ): Promise<{ extractions: Record<string, DocumentExtractionResult>; mergedDraft: MergedShipmentDraft }> {
    const extractions: Record<string, DocumentExtractionResult> = {};
    const results: DocumentExtractionResult[] = [];

    for (const spec of files) {
      if (!spec.file) continue;
      const ext = await extractDocumentData(spec.file.buffer, spec.category, spec.file.originalname);
      extractions[spec.key] = ext;
      results.push(ext);
    }

    const mergedDraft = mergeExtractedDocuments(results);
    return { extractions, mergedDraft };
  },

  async uploadDocument(
    file: Express.Multer.File,
    input: {
      category: DocumentCategory;
      shipmentId?: string;
      paymentId?: string;
      financialYear?: string;
      invoiceKey?: string;
    },
    actorUserId: string
  ): Promise<{ document: DocumentRecord; extraction: DocumentExtractionResult | null }> {
    const prisma = getPrisma();
    let resolvedKey = input.invoiceKey || 'GENERAL';

    if (input.shipmentId) {
      const shipment = await prisma.shipment.findUnique({
        where: { id: input.shipmentId },
        include: { brcRecord: true },
      });
      if (!shipment) {
        throw new NotFoundError('Target shipment not found.');
      }
      if (!input.invoiceKey) {
        resolvedKey = shipment.normalizedInvoiceKey;
      }

      if (
        (input.category === 'BRC_COPY_1' || input.category === 'BRC_COPY_2') &&
        shipment.brcRecord?.uploadMode === 'SINGLE' &&
        input.category === 'BRC_COPY_2'
      ) {
        throw new ValidationError(
          'Single BRC Mode is active for this shipment. Exactly one BRC copy is permitted. Switch to Multiple mode to attach Copy 2.'
        );
      }
    }

    const { relativePath } = fileStorageService.writeDocumentFile(
      input.financialYear || '2026-27',
      resolvedKey,
      input.category,
      file.originalname,
      file.buffer
    );

    let extraction: DocumentExtractionResult | null = null;
    try {
      extraction = await extractDocumentData(file.buffer, input.category, file.originalname);
    } catch (err) {
      console.warn('[DocumentsService] Extraction error:', err);
    }

    try {
      const docRecord = await withTransaction((tx) =>
        documentsRepository.registerVersioned(
          {
            shipmentId: input.shipmentId,
            paymentId: input.paymentId,
            category: input.category,
            originalFilename: file.originalname,
            storedPath: relativePath,
            mimeType: file.mimetype,
            fileSizeBytes: file.size,
            extractedData: extraction || undefined,
            reviewStatus: extraction?.reviewStatus || 'EXTRACTED',
            ocrApplied: extraction?.ocrApplied,
            ocrConfidence: extraction?.ocrConfidence,
            ocrTextPreview: extraction?.ocrTextPreview,
            extractionMethod: extraction?.extractionMethod || 'PDF_TEXT',
            uploadedByUserId: actorUserId,
          },
          tx
        )
      );

      return { document: docRecord, extraction };
    } catch (err) {
      fileStorageService.deletePrivateFile(relativePath);
      throw err;
    }
  },

  async getDownloadStream(id: string) {
    const doc = await documentsRepository.findById(id);
    if (!doc) {
      throw new NotFoundError('Document not found.');
    }
    const stream = fileStorageService.readDocumentStream(doc.storedPath);
    return { doc, stream };
  },

  async updateReviewStatus(id: string, reviewStatus: ReviewStatus): Promise<DocumentRecord> {
    const existing = await documentsRepository.findById(id);
    if (!existing) throw new NotFoundError('Document not found.');
    return documentsRepository.updateReviewStatus(id, reviewStatus);
  },

  async linkAndConfirmDocument(
    id: string,
    updates: { shipmentId?: string; paymentId?: string; reviewStatus?: ReviewStatus },
    db?: DbClient
  ): Promise<DocumentRecord> {
    return documentsRepository.updateExtractionAndLink(id, updates, db);
  },

  async deleteDocument(id: string): Promise<{ success: boolean }> {
    const doc = await documentsRepository.findById(id);
    if (!doc) throw new NotFoundError('Document not found.');
    await documentsRepository.delete(id);
    fileStorageService.deletePrivateFile(doc.storedPath);
    return { success: true };
  },
};
