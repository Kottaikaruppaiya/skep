/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const approveOcrJobSchema = z
  .object({
    reviewedValues: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
