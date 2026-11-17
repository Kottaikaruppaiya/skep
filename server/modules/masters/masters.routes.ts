/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { mastersController } from './masters.controller.ts';
import {
  createBankSchema,
  createConsigneeSchema,
  updateBankSchema,
  updateConsigneeSchema,
} from './masters.validator.ts';

export const financialYearsRouter = express.Router();
financialYearsRouter.get('/', authenticate, mastersController.listFinancialYears);

export const consigneesRouter = express.Router();
consigneesRouter.get('/', authenticate, mastersController.listConsignees);
consigneesRouter.post('/', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), validateBody(createConsigneeSchema), mastersController.createConsignee);
consigneesRouter.put('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), validateBody(updateConsigneeSchema), mastersController.updateConsignee);
consigneesRouter.delete('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), mastersController.deleteConsignee);

export const banksRouter = express.Router();
banksRouter.get('/', authenticate, mastersController.listBanks);
banksRouter.post('/', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), validateBody(createBankSchema), mastersController.createBank);
banksRouter.put('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), validateBody(updateBankSchema), mastersController.updateBank);
banksRouter.delete('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), mastersController.deleteBank);
