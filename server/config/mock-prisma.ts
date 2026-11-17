/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';

type AnyRow = Record<string, any>;

interface InMemoryStore {
  user: AnyRow[];
  financialYear: AnyRow[];
  consigneeMaster: AnyRow[];
  bankMaster: AnyRow[];
  shipment: AnyRow[];
  invoiceItem: AnyRow[];
  payment: AnyRow[];
  paymentAllocation: AnyRow[];
  incentiveRecord: AnyRow[];
  brcRecord: AnyRow[];
  document: AnyRow[];
  gstEntry: AnyRow[];
  supplier: AnyRow[];
  importBatch: AnyRow[];
  b2bInvoice: AnyRow[];
  appSetting: AnyRow[];
  revokedToken: AnyRow[];
  ocrJob: AnyRow[];
}

function toDateRequired(val: any, fallback = new Date()): Date {
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

function toDateOptional(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function loadInitialStore(): InMemoryStore {
  const store: InMemoryStore = {
    user: [],
    financialYear: [],
    consigneeMaster: [],
    bankMaster: [],
    shipment: [],
    invoiceItem: [],
    payment: [],
    paymentAllocation: [],
    incentiveRecord: [],
    brcRecord: [],
    document: [],
    gstEntry: [],
    supplier: [],
    importBatch: [],
    b2bInvoice: [],
    appSetting: [],
    revokedToken: [],
    ocrJob: [],
  };

  const jsonPath = path.resolve('storage/data/db.json');
  if (!fs.existsSync(jsonPath)) {
    return store;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    for (const u of raw.users || []) {
      store.user.push({
        id: u.id || crypto.randomUUID(),
        email: String(u.email).toLowerCase(),
        passwordHash: u.passwordHash,
        name: u.name,
        role: u.role || 'ADMIN',
        isActive: u.isActive ?? true,
        tokenValidAfter: toDateOptional(u.tokenValidAfter),
        createdAt: toDateRequired(u.createdAt),
        updatedAt: toDateRequired(u.updatedAt),
      });
    }

    for (const fy of raw.financialYears || []) {
      store.financialYear.push({
        id: fy.id || crypto.randomUUID(),
        label: fy.label,
        startDate: toDateRequired(fy.startDate),
        endDate: toDateRequired(fy.endDate),
        isCurrent: Boolean(fy.isCurrent),
      });
    }

    for (const c of raw.consignees || []) {
      store.consigneeMaster.push({
        id: c.id || crypto.randomUUID(),
        name: c.name,
        country: c.country || 'International',
        portOfDischarge: c.portOfDischarge ?? null,
        paymentTerms: c.paymentTerms ?? null,
        currency: c.currency || 'USD',
        contactEmail: c.contactEmail ?? null,
        isActive: c.isActive ?? true,
        createdAt: toDateRequired(c.createdAt),
        updatedAt: toDateRequired(c.updatedAt),
      });
    }

    for (const b of raw.banks || []) {
      store.bankMaster.push({
        id: b.id || crypto.randomUUID(),
        name: b.name,
        branch: b.branch ?? null,
        adCode: b.adCode ?? null,
        ifscCode: b.ifscCode ?? null,
        swiftCode: b.swiftCode ?? null,
        accountNumber: b.accountNumber ?? null,
        isActive: b.isActive ?? true,
        createdAt: toDateRequired(b.createdAt),
        updatedAt: toDateRequired(b.updatedAt),
      });
    }

    for (const s of raw.shipments || []) {
      store.shipment.push({
        id: s.id || crypto.randomUUID(),
        financialYearId: s.financialYearId,
        invoiceNumber: s.invoiceNumber,
        normalizedInvoiceKey: s.normalizedInvoiceKey,
        invoiceDate: toDateRequired(s.invoiceDate),
        consigneeId: s.consigneeId,
        portCode: s.portCode || 'INNSA1',
        packageCount: s.packageCount ?? 0,
        invoiceValueUsd: Number(s.invoiceValueUsd || 0),
        shippingBillNumber: s.shippingBillNumber || 'PENDING',
        shippingBillDate: toDateRequired(s.shippingBillDate || s.invoiceDate),
        sbExchangeRate: Number(s.sbExchangeRate || 0),
        fobValueInr: Number(s.fobValueInr || 0),
        blNumber: s.blNumber ?? null,
        blDate: toDateOptional(s.blDate),
        vesselName: s.vesselName ?? null,
        paymentStatus: s.paymentStatus || 'UNPAID',
        reviewStatus: s.reviewStatus || 'CONFIRMED',
        remarks: s.remarks ?? null,
        isArchived: Boolean(s.isArchived),
        archivedAt: toDateOptional(s.archivedAt),
        archivedReason: s.archivedReason ?? null,
        archivedBy: s.archivedBy ?? null,
        createdAt: toDateRequired(s.createdAt),
        updatedAt: toDateRequired(s.updatedAt),
      });
    }

    for (const it of raw.invoiceItems || []) {
      store.invoiceItem.push({
        id: it.id || crypto.randomUUID(),
        shipmentId: it.shipmentId,
        description: it.description,
        hsnCode: it.hsnCode ?? null,
        quantity: Number(it.quantity || 0),
        unit: it.unit || 'PCS',
        rateUsd: Number(it.rateUsd || 0),
        amountUsd: Number(it.amountUsd || 0),
      });
    }

    for (const p of raw.payments || []) {
      store.payment.push({
        id: p.id || crypto.randomUUID(),
        irmNumber: p.irmNumber,
        senderReference: p.senderReference ?? null,
        currency: p.currency || 'USD',
        verifiedAmount: Number(p.verifiedAmount || 0),
        inrAmount: p.inrAmount !== undefined && p.inrAmount !== null ? Number(p.inrAmount) : null,
        exchangeRate: p.exchangeRate !== undefined && p.exchangeRate !== null ? Number(p.exchangeRate) : null,
        valueDate: toDateRequired(p.valueDate),
        creditDate: toDateRequired(p.creditDate),
        fircIssueDate: toDateOptional(p.fircIssueDate),
        bankId: p.bankId,
        purposeCode: p.purposeCode || 'P0102',
        remarks: p.remarks ?? null,
        createdAt: toDateRequired(p.createdAt),
        updatedAt: toDateRequired(p.updatedAt),
      });
    }

    for (const a of raw.allocations || []) {
      store.paymentAllocation.push({
        id: a.id || crypto.randomUUID(),
        paymentId: a.paymentId,
        shipmentId: a.shipmentId,
        allocatedAmountUsd: Number(a.allocatedAmountUsd || 0),
        notes: a.notes ?? null,
        allocatedAt: toDateRequired(a.allocatedAt),
        allocatedByUserId: a.allocatedByUserId || 'system',
      });
    }

    for (const inc of raw.incentives || []) {
      store.incentiveRecord.push({
        id: inc.id || crypto.randomUUID(),
        shipmentId: inc.shipmentId,
        type: inc.type,
        claimedAmount: Number(inc.claimedAmount || 0),
        status: inc.status || 'PENDING',
        receivedAmount: Number(inc.receivedAmount || 0),
        receivedDate: toDateOptional(inc.receivedDate),
        scrollNumber: inc.scrollNumber ?? null,
        remarks: inc.remarks ?? null,
        createdAt: toDateRequired(inc.createdAt),
        updatedAt: toDateRequired(inc.updatedAt),
      });
    }

    for (const brc of raw.brcRecords || []) {
      store.brcRecord.push({
        id: brc.id || crypto.randomUUID(),
        shipmentId: brc.shipmentId,
        brcNumber: brc.brcNumber ?? null,
        issueDate: toDateOptional(brc.issueDate),
        realisationDate: toDateOptional(brc.realisationDate),
        realisedAmount: brc.realisedAmount !== undefined && brc.realisedAmount !== null ? Number(brc.realisedAmount) : null,
        realisedCurrency: brc.realisedCurrency || 'USD',
        uploadMode: brc.uploadMode || 'SINGLE',
        statutoryDeadline: toDateOptional(brc.statutoryDeadline),
        status: brc.status || 'PENDING',
        remarks: brc.remarks ?? null,
        createdAt: toDateRequired(brc.createdAt),
        updatedAt: toDateRequired(brc.updatedAt),
      });
    }

    for (const d of raw.documents || []) {
      store.document.push({
        id: d.id || crypto.randomUUID(),
        shipmentId: d.shipmentId ?? null,
        paymentId: d.paymentId ?? null,
        category: d.category,
        originalFilename: d.originalFilename,
        storedPath: d.storedPath,
        mimeType: d.mimeType || 'application/pdf',
        fileSizeBytes: BigInt(Number(d.fileSizeBytes || 0)),
        version: d.version || 1,
        isCurrent: d.isCurrent ?? true,
        reviewStatus: d.reviewStatus || 'CONFIRMED',
        ocrApplied: Boolean(d.ocrApplied),
        ocrConfidence: d.ocrConfidence ?? null,
        ocrTextPreview: d.ocrTextPreview ?? null,
        extractionMethod: d.extractionMethod || 'PDF_TEXT',
        extractedFieldsJson: d.extractedFieldsJson ?? null,
        extractedData: d.extractedData ?? null,
        uploadedByUserId: d.uploadedByUserId || (raw.users?.[0]?.id || 'u-super-admin'),
        createdAt: toDateRequired(d.createdAt),
        updatedAt: toDateRequired(d.updatedAt),
      });
    }

    for (const g of raw.gstEntries || []) {
      store.gstEntry.push({
        id: g.id || crypto.randomUUID(),
        entryDate: toDateRequired(g.entryDate),
        consigneeId: g.consigneeId,
        consigneeName: g.consigneeName,
        igst: Number(g.igst || 0),
        cgst: Number(g.cgst || 0),
        sgst: Number(g.sgst || 0),
        totalGst: Number(g.totalGst || 0),
        refundEligible: Number(g.refundEligible || 0),
        difference: Number(g.difference || 0),
        result: g.result || 'NIL',
        remarks: g.remarks ?? null,
        createdAt: toDateRequired(g.createdAt),
        updatedAt: toDateRequired(g.updatedAt),
      });
    }

    for (const sup of raw.suppliers || []) {
      store.supplier.push({
        id: sup.id || crypto.randomUUID(),
        gstin: String(sup.gstin).toUpperCase(),
        legalName: sup.legalName,
        tradeName: sup.tradeName ?? null,
        address: sup.address ?? null,
        state: sup.state ?? null,
        createdAt: toDateRequired(sup.createdAt),
        updatedAt: toDateRequired(sup.updatedAt),
      });
    }

    for (const b of raw.importBatches || []) {
      store.importBatch.push({
        id: b.id || crypto.randomUUID(),
        fileName: b.fileName,
        fileSizeBytes: b.fileSizeBytes !== undefined && b.fileSizeBytes !== null ? BigInt(Number(b.fileSizeBytes)) : null,
        uploadedAt: toDateRequired(b.uploadedAt),
        uploadedBy: b.uploadedBy ?? null,
        totalRows: Number(b.totalRows || 0),
        successfulRows: Number(b.successfulRows || 0),
        failedRows: Number(b.failedRows || 0),
        duplicateRows: Number(b.duplicateRows || 0),
        importStatus: b.importStatus || 'COMPLETED',
        gstrPeriodSummary: b.gstrPeriodSummary ?? null,
        createdAt: toDateRequired(b.createdAt || b.uploadedAt),
      });
    }

    for (const inv of raw.b2bInvoices || []) {
      store.b2bInvoice.push({
        id: inv.id || crypto.randomUUID(),
        supplierId: inv.supplierId,
        supplierGstin: String(inv.supplierGstin).toUpperCase(),
        supplierName: inv.supplierName,
        invoiceNumber: inv.invoiceNumber,
        invoiceType: inv.invoiceType || 'Regular',
        invoiceDate: toDateRequired(inv.invoiceDate),
        invoiceValue: Number(inv.invoiceValue || 0),
        placeOfSupply: inv.placeOfSupply ?? null,
        reverseCharge: inv.reverseCharge === 'Y' ? 'Y' : 'N',
        taxableValue: Number(inv.taxableValue || 0),
        integratedTax: Number(inv.integratedTax || 0),
        centralTax: Number(inv.centralTax || 0),
        stateUtTax: Number(inv.stateUtTax || 0),
        cess: Number(inv.cess || 0),
        totalGst: Number(inv.totalGst || 0),
        gstrPeriod: inv.gstrPeriod,
        periodKey: inv.periodKey,
        financialYear: inv.financialYear,
        filingDate: toDateOptional(inv.filingDate),
        itcAvailability: inv.itcAvailability === 'No' ? 'No' : 'Yes',
        reason: inv.reason ?? null,
        applicableTaxRate: inv.applicableTaxRate !== undefined && inv.applicableTaxRate !== null ? Number(inv.applicableTaxRate) : null,
        source: inv.source ?? null,
        irn: inv.irn ?? null,
        irnDate: toDateOptional(inv.irnDate),
        importBatchId: inv.importBatchId ?? null,
        createdBy: inv.createdBy ?? null,
        updatedBy: inv.updatedBy ?? null,
        createdAt: toDateRequired(inv.createdAt),
        updatedAt: toDateRequired(inv.updatedAt),
      });
    }

    if (raw.settings && typeof raw.settings === 'object') {
      for (const [key, val] of Object.entries(raw.settings)) {
        store.appSetting.push({
          id: crypto.randomUUID(),
          key,
          value: String(val),
          description: null,
          updatedAt: new Date(),
        });
      }
    }

    for (const rt of raw.revokedTokens || []) {
      store.revokedToken.push({
        id: rt.id || crypto.randomUUID(),
        token: rt.token,
        userId: rt.userId,
        revokedAt: toDateRequired(rt.revokedAt),
        expiresAt: toDateRequired(rt.expiresAt),
      });
    }

    for (const job of raw.ocrJobs || []) {
      store.ocrJob.push({
        id: job.id || crypto.randomUUID(),
        documentId: job.documentId ?? null,
        originalFilename: job.originalFilename,
        fileSizeBytes: BigInt(Number(job.fileSizeBytes || 0)),
        category: job.category,
        financialYearId: job.financialYearId || '',
        status: job.status || 'PENDING',
        attempts: Number(job.attempts || 0),
        maxAttempts: Number(job.maxAttempts || 3),
        lockedByWorkerId: job.lockedByWorkerId ?? null,
        lockedAt: toDateOptional(job.lockedAt),
        leaseExpiresAt: toDateOptional(job.leaseExpiresAt),
        executionTimeMs: job.executionTimeMs ?? null,
        ocrApplied: Boolean(job.ocrApplied),
        ocrConfidence: job.ocrConfidence ?? null,
        ocrTextPreview: job.ocrTextPreview ?? null,
        extractionMethod: job.extractionMethod ?? null,
        candidateFields: job.candidateFields ?? null,
        candidateDraft: job.candidateDraft ?? null,
        error: job.error ?? null,
        targetShipmentId: job.targetShipmentId ?? null,
        targetPaymentId: job.targetPaymentId ?? null,
        approvedAt: toDateOptional(job.approvedAt),
        approvedByUserId: job.approvedByUserId ?? null,
        approvedByName: job.approvedByName ?? null,
        createdAt: toDateRequired(job.createdAt),
        updatedAt: toDateRequired(job.updatedAt),
      });
    }
  } catch (err) {
    console.warn('[AI Studio Mock Prisma] Failed to load storage/data/db.json:', err);
  }

  return store;
}

type ModelName = keyof InMemoryStore;

function getRelationValue(store: InMemoryStore, model: ModelName, row: AnyRow, relName: string): any {
  switch (`${model}.${relName}`) {
    case 'shipment.financialYear':
      return store.financialYear.find((f) => f.id === row.financialYearId) ?? null;
    case 'shipment.consignee':
      return store.consigneeMaster.find((c) => c.id === row.consigneeId) ?? null;
    case 'shipment.items':
      return store.invoiceItem.filter((i) => i.shipmentId === row.id);
    case 'shipment.documents':
      return store.document.filter((d) => d.shipmentId === row.id);
    case 'shipment.allocations':
      return store.paymentAllocation.filter((a) => a.shipmentId === row.id);
    case 'shipment.incentives':
      return store.incentiveRecord.filter((inc) => inc.shipmentId === row.id);
    case 'shipment.brcRecord':
      return store.brcRecord.find((b) => b.shipmentId === row.id) ?? null;
    case 'payment.bank':
      return store.bankMaster.find((b) => b.id === row.bankId) ?? null;
    case 'payment.allocations':
      return store.paymentAllocation.filter((a) => a.paymentId === row.id);
    case 'payment.documents':
      return store.document.filter((d) => d.paymentId === row.id);
    case 'paymentAllocation.payment':
      return store.payment.find((p) => p.id === row.paymentId) ?? null;
    case 'paymentAllocation.shipment':
      return store.shipment.find((s) => s.id === row.shipmentId) ?? null;
    case 'document.uploadedByUser':
      return store.user.find((u) => u.id === row.uploadedByUserId) ?? null;
    case 'document.shipment':
      return store.shipment.find((s) => s.id === row.shipmentId) ?? null;
    case 'document.payment':
      return store.payment.find((p) => p.id === row.paymentId) ?? null;
    case 'supplier.invoices':
      return store.b2bInvoice.filter((inv) => inv.supplierId === row.id);
    case 'b2bInvoice.supplier':
      return store.supplier.find((s) => s.id === row.supplierId) ?? null;
    case 'b2bInvoice.importBatch':
      return store.importBatch.find((b) => b.id === row.importBatchId) ?? null;
    case 'importBatch.invoices':
      return store.b2bInvoice.filter((inv) => inv.importBatchId === row.id);
    case 'gstEntry.consignee':
      return store.consigneeMaster.find((c) => c.id === row.consigneeId) ?? null;
    default:
      return undefined;
  }
}

function getRelationModel(model: ModelName, relName: string): ModelName | null {
  const map: Record<string, ModelName> = {
    'shipment.financialYear': 'financialYear',
    'shipment.consignee': 'consigneeMaster',
    'shipment.items': 'invoiceItem',
    'shipment.documents': 'document',
    'shipment.allocations': 'paymentAllocation',
    'shipment.incentives': 'incentiveRecord',
    'shipment.brcRecord': 'brcRecord',
    'payment.bank': 'bankMaster',
    'payment.allocations': 'paymentAllocation',
    'payment.documents': 'document',
    'paymentAllocation.payment': 'payment',
    'paymentAllocation.shipment': 'shipment',
    'document.uploadedByUser': 'user',
    'document.shipment': 'shipment',
    'document.payment': 'payment',
    'supplier.invoices': 'b2bInvoice',
    'b2bInvoice.supplier': 'supplier',
    'b2bInvoice.importBatch': 'importBatch',
    'importBatch.invoices': 'b2bInvoice',
    'gstEntry.consignee': 'consigneeMaster',
  };
  return map[`${model}.${relName}`] ?? null;
}

function toComparable(v: any): any {
  if (v instanceof Date) return v.getTime();
  return v;
}

function matchesCondition(store: InMemoryStore, model: ModelName, row: AnyRow, key: string, cond: any): boolean {
  const val = row[key];

  // Relation filter (e.g. consignee: { name: { contains: q, mode: 'insensitive' } })
  const relModel = getRelationModel(model, key);
  if (relModel && cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
    const relVal = getRelationValue(store, model, row, key);
    if (!relVal || Array.isArray(relVal)) return false;
    return matchesWhere(store, relModel, relVal, cond);
  }

  if (cond === undefined) return true;
  if (cond === null) return val === null || val === undefined;

  if (typeof cond !== 'object' || cond instanceof Date) {
    return toComparable(val) === toComparable(cond);
  }

  // Filter operators
  if ('equals' in cond) {
    if (cond.mode === 'insensitive') {
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase() === String(cond.equals).toLowerCase();
    }
    if (toComparable(val) !== toComparable(cond.equals)) return false;
  }
  if ('contains' in cond) {
    if (val === null || val === undefined) return false;
    const hay = String(val);
    const needle = String(cond.contains);
    if (cond.mode === 'insensitive') {
      if (!hay.toLowerCase().includes(needle.toLowerCase())) return false;
    } else if (!hay.includes(needle)) {
      return false;
    }
  }
  if ('startsWith' in cond) {
    if (val === null || val === undefined) return false;
    if (!String(val).startsWith(String(cond.startsWith))) return false;
  }
  if ('in' in cond && Array.isArray(cond.in)) {
    if (!cond.in.includes(val)) return false;
  }
  if ('not' in cond) {
    if (cond.not === null) {
      if (val === null || val === undefined) return false;
    } else if (toComparable(val) === toComparable(cond.not)) {
      return false;
    }
  }
  if ('lt' in cond) {
    if (val === null || val === undefined) return false;
    if (!(toComparable(val) < toComparable(cond.lt))) return false;
  }
  if ('lte' in cond) {
    if (val === null || val === undefined) return false;
    if (!(toComparable(val) <= toComparable(cond.lte))) return false;
  }
  if ('gt' in cond) {
    if (val === null || val === undefined) return false;
    if (!(toComparable(val) > toComparable(cond.gt))) return false;
  }
  if ('gte' in cond) {
    if (val === null || val === undefined) return false;
    if (!(toComparable(val) >= toComparable(cond.gte))) return false;
  }

  return true;
}

function matchesWhere(store: InMemoryStore, model: ModelName, row: AnyRow, where?: AnyRow): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === 'OR' && Array.isArray(cond)) {
      if (!cond.some((sub) => matchesWhere(store, model, row, sub))) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(cond)) {
      if (!cond.every((sub) => matchesWhere(store, model, row, sub))) return false;
      continue;
    }
    if (!matchesCondition(store, model, row, key, cond)) return false;
  }
  return true;
}

