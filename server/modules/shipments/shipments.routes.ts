/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { upload } from '../../middleware/upload.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { shipmentsController } from './shipments.controller.ts';
import { archiveShipmentSchema, createShipmentSchema, updateShipmentSchema } from './shipments.validator.ts';

export const shipmentsRouter = express.Router();

shipmentsRouter.get('/', authenticate, shipmentsController.list);
shipmentsRouter.get('/lookup', authenticate, shipmentsController.lookup);
shipmentsRouter.get('/check-unique', authenticate, shipmentsController.checkUnique);
shipmentsRouter.get('/:id', authenticate, shipmentsController.getById);

shipmentsRouter.post(
  '/create-with-documents',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  upload.fields([
    { name: 'invoiceDoc', maxCount: 1 },
    { name: 'shippingBillDoc', maxCount: 1 },
    { name: 'blDoc', maxCount: 1 },
    { name: 'brcDoc1', maxCount: 1 },
    { name: 'brcDoc2', maxCount: 1 },
    { name: 'fircDoc', maxCount: 1 },
    { name: 'additionalDoc', maxCount: 1 },
  ]),
  shipmentsController.createWithDocuments
);

shipmentsRouter.post(
  '/',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(createShipmentSchema),
  shipmentsController.create
);

shipmentsRouter.put(
  '/:id',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(updateShipmentSchema),
  shipmentsController.update
);

shipmentsRouter.post(
  '/:id/archive',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(archiveShipmentSchema),
  shipmentsController.archive
);

shipmentsRouter.post(
  '/:id/restore',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  shipmentsController.restore
);

shipmentsRouter.delete(
  '/:id',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  shipmentsController.remove
);
