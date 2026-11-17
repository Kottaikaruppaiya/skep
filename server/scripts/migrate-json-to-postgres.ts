/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { disconnectPrisma, isDatabaseConfigured, withTransaction } from '../config/prisma.ts';
import { parseDateOptional, parseDateRequired } from '../shared/utils/date.ts';

/**
 * Idempotent CLI migration script from legacy JSON snapshot (storage/data/db.json)
 * to PostgreSQL 16 via Prisma transactions.
 * Usage: npx tsx server/scripts/migrate-json-to-postgres.ts [path/to/db.json]
 */
async function main() {
  if (!isDatabaseConfigured()) {
    console.error('DATABASE_URL is not configured. Aborting migration.');
    process.exit(1);
  }

  const inputPath = path.resolve(process.argv[2] || 'storage/data/db.json');
  if (!fs.existsSync(inputPath)) {
    console.error(`Legacy JSON file not found at: ${inputPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  await withTransaction(async (tx) => {
    for (const u of raw.users || []) {
      await tx.user.upsert({
        where: { email: u.email.toLowerCase() },
        update: { name: u.name, role: u.role, isActive: u.isActive ?? true },
        create: {
          id: u.id,
          email: u.email.toLowerCase(),
          name: u.name,
          role: u.role || 'ADMIN',
          isActive: u.isActive ?? true,
          passwordHash: u.passwordHash,
        },
      });
    }

    for (const fy of raw.financialYears || []) {
      await tx.financialYear.upsert({
        where: { id: fy.id },
        update: {},
        create: {
          id: fy.id,
          label: fy.label,
          startDate: parseDateRequired(fy.startDate, 'startDate'),
          endDate: parseDateRequired(fy.endDate, 'endDate'),
          isCurrent: Boolean(fy.isCurrent),
        },
      });
    }

    for (const c of raw.consignees || []) {
      await tx.consigneeMaster.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          name: c.name,
          country: c.country || 'International',
          portOfDischarge: c.portOfDischarge || null,
          paymentTerms: c.paymentTerms || null,
          currency: c.currency || 'USD',
          contactEmail: c.contactEmail || null,
          isActive: c.isActive ?? true,
        },
      });
    }

    for (const b of raw.banks || []) {
      await tx.bankMaster.upsert({
        where: { id: b.id },
        update: {},
        create: {
          id: b.id,
          name: b.name,
          branch: b.branch || null,
          adCode: b.adCode || null,
          ifscCode: b.ifscCode || null,
          swiftCode: b.swiftCode || null,
          accountNumber: b.accountNumber || null,
          isActive: b.isActive ?? true,
        },
      });
    }

    for (const s of raw.shipments || []) {
      await tx.shipment.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          financialYearId: s.financialYearId,
          invoiceNumber: s.invoiceNumber,
          normalizedInvoiceKey: s.normalizedInvoiceKey,
          invoiceDate: parseDateRequired(s.invoiceDate, 'invoiceDate'),
          consigneeId: s.consigneeId,
          portCode: s.portCode || 'INNSA1',
          packageCount: s.packageCount ?? 0,
          invoiceValueUsd: Number(s.invoiceValueUsd || 0),
          shippingBillNumber: s.shippingBillNumber || 'PENDING',
          shippingBillDate: parseDateRequired(s.shippingBillDate || s.invoiceDate, 'shippingBillDate'),
          sbExchangeRate: Number(s.sbExchangeRate || 0),
          fobValueInr: Number(s.fobValueInr || 0),
          blNumber: s.blNumber || null,
          blDate: parseDateOptional(s.blDate),
          vesselName: s.vesselName || null,
          paymentStatus: s.paymentStatus || 'UNPAID',
          reviewStatus: s.reviewStatus || 'CONFIRMED',
          remarks: s.remarks || null,
          isArchived: Boolean(s.isArchived),
        },
      });
    }

    for (const p of raw.payments || []) {
      await tx.payment.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          irmNumber: p.irmNumber,
          senderReference: p.senderReference || null,
          currency: p.currency || 'USD',
          verifiedAmount: Number(p.verifiedAmount || 0),
          inrAmount: p.inrAmount !== undefined ? Number(p.inrAmount) : null,
          exchangeRate: p.exchangeRate !== undefined ? Number(p.exchangeRate) : null,
          valueDate: parseDateRequired(p.valueDate, 'valueDate'),
          creditDate: parseDateRequired(p.creditDate, 'creditDate'),
          fircIssueDate: parseDateOptional(p.fircIssueDate),
          bankId: p.bankId,
          purposeCode: p.purposeCode || 'P0103',
          remarks: p.remarks || null,
        },
      });
    }

    for (const a of raw.allocations || []) {
      await tx.paymentAllocation.upsert({
        where: { id: a.id },
        update: {},
        create: {
          id: a.id,
          paymentId: a.paymentId,
          shipmentId: a.shipmentId,
          allocatedAmountUsd: Number(a.allocatedAmountUsd || 0),
          notes: a.notes || null,
          allocatedByUserId: a.allocatedByUserId || 'system',
        },
      });
    }

    for (const inc of raw.incentives || []) {
      await tx.incentiveRecord.upsert({
        where: { id: inc.id },
        update: {},
        create: {
          id: inc.id,
          shipmentId: inc.shipmentId,
          type: inc.type,
          claimedAmount: Number(inc.claimedAmount || 0),
          status: inc.status || 'PENDING',
          receivedAmount: Number(inc.receivedAmount || 0),
          receivedDate: parseDateOptional(inc.receivedDate),
          scrollNumber: inc.scrollNumber || null,
          remarks: inc.remarks || null,
        },
      });
    }

    for (const brc of raw.brcRecords || []) {
      await tx.brcRecord.upsert({
        where: { id: brc.id },
        update: {},
        create: {
          id: brc.id,
          shipmentId: brc.shipmentId,
          brcNumber: brc.brcNumber || null,
          issueDate: parseDateOptional(brc.issueDate),
          realisationDate: parseDateOptional(brc.realisationDate),
          realisedAmount: brc.realisedAmount !== undefined ? Number(brc.realisedAmount) : null,
          realisedCurrency: brc.realisedCurrency || 'USD',
          uploadMode: brc.uploadMode || 'SINGLE',
          statutoryDeadline: parseDateOptional(brc.statutoryDeadline),
          status: brc.status || 'PENDING',
          remarks: brc.remarks || null,
        },
      });
    }

    for (const d of raw.documents || []) {
      await tx.document.upsert({
        where: { id: d.id },
        update: {},
        create: {
          id: d.id,
          shipmentId: d.shipmentId || null,
          paymentId: d.paymentId || null,
          category: d.category,
          originalFilename: d.originalFilename,
          storedPath: d.storedPath,
          mimeType: d.mimeType || 'application/pdf',
          fileSizeBytes: BigInt(d.fileSizeBytes || 0),
          version: d.version || 1,
          isCurrent: d.isCurrent ?? true,
          reviewStatus: d.reviewStatus || 'CONFIRMED',
          uploadedByUserId: d.uploadedByUserId || (raw.users?.[0]?.id || 'u-super-admin'),
        },
      });
    }

    for (const g of raw.gstEntries || []) {
      await tx.gstEntry.upsert({
        where: { id: g.id },
        update: {},
        create: {
          id: g.id,
          entryDate: parseDateRequired(g.entryDate, 'entryDate'),
          consigneeId: g.consigneeId,
          consigneeName: g.consigneeName,
          igst: Number(g.igst || 0),
          cgst: Number(g.cgst || 0),
          sgst: Number(g.sgst || 0),
          totalGst: Number(g.totalGst || 0),
          refundEligible: Number(g.refundEligible || 0),
          difference: Number(g.difference || 0),
          result: g.result || 'NIL',
          remarks: g.remarks || null,
        },
      });
    }

    for (const sup of raw.suppliers || []) {
      await tx.supplier.upsert({
        where: { gstin: sup.gstin.toUpperCase() },
        update: {},
        create: {
          id: sup.id,
          gstin: sup.gstin.toUpperCase(),
          legalName: sup.legalName,
          tradeName: sup.tradeName || null,
          address: sup.address || null,
          state: sup.state || null,
        },
      });
    }

    for (const inv of raw.b2bInvoices || []) {
      await tx.b2bInvoice.upsert({
        where: { id: inv.id },
        update: {},
        create: {
          id: inv.id,
          supplierId: inv.supplierId,
          supplierGstin: inv.supplierGstin.toUpperCase(),
          supplierName: inv.supplierName,
          invoiceNumber: inv.invoiceNumber,
          invoiceType: inv.invoiceType || 'Regular',
          invoiceDate: parseDateRequired(inv.invoiceDate, 'invoiceDate'),
          invoiceValue: Number(inv.invoiceValue || 0),
          placeOfSupply: inv.placeOfSupply || null,
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
          filingDate: parseDateOptional(inv.filingDate),
          itcAvailability: inv.itcAvailability === 'No' ? 'No' : 'Yes',
          reason: inv.reason || null,
          applicableTaxRate: inv.applicableTaxRate !== undefined && inv.applicableTaxRate !== null ? Number(inv.applicableTaxRate) : null,
          source: inv.source ?? null,
          irn: inv.irn || null,
          irnDate: parseDateOptional(inv.irnDate),
        },
      });
    }
  });

  console.log(`Successfully migrated records from ${inputPath} into PostgreSQL.`);
  await disconnectPrisma();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
