/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';

const DEFAULT_INSECURE_SECRET = 'ske_export_documents_tracker_secret_key_2026';

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string | undefined;
  jwtSecret: string;
  storageRoot: string;
  maxOcrFileSizeMb: number;
  ocrConcurrency: number;
}

function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const envJwtSecret = process.env.JWT_SECRET?.trim();

  if (isProduction) {
    if (!envJwtSecret || envJwtSecret === DEFAULT_INSECURE_SECRET || envJwtSecret.length < 16) {
      throw new Error(
        '[SKE Config] FATAL: JWT_SECRET must be set to a strong secret (>= 16 chars) in production.'
      );
    }
  } else if (!envJwtSecret) {
    console.warn(
      '[SKE Config] WARNING: JWT_SECRET not set; using development fallback secret. Set JWT_SECRET in .env before production.'
    );
  }

  const port = Math.max(1, parseInt(process.env.PORT || '3000', 10) || 3000);
  const maxOcrFileSizeMb = Math.max(1, parseInt(process.env.MAX_OCR_FILE_SIZE_MB || '50', 10) || 50);
  const ocrConcurrency = Math.max(1, parseInt(process.env.OCR_CONCURRENCY || '2', 10) || 2);
  const storageRoot = process.env.STORAGE_ROOT
    ? path.resolve(process.env.STORAGE_ROOT)
    : path.resolve('storage');

  return {
    nodeEnv,
    isProduction,
    port,
    databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
    jwtSecret: envJwtSecret || DEFAULT_INSECURE_SECRET,
    storageRoot,
    maxOcrFileSizeMb,
    ocrConcurrency,
  };
}

export const env: AppConfig = loadConfig();

export function getJwtSecret(): string {
  const runtimeSecret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!runtimeSecret || runtimeSecret === DEFAULT_INSECURE_SECRET || runtimeSecret.length < 16) {
      throw new Error('[SKE Config] JWT_SECRET is invalid or missing in production.');
    }
    return runtimeSecret;
  }
  return runtimeSecret || env.jwtSecret;
}
