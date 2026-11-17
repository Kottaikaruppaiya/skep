/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.ts';
import { settingsService } from './settings.service.ts';

export const settingsController = {
  async getSettings(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await settingsService.updateSettings(req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async clearRecords(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await settingsService.clearAllOperationalData();
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async reseed(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await settingsService.reseedDefaults();
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
