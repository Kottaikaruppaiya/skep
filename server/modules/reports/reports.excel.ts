/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import type {
  BankMaster,
  ConsigneeMaster,
  DashboardMetrics,
  GstEntry,
  GstSummary,
  Payment,
  Shipment,
} from '../../../src/types/index.ts';
import { withTransaction } from '../../config/prisma.ts';
import { dAdd, dDiv, dMul, dSub, round2 } from '../../shared/utils/decimal.ts';
import { normalizeInvoiceKey } from '../../shared/utils/normalizer.ts';
import { brcService } from '../brc/brc.service.ts';
import { mastersService } from '../masters/masters.service.ts';
import { paymentsService } from '../payments/payments.service.ts';
import { shipmentsService } from '../shipments/shipments.service.ts';

export interface ImportValidationReport {
  totalRowsRead: number;
  acceptedRows: number;
  rejectedRows: number;
  warningsCount: number;
  importType?: 'TRACKER' | 'BANK_MASTER' | 'CONSIGNEE_MASTER';
  rejectionLog: Array<{
    rowNumber: number;
    invoiceNo: string;
    consignee: string;
    reason: string;
  }>;
  warnings: Array<{
    rowNumber: number;
    invoiceNo: string;
    message: string;
  }>;
  importedShipmentIds: string[];
}

function aggregateShipmentAllocations(s: Shipment, payments: Payment[]) {
  const allocations = s.allocations || [];
  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const irms = new Set<string>();
  const creditDates = new Set<string>();
  const bankNames = new Set<string>();

  for (const alloc of allocations) {
    const payment = paymentById.get(alloc.paymentId);
    const irm = alloc.paymentIrm || payment?.irmNumber;
    if (irm) irms.add(irm);

    const creditDate = alloc.paymentCreditDate || payment?.creditDate || alloc.allocatedAt?.split('T')[0];
    if (creditDate) creditDates.add(creditDate);

    const bankName = alloc.paymentBankName || payment?.bankName;
    if (bankName) bankNames.add(bankName);
  }

  return {
    irms: Array.from(irms).join(', '),
    creditDates: Array.from(creditDates).join(', '),
    bankNames: Array.from(bankNames).join(', '),
  };
}

