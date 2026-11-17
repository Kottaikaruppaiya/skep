/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const updateDocumentReviewSchema = z.object({
  reviewStatus: z.enum(['EXTRACTED', 'NEEDS_REVIEW', 'CONFIRMED', 'MANUALLY_ENTERED']),
});
