/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const createIncentiveSchema = z.object({
  shipmentId: z.string().trim().min(1, 'shipmentId is required.'),
  type: z.enum(['DRAWBACK', 'RODTEP', 'ROSCTL']),
  claimedAmount: z.coerce.number().nonnegative(),
  receivedAmount: z.coerce.number().nonnegative().optional(),
  receivedDate: z.string().trim().optional(),
  scrollNumber: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const updateIncentiveSchema = z.object({
  claimedAmount: z.coerce.number().nonnegative().optional(),
  receivedAmount: z.coerce.number().nonnegative().optional(),
  receivedDate: z.string().trim().optional().nullable(),
  status: z.enum(['PENDING', 'PART_RECEIVED', 'RECEIVED']).optional(),
  scrollNumber: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
});
