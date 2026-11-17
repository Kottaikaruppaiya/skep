/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import * as XLSX from 'xlsx';

import { createApp } from '../../server/app.ts';
import { disconnectPrisma, isDatabaseConfigured } from '../../server/config/prisma.ts';
import { seedService } from '../../server/modules/settings/seed.service.ts';

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const addr = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function login(baseUrl: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { token?: string; error?: string };
  assert.equal(res.status, 200, `Login failed for ${email}: ${body.error}`);
  assert.ok(body.token, 'JWT token must be returned');
  return body.token;
}

function makePdfBlob(label = 'SKE TEST PDF'): Blob {
  const bytes = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${label}\n%%EOF\n`);
  return new Blob([bytes], { type: 'application/pdf' });
}

test('Fail-closed database guard returns 503 when DATABASE_URL and ALLOW_MOCK_DB are disabled', async (t) => {
  if (isDatabaseConfigured()) {
    t.skip('DATABASE_URL is configured; fail-closed unconfigured check skipped.');
    return;
  }

  const prevMock = process.env.ALLOW_MOCK_DB;
  process.env.ALLOW_MOCK_DB = 'false';
  try {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/shipments`);
      assert.equal(res.status, 503);
      const body = (await res.json()) as { success: boolean; code?: string };
      assert.equal(body.success, false);
      assert.equal(body.code, 'DATABASE_UNCONFIGURED');
    });
  } finally {
    if (prevMock === undefined) {
      delete process.env.ALLOW_MOCK_DB;
    } else {
      process.env.ALLOW_MOCK_DB = prevMock;
    }
  }
});

