/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.ts';
import { env } from './server/config/env.ts';
import {
  checkDatabaseHealth,
  disconnectPrisma,
  isDatabaseConfigured,
} from './server/config/prisma.ts';
import { seedService } from './server/modules/settings/seed.service.ts';
import { ocrWorker } from './server/workers/ocr.worker.ts';

async function activateDatabaseServices(): Promise<boolean> {
  const health = await checkDatabaseHealth();
  if (health !== 'connected') {
    return false;
  }

  try {
    await seedService.seedIfEmpty();
  } catch (err) {
    console.warn(
      '[SKE Server] Database auto-seed skipped or deferred:',
      err instanceof Error ? err.message : err
    );
  }
  ocrWorker.startPolling();
  return true;
}

async function startServer() {
  const app = createApp();
  const PORT = env.port;
  let standbyRetryTimer: NodeJS.Timeout | null = null;

  if (isDatabaseConfigured()) {
    const ready = await activateDatabaseServices();
    if (!ready) {
      console.warn(
        '[SKE Server] PostgreSQL is currently unreachable — running in standby mode (/health returns degraded 503, /api/* fails closed) until database becomes available.'
      );
      standbyRetryTimer = setInterval(() => {
        void activateDatabaseServices().then((connected) => {
          if (connected && standbyRetryTimer) {
            clearInterval(standbyRetryTimer);
            standbyRetryTimer = null;
            console.log('[SKE Server] PostgreSQL connection established; seed check and OCR worker polling activated.');
          }
        });
      }, 15000);
      if (typeof standbyRetryTimer.unref === 'function') {
        standbyRetryTimer.unref();
      }
    }
  } else {
    console.warn(
      '[SKE Server] DATABASE_URL not configured — running in unconfigured standby mode (/health ready, /api/* returns 503 DATABASE_UNCONFIGURED).'
    );
  }

  // Mount Vite middleware for dev or static files for prod
  if (env.isProduction) {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SKE Server] Running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[SKE Server] Received ${signal}, shutting down gracefully...`);
    if (standbyRetryTimer) {
      clearInterval(standbyRetryTimer);
      standbyRetryTimer = null;
    }
    ocrWorker.stopPolling();
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

startServer().catch((err) => {
  console.error('[SKE Server] Fatal initialization error:', err);
  process.exit(1);
});
