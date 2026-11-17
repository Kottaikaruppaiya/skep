/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const createGstEntrySchema = z.object({
  entryDate: z.string().trim().min(1, 'Valid entry date is required.'),
  consigneeId: z.string().trim().min(1, 'Consignee ID is required.'),
  igst: z.coerce.number().min(0).default(0),
  cgst: z.coerce.number().min(0).default(0),
  sgst: z.coerce.number().min(0).default(0),
  refundEligible: z.coerce.number().min(0).default(0),
  remarks: z.string().optional(),
});

export const updateGstEntrySchema = createGstEntrySchema.partial();
