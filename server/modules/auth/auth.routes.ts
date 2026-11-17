/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.ts';
import { validateBody } from '../../middleware/validate.middleware.ts';
import { authController } from './auth.controller.ts';
import { loginSchema } from './auth.validator.ts';

export const authRouter = express.Router();

authRouter.post('/login', validateBody(loginSchema), authController.login);
authRouter.post('/logout', authenticate, authController.logout);
authRouter.get('/me', authenticate, authController.me);
