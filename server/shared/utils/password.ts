/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

const PBKDF2_PREFIX = 'pbkdf2_sha512';
const PBKDF2_ITERATIONS = 120000;
const KEY_LENGTH = 64;
const LEGACY_STATIC_SALT = 'ske_enterprise_salt_2026';
const LEGACY_ITERATIONS = 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512').toString('hex');
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

export function needsPasswordRehash(storedHash: string): boolean {
  return !storedHash.startsWith(`${PBKDF2_PREFIX}$`);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith(`${PBKDF2_PREFIX}$`)) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const expectedHex = parts[3];
    if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expectedHex) return false;

    const derived = crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha512');
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  // Legacy static-salt PBKDF2 verification (128-char hex) using constant-time comparison
  if (storedHash.length === 128 && /^[0-9a-f]+$/i.test(storedHash)) {
    const derived = crypto.pbkdf2Sync(password, LEGACY_STATIC_SALT, LEGACY_ITERATIONS, KEY_LENGTH, 'sha512');
    const expected = Buffer.from(storedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  return false;
}