export function buildExportWorkbookBuffer(input: {
  shipments: Shipment[];
  consignees: ConsigneeMaster[];
  banks: BankMaster[];
  payments: Payment[];
  metrics: DashboardMetrics;
}): Buffer {
  const { shipments, consignees, banks, payments, metrics } = input;
  const wb = XLSX.utils.book_new();
  const paymentById = new Map(payments.map((p) => [p.id, p]));

  // 1. Export Tracker Sheet (Exact 31 Columns A through AE matching workbook specification)
  const trackerData = shipments.map((s, idx) => {
    const dbk = s.incentives?.find((i) => i.type === 'DRAWBACK');
    const rodtep = s.incentives?.find((i) => i.type === 'RODTEP');
    const rosctl = s.incentives?.find((i) => i.type === 'ROSCTL');
    const brc = s.brcRecord;
    const agg = aggregateShipmentAllocations(s, payments);

    const usdReceived = round2(s.totalPaidUsd || 0);
    const inrReceived = round2(s.realisedInr || 0);
    const fobInr = round2(s.fobValueInr || 0);
    const diffUsd = round2(dSub(s.invoiceValueUsd || 0, usdReceived));
    const isFullyRealised = diffUsd <= 0 && usdReceived > 0 && inrReceived > 0;
    const forexVarianceInr = isFullyRealised ? round2(dSub(inrReceived, fobInr)) : 0;
    const gainLossTag = !isFullyRealised ? 'NIL' : forexVarianceInr > 0 ? 'GAIN' : forexVarianceInr < 0 ? 'LOSS' : 'NIL';
    const avgRealisedRate =
      usdReceived > 0 && inrReceived > 0
        ? round2(dDiv(inrReceived, usdReceived))
        : round2(s.averageRealisedRate || 0);

    return {
      'S.No': idx + 1,
      'Invoice No': s.invoiceNumber,
      'Invoice Date': s.invoiceDate,
      'Shipping Bill No': s.shippingBillNumber,
      'Shipping Bill Date': s.shippingBillDate,
      'Port Code': s.portCode,
      'Consignee Name': s.consigneeName,
      'No. of Pkgs': s.packageCount || 0,
      'Invoice Value (USD)': round2(s.invoiceValueUsd),
      'FOB Value (INR)': fobInr,
      'Exchange Rate': round2(s.sbExchangeRate),
      'Drawback Amt (INR)': round2(dbk?.claimedAmount || 0),
      'Drawback Recd': dbk?.status || 'PENDING',
      'Drawback Received Date': dbk?.receivedDate || '',
      'RoDTEP Amt (INR)': round2(rodtep?.claimedAmount || 0),
      'RoDTEP Recd': rodtep?.status || 'PENDING',
      'RoSCTL Amt (INR)': round2(rosctl?.claimedAmount || 0),
      'RoSCTL Recd': rosctl?.status || 'PENDING',
      'Payment Received Date': agg.creditDates,
      'Amount Received (USD)': usdReceived,
      'Amount Received (INR)': inrReceived,
      'Exchange Rate Received': avgRealisedRate,
      'Bank': agg.bankNames,
      'Bank Inward Remittance No. (IRM)': agg.irms,
      'BRC Number': brc?.brcNumber || '',
      'BRC Date': brc?.issueDate || '',
      'Difference (USD)': diffUsd,
      'Forex Gain / Loss (INR)': forexVarianceInr,
      'Gain / Loss': gainLossTag,
      'Remarks': s.remarks || '',
      'Key': s.normalizedInvoiceKey,
    };
  });
  const wsTracker = XLSX.utils.json_to_sheet(trackerData);
  XLSX.utils.book_append_sheet(wb, wsTracker, 'Export Tracker');

  const buildConsigneeLedgerRows = (targetConsigneePattern: string) => {
    const matched = consignees.find((c) => c.name.toLowerCase().includes(targetConsigneePattern.toLowerCase()));
    const targetShipments = shipments.filter(
      (s) =>
        s.consigneeId === matched?.id ||
        (matched && s.consigneeName?.toLowerCase() === matched.name.toLowerCase()) ||
        s.consigneeName?.toLowerCase().includes(targetConsigneePattern.toLowerCase())
    );

    return targetShipments.map((s, idx) => {
      const agg = aggregateShipmentAllocations(s, payments);
      return {
        'S.No': idx + 1,
        'Invoice No': s.invoiceNumber,
        'Invoice Date': s.invoiceDate,
        'Shipping Bill No': s.shippingBillNumber,
        'Shipping Bill Date': s.shippingBillDate,
        'Port Code': s.portCode,
        'No. of Pkgs': s.packageCount || 0,
        'Invoice Value (USD)': round2(s.invoiceValueUsd),
        'FOB Value (INR)': round2(s.fobValueInr),
        'FIRC / IRM No.': agg.irms,
        'Bank': agg.bankNames,
        'Payment Received Date': agg.creditDates,
        'Amount Received (USD)': round2(s.totalPaidUsd || 0),
        'Difference (USD)': round2(s.balanceDueUsd || 0),
        'Exchange Rate Received': round2(s.averageRealisedRate || 0),
        'Amount Received (INR)': round2(s.realisedInr || 0),
        'BRC Number': s.brcRecord?.brcNumber || '',
        'BRC Status': s.brcRecord?.status || 'PENDING',
        'Payment Status': s.paymentStatus,
        'Remarks': s.remarks || '',
      };
    });
  };

  // 2. Quick View Sheet
  const quickViewData = [
    { Metric: 'Total Export Shipments', Value: metrics.totalShipments },
    { Metric: 'Total Invoice Value (USD)', Value: `$${metrics.totalInvoiceValueUsd.toLocaleString()}` },
    { Metric: 'Total Realised Amount (USD)', Value: `$${metrics.totalRealisedUsd.toLocaleString()}` },
    { Metric: 'Outstanding USD Balance', Value: `$${metrics.totalOutstandingUsd.toLocaleString()}` },
    { Metric: 'Fully Realised Invoices', Value: metrics.fullyPaidCount },
    { Metric: 'Partially Realised Invoices', Value: metrics.partPaidCount },
    { Metric: 'Unrealised / Pending Invoices', Value: metrics.unpaidCount },
    { Metric: 'Total Incentives Claimed (INR)', Value: `₹${metrics.incentivesClaimedInr.toLocaleString()}` },
    { Metric: 'Total Incentives Received (INR)', Value: `₹${metrics.incentivesReceivedInr.toLocaleString()}` },
    { Metric: 'Pending Incentives (INR)', Value: `₹${metrics.incentivesPendingInr.toLocaleString()}` },
    { Metric: 'BRC Complete Count', Value: metrics.brcRealisedCount },
    { Metric: 'BRC Pending Count', Value: metrics.brcPendingCount },
  ];
  const wsQuick = XLSX.utils.json_to_sheet(quickViewData);
  XLSX.utils.book_append_sheet(wb, wsQuick, 'Quick View');

  // 3. Consignee Summary Sheet
  const consigneeSummary = consignees.map((c) => {
    const cShipments = shipments.filter(
      (s) => s.consigneeId === c.id || s.consigneeName?.toLowerCase() === c.name.toLowerCase()
    );
    const totalInvoicedUsd = round2(cShipments.reduce((sum, s) => dAdd(sum, s.invoiceValueUsd), 0));
    const totalFobInr = round2(cShipments.reduce((sum, s) => dAdd(sum, s.fobValueInr), 0));
    const totalPaidUsd = round2(cShipments.reduce((sum, s) => dAdd(sum, s.totalPaidUsd || 0), 0));
    const totalRealisedInr = round2(cShipments.reduce((sum, s) => dAdd(sum, s.realisedInr || 0), 0));
    const totalPkgs = cShipments.reduce((sum, s) => sum + (s.packageCount || 0), 0);
    const avgRate = totalInvoicedUsd > 0 ? round2(dDiv(totalFobInr, totalInvoicedUsd)) : 0;
    const outstandingUsd = Math.max(0, round2(dSub(totalInvoicedUsd, totalPaidUsd)));

    let dbkClaimed = 0;
    let dbkRecd = 0;
    let rodtepClaimed = 0;
    let rodtepRecd = 0;
    let rosctlClaimed = 0;
    let rosctlRecd = 0;

    for (const s of cShipments) {
      for (const inc of s.incentives || []) {
        if (inc.type === 'DRAWBACK') {
          dbkClaimed = dAdd(dbkClaimed, inc.claimedAmount);
          dbkRecd = dAdd(dbkRecd, inc.receivedAmount);
        } else if (inc.type === 'RODTEP') {
          rodtepClaimed = dAdd(rodtepClaimed, inc.claimedAmount);
          rodtepRecd = dAdd(rodtepRecd, inc.receivedAmount);
        } else if (inc.type === 'ROSCTL') {
          rosctlClaimed = dAdd(rosctlClaimed, inc.claimedAmount);
          rosctlRecd = dAdd(rosctlRecd, inc.receivedAmount);
        }
      }
    }

    const dbkPending = Math.max(0, round2(dSub(dbkClaimed, dbkRecd)));
    const rodtepPending = Math.max(0, round2(dSub(rodtepClaimed, rodtepRecd)));
    const rosctlPending = Math.max(0, round2(dSub(rosctlClaimed, rosctlRecd)));
    const totalIncentivesPending = round2(dAdd(dAdd(dbkPending, rodtepPending), rosctlPending));
    const netForexInr = round2(
      cShipments.reduce((sum, s) => {
        const sPaid = round2(s.totalPaidUsd || 0);
        const sInr = round2(s.realisedInr || 0);
        const sDiff = round2(dSub(s.invoiceValueUsd || 0, sPaid));
        if (sDiff <= 0 && sPaid > 0 && sInr > 0) {
          return dAdd(sum, dSub(sInr, round2(s.fobValueInr || 0)));
        }
        return sum;
      }, 0)
    );

    return {
      Consignee: c.name,
      'No. of Invoices': cShipments.length,
      'No. of Pkgs': totalPkgs,
      'Invoice Value USD': totalInvoicedUsd,
      'FOB Value INR': totalFobInr,
      'Avg Exchange Rate': avgRate,
      'Received USD': totalPaidUsd,
      'Outstanding USD': outstandingUsd,
      'Drawback Claimed INR': round2(dbkClaimed),
      'Drawback Pending INR': dbkPending,
      'RoDTEP Claimed INR': round2(rodtepClaimed),
      'RoDTEP Pending INR': rodtepPending,
      'RoSCTL Claimed INR': round2(rosctlClaimed),
      'RoSCTL Pending INR': rosctlPending,
      'Total Incentive Pending INR': totalIncentivesPending,
      'Net Forex Gain/Loss INR': netForexInr,
    };
  });
  const wsConsignee = XLSX.utils.json_to_sheet(consigneeSummary);
  XLSX.utils.book_append_sheet(wb, wsConsignee, 'Consignee Summary');

  // 4. Buyer Ledgers
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildConsigneeLedgerRows('sk global')), 'SK Global Ventures');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildConsigneeLedgerRows('shasvanth')), 'Shasvanth Impex');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildConsigneeLedgerRows('precision tex')), 'Precision Tex Lanka');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildConsigneeLedgerRows('tex fab')), 'Tex Fab Lanka');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildConsigneeLedgerRows('winfield')), 'Winfield Merchant');

  // 5. Consignee Master
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      consignees.map((c) => ({
        ID: c.id,
        Name: c.name,
        Country: c.country,
        'Port of Discharge': c.portOfDischarge,
        'Payment Terms': c.paymentTerms,
        Currency: c.currency,
        'Contact Email': c.contactEmail || '',
        Status: c.isActive ? 'Active' : 'Inactive',
      }))
    ),
    'Consignee Master'
  );

  // 6. Bank Master
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      banks.map((b) => ({
        'Bank (receiving export proceeds)': b.name,
        Branch: b.branch,
        'AD Code': b.adCode,
        'IFSC Code': b.ifscCode,
        'SWIFT Code': b.swiftCode,
        'Account Number': b.accountNumber,
        Status: b.isActive ? 'Active' : 'Inactive',
      }))
    ),
    'Bank Master'
  );

  // 7. Inward Remittances
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      payments.map((p) => ({
        'IRM Number': p.irmNumber,
        'Sender Reference': p.senderReference || '',
        'Remittance USD': round2(p.verifiedAmount),
        'Allocated USD': round2(p.totalAllocatedUsd || 0),
        'Available Balance USD': round2(p.availableBalanceUsd || 0),
        'Exchange Rate': round2(p.exchangeRate || 0),
        'INR Amount': round2(p.inrAmount || 0),
        'Credit Date': p.creditDate,
        'Value Date': p.valueDate,
        Bank: p.bankName || '',
        'Purpose Code': p.purposeCode || '',
      }))
    ),
    'Inward Remittances'
  );

  // 8. Allocation Tranches (every individual payment allocation across all shipments)
  const trancheRows: Array<Record<string, any>> = [];
  for (const s of shipments) {
    for (const alloc of s.allocations || []) {
      const payment = paymentById.get(alloc.paymentId);
      const fxRate = alloc.paymentExchangeRate ?? payment?.exchangeRate ?? 0;
      const inrAllocated = fxRate > 0 ? round2(dMul(alloc.allocatedAmountUsd, fxRate)) : 0;
      trancheRows.push({
        'Invoice No': s.invoiceNumber,
        'Consignee Name': s.consigneeName,
        'IRM Number': alloc.paymentIrm || payment?.irmNumber || '',
        'Bank': alloc.paymentBankName || payment?.bankName || '',
        'Credit Date': alloc.paymentCreditDate || payment?.creditDate || alloc.allocatedAt?.split('T')[0] || '',
        'Allocated USD': round2(alloc.allocatedAmountUsd),
        'Exchange Rate': round2(fxRate),
        'Allocated INR': inrAllocated,
        'Allocated At': alloc.allocatedAt?.split('T')[0] || '',
        'Notes': alloc.notes || '',
      });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trancheRows), 'Allocation Tranches');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function extractCsvSheetFromWorkbook(wbBuffer: Buffer, sheetName: string): string {
  const wb = XLSX.read(wbBuffer, { type: 'buffer' });
  const targetSheet = wb.SheetNames.find((s) => s.toLowerCase().includes(sheetName.toLowerCase())) || wb.SheetNames[0];
  const sheet = wb.Sheets[targetSheet];
  return XLSX.utils.sheet_to_csv(sheet);
}

