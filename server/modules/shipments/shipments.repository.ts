/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PaymentStatus, ReviewStatus, Shipment } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toDateOnlyString, toIsoString } from '../../shared/utils/date.ts';
import { toNumber } from '../../shared/utils/decimal.ts';
import { mapBrc } from '../brc/brc.repository.ts';
import { mapDocument } from '../documents/documents.repository.ts';
import { mapIncentive } from '../incentives/incentives.repository.ts';
import { calculateShipmentFinancials } from './shipment.calculator.ts';

function mapShipmentRow(row: any, userNames: Map<string, string>): Shipment {
  const invoiceValueUsd = toNumber(row.invoiceValueUsd);
  const allocations = (row.allocations || []).map((a: any) => ({
    id: a.id,
    paymentId: a.paymentId,
    shipmentId: a.shipmentId,
    allocatedAmountUsd: toNumber(a.allocatedAmountUsd),
    notes: a.notes || undefined,
    allocatedAt: toIsoString(a.allocatedAt),
    allocatedByUserId: a.allocatedByUserId,
    allocatedByName: userNames.get(a.allocatedByUserId) || 'Admin',
    paymentIrm: a.payment?.irmNumber,
  }));

  const documents = (row.documents || []).filter((d: any) => d.isCurrent).map(mapDocument);
  const incentives = (row.incentives || []).map(mapIncentive);
  const brcRecord = row.brcRecord ? mapBrc(row.brcRecord) : undefined;

  const financials = calculateShipmentFinancials(
    invoiceValueUsd,
    (row.allocations || []).map((a: any) => ({
      allocatedAmountUsd: toNumber(a.allocatedAmountUsd),
      paymentExchangeRate: a.payment?.exchangeRate ? toNumber(a.payment.exchangeRate) : null,
    }))
  );

  const hasFircDoc = documents.some((d: any) => d.category === 'FIRC_PAYMENT');
  const hasFircEvidence = hasFircDoc || allocations.length > 0;

  return {
    id: row.id,
    financialYearId: row.financialYearId,
    financialYearLabel: row.financialYear?.label || 'Unknown FY',
    invoiceNumber: row.invoiceNumber,
    normalizedInvoiceKey: row.normalizedInvoiceKey,
    invoiceDate: toDateOnlyString(row.invoiceDate) || '',
    consigneeId: row.consigneeId,
    consigneeName: row.consignee?.name || 'Unknown Buyer',
    portCode: row.portCode,
    packageCount: row.packageCount ?? undefined,
    invoiceValueUsd,
    shippingBillNumber: row.shippingBillNumber,
    shippingBillDate: toDateOnlyString(row.shippingBillDate) || '',
    sbExchangeRate: toNumber(row.sbExchangeRate),
    fobValueInr: toNumber(row.fobValueInr),
    blNumber: row.blNumber || undefined,
    blDate: toDateOnlyString(row.blDate),
    vesselName: row.vesselName || undefined,
    paymentStatus: financials.paymentStatus,
    reviewStatus: row.reviewStatus as ReviewStatus,
    remarks: row.remarks || undefined,
    isArchived: Boolean(row.isArchived),
    archivedAt: row.archivedAt ? toIsoString(row.archivedAt) : undefined,
    archivedReason: row.archivedReason || undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    items: (row.items || []).map((it: any) => ({
      id: it.id,
      shipmentId: it.shipmentId,
      description: it.description,
      hsnCode: it.hsnCode || undefined,
      quantity: toNumber(it.quantity),
      unit: it.unit,
      rateUsd: toNumber(it.rateUsd),
      amountUsd: toNumber(it.amountUsd),
    })),
    documents,
    allocations,
    incentives,
    brcRecord,
    totalPaidUsd: financials.totalPaidUsd,
    balanceDueUsd: financials.balanceDueUsd,
    realisedInr: financials.realisedInr,
    averageRealisedRate: financials.averageRealisedRate,
    hasFircEvidence,
  };
}

const shipmentInclude = {
  financialYear: { select: { label: true } },
  consignee: { select: { name: true } },
  items: true,
  documents: {
    where: { isCurrent: true },
    include: { uploadedByUser: { select: { name: true } } },
  },
  allocations: {
    include: {
      payment: { select: { irmNumber: true, exchangeRate: true } },
    },
  },
  incentives: true,
  brcRecord: true,
} as const;

