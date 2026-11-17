/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncentiveStatus } from '../../../src/types/index.ts';
import { ValidationError } from '../../shared/errors/app-error.ts';
import { round2, toDecimal } from '../../shared/utils/decimal.ts';

export function deriveIncentiveStatus(
  claimedAmount: number,
  receivedAmount: number,
  explicitStatus?: IncentiveStatus
): IncentiveStatus {
  const claimed = toDecimal(claimedAmount);
  const received = toDecimal(receivedAmount);

  if (claimed.lt(0) || received.lt(0)) {
    throw new ValidationError('Incentive claimed and received amounts cannot be negative.');
  }
  if (received.gt(claimed.plus(0.001))) {
    throw new ValidationError(
      `Incentive received amount (₹${receivedAmount}) cannot exceed claimed amount (₹${claimedAmount}).`
    );
  }

  if (explicitStatus) return explicitStatus;
  if (claimed.gt(0) && received.gte(claimed)) return 'RECEIVED';
  if (received.gt(0)) return 'PART_RECEIVED';
  return 'PENDING';
}

export function calculateIncentiveOutstanding(claimedAmount: number, receivedAmount: number): number {
  return Math.max(0, round2(toDecimal(claimedAmount).minus(toDecimal(receivedAmount))));
}
