/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import { isDatabaseConfigured, isDatabaseReachable, isMockDatabaseAllowed } from '../config/prisma.ts';
import { ServiceUnavailableError } from '../shared/errors/app-error.ts';

export async function requireDatabase(_req: Request, _res: Response, next: NextFunction) {
  if (!isDatabaseConfigured()) {
    if (isMockDatabaseAllowed()) {
      return next();
    }
    return next(
      new ServiceUnavailableError(
        'PostgreSQL database is not configured. Set DATABASE_URL to connect.',
        'DATABASE_UNCONFIGURED'
      )
    );
  }

  if (!(await isDatabaseReachable(400))) {
    return next(
      new ServiceUnavailableError(
        'PostgreSQL database server is currently unreachable. Start PostgreSQL or verify DATABASE_URL.',
        'DATABASE_UNREACHABLE'
      )
    );
  }

  next();
}
