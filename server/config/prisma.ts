/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import net from 'net';
import { PrismaClient, Prisma } from '@prisma/client';
import { getMockPrisma } from './mock-prisma.ts';

export type DbClient = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function isMockDatabaseAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_DB === 'true';
}

/**
 * Performs a fast non-invasive TCP reachability check against DATABASE_URL
 * before invoking PrismaClient, preventing noisy `prisma:error` stderr dumps
 * when PostgreSQL is offline or unstarted in preview environments.
 */
export async function isDatabaseReachable(timeoutMs = 500): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const rawUrl = process.env.DATABASE_URL!.trim();

  let host: string;
  let port: number;
  try {
    const parsed = new URL(rawUrl);
    host = parsed.hostname;
    port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    if (!host || !Number.isFinite(port)) {
      return true;
    }
  } catch {
    // Non-standard connection string (e.g. Unix socket); let Prisma attempt directly
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

export function getPrisma(): PrismaClient {
  if (!isDatabaseConfigured()) {
    if (isMockDatabaseAllowed()) {
      return getMockPrisma();
    }
    throw new Error('PostgreSQL database is not configured (DATABASE_URL is missing).');
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn'] : [],
    });
  }

  return globalForPrisma.prisma;
}

export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
): Promise<T> {
  const prisma = getPrisma();
  if (!isDatabaseConfigured()) {
    return fn(prisma as unknown as Prisma.TransactionClient);
  }
  return prisma.$transaction(fn, {
    maxWait: options?.maxWait ?? 10000,
    timeout: options?.timeout ?? 30000,
    isolationLevel: options?.isolationLevel,
  });
}

export async function checkDatabaseHealth(): Promise<'connected' | 'unconfigured' | 'unreachable'> {
  if (!isDatabaseConfigured()) return 'unconfigured';
  if (!(await isDatabaseReachable(500))) return 'unreachable';

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch {
    return 'unreachable';
  }
}

export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}
