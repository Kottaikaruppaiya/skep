/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const updateSettingsSchema = z.object({
  statutoryBrcDays: z.coerce.number().int().min(1).max(1095).optional(),
  defaultPortCode: z.string().trim().min(1).optional(),
  baseCurrency: z.string().trim().min(1).optional(),
  allowOverAllocation: z.boolean().optional(),
  companyName: z.string().trim().min(1).optional(),
  iecNumber: z.string().trim().optional(),
  panNumber: z.string().trim().optional(),
});
