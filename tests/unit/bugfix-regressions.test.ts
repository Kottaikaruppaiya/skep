/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import { isValidGstin, normalizeGstin } from '../../server/shared/utils/gstin.ts';
import { deriveBrcStatus } from '../../server/modules/brc/brc.calculator.ts';
import { deriveIncentiveStatus } from '../../server/modules/incentives/incentive.calculator.ts';
import {
  buildB2bDashboardMetrics,
  calculateB2bInvoiceTaxTotals,
} from '../../server/modules/b2b/b2b.calculator.ts';
import { previewB2bWorkbook } from '../../server/modules/b2b/b2b.excel.ts';
import {
  buildExportWorkbookBuffer,
  parseHistoricalExcelMigration,
} from '../../server/modules/reports/reports.excel.ts';
import { ValidationError } from '../../server/shared/errors/app-error.ts';
import type {
  BankMaster,
  ConsigneeMaster,
  DashboardMetrics,
  Payment,
  Shipment,
} from '../../src/types/index.ts';

test('GSTIN validator enforces complete 15-character structure (not length-only)', () => {
  assert.equal(normalizeGstin(' 33aaach2748p1zp '), '33AAACH2748P1ZP');
  assert.equal(isValidGstin('33AAACH2748P1ZP'), true);
  assert.equal(isValidGstin('27AAACP0124M1Z8'), true);

  // 15 chars but invalid GSTIN structure must fail
  assert.equal(isValidGstin('123456789012345'), false);
  assert.equal(isValidGstin('33AAACH2748P1A8'), false); // missing 'Z' at position 14
  assert.equal(isValidGstin('33AAACH2748P0Z8'), false); // 0 entity number invalid
  assert.equal(isValidGstin('SHORT'), false);
});

test('deriveBrcStatus marks both PENDING and ISSUED past deadline as OVERDUE without auto-REALISED', () => {
  const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  assert.equal(deriveBrcStatus('PENDING', yesterday), 'OVERDUE');
  assert.equal(deriveBrcStatus('ISSUED', yesterday), 'OVERDUE');
  assert.equal(deriveBrcStatus('ISSUED', nextMonth), 'ISSUED');
  assert.equal(deriveBrcStatus('REALISED', yesterday), 'REALISED');
});

test('deriveIncentiveStatus rejects negative amounts and received > claimed', () => {
  assert.throws(
    () => deriveIncentiveStatus(1000, -5),
    (err: unknown) => err instanceof ValidationError
  );
  assert.throws(
    () => deriveIncentiveStatus(1000, 1000.5),
    (err: unknown) => err instanceof ValidationError
  );

  assert.equal(deriveIncentiveStatus(1000, 0), 'PENDING');
  assert.equal(deriveIncentiveStatus(1000, 400), 'PART_RECEIVED');
  assert.equal(deriveIncentiveStatus(1000, 1000), 'RECEIVED');
});

test('calculateB2bInvoiceTaxTotals preserves explicit 0 invoiceValue and computes decimal sums accurately', () => {
  const zeroInv = calculateB2bInvoiceTaxTotals({
    taxableValue: 100,
    integratedTax: 18,
    invoiceValue: 0,
  });
  assert.equal(zeroInv.invoiceValue, 0);
  assert.equal(zeroInv.totalGst, 18);

  const computed = calculateB2bInvoiceTaxTotals({
    taxableValue: 100.1,
    integratedTax: 0,
    centralTax: 9.01,
    stateUtTax: 9.01,
    cess: 0.05,
  });
  assert.equal(computed.totalGst, 18.07);
  assert.equal(computed.invoiceValue, 118.17);
});

