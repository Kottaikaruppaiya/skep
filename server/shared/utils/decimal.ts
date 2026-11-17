/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Decimal from 'decimal.js';

export function toDecimal(value: Decimal.Value | null | undefined | { toString(): string }): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(typeof value === 'object' ? value.toString() : value);
}

export function toNumber(value: Decimal.Value | null | undefined | { toString(): string }): number {
  if (value === null || value === undefined || value === '') return 0;
  return new Decimal(typeof value === 'object' ? value.toString() : value).toNumber();
}

export function round2(value: Decimal.Value | null | undefined | { toString(): string }): number {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function round4(value: Decimal.Value | null | undefined | { toString(): string }): number {
  return toDecimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

export function dAdd(a: Decimal.Value, b: Decimal.Value): number {
  return toDecimal(a).plus(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function dSub(a: Decimal.Value, b: Decimal.Value): number {
  return toDecimal(a).minus(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function dMul(a: Decimal.Value, b: Decimal.Value): number {
  return toDecimal(a).times(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function dDiv(a: Decimal.Value, b: Decimal.Value, places = 4): number {
  const denom = toDecimal(b);
  if (denom.isZero()) return 0;
  return toDecimal(a).dividedBy(denom).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toNumber();
}