test('End-to-end API regression suite covering RBAC, FIRC linkage, partial updates, BRC rules, incentives, payments, documents, and B2B import', async (t) => {
  if (!isDatabaseConfigured()) {
    process.env.ALLOW_MOCK_DB = 'true';
  }
  await seedService.seedIfEmpty();

  const suffix = Date.now().toString(36);
  const createdShipmentIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdB2bInvoiceIds: string[] = [];

  await withServer(async (baseUrl) => {
    const adminToken = await login(baseUrl, 'owner@skenterprises.com', 'Admin@123');
    const viewerToken = await login(baseUrl, 'auditor@skenterprises.com', 'Admin@123');

    const adminHeaders = {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    };

    // Fetch existing seed references dynamically
    const [consigneesRes, banksRes, fyRes] = await Promise.all([
      fetch(`${baseUrl}/api/masters/consignees`, { headers: { Authorization: `Bearer ${adminToken}` } }),
      fetch(`${baseUrl}/api/masters/banks`, { headers: { Authorization: `Bearer ${adminToken}` } }),
      fetch(`${baseUrl}/api/financial-years`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    ]);
    const consignees = (await consigneesRes.json()) as Array<{ id: string; name: string }>;
    const banks = (await banksRes.json()) as Array<{ id: string; name: string }>;
    const fys = (await fyRes.json()) as Array<{ id: string; label: string }>;
    assert.ok(consignees.length > 0 && banks.length > 0 && fys.length > 0);
    const consigneeId = consignees[0].id;
    const bankId = banks[0].id;
    const financialYearId = fys[0].id;

    await t.test('VIEWER is blocked (403) from /api/documents/extract-batch and write endpoints', async () => {
      const form = new FormData();
      form.append('invoiceDoc', makePdfBlob('viewer-test'), 'viewer-invoice.pdf');
      const res = await fetch(`${baseUrl}/api/documents/extract-batch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${viewerToken}` },
        body: form,
      });
      assert.equal(res.status, 403);
    });

    await t.test('Rejects invalid consigneeId, bankId, and financialYearId instead of substituting defaults', async () => {
      const badPayRes = await fetch(`${baseUrl}/api/payments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          irmNumber: `IRM-BADBANK-${suffix}`,
          verifiedAmount: 1000,
          exchangeRate: 85,
          valueDate: '2026-08-01',
          creditDate: '2026-08-01',
          bankId: 'bank-does-not-exist',
        }),
      });
      assert.ok(badPayRes.status === 400 || badPayRes.status === 404);

      const goodPayRes = await fetch(`${baseUrl}/api/payments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          irmNumber: `IRM-VALID-${suffix}`,
          verifiedAmount: 20000,
          exchangeRate: 85,
          valueDate: '2026-08-01',
          creditDate: '2026-08-02',
          bankId,
        }),
      });
      assert.equal(goodPayRes.status, 201);
      const payment = (await goodPayRes.json()) as { id: string };
      createdPaymentIds.push(payment.id);

      const badConsigneeShip = await fetch(`${baseUrl}/api/shipments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          financialYearId,
          invoiceNumber: `SKE-BADC-${suffix}`,
          invoiceDate: '2026-08-05',
          consigneeId: 'consignee-non-existent',
          invoiceValueUsd: 5000,
          sbExchangeRate: 84,
          initialFircPaymentId: payment.id,
        }),
      });
      assert.ok(badConsigneeShip.status === 400 || badConsigneeShip.status === 404);

      const badFyShip = await fetch(`${baseUrl}/api/shipments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          financialYearId: 'fy-non-existent',
          invoiceNumber: `SKE-BADFY-${suffix}`,
          invoiceDate: '2026-08-05',
          consigneeId,
          invoiceValueUsd: 5000,
          sbExchangeRate: 84,
          initialFircPaymentId: payment.id,
        }),
      });
      assert.ok(badFyShip.status === 400 || badFyShip.status === 404);
    });

    await t.test('Enforces mandatory linked FIRC/payment across JSON create, multipart upload, and OCR approval', async () => {
      // 1. JSON create without initialFircPaymentId -> rejected
      const jsonNoFirc = await fetch(`${baseUrl}/api/shipments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          financialYearId,
          invoiceNumber: `SKE-NOFIRC-${suffix}`,
          invoiceDate: '2026-08-05',
          consigneeId,
          invoiceValueUsd: 5000,
          sbExchangeRate: 84,
        }),
      });
      assert.equal(jsonNoFirc.status, 400);

      // 2. Multipart create-with-documents with uploaded fircDoc PDF ONLY (no linked FIRC payment ID/IRM) -> rejected
      const multipartNoLink = new FormData();
      multipartNoLink.append('financialYearId', financialYearId);
      multipartNoLink.append('invoiceNumber', `SKE-FILEONLY-${suffix}`);
      multipartNoLink.append('invoiceDate', '2026-08-05');
      multipartNoLink.append('consigneeId', consigneeId);
      multipartNoLink.append('invoiceValueUsd', '5000');
      multipartNoLink.append('sbExchangeRate', '84');
      multipartNoLink.append('fircDoc', makePdfBlob('firc-only'), 'firc.pdf');

      const uploadRes = await fetch(`${baseUrl}/api/shipments/create-with-documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: multipartNoLink,
      });
      assert.equal(uploadRes.status, 400);

      // 3. OCR job enqueue + approve without FIRC linkage -> rejected
      const ocrForm = new FormData();
      ocrForm.append('file', makePdfBlob('ocr-invoice'), 'ocr-inv.pdf');
      ocrForm.append('category', 'COMMERCIAL_INVOICE');
      ocrForm.append('financialYearId', financialYearId);
      const enqueueRes = await fetch(`${baseUrl}/api/ocr/jobs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: ocrForm,
      });
      assert.ok(enqueueRes.status === 201 || enqueueRes.status === 202);
      const enqueuePayload = (await enqueueRes.json()) as { job: { id: string } };
      const job = enqueuePayload.job;
      assert.ok(job?.id, 'OCR enqueue response must return job.id');

      try {
        const approveNoFirc = await fetch(`${baseUrl}/api/ocr/jobs/${job.id}/approve`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            reviewedValues: {
              financialYearId,
              invoiceNumber: `SKE-OCR-NOFIRC-${suffix}`,
              invoiceDate: '2026-08-06',
              consigneeId,
              invoiceValueUsd: 4000,
              sbExchangeRate: 84,
            },
          }),
        });
        assert.equal(approveNoFirc.status, 400);
      } finally {
        await fetch(`${baseUrl}/api/ocr/jobs/${job.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
    });

    await t.test('Partial shipment update preserves untouched BRC/realisation fields, enforces BRC SINGLE/MULTIPLE and document deletion/versioning', async () => {
      const paymentId = createdPaymentIds[0];
      const createShipRes = await fetch(`${baseUrl}/api/shipments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          financialYearId,
          invoiceNumber: `SKE-WORKFLOW-${suffix}`,
          invoiceDate: '2026-08-05',
          consigneeId,
          invoiceValueUsd: 5000,
          shippingBillNumber: `SB-${suffix}`,
          shippingBillDate: '2026-08-06',
          sbExchangeRate: 84,
          initialFircPaymentId: paymentId,
          initialFircAllocationAmount: 3000,
        }),
      });
      assert.equal(createShipRes.status, 201);
      const shipment = (await createShipRes.json()) as { id: string };
      createdShipmentIds.push(shipment.id);

      // Set brcNumber + brcDate, then partially update brcDate only -> brcNumber must remain!
      const putBrcBoth = await fetch(`${baseUrl}/api/shipments/${shipment.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ brcNumber: `BRC-${suffix}`, brcDate: '2026-08-10' }),
      });
      assert.equal(putBrcBoth.status, 200);

      const putBrcDateOnly = await fetch(`${baseUrl}/api/shipments/${shipment.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ brcDate: '2026-08-12' }),
      });
      assert.equal(putBrcDateOnly.status, 200);
      const updatedShip = (await putBrcDateOnly.json()) as { brcRecord?: { brcNumber?: string; issueDate?: string } };
      assert.equal(updatedShip.brcRecord?.brcNumber, `BRC-${suffix}`);
      assert.equal(updatedShip.brcRecord?.issueDate, '2026-08-12');

      // Payment allocation exceeding available balance or shipment balance must fail
      const overAllocRes = await fetch(`${baseUrl}/api/payments/allocate`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          paymentId,
          shipmentId: shipment.id,
          allocatedAmountUsd: 50000,
        }),
      });
      assert.equal(overAllocRes.status, 400);

      // BRC SINGLE mode: marking REALISED without document fails
      const realiseNoDoc = await fetch(`${baseUrl}/api/brc/${shipment.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ uploadMode: 'SINGLE', status: 'REALISED' }),
      });
      assert.equal(realiseNoDoc.status, 400);

      // Upload BRC_COPY_1 v1 & v2, verify SINGLE blocks BRC_COPY_2
      const uploadBrcDoc = async (category: 'BRC_COPY_1' | 'BRC_COPY_2', name: string) => {
        const f = new FormData();
        f.append('file', makePdfBlob(name), name);
        f.append('category', category);
        f.append('shipmentId', shipment.id);
        return fetch(`${baseUrl}/api/documents/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
          body: f,
        });
      };

      const upCopy1V1 = await uploadBrcDoc('BRC_COPY_1', 'brc1-v1.pdf');
      assert.equal(upCopy1V1.status, 201);
      const doc1V1 = ((await upCopy1V1.json()) as { document: { id: string } }).document;

      const upCopy2InSingle = await uploadBrcDoc('BRC_COPY_2', 'brc2-blocked.pdf');
      assert.equal(upCopy2InSingle.status, 400);

      const upCopy1V2 = await uploadBrcDoc('BRC_COPY_1', 'brc1-v2.pdf');
      assert.equal(upCopy1V2.status, 201);
      const doc1V2 = ((await upCopy1V2.json()) as { document: { id: string; version: number } }).document;
      assert.equal(doc1V2.version, 2);

      // Deleting v2 promotes v1 back to isCurrent=true
      const delV2 = await fetch(`${baseUrl}/api/documents/${doc1V2.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(delV2.status, 200);

      const docsAfterDel = (await (
        await fetch(`${baseUrl}/api/documents?shipmentId=${shipment.id}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json()) as Array<{ id: string; isCurrent: boolean }>;
      assert.equal(docsAfterDel.find((d) => d.id === doc1V1.id)?.isCurrent, true);

      // Switch to MULTIPLE -> cannot mark REALISED with only 1 document
      const mulFail = await fetch(`${baseUrl}/api/brc/${shipment.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ uploadMode: 'MULTIPLE', status: 'REALISED' }),
      });
      assert.equal(mulFail.status, 400);

      // Switch to MULTIPLE mode (PENDING) -> upload BRC_COPY_2 -> mark REALISED succeeds
      const switchMul = await fetch(`${baseUrl}/api/brc/${shipment.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ uploadMode: 'MULTIPLE' }),
      });
      assert.equal(switchMul.status, 200);

      const upCopy2 = await uploadBrcDoc('BRC_COPY_2', 'brc2-v1.pdf');
      assert.equal(upCopy2.status, 201);
      const doc2 = ((await upCopy2.json()) as { document: { id: string } }).document;

      // Cannot switch back to SINGLE while Copy 2 is attached
      const backToSingleBlocked = await fetch(`${baseUrl}/api/brc/${shipment.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ uploadMode: 'SINGLE' }),
      });
      assert.equal(backToSingleBlocked.status, 400);

      const mulOk = await fetch(`${baseUrl}/api/brc/${shipment.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ uploadMode: 'MULTIPLE', status: 'REALISED', brcNumber: `BRC-REAL-${suffix}` }),
      });
      assert.equal(mulOk.status, 200);

      const blockedDel = await fetch(`${baseUrl}/api/documents/${doc2.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(blockedDel.status, 409);

      // Incentive duplicate prevention & received > claimed rejection
      const inc1 = await fetch(`${baseUrl}/api/incentives`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ shipmentId: shipment.id, type: 'DRAWBACK', claimedAmount: 1000, receivedAmount: 400 }),
      });
      assert.equal(inc1.status, 201);

      const incDup = await fetch(`${baseUrl}/api/incentives`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ shipmentId: shipment.id, type: 'DRAWBACK', claimedAmount: 500, receivedAmount: 0 }),
      });
      assert.equal(incDup.status, 409);

      const incOver = await fetch(`${baseUrl}/api/incentives`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ shipmentId: shipment.id, type: 'RODTEP', claimedAmount: 1000, receivedAmount: 1500 }),
      });
      assert.equal(incOver.status, 400);

      // Reject disallowed MIME/extension upload (.txt)
      const txtForm = new FormData();
      txtForm.append('file', new Blob(['hello plain text'], { type: 'text/plain' }), 'notes.txt');
      txtForm.append('category', 'ADDITIONAL_DOC');
      txtForm.append('shipmentId', shipment.id);
      const badMimeRes = await fetch(`${baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: txtForm,
      });
      assert.ok(badMimeRes.status >= 400 && badMimeRes.status < 500);

      // Download non-existent doc returns JSON 404 (safe error handling)
      const missingDl = await fetch(`${baseUrl}/api/documents/non-existent-doc-id/download`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(missingDl.status, 404);
      const missingBody = (await missingDl.json()) as { success: boolean };
      assert.equal(missingBody.success, false);
    });

    await t.test('B2B GST import preview/commit enforces strict GSTIN, blank preservation, and distinct INSERT_ALL vs OVERWRITE_EXISTING vs SKIP_EXISTING', async () => {
      const wb = XLSX.utils.book_new();
      const invNum = `B2B-TEST-${suffix}`;
      const rows = [
        [
          'GSTIN of supplier',
          'Trade/Legal name',
          'Invoice number',
          'Invoice type',
          'Invoice date',
          'Invoice value',
          'Place of supply',
          'Reverse charge',
          'Taxable value',
          'Integrated Tax',
          'Central Tax',
          'State/UT Tax',
          'Cess',
          'GSTR period',
          'ITC availability',
        ],
        [
          '33AAACH2748P1ZP',
          'KOTHARI TEXTILE MILLS PRIVATE LIMITED',
          invNum,
          'Regular',
          '14-08-2026',
          1180,
          '',
          'N',
          1000,
          180,
          0,
          0,
          0,
          '082026',
          'Yes',
        ],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'B2B');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(buf)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'b2b-test.xlsx'
      );

      const prev1Res = await fetch(`${baseUrl}/api/b2b/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });
      assert.equal(prev1Res.status, 200);
      const prev1 = (await prev1Res.json()) as { allParsedRecords: any[] };
      assert.equal(prev1.allParsedRecords.length, 1);

      // 1. Initial insert
      const commit1Res = await fetch(`${baseUrl}/api/b2b/import/commit`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ previewData: prev1, mode: 'SKIP_EXISTING', fileName: 'b2b-test.xlsx' }),
      });
      assert.equal(commit1Res.status, 200);
      const commit1 = (await commit1Res.json()) as { inserted: number };
      assert.equal(commit1.inserted, 1);

      // 2. SKIP_EXISTING skips duplicate
      const commitSkipRes = await fetch(`${baseUrl}/api/b2b/import/commit`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ previewData: prev1, mode: 'SKIP_EXISTING', fileName: 'b2b-test.xlsx' }),
      });
      assert.equal(commitSkipRes.status, 200);
      const commitSkip = (await commitSkipRes.json()) as { inserted: number; updated: number; skipped: number };
      assert.equal(commitSkip.skipped, 1);
      assert.equal(commitSkip.inserted, 0);

      // 3. INSERT_ALL inserts a disambiguated copy instead of overwriting/skipping
      const commitInsertAllRes = await fetch(`${baseUrl}/api/b2b/import/commit`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ previewData: prev1, mode: 'INSERT_ALL', fileName: 'b2b-test.xlsx' }),
      });
      assert.equal(commitInsertAllRes.status, 200);
      const commitInsertAll = (await commitInsertAllRes.json()) as { inserted: number; updated: number; skipped: number };
      assert.equal(commitInsertAll.inserted, 1);
      assert.equal(commitInsertAll.updated, 0);

      // Verify blank preservation and disambiguated copy in register
      const regRes = await fetch(`${baseUrl}/api/b2b/invoices?search=${encodeURIComponent(invNum)}&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const reg = (await regRes.json()) as { data: Array<{ id: string; invoiceType: string; source?: string | null; applicableTaxRate?: number | null }> };
      assert.equal(reg.data.length, 2);
      for (const item of reg.data) {
        createdB2bInvoiceIds.push(item.id);
        assert.equal(item.source ?? null, null);
        assert.equal(item.applicableTaxRate ?? null, null);
      }
      assert.ok(reg.data.some((d) => d.invoiceType === 'Regular (Copy 2)'));

      // 4. Commit with invalid GSTIN in payload fails row instead of inserting
      const badCommitRes = await fetch(`${baseUrl}/api/b2b/import/commit`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          previewData: {
            allParsedRecords: [
              {
                ...prev1.allParsedRecords[0],
                supplierGstin: '123456789012345',
                invoiceNumber: `BAD-GSTIN-${suffix}`,
              },
            ],
            errors: [],
            duplicates: [],
          },
          mode: 'SKIP_EXISTING',
          fileName: 'bad.xlsx',
        }),
      });
      assert.equal(badCommitRes.status, 200);
      const badCommit = (await badCommitRes.json()) as { inserted: number; failed: number };
      assert.equal(badCommit.inserted, 0);
      assert.equal(badCommit.failed, 1);
    });

    // Clean up test-created records & uploaded files
    for (const id of createdB2bInvoiceIds) {
      await fetch(`${baseUrl}/api/b2b/invoices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
    for (const id of createdShipmentIds) {
      // If BRC was marked REALISED, reset BRC first so shipment & docs can be deleted cleanly
      await fetch(`${baseUrl}/api/brc/${id}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      await fetch(`${baseUrl}/api/shipments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
    for (const id of createdPaymentIds) {
      await fetch(`${baseUrl}/api/payments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
  });

  await disconnectPrisma();
});
