/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { uploadMiddleware } from '../../middleware/upload.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { ocrController } from './ocr.controller.ts';
import { approveOcrJobSchema } from './ocr.validator.ts';

export const ocrRouter = Router();

ocrRouter.get('/jobs', authenticate, ocrController.list);
ocrRouter.get('/jobs/:id', authenticate, ocrController.getById);
ocrRouter.post(
  '/jobs',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  uploadMiddleware.single('file'),
  ocrController.enqueue
);
ocrRouter.post('/jobs/:id/retry', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), ocrController.retry);
ocrRouter.delete('/jobs/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), ocrController.remove);
ocrRouter.post(
  '/jobs/:id/approve',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(approveOcrJobSchema),
  ocrController.approve
);
