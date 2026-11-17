/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import { createApp } from '../../server/app.ts';
import {
  checkDatabaseHealth,
  disconnectPrisma,
  isDatabaseConfigured,
  isMockDatabaseAllowed,
} from '../../server/config/prisma.ts';

async function withTestServer(fn: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await disconnectPrisma();
  }
}

test('GET /health responds with database status JSON', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    const body = (await res.json()) as { status: string; database: string };
    assert.ok(res.status === 200 || res.status === 503);
    assert.ok(['connected', 'unconfigured', 'unreachable'].includes(body.database));
  });
});

test('Protected API routes fail closed when unauthenticated or when database is unavailable', async () => {
  const dbHealth = await checkDatabaseHealth();
  const dbReady = dbHealth === 'connected' || (!isDatabaseConfigured() && isMockDatabaseAllowed());
  await withTestServer(async (baseUrl) => {
    const expectedStatuses = dbReady ? [401] : [503];

    const resShipments = await fetch(`${baseUrl}/api/shipments`);
    assert.ok(expectedStatuses.includes(resShipments.status), `Unexpected status ${resShipments.status}`);

    const resDownloadQueryToken = await fetch(`${baseUrl}/api/documents/doc-1/download?token=forged-jwt`);
    assert.ok(expectedStatuses.includes(resDownloadQueryToken.status));

    const resB2b = await fetch(`${baseUrl}/api/b2b/invoices`);
    assert.ok(expectedStatuses.includes(resB2b.status));
  });
});

test('Undefined /api routes return structured JSON 404 or 503 fail-closed error instead of HTML', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/non-existent-endpoint`);
    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /application\/json/i);
    const body = (await res.json()) as { success: boolean; code?: string };
    assert.equal(body.success, false);
  });
});
