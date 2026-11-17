/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Role, User } from '../../../src/types/index.ts';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { hashPassword } from '../../shared/utils/password.ts';
import { usersRepository } from './users.repository.ts';

export const usersService = {
  async listUsers(): Promise<User[]> {
    return usersRepository.findAll();
  },

  async getUserById(id: string): Promise<User | null> {
    return usersRepository.findById(id);
  },

  async createUser(input: { email: string; name: string; role: Role; password: string; isActive?: boolean }): Promise<User> {
    const cleanEmail = input.email.trim().toLowerCase();
    const existing = await usersRepository.findByEmail(cleanEmail);
    if (existing) {
      throw new ConflictError(`User with email '${cleanEmail}' already exists.`);
    }

    return usersRepository.create({
      email: cleanEmail,
      name: input.name.trim(),
      role: input.role,
      isActive: input.isActive ?? true,
      passwordHash: hashPassword(input.password),
    });
  },

  async updateUser(
    id: string,
    updates: Partial<{ email: string; name: string; role: Role; isActive: boolean; password: string }>
  ): Promise<User> {
    const existing = await usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User not found.');
    }

    if (existing.role === 'SUPER_ADMIN') {
      const wouldRemoveSuperAdmin =
        (updates.role && updates.role !== 'SUPER_ADMIN') || updates.isActive === false;
      if (wouldRemoveSuperAdmin) {
        const remaining = await usersRepository.countActiveSuperAdminsExcluding(id);
        if (remaining === 0) {
          throw new ValidationError('Cannot remove or deactivate the last active SUPER_ADMIN account.');
        }
      }
    }

    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.email !== undefined) {
      const cleanEmail = updates.email.trim().toLowerCase();
      if (cleanEmail !== existing.email.toLowerCase()) {
        const dup = await usersRepository.findByEmail(cleanEmail);
        if (dup && dup.id !== id) {
          throw new ConflictError(`User with email '${cleanEmail}' already exists.`);
        }
      }
      payload.email = cleanEmail;
    }
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.isActive !== undefined) {
      payload.isActive = updates.isActive;
      if (!updates.isActive) payload.tokenValidAfter = new Date();
    }
    if (updates.password && updates.password.trim()) {
      payload.passwordHash = hashPassword(updates.password);
      payload.tokenValidAfter = new Date();
    }

    return usersRepository.update(id, payload);
  },

  async deleteUser(id: string, actorUserId: string): Promise<{ success: boolean }> {
    if (id === actorUserId) {
      throw new ValidationError('Cannot delete your own logged-in user account.');
    }

    const existing = await usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User not found.');
    }

    if (existing.role === 'SUPER_ADMIN') {
      const remaining = await usersRepository.countActiveSuperAdminsExcluding(id);
      if (remaining === 0) {
        throw new ValidationError('Cannot delete the last active SUPER_ADMIN account.');
      }
    }

    await usersRepository.delete(id);
    return { success: true };
  },
};
