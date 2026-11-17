/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { checkDatabaseHealth } from './config/prisma.ts';
import { requireDatabase } from './middleware/db.middleware.ts';
import { errorMiddleware } from './middleware/error.middleware.ts';
import { authRouter } from './modules/auth/auth.routes.ts';
import { b2bRouter } from './modules/b2b/b2b.routes.ts';
import { brcRouter } from './modules/brc/brc.routes.ts';
import { documentsRouter } from './modules/documents/documents.routes.ts';
import { gstRouter } from './modules/gst/gst.routes.ts';
import { incentivesRouter } from './modules/incentives/incentives.routes.ts';
import { banksRouter, consigneesRouter, financialYearsRouter } from './modules/masters/masters.routes.ts';
import { ocrRouter } from './modules/ocr/ocr.routes.ts';
import { allocationsRouter, paymentsRouter } from './modules/payments/payments.routes.ts';
import { reportsRouter } from './modules/reports/reports.routes.ts';
import { settingsRouter, systemRouter } from './modules/settings/settings.routes.ts';
import { shipmentsRouter } from './modules/shipments/shipments.routes.ts';
import { usersRouter } from './modules/users/users.routes.ts';

function buildApiRouter(): express.Router {
  const apiRouter = express.Router();

  apiRouter.use(requireDatabase);

  apiRouter.use('/auth', authRouter);
  apiRouter.use('/financial-years', financialYearsRouter);
  apiRouter.use('/shipments', shipmentsRouter);
  apiRouter.use('/payments', paymentsRouter);
  apiRouter.use('/allocations', allocationsRouter);
  apiRouter.use('/incentives', incentivesRouter);
  apiRouter.use('/brc', brcRouter);
  apiRouter.use('/ocr', ocrRouter);
  apiRouter.use('/documents', documentsRouter);
  apiRouter.use('/masters/consignees', consigneesRouter);
  apiRouter.use('/masters/banks', banksRouter);
  apiRouter.use('/gst-entries', gstRouter);
  apiRouter.use('/b2b', b2bRouter);
  apiRouter.use('/users', usersRouter);
  apiRouter.use('/settings', settingsRouter);
  apiRouter.use('/system', systemRouter);
  apiRouter.use('/', reportsRouter);

  return apiRouter;
}

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.get('/health', async (_req, res) => {
    const dbStatus = await checkDatabaseHealth();
    const isDegraded = dbStatus === 'unreachable';
    res.status(isDegraded ? 503 : 200).json({
      status: isDegraded ? 'degraded' : 'ok',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  });

  const apiRouter = buildApiRouter();
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // Catch-all for undefined /api routes so they always return JSON, not HTML
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`,
      code: 'ROUTE_NOT_FOUND',
    });
  });

  app.use(errorMiddleware);

  return app;
}
