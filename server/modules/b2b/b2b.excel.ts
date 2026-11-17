/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import type {
  B2bImportPreview,
  B2bInvoice,
  B2bMonthlySummary,
  Supplier,
} from '../../../src/types/index.ts';
import { dAdd, round2 } from '../../shared/utils/decimal.ts';
import { isValidGstin, normalizeGstin } from '../../shared/utils/gstin.ts';
import { normalizeGstrPeriod } from '../../shared/utils/gstr-period.ts';

const FIELD_ALIASES: Record<string, string[]> = {
  supplierGstin: ['gstin of supplier', 'supplier gstin', 'gstin', 'supplier_gstin', 'gstin of recipient', 'suppliergstin'],
  supplierName: ['trade/legal name', 'trade legal name', 'trade/legal name of supplier', 'legal name', 'supplier name', 'name of supplier', 'trade name', 'trade_name', 'party name'],
  invoiceNumber: ['invoice number', 'invoice no', 'inv no', 'invoice_no', 'invoice_number', 'doc number'],
  invoiceType: ['invoice type', 'inv type', 'invoice_type', 'doc type'],
  invoiceDate: ['invoice date', 'inv date', 'invoice_date', 'doc date'],
  invoiceValue: ['invoice value', 'inv value', 'total invoice value', 'invoice_value', 'inv amount'],
  placeOfSupply: ['place of supply', 'pos', 'place_of_supply'],
  reverseCharge: ['reverse charge', 'rcm', 'reverse_charge', 'rev charge'],
  taxableValue: ['taxable value', 'taxable amount', 'taxable_value', 'taxable val'],
  integratedTax: ['integrated tax', 'igst', 'integrated_tax', 'igst amount', 'igst (inr)', 'integrated tax amount'],
  centralTax: ['central tax', 'cgst', 'central_tax', 'cgst amount', 'cgst (inr)', 'central tax amount'],
  stateUtTax: ['state/ut tax', 'state ut tax', 'sgst', 'sgst/utgst', 'sgst/ut tax', 'state_ut_tax', 'sgst amount', 'sgst (inr)'],
  cess: ['cess', 'cess amount', 'cess (inr)', 'cess tax'],
  gstrPeriod: ['gstr period', 'return period', 'gstr_period', 'gstr-2b period', 'gstr2b period', 'period', 'month'],
  filingDate: ['filing date', 'gstr-1 filing date', 'filing_date', 'supplier filing date'],
  itcAvailability: ['itc availability', 'itc available', 'itc_availability', 'itc eligibility', 'itc'],
  reason: ['reason', 'itc reason', 'ineligibility reason', 'remarks'],
  applicableTaxRate: ['applicable % of tax rate', 'applicable tax rate', 'tax rate %', 'rate %', 'applicable_tax_rate'],
  source: ['source', 'return source', 'doc source', 'auto drafted from'],
  irn: ['irn', 'invoice reference number', 'e-invoice irn', 'irn hash'],
  irnDate: ['irn date', 'e-invoice date', 'irn_date', 'irn acknowledgement date'],
};

function normalizeHeader(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\r\n\t_]+/g, ' ')
    .replace(/[^\w\s\/\%-]/g, '')
    .replace(/\s+/g, ' ');
}