function sortRows(rows: AnyRow[], orderBy?: AnyRow | AnyRow[]): AnyRow[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      for (const [field, dir] of Object.entries(spec)) {
        const av = toComparable(a[field]);
        const bv = toComparable(b[field]);
        if (av === bv) continue;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : 1;
        return dir === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function projectRow(store: InMemoryStore, model: ModelName, row: AnyRow, args?: { include?: AnyRow; select?: AnyRow }): AnyRow {
  if (!row) return row;

  if (args?.select) {
    const out: AnyRow = {};
    for (const [k, v] of Object.entries(args.select)) {
      if (!v) continue;
      const relModel = getRelationModel(model, k);
      if (relModel) {
        const rel = getRelationValue(store, model, row, k);
        if (Array.isArray(rel)) {
          const opts = typeof v === 'object' ? v : {};
          const filtered = opts.where ? rel.filter((r) => matchesWhere(store, relModel, r, opts.where)) : rel;
          out[k] = filtered.map((r) => projectRow(store, relModel, r, opts));
        } else {
          out[k] = rel ? projectRow(store, relModel, rel, typeof v === 'object' ? v : undefined) : null;
        }
      } else {
        out[k] = row[k];
      }
    }
    return out;
  }

  const out: AnyRow = { ...row };
  if (args?.include) {
    for (const [k, v] of Object.entries(args.include)) {
      if (!v) continue;
      const relModel = getRelationModel(model, k);
      if (!relModel) continue;
      const rel = getRelationValue(store, model, row, k);
      if (Array.isArray(rel)) {
        const opts = typeof v === 'object' ? v : {};
        const filtered = opts.where ? rel.filter((r) => matchesWhere(store, relModel, r, opts.where)) : rel;
        out[k] = filtered.map((r) => projectRow(store, relModel, r, opts));
      } else {
        out[k] = rel ? projectRow(store, relModel, rel, typeof v === 'object' ? v : undefined) : null;
      }
    }
  }
  return out;
}

function normalizeCreateData(model: ModelName, data: AnyRow): AnyRow {
  const now = new Date();
  const row: AnyRow = {
    id: data.id || crypto.randomUUID(),
    ...data,
  };

  if (model !== 'financialYear' && model !== 'invoiceItem' && model !== 'appSetting' && model !== 'revokedToken') {
    row.createdAt = data.createdAt ? toDateRequired(data.createdAt) : now;
  }
  if (model !== 'financialYear' && model !== 'invoiceItem' && model !== 'paymentAllocation' && model !== 'importBatch' && model !== 'revokedToken') {
    row.updatedAt = data.updatedAt ? toDateRequired(data.updatedAt) : now;
  }
  if (model === 'paymentAllocation') {
    row.allocatedAt = data.allocatedAt ? toDateRequired(data.allocatedAt) : now;
  }
  if (model === 'importBatch') {
    row.uploadedAt = data.uploadedAt ? toDateRequired(data.uploadedAt) : now;
    row.createdAt = data.createdAt ? toDateRequired(data.createdAt) : now;
  }
  if (model === 'revokedToken') {
    row.revokedAt = data.revokedAt ? toDateRequired(data.revokedAt) : now;
  }
  if (model === 'user' && row.email) {
    row.email = String(row.email).toLowerCase();
  }
  return row;
}

function applyUpdateData(row: AnyRow, data: AnyRow, model: ModelName): AnyRow {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && 'increment' in v) {
      row[k] = Number(row[k] || 0) + Number(v.increment || 0);
    } else {
      row[k] = v;
    }
  }
  if (model !== 'financialYear' && model !== 'invoiceItem' && model !== 'paymentAllocation' && model !== 'importBatch' && model !== 'revokedToken') {
    row.updatedAt = new Date();
  }
  return row;
}

