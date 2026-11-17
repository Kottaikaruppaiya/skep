/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkDatabaseHealth,
  disconnectPrisma,
  getPrisma,
  isDatabaseConfigured,
} from '../../server/config/prisma.ts';
import { ocrRepository } from '../../server/modules/ocr/ocr.repository.ts';

async function canRunDbTests(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  return (await checkDatabaseHealth()) === 'connected';
}

test('PostgreSQL OCR job leasing uses FOR UPDATE SKIP LOCKED safely across concurrent claims', async (t) => {
  if (!(await canRunDbTests())) {
    t.skip('PostgreSQL DATABASE_URL is not connected in this environment.');
    return;
  }

  const prisma = getPrisma();
  const suffix = Date.now().toString(36);
  const fyId = `fy-test-${suffix}`;
  const jobId = `ocr-test-${suffix}`;

  await prisma.financialYear.create({
    data: {
      id: fyId,
      label: `TEST-${suffix}`,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: false,
    },
  });

  try {
    await ocrRepository.create({
      id: jobId,
      originalFilename: `test-inv-${suffix}.pdf`,
      fileSizeBytes: 2048,
      category: 'COMMERCIAL_INVOICE',
      financialYearId: fyId,
      maxAttempts: 2,
    });

    const [claimA, claimB] = await Promise.all([
      ocrRepository.claimNextJob('worker-a', 30000),
      ocrRepository.claimNextJob('worker-b', 30000),
    ]);

    const claimed = [claimA, claimB].filter((c) => c?.id === jobId);
    assert.equal(claimed.length, 1, 'Exactly one concurrent worker should claim the OCR job');

    const winner = claimed[0]!;
    const winnerId = winner.lockedByWorkerId!;
    const loserId = winnerId === 'worker-a' ? 'worker-b' : 'worker-a';

    const renewed = await ocrRepository.renewLease(jobId, winnerId, 30000);
    assert.equal(renewed, true);

    const staleRenew = await ocrRepository.renewLease(jobId, loserId, 30000);
    assert.equal(staleRenew, false);

    await assert.rejects(() =>
      ocrRepository.completeJob(jobId, loserId, { executionTimeMs: 50 })
    );

    const completed = await ocrRepository.completeJob(jobId, winnerId, {
      executionTimeMs: 120,
      extractionMethod: 'PDF_TEXT',
      ocrApplied: false,
    });
    assert.equal(completed.status, 'COMPLETED');
  } finally {
    await prisma.ocrJob.deleteMany({ where: { id: jobId } });
    await prisma.financialYear.deleteMany({ where: { id: fyId } });
    await disconnectPrisma();
  }
});
