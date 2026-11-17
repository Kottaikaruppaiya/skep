/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../shared/errors/app-error.ts';

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.') || 'input'}: ${firstIssue.message}`
      : 'Validation failed.';
    return res.status(400).json({
      success: false,
      error: message,
      code: 'VALIDATION_ERROR',
      details: err.issues,
    });
  }

  if (err instanceof MulterError) {
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
      code: 'UPLOAD_ERROR',
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Duplicate record violates a unique constraint.',
        code: 'DUPLICATE_RECORD',
      });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        success: false,
        error: 'Operation blocked by relational reference constraint.',
        code: 'FOREIGN_KEY_CONSTRAINT',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Requested record was not found.',
        code: 'NOT_FOUND',
      });
    }
  }

  const message =
    err instanceof Error && process.env.NODE_ENV !== 'production'
      ? err.message
      : 'An unexpected internal error occurred.';

  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

  return res.status(500).json({
    success: false,
    error: message,
    code: 'INTERNAL_ERROR',
  });
}