export const shipmentsRepository = {
  async findAll(
    filters?: {
      financialYearId?: string;
      consigneeId?: string;
      paymentStatus?: string;
      reviewStatus?: string;
      search?: string;
    },
    db: DbClient = getPrisma()
  ): Promise<Shipment[]> {
    const where: any = {};
    if (filters?.financialYearId && filters.financialYearId !== 'ALL') {
      where.financialYearId = filters.financialYearId;
    }
    if (filters?.consigneeId && filters.consigneeId !== 'ALL') {
      where.consigneeId = filters.consigneeId;
    }
    if (filters?.reviewStatus && filters.reviewStatus !== 'ALL') {
      where.reviewStatus = filters.reviewStatus;
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { normalizedInvoiceKey: { contains: q, mode: 'insensitive' } },
        { shippingBillNumber: { contains: q, mode: 'insensitive' } },
        { blNumber: { contains: q, mode: 'insensitive' } },
        { consignee: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [rows, users] = await Promise.all([
      db.shipment.findMany({
        where,
        include: shipmentInclude,
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      }),
      db.user.findMany({ select: { id: true, name: true } }),
    ]);

    const userNames = new Map(users.map((u) => [u.id, u.name]));
    let mapped = rows.map((r) => mapShipmentRow(r, userNames));

    if (filters?.paymentStatus && filters.paymentStatus !== 'ALL') {
      mapped = mapped.filter((s) => s.paymentStatus === filters.paymentStatus);
    }

    return mapped;
  },

  async findById(id: string, db: DbClient = getPrisma()): Promise<Shipment | null> {
    const [row, users] = await Promise.all([
      db.shipment.findUnique({ where: { id }, include: shipmentInclude }),
      db.user.findMany({ select: { id: true, name: true } }),
    ]);
    if (!row) return null;
    const userNames = new Map(users.map((u) => [u.id, u.name]));
    return mapShipmentRow(row, userNames);
  },

  async findByNormalizedKey(
    normalizedKey: string,
    financialYearId: string,
    db: DbClient = getPrisma()
  ): Promise<Shipment | null> {
    const row = await db.shipment.findFirst({
      where: { financialYearId, normalizedInvoiceKey: normalizedKey },
      include: shipmentInclude,
    });
    if (!row) return null;
    return mapShipmentRow(row, new Map());
  },

  async create(
    data: {
      id?: string;
      financialYearId: string;
      invoiceNumber: string;
      normalizedInvoiceKey: string;
      invoiceDate: Date;
      consigneeId: string;
      portCode: string;
      packageCount?: number | null;
      invoiceValueUsd: number;
      shippingBillNumber: string;
      shippingBillDate: Date;
      sbExchangeRate: number;
      fobValueInr: number;
      blNumber?: string | null;
      blDate?: Date | null;
      vesselName?: string | null;
      paymentStatus?: PaymentStatus;
      reviewStatus?: ReviewStatus;
      remarks?: string | null;
    },
    db: DbClient = getPrisma()
  ): Promise<{ id: string }> {
    const created = await db.shipment.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        financialYearId: data.financialYearId,
        invoiceNumber: data.invoiceNumber,
        normalizedInvoiceKey: data.normalizedInvoiceKey,
        invoiceDate: data.invoiceDate,
        consigneeId: data.consigneeId,
        portCode: data.portCode,
        packageCount: data.packageCount ?? 0,
        invoiceValueUsd: data.invoiceValueUsd,
        shippingBillNumber: data.shippingBillNumber,
        shippingBillDate: data.shippingBillDate,
        sbExchangeRate: data.sbExchangeRate,
        fobValueInr: data.fobValueInr,
        blNumber: data.blNumber ?? null,
        blDate: data.blDate ?? null,
        vesselName: data.vesselName ?? null,
        paymentStatus: data.paymentStatus || 'UNPAID',
        reviewStatus: data.reviewStatus || 'CONFIRMED',
        remarks: data.remarks ?? null,
      },
      select: { id: true },
    });
    return created;
  },

  async updateRaw(id: string, data: Record<string, any>, db: DbClient = getPrisma()): Promise<void> {
    await db.shipment.update({ where: { id }, data });
  },

  async delete(id: string, db: DbClient = getPrisma()): Promise<void> {
    await db.shipment.delete({ where: { id } });
  },
};
