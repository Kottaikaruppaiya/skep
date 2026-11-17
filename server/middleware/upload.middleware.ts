/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import multer from 'multer';
import { env } from '../config/env.ts';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxOcrFileSizeMb * 1024 * 1024 },
});

export const uploadMiddleware = upload;

