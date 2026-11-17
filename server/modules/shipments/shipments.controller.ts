/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/role.middleware.ts';
import { NotFoundError } from '../../shared/errors/app-error.ts';
import { shipmentsService } from './shipments.service.ts';

export const shipmentsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { financialYearId, consigneeId, paymentStatus, reviewStatus, search } = req.query as Record<
        string,
        string | undefined
      >;
      const list = await shipmentsService.listShipments({
        financialYearId,
        consigneeId,
        paymentStatus,
        reviewStatus,
        search,
      });
      res.json(list);
    } catch (err) {
      next(err);
    }
  },

  async lookup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const q = String(req.query.q || '');
      const fyId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;
      res.json(await shipmentsService.lookupShipments(q, fyId));
    } catch (err) {
      next(err);
    }
  },

  async checkUnique(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const invoiceNumber = String(req.query.invoiceNumber || '');
      const financialYearId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;
      res.json(await shipmentsService.checkUniqueInvoice(invoiceNumber, financialYearId));
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentsService.getShipmentById(String(req.params.id));
      if (!shipment) throw new NotFoundError('Shipment not found.');
      res.json(shipment);
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await shipmentsService.createShipment(req.body, req.user!.id);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async createWithDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const created = await shipmentsService.createShipmentWithDocuments(req.body, files, req.user!.id);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await shipmentsService.updateShipment(String(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async archive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const archived = await shipmentsService.archiveShipment(
        String(req.params.id),
        req.body.reason,
        req.user!.id
      );
      res.json(archived);
    } catch (err) {
      next(err);
    }
  },

  async restore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const restored = await shipmentsService.restoreShipment(String(req.params.id));
      res.json(restored);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await shipmentsService.deleteShipment(String(req.params.id)));
    } catch (err) {
      next(err);
    }
  },
};
