/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { paymentsController } from './payments.controller.ts';
import { allocatePaymentSchema, createPaymentSchema, updatePaymentSchema } from './payments.validator.ts';

export const paymentsRouter = express.Router();

paymentsRouter.get('/', authenticate, paymentsController.list);
paymentsRouter.get('/:id', authenticate, paymentsController.getById);
paymentsRouter.post('/', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), validateBody(createPaymentSchema), paymentsController.create);
paymentsRouter.put('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), validateBody(updatePaymentSchema), paymentsController.update);
paymentsRouter.delete('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), paymentsController.remove);

paymentsRouter.post('/allocate', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), validateBody(allocatePaymentSchema), paymentsController.allocate);
paymentsRouter.delete('/allocations/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), paymentsController.deallocate);

export const allocationsRouter = express.Router();
allocationsRouter.post('/', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), validateBody(allocatePaymentSchema), paymentsController.allocate);
allocationsRouter.delete('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), paymentsController.deallocate);

