/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import { normalizeInvoiceKey, normalizePortCode } from '../../server/shared/utils/normalizer.ts';
import { normalizeInvoiceKey as clientNormalizeInvoiceKey } from '../../src/shared/utils/normalizer.ts';
import { dAdd, dDiv, dMul, dSub, round2, round4 } from '../../server/shared/utils/decimal.ts';
import { getMonthsForFinancialYear, normalizeGstrPeriod } from '../../server/shared/utils/gstr-period.ts';
import { hashPassword, needsPasswordRehash, verifyPassword } from '../../server/shared/utils/password.ts';
import { calculateGstSummary, computeGstEntryMetrics } from '../../server/modules/gst/gst.calculator.ts';
import {
  buildB2bMonthlySummaries,
  calculateB2bInvoiceTaxTotals,
} from '../../server/modules/b2b/b2b.calculator.ts';
import { previewB2bWorkbook } from '../../server/modules/b2b/b2b.excel.ts';
import type { B2bInvoice, GstEntry } from '../../src/types/index.ts';

test('normalizer handles invoice keys and port codes deterministically and matches client normalizer', () => {
  const samples = ['SKE/26-27/20', 'ske_2026_2027_005', 'INV/PI/26-27/7', 'EXP/5', ''];
  assert.equal(normalizeInvoiceKey('SKE/26-27/20'), 'SKE-26-27-020');
  assert.equal(normalizeInvoiceKey('ske_2026_2027_005'), 'SKE-26-27-005');
  assert.equal(normalizeInvoiceKey('INV/PI/26-27/7'), 'INV-26-27-007');
  assert.equal(normalizeInvoiceKey(''), '');
  for (const sample of samples) {
    assert.equal(clientNormalizeInvoiceKey(sample), normalizeInvoiceKey(sample));
  }
  assert.equal(normalizePortCode(' inmaa1 '), 'INMAA1');
  assert.equal(normalizePortCode(undefined), 'INNSA1');
});

test('decimal utilities avoid IEEE-754 floating-point drift', () => {
  assert.equal(dAdd(0.1, 0.2), 0.3);
  assert.equal(dSub(100.1, 0.05), 100.05);
  assert.equal(dMul(19.99, 3), 59.97);
  assert.equal(dDiv(100, 3, 4), 33.3333);
  assert.equal(dDiv(100, 0, 2), 0);
  assert.equal(round2(12.345), 12.35);
  assert.equal(round4(12.34565), 12.3457);
});

test('gstr-period normalizer parses multiple GSTR-2B formats and maps FY months', () => {
  const aug = normalizeGstrPeriod('082026');
  assert.ok(aug);
  assert.equal(aug.periodKey, '2026-08');
  assert.equal(aug.displayPeriod, 'August 2026');
  assert.equal(aug.financialYear, '2026-27');

  const feb = normalizeGstrPeriod('Feb 2027');
  assert.ok(feb);
  assert.equal(feb.periodKey, '2027-02');
  assert.equal(feb.financialYear, '2026-27');

  const iso = normalizeGstrPeriod('2026-04');
  assert.ok(iso);
  assert.equal(iso.displayPeriod, 'April 2026');
  assert.equal(iso.financialYear, '2026-27');

  assert.equal(normalizeGstrPeriod('invalid-month'), null);

  const months = getMonthsForFinancialYear('2026-27');
  assert.equal(months.length, 12);
  assert.equal(months[0].periodKey, '2026-04');
  assert.equal(months[11].periodKey, '2027-03');
});

test('password hashing uses salted PBKDF2-SHA512 and verifies accurately', () => {
  const hash1 = hashPassword('StrongExport!2026');
  const hash2 = hashPassword('StrongExport!2026');
  assert.notEqual(hash1, hash2);
  assert.equal(verifyPassword('StrongExport!2026', hash1), true);
  assert.equal(verifyPassword('WrongPassword', hash1), false);
  assert.equal(needsPasswordRehash(hash1), false);
  assert.equal(needsPasswordRehash('a'.repeat(128)), true);
});

