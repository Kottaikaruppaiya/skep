/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const createShipmentSchema = z.object({
  financialYearId: z.string().trim().min(1).default('fy-2026-27'),
  invoiceNumber: z.string().trim().min(1, 'Invoice Number is required.'),
  invoiceDate: z.string().trim().optional(),
  consigneeId: z.string().trim().optional(),
  consigneeName: z.string().trim().optional(),
  portCode: z.string().trim().optional(),
  packageCount: z.coerce.number().int().nonnegative().optional(),
  invoiceValueUsd: z.coerce.number().nonnegative().default(0),
  shippingBillNumber: z.string().trim().optional(),
  shippingBillDate: z.string().trim().optional(),
  sbExchangeRate: z.coerce.number().positive().optional(),
  fobValueInr: z.coerce.number().nonnegative().optional(),
  blNumber: z.string().trim().optional(),
  blDate: z.string().trim().optional(),
  vesselName: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  reviewStatus: z.enum(['EXTRACTED', 'NEEDS_REVIEW', 'CONFIRMED', 'MANUALLY_ENTERED']).optional(),
  initialFircPaymentId: z.string().trim().optional(),
  initialFircAllocationAmount: z.coerce.number().nonnegative().optional(),
  initialFircDocumentUploaded: z.boolean().optional(),
  incentives: z
    .object({
      dbkClaimed: z.coerce.number().nonnegative().optional(),
      rodtepClaimed: z.coerce.number().nonnegative().optional(),
      rosctlClaimed: z.coerce.number().nonnegative().optional(),
    })
    .optional(),
  brc: z
    .object({
      uploadMode: z.enum(['SINGLE', 'MULTIPLE']).optional(),
      statutoryDeadline: z.string().trim().optional(),
      remarks: z.string().trim().optional(),
    })
    .optional(),
});

export const updateShipmentSchema = z.record(z.string(), z.any());

export const archiveShipmentSchema = z.object({
  reason: z.string().trim().optional(),
});
