/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Role, User } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toIsoString } from '../../shared/utils/date.ts';

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

export const usersRepository = {
  async findAll(db: DbClient = getPrisma()): Promise<User[]> {
    const rows = await db.user.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(mapUser);
  },

  async findById(id: string, db: DbClient = getPrisma()): Promise<User | null> {
    const row = await db.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  },

  async findByEmail(email: string, db: DbClient = getPrisma()): Promise<User | null> {
    const row = await db.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    return row ? mapUser(row) : null;
  },

  async countActiveSuperAdminsExcluding(excludeId: string, db: DbClient = getPrisma()): Promise<number> {
    return db.user.count({
      where: {
        role: 'SUPER_ADMIN',
        isActive: true,
        id: { not: excludeId },
      },
    });
  },

  async create(
    data: { email: string; name: string; role: Role; isActive: boolean; passwordHash: string },
    db: DbClient = getPrisma()
  ): Promise<User> {
    const row = await db.user.create({ data });
    return mapUser(row);
  },

  async update(
    id: string,
    data: Partial<{ email: string; name: string; role: Role; isActive: boolean; passwordHash: string; tokenValidAfter: Date }>,
    db: DbClient = getPrisma()
  ): Promise<User> {
    const row = await db.user.update({ where: { id }, data });
    return mapUser(row);
  },

  async delete(id: string, db: DbClient = getPrisma()): Promise<void> {
    await db.user.delete({ where: { id } });
  },
};
