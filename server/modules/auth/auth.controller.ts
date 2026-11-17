/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/role.middleware.ts';
import { authService } from './auth.service.ts';

export const authController = {
  async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.logout(req.token, req.user?.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  me(req: AuthenticatedRequest, res: Response) {
    res.json({ user: req.user });
  },
};