test('previewB2bWorkbook rejects malformed GSTIN, invalid numbers, invalid flags, and preserves optional blanks', () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    [
      'GSTIN of supplier',
      'Trade/Legal name',
      'Invoice number',
      'Invoice type',
      'Invoice date',
      'Invoice value',
      'Place of supply',
      'Reverse charge',
      'Taxable value',
      'Integrated Tax',
      'Central Tax',
      'State/UT Tax',
      'Cess',
      'GSTR period',
      'ITC availability',
      'Applicable % of tax rate',
      'Source',
    ],
    [
      // Valid row with blank optional taxRate, source, POS
      '33AAACH2748P1ZP',
      'Kothari Mills',
      'INV-VALID-1',
      'Regular',
      '14-08-2026',
      1180,
      '',
      'N',
      1000,
      180,
      0,
      0,
      0,
      '082026',
      'Yes',
      '',
      '',
    ],
    [
      // Invalid 15-char GSTIN
      'INVALID12345678',
      'Bad GSTIN Corp',
      'INV-BAD-GSTIN',
      'Regular',
      '14-08-2026',
      1180,
      '',
      'N',
      1000,
      180,
      0,
      0,
      0,
      '082026',
      'Yes',
      '',
      '',
    ],
    [
      // Non-numeric taxable value
      '27AAACP0124M1Z8',
      'Bad Number Corp',
      'INV-BAD-NUM',
      'Regular',
      '14-08-2026',
      1180,
      '',
      'N',
      'NOT_A_NUM',
      180,
      0,
      0,
      0,
      '082026',
      'Yes',
      '',
      '',
    ],
    [
      // Invalid RCM flag
      '27AAACP0124M1Z8',
      'Bad Flag Corp',
      'INV-BAD-RCM',
      'Regular',
      '14-08-2026',
      1180,
      '',
      'MAYBE',
      1000,
      180,
      0,
      0,
      0,
      '082026',
      'Yes',
      '',
      '',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'B2B');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const preview = previewB2bWorkbook(buf, 'strict-check.xlsx', [], []);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.invalidRows, 3);
  assert.equal(preview.errors.length, 3);

  const validDraft = preview.allParsedRecords?.[0];
  assert.ok(validDraft);
  assert.equal(validDraft.applicableTaxRate, undefined);
  assert.equal(validDraft.source, undefined);
  assert.equal(validDraft.placeOfSupply, undefined);
});

test('buildB2bDashboardMetrics aggregates invoice totals using decimal arithmetic', () => {
  const now = new Date().toISOString();
  const makeInv = (id: string, taxable: number, igst: number) => ({
    id,
    supplierId: 'sup-1',
    supplierGstin: '33AAACH2748P1ZP',
    supplierName: 'Kothari',
    invoiceNumber: id,
    invoiceType: 'Regular',
    invoiceDate: '2026-08-01',
    invoiceValue: Number((taxable + igst).toFixed(2)),
    reverseCharge: 'N' as const,
    taxableValue: taxable,
    integratedTax: igst,
    centralTax: 0,
    stateUtTax: 0,
    cess: 0,
    totalGst: igst,
    gstrPeriod: 'August 2026',
    periodKey: '2026-08',
    financialYear: '2026-27',
    itcAvailability: 'Yes' as const,
    createdAt: now,
    updatedAt: now,
  });

  const metrics = buildB2bDashboardMetrics([makeInv('i1', 0.1, 0.02), makeInv('i2', 0.2, 0.04)], '2026-27');
  assert.equal(metrics.totalTaxableValue, 0.3);
  assert.equal(metrics.totalIgst, 0.06);
  assert.equal(metrics.totalGst, 0.06);
  assert.equal(metrics.totalInvoiceValue, 0.36);
});

