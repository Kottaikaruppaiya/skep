/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { settingsController } from './settings.controller.ts';
import { updateSettingsSchema } from './settings.validator.ts';

export const settingsRouter = Router();
export const systemRouter = Router();

settingsRouter.get('/', authenticate, settingsController.getSettings);
settingsRouter.put(
  '/',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody(updateSettingsSchema),
  settingsController.updateSettings
);

systemRouter.post('/clear-records', authenticate, requireRole(['SUPER_ADMIN']), settingsController.clearRecords);
systemRouter.post('/reseed', authenticate, requireRole(['SUPER_ADMIN']), settingsController.reseed);
