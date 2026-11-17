/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GstEntry, GstResult, GstSummary } from '../../../src/types/index.ts';
import { dAdd, dSub, round2 } from '../../shared/utils/decimal.ts';

export function computeGstEntryMetrics(input: {
  igst: number;
  cgst: number;
  sgst: number;
  refundEligible: number;
}): {
  igst: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  refundEligible: number;
  difference: number;
  result: GstResult;
} {
  const igst = round2(input.igst || 0);
  const cgst = round2(input.cgst || 0);
  const sgst = round2(input.sgst || 0);
  const refundEligible = round2(input.refundEligible || 0);

  const totalGst = round2(dAdd(dAdd(igst, cgst), sgst));
  const difference = round2(dSub(refundEligible, totalGst));
  const result: GstResult = difference > 0 ? 'GAIN' : difference < 0 ? 'LOSS' : 'NIL';

  return {
    igst,
    cgst,
    sgst,
    totalGst,
    refundEligible,
    difference,
    result,
  };
}

export function calculateGstSummary(entries: GstEntry[]): GstSummary {
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalGst = 0;
  let totalRefundEligible = 0;
  let gainCount = 0;
  let lossCount = 0;
  let nilCount = 0;

  for (const e of entries) {
    totalIgst = dAdd(totalIgst, e.igst || 0);
    totalCgst = dAdd(totalCgst, e.cgst || 0);
    totalSgst = dAdd(totalSgst, e.sgst || 0);
    totalGst = dAdd(totalGst, e.totalGst || 0);
    totalRefundEligible = dAdd(totalRefundEligible, e.refundEligible || 0);
    if (e.result === 'GAIN') gainCount++;
    else if (e.result === 'LOSS') lossCount++;
    else nilCount++;
  }

  const netDifference = round2(dSub(totalRefundEligible, totalGst));
  const overallResult: GstResult = netDifference > 0 ? 'GAIN' : netDifference < 0 ? 'LOSS' : 'NIL';

  return {
    totalEntries: entries.length,
    totalIgst: round2(totalIgst),
    totalCgst: round2(totalCgst),
    totalSgst: round2(totalSgst),
    totalGst: round2(totalGst),
    totalRefundEligible: round2(totalRefundEligible),
    netDifference,
    overallResult,
    gainCount,
    lossCount,
    nilCount,
  };
}
