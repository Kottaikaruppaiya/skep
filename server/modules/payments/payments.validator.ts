/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const createPaymentSchema = z.object({
  irmNumber: z.string().trim().min(1, 'IRM Number is required.'),
  senderReference: z.string().trim().optional(),
  currency: z.string().trim().default('USD'),
  verifiedAmount: z.coerce.number().positive('Verified amount must be greater than zero.'),
  inrAmount: z.coerce.number().nonnegative().optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  valueDate: z.string().trim().min(1, 'Value date is required.'),
  creditDate: z.string().trim().min(1, 'Credit date is required.'),
  fircIssueDate: z.string().trim().optional(),
  bankId: z.string().trim().min(1, 'Bank is required.'),
  purposeCode: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const updatePaymentSchema = createPaymentSchema.partial();

export const allocatePaymentSchema = z.object({
  paymentId: z.string().trim().min(1, 'paymentId is required.'),
  shipmentId: z.string().trim().min(1, 'shipmentId is required.'),
  allocatedAmountUsd: z.coerce.number().positive('Allocation amount must be greater than zero.'),
  notes: z.string().trim().optional(),
});