function createModelDelegate(store: InMemoryStore, model: ModelName) {
  return {
    async findMany(args: AnyRow = {}) {
      const list = store[model].filter((r) => matchesWhere(store, model, r, args.where));
      const sorted = sortRows(list, args.orderBy);
      const sliced = typeof args.take === 'number' ? sorted.slice(0, args.take) : sorted;
      return sliced.map((r) => projectRow(store, model, r, args));
    },

    async findFirst(args: AnyRow = {}) {
      const list = store[model].filter((r) => matchesWhere(store, model, r, args.where));
      const sorted = sortRows(list, args.orderBy);
      const row = sorted[0];
      return row ? projectRow(store, model, row, args) : null;
    },

    async findUnique(args: AnyRow = {}) {
      const row = store[model].find((r) => matchesWhere(store, model, r, args.where));
      return row ? projectRow(store, model, row, args) : null;
    },

    async count(args: AnyRow = {}) {
      return store[model].filter((r) => matchesWhere(store, model, r, args.where)).length;
    },

    async create(args: AnyRow) {
      const row = normalizeCreateData(model, args.data || {});
      store[model].push(row);
      return projectRow(store, model, row, args);
    },

    async update(args: AnyRow) {
      const row = store[model].find((r) => matchesWhere(store, model, r, args.where));
      if (!row) {
        throw new Error(`Record to update not found in ${model}`);
      }
      applyUpdateData(row, args.data || {}, model);
      return projectRow(store, model, row, args);
    },

    async updateMany(args: AnyRow) {
      let count = 0;
      for (const row of store[model]) {
        if (matchesWhere(store, model, row, args.where)) {
          applyUpdateData(row, args.data || {}, model);
          count++;
        }
      }
      return { count };
    },

    async upsert(args: AnyRow) {
      const existing = store[model].find((r) => matchesWhere(store, model, r, args.where));
      if (existing) {
        applyUpdateData(existing, args.update || {}, model);
        return projectRow(store, model, existing, args);
      }
      const created = normalizeCreateData(model, { ...(args.where || {}), ...(args.create || {}) });
      store[model].push(created);
      return projectRow(store, model, created, args);
    },

    async delete(args: AnyRow) {
      const idx = store[model].findIndex((r) => matchesWhere(store, model, r, args.where));
      if (idx === -1) {
        throw new Error(`Record to delete not found in ${model}`);
      }
      const [removed] = store[model].splice(idx, 1);

      if (model === 'shipment') {
        store.invoiceItem = store.invoiceItem.filter((i) => i.shipmentId !== removed.id);
        store.document = store.document.filter((d) => d.shipmentId !== removed.id);
        store.incentiveRecord = store.incentiveRecord.filter((inc) => inc.shipmentId !== removed.id);
        store.brcRecord = store.brcRecord.filter((b) => b.shipmentId !== removed.id);
      }

      return projectRow(store, model, removed, args);
    },

    async deleteMany(args: AnyRow = {}) {
      const before = store[model].length;
      if (!args.where) {
        store[model] = [];
        return { count: before };
      }
      store[model] = store[model].filter((r) => !matchesWhere(store, model, r, args.where));
      return { count: before - store[model].length };
    },

    async aggregate(args: AnyRow = {}) {
      const list = store[model].filter((r) => matchesWhere(store, model, r, args.where));
      const _sum: AnyRow = {};
      if (args._sum) {
        for (const field of Object.keys(args._sum)) {
          if (args._sum[field]) {
            _sum[field] = list.reduce((acc, r) => acc + Number(r[field] || 0), 0);
          }
        }
      }
      return { _sum };
    },
  };
}

