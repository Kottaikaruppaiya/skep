/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { OcrJob } from '../../src/types/index.ts';
import { isDatabaseConfigured, isDatabaseReachable } from '../config/prisma.ts';
import { getStagingDir, resolveSafeStoragePath } from '../config/storage.ts';
import { documentsService } from '../modules/documents/documents.service.ts';
import { extractDocumentData, mergeExtractedDocuments } from '../modules/ocr/ocr.extractor.ts';
import { ocrService } from '../modules/ocr/ocr.service.ts';

const MAX_CONCURRENT_JOBS = Math.max(1, parseInt(process.env.OCR_CONCURRENCY || '2', 10));

export class OcrQueueWorker {
  public readonly workerId: string;
  private activeJobsCount = 0;
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;
  private stagingBufferMap = new Map<string, Buffer>();
  private dbUnavailableLogged = false;

  constructor(workerId?: string, autoStart = false) {
    this.workerId = workerId || `worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
    if (autoStart) {
      this.startPolling();
    }
  }

  public registerStagingBuffer(jobId: string, buffer: Buffer) {
    this.stagingBufferMap.set(jobId, buffer);
  }

  public startPolling(intervalMs = 4000) {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public triggerProcessing() {
    setImmediate(() => {
      void this.tick();
    });
  }

  public async tick(): Promise<void> {
    if (this.isProcessing) return;

    if (isDatabaseConfigured() && !(await isDatabaseReachable(300))) {
      if (!this.dbUnavailableLogged) {
        this.dbUnavailableLogged = true;
        console.warn(`[OCR Worker ${this.workerId}] PostgreSQL unreachable — pausing OCR polling until database connects.`);
      }
      return;
    }
    this.dbUnavailableLogged = false;

    this.isProcessing = true;

    try {
      while (this.activeJobsCount < MAX_CONCURRENT_JOBS) {
        const nextJob = await ocrService.claimNextJob(this.workerId, 60000);
        if (!nextJob) break;

        this.activeJobsCount++;
        void this.processJob(nextJob).finally(() => {
          this.activeJobsCount--;
          this.triggerProcessing();
        });
      }
    } catch (err) {
      console.warn(`[OCR Worker ${this.workerId}] Polling tick error:`, err instanceof Error ? err.message : err);
    } finally {
      this.isProcessing = false;
    }
  }

  public async processJob(job: OcrJob): Promise<void> {
    const startTime = Date.now();
    let heartbeatTimer: NodeJS.Timeout | null = null;

    try {
      heartbeatTimer = setInterval(() => {
        void ocrService.renewLease(job.id, this.workerId, 60000).then((renewed) => {
          if (!renewed) {
            console.warn(`[OCR Worker ${this.workerId}] Failed to renew lease for job ${job.id}`);
          }
        });
      }, 20000);
      if (heartbeatTimer && typeof heartbeatTimer.unref === 'function') {
        heartbeatTimer.unref();
      }

      let buffer: Buffer | null = this.stagingBufferMap.get(job.id) || null;

      if (!buffer && job.documentId) {
        const doc = await documentsService.getDocumentById(job.documentId);
        if (doc && doc.storedPath) {
          try {
            const absPath = resolveSafeStoragePath(doc.storedPath);
            if (fs.existsSync(absPath)) {
              buffer = fs.readFileSync(absPath);
            }
          } catch {}
        }
      }

      if (!buffer) {
        const stagingFile = path.resolve(getStagingDir(), `${job.id}.bin`);
        if (fs.existsSync(stagingFile)) {
          buffer = fs.readFileSync(stagingFile);
        }
      }

      if (!buffer) {
        throw new Error(`Document binary could not be located in storage for OCR Job ${job.id}`);
      }

      const extraction = await extractDocumentData(buffer, job.category, job.originalFilename);
      const executionTimeMs = Date.now() - startTime;

      this.stagingBufferMap.delete(job.id);
      const stagingFile = path.resolve(getStagingDir(), `${job.id}.bin`);
      if (fs.existsSync(stagingFile)) {
        try {
          fs.unlinkSync(stagingFile);
        } catch {}
      }

      const mergedDraft = mergeExtractedDocuments([extraction]);

      await ocrService.completeJob(job.id, this.workerId, {
        executionTimeMs,
        ocrApplied: extraction.ocrApplied,
        ocrConfidence: extraction.ocrConfidence,
        ocrTextPreview: extraction.ocrTextPreview,
        extractionMethod: extraction.extractionMethod,
        candidateFields: extraction.fields,
        candidateDraft: mergedDraft,
      });

      if (job.documentId) {
        await documentsService.linkAndConfirmDocument(job.documentId, {
          reviewStatus: extraction.reviewStatus,
        });
      }
    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      const errorMsg = err?.message || 'Local OCR extraction failed.';
      await ocrService.failJob(job.id, this.workerId, errorMsg, executionTimeMs).catch(() => {});
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }
  }

  public getConcurrencyMetrics() {
    return {
      activeJobs: this.activeJobsCount,
      maxConcurrency: MAX_CONCURRENT_JOBS,
    };
  }
}

export const ocrWorker = new OcrQueueWorker();
