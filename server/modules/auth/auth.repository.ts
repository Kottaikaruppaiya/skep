/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Role, User } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toIsoString } from '../../shared/utils/date.ts';

export interface AuthUserRecord extends User {
  passwordHash: string;
  tokenValidAfter: Date | null;
}

function mapUser(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export const authRepository = {
  async findUserByEmail(email: string, db: DbClient = getPrisma()): Promise<AuthUserRecord | null> {
    const row = await db.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (!row) return null;
    return {
      ...mapUser(row),
      passwordHash: row.passwordHash,
      tokenValidAfter: row.tokenValidAfter,
    };
  },

  async findUserById(
    id: string,
    db: DbClient = getPrisma()
  ): Promise<(User & { tokenValidAfter: Date | null }) | null> {
    const row = await db.user.findUnique({ where: { id } });
    if (!row) return null;
    return {
      ...mapUser(row),
      tokenValidAfter: row.tokenValidAfter,
    };
  },

  async updatePasswordHash(userId: string, passwordHash: string, db: DbClient = getPrisma()): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  async revokeToken(token: string, userId: string, expiresAt: Date, db: DbClient = getPrisma()): Promise<void> {
    await db.revokedToken.upsert({
      where: { token },
      update: { expiresAt },
      create: {
        token,
        userId,
        expiresAt,
      },
    });
  },

  async isTokenRevoked(token: string, db: DbClient = getPrisma()): Promise<boolean> {
    const record = await db.revokedToken.findUnique({
      where: { token },
      select: { id: true },
    });
    return Boolean(record);
  },

  async pruneExpiredRevokedTokens(db: DbClient = getPrisma()): Promise<number> {
    const result = await db.revokedToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  },

  async revokeAllUserSessions(userId: string, db: DbClient = getPrisma()): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { tokenValidAfter: new Date() },
    });
  },
};
