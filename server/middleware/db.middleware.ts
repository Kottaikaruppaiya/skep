/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import { isDatabaseConfigured, isDatabaseReachable } from '../config/prisma.ts';
import { ServiceUnavailableError } from '../shared/errors/app-error.ts';

export async function requireDatabase(_req: Request, _res: Response, next: NextFunction) {
  if (!isDatabaseConfigured()) {
    return next(
      new ServiceUnavailableError(
        'PostgreSQL DATABASE_URL is not configured. Configure DATABASE_URL in environment variables to enable database operations.',
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
