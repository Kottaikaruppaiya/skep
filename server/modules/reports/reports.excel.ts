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

export function buildExportWorkbookBuffer(input: {
  shipments: Shipment[];
  consignees: ConsigneeMaster[];
  banks: BankMaster[];
  payments: Payment[];
  metrics: DashboardMetrics;
}): Buffer {
  const { shipments, consignees, banks, payments, metrics } = input;
  const wb = XLSX.utils.book_new();

  // 1. Export Tracker Sheet (Exact 31 Columns A through AE matching workbook specification)
  const trackerData = shipments.map((s, idx) => {
    const dbk = s.incentives?.find((i) => i.type === 'DRAWBACK');
    const rodtep = s.incentives?.find((i) => i.type === 'RODTEP');
    const rosctl = s.incentives?.find((i) => i.type === 'ROSCTL');
    const alloc = s.allocations?.[0];
    const payment = alloc ? payments.find((p) => p.id === alloc.paymentId) : undefined;
    const brc = s.brcRecord;

    const usdReceived = Number(s.totalPaidUsd || 0);
    const inrReceived = Number(s.realisedInr || 0);
    const fobInr = Number(s.fobValueInr || 0);
    const diffUsd = Number(s.invoiceValueUsd || 0) - usdReceived;
    const forexVarianceInr = inrReceived > 0 ? inrReceived - fobInr : 0;
    const gainLossTag = inrReceived === 0 ? 'NIL' : forexVarianceInr > 0 ? 'GAIN' : forexVarianceInr < 0 ? 'LOSS' : 'NIL';

    return {
      'S.No': idx + 1,
      'Invoice No': s.invoiceNumber,
      'Invoice Date': s.invoiceDate,
      'Shipping Bill No': s.shippingBillNumber,
      'Shipping Bill Date': s.shippingBillDate,
      'Port Code': s.portCode,
      'Consignee Name': s.consigneeName,
      'No. of Pkgs': s.packageCount || 0,
      'Invoice Value (USD)': s.invoiceValueUsd,
      'FOB Value (INR)': s.fobValueInr,
      'Exchange Rate': s.sbExchangeRate,
      'Drawback Amt (INR)': dbk?.claimedAmount || 0,
      'Drawback Recd': dbk?.status || 'PENDING',
      'Drawback Received Date': dbk?.receivedDate || '',
      'RoDTEP Amt (INR)': rodtep?.claimedAmount || 0,
      'RoDTEP Recd': rodtep?.status || 'PENDING',
      'RoSCTL Amt (INR)': rosctl?.claimedAmount || 0,
      'RoSCTL Recd': rosctl?.status || 'PENDING',
      'Payment Received Date': payment?.creditDate || alloc?.allocatedAt?.split('T')[0] || '',
      'Amount Received (USD)': usdReceived,
      'Amount Received (INR)': inrReceived,
      'Exchange Rate Received': payment?.exchangeRate || s.averageRealisedRate || 0,
      'Bank': payment?.bankName || '',
      'Bank Inward Remittance No. (IRM)': payment?.irmNumber || alloc?.paymentIrm || '',
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

    return targetShipments.map((s, idx) => ({
      'S.No': idx + 1,
      'Invoice No': s.invoiceNumber,
      'Invoice Date': s.invoiceDate,
      'Shipping Bill No': s.shippingBillNumber,
      'Shipping Bill Date': s.shippingBillDate,
      'Port Code': s.portCode,
      'No. of Pkgs': s.packageCount || 0,
      'Invoice Value (USD)': s.invoiceValueUsd,
      'FOB Value (INR)': s.fobValueInr,
      'FIRC / IRM No.': s.allocations?.[0]?.paymentIrm || '',
      'Payment Received Date': s.allocations?.[0]?.allocatedAt?.split('T')[0] || '',
      'Amount Received (USD)': s.totalPaidUsd || 0,
      'Difference (USD)': s.balanceDueUsd || 0,
      'Exchange Rate Received': s.averageRealisedRate || 0,
      'Amount Received (INR)': s.realisedInr || 0,
      'BRC Number': s.brcRecord?.brcNumber || '',
      'BRC Status': s.brcRecord?.status || 'PENDING',
      'Payment Status': s.paymentStatus,
      'Remarks': s.remarks || '',
    }));
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
    const totalInvoicedUsd = cShipments.reduce((sum, s) => sum + s.invoiceValueUsd, 0);
    const totalFobInr = cShipments.reduce((sum, s) => sum + s.fobValueInr, 0);
    const totalPaidUsd = cShipments.reduce((sum, s) => sum + (s.totalPaidUsd || 0), 0);
    const totalRealisedInr = cShipments.reduce((sum, s) => sum + (s.realisedInr || 0), 0);
    const totalPkgs = cShipments.reduce((sum, s) => sum + (s.packageCount || 0), 0);
    const avgRate = totalInvoicedUsd > 0 ? totalFobInr / totalInvoicedUsd : 0;
    const outstandingUsd = Math.max(0, totalInvoicedUsd - totalPaidUsd);

    let dbkClaimed = 0;
    let dbkRecd = 0;
    let rodtepClaimed = 0;
    let rodtepRecd = 0;
    let rosctlClaimed = 0;
    let rosctlRecd = 0;

    for (const s of cShipments) {
      for (const inc of s.incentives || []) {
        if (inc.type === 'DRAWBACK') {
          dbkClaimed += inc.claimedAmount;
          dbkRecd += inc.receivedAmount;
        } else if (inc.type === 'RODTEP') {
          rodtepClaimed += inc.claimedAmount;
          rodtepRecd += inc.receivedAmount;
        } else if (inc.type === 'ROSCTL') {
          rosctlClaimed += inc.claimedAmount;
          rosctlRecd += inc.receivedAmount;
        }
      }
    }

    const dbkPending = Math.max(0, dbkClaimed - dbkRecd);
    const rodtepPending = Math.max(0, rodtepClaimed - rodtepRecd);
    const rosctlPending = Math.max(0, rosctlClaimed - rosctlRecd);
    const totalIncentivesPending = dbkPending + rodtepPending + rosctlPending;
    const netForexInr = totalRealisedInr > 0 ? totalRealisedInr - totalFobInr : 0;

    return {
      Consignee: c.name,
      'No. of Invoices': cShipments.length,
      'No. of Pkgs': totalPkgs,
      'Invoice Value USD': totalInvoicedUsd,
      'FOB Value INR': totalFobInr,
      'Avg Exchange Rate': avgRate > 0 ? Math.round(avgRate * 100) / 100 : 0,
      'Received USD': totalPaidUsd,
      'Outstanding USD': outstandingUsd,
      'Drawback Claimed INR': dbkClaimed,
      'Drawback Pending INR': dbkPending,
      'RoDTEP Claimed INR': rodtepClaimed,
      'RoDTEP Pending INR': rodtepPending,
      'RoSCTL Claimed INR': rosctlClaimed,
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
        'Remittance USD': p.verifiedAmount,
        'Allocated USD': p.totalAllocatedUsd || 0,
        'Available Balance USD': p.availableBalanceUsd || 0,
        'Exchange Rate': p.exchangeRate || 0,
        'INR Amount': p.inrAmount || 0,
        'Credit Date': p.creditDate,
        'Value Date': p.valueDate,
        Bank: p.bankName || '',
        'Purpose Code': p.purposeCode || '',
      }))
    ),
    'Inward Remittances'
  );

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function extractCsvSheetFromWorkbook(wbBuffer: Buffer, sheetName: string): string {
  const wb = XLSX.read(wbBuffer, { type: 'buffer' });
  const targetSheet = wb.SheetNames.find((s) => s.toLowerCase().includes(sheetName.toLowerCase())) || wb.SheetNames[0];
  const sheet = wb.Sheets[targetSheet];
  return XLSX.utils.sheet_to_csv(sheet);
}

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const parts = str.replace(/[\/\.]/g, '-').split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
}

