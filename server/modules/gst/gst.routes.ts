/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { gstController } from './gst.controller.ts';
import { createGstEntrySchema, updateGstEntrySchema } from './gst.validator.ts';

export const gstRouter = Router();

gstRouter.get('/', authenticate, gstController.list);
gstRouter.get('/summary', authenticate, gstController.summary);
gstRouter.get('/export', authenticate, gstController.exportExcel);
gstRouter.get('/:id', authenticate, gstController.getById);
gstRouter.post(
  '/',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(createGstEntrySchema),
  gstController.create
);
gstRouter.put(
  '/:id',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(updateGstEntrySchema),
  gstController.update
);
gstRouter.delete('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), gstController.remove);
