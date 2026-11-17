/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Corporate email is required.').email('Valid email address is required.'),
  password: z.string().min(1, 'Password is required.'),
});