export async function parseHistoricalExcelMigration(
  fileBuffer: Buffer,
  targetFinancialYearId: string,
  actorUserId: string
): Promise<ImportValidationReport> {
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  const rawText = fileBuffer.toString('utf-8');

  const report: ImportValidationReport = {
    totalRowsRead: 0,
    acceptedRows: 0,
    rejectedRows: 0,
    warningsCount: 0,
    rejectionLog: [],
    warnings: [],
    importedShipmentIds: [],
  };

  if (rawText.includes('BANK MASTER') || rawText.includes('Bank (receiving export proceeds)')) {
    report.importType = 'BANK_MASTER';
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const existingBanks = await mastersService.listBanks();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('BANK MASTER') || line.includes('Bank (receiving export proceeds)')) continue;
      const parts = line.split(',').map((p) => p.trim());
      const bankName = parts[0];
      if (!bankName) continue;

      report.totalRowsRead++;
      const exists = existingBanks.some((b) => b.name.toLowerCase() === bankName.toLowerCase());
      if (exists) {
        report.warnings.push({
          rowNumber: i + 1,
          invoiceNo: bankName,
          message: `Bank '${bankName}' already exists in Bank Master (preserved).`,
        });
        report.acceptedRows++;
      } else {
        try {
          const created = await mastersService.createBank({
            name: bankName,
            branch: 'Chennai Branch',
            adCode: '6690005',
            ifscCode: bankName.toLowerCase().includes('dbs')
              ? 'DBSS0IN0811'
              : bankName.toLowerCase().includes('hdfc')
                ? 'HDFC0000166'
                : 'BANK0001234',
            swiftCode: '',
            accountNumber: '',
            isActive: true,
          });
          existingBanks.push(created);
          report.acceptedRows++;
          report.warnings.push({
            rowNumber: i + 1,
            invoiceNo: bankName,
            message: `Created new Bank Master entry for '${bankName}'.`,
          });
        } catch (e: any) {
          report.rejectedRows++;
          report.rejectionLog.push({
            rowNumber: i + 1,
            invoiceNo: bankName,
            consignee: 'Bank Master',
            reason: e.message,
          });
        }
      }
    }
    return report;
  }

  if (rawText.includes('CONSIGNEE MASTER') || (rawText.includes('Country') && rawText.includes('Port of Discharge'))) {
    report.importType = 'CONSIGNEE_MASTER';
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    report.totalRowsRead = rows.length;
    const existingConsignees = await mastersService.listConsignees();

    for (const row of rows) {
      const name = String(row['Name'] || row['Consignee Name'] || row['CONSIGNEE'] || '').trim();
      if (!name) continue;

      const existing = existingConsignees.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        const created = await mastersService.createConsignee({
          name,
          country: String(row['Country'] || 'International').trim(),
          portOfDischarge: String(row['Port of Discharge'] || row['Port'] || '').trim(),
          paymentTerms: String(row['Payment Terms'] || 'FOB COLOMBO | DA 90 DAYS').trim(),
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

  const banks = await mastersService.listBanks();
  const defaultBank = banks[0];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2;
    const invoiceNo = String(row['Invoice No.'] || row['Invoice No'] || row['INVOICE NO'] || '').trim();
    const consigneeName = String(row['Consignee Name'] || row['Consignee'] || row['BUYER'] || '').trim();
    const fircIrm = String(
      row['FIRC / IRM No.'] || row['FIRC No.'] || row['IRM Number'] || row['FIRC'] || row['IRM'] || ''
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

    const invoiceUsd =
      parseFloat(String(row['Invoice Value (USD)'] || row['Invoice Value'] || '0').replace(/,/g, '')) || 1000;
    const sbNo = String(row['Shipping Bill No.'] || row['SB No'] || `SB-${invoiceNo}`).trim();
    const sbDate = parseExcelDate(row['Shipping Bill Date'] || row['SB Date']) || '2026-04-07';
    const invDate = parseExcelDate(row['Invoice Date'] || row['Date']) || '2026-04-06';
    const rate = parseFloat(String(row['SB Exchange Rate'] || row['Rate'] || '92.10')) || 92.1;
    const fobInr =
      parseFloat(String(row['FOB Value (INR)'] || row['FOB INR'] || '0').replace(/,/g, '')) || invoiceUsd * rate;

    try {
      const createdShipment = await withTransaction(async (tx) => {
        const consignee = await mastersService.resolveOrCreateConsignee(
          {
            consigneeName: consigneeName || `Consignee ${invoiceNo}`,
          },
          tx
        );

        let payment = await paymentsService.findByIrmNumber(fircIrm, tx);
        if (!payment) {
          payment = await paymentsService.createPayment(
            {
              irmNumber: fircIrm,
              senderReference: String(row['Sender Reference'] || '').trim() || undefined,
              verifiedAmount: invoiceUsd,
              inrAmount: fobInr,
              exchangeRate: rate,
              valueDate: invDate,
              creditDate: invDate,
              bankId: defaultBank?.id || (await mastersService.resolveBankId(undefined, undefined, tx)),
              purposeCode: 'P0103',
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
            portCode: String(row['Destination Port'] || row['Port'] || 'INMAA1').trim().toUpperCase(),
            packageCount: parseInt(String(row['Package Count'] || '0'), 10) || 0,
            invoiceValueUsd: invoiceUsd,
            shippingBillNumber: sbNo,
            shippingBillDate: sbDate,
            sbExchangeRate: rate,
            fobValueInr: fobInr,
            blNumber: String(row['BL / Transport Doc No.'] || row['BL No'] || '').trim() || undefined,
            vesselName: String(row['Vessel Name'] || '').trim() || undefined,
            remarks: String(row['Remarks'] || 'Historical migration').trim(),
            initialFircPaymentId: payment.id,
            initialFircAllocationAmount: invoiceUsd,
            reviewStatus: 'CONFIRMED',
            incentives: {
              dbkClaimed: parseFloat(String(row['DBK Claimed (INR)'] || '0').replace(/,/g, '')) || 0,
              rodtepClaimed: parseFloat(String(row['RoDTEP Claimed (INR)'] || '0').replace(/,/g, '')) || 0,
              rosctlClaimed: parseFloat(String(row['RoSCTL Claimed (INR)'] || '0').replace(/,/g, '')) || 0,
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
              issueDate: parseExcelDate(row['BRC Issue Date']) || undefined,
              realisationDate: parseExcelDate(row['Bank Realisation Date']) || undefined,
              realisedAmount: invoiceUsd,
              realisedCurrency: 'USD',
              status: 'REALISED',
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