export function parseB2bDateCell(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  const yyyymmdd = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const ddmmmyyyy = str.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,9})[-\/\s](\d{4})$/);
  if (ddmmmyyyy) {
    const parsed = new Date(`${ddmmmyyyy[2]} ${ddmmmyyyy[1]}, ${ddmmmyyyy[3]} UTC`);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function parseB2bNumericCell(val: unknown): { value: number; present: boolean; invalid: boolean } {
  if (val === undefined || val === null || String(val).trim() === '') {
    return { value: 0, present: false, invalid: false };
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { value: 0, present: true, invalid: true };
    return { value: val, present: true, invalid: false };
  }
  const cleaned = String(val).replace(/,/g, '').trim();
  if (!cleaned) return { value: 0, present: false, invalid: false };
  const num = Number(cleaned);
  if (!Number.isFinite(num)) {
    return { value: 0, present: true, invalid: true };
  }
  return { value: num, present: true, invalid: false };
}

export function previewB2bWorkbook(
  buffer: Buffer,
  fileName = 'uploaded.xlsx',
  existingInvoices: B2bInvoice[] = [],
  existingSuppliers: Supplier[] = []
): B2bImportPreview {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: true });
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('The uploaded file contains no worksheets.');
  }

  let b2bSheetName = wb.SheetNames.find((s) => s.trim().toUpperCase() === 'B2B');
  if (!b2bSheetName) {
    b2bSheetName = wb.SheetNames.find((s) => {
      const upper = s.trim().toUpperCase();
      return upper === 'GSTR-2B' || upper === 'B2B INVOICES' || upper.startsWith('B2B ');
    });
  }
  if (!b2bSheetName) {
    if (wb.SheetNames.length === 1) {
      b2bSheetName = wb.SheetNames[0];
    } else {
      throw new Error(
        `No "B2B" worksheet detected in workbook. Found sheets: [${wb.SheetNames.join(', ')}]. The system processes only the B2B inward purchase sheet.`
      );
    }
  }

  const ws = wb.Sheets[b2bSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  if (rawRows.length === 0) {
    throw new Error(`The "${b2bSheetName}" worksheet is empty.`);
  }

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('gstin') && (rowStr.includes('invoice') || rowStr.includes('inv'))) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders: string[] = rawRows[headerRowIndex].map((h) => String(h).trim());
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  const headerMap: Record<string, number> = {};
  const claimedCols = new Set<number>();

  for (const [canonicalField, aliases] of Object.entries(FIELD_ALIASES)) {
    for (let colIdx = 0; colIdx < normalizedHeaders.length; colIdx++) {
      if (claimedCols.has(colIdx)) continue;
      if (aliases.includes(normalizedHeaders[colIdx])) {
        headerMap[canonicalField] = colIdx;
        claimedCols.add(colIdx);
        break;
      }
    }
  }

  for (const [canonicalField, aliases] of Object.entries(FIELD_ALIASES)) {
    if (headerMap[canonicalField] !== undefined) continue;
    for (let colIdx = 0; colIdx < normalizedHeaders.length; colIdx++) {
      if (claimedCols.has(colIdx)) continue;
      const colHeaderNorm = normalizedHeaders[colIdx];
      if (!colHeaderNorm) continue;
      if (aliases.some((a) => a.length >= 4 && colHeaderNorm.includes(a))) {
        headerMap[canonicalField] = colIdx;
        claimedCols.add(colIdx);
        break;
      }
    }
  }

  const missingColumns: string[] = [];
  const requiredFields = ['supplierGstin', 'invoiceNumber', 'invoiceDate', 'gstrPeriod'];
  for (const req of requiredFields) {
    if (headerMap[req] === undefined) {
      missingColumns.push(req);
    }
  }

  const existingInvoiceMap = new Map<string, B2bInvoice>();
  existingInvoices.forEach((inv) => {
    const key = `${inv.supplierGstin.trim().toUpperCase()}_${inv.invoiceNumber.trim().toUpperCase()}_${inv.invoiceType.trim().toUpperCase()}`;
    existingInvoiceMap.set(key, inv);
  });

  const existingSupplierSet = new Set<string>(
    existingSuppliers.map((s) => s.gstin.trim().toUpperCase())
  );

  const seenInFileSet = new Set<string>();
  const parsedRecords: any[] = [];
  const errors: B2bImportPreview['errors'] = [];
  const duplicates: B2bImportPreview['duplicates'] = [];
  const periodDistributionMap = new Map<
    string,
    { displayPeriod: string; financialYear: string; newInvoices: number; existingInvoices: number; invalidRows: number }
  >();

  const newSuppliersFound = new Set<string>();
  const existingSuppliersMatched = new Set<string>();

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.every((c: any) => c === '' || c === undefined || c === null)) {
      continue;
    }

    const rowNumber = r + 1;
    const getVal = (field: string) => {
      const idx = headerMap[field];
      return idx !== undefined ? row[idx] : undefined;
    };

    const rawGstin = normalizeGstin(getVal('supplierGstin'));
    const rawSupplierName = String(getVal('supplierName') || '').trim();
    const rawInvoiceNumber = String(getVal('invoiceNumber') || '').trim();
    const rawInvoiceType = String(getVal('invoiceType') || 'Regular').trim() || 'Regular';
    const rawInvoiceDate = parseB2bDateCell(getVal('invoiceDate'));

    const parsedInvoiceValue = parseB2bNumericCell(getVal('invoiceValue'));
    const rawPlaceOfSupply = String(getVal('placeOfSupply') || '').trim();
    const rawReverseChargeInput = String(getVal('reverseCharge') || '').trim().toUpperCase();
    let rawReverseCharge = 'N';
    let invalidReverseCharge = false;
    if (rawReverseChargeInput === '' || rawReverseChargeInput === 'N' || rawReverseChargeInput === 'NO') {
      rawReverseCharge = 'N';
    } else if (rawReverseChargeInput === 'Y' || rawReverseChargeInput === 'YES') {
      rawReverseCharge = 'Y';
    } else {
      invalidReverseCharge = true;
    }

    const parsedTaxableValue = parseB2bNumericCell(getVal('taxableValue'));
    const parsedIgst = parseB2bNumericCell(getVal('integratedTax'));
    const parsedCgst = parseB2bNumericCell(getVal('centralTax'));
    const parsedSgst = parseB2bNumericCell(getVal('stateUtTax'));
    const parsedCess = parseB2bNumericCell(getVal('cess'));
    const rawGstrPeriod = getVal('gstrPeriod');
    const rawFilingDate = parseB2bDateCell(getVal('filingDate'));

    const rawItcInput = String(getVal('itcAvailability') || '').trim().toLowerCase();
    let rawItc: 'Yes' | 'No' = 'Yes';
    let invalidItc = false;
    if (rawItcInput === '' || rawItcInput === 'y' || rawItcInput === 'yes') {
      rawItc = 'Yes';
    } else if (rawItcInput === 'n' || rawItcInput === 'no') {
      rawItc = 'No';
    } else {
      invalidItc = true;
    }

    const rawReason = String(getVal('reason') || '').trim() || undefined;
    const parsedTaxRate = parseB2bNumericCell(getVal('applicableTaxRate'));
    const rawTaxRate = parsedTaxRate.present && !parsedTaxRate.invalid ? parsedTaxRate.value : undefined;
    const rawSource = String(getVal('source') || '').trim() || undefined;
    const rawIrn = String(getVal('irn') || '').trim() || undefined;
    const rawIrnDate = parseB2bDateCell(getVal('irnDate')) || undefined;

    const normPeriod = normalizeGstrPeriod(rawGstrPeriod);
    if (!normPeriod) {
      errors.push({
        rowNumber,
        invoiceNumber: rawInvoiceNumber || undefined,
        supplierGstin: rawGstin || undefined,
        issue: `Missing or invalid GSTR Period: "${rawGstrPeriod || 'BLANK'}". Valid period required (e.g. "08-2026" or "Aug 2026").`,
      });
      const unassignedKey = 'UNASSIGNED';
      const pEntry = periodDistributionMap.get(unassignedKey) || {
        displayPeriod: 'Invalid / Missing Period',
        financialYear: '—',
        newInvoices: 0,
        existingInvoices: 0,
        invalidRows: 0,
      };
      pEntry.invalidRows++;
      periodDistributionMap.set(unassignedKey, pEntry);
      continue;
    }

    if (!isValidGstin(rawGstin)) {
      errors.push({
        rowNumber,
        invoiceNumber: rawInvoiceNumber || undefined,
        supplierGstin: rawGstin || undefined,
        issue: `Invalid Supplier GSTIN: "${rawGstin}". Must match the 15-character GSTIN format.`,
      });
      continue;
    }

    if (!rawInvoiceNumber) {
      errors.push({
        rowNumber,
        supplierGstin: rawGstin,
        issue: 'Invoice number is missing or empty.',
      });
      continue;
    }

    if (!rawInvoiceDate) {
      errors.push({
        rowNumber,
        invoiceNumber: rawInvoiceNumber,
        supplierGstin: rawGstin,
        issue: `Invalid or unparseable invoice date: "${getVal('invoiceDate')}".`,
      });
      continue;
    }

    const numericFields = [
      { label: 'Invoice value', parsed: parsedInvoiceValue },
      { label: 'Taxable value', parsed: parsedTaxableValue },
      { label: 'Integrated Tax', parsed: parsedIgst },
      { label: 'Central Tax', parsed: parsedCgst },
      { label: 'State/UT Tax', parsed: parsedSgst },
      { label: 'Cess', parsed: parsedCess },
      { label: 'Applicable tax rate', parsed: parsedTaxRate },
    ];
    const badNum = numericFields.find((f) => f.parsed.invalid || f.parsed.value < 0);
    if (badNum) {
      errors.push({
        rowNumber,
        invoiceNumber: rawInvoiceNumber,
        supplierGstin: rawGstin,
        issue: `${badNum.label} must be a valid non-negative number.`,
      });
      continue;
    }
    if (invalidReverseCharge) {
      errors.push({
        rowNumber,
        invoiceNumber: rawInvoiceNumber,
        supplierGstin: rawGstin,
        issue: `Invalid Reverse Charge flag "${rawReverseChargeInput}". Expected Y/N or Yes/No.`,
      });
      continue;
    }
    if (invalidItc) {
      errors.push({
        rowNumber,
        invoiceNumber: rawInvoiceNumber,
        supplierGstin: rawGstin,
        issue: `Invalid ITC Availability flag "${rawItcInput}". Expected Yes/No.`,
      });
      continue;
    }

    const pKey = normPeriod.periodKey;
    const pEntry = periodDistributionMap.get(pKey) || {
      displayPeriod: normPeriod.displayPeriod,
      financialYear: normPeriod.financialYear,
      newInvoices: 0,
      existingInvoices: 0,
      invalidRows: 0,
    };

    const uniqueKey = `${rawGstin}_${rawInvoiceNumber.toUpperCase()}_${rawInvoiceType.toUpperCase()}`;
    const existingRecord = existingInvoiceMap.get(uniqueKey);
    const isDuplicateInFile = seenInFileSet.has(uniqueKey);
    const totalGst = round2(dAdd(dAdd(parsedIgst.value, parsedCgst.value), dAdd(parsedSgst.value, parsedCess.value)));

    const invoiceDraft = {
      supplierGstin: rawGstin,
      supplierName: rawSupplierName || rawGstin,
      invoiceNumber: rawInvoiceNumber,
      invoiceType: rawInvoiceType,
      invoiceDate: rawInvoiceDate,
      invoiceValue: parsedInvoiceValue.present ? round2(parsedInvoiceValue.value) : 0,
      placeOfSupply: rawPlaceOfSupply || undefined,
      reverseCharge: rawReverseCharge,
      taxableValue: parsedTaxableValue.present ? round2(parsedTaxableValue.value) : 0,
      integratedTax: parsedIgst.present ? round2(parsedIgst.value) : 0,
      centralTax: parsedCgst.present ? round2(parsedCgst.value) : 0,
      stateUtTax: parsedSgst.present ? round2(parsedSgst.value) : 0,
      cess: parsedCess.present ? round2(parsedCess.value) : 0,
      totalGst,
      gstrPeriod: normPeriod.displayPeriod,
      periodKey: normPeriod.periodKey,
      financialYear: normPeriod.financialYear,
      filingDate: rawFilingDate || undefined,
      itcAvailability: rawItc,
      reason: rawReason,
      applicableTaxRate: rawTaxRate,
      source: rawSource,
      irn: rawIrn,
      irnDate: rawIrnDate,
      rowNumber,
    };

    if (existingRecord || isDuplicateInFile) {
      pEntry.existingInvoices++;
      const differingFields: string[] = [];
      if (existingRecord) {
        if (existingRecord.invoiceValue !== invoiceDraft.invoiceValue) differingFields.push('invoiceValue');
        if (existingRecord.taxableValue !== invoiceDraft.taxableValue) differingFields.push('taxableValue');
        if (existingRecord.totalGst !== invoiceDraft.totalGst) differingFields.push('totalGst');
        if (existingRecord.gstrPeriod !== invoiceDraft.gstrPeriod) differingFields.push('gstrPeriod');
      }

      duplicates.push({
        rowNumber,
        invoiceNumber: rawInvoiceNumber,
        supplierGstin: rawGstin,
        invoiceType: rawInvoiceType,
        existingRecord: existingRecord || {},
        uploadedRecord: invoiceDraft,
        differingFields,
      });
    } else {
      pEntry.newInvoices++;
      seenInFileSet.add(uniqueKey);
    }

    periodDistributionMap.set(pKey, pEntry);

    if (existingSupplierSet.has(rawGstin)) {
      existingSuppliersMatched.add(rawGstin);
    } else {
      newSuppliersFound.add(rawGstin);
    }

    parsedRecords.push(invoiceDraft);
  }

  const periodDistribution = Array.from(periodDistributionMap.entries())
    .map(([periodKey, stats]) => ({
      periodKey,
      displayPeriod: stats.displayPeriod,
      financialYear: stats.financialYear,
      newInvoices: stats.newInvoices,
      existingInvoices: stats.existingInvoices,
      invalidRows: stats.invalidRows,
    }))
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  return {
    fileName,
    worksheetDetected: b2bSheetName,
    totalRows: parsedRecords.length + errors.length,
    validRows: parsedRecords.length - duplicates.length,
    invalidRows: errors.length,
    duplicateRows: duplicates.length,
    newSuppliersCount: newSuppliersFound.size,
    existingSuppliersCount: existingSuppliersMatched.size,
    missingColumns,
    periodDistribution,
    sampleRows: parsedRecords.slice(0, 10),
    allParsedRecords: parsedRecords,
    errors,
    duplicates,
  };
}

