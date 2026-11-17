/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { requireRole } from '../../middleware/role.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { usersController } from './users.controller.ts';
import { createUserSchema, updateUserSchema } from './users.validator.ts';

export const usersRouter = express.Router();

usersRouter.use(authenticate, requireRole(['SUPER_ADMIN']));

usersRouter.get('/', usersController.list);
usersRouter.post('/', validateBody(createUserSchema), usersController.create);
usersRouter.put('/:id', validateBody(updateUserSchema), usersController.update);
usersRouter.delete('/:id', usersController.remove);
