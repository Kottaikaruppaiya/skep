/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Response } from 'express';
import type { DocumentCategory } from '../../../src/types/index.ts';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.ts';
import { ValidationError } from '../../shared/errors/app-error.ts';
import { ocrWorker } from '../../workers/ocr.worker.ts';
import { ocrService } from './ocr.service.ts';

export const ocrController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const category = req.query.category ? String(req.query.category) : undefined;
      const jobs = await ocrService.listJobs({ status, category });
      res.json({
        jobs,
        concurrency: ocrWorker.getConcurrencyMetrics(),
      });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const job = await ocrService.getJobById(String(req.params.id));
      if (!job) return res.status(404).json({ error: 'OCR Job not found.' });
      res.json(job);
    } catch (err) {
      next(err);
    }
  },

  async enqueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new ValidationError('No document file provided for OCR queue.');
      }

      const category = (req.body.category || 'COMMERCIAL_INVOICE') as DocumentCategory;
      const financialYearId = req.body.financialYearId ? String(req.body.financialYearId) : undefined;

      const job = await ocrService.enqueueJob({
        originalFilename: req.file.originalname,
        fileSizeBytes: req.file.size,
        category,
        financialYearId,
        buffer: req.file.buffer,
      });

      ocrWorker.registerStagingBuffer(job.id, req.file.buffer);
      ocrWorker.triggerProcessing();

      res.status(202).json({
        success: true,
        message: 'Document queued for background server-side OCR processing.',
        job,
      });
    } catch (err) {
      next(err);
    }
  },

  async retry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const job = await ocrService.retryJob(String(req.params.id));
      ocrWorker.triggerProcessing();
      res.json(job);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ocrService.deleteJob(String(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reviewedValues = req.body.reviewedValues || req.body || {};
      const result = await ocrService.approveJob(String(req.params.id), reviewedValues, {
        id: req.user!.id,
        name: req.user!.name,
      });
      res.json({
        success: true,
        message: 'Candidate OCR data approved and committed to ledger.',
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },
};
