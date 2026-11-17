/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { incentivesController } from './incentives.controller.ts';
import { createIncentiveSchema, updateIncentiveSchema } from './incentives.validator.ts';

export const incentivesRouter = express.Router();

incentivesRouter.use(authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']));

incentivesRouter.post('/', validateBody(createIncentiveSchema), incentivesController.create);
incentivesRouter.put('/:id', validateBody(updateIncentiveSchema), incentivesController.update);
incentivesRouter.delete('/:id', incentivesController.remove);
