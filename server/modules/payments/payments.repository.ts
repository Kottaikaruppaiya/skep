/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Payment, PaymentAllocation } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toDateOnlyString, toIsoString } from '../../shared/utils/date.ts';
import { toNumber } from '../../shared/utils/decimal.ts';
import { mapDocument } from '../documents/documents.repository.ts';
import { calculatePaymentBalances } from './payment.calculator.ts';

function mapPaymentRow(row: any, userNames: Map<string, string>): Payment {
  const verifiedAmount = toNumber(row.verifiedAmount);
  const allocations: PaymentAllocation[] = (row.allocations || []).map((a: any) => ({
    id: a.id,
    paymentId: a.paymentId,
    shipmentId: a.shipmentId,
    allocatedAmountUsd: toNumber(a.allocatedAmountUsd),
    notes: a.notes || undefined,
    allocatedAt: toIsoString(a.allocatedAt),
    allocatedByUserId: a.allocatedByUserId,
    allocatedByName: userNames.get(a.allocatedByUserId) || 'Admin',
    shipmentInvoiceNo: a.shipment?.invoiceNumber,
  }));

  const balances = calculatePaymentBalances(verifiedAmount, allocations);

  return {
    id: row.id,
    irmNumber: row.irmNumber,
    senderReference: row.senderReference || undefined,
    currency: row.currency,
    verifiedAmount,
    inrAmount: row.inrAmount !== null && row.inrAmount !== undefined ? toNumber(row.inrAmount) : undefined,
    exchangeRate: row.exchangeRate !== null && row.exchangeRate !== undefined ? toNumber(row.exchangeRate) : undefined,
    valueDate: toDateOnlyString(row.valueDate) || '',
    creditDate: toDateOnlyString(row.creditDate) || '',
    fircIssueDate: toDateOnlyString(row.fircIssueDate),
    bankId: row.bankId,
    bankName: row.bank?.name || 'Unknown Bank',
    purposeCode: row.purposeCode || undefined,
    remarks: row.remarks || undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    documents: (row.documents || []).filter((d: any) => d.isCurrent).map(mapDocument),
    allocations,
    totalAllocatedUsd: balances.totalAllocatedUsd,
    availableBalanceUsd: balances.availableBalanceUsd,
  };
}

