/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncentiveStatus } from '../../../src/types/index.ts';
import { round2, toDecimal } from '../../shared/utils/decimal.ts';

export function deriveIncentiveStatus(
  claimedAmount: number,
  receivedAmount: number,
  explicitStatus?: IncentiveStatus
): IncentiveStatus {
  if (explicitStatus) return explicitStatus;
  if (claimedAmount > 0 && receivedAmount >= claimedAmount) return 'RECEIVED';
  if (receivedAmount > 0) return 'PART_RECEIVED';
  return 'PENDING';
}

export function calculateIncentiveOutstanding(claimedAmount: number, receivedAmount: number): number {
  return Math.max(0, round2(toDecimal(claimedAmount).minus(toDecimal(receivedAmount))));
}
