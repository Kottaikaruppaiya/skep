/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

const roleEnum = z.enum(['SUPER_ADMIN', 'ADMIN', 'VIEWER']);

export const createUserSchema = z.object({
  email: z.string().trim().email('Valid email is required.'),
  name: z.string().trim().min(1, 'Name is required.'),
  role: roleEnum,
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().trim().email('Valid email is required.').optional(),
  name: z.string().trim().min(1).optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional().or(z.literal('')),
});
