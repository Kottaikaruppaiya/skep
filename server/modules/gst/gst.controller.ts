/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Response } from 'express';
import type { GstResult } from '../../../src/types/index.ts';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.ts';
import { generateGstExcelExport } from '../reports/reports.excel.ts';
import { gstService } from './gst.service.ts';

export const gstController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const resultData = await gstService.listEntries({
        consigneeId: req.query.consigneeId ? String(req.query.consigneeId) : undefined,
        result: req.query.result ? (String(req.query.result) as GstResult) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
        sortBy: req.query.sortBy ? (String(req.query.sortBy) as any) : undefined,
        sortOrder: req.query.sortOrder ? (String(req.query.sortOrder) as any) : undefined,
      });
      res.json(resultData);
    } catch (err) {
      next(err);
    }
  },

  async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await gstService.getSummary({
        consigneeId: req.query.consigneeId ? String(req.query.consigneeId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      });
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },

  async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { entries, summary } = await gstService.listEntries({
        consigneeId: req.query.consigneeId ? String(req.query.consigneeId) : undefined,
        result: req.query.result ? (String(req.query.result) as GstResult) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        limit: 10000,
      });

      const buffer = generateGstExcelExport(entries, summary);
      const filename = `SKE_GST_Entries_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const entry = await gstService.getEntryById(String(req.params.id));
      if (!entry) return res.status(404).json({ error: 'GST entry not found.' });
      res.json(entry);
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await gstService.createEntry(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await gstService.updateEntry(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const deleted = await gstService.deleteEntry(String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'GST entry not found or already deleted.' });
      res.json({ success: true, message: 'GST entry deleted successfully.' });
    } catch (err) {
      next(err);
    }
  },
};
