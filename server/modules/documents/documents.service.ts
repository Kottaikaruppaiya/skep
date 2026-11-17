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
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { getCurrentIndianFinancialYearLabel } from '../../shared/utils/gstr-period.ts';
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
    let resolvedFyLabel = input.financialYear;

    if (input.shipmentId) {
      const shipment = await prisma.shipment.findUnique({
        where: { id: input.shipmentId },
        include: { brcRecord: true, financialYear: true },
      });
      if (!shipment) {
        throw new NotFoundError('Target shipment not found.');
      }
      if (!input.invoiceKey) {
        resolvedKey = shipment.normalizedInvoiceKey;
      }
      if (!resolvedFyLabel && shipment.financialYear?.label) {
        resolvedFyLabel = shipment.financialYear.label;
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

    if (input.paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
      if (!payment) {
        throw new NotFoundError('Target payment not found.');
      }
      if (!input.invoiceKey) {
        resolvedKey = payment.irmNumber;
      }
    }

    const { relativePath } = fileStorageService.writeDocumentFile(
      resolvedFyLabel || getCurrentIndianFinancialYearLabel(),
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
    const deletedDoc = await withTransaction(async (tx) => {
      const doc = await documentsRepository.findById(id, tx);
      if (!doc) throw new NotFoundError('Document not found.');

      const priorVersion =
        doc.isCurrent && (doc.shipmentId || doc.paymentId)
          ? await documentsRepository.findLatestPriorVersion(
              {
                excludeId: doc.id,
                shipmentId: doc.shipmentId,
                paymentId: doc.paymentId,
                category: doc.category,
              },
              tx
            )
          : null;

      if (
        doc.isCurrent &&
        doc.shipmentId &&
        (doc.category === 'BRC_COPY_1' || doc.category === 'BRC_COPY_2') &&
        !priorVersion
      ) {
        const brc = await tx.brcRecord.findUnique({ where: { shipmentId: doc.shipmentId } });
        if (brc?.status === 'REALISED') {
          throw new ConflictError(
            `Cannot delete the only current ${doc.category} document while BRC status is REALISED. Upload a replacement version or reset BRC status from REALISED first.`
          );
        }
      }

      await documentsRepository.delete(id, tx);

      if (priorVersion) {
        await documentsRepository.markAsCurrent(priorVersion.id, tx);
      }

      return doc;
    });

    fileStorageService.deletePrivateFile(deletedDoc.storedPath);
    return { success: true };
  },
};
