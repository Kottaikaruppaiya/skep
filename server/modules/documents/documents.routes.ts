/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { upload } from '../../middleware/upload.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { documentsController } from './documents.controller.ts';
import { updateDocumentReviewSchema } from './documents.validator.ts';

export const documentsRouter = express.Router();

documentsRouter.get('/', authenticate, documentsController.list);
documentsRouter.get('/:id/download', authenticate, documentsController.download);

documentsRouter.post(
  '/extract-batch',
  authenticate,
  upload.fields([
    { name: 'invoiceDoc', maxCount: 1 },
    { name: 'shippingBillDoc', maxCount: 1 },
    { name: 'blDoc', maxCount: 1 },
    { name: 'brcDoc1', maxCount: 1 },
    { name: 'brcDoc2', maxCount: 1 },
    { name: 'fircDoc', maxCount: 1 },
    { name: 'additionalDoc', maxCount: 1 },
  ]),
  documentsController.extractBatch
);

documentsRouter.post(
  '/upload',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  upload.single('file'),
  documentsController.uploadSingle
);

documentsRouter.put(
  '/:id/review',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(updateDocumentReviewSchema),
  documentsController.updateReview
);

documentsRouter.delete('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), documentsController.remove);
