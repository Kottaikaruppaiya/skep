/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const createConsigneeSchema = z.object({
  name: z.string().trim().min(1, 'Consignee name is required.'),
  country: z.string().trim().min(1, 'Country is required.').default('International'),
  portOfDischarge: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  currency: z.string().trim().default('USD'),
  contactEmail: z.string().trim().email('Valid contact email required.').optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const updateConsigneeSchema = createConsigneeSchema.partial();

export const createBankSchema = z.object({
  name: z.string().trim().min(1, 'Bank name is required.'),
  branch: z.string().trim().optional(),
  adCode: z.string().trim().optional(),
  ifscCode: z.string().trim().optional(),
  swiftCode: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const updateBankSchema = createBankSchema.partial();