export const paymentsRepository = {
  async findAll(db: DbClient = getPrisma()): Promise<Payment[]> {
    const [rows, users] = await Promise.all([
      db.payment.findMany({
        include: {
          bank: { select: { name: true } },
          allocations: { include: { shipment: { select: { invoiceNumber: true } } } },
          documents: {
            where: { isCurrent: true },
            include: { uploadedByUser: { select: { name: true } } },
          },
        },
        orderBy: { creditDate: 'desc' },
      }),
      db.user.findMany({ select: { id: true, name: true } }),
    ]);

    const userNames = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => mapPaymentRow(r, userNames));
  },

  async findById(id: string, db: DbClient = getPrisma()): Promise<Payment | null> {
    const [row, users] = await Promise.all([
      db.payment.findUnique({
        where: { id },
        include: {
          bank: { select: { name: true } },
          allocations: { include: { shipment: { select: { invoiceNumber: true } } } },
          documents: {
            where: { isCurrent: true },
            include: { uploadedByUser: { select: { name: true } } },
          },
        },
      }),
      db.user.findMany({ select: { id: true, name: true } }),
    ]);

    if (!row) return null;
    const userNames = new Map(users.map((u) => [u.id, u.name]));
    return mapPaymentRow(row, userNames);
  },

  async findByIrmNumber(irmNumber: string, db: DbClient = getPrisma()): Promise<Payment | null> {
    const clean = irmNumber.trim().toUpperCase();
    const row = await db.payment.findFirst({
      where: { irmNumber: { equals: clean, mode: 'insensitive' } },
      include: {
        bank: { select: { name: true } },
        allocations: { include: { shipment: { select: { invoiceNumber: true } } } },
        documents: {
          where: { isCurrent: true },
          include: { uploadedByUser: { select: { name: true } } },
        },
      },
    });
    if (!row) return null;
    return mapPaymentRow(row, new Map());
  },

  async create(
    data: {
      id?: string;
      irmNumber: string;
      senderReference?: string;
      currency: string;
      verifiedAmount: number;
      inrAmount?: number | null;
      exchangeRate?: number | null;
      valueDate: Date;
      creditDate: Date;
      fircIssueDate?: Date | null;
      bankId: string;
      purposeCode?: string;
      remarks?: string;
    },
    db: DbClient = getPrisma()
  ): Promise<Payment> {
    const created = await db.payment.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        irmNumber: data.irmNumber.trim().toUpperCase(),
        senderReference: data.senderReference?.trim() || null,
        currency: data.currency || 'USD',
        verifiedAmount: data.verifiedAmount,
        inrAmount: data.inrAmount ?? null,
        exchangeRate: data.exchangeRate ?? null,
        valueDate: data.valueDate,
        creditDate: data.creditDate,
        fircIssueDate: data.fircIssueDate ?? null,
        bankId: data.bankId,
        purposeCode: data.purposeCode || 'P0102',
        remarks: data.remarks?.trim() || null,
      },
      include: {
        bank: { select: { name: true } },
        allocations: { include: { shipment: { select: { invoiceNumber: true } } } },
        documents: { where: { isCurrent: true }, include: { uploadedByUser: { select: { name: true } } } },
      },
    });
    return mapPaymentRow(created, new Map());
  },

  async update(
    id: string,
    data: Partial<{
      irmNumber: string;
      senderReference: string | null;
      verifiedAmount: number;
      inrAmount: number | null;
      exchangeRate: number | null;
      valueDate: Date;
      creditDate: Date;
      fircIssueDate: Date | null;
      bankId: string;
      purposeCode: string | null;
      remarks: string | null;
    }>,
    db: DbClient = getPrisma()
  ): Promise<Payment> {
    const updated = await db.payment.update({
      where: { id },
      data,
      include: {
        bank: { select: { name: true } },
        allocations: { include: { shipment: { select: { invoiceNumber: true } } } },
        documents: { where: { isCurrent: true }, include: { uploadedByUser: { select: { name: true } } } },
      },
    });
    return mapPaymentRow(updated, new Map());
  },

  async delete(id: string, db: DbClient = getPrisma()): Promise<void> {
    await db.document.updateMany({ where: { paymentId: id }, data: { paymentId: null } });
    await db.payment.delete({ where: { id } });
  },

  async lockPaymentById(
    paymentId: string,
    db: DbClient
  ): Promise<{ id: string; irmNumber: string; verifiedAmount: number } | null> {
    const paymentRows = await db.$queryRaw<
      Array<{ id: string; irmNumber: string; verifiedAmount: any }>
    >`SELECT id, "irmNumber", "verifiedAmount" FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;

    return paymentRows[0]
      ? {
          id: paymentRows[0].id,
          irmNumber: paymentRows[0].irmNumber,
          verifiedAmount: toNumber(paymentRows[0].verifiedAmount),
        }
      : null;
  },

  /**
   * Acquires PostgreSQL row-level FOR UPDATE locks on both Payment and Shipment
   * inside a transaction to prevent concurrent over-allocation races.
   */
  async lockPaymentAndShipmentForAllocation(
    paymentId: string,
    shipmentId: string,
    db: DbClient
  ): Promise<{
    payment: { id: string; irmNumber: string; verifiedAmount: number } | null;
    shipment: { id: string; invoiceNumber: string; invoiceValueUsd: number } | null;
  }> {
    const paymentRows = await db.$queryRaw<
      Array<{ id: string; irmNumber: string; verifiedAmount: any }>
    >`SELECT id, "irmNumber", "verifiedAmount" FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;

    const shipmentRows = await db.$queryRaw<
      Array<{ id: string; invoiceNumber: string; invoiceValueUsd: any }>
    >`SELECT id, "invoiceNumber", "invoiceValueUsd" FROM "Shipment" WHERE id = ${shipmentId} FOR UPDATE`;

    return {
      payment: paymentRows[0]
        ? {
            id: paymentRows[0].id,
            irmNumber: paymentRows[0].irmNumber,
            verifiedAmount: toNumber(paymentRows[0].verifiedAmount),
          }
        : null,
      shipment: shipmentRows[0]
        ? {
            id: shipmentRows[0].id,
            invoiceNumber: shipmentRows[0].invoiceNumber,
            invoiceValueUsd: toNumber(shipmentRows[0].invoiceValueUsd),
          }
        : null,
    };
  },

  async sumAllocationsForPayment(paymentId: string, db: DbClient): Promise<number> {
    const agg = await db.paymentAllocation.aggregate({
      where: { paymentId },
      _sum: { allocatedAmountUsd: true },
    });
    return toNumber(agg._sum.allocatedAmountUsd);
  },

  async sumAllocationsForShipment(shipmentId: string, db: DbClient): Promise<number> {
    const agg = await db.paymentAllocation.aggregate({
      where: { shipmentId },
      _sum: { allocatedAmountUsd: true },
    });
    return toNumber(agg._sum.allocatedAmountUsd);
  },

  async createAllocation(
    data: {
      paymentId: string;
      shipmentId: string;
      allocatedAmountUsd: number;
      notes?: string;
      allocatedByUserId: string;
    },
    db: DbClient
  ): Promise<PaymentAllocation> {
    const [created, user] = await Promise.all([
      db.paymentAllocation.create({
        data: {
          paymentId: data.paymentId,
          shipmentId: data.shipmentId,
          allocatedAmountUsd: data.allocatedAmountUsd,
          notes: data.notes?.trim() || null,
          allocatedByUserId: data.allocatedByUserId,
        },
      }),
      db.user.findUnique({ where: { id: data.allocatedByUserId }, select: { name: true } }),
    ]);

    return {
      id: created.id,
      paymentId: created.paymentId,
      shipmentId: created.shipmentId,
      allocatedAmountUsd: toNumber(created.allocatedAmountUsd),
      notes: created.notes || undefined,
      allocatedAt: toIsoString(created.allocatedAt),
      allocatedByUserId: created.allocatedByUserId,
      allocatedByName: user?.name || 'Admin',
    };
  },

  async findAllocationById(id: string, db: DbClient = getPrisma()) {
    return db.paymentAllocation.findUnique({ where: { id } });
  },

  async deleteAllocation(id: string, db: DbClient): Promise<void> {
    await db.paymentAllocation.delete({ where: { id } });
  },
};
