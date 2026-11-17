/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { B2bDashboardMetrics, B2bInvoice, B2bMonthlySummary } from '../../../src/types/index.ts';
import { dAdd, round2 } from '../../shared/utils/decimal.ts';
import { getMonthsForFinancialYear } from '../../shared/utils/gstr-period.ts';

export function calculateB2bInvoiceTaxTotals(input: {
  taxableValue?: number;
  integratedTax?: number;
  centralTax?: number;
  stateUtTax?: number;
  cess?: number;
  invoiceValue?: number;
}): {
  taxableValue: number;
  integratedTax: number;
  centralTax: number;
  stateUtTax: number;
  cess: number;
  totalGst: number;
  invoiceValue: number;
} {
  const taxableValue = round2(input.taxableValue || 0);
  const integratedTax = round2(input.integratedTax || 0);
  const centralTax = round2(input.centralTax || 0);
  const stateUtTax = round2(input.stateUtTax || 0);
  const cess = round2(input.cess || 0);
  const totalGst = round2(dAdd(dAdd(integratedTax, centralTax), dAdd(stateUtTax, cess)));

  let invoiceValue = round2(input.invoiceValue || 0);
  if (!invoiceValue || invoiceValue === 0) {
    invoiceValue = round2(dAdd(taxableValue, totalGst));
  }

  return {
    taxableValue,
    integratedTax,
    centralTax,
    stateUtTax,
    cess,
    totalGst,
    invoiceValue,
  };
}

export function computeMonthlySummaryBlock(
  periodKey: string,
  displayPeriod: string,
  financialYear: string,
  invoices: B2bInvoice[]
): B2bMonthlySummary {
  const uniqueSuppliers = new Set(invoices.map((inv) => inv.supplierGstin.toUpperCase())).size;
  let totalInvoiceValue = 0;
  let totalTaxableValue = 0;
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalCess = 0;
  let totalGst = 0;
  let itcAvailableCount = 0;
  let reverseChargeCount = 0;

  for (const inv of invoices) {
    totalInvoiceValue = dAdd(totalInvoiceValue, inv.invoiceValue || 0);
    totalTaxableValue = dAdd(totalTaxableValue, inv.taxableValue || 0);
    totalIgst = dAdd(totalIgst, inv.integratedTax || 0);
    totalCgst = dAdd(totalCgst, inv.centralTax || 0);
    totalSgst = dAdd(totalSgst, inv.stateUtTax || 0);
    totalCess = dAdd(totalCess, inv.cess || 0);
    totalGst = dAdd(totalGst, inv.totalGst || 0);
    if (inv.itcAvailability === 'Yes') itcAvailableCount++;
    if (inv.reverseCharge === 'Y') reverseChargeCount++;
  }

  return {
    periodKey,
    displayPeriod,
    financialYear,
    invoiceCount: invoices.length,
    uniqueSuppliers,
    totalInvoiceValue: round2(totalInvoiceValue),
    totalTaxableValue: round2(totalTaxableValue),
    totalIgst: round2(totalIgst),
    totalCgst: round2(totalCgst),
    totalSgst: round2(totalSgst),
    totalCess: round2(totalCess),
    totalGst: round2(totalGst),
    itcAvailableCount,
    reverseChargeCount,
  };
}

export function buildB2bMonthlySummaries(invoices: B2bInvoice[], financialYear?: string): B2bMonthlySummary[] {
  const fy = financialYear && financialYear !== 'ALL' ? financialYear : '2026-27';
  const standardMonths = getMonthsForFinancialYear(fy);
  const fyInvoices = invoices.filter((inv) => inv.financialYear === fy);

  const summaries: B2bMonthlySummary[] = standardMonths.map((m) =>
    computeMonthlySummaryBlock(
      m.periodKey,
      m.displayPeriod,
      fy,
      fyInvoices.filter((inv) => inv.periodKey === m.periodKey)
    )
  );

  const existingKeys = new Set(summaries.map((s) => s.periodKey));
  const extraKeys = Array.from(new Set(fyInvoices.map((inv) => inv.periodKey))).filter((k) => !existingKeys.has(k));
  for (const epk of extraKeys) {
    const monthInvoices = fyInvoices.filter((inv) => inv.periodKey === epk);
    const sample = monthInvoices[0];
    summaries.push(computeMonthlySummaryBlock(epk, sample?.gstrPeriod || epk, fy, monthInvoices));
  }

  return summaries;
}

