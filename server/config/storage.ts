/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { ForbiddenError } from '../shared/errors/app-error.ts';
import { getCurrentIndianFinancialYearLabel } from '../shared/utils/gstr-period.ts';

export function getStorageDir(): string {
  const dir = process.env.STORAGE_ROOT ? path.resolve(process.env.STORAGE_ROOT) : path.resolve('storage');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getStagingDir(): string {
  const dir = path.resolve(getStorageDir(), 'staging');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function sanitizeFilename(filename: string): string {
  return path.basename(filename || 'document.bin').replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

export function sanitizePathSegment(segment: string): string {
  return (segment || 'GENERAL').replace(/[^A-Z0-9\-_]/gi, '_');
}

/**
 * Ensures any read/write path remains strictly inside STORAGE_ROOT.
 * Resolves symlinks where targets or parent directories exist to prevent escape.
 */
export function resolveSafeStoragePath(storedPath: string): string {
  const storageRoot = getStorageDir();
  const realRoot = fs.existsSync(storageRoot) ? fs.realpathSync(storageRoot) : storageRoot;
  const candidate = path.isAbsolute(storedPath)
    ? path.resolve(storedPath)
    : path.resolve(process.cwd(), storedPath);

  const relative = path.relative(storageRoot, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ForbiddenError('Access denied: document path is outside permitted storage boundaries.');
  }

  let resolvedTarget = candidate;
  if (fs.existsSync(candidate)) {
    resolvedTarget = fs.realpathSync(candidate);
  } else {
    const parentDir = path.dirname(candidate);
    if (fs.existsSync(parentDir)) {
      resolvedTarget = path.join(fs.realpathSync(parentDir), path.basename(candidate));
    }
  }

  const realRelative = path.relative(realRoot, resolvedTarget);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new ForbiddenError('Access denied: document path escapes permitted storage boundaries.');
  }

  return resolvedTarget;
}

export function buildDocumentStoragePath(
  financialYearLabel: string,
  normalizedInvoiceKey: string,
  category: string,
  originalFilename: string
): { absolutePath: string; relativePath: string } {
  const storageRoot = getStorageDir();
  const fyLabel = financialYearLabel || getCurrentIndianFinancialYearLabel();
  const safeYear = `FY${sanitizePathSegment(fyLabel)}`;
  const safeKey = sanitizePathSegment(normalizedInvoiceKey || 'GENERAL');
  const targetDir = path.resolve(storageRoot, safeYear, safeKey);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeName = `${category.toLowerCase()}_${Date.now()}_${sanitizeFilename(originalFilename)}`;
  const absolutePath = path.resolve(targetDir, safeName);
  resolveSafeStoragePath(absolutePath);

  return {
    absolutePath,
    relativePath: path.relative(process.cwd(), absolutePath),
  };
}
