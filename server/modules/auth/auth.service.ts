/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jwt from 'jsonwebtoken';
import type { User } from '../../../src/types/index.ts';
import { getJwtSecret } from '../../config/env.ts';
import { UnauthorizedError } from '../../shared/errors/app-error.ts';
import { hashPassword, needsPasswordRehash, verifyPassword } from '../../shared/utils/password.ts';
import { authRepository } from './auth.repository.ts';

export interface JwtPayload {
  id: string;
  email: string;
  role: User['role'];
  name: string;
  iat?: number;
  exp?: number;
}

export const authService = {
  generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const userWithHash = await authRepository.findUserByEmail(email);
    if (!userWithHash || !userWithHash.isActive) {
      throw new UnauthorizedError('Invalid credentials or inactive account.');
    }

    if (!verifyPassword(password, userWithHash.passwordHash)) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    // Upgrade legacy static-salt password hash transparently upon successful login
    if (needsPasswordRehash(userWithHash.passwordHash)) {
      await authRepository.updatePasswordHash(userWithHash.id, hashPassword(password));
    }

    const { passwordHash: _ph, tokenValidAfter: _tva, ...user } = userWithHash;
    const token = this.generateToken(user);
    return { token, user };
  },

  async logout(token: string | undefined, userId: string | undefined): Promise<{ success: boolean; message: string }> {
    if (token && userId) {
      let expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      try {
        const decoded = jwt.decode(token) as JwtPayload | null;
        if (decoded?.exp) {
          expiresAt = new Date(decoded.exp * 1000);
        }
      } catch {
        // Fallback 7d expiry
      }
      await authRepository.revokeToken(token, userId, expiresAt);
      await authRepository.pruneExpiredRevokedTokens();
    }
    return { success: true, message: 'Session revoked and logged out successfully.' };
  },

  async verifySessionToken(token: string): Promise<User> {
    // Fail-closed: check revocation store first; DB failures deny authentication
    let revoked = false;
    try {
      revoked = await authRepository.isTokenRevoked(token);
    } catch {
      throw new UnauthorizedError('Unable to verify session revocation status. Please try again.');
    }

    if (revoked) {
      throw new UnauthorizedError('Session has been revoked or logged out. Please sign in again.');
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid, expired, or revoked session token.');
    }

    const userRecord = await authRepository.findUserById(decoded.id);
    if (!userRecord || !userRecord.isActive) {
      throw new UnauthorizedError('User session expired or account deactivated.');
    }

    if (userRecord.tokenValidAfter && decoded.iat) {
      if (decoded.iat * 1000 < userRecord.tokenValidAfter.getTime()) {
        throw new UnauthorizedError('All sessions for this account were revoked. Please sign in again.');
      }
    }

    const { tokenValidAfter: _tva, ...user } = userRecord;
    return user;
  },
};