export function generateB2bExcelExport(invoices: B2bInvoice[], reportTitle = 'B2B Invoice Register'): Buffer {
  const wb = XLSX.utils.book_new();

  const rows = invoices.map((inv, idx) => ({
    'S.No': idx + 1,
    'GSTIN of supplier': inv.supplierGstin,
    'Trade/Legal name': inv.supplierName,
    'Invoice number': inv.invoiceNumber,
    'Invoice type': inv.invoiceType,
    'Invoice date': inv.invoiceDate,
    'Invoice value': Number(inv.invoiceValue.toFixed(2)),
    'Place of supply': inv.placeOfSupply || '—',
    'Reverse charge': inv.reverseCharge,
    'Taxable value': Number(inv.taxableValue.toFixed(2)),
    'Integrated Tax': Number(inv.integratedTax.toFixed(2)),
    'Central Tax': Number(inv.centralTax.toFixed(2)),
    'State/UT Tax': Number(inv.stateUtTax.toFixed(2)),
    'Cess': Number(inv.cess.toFixed(2)),
    'Total GST': Number(inv.totalGst.toFixed(2)),
    'GSTR period': inv.gstrPeriod,
    'Filing date': inv.filingDate || '—',
    'ITC availability': inv.itcAvailability,
    'Reason': inv.reason || '—',
    'Applicable % of tax rate': inv.applicableTaxRate ?? '—',
    'Source': inv.source || '—',
    'IRN': inv.irn || '—',
    'IRN date': inv.irnDate || '—',
  }));

  const totalInvVal = invoices.reduce((s, i) => dAdd(s, i.invoiceValue), 0);
  const totalTaxVal = invoices.reduce((s, i) => dAdd(s, i.taxableValue), 0);
  const totalIgst = invoices.reduce((s, i) => dAdd(s, i.integratedTax), 0);
  const totalCgst = invoices.reduce((s, i) => dAdd(s, i.centralTax), 0);
  const totalSgst = invoices.reduce((s, i) => dAdd(s, i.stateUtTax), 0);
  const totalCess = invoices.reduce((s, i) => dAdd(s, i.cess), 0);
  const totalGst = invoices.reduce((s, i) => dAdd(s, i.totalGst), 0);

  rows.push({
    'S.No': '' as any,
    'GSTIN of supplier': 'TOTAL',
    'Trade/Legal name': `${invoices.length} Invoices`,
    'Invoice number': '',
    'Invoice type': '',
    'Invoice date': '',
    'Invoice value': round2(totalInvVal),
    'Place of supply': '',
    'Reverse charge': '',
    'Taxable value': round2(totalTaxVal),
    'Integrated Tax': round2(totalIgst),
    'Central Tax': round2(totalCgst),
    'State/UT Tax': round2(totalSgst),
    'Cess': round2(totalCess),
    'Total GST': round2(totalGst),
    'GSTR period': '',
    'Filing date': '',
    'ITC availability': '',
    'Reason': '',
    'Applicable % of tax rate': '' as any,
    'Source': '',
    'IRN': '',
    'IRN date': '',
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 16 },
    { wch: 14 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, reportTitle.slice(0, 31));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function generateB2bMonthlySummaryExcel(summaries: B2bMonthlySummary[], financialYear: string): Buffer {
  const wb = XLSX.utils.book_new();

  const rows = summaries.map((s, idx) => ({
    'S.No': idx + 1,
    'GSTR Period': s.displayPeriod,
    'Period Key': s.periodKey,
    'Financial Year': s.financialYear,
    'Invoice Count': s.invoiceCount,
    'Unique Suppliers': s.uniqueSuppliers,
    'Invoice Value (INR)': Number(s.totalInvoiceValue.toFixed(2)),
    'Taxable Value (INR)': Number(s.totalTaxableValue.toFixed(2)),
    'Integrated Tax (INR)': Number(s.totalIgst.toFixed(2)),
    'Central Tax (INR)': Number(s.totalCgst.toFixed(2)),
    'State/UT Tax (INR)': Number(s.totalSgst.toFixed(2)),
    'Cess (INR)': Number(s.totalCess.toFixed(2)),
    'Total GST (INR)': Number(s.totalGst.toFixed(2)),
    'ITC Available Count': s.itcAvailableCount,
    'Reverse Charge Count': s.reverseChargeCount,
  }));

  const totalInvoices = summaries.reduce((sum, s) => sum + s.invoiceCount, 0);
  const totalInvVal = summaries.reduce((sum, s) => dAdd(sum, s.totalInvoiceValue), 0);
  const totalTaxVal = summaries.reduce((sum, s) => dAdd(sum, s.totalTaxableValue), 0);
  const totalGst = summaries.reduce((sum, s) => dAdd(sum, s.totalGst), 0);

  rows.push({
    'S.No': '' as any,
    'GSTR Period': 'TOTAL',
    'Period Key': '',
    'Financial Year': financialYear,
    'Invoice Count': totalInvoices,
    'Unique Suppliers': '' as any,
    'Invoice Value (INR)': round2(totalInvVal),
    'Taxable Value (INR)': round2(totalTaxVal),
    'Integrated Tax (INR)': round2(summaries.reduce((sum, s) => dAdd(sum, s.totalIgst), 0)),
    'Central Tax (INR)': round2(summaries.reduce((sum, s) => dAdd(sum, s.totalCgst), 0)),
    'State/UT Tax (INR)': round2(summaries.reduce((sum, s) => dAdd(sum, s.totalSgst), 0)),
    'Cess (INR)': round2(summaries.reduce((sum, s) => dAdd(sum, s.totalCess), 0)),
    'Total GST (INR)': round2(totalGst),
    'ITC Available Count': summaries.reduce((sum, s) => sum + s.itcAvailableCount, 0),
    'Reverse Charge Count': summaries.reduce((sum, s) => sum + s.reverseChargeCount, 0),
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Monthly_Summary_${financialYear}`.slice(0, 31));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
