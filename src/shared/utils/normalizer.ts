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
