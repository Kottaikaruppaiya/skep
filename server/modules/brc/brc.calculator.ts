/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BrcStatus } from '../../../src/types/index.ts';

export function calculateStatutoryDeadline(shippingBillDate: string, statutoryDays = 270): string {
  const sb = new Date(shippingBillDate);
  const validBase = isNaN(sb.getTime()) ? new Date() : sb;
  const deadline = new Date(validBase.getTime() + statutoryDays * 86400000);
  return deadline.toISOString().split('T')[0];
}

export function deriveBrcStatus(
  currentStatus: BrcStatus,
  statutoryDeadline?: string,
  brcNumber?: string
): BrcStatus {
  if (brcNumber && brcNumber.trim() && currentStatus === 'PENDING') {
    return 'REALISED';
  }
  if (currentStatus === 'PENDING' && statutoryDeadline) {
    const dl = new Date(statutoryDeadline);
    if (!isNaN(dl.getTime()) && dl < new Date()) {
      return 'OVERDUE';
    }
  }
  return currentStatus;
}
