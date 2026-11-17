/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { spreadsheetUpload } from '../../middleware/upload.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { b2bController } from './b2b.controller.ts';
import {
  commitB2bImportSchema,
  createB2bInvoiceSchema,
  createSupplierSchema,
  updateB2bInvoiceSchema,
  updateSupplierSchema,
} from './b2b.validator.ts';

export const b2bRouter = Router();

b2bRouter.get('/dashboard', authenticate, b2bController.dashboard);
b2bRouter.get('/monthly', authenticate, b2bController.monthly);
b2bRouter.get('/monthly/:periodKey', authenticate, b2bController.monthDetail);

b2bRouter.get('/invoices', authenticate, b2bController.listInvoices);
b2bRouter.get('/invoices/:id', authenticate, b2bController.getInvoiceById);
b2bRouter.post(
  '/invoices',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(createB2bInvoiceSchema),
  b2bController.createInvoice
);
b2bRouter.put(
  '/invoices/:id',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(updateB2bInvoiceSchema),
  b2bController.updateInvoice
);
b2bRouter.delete('/invoices/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), b2bController.deleteInvoice);

b2bRouter.get('/suppliers', authenticate, b2bController.listSuppliers);
b2bRouter.get('/suppliers/:id', authenticate, b2bController.getSupplierById);
b2bRouter.post(
  '/suppliers',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(createSupplierSchema),
  b2bController.createSupplier
);
b2bRouter.put(
  '/suppliers/:id',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(updateSupplierSchema),
  b2bController.updateSupplier
);
b2bRouter.delete('/suppliers/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), b2bController.deleteSupplier);

b2bRouter.post(
  '/import/preview',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  spreadsheetUpload.single('file'),
  b2bController.previewImport
);
b2bRouter.post(
  '/import/commit',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(commitB2bImportSchema),
  b2bController.commitImport
);
b2bRouter.get('/import/batches', authenticate, b2bController.listImportBatches);
b2bRouter.get('/export', authenticate, b2bController.exportExcel);
