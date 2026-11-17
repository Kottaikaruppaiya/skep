/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../errors/app-error.ts';

export function toDateOnlyString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return undefined;
    return value.toISOString().split('T')[0];
  }
  const str = String(value).trim();
  if (!str) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().split('T')[0];
}

export function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function parseDateRequired(value: Date | string, fieldName = 'date'): Date {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw new ValidationError(`Invalid ${fieldName}.`);
    return value;
  }
  const raw = String(value || '').trim();
  if (!raw) throw new ValidationError(`${fieldName} is required.`);
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) {
    throw new ValidationError(`Invalid ${fieldName}: "${raw}".`);
  }
  return parsed;
}

export function parseDateOptional(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}
