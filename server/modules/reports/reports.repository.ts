/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DashboardMetrics } from '../../../src/types/index.ts';
import { dAdd, dSub, round2 } from '../../shared/utils/decimal.ts';
import { gstService } from '../gst/gst.service.ts';
import { shipmentsRepository } from '../shipments/shipments.repository.ts';

export const reportsRepository = {
  async computeDashboardMetrics(financialYearId?: string): Promise<DashboardMetrics> {
    const [shipments, gstSummary] = await Promise.all([
      shipmentsRepository.findAll(financialYearId && financialYearId !== 'ALL' ? { financialYearId } : undefined),
      gstService.getSummary(),
    ]);

    let totalInvoiceValueUsd = 0;
    let totalRealisedUsd = 0;
    let unpaidCount = 0;
    let partPaidCount = 0;
    let fullyPaidCount = 0;
    let excessCount = 0;
    let pendingReviewCount = 0;
    let incentivesClaimedInr = 0;
    let incentivesReceivedInr = 0;
    let brcPendingCount = 0;
    let brcRealisedCount = 0;
    let brcOverdueCount = 0;

    for (const s of shipments) {
      totalInvoiceValueUsd = dAdd(totalInvoiceValueUsd, s.invoiceValueUsd || 0);
      totalRealisedUsd = dAdd(totalRealisedUsd, s.totalPaidUsd || 0);

      if (s.paymentStatus === 'UNPAID') unpaidCount++;
      else if (s.paymentStatus === 'PART_PAID') partPaidCount++;
      else if (s.paymentStatus === 'FULLY_PAID') fullyPaidCount++;
      else if (s.paymentStatus === 'EXCESS_RECEIVED') excessCount++;

      if (s.reviewStatus === 'NEEDS_REVIEW' || s.reviewStatus === 'EXTRACTED') {
        pendingReviewCount++;
      }

      for (const inc of s.incentives || []) {
        incentivesClaimedInr = dAdd(incentivesClaimedInr, inc.claimedAmount || 0);
        incentivesReceivedInr = dAdd(incentivesReceivedInr, inc.receivedAmount || 0);
      }

      if (s.brcRecord) {
        if (s.brcRecord.status === 'REALISED') brcRealisedCount++;
        else if (s.brcRecord.status === 'OVERDUE') brcOverdueCount++;
        else brcPendingCount++;
      }
    }

    return {
      totalShipments: shipments.length,
      totalInvoiceValueUsd: round2(totalInvoiceValueUsd),
      totalRealisedUsd: round2(totalRealisedUsd),
      totalOutstandingUsd: round2(Math.max(0, dSub(totalInvoiceValueUsd, totalRealisedUsd))),
      unpaidCount,
      partPaidCount,
      fullyPaidCount,
      excessCount,
      incentivesClaimedInr: round2(incentivesClaimedInr),
      incentivesReceivedInr: round2(incentivesReceivedInr),
      incentivesPendingInr: round2(Math.max(0, dSub(incentivesClaimedInr, incentivesReceivedInr))),
      brcPendingCount,
      brcRealisedCount,
      brcOverdueCount,
      pendingReviewCount,
      gstSummary,
    };
  },
};