export function buildB2bDashboardMetrics(invoices: B2bInvoice[], financialYear?: string): B2bDashboardMetrics {
  const fy = financialYear && financialYear !== 'ALL' ? financialYear : '2026-27';
  const fyInvoices = fy !== 'ALL' ? invoices.filter((inv) => inv.financialYear === fy) : invoices;

  const uniqueSuppliers = new Set(fyInvoices.map((inv) => inv.supplierGstin.toUpperCase())).size;
  const monthlySummaries = buildB2bMonthlySummaries(fyInvoices, fy);

  const monthlyTrends = monthlySummaries.map((m) => ({
    periodKey: m.periodKey,
    displayPeriod: m.displayPeriod,
    invoiceCount: m.invoiceCount,
    taxableValue: m.totalTaxableValue,
    totalGst: m.totalGst,
    invoiceValue: m.totalInvoiceValue,
  }));

  const supMap = new Map<
    string,
    { gstin: string; name: string; invoiceCount: number; invoiceValue: number; taxableValue: number; totalGst: number }
  >();

  let totalInvoiceValue = 0;
  let totalTaxableValue = 0;
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalCess = 0;
  let totalGst = 0;
  let itcAvailableCount = 0;
  let reverseChargeCount = 0;

  for (const inv of fyInvoices) {
    totalInvoiceValue = dAdd(totalInvoiceValue, inv.invoiceValue || 0);
    totalTaxableValue = dAdd(totalTaxableValue, inv.taxableValue || 0);
    totalIgst = dAdd(totalIgst, inv.integratedTax || 0);
    totalCgst = dAdd(totalCgst, inv.centralTax || 0);
    totalSgst = dAdd(totalSgst, inv.stateUtTax || 0);
    totalCess = dAdd(totalCess, inv.cess || 0);
    totalGst = dAdd(totalGst, inv.totalGst || 0);
    if (inv.itcAvailability === 'Yes') itcAvailableCount++;
    if (inv.reverseCharge === 'Y') reverseChargeCount++;

    const gstin = inv.supplierGstin.toUpperCase();
    const existing = supMap.get(gstin) || {
      gstin,
      name: inv.supplierName,
      invoiceCount: 0,
      invoiceValue: 0,
      taxableValue: 0,
      totalGst: 0,
    };
    existing.invoiceCount += 1;
    existing.invoiceValue = round2(dAdd(existing.invoiceValue, inv.invoiceValue || 0));
    existing.taxableValue = round2(dAdd(existing.taxableValue, inv.taxableValue || 0));
    existing.totalGst = round2(dAdd(existing.totalGst, inv.totalGst || 0));
    supMap.set(gstin, existing);
  }

  const topSuppliers = Array.from(supMap.values())
    .sort((a, b) => b.totalGst - a.totalGst)
    .slice(0, 10);

  const recentInvoices = [...fyInvoices]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  return {
    totalInvoices: fyInvoices.length,
    uniqueSuppliers,
    totalInvoiceValue: round2(totalInvoiceValue),
    totalTaxableValue: round2(totalTaxableValue),
    totalIgst: round2(totalIgst),
    totalCgst: round2(totalCgst),
    totalSgst: round2(totalSgst),
    totalCess: round2(totalCess),
    totalGst: round2(totalGst),
    itcAvailableCount,
    reverseChargeCount,
    monthlyTrends,
    supplierSummaries: topSuppliers,
    topSuppliers,
    recentInvoices,
  };
}
