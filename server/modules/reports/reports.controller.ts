/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.ts';
import { ValidationError } from '../../shared/errors/app-error.ts';
import { reportsService } from './reports.service.ts';

export const reportsController = {
  async dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const fyId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;
      const metrics = await reportsService.getDashboardMetrics(fyId);
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  },

  async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const fyId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;
      const { buffer, fyLabel } = await reportsService.exportWorkbook(fyId);
      const filename = `SKE_Export_Realisation_Tracker_${fyLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  async exportCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sheet = String(req.query.sheet || 'Export Tracker');
      const fyId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;
      const csvContent = await reportsService.exportCsv(sheet, fyId);
      const safeSheet = sheet.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `SKE_${safeSheet}_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(csvContent);
    } catch (err) {
      next(err);
    }
  },

  async importHistorical(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new ValidationError('Please upload an Excel workbook (.xlsx or .xlsm) or CSV file (.csv).');
      }
      const fyId = req.body.financialYearId ? String(req.body.financialYearId) : undefined;
      const report = await reportsService.importHistoricalWorkbook(req.file.buffer, fyId, req.user!.id);
      res.json(report);
    } catch (err) {
      next(err);
    }
  },
};
