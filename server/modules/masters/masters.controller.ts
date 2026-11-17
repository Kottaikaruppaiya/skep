/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/role.middleware.ts';
import { mastersService } from './masters.service.ts';

export const mastersController = {
  async listFinancialYears(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await mastersService.listFinancialYears());
    } catch (err) {
      next(err);
    }
  },

  async listConsignees(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await mastersService.listConsignees());
    } catch (err) {
      next(err);
    }
  },

  async createConsignee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await mastersService.createConsignee(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async updateConsignee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await mastersService.updateConsignee(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async deleteConsignee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await mastersService.deleteConsignee(String(req.params.id)));
    } catch (err) {
      next(err);
    }
  },

  async listBanks(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await mastersService.listBanks());
    } catch (err) {
      next(err);
    }
  },

  async createBank(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await mastersService.createBank(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async updateBank(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await mastersService.updateBank(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async deleteBank(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await mastersService.deleteBank(String(req.params.id)));
    } catch (err) {
      next(err);
    }
  },
};
