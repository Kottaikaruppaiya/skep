/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../../shared/errors/app-error.ts';
import { round2, toDecimal } from '../../shared/utils/decimal.ts';

export function calculatePaymentBalances(
  verifiedAmount: number,
  allocations: Array<{ allocatedAmountUsd: number }>
): { totalAllocatedUsd: number; availableBalanceUsd: number } {
  const allocated = allocations.reduce(
    (sum, a) => sum.plus(toDecimal(a.allocatedAmountUsd)),
    toDecimal(0)
  );
  const verified = toDecimal(verifiedAmount);
  return {
    totalAllocatedUsd: round2(allocated),
    availableBalanceUsd: Math.max(0, round2(verified.minus(allocated))),
  };
}

export function validateAllocationAgainstBalances(input: {
  requestedAmountUsd: number;
  availablePaymentBalance: number;
  invoiceBalanceDue: number;
  irmNumber: string;
  invoiceNumber: string;
}): void {
  if (input.requestedAmountUsd <= 0) {
    throw new ValidationError('Allocation amount must be strictly greater than 0.');
  }

  if (input.requestedAmountUsd > input.availablePaymentBalance + 0.001) {
    throw new ValidationError(
      `Over-allocation rejected: Requested $${input.requestedAmountUsd.toFixed(2)} exceeds available payment balance of $${input.availablePaymentBalance.toFixed(2)} on FIRC ${input.irmNumber}.`
    );
  }

  if (input.requestedAmountUsd > input.invoiceBalanceDue + 0.001) {
    throw new ValidationError(
      `Over-allocation rejected: Requested $${input.requestedAmountUsd.toFixed(2)} exceeds remaining invoice balance due of $${input.invoiceBalanceDue.toFixed(2)} on Invoice ${input.invoiceNumber}.`
    );
  }
}
