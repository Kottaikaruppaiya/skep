/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client-side canonical invoice key normalizer (mirrors server/shared/utils/normalizer.ts).
 */
export function normalizeInvoiceKey(invoiceNo: string): string {
  if (!invoiceNo) return '';
  let clean = invoiceNo.trim().toUpperCase();
  clean = clean.replace(/[\s/._-]+/g, '-');
  clean = clean.replace(/-(20)?(\d{2})-(20)?(\d{2})-/g, '-$2-$4-');
  const match = clean.match(/^([A-Z0-9-]+?)-(\d+)$/);
  if (match) {
    const prefix = match[1];
    const numStr = match[2];
    const padded = parseInt(numStr, 10).toString().padStart(3, '0');
    return `${prefix}-${padded}`;
  }
  return clean;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(value: string): string {
  return String(value || '').trim().toUpperCase();
}

export function isValidGstin(value: string): boolean {
  return GSTIN_REGEX.test(normalizeGstin(value));
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function getCurrentIndianFinancialYearLabel(referenceDate: Date = new Date()): string {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = String(fyStart + 1).slice(-2);
  return `${fyStart}-${fyEnd}`;
}

export function getFiscalYearOptions(referenceDate: Date = new Date()): string[] {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth() + 1;
  const currentStart = month >= 4 ? year : year - 1;
  return [currentStart - 1, currentStart, currentStart + 1, currentStart + 2].map(
    (start) => `${start}-${String(start + 1).slice(-2)}`
  );
}

export function getDefaultGstrPeriodLabel(referenceDate: Date = new Date()): string {
  return `${MONTH_NAMES[referenceDate.getUTCMonth()]} ${referenceDate.getUTCFullYear()}`;
}

export function getCurrentMonthPeriodKey(referenceDate: Date = new Date()): string {
  const year = referenceDate.getUTCFullYear();
  const month = String(referenceDate.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getShortFyTag(fyLabel?: string): string {
  if (fyLabel && /^\d{4}-\d{2}$/.test(fyLabel)) {
    return `${fyLabel.slice(2, 4)}-${fyLabel.slice(5, 7)}`;
  }
  const curr = getCurrentIndianFinancialYearLabel();
  return `${curr.slice(2, 4)}-${curr.slice(5, 7)}`;
}

