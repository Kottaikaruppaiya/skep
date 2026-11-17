/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/role.middleware.ts';
import { usersService } from './users.service.ts';

export const usersController = {
  async list(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const users = await usersService.listUsers();
      res.json(users);
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await usersService.createUser(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await usersService.updateUser(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.deleteUser(String(req.params.id), req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