test('buildExportWorkbookBuffer exports all payment allocations, distinct banks/IRMs, and Allocation Tranches sheet', () => {
  const now = new Date().toISOString();
  const banks: BankMaster[] = [
    { id: 'b-hdfc', name: 'HDFC BANK LIMITED', branch: 'Tiruppur', adCode: '051', ifscCode: 'HDFC0001', swiftCode: 'HDFCINBB', accountNumber: '111', isActive: true, createdAt: now, updatedAt: now },
    { id: 'b-icici', name: 'ICICI BANK LIMITED', branch: 'Chennai', adCode: '052', ifscCode: 'ICIC0001', swiftCode: 'ICICINBB', accountNumber: '222', isActive: true, createdAt: now, updatedAt: now },
  ];
  const consignees: ConsigneeMaster[] = [
    { id: 'c1', name: 'S K GLOBAL VENTURES PRIVATE LIMITED', country: 'Sri Lanka', portOfDischarge: 'LKCMB', paymentTerms: 'DA', currency: 'USD', isActive: true, createdAt: now, updatedAt: now },
  ];
  const payments: Payment[] = [
    { id: 'p1', irmNumber: 'IRM-ONE', currency: 'USD', verifiedAmount: 1000, inrAmount: 85000, exchangeRate: 85, valueDate: '2026-08-10', creditDate: '2026-08-11', bankId: 'b-hdfc', bankName: 'HDFC BANK LIMITED', purposeCode: 'P0103', totalAllocatedUsd: 600, availableBalanceUsd: 400, createdAt: now, updatedAt: now },
    { id: 'p2', irmNumber: 'IRM-TWO', currency: 'USD', verifiedAmount: 1000, inrAmount: 86000, exchangeRate: 86, valueDate: '2026-08-15', creditDate: '2026-08-16', bankId: 'b-icici', bankName: 'ICICI BANK LIMITED', purposeCode: 'P0103', totalAllocatedUsd: 400, availableBalanceUsd: 600, createdAt: now, updatedAt: now },
  ];
  const shipments: Shipment[] = [
    {
      id: 's1',
      financialYearId: 'fy-2026-27',
      invoiceNumber: 'SKE/26-27/101',
      normalizedInvoiceKey: 'SKE-26-27-101',
      invoiceDate: '2026-08-01',
      consigneeId: 'c1',
      consigneeName: 'S K GLOBAL VENTURES PRIVATE LIMITED',
      portCode: 'INMAA1',
      packageCount: 10,
      invoiceValueUsd: 1000,
      shippingBillNumber: 'SB101',
      shippingBillDate: '2026-08-02',
      sbExchangeRate: 84,
      fobValueInr: 84000,
      reviewStatus: 'CONFIRMED',
      isArchived: false,
      totalPaidUsd: 1000,
      balanceDueUsd: 0,
      paymentStatus: 'FULLY_PAID',
      realisedInr: 85400,
      averageRealisedRate: 85.4,
      allocations: [
        { id: 'a1', paymentId: 'p1', shipmentId: 's1', allocatedAmountUsd: 600, allocatedAt: now, allocatedByUserId: 'u1', paymentIrm: 'IRM-ONE', paymentCreditDate: '2026-08-11', paymentBankName: 'HDFC BANK LIMITED', paymentExchangeRate: 85 },
        { id: 'a2', paymentId: 'p2', shipmentId: 's1', allocatedAmountUsd: 400, allocatedAt: now, allocatedByUserId: 'u1', paymentIrm: 'IRM-TWO', paymentCreditDate: '2026-08-16', paymentBankName: 'ICICI BANK LIMITED', paymentExchangeRate: 86 },
      ],
      incentives: [],
      documents: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
  const metrics: DashboardMetrics = {
    totalShipments: 1,
    totalInvoiceValueUsd: 1000,
    totalRealisedUsd: 1000,
    totalOutstandingUsd: 0,
    fullyPaidCount: 1,
    partPaidCount: 0,
    unpaidCount: 0,
    excessCount: 0,
    brcRealisedCount: 0,
    brcPendingCount: 1,
    brcOverdueCount: 0,
    incentivesClaimedInr: 0,
    incentivesReceivedInr: 0,
    incentivesPendingInr: 0,
    pendingReviewCount: 0,
  };

  const buffer = buildExportWorkbookBuffer({ shipments, consignees, banks, payments, metrics });
  const wb = XLSX.read(buffer, { type: 'buffer' });
  assert.ok(wb.SheetNames.includes('Export Tracker'));
  assert.ok(wb.SheetNames.includes('Allocation Tranches'));

  const trackerRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Export Tracker']);
  assert.equal(trackerRows.length, 1);
  assert.match(String(trackerRows[0]['Bank Inward Remittance No. (IRM)']), /IRM-ONE.*IRM-TWO|IRM-TWO.*IRM-ONE/);
  assert.match(String(trackerRows[0]['Bank']), /HDFC BANK LIMITED.*ICICI BANK LIMITED/);
  assert.match(String(trackerRows[0]['Payment Received Date']), /2026-08-11.*2026-08-16/);

  const trancheRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Allocation Tranches']);
  assert.equal(trancheRows.length, 2);
  assert.equal(trancheRows[0]['Allocated INR'], 51000);
  assert.equal(trancheRows[1]['Allocated INR'], 34400);
});

test('parseHistoricalExcelMigration rejects rows missing FIRC, consignee, or positive exchange rate without fabricating defaults', async () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    {
      'Invoice No': 'INV-NO-FIRC',
      'Invoice Date': '2026-08-01',
      'Shipping Bill No': 'SB-1',
      'Shipping Bill Date': '2026-08-02',
      'Consignee Name': 'Some Buyer',
      'Invoice Value (USD)': 5000,
      'SB Exchange Rate': 85,
      'FIRC / IRM No.': '',
    },
    {
      'Invoice No': 'INV-NO-RATE',
      'Invoice Date': '2026-08-01',
      'Shipping Bill No': 'SB-2',
      'Shipping Bill Date': '2026-08-02',
      'Consignee Name': 'Some Buyer',
      'Invoice Value (USD)': 5000,
      'SB Exchange Rate': '',
      'FIRC / IRM No.': 'IRM-123',
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Export Tracker');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const report = await parseHistoricalExcelMigration(buf, 'fy-2026-27', 'u-super-admin');
  assert.equal(report.totalRowsRead, 2);
  assert.equal(report.acceptedRows, 0);
  assert.equal(report.rejectedRows, 2);
  assert.match(report.rejectionLog[0].reason, /FIRC/i);
  assert.match(report.rejectionLog[1].reason, /Exchange Rate/i);
});
