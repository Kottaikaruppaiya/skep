/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import multer from 'multer';
import { env } from '../config/env.ts';
import { ValidationError } from '../shared/errors/app-error.ts';

const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.doc', '.docx']);
const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]);

const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xls', '.csv']);
const SPREADSHEET_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream',
]);

function buildFileFilter(allowedExts: Set<string>, allowedMimes: Set<string>, label: string): multer.Options['fileFilter'] {
  return (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (!ext || !allowedExts.has(ext)) {
      return cb(new ValidationError(`Unsupported ${label} file extension "${ext || 'none'}". Allowed: ${Array.from(allowedExts).join(', ')}`));
    }

    if (mime && !allowedMimes.has(mime)) {
      return cb(new ValidationError(`Unsupported ${label} MIME type "${mime}".`));
    }

    cb(null, true);
  };
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxOcrFileSizeMb * 1024 * 1024 },
  fileFilter: buildFileFilter(DOCUMENT_EXTENSIONS, DOCUMENT_MIMES, 'document'),
});

export const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxOcrFileSizeMb * 1024 * 1024 },
  fileFilter: buildFileFilter(SPREADSHEET_EXTENSIONS, SPREADSHEET_MIMES, 'spreadsheet'),
});

export const uploadMiddleware = upload;
