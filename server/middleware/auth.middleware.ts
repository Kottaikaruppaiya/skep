/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import { UnauthorizedError } from '../shared/errors/app-error.ts';
import type { AuthenticatedRequest } from './role.middleware.ts';
export type { AuthenticatedRequest };
import { authService } from '../modules/auth/auth.service.ts';

/**
 * Authenticates requests strictly using Authorization: Bearer <token>.
 * Query-parameter tokens (?token=) are intentionally rejected.
 */
export async function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authentication required. Please sign in with a Bearer token.'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new UnauthorizedError('Authentication required. Please sign in.'));
  }

  try {
    const user = await authService.verifySessionToken(token);
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}
