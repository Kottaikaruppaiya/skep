/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/role.middleware.ts';
import { incentivesService } from './incentives.service.ts';

export const incentivesController = {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await incentivesService.createIncentive(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await incentivesService.updateIncentive(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await incentivesService.deleteIncentive(String(req.params.id)));
    } catch (err) {
      next(err);
    }
  },
};
