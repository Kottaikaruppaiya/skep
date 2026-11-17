/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DashboardMetrics } from '../../../src/types/index.ts';
import { mastersService } from '../masters/masters.service.ts';
import { paymentsService } from '../payments/payments.service.ts';
import { shipmentsService } from '../shipments/shipments.service.ts';
import {
  buildExportWorkbookBuffer,
  extractCsvSheetFromWorkbook,
  parseHistoricalExcelMigration,
  type ImportValidationReport,
} from './reports.excel.ts';
import { reportsRepository } from './reports.repository.ts';

export const reportsService = {
  async getDashboardMetrics(financialYearId?: string): Promise<DashboardMetrics> {
    return reportsRepository.computeDashboardMetrics(financialYearId);
  },

  async exportWorkbook(financialYearId?: string): Promise<{ buffer: Buffer; fyLabel: string }> {
    const [shipments, consignees, banks, payments, metrics, years] = await Promise.all([
      shipmentsService.listShipments(financialYearId && financialYearId !== 'ALL' ? { financialYearId } : undefined),
      mastersService.listConsignees(),
      mastersService.listBanks(),
      paymentsService.listPayments(),
      this.getDashboardMetrics(financialYearId),
      mastersService.listFinancialYears(),
    ]);

    const fyLabel = financialYearId ? years.find((f) => f.id === financialYearId)?.label || 'All' : 'All';
    const buffer = buildExportWorkbookBuffer({
      shipments,
      consignees,
      banks,
      payments,
      metrics,
    });

    return { buffer, fyLabel };
  },

  async exportCsv(sheetName: string, financialYearId?: string): Promise<string> {
    const { buffer } = await this.exportWorkbook(financialYearId);
    return extractCsvSheetFromWorkbook(buffer, sheetName);
  },

  async importHistoricalWorkbook(
    buffer: Buffer,
    financialYearId: string | undefined,
    actorUserId: string
  ): Promise<ImportValidationReport> {
    const targetFy = financialYearId || (await mastersService.getCurrentFinancialYear()).id;
    return parseHistoricalExcelMigration(buffer, targetFy, actorUserId);
  },
};