let cachedMockPrisma: PrismaClient | null = null;

export function getMockPrisma(): PrismaClient {
  if (cachedMockPrisma) {
    return cachedMockPrisma;
  }

  console.warn('[AI Studio] PostgreSQL not connected — using seeded in-memory data store (storage/data/db.json).');
  const store = loadInitialStore();

  const client: AnyRow = {
    user: createModelDelegate(store, 'user'),
    financialYear: createModelDelegate(store, 'financialYear'),
    consigneeMaster: createModelDelegate(store, 'consigneeMaster'),
    bankMaster: createModelDelegate(store, 'bankMaster'),
    shipment: createModelDelegate(store, 'shipment'),
    invoiceItem: createModelDelegate(store, 'invoiceItem'),
    payment: createModelDelegate(store, 'payment'),
    paymentAllocation: createModelDelegate(store, 'paymentAllocation'),
    incentiveRecord: createModelDelegate(store, 'incentiveRecord'),
    brcRecord: createModelDelegate(store, 'brcRecord'),
    document: createModelDelegate(store, 'document'),
    gstEntry: createModelDelegate(store, 'gstEntry'),
    supplier: createModelDelegate(store, 'supplier'),
    importBatch: createModelDelegate(store, 'importBatch'),
    b2bInvoice: createModelDelegate(store, 'b2bInvoice'),
    appSetting: createModelDelegate(store, 'appSetting'),
    revokedToken: createModelDelegate(store, 'revokedToken'),
    ocrJob: createModelDelegate(store, 'ocrJob'),

    async $queryRaw(strings: TemplateStringsArray, ...values: any[]) {
      const sql = strings.join('?');
      if (sql.includes('SELECT 1')) {
        return [{ '?column?': 1 }];
      }
      if (sql.includes('FROM "Payment"') && values[0]) {
        const p = store.payment.find((row) => row.id === values[0]);
        return p ? [{ id: p.id, irmNumber: p.irmNumber, verifiedAmount: p.verifiedAmount }] : [];
      }
      if (sql.includes('FROM "Shipment"') && values[0]) {
        const s = store.shipment.find((row) => row.id === values[0]);
        return s ? [{ id: s.id, invoiceNumber: s.invoiceNumber, invoiceValueUsd: s.invoiceValueUsd }] : [];
      }
      if (sql.includes('FROM "OcrJob"')) {
        if (sql.includes('SKIP LOCKED')) {
          const now = values[0] instanceof Date ? values[0].getTime() : Date.now();
          const eligible = store.ocrJob
            .filter(
              (j) =>
                Number(j.attempts || 0) < Number(j.maxAttempts || 3) &&
                (j.status === 'PENDING' ||
                  (j.status === 'PROCESSING' && (!j.leaseExpiresAt || j.leaseExpiresAt.getTime() < now)))
            )
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return eligible.length > 0 ? [{ id: eligible[0].id }] : [];
        }
        if (values[0]) {
          const j = store.ocrJob.find((row) => row.id === values[0]);
          return j ? [{ id: j.id }] : [];
        }
      }
      return [];
    },

    async $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      return fn(client);
    },

    async $disconnect(): Promise<void> {
      // No-op for in-memory mock
    },
  };

  cachedMockPrisma = client as unknown as PrismaClient;
  return cachedMockPrisma;
}