function parseExcelDate(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) return date.toISOString().split('T')[0];
    return null;
  }
  const str = String(val).trim();
  if (!str) return null;
  const parts = str.replace(/[\/\.]/g, '-').split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const iso = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? null : iso;
    }
    if (parts[2].length === 4) {
      const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? null : iso;
    }
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

export async function parseHistoricalExcelMigration(
  fileBuffer: Buffer,
  targetFinancialYearId: string,
  actorUserId: string
): Promise<ImportValidationReport> {
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const headerMatrix: any[][] = firstSheet ? XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) : [];
  const headerSampleText = headerMatrix
    .slice(0, 5)
    .flat()
    .map((v) => String(v || '').trim())
    .join(' | ');

  const report: ImportValidationReport = {
    totalRowsRead: 0,
    acceptedRows: 0,
    rejectedRows: 0,
    warningsCount: 0,
    rejectionLog: [],
    warnings: [],
    importedShipmentIds: [],
  };

  if (
    wb.SheetNames.some((s) => s.toLowerCase().includes('bank master')) ||
    headerSampleText.includes('BANK MASTER') ||
    headerSampleText.includes('Bank (receiving export proceeds)')
  ) {
    report.importType = 'BANK_MASTER';
    const bankSheetName =
      wb.SheetNames.find((s) => s.toLowerCase().includes('bank master')) || wb.SheetNames[0];
    const bankSheet = wb.Sheets[bankSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(bankSheet, { defval: '' });
    const existingBanks = await mastersService.listBanks();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const bankName = String(
        row['Bank (receiving export proceeds)'] || row['Bank Name'] || row['Name'] || Object.values(row)[0] || ''
      ).trim();
      if (!bankName || bankName.toUpperCase() === 'BANK MASTER') continue;

      report.totalRowsRead++;
      const exists = existingBanks.some((b) => b.name.toLowerCase() === bankName.toLowerCase());
      if (exists) {
        report.warnings.push({
          rowNumber: i + 2,
          invoiceNo: bankName,
          message: `Bank '${bankName}' already exists in Bank Master (preserved).`,
        });
        report.acceptedRows++;
      } else {
        try {
          const created = await mastersService.createBank({
            name: bankName,
            branch: String(row['Branch'] || '').trim(),
            adCode: String(row['AD Code'] || '').trim(),
            ifscCode: String(row['IFSC Code'] || '').trim(),
            swiftCode: String(row['SWIFT Code'] || '').trim(),
            accountNumber: String(row['Account Number'] || '').trim(),
            isActive: true,
          });
          existingBanks.push(created);
          report.acceptedRows++;
          report.warnings.push({
            rowNumber: i + 2,
            invoiceNo: bankName,
            message: `Created new Bank Master entry for '${bankName}'.`,
          });
        } catch (e: any) {
          report.rejectedRows++;
          report.rejectionLog.push({
            rowNumber: i + 2,
            invoiceNo: bankName,
            consignee: 'Bank Master',
            reason: e.message,
          });
        }
      }
    }
    return report;
  }

  if (
    wb.SheetNames.some((s) => s.toLowerCase().includes('consignee master')) ||
    headerSampleText.includes('CONSIGNEE MASTER') ||
    (headerSampleText.includes('Country') && headerSampleText.includes('Port of Discharge'))
  ) {
    report.importType = 'CONSIGNEE_MASTER';
    const sheetName =
      wb.SheetNames.find((s) => s.toLowerCase().includes('consignee master')) || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    report.totalRowsRead = rows.length;
    const existingConsignees = await mastersService.listConsignees();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row['Name'] || row['Consignee Name'] || row['CONSIGNEE'] || '').trim();
      if (!name) {
        report.rejectedRows++;
        report.rejectionLog.push({
          rowNumber: i + 2,
          invoiceNo: 'BLANK',
          consignee: 'Consignee Master',
          reason: 'Consignee Name is missing.',
        });
        continue;
      }

      const existing = existingConsignees.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        const created = await mastersService.createConsignee({
          name,
          country: String(row['Country'] || 'International').trim(),
          portOfDischarge: String(row['Port of Discharge'] || row['Port'] || '').trim(),
          paymentTerms: String(row['Payment Terms'] || '').trim(),
          currency: String(row['Currency'] || 'USD').trim(),
          contactEmail: String(row['Contact Email'] || '').trim(),
          isActive: true,
        });
        existingConsignees.push(created);
      }
      report.acceptedRows++;
    }
    return report;
  }

  report.importType = 'TRACKER';
  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes('export') || s.toLowerCase().includes('tracker')) ||
    wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  report.totalRowsRead = rows.length;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2;
    const invoiceNo = String(row['Invoice No.'] || row['Invoice No'] || row['INVOICE NO'] || '').trim();
    const consigneeName = String(row['Consignee Name'] || row['Consignee'] || row['BUYER'] || '').trim();
    const fircIrm = String(
      row['FIRC / IRM No.'] || row['FIRC No.'] || row['IRM Number'] || row['FIRC'] || row['IRM'] || row['Bank Inward Remittance No. (IRM)'] || ''
    ).trim();

    if (!invoiceNo) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo: 'BLANK',
        consignee: consigneeName,
        reason: 'Invoice number is missing or empty.',
      });
      continue;
    }

    if (!consigneeName) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo,
        consignee: 'BLANK',
        reason: 'Consignee Name is missing or empty.',
      });
      continue;
    }

    if (!fircIrm) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo,
        consignee: consigneeName,
        reason: 'EXCLUDED UNDER RULE: No valid FIRC / IRM remittance record linked to this invoice.',
      });
      continue;
    }

    const invoiceUsd = parseFloat(String(row['Invoice Value (USD)'] || row['Invoice Value'] || '').replace(/,/g, ''));
    if (!Number.isFinite(invoiceUsd) || invoiceUsd <= 0) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo,
        consignee: consigneeName,
        reason: 'Invoice Value (USD) must be a positive number.',
      });
      continue;
    }

    const invDate = parseExcelDate(row['Invoice Date'] || row['Date']);
    const sbDate = parseExcelDate(row['Shipping Bill Date'] || row['SB Date']) || invDate;
    if (!invDate || !sbDate) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo,
        consignee: consigneeName,
        reason: 'Valid Invoice Date and Shipping Bill Date are required.',
      });
      continue;
    }

    const rate = parseFloat(String(row['SB Exchange Rate'] || row['Exchange Rate'] || row['Rate'] || '').replace(/,/g, ''));
    if (!Number.isFinite(rate) || rate <= 0) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo,
        consignee: consigneeName,
        reason: 'Positive SB Exchange Rate is required.',
      });
      continue;
    }

    const normalizedKey = normalizeInvoiceKey(invoiceNo);
    const existing = await shipmentsService.getShipmentByNormalizedKey(normalizedKey, targetFinancialYearId);
    if (existing) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo,
        consignee: consigneeName,
        reason: `DUPLICATE DETECTED: Normalized key '${normalizedKey}' already exists in database.`,
      });
      continue;
    }

    const sbNo = String(row['Shipping Bill No.'] || row['Shipping Bill No'] || row['SB No'] || '').trim();
    if (!sbNo) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo,
        consignee: consigneeName,
        reason: 'Shipping Bill No is missing or empty.',
      });
      continue;
    }

    const parsedFob = parseFloat(String(row['FOB Value (INR)'] || row['FOB INR'] || '').replace(/,/g, ''));
    const fobInr = Number.isFinite(parsedFob) && parsedFob > 0 ? round2(parsedFob) : round2(dMul(invoiceUsd, rate));
    const bankNameRaw = String(row['Bank'] || row['Bank Name'] || '').trim();

    try {
      const createdShipment = await withTransaction(async (tx) => {
        const consignee = await mastersService.resolveOrCreateConsignee(
          {
            consigneeName,
          },
          tx
        );

        let payment = await paymentsService.findByIrmNumber(fircIrm, tx);
        if (!payment) {
          if (!bankNameRaw) {
            throw new Error(`Bank name is required to create new FIRC payment '${fircIrm}'.`);
          }
          const resolvedBankId = await mastersService.resolveBankId(undefined, bankNameRaw, tx);
          payment = await paymentsService.createPayment(
            {
              irmNumber: fircIrm,
              senderReference: String(row['Sender Reference'] || '').trim() || undefined,
              verifiedAmount: round2(invoiceUsd),
              inrAmount: fobInr,
              exchangeRate: rate,
              valueDate: invDate,
              creditDate: invDate,
              bankId: resolvedBankId,
              purposeCode: String(row['Purpose Code'] || 'P0103').trim() || 'P0103',
              remarks: `Migrated from Excel historical file for ${invoiceNo}`,
            },
            tx
          );
        }

        const shipment = await shipmentsService.createShipmentWithTx(
          tx,
          {
            financialYearId: targetFinancialYearId,
            invoiceNumber: invoiceNo,
            invoiceDate: invDate,
            consigneeId: consignee.id,
            portCode: String(row['Port Code'] || row['Destination Port'] || row['Port'] || 'INMAA1').trim().toUpperCase(),
            packageCount: parseInt(String(row['No. of Pkgs'] || row['Package Count'] || '0'), 10) || 0,
            invoiceValueUsd: round2(invoiceUsd),
            shippingBillNumber: sbNo,
            shippingBillDate: sbDate,
            sbExchangeRate: rate,
            fobValueInr: fobInr,
            blNumber: String(row['BL / Transport Doc No.'] || row['BL No'] || '').trim() || undefined,
            vesselName: String(row['Vessel Name'] || '').trim() || undefined,
            remarks: String(row['Remarks'] || 'Historical migration').trim(),
            initialFircPaymentId: payment.id,
            initialFircAllocationAmount: round2(invoiceUsd),
            reviewStatus: 'CONFIRMED',
            incentives: {
              dbkClaimed: parseFloat(String(row['DBK Claimed (INR)'] || row['Drawback Amt (INR)'] || '0').replace(/,/g, '')) || 0,
              rodtepClaimed: parseFloat(String(row['RoDTEP Claimed (INR)'] || row['RoDTEP Amt (INR)'] || '0').replace(/,/g, '')) || 0,
              rosctlClaimed: parseFloat(String(row['RoSCTL Claimed (INR)'] || row['RoSCTL Amt (INR)'] || '0').replace(/,/g, '')) || 0,
            },
            brc: {
              uploadMode: 'SINGLE',
              statutoryDeadline: parseExcelDate(row['BRC Deadline']) || undefined,
              remarks: String(row['BRC Remarks'] || '').trim(),
            },
          },
          actorUserId
        );

        const brcNo = String(row['BRC Number'] || row['BRC No'] || '').trim();
        if (brcNo) {
          await brcService.updateBrcRecord(
            shipment.id,
            {
              brcNumber: brcNo,
              issueDate: parseExcelDate(row['BRC Issue Date'] || row['BRC Date']) || undefined,
              realisationDate: parseExcelDate(row['Bank Realisation Date']) || undefined,
              realisedAmount: round2(invoiceUsd),
              realisedCurrency: 'USD',
              status: 'ISSUED',
            },
            tx
          );
        }

        return shipment;
      });

      report.acceptedRows++;
      report.importedShipmentIds.push(createdShipment.id);
    } catch (err: any) {
      report.rejectedRows++;
      report.rejectionLog.push({
        rowNumber: rowNum,
        invoiceNo,
        consignee: consigneeName,
        reason: err.message,
      });
    }
  }

  return report;
}

