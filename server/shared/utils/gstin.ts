/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isValidGstin(value: unknown): boolean {
  return GSTIN_REGEX.test(normalizeGstin(value));
}
