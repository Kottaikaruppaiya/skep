/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.ts';
import { ValidationError } from '../../shared/errors/app-error.ts';
import { getCurrentIndianFinancialYearLabel } from '../../shared/utils/gstr-period.ts';
import { generateB2bExcelExport, generateB2bMonthlySummaryExcel } from './b2b.excel.ts';
import { b2bService } from './b2b.service.ts';

export const b2bController = {
  async dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const financialYear = req.query.financialYear ? String(req.query.financialYear) : undefined;
      const metrics = await b2bService.getDashboardMetrics(financialYear);
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  },

  async monthly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const financialYear = req.query.financialYear ? String(req.query.financialYear) : undefined;
      const summaries = await b2bService.getMonthlySummaries(financialYear);
      res.json(summaries);
    } catch (err) {
      next(err);
    }
  },

  async monthDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const detail = await b2bService.getMonthDetail(String(req.params.periodKey));
      res.json(detail);
    } catch (err) {
      next(err);
    }
  },

  async listInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        periodKey,
        financialYear,
        supplierGstin,
        invoiceType,
        reverseCharge,
        itcAvailability,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.query as Record<string, any>;

      const result = await b2bService.listInvoices({
        periodKey,
        financialYear,
        supplierGstin,
        invoiceType,
        reverseCharge,
        itcAvailability,
        search,
        page: page ? parseInt(String(page), 10) : undefined,
        limit: limit !== undefined ? parseInt(String(limit), 10) : 50,
        sortBy,
        sortOrder,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getInvoiceById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await b2bService.getInvoiceById(String(req.params.id));
      if (!invoice) return res.status(404).json({ error: 'B2B Invoice not found.' });
      res.json(invoice);
    } catch (err) {
      next(err);
    }
  },

  async createInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await b2bService.createInvoice(req.body, req.user!.id);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async updateInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await b2bService.updateInvoice(String(req.params.id), req.body, req.user!.id);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async deleteInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const deleted = await b2bService.deleteInvoice(String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'B2B invoice not found or already deleted.' });
      res.json({ success: true, message: 'B2B invoice deleted successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async listSuppliers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const suppliers = await b2bService.listSuppliers(search);
      res.json(suppliers);
    } catch (err) {
      next(err);
    }
  },

  async getSupplierById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const supplier = await b2bService.getSupplierById(String(req.params.id));
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      res.json(supplier);
    } catch (err) {
      next(err);
    }
  },

  async createSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await b2bService.createSupplier(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async updateSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await b2bService.updateSupplier(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async deleteSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const deleted = await b2bService.deleteSupplier(String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Supplier not found.' });
      res.json({ success: true, message: 'Supplier deleted successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async previewImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new ValidationError('Please upload an Excel workbook (.xlsx, .xls) or CSV file (.csv).');
      }
      const preview = await b2bService.previewImport(req.file.buffer, req.file.originalname);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  },

  async commitImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { previewData, mode, fileName, fileSizeBytes } = req.body;
      const result = await b2bService.commitImport(
        { fileName: fileName || 'Imported_Workbook.xlsx', fileSizeBytes },
        previewData,
        mode || 'SKIP_EXISTING',
        req.user!.id
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async listImportBatches(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const batches = await b2bService.listImportBatches();
      res.json(batches);
    } catch (err) {
      next(err);
    }
  },

  async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { reportType, periodKey, financialYear, supplierGstin } = req.query as Record<string, any>;

      if (reportType === 'monthly_summary') {
        const fy = financialYear && financialYear !== 'ALL' ? String(financialYear) : getCurrentIndianFinancialYearLabel();
        const summaries = await b2bService.getMonthlySummaries(fy);
        const buffer = generateB2bMonthlySummaryExcel(summaries, fy);
        const filename = `SKE_B2B_Monthly_Summary_${fy}_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(buffer);
      }

      const { data: invoices } = await b2bService.listInvoices({
        periodKey: periodKey !== 'ALL' ? periodKey : undefined,
        financialYear: financialYear !== 'ALL' ? financialYear : undefined,
        supplierGstin: supplierGstin !== 'ALL' ? supplierGstin : undefined,
        limit: 0,
      });

      const title = periodKey && periodKey !== 'ALL' ? `B2B Invoices - ${periodKey}` : 'B2B Invoices - Register';
      const buffer = generateB2bExcelExport(invoices, title);
      const filename = `SKE_B2B_Register_${periodKey || financialYear || 'All'}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
