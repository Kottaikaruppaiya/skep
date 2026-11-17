/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { getPrisma, withTransaction, type DbClient } from '../../config/prisma.ts';
import { getStorageDir } from '../../config/storage.ts';
import { hashPassword } from '../../shared/utils/password.ts';
import { DEFAULT_APP_SETTINGS } from './settings.repository.ts';

function getSeedPassword(): string {
  return process.env.SEED_DEFAULT_PASSWORD || 'Admin@123';
}

function copySampleAssetToStorage(assetFilename: string, targetRelativeInsideStorage: string): string {
  const storageDir = getStorageDir();
  const destAbs = path.resolve(storageDir, targetRelativeInsideStorage);
  const destDir = path.dirname(destAbs);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const assetSrc = path.resolve('public/assets/aistudio', assetFilename);
  if (!fs.existsSync(destAbs) && fs.existsSync(assetSrc)) {
    fs.copyFileSync(assetSrc, destAbs);
  }

  return path.relative(process.cwd(), destAbs);
}

async function seedDataset(tx: DbClient): Promise<{ shipments: number }> {
  const passwordHash = hashPassword(getSeedPassword());

  // 1. Users (upsert by email so active admin IDs remain valid)
  await tx.user.upsert({
    where: { email: 'owner@skenterprises.com' },
    update: {},
    create: {
      id: 'u-super-admin',
      email: 'owner@skenterprises.com',
      name: 'Suresh Kumar (Owner)',
      role: 'SUPER_ADMIN',
      isActive: true,
      passwordHash,
    },
  });

  const adminUser = await tx.user.upsert({
    where: { email: 'accountant@skenterprises.com' },
    update: {},
    create: {
      id: 'u-admin-pooja',
      email: 'accountant@skenterprises.com',
      name: 'Pooja Verma (Sr. Accountant)',
      role: 'ADMIN',
      isActive: true,
      passwordHash,
    },
  });

  await tx.user.upsert({
    where: { email: 'auditor@skenterprises.com' },
    update: {},
    create: {
      id: 'u-viewer-ramesh',
      email: 'auditor@skenterprises.com',
      name: 'Ramesh Mehta (Statutory Auditor)',
      role: 'VIEWER',
      isActive: true,
      passwordHash,
    },
  });

  // 2. Financial Years
  const fyCurrentId = 'fy-2026-27';
  const fyPrevId = 'fy-2025-26';

  await tx.financialYear.upsert({
    where: { id: fyCurrentId },
    update: { label: '2026-27', startDate: new Date('2026-04-01T00:00:00.000Z'), endDate: new Date('2027-03-31T00:00:00.000Z'), isCurrent: true },
    create: {
      id: fyCurrentId,
      label: '2026-27',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      isCurrent: true,
    },
  });

  await tx.financialYear.upsert({
    where: { id: fyPrevId },
    update: { label: '2025-26', startDate: new Date('2025-04-01T00:00:00.000Z'), endDate: new Date('2026-03-31T00:00:00.000Z'), isCurrent: false },
    create: {
      id: fyPrevId,
      label: '2025-26',
      startDate: new Date('2025-04-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      isCurrent: false,
    },
  });

  // 3. Consignees
  const consignees = [
    {
      id: 'c-sk-global-lk',
      name: 'S K GLOBAL VENTURES PRIVATE LIMITED',
      country: 'Sri Lanka',
      portOfDischarge: 'LKCMB - Colombo',
      paymentTerms: 'FOB COLOMBO | DA 90 DAYS',
      currency: 'USD',
      contactEmail: 'trade@skglobalventures.lk',
      isActive: true,
    },
    {
      id: 'c-shasvanth-impex',
      name: 'SHASVANTH IMPEX PRIVATE LIMITED',
      country: 'Sri Lanka',
      portOfDischarge: 'LKCMB - Colombo',
      paymentTerms: 'DA 90 Days from BL',
      currency: 'USD',
      contactEmail: 'accounts@shasvanthimpex.com',
      isActive: true,
    },
    {
      id: 'c-precision-tex-lanka',
      name: 'PRECISION TEX LANKA PVT LTD',
      country: 'Sri Lanka',
      portOfDischarge: 'LKCMB - Colombo',
      paymentTerms: 'DA 90 Days from BL',
      currency: 'USD',
      contactEmail: 'accounts@precisiontex.lk',
      isActive: true,
    },
    {
      id: 'c-tex-fab-lanka',
      name: 'TEX FAB LANKA PRIVATE LIMITED',
      country: 'Sri Lanka',
      portOfDischarge: 'LKCMB - Colombo',
      paymentTerms: 'DA 60 Days',
      currency: 'USD',
      contactEmail: 'finance@texfablanka.com',
      isActive: true,
    },
    {
      id: 'c-winfield-merchant',
      name: 'WINFIELD MERCHANT AND GENERAL PVT LTD',
      country: 'Sri Lanka',
      portOfDischarge: 'LKCMB - Colombo',
      paymentTerms: 'DA 90 Days',
      currency: 'USD',
      contactEmail: 'trade@winfieldmerchant.lk',
      isActive: true,
    },
    {
      id: 'c-intl-remit-sg',
      name: 'International Remittance Pte Ltd',
      country: 'Singapore',
      portOfDischarge: 'Singapore / Colombo',
      paymentTerms: 'Direct Remittance',
      currency: 'USD',
      contactEmail: 'remittance@intl-remit.sg',
      isActive: true,
    },
  ];

  for (const c of consignees) {
    await tx.consigneeMaster.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }

  // 4. Banks
  const banks = [
    {
      id: 'b-dbs-india',
      name: 'DBS Bank India',
      branch: 'Chennai Branch',
      adCode: '6690005',
      ifscCode: 'DBSS0IN0811',
      swiftCode: 'DBSSINBBCHE',
      accountNumber: '82XXXXXXX544',
      isActive: true,
    },
    {
      id: 'b-hdfc-chennai',
      name: 'HDFC Bank',
      branch: 'Second Line Beach Road, Parrys, Chennai',
      adCode: '6690005',
      ifscCode: 'HDFC0000166',
      swiftCode: 'HDFCINBBCHE',
      accountNumber: '50200055901688',
      isActive: true,
    },
    {
      id: 'b-kotak-chennai',
      name: 'Kotak Mahindra Bank',
      branch: 'Mount Road, Chennai',
      adCode: '6690005',
      ifscCode: 'KKBK0008471',
      swiftCode: 'KKBKINBB',
      accountNumber: '77190022314',
      isActive: true,
    },
    {
      id: 'b-yes-chennai',
      name: 'Yes Bank',
      branch: 'Parrys Corner, Chennai',
      adCode: '6690005',
      ifscCode: 'YESB0000124',
      swiftCode: 'YESBINBB',
      accountNumber: '01248002931',
      isActive: true,
    },
  ];

  for (const b of banks) {
    await tx.bankMaster.upsert({
      where: { id: b.id },
      update: {},
      create: b,
    });
  }

  // 5. Shipments
  const shipment1Id = 's-ske-26-27-020';
  const shipment2Id = 's-ske-26-27-021';

  await tx.shipment.upsert({
    where: { id: shipment1Id },
    update: {},
    create: {
      id: shipment1Id,
      financialYearId: fyCurrentId,
      invoiceNumber: 'SKE/26-27/020',
      normalizedInvoiceKey: 'SKE-26-27-020',
      invoiceDate: new Date('2026-04-06T00:00:00.000Z'),
      consigneeId: 'c-sk-global-lk',
      portCode: 'INMAA1',
      packageCount: 88,
      invoiceValueUsd: 24025.65,
      shippingBillNumber: '2173318',
      shippingBillDate: new Date('2026-04-07T00:00:00.000Z'),
      sbExchangeRate: 92.1,
      fobValueInr: 2212762.37,
      blNumber: '736116000605',
      blDate: new Date('2026-05-07T00:00:00.000Z'),
      vesselName: 'ZHONG GU GUI YANG / VARADA 0085W',
      paymentStatus: 'FULLY_PAID',
      reviewStatus: 'CONFIRMED',
      remarks: 'Export under LUT without payment of IGST. Colombo Sri Lanka. DA 90 Days. Realisation received via HDFC Inward Remittance.',
    },
  });

  await tx.shipment.upsert({
    where: { id: shipment2Id },
    update: {},
    create: {
      id: shipment2Id,
      financialYearId: fyCurrentId,
      invoiceNumber: 'SKE/26-27/021',
      normalizedInvoiceKey: 'SKE-26-27-021',
      invoiceDate: new Date('2026-04-18T00:00:00.000Z'),
      consigneeId: 'c-shasvanth-impex',
      portCode: 'INMAA1',
      packageCount: 65,
      invoiceValueUsd: 18450.0,
      shippingBillNumber: '2174892',
      shippingBillDate: new Date('2026-04-19T00:00:00.000Z'),
      sbExchangeRate: 92.2,
      fobValueInr: 1701090.0,
      blNumber: '736116000840',
      blDate: new Date('2026-05-12T00:00:00.000Z'),
      vesselName: 'SSL CHENNAI 042E',
      paymentStatus: 'FULLY_PAID',
      reviewStatus: 'CONFIRMED',
      remarks: 'Ladies woven apparel export to Shasvanth Impex Colombo. FIRC credited via DBS Bank.',
    },
  });

  // 6. Invoice Items
  const items = [
    { id: 'item-1', shipmentId: shipment1Id, description: 'Polyester Ladies Salwar', hsnCode: '62114390', quantity: 1549, unit: 'Pcs', rateUsd: 5.25, amountUsd: 8132.25 },
    { id: 'item-2', shipmentId: shipment1Id, description: 'Polyester Ladies Tops And Pant Set', hsnCode: '62044390', quantity: 334, unit: 'Pcs', rateUsd: 3.5, amountUsd: 1169.0 },
    { id: 'item-3', shipmentId: shipment1Id, description: 'Polyester Ladies Tops', hsnCode: '62114390', quantity: 901, unit: 'Pcs', rateUsd: 2.4, amountUsd: 2162.4 },
    { id: 'item-4', shipmentId: shipment1Id, description: 'Polyester Salwar Material Unstitched (745.60 Kgs, 15005.76 SqM)', hsnCode: '54075290', quantity: 1392, unit: 'Pcs', rateUsd: 2.0, amountUsd: 2784.0 },
    { id: 'item-5', shipmentId: shipment1Id, description: 'Polyester Fancy Salwar Material (2613.60 Kgs, 41438.32 SqM)', hsnCode: '54075290', quantity: 3844, unit: 'Pcs', rateUsd: 2.5, amountUsd: 9610.0 },
    { id: 'item-6', shipmentId: shipment1Id, description: 'Cotton Ladies Trousers', hsnCode: '62046290', quantity: 56, unit: 'Pcs', rateUsd: 3.0, amountUsd: 168.0 },
  ];
  for (const item of items) {
    await tx.invoiceItem.upsert({ where: { id: item.id }, update: {}, create: item });
  }

  // 7. Payments
  const payment1Id = 'p-firc-210426i049900457';
  const payment2Id = 'p-firc-280426i049900891';

  await tx.payment.upsert({
    where: { id: payment1Id },
    update: {},
    create: {
      id: payment1Id,
      irmNumber: '210426I049900457',
      senderReference: '2219730110JS',
      currency: 'USD',
      verifiedAmount: 24025.65,
      inrAmount: 2241112.63,
      exchangeRate: 93.28,
      valueDate: new Date('2026-04-20T00:00:00.000Z'),
      creditDate: new Date('2026-04-21T00:00:00.000Z'),
      fircIssueDate: new Date('2026-04-21T00:00:00.000Z'),
      bankId: 'b-hdfc-chennai',
      purposeCode: 'P0103',
      remarks: 'IMPORT INV SKE PI 26 27 020 DATE 04 SAMPATH BANK PLC 110 SIR JAMES PEIRIS MAWATHA',
    },
  });

  await tx.payment.upsert({
    where: { id: payment2Id },
    update: {},
    create: {
      id: payment2Id,
      irmNumber: '280426I049900891',
      senderReference: '2219800412SH',
      currency: 'USD',
      verifiedAmount: 18450.0,
      inrAmount: 1721016.0,
      exchangeRate: 93.28,
      valueDate: new Date('2026-04-28T00:00:00.000Z'),
      creditDate: new Date('2026-04-29T00:00:00.000Z'),
      fircIssueDate: new Date('2026-04-29T00:00:00.000Z'),
      bankId: 'b-dbs-india',
      purposeCode: 'P0103',
      remarks: 'Advance wire against export contracts for Shasvanth Impex Colombo',
    },
  });

  // 8. Allocations
  await tx.paymentAllocation.upsert({
    where: { id: 'alloc-1' },
    update: {},
    create: {
      id: 'alloc-1',
      paymentId: payment1Id,
      shipmentId: shipment1Id,
      allocatedAmountUsd: 24025.65,
      notes: 'Full invoice realization of $24,025.65 USD via HDFC IRM 210426I049900457',
      allocatedByUserId: adminUser.id,
    },
  });

  await tx.paymentAllocation.upsert({
    where: { id: 'alloc-2' },
    update: {},
    create: {
      id: 'alloc-2',
      paymentId: payment2Id,
      shipmentId: shipment2Id,
      allocatedAmountUsd: 18450.0,
      notes: 'Full invoice realization of $18,450.00 USD via DBS Bank India',
      allocatedByUserId: adminUser.id,
    },
  });

  // 9. Documents (staged cleanly into STORAGE_ROOT)
  const docSpecs: Array<{
    id: string;
    shipmentId: string;
    paymentId?: string;
    category: 'COMMERCIAL_INVOICE' | 'SHIPPING_BILL' | 'BILL_OF_LADING' | 'FIRC_PAYMENT' | 'BRC_COPY_1';
    originalFilename: string;
    assetFilename: string;
    targetRel: string;
    size: number;
  }> = [
    {
      id: 'doc-inv-020',
      shipmentId: shipment1Id,
      category: 'COMMERCIAL_INVOICE',
      originalFilename: 'SKE-26-27-020-Invoice.pdf',
      assetFilename: 'SKE-26-27-020-Invoice_12ae91b5.pdf',
      targetRel: 'FY2026-27/SKE-26-27-020/commercial_invoice_SKE-26-27-020.pdf',
      size: 145200,
    },
    {
      id: 'doc-sb-020',
      shipmentId: shipment1Id,
      category: 'SHIPPING_BILL',
      originalFilename: 'SKE-26-27-20-SHIPPING_BILL.pdf',
      assetFilename: 'SKE-26-27-20-SHIPPING_BILL_f9ef4226.pdf',
      targetRel: 'FY2026-27/SKE-26-27-020/shipping_bill_2173318.pdf',
      size: 210400,
    },
    {
      id: 'doc-bl-020',
      shipmentId: shipment1Id,
      category: 'BILL_OF_LADING',
      originalFilename: 'BL_SKE-26-27-20.pdf',
      assetFilename: 'BL_SKE-26-27-20_697529d4.pdf',
      targetRel: 'FY2026-27/SKE-26-27-020/bill_of_lading_736116000605.pdf',
      size: 185000,
    },
    {
      id: 'doc-firc-020',
      shipmentId: shipment1Id,
      paymentId: payment1Id,
      category: 'FIRC_PAYMENT',
      originalFilename: 'SKE-26-27-20-FIRC.pdf',
      assetFilename: 'SKE-26-27-20-FIRC_8af61d5b.pdf',
      targetRel: 'FY2026-27/SKE-26-27-020/firc_payment_210426I049900457.pdf',
      size: 168900,
    },
    {
      id: 'doc-brc-020',
      shipmentId: shipment1Id,
      category: 'BRC_COPY_1',
      originalFilename: 'BRC_Copy.pdf',
      assetFilename: 'BRC_Copy_4229e495.pdf',
      targetRel: 'FY2026-27/SKE-26-27-020/brc_copy_1_HDFC0000166A02685488.pdf',
      size: 132000,
    },
  ];

  for (const spec of docSpecs) {
    const storedPath = copySampleAssetToStorage(spec.assetFilename, spec.targetRel);
    await tx.document.upsert({
      where: { id: spec.id },
      update: {},
      create: {
        id: spec.id,
        shipmentId: spec.shipmentId,
        paymentId: spec.paymentId ?? null,
        category: spec.category,
        originalFilename: spec.originalFilename,
        storedPath,
        mimeType: 'application/pdf',
        fileSizeBytes: BigInt(spec.size),
        version: 1,
        isCurrent: true,
        reviewStatus: 'CONFIRMED',
        uploadedByUserId: adminUser.id,
      },
    });
  }

  // 10. Incentives
  const incentives = [
    { id: 'inc-dbk-1', shipmentId: shipment1Id, type: 'DRAWBACK' as const, claimedAmount: 65291, status: 'RECEIVED' as const, receivedAmount: 65291, receivedDate: new Date('2026-05-15T00:00:00.000Z'), scrollNumber: 'SCR-DBK-26-8819' },
    { id: 'inc-rodtep-1', shipmentId: shipment1Id, type: 'RODTEP' as const, claimedAmount: 26254, status: 'RECEIVED' as const, receivedAmount: 26254, receivedDate: new Date('2026-05-18T00:00:00.000Z'), scrollNumber: 'SCR-ROD-26-1029' },
    { id: 'inc-rosctl-1', shipmentId: shipment1Id, type: 'ROSCTL' as const, claimedAmount: 49195, status: 'RECEIVED' as const, receivedAmount: 49195, receivedDate: new Date('2026-05-20T00:00:00.000Z'), scrollNumber: 'SCR-ROS-26-4410' },
    { id: 'inc-dbk-2', shipmentId: shipment2Id, type: 'DRAWBACK' as const, claimedAmount: 50180, status: 'RECEIVED' as const, receivedAmount: 50180, receivedDate: new Date('2026-05-22T00:00:00.000Z'), scrollNumber: 'SCR-DBK-26-9012' },
    { id: 'inc-rodtep-2', shipmentId: shipment2Id, type: 'RODTEP' as const, claimedAmount: 20400, status: 'PENDING' as const, receivedAmount: 0, receivedDate: null, scrollNumber: null },
    { id: 'inc-rosctl-2', shipmentId: shipment2Id, type: 'ROSCTL' as const, claimedAmount: 37600, status: 'RECEIVED' as const, receivedAmount: 37600, receivedDate: new Date('2026-05-25T00:00:00.000Z'), scrollNumber: 'SCR-ROS-26-4921' },
  ];
  for (const inc of incentives) {
    await tx.incentiveRecord.upsert({ where: { id: inc.id }, update: {}, create: inc });
  }

  // 11. BRC Records
  await tx.brcRecord.upsert({
    where: { id: 'brc-1' },
    update: {},
    create: {
      id: 'brc-1',
      shipmentId: shipment1Id,
      brcNumber: 'HDFC0000166A02685488',
      issueDate: new Date('2026-09-02T00:00:00.000Z'),
      realisationDate: new Date('2026-04-20T00:00:00.000Z'),
      realisedAmount: 24025.65,
      realisedCurrency: 'USD',
      uploadMode: 'SINGLE',
      statutoryDeadline: new Date('2027-01-31T00:00:00.000Z'),
      status: 'REALISED',
      remarks: 'DGFT Statement of Bank Realisation eBRC verified online.',
    },
  });

  await tx.brcRecord.upsert({
    where: { id: 'brc-2' },
    update: {},
    create: {
      id: 'brc-2',
      shipmentId: shipment2Id,
      brcNumber: 'DBSS0IN0811A01948210',
      issueDate: new Date('2026-09-15T00:00:00.000Z'),
      realisationDate: new Date('2026-04-29T00:00:00.000Z'),
      realisedAmount: 18450.0,
      realisedCurrency: 'USD',
      uploadMode: 'SINGLE',
      statutoryDeadline: new Date('2027-02-15T00:00:00.000Z'),
      status: 'REALISED',
      remarks: 'eBRC received and recorded for Shasvanth Impex export',
    },
  });

  // 12. Legacy GST Entries
  const gstEntries = [
    {
      id: 'GST-2026-001',
      entryDate: new Date('2026-04-10T00:00:00.000Z'),
      consigneeId: 'c-sk-global-lk',
      consigneeName: 'S K GLOBAL VENTURES PRIVATE LIMITED',
      igst: 180000,
      cgst: 0,
      sgst: 0,
      totalGst: 180000,
      refundEligible: 195000,
      difference: 15000,
      result: 'GAIN' as const,
      remarks: 'FY26-27 Q1 export LUT refund claim processed via GSTN portal.',
    },
    {
      id: 'GST-2026-002',
      entryDate: new Date('2026-04-22T00:00:00.000Z'),
      consigneeId: 'c-shasvanth-impex',
      consigneeName: 'SHASVANTH IMPEX PRIVATE LIMITED',
      igst: 140000,
      cgst: 0,
      sgst: 0,
      totalGst: 140000,
      refundEligible: 128500,
      difference: -11500,
      result: 'LOSS' as const,
      remarks: 'Input tax credit reversal due to revised inland transport invoices.',
    },
    {
      id: 'GST-2026-003',
      entryDate: new Date('2026-05-05T00:00:00.000Z'),
      consigneeId: 'c-precision-tex-lanka',
      consigneeName: 'PRECISION TEX LANKA PVT LTD',
      igst: 0,
      cgst: 45000,
      sgst: 45000,
      totalGst: 90000,
      refundEligible: 90000,
      difference: 0,
      result: 'NIL' as const,
      remarks: 'Job work processing charges balanced against refund sanction order.',
    },
    {
      id: 'GST-2026-004',
      entryDate: new Date('2026-05-18T00:00:00.000Z'),
      consigneeId: 'c-tex-fab-lanka',
      consigneeName: 'TEX FAB LANKA PRIVATE LIMITED',
      igst: 220000,
      cgst: 0,
      sgst: 0,
      totalGst: 220000,
      refundEligible: 232000,
      difference: 12000,
      result: 'GAIN' as const,
      remarks: 'Apparel fabric export refund sanction with interest differential.',
    },
    {
      id: 'GST-2026-005',
      entryDate: new Date('2026-05-28T00:00:00.000Z'),
      consigneeId: 'c-winfield-merchant',
      consigneeName: 'WINFIELD MERCHANT AND GENERAL PVT LTD',
      igst: 95000,
      cgst: 0,
      sgst: 0,
      totalGst: 95000,
      refundEligible: 90000,
      difference: -5000,
      result: 'LOSS' as const,
      remarks: 'Deduction under Section 54(3) on non-eligible packing materials.',
    },
  ];
  for (const g of gstEntries) {
    await tx.gstEntry.upsert({ where: { id: g.id }, update: {}, create: g });
  }

  // 13. B2B Suppliers
  const suppliers = [
    { id: 'sup-kothari', gstin: '33AAACH2748P1ZP', legalName: 'KOTHARI TEXTILE MILLS PRIVATE LIMITED', tradeName: 'Kothari Textiles', address: '42, Mill Road, Coimbatore, Tamil Nadu 641001', state: 'Tamil Nadu' },
    { id: 'sup-balaji', gstin: '33AABCS1429B1Z2', legalName: 'SRI BALAJI COTTON SPINNERS', tradeName: 'Sri Balaji Spinners', address: '15, Spinning Mill Road, Tiruppur, Tamil Nadu 641604', state: 'Tamil Nadu' },
    { id: 'sup-premier', gstin: '27AAACP0124M1Z8', legalName: 'PREMIER PACKAGING INDUSTRIES', tradeName: 'Premier Packaging', address: 'Plot 88, MIDC Industrial Area, Pune, Maharashtra 411018', state: 'Maharashtra' },
    { id: 'sup-lakshmi', gstin: '33AAACL1928K1ZR', legalName: 'LAKSHMI CARD CLOTHING MFG CO', tradeName: 'Lakshmi Card Clothing', address: '1087, Avanashi Road, Coimbatore, Tamil Nadu 641037', state: 'Tamil Nadu' },
    { id: 'sup-reliance', gstin: '29AAACR3849D1Z4', legalName: 'RELIANCE POLYESTERS KARNATAKA', tradeName: 'Reliance Polyesters', address: 'Industrial Suburb, Peenya, Bengaluru, Karnataka 560058', state: 'Karnataka' },
    { id: 'sup-freight', gstin: '33AABCT9941L1Z1', legalName: 'TAMILNADU FREIGHT LOGISTICS', tradeName: 'TN Freight', address: 'Port Access Road, Tuticorin, Tamil Nadu 628004', state: 'Tamil Nadu' },
    { id: 'sup-eastern', gstin: '07AABCE4128N1Z5', legalName: 'EASTERN CORRUGATED BOXES DELHI', tradeName: 'Eastern Boxes', address: 'Okhla Industrial Area Phase 2, New Delhi 110020', state: 'Delhi' },
    { id: 'sup-global-threads', gstin: '33AAACG3829F1Z3', legalName: 'GLOBAL THREADS & ACCESSORIES', tradeName: 'Global Threads', address: '24, Main Bazaar, Erode, Tamil Nadu 638001', state: 'Tamil Nadu' },
  ];
  for (const sup of suppliers) {
    await tx.supplier.upsert({ where: { id: sup.id }, update: {}, create: sup });
  }

  // 14. B2B Invoices
  const b2bInvoices = [
    { id: 'b2b-inv-1', supplierId: 'sup-kothari', supplierGstin: '33AAACH2748P1ZP', supplierName: 'KOTHARI TEXTILE MILLS PRIVATE LIMITED', invoiceNumber: 'INV-2026-089', invoiceType: 'Regular', invoiceDate: '2026-06-12', invoiceValue: 118000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 100000, integratedTax: 0, centralTax: 9000, stateUtTax: 9000, cess: 0, totalGst: 18000, gstrPeriod: 'June 2026', periodKey: '2026-06', financialYear: '2026-27', filingDate: '2026-07-10', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-2', supplierId: 'sup-balaji', supplierGstin: '33AABCS1429B1Z2', supplierName: 'SRI BALAJI COTTON SPINNERS', invoiceNumber: 'SBCS/26/104', invoiceType: 'Regular', invoiceDate: '2026-06-18', invoiceValue: 236000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 200000, integratedTax: 0, centralTax: 18000, stateUtTax: 18000, cess: 0, totalGst: 36000, gstrPeriod: 'June 2026', periodKey: '2026-06', financialYear: '2026-27', filingDate: '2026-07-11', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1/IFF' },
    { id: 'b2b-inv-3', supplierId: 'sup-premier', supplierGstin: '27AAACP0124M1Z8', supplierName: 'PREMIER PACKAGING INDUSTRIES', invoiceNumber: 'PPI/26-27/045', invoiceType: 'Regular', invoiceDate: '2026-06-22', invoiceValue: 59000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 50000, integratedTax: 9000, centralTax: 0, stateUtTax: 0, cess: 0, totalGst: 9000, gstrPeriod: 'June 2026', periodKey: '2026-06', financialYear: '2026-27', filingDate: '2026-07-09', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1', irn: '7b4d9a1f2c3e4b5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', irnDate: '2026-06-22' },
    { id: 'b2b-inv-4', supplierId: 'sup-lakshmi', supplierGstin: '33AAACL1928K1ZR', supplierName: 'LAKSHMI CARD CLOTHING MFG CO', invoiceNumber: 'LCC/6211', invoiceType: 'Regular', invoiceDate: '2026-07-04', invoiceValue: 354000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 300000, integratedTax: 0, centralTax: 27000, stateUtTax: 27000, cess: 0, totalGst: 54000, gstrPeriod: 'July 2026', periodKey: '2026-07', financialYear: '2026-27', filingDate: '2026-08-10', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-5', supplierId: 'sup-reliance', supplierGstin: '29AAACR3849D1Z4', supplierName: 'RELIANCE POLYESTERS KARNATAKA', invoiceNumber: 'RPK/26/892', invoiceType: 'Regular', invoiceDate: '2026-07-15', invoiceValue: 590000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 500000, integratedTax: 90000, centralTax: 0, stateUtTax: 0, cess: 0, totalGst: 90000, gstrPeriod: 'July 2026', periodKey: '2026-07', financialYear: '2026-27', filingDate: '2026-08-11', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1', irn: '3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d', irnDate: '2026-07-15' },
    { id: 'b2b-inv-6', supplierId: 'sup-freight', supplierGstin: '33AABCT9941L1Z1', supplierName: 'TAMILNADU FREIGHT LOGISTICS', invoiceNumber: 'TFL/INV/552', invoiceType: 'Regular', invoiceDate: '2026-07-28', invoiceValue: 26250, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'Y', taxableValue: 25000, integratedTax: 0, centralTax: 625, stateUtTax: 625, cess: 0, totalGst: 1250, gstrPeriod: 'July 2026', periodKey: '2026-07', financialYear: '2026-27', filingDate: '2026-08-12', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-7', supplierId: 'sup-kothari', supplierGstin: '33AAACH2748P1ZP', supplierName: 'KOTHARI TEXTILE MILLS PRIVATE LIMITED', invoiceNumber: 'INV-2026-142', invoiceType: 'Regular', invoiceDate: '2026-08-05', invoiceValue: 177000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 150000, integratedTax: 0, centralTax: 13500, stateUtTax: 13500, cess: 0, totalGst: 27000, gstrPeriod: 'August 2026', periodKey: '2026-08', financialYear: '2026-27', filingDate: '2026-09-11', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-8', supplierId: 'sup-balaji', supplierGstin: '33AABCS1429B1Z2', supplierName: 'SRI BALAJI COTTON SPINNERS', invoiceNumber: 'SBCS/26/218', invoiceType: 'Regular', invoiceDate: '2026-08-19', invoiceValue: 472000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 400000, integratedTax: 0, centralTax: 36000, stateUtTax: 36000, cess: 0, totalGst: 72000, gstrPeriod: 'August 2026', periodKey: '2026-08', financialYear: '2026-27', filingDate: '2026-09-11', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-9', supplierId: 'sup-eastern', supplierGstin: '07AABCE4128N1Z5', supplierName: 'EASTERN CORRUGATED BOXES DELHI', invoiceNumber: 'ECB/26-27/112', invoiceType: 'Regular', invoiceDate: '2026-08-28', invoiceValue: 88500, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 75000, integratedTax: 13500, centralTax: 0, stateUtTax: 0, cess: 0, totalGst: 13500, gstrPeriod: 'August 2026', periodKey: '2026-08', financialYear: '2026-27', filingDate: '2026-09-10', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1', irn: '8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', irnDate: '2026-08-28' },
    { id: 'b2b-inv-10', supplierId: 'sup-global-threads', supplierGstin: '33AAACG3829F1Z3', supplierName: 'GLOBAL THREADS & ACCESSORIES', invoiceNumber: 'GTA/26/401', invoiceType: 'Regular', invoiceDate: '2026-09-03', invoiceValue: 64900, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 55000, integratedTax: 0, centralTax: 4950, stateUtTax: 4950, cess: 0, totalGst: 9900, gstrPeriod: 'September 2026', periodKey: '2026-09', financialYear: '2026-27', filingDate: '2026-10-11', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-11', supplierId: 'sup-premier', supplierGstin: '27AAACP0124M1Z8', supplierName: 'PREMIER PACKAGING INDUSTRIES', invoiceNumber: 'PPI/26-27/098', invoiceType: 'Regular', invoiceDate: '2026-09-14', invoiceValue: 118000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 100000, integratedTax: 18000, centralTax: 0, stateUtTax: 0, cess: 0, totalGst: 18000, gstrPeriod: 'September 2026', periodKey: '2026-09', financialYear: '2026-27', filingDate: '2026-10-09', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-12', supplierId: 'sup-freight', supplierGstin: '33AABCT9941L1Z1', supplierName: 'TAMILNADU FREIGHT LOGISTICS', invoiceNumber: 'TFL/INV/780', invoiceType: 'Regular', invoiceDate: '2026-09-25', invoiceValue: 31500, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'Y', taxableValue: 30000, integratedTax: 0, centralTax: 750, stateUtTax: 750, cess: 0, totalGst: 1500, gstrPeriod: 'September 2026', periodKey: '2026-09', financialYear: '2026-27', filingDate: '2026-10-11', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-13', supplierId: 'sup-lakshmi', supplierGstin: '33AAACL1928K1ZR', supplierName: 'LAKSHMI CARD CLOTHING MFG CO', invoiceNumber: 'LCC/7104', invoiceType: 'Regular', invoiceDate: '2026-10-08', invoiceValue: 295000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 250000, integratedTax: 0, centralTax: 22500, stateUtTax: 22500, cess: 0, totalGst: 45000, gstrPeriod: 'October 2026', periodKey: '2026-10', financialYear: '2026-27', filingDate: '2026-11-11', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1' },
    { id: 'b2b-inv-14', supplierId: 'sup-reliance', supplierGstin: '29AAACR3849D1Z4', supplierName: 'RELIANCE POLYESTERS KARNATAKA', invoiceNumber: 'RPK/26/1102', invoiceType: 'Regular', invoiceDate: '2026-10-20', invoiceValue: 708000, placeOfSupply: '33-Tamil Nadu', reverseCharge: 'N', taxableValue: 600000, integratedTax: 108000, centralTax: 0, stateUtTax: 0, cess: 0, totalGst: 108000, gstrPeriod: 'October 2026', periodKey: '2026-10', financialYear: '2026-27', filingDate: '2026-11-10', itcAvailability: 'Yes', applicableTaxRate: 100, source: 'GSTR-1', irn: '9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c', irnDate: '2026-10-20' },
  ];

  for (const inv of b2bInvoices) {
    await tx.b2bInvoice.upsert({
      where: { id: inv.id },
      update: {},
      create: {
        id: inv.id,
        supplierId: inv.supplierId,
        supplierGstin: inv.supplierGstin,
        supplierName: inv.supplierName,
        invoiceNumber: inv.invoiceNumber,
        invoiceType: inv.invoiceType,
        invoiceDate: new Date(`${inv.invoiceDate}T00:00:00.000Z`),
        invoiceValue: inv.invoiceValue,
        placeOfSupply: inv.placeOfSupply,
        reverseCharge: inv.reverseCharge,
        taxableValue: inv.taxableValue,
        integratedTax: inv.integratedTax,
        centralTax: inv.centralTax,
        stateUtTax: inv.stateUtTax,
        cess: inv.cess,
        totalGst: inv.totalGst,
        gstrPeriod: inv.gstrPeriod,
        periodKey: inv.periodKey,
        financialYear: inv.financialYear,
        filingDate: inv.filingDate ? new Date(`${inv.filingDate}T00:00:00.000Z`) : null,
        itcAvailability: inv.itcAvailability,
        applicableTaxRate: inv.applicableTaxRate,
        source: inv.source,
        irn: inv.irn ?? null,
        irnDate: inv.irnDate ? new Date(`${inv.irnDate}T00:00:00.000Z`) : null,
      },
    });
  }

  // 15. App Settings
  const settingPairs: Array<[string, string]> = [
    ['statutoryBrcDays', String(DEFAULT_APP_SETTINGS.statutoryBrcDays)],
    ['defaultPortCode', DEFAULT_APP_SETTINGS.defaultPortCode],
    ['baseCurrency', DEFAULT_APP_SETTINGS.baseCurrency],
    ['allowOverAllocation', String(DEFAULT_APP_SETTINGS.allowOverAllocation)],
    ['companyName', DEFAULT_APP_SETTINGS.companyName],
    ['iecNumber', DEFAULT_APP_SETTINGS.iecNumber],
    ['panNumber', DEFAULT_APP_SETTINGS.panNumber],
  ];
  for (const [key, value] of settingPairs) {
    await tx.appSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  return { shipments: 2 };
}

export const seedService = {
  async seedIfEmpty(): Promise<boolean> {
    const prisma = getPrisma();
    const userCount = await prisma.user.count();
    if (userCount > 0) return false;

    await withTransaction(async (tx) => {
      await seedDataset(tx);
    });
    return true;
  },

  async reseedWithDefaults(): Promise<{ success: boolean; count: number }> {
    const result = await withTransaction(async (tx) => {
      await tx.paymentAllocation.deleteMany();
      await tx.invoiceItem.deleteMany();
      await tx.document.deleteMany();
      await tx.incentiveRecord.deleteMany();
      await tx.brcRecord.deleteMany();
      await tx.payment.deleteMany();
      await tx.shipment.deleteMany();
      await tx.b2bInvoice.deleteMany();
      await tx.importBatch.deleteMany();
      await tx.supplier.deleteMany();
      await tx.gstEntry.deleteMany();
      await tx.ocrJob.deleteMany();
      return seedDataset(tx);
    });

    return { success: true, count: result.shipments };
  },
};
