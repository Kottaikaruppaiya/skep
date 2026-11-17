/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { spreadsheetUpload } from '../../middleware/upload.middleware.ts';
import { reportsController } from './reports.controller.ts';

export const reportsRouter = Router();

reportsRouter.get('/dashboard', authenticate, reportsController.dashboard);
reportsRouter.get('/excel/export', authenticate, reportsController.exportExcel);
reportsRouter.get('/excel/export-csv', authenticate, reportsController.exportCsv);
reportsRouter.post(
  '/excel/import',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  spreadsheetUpload.single('file'),
  reportsController.importHistorical
);
