/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PaymentStatus } from '../../../src/types/index.ts';
import { dDiv, dMul, round2, round4, toDecimal } from '../../shared/utils/decimal.ts';

export function calculateFobInr(invoiceValueUsd: number, sbExchangeRate: number): number {
  return dMul(invoiceValueUsd, sbExchangeRate);
}

export function deriveShipmentPaymentStatus(invoiceValueUsd: number, totalPaidUsd: number): PaymentStatus {
  const inv = toDecimal(invoiceValueUsd);
  const paid = toDecimal(totalPaidUsd);

  if (inv.gt(0) && paid.gte(inv)) {
    return paid.gt(inv.plus(0.001)) ? 'EXCESS_RECEIVED' : 'FULLY_PAID';
  }
  if (paid.gt(0)) {
    return 'PART_PAID';
  }
  return 'UNPAID';
}

export function calculateShipmentFinancials(
  invoiceValueUsd: number,
  allocations: Array<{ allocatedAmountUsd: number; paymentExchangeRate?: number | null }>
): {
  totalPaidUsd: number;
  balanceDueUsd: number;
  realisedInr: number;
  averageRealisedRate: number;
  paymentStatus: PaymentStatus;
} {
  let paidSum = toDecimal(0);
  let inrSum = toDecimal(0);

  for (const alloc of allocations) {
    const amt = toDecimal(alloc.allocatedAmountUsd);
    paidSum = paidSum.plus(amt);
    if (alloc.paymentExchangeRate && alloc.paymentExchangeRate > 0) {
      inrSum = inrSum.plus(amt.times(toDecimal(alloc.paymentExchangeRate)));
    }
  }

  const totalPaidUsd = round2(paidSum);
  const balanceDueUsd = Math.max(0, round2(toDecimal(invoiceValueUsd).minus(paidSum)));
  const realisedInr = round2(inrSum);
  const averageRealisedRate = paidSum.gt(0) ? round4(dDiv(inrSum, paidSum, 4)) : 0;
  const paymentStatus = deriveShipmentPaymentStatus(invoiceValueUsd, totalPaidUsd);

  return {
    totalPaidUsd,
    balanceDueUsd,
    realisedInr,
    averageRealisedRate,
    paymentStatus,
  };
}
