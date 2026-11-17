/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  buildDocumentStoragePath,
  getStagingDir,
  resolveSafeStoragePath,
} from '../../config/storage.ts';
import { NotFoundError } from '../../shared/errors/app-error.ts';

export const fileStorageService = {
  writeDocumentFile(
    financialYearLabel: string,
    normalizedInvoiceKey: string,
    category: string,
    originalFilename: string,
    buffer: Buffer
  ): { absolutePath: string; relativePath: string } {
    const { absolutePath, relativePath } = buildDocumentStoragePath(
      financialYearLabel,
      normalizedInvoiceKey,
      category,
      originalFilename
    );
    fs.writeFileSync(absolutePath, buffer);
    return { absolutePath, relativePath };
  },

  readDocumentStream(storedPath: string): fs.ReadStream {
    const absPath = resolveSafeStoragePath(storedPath);
    if (!fs.existsSync(absPath)) {
      throw new NotFoundError('Physical document file missing on server.');
    }
    return fs.createReadStream(absPath);
  },

  readDocumentBuffer(storedPath: string): Buffer | null {
    try {
      const absPath = resolveSafeStoragePath(storedPath);
      if (!fs.existsSync(absPath)) return null;
      return fs.readFileSync(absPath);
    } catch {
      return null;
    }
  },

  deletePrivateFile(storedPath: string): void {
    try {
      const absPath = resolveSafeStoragePath(storedPath);
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
    } catch (err) {
      console.warn('[FileStorage] Could not remove file on disk:', err);
    }
  },

  writeStagingFile(jobId: string, buffer: Buffer): string {
    const target = path.resolve(getStagingDir(), `${jobId}.bin`);
    resolveSafeStoragePath(target);
    fs.writeFileSync(target, buffer);
    return target;
  },

  readStagingFile(jobId: string): Buffer | null {
    const target = path.resolve(getStagingDir(), `${jobId}.bin`);
    try {
      resolveSafeStoragePath(target);
      if (fs.existsSync(target)) {
        return fs.readFileSync(target);
      }
    } catch {
      return null;
    }
    return null;
  },

  deleteStagingFile(jobId: string): void {
    const target = path.resolve(getStagingDir(), `${jobId}.bin`);
    try {
      resolveSafeStoragePath(target);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    } catch {
      // Best-effort cleanup
    }
  },
};
