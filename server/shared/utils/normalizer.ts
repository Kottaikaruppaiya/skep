/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function normalizeInvoiceKey(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let cleaned = input.trim().toUpperCase();
  cleaned = cleaned.replace(/\b(PI|PROFORMA)\b/g, ' ');
  cleaned = cleaned.replace(/[\/\\_\.]/g, '-');
  cleaned = cleaned.replace(/\s+/g, '-');
  cleaned = cleaned.replace(/-+/g, '-');

  const skeMatch = cleaned.match(/^([A-Z]+)-?(\d{2})?-?(\d{2})?-?(\d+)$/);
  if (skeMatch) {
    const prefix = skeMatch[1];
    const y1 = skeMatch[2] || '26';
    const y2 = skeMatch[3] || '27';
    const num = parseInt(skeMatch[4], 10);
    return `${prefix}-${y1}-${y2}-${String(num).padStart(3, '0')}`;
  }

  const fullYearMatch = cleaned.match(/^([A-Z]+)-?(\d{4})?-?(\d{2,4})?-?(\d+)$/);
  if (fullYearMatch) {
    const prefix = fullYearMatch[1];
    const y1 = fullYearMatch[2] ? fullYearMatch[2].slice(-2) : '26';
    const y2 = fullYearMatch[3] ? fullYearMatch[3].slice(-2) : '27';
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

export function normalizePortCode(portCode?: string, fallback = 'INNSA1'): string {
  return (portCode || fallback).trim().toUpperCase();
}
