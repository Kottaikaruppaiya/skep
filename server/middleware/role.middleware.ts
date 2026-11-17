/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response, NextFunction } from 'express';
import type { Role, User } from '../../src/types/index.ts';
import type { Request } from 'express';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error.ts';

export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
}

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Permission Denied: Action requires one of [${allowedRoles.join(', ')}]. Your current role is '${req.user.role}'.`
        )
      );
    }

    next();
  };
}
