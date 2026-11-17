/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { DocumentCategory } from '../../../src/types/index.ts';
import type { AuthenticatedRequest } from '../../middleware/role.middleware.ts';
import { ValidationError } from '../../shared/errors/app-error.ts';
import { documentsService } from './documents.service.ts';

export const documentsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shipmentId = req.query.shipmentId ? String(req.query.shipmentId) : undefined;
      const paymentId = req.query.paymentId ? String(req.query.paymentId) : undefined;
      const docs = await documentsService.listDocuments(
        shipmentId || paymentId ? { shipmentId, paymentId } : undefined
      );
      res.json(docs);
    } catch (err) {
      next(err);
    }
  },

  async extractBatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      if (!files || Object.keys(files).length === 0) {
        throw new ValidationError('No files provided for extraction.');
      }

      const fileSpecs: { file?: Express.Multer.File; category: DocumentCategory; key: string }[] = [
        { file: files?.invoiceDoc?.[0], category: 'COMMERCIAL_INVOICE', key: 'invoiceDoc' },
        { file: files?.shippingBillDoc?.[0], category: 'SHIPPING_BILL', key: 'shippingBillDoc' },
        { file: files?.blDoc?.[0], category: 'BILL_OF_LADING', key: 'blDoc' },
        { file: files?.brcDoc1?.[0], category: 'BRC_COPY_1', key: 'brcDoc1' },
        { file: files?.brcDoc2?.[0], category: 'BRC_COPY_2', key: 'brcDoc2' },
        { file: files?.fircDoc?.[0], category: 'FIRC_PAYMENT', key: 'fircDoc' },
        { file: files?.additionalDoc?.[0], category: 'ADDITIONAL_DOC', key: 'additionalDoc' },
      ];

      const result = await documentsService.extractBatch(fileSpecs);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async uploadSingle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new ValidationError('No document file uploaded.');
      }

      const result = await documentsService.uploadDocument(
        req.file,
        {
          category: (req.body.category || 'COMMERCIAL_INVOICE') as DocumentCategory,
          shipmentId: req.body.shipmentId || undefined,
          paymentId: req.body.paymentId || undefined,
          financialYear: req.body.financialYear || '2026-27',
          invoiceKey: req.body.invoiceKey || undefined,
        },
        req.user!.id
      );

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async download(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { doc, stream } = await documentsService.getDownloadStream(String(req.params.id));
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalFilename)}"`);
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      stream.on('error', (err) => next(err));
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  },

  async updateReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await documentsService.updateReviewStatus(String(req.params.id), req.body.reviewStatus);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await documentsService.deleteDocument(String(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