export function generateGstExcelExport(entries: GstEntry[], summary: GstSummary): Buffer {
  const wb = XLSX.utils.book_new();

  const rows = entries.map((e, idx) => ({
    'S.No': idx + 1,
    'Entry ID': e.id,
    'Entry Date': e.entryDate,
    'Consignee Name': e.consigneeName,
    'IGST (INR)': Number(e.igst.toFixed(2)),
    'CGST (INR)': Number(e.cgst.toFixed(2)),
    'SGST (INR)': Number(e.sgst.toFixed(2)),
    'Total GST (INR)': Number(e.totalGst.toFixed(2)),
    'Refund Eligible (INR)': Number(e.refundEligible.toFixed(2)),
    'Difference (INR)': Number(e.difference.toFixed(2)),
    Result: e.result,
    Remarks: e.remarks || '—',
  }));

  rows.push({
    'S.No': '' as any,
    'Entry ID': 'TOTAL',
    'Entry Date': `${summary.totalEntries} Entries`,
    'Consignee Name': '',
    'IGST (INR)': summary.totalIgst,
    'CGST (INR)': summary.totalCgst,
    'SGST (INR)': summary.totalSgst,
    'Total GST (INR)': summary.totalGst,
    'Refund Eligible (INR)': summary.totalRefundEligible,
    'Difference (INR)': summary.netDifference,
    Result: (summary.netDifference > 0 ? 'GAIN' : summary.netDifference < 0 ? 'LOSS' : 'NIL') as any,
    Remarks: `Gain: ${summary.gainCount} | Loss: ${summary.lossCount} | Nil: ${summary.nilCount}`,
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 16 }, { wch: 12 }, { wch: 38 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 45 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'GST Entries');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
