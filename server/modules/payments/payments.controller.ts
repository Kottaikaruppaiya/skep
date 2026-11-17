/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/role.middleware.ts';
import { NotFoundError } from '../../shared/errors/app-error.ts';
import { allocationService } from './allocation.service.ts';
import { paymentsService } from './payments.service.ts';

export const paymentsController = {
  async list(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await paymentsService.listPayments());
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await paymentsService.getPaymentById(String(req.params.id));
      if (!payment) throw new NotFoundError('Payment not found.');
      res.json(payment);
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await paymentsService.createPayment(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await paymentsService.updatePayment(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await paymentsService.deletePayment(String(req.params.id)));
    } catch (err) {
      next(err);
    }
  },

  async allocate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const allocation = await allocationService.allocate(req.body, req.user!.id);
      res.status(201).json(allocation);
    } catch (err) {
      next(err);
    }
  },

  async deallocate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await allocationService.deallocate(String(req.params.id)));
    } catch (err) {
      next(err);
    }
  },
};