test('GST calculator computes GAIN, LOSS, NIL and summary rollups accurately', () => {
  const gain = computeGstEntryMetrics({ igst: 1000, cgst: 500, sgst: 500, refundEligible: 2500 });
  assert.equal(gain.totalGst, 2000);
  assert.equal(gain.difference, 500);
  assert.equal(gain.result, 'GAIN');

  const loss = computeGstEntryMetrics({ igst: 3000, cgst: 0, sgst: 0, refundEligible: 2200 });
  assert.equal(loss.difference, -800);
  assert.equal(loss.result, 'LOSS');

  const nil = computeGstEntryMetrics({ igst: 0, cgst: 600, sgst: 600, refundEligible: 1200 });
  assert.equal(nil.difference, 0);
  assert.equal(nil.result, 'NIL');

  const now = new Date().toISOString();
  const entries: GstEntry[] = [
    { id: '1', entryDate: '2026-08-01', consigneeId: 'c1', consigneeName: 'Buyer A', ...gain, createdAt: now, updatedAt: now },
    { id: '2', entryDate: '2026-08-02', consigneeId: 'c1', consigneeName: 'Buyer A', ...loss, createdAt: now, updatedAt: now },
    { id: '3', entryDate: '2026-08-03', consigneeId: 'c1', consigneeName: 'Buyer A', ...nil, createdAt: now, updatedAt: now },
  ];
  const summary = calculateGstSummary(entries);
  assert.equal(summary.totalEntries, 3);
  assert.equal(summary.totalGst, 6200);
  assert.equal(summary.totalRefundEligible, 5900);
  assert.equal(summary.netDifference, -300);
  assert.equal(summary.overallResult, 'LOSS');
  assert.equal(summary.gainCount, 1);
  assert.equal(summary.lossCount, 1);
  assert.equal(summary.nilCount, 1);
});

test('B2B calculators compute invoice totals and monthly summaries across 12 FY buckets', () => {
  const totals = calculateB2bInvoiceTaxTotals({
    taxableValue: 10000,
    integratedTax: 1800,
    centralTax: 0,
    stateUtTax: 0,
    cess: 0,
  });
  assert.equal(totals.totalGst, 1800);
  assert.equal(totals.invoiceValue, 11800);

  const now = new Date().toISOString();
  const sampleInvoice: B2bInvoice = {
    id: 'inv-1',
    supplierId: 'sup-1',
    supplierGstin: '33ABCDE1234F1Z5',
    supplierName: 'ABC Textiles Pvt Ltd',
    invoiceNumber: 'INV-001',
    invoiceType: 'Regular',
    invoiceDate: '2026-08-12',
    invoiceValue: 11800,
    reverseCharge: 'N',
    taxableValue: 10000,
    integratedTax: 1800,
    centralTax: 0,
    stateUtTax: 0,
    cess: 0,
    totalGst: 1800,
    gstrPeriod: 'August 2026',
    periodKey: '2026-08',
    financialYear: '2026-27',
    itcAvailability: 'Yes',
    createdAt: now,
    updatedAt: now,
  };

  const monthly = buildB2bMonthlySummaries([sampleInvoice], '2026-27');
  assert.equal(monthly.length, 12);
  const augBucket = monthly.find((m) => m.periodKey === '2026-08');
  assert.ok(augBucket);
  assert.equal(augBucket.invoiceCount, 1);
  assert.equal(augBucket.totalGst, 1800);
});

test('previewB2bWorkbook parses valid GSTR-2B B2B workbook rows and detects duplicates', () => {
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
    ],
    [
      '33ABCDE1234F1Z5',
      'ABC Yarns Pvt Ltd',
      'YRN-2026-101',
      'Regular',
      '14-08-2026',
      11800,
      '33-Tamil Nadu',
      'N',
      10000,
      1800,
      0,
      0,
      0,
      '082026',
      'Yes',
    ],
    [
      '33ABCDE1234F1Z5',
      'ABC Yarns Pvt Ltd',
      'YRN-2026-101',
      'Regular',
      '14-08-2026',
      11800,
      '33-Tamil Nadu',
      'N',
      10000,
      1800,
      0,
      0,
      0,
      '082026',
      'Yes',
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'B2B');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const preview = previewB2bWorkbook(buf, 'gstr2b-aug-2026.xlsx', [], []);
  assert.equal(preview.worksheetDetected, 'B2B');
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.duplicateRows, 1);
  assert.equal(preview.invalidRows, 0);
  assert.equal(preview.allParsedRecords?.[0].periodKey, '2026-08');
  assert.equal(preview.allParsedRecords?.[0].financialYear, '2026-27');
});
