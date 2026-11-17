/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function getFallbackFyTags(referenceDate: Date = new Date()): [string, string] {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  return [String(fyStart).slice(-2), String(fyStart + 1).slice(-2)];
}

/**
 * Client-side canonical invoice key normalizer (identical to server/shared/utils/normalizer.ts).
 */
export function normalizeInvoiceKey(invoiceNo: string): string {
  if (!invoiceNo || typeof invoiceNo !== 'string') return '';

  const [defaultY1, defaultY2] = getFallbackFyTags();
  let cleaned = invoiceNo.trim().toUpperCase();
  cleaned = cleaned.replace(/\b(PI|PROFORMA)\b/g, ' ');
  cleaned = cleaned.replace(/[\/\\_\.]/g, '-');
  cleaned = cleaned.replace(/\s+/g, '-');
  cleaned = cleaned.replace(/-+/g, '-');

  const skeMatch = cleaned.match(/^([A-Z]+)-?(\d{2})?-?(\d{2})?-?(\d+)$/);
  if (skeMatch) {
    const prefix = skeMatch[1];
    const y1 = skeMatch[2] || defaultY1;
    const y2 = skeMatch[3] || defaultY2;
    const num = parseInt(skeMatch[4], 10);
    return `${prefix}-${y1}-${y2}-${String(num).padStart(3, '0')}`;
  }

  const fullYearMatch = cleaned.match(/^([A-Z]+)-?(\d{4})?-?(\d{2,4})?-?(\d+)$/);
  if (fullYearMatch) {
    const prefix = fullYearMatch[1];
    const y1 = fullYearMatch[2] ? fullYearMatch[2].slice(-2) : defaultY1;
    const y2 = fullYearMatch[3] ? fullYearMatch[3].slice(-2) : defaultY2;
    const num = parseInt(fullYearMatch[4], 10);
    return `${prefix}-${y1}-${y2}-${String(num).padStart(3, '0')}`;
  }

  const trailingNumMatch = cleaned.match(/^(.*)-(\d+)$/);
  if (trailingNumMatch) {
    const base = trailingNumMatch[1];
    const num = parseInt(trailingNumMatch[2], 10);
    return `${base}-${String(num).padStart(3, '0')}`;
  }

  return cleaned;
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

