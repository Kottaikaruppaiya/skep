/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { brcController } from './brc.controller.ts';
import { updateBrcSchema } from './brc.validator.ts';

export const brcRouter = express.Router();

brcRouter.use(authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']));

brcRouter.put('/:id', validateBody(updateBrcSchema), brcController.update);
brcRouter.post('/:id/reset', brcController.reset);
