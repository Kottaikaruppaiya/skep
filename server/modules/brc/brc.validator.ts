/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const updateBrcSchema = z.object({
  brcNumber: z.string().trim().optional().nullable(),
  issueDate: z.string().trim().optional().nullable(),
  realisationDate: z.string().trim().optional().nullable(),
  realisedAmount: z.coerce.number().nonnegative().optional().nullable(),
  realisedCurrency: z.string().trim().optional(),
  uploadMode: z.enum(['SINGLE', 'MULTIPLE']).optional(),
  statutoryDeadline: z.string().trim().optional().nullable(),
  status: z.enum(['PENDING', 'ISSUED', 'REALISED', 'OVERDUE']).optional(),
  remarks: z.string().trim().optional().nullable(),
});
