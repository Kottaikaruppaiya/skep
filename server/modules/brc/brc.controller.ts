/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/role.middleware.ts';
import { brcService } from './brc.service.ts';

export const brcController = {
  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await brcService.updateBrcRecord(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async reset(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reset = await brcService.resetBrcRecord(String(req.params.id));
      res.json(reset);
    } catch (err) {
      next(err);
    }
  },
};
