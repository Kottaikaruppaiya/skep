/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BankMaster, ConsigneeMaster, FinancialYear } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';
import { toDateOnlyString, toIsoString } from '../../shared/utils/date.ts';

function deriveFyDatesFromLabel(label: string): { start: string; end: string } {
  const match = String(label || '').match(/(\d{4})/);
  const now = new Date();
  const fallbackStartYear = now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const startYear = match ? parseInt(match[1], 10) : fallbackStartYear;
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

function mapFinancialYear(row: {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}): FinancialYear {
  const fallbackDates = deriveFyDatesFromLabel(row.label);
  return {
    id: row.id,
    label: row.label,
    startDate: toDateOnlyString(row.startDate) || fallbackDates.start,
    endDate: toDateOnlyString(row.endDate) || fallbackDates.end,
    isCurrent: row.isCurrent,
  };
}

function mapConsignee(row: {
  id: string;
  name: string;
  country: string;
  portOfDischarge: string | null;
  paymentTerms: string | null;
  currency: string;
  contactEmail: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ConsigneeMaster {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    portOfDischarge: row.portOfDischarge || '',
    paymentTerms: row.paymentTerms || '',
    currency: row.currency,
    contactEmail: row.contactEmail || undefined,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapBank(row: {
  id: string;
  name: string;
  branch: string | null;
  adCode: string | null;
  ifscCode: string | null;
  swiftCode: string | null;
  accountNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): BankMaster {
  return {
    id: row.id,
    name: row.name,
    branch: row.branch || '',
    adCode: row.adCode || '',
    ifscCode: row.ifscCode || '',
    swiftCode: row.swiftCode || '',
    accountNumber: row.accountNumber || '',
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export const mastersRepository = {
  // --- Financial Years ---
  async findAllFinancialYears(db: DbClient = getPrisma()): Promise<FinancialYear[]> {
    const rows = await db.financialYear.findMany({ orderBy: { startDate: 'desc' } });
    return rows.map(mapFinancialYear);
  },

  async findCurrentFinancialYear(db: DbClient = getPrisma()): Promise<FinancialYear | null> {
    const row =
      (await db.financialYear.findFirst({ where: { isCurrent: true } })) ||
      (await db.financialYear.findFirst({ orderBy: { startDate: 'desc' } }));
    return row ? mapFinancialYear(row) : null;
  },

  async findFinancialYearById(id: string, db: DbClient = getPrisma()): Promise<FinancialYear | null> {
    const row = await db.financialYear.findUnique({ where: { id } });
    return row ? mapFinancialYear(row) : null;
  },

  // --- Consignees ---
  async findAllConsignees(db: DbClient = getPrisma()): Promise<ConsigneeMaster[]> {
    const rows = await db.consigneeMaster.findMany({ orderBy: { name: 'asc' } });
    return rows.map(mapConsignee);
  },

  async findConsigneeById(id: string, db: DbClient = getPrisma()): Promise<ConsigneeMaster | null> {
    const row = await db.consigneeMaster.findUnique({ where: { id } });
    return row ? mapConsignee(row) : null;
  },

  async findConsigneeByName(name: string, db: DbClient = getPrisma()): Promise<ConsigneeMaster | null> {
    const row = await db.consigneeMaster.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
    });
    return row ? mapConsignee(row) : null;
  },

  async createConsignee(
    data: {
      id?: string;
      name: string;
      country: string;
      portOfDischarge?: string;
      paymentTerms?: string;
      currency?: string;
      contactEmail?: string;
      isActive?: boolean;
    },
    db: DbClient = getPrisma()
  ): Promise<ConsigneeMaster> {
    const row = await db.consigneeMaster.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        name: data.name.trim(),
        country: data.country.trim(),
        portOfDischarge: data.portOfDischarge?.trim() || null,
        paymentTerms: data.paymentTerms?.trim() || null,
        currency: data.currency || 'USD',
        contactEmail: data.contactEmail?.trim() || null,
        isActive: data.isActive ?? true,
      },
    });
    return mapConsignee(row);
  },

  async updateConsignee(
    id: string,
    updates: Partial<Omit<ConsigneeMaster, 'id' | 'createdAt' | 'updatedAt'>>,
    db: DbClient = getPrisma()
  ): Promise<ConsigneeMaster> {
    const row = await db.consigneeMaster.update({
      where: { id },
      data: {
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.country !== undefined ? { country: updates.country.trim() } : {}),
        ...(updates.portOfDischarge !== undefined ? { portOfDischarge: updates.portOfDischarge || null } : {}),
        ...(updates.paymentTerms !== undefined ? { paymentTerms: updates.paymentTerms || null } : {}),
        ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
        ...(updates.contactEmail !== undefined ? { contactEmail: updates.contactEmail || null } : {}),
        ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      },
    });
    return mapConsignee(row);
  },

  async countLinkedRecordsForConsignee(
    id: string,
    db: DbClient = getPrisma()
  ): Promise<{ shipments: number; gstEntries: number }> {
    const [shipments, gstEntries] = await Promise.all([
      db.shipment.count({ where: { consigneeId: id } }),
      db.gstEntry.count({ where: { consigneeId: id } }),
    ]);
    return { shipments, gstEntries };
  },

  async deleteConsignee(id: string, db: DbClient = getPrisma()): Promise<void> {
    await db.consigneeMaster.delete({ where: { id } });
  },

  // --- Banks ---
  async findAllBanks(db: DbClient = getPrisma()): Promise<BankMaster[]> {
    const rows = await db.bankMaster.findMany({ orderBy: { name: 'asc' } });
    return rows.map(mapBank);
  },

  async findBankById(id: string, db: DbClient = getPrisma()): Promise<BankMaster | null> {
    const row = await db.bankMaster.findUnique({ where: { id } });
    return row ? mapBank(row) : null;
  },

  async findBankByName(name: string, db: DbClient = getPrisma()): Promise<BankMaster | null> {
    const row = await db.bankMaster.findFirst({
      where: { name: { contains: name.trim(), mode: 'insensitive' } },
    });
    return row ? mapBank(row) : null;
  },

  async createBank(
    data: {
      id?: string;
      name: string;
      branch?: string;
      adCode?: string;
      ifscCode?: string;
      swiftCode?: string;
      accountNumber?: string;
      isActive?: boolean;
    },
    db: DbClient = getPrisma()
  ): Promise<BankMaster> {
    const row = await db.bankMaster.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        name: data.name.trim(),
        branch: data.branch?.trim() || null,
        adCode: data.adCode?.trim() || null,
        ifscCode: data.ifscCode?.trim() || null,
        swiftCode: data.swiftCode?.trim() || null,
        accountNumber: data.accountNumber?.trim() || null,
        isActive: data.isActive ?? true,
      },
    });
    return mapBank(row);
  },

  async updateBank(
    id: string,
    updates: Partial<Omit<BankMaster, 'id' | 'createdAt' | 'updatedAt'>>,
    db: DbClient = getPrisma()
  ): Promise<BankMaster> {
    const row = await db.bankMaster.update({
      where: { id },
      data: {
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.branch !== undefined ? { branch: updates.branch || null } : {}),
        ...(updates.adCode !== undefined ? { adCode: updates.adCode || null } : {}),
        ...(updates.ifscCode !== undefined ? { ifscCode: updates.ifscCode || null } : {}),
        ...(updates.swiftCode !== undefined ? { swiftCode: updates.swiftCode || null } : {}),
        ...(updates.accountNumber !== undefined ? { accountNumber: updates.accountNumber || null } : {}),
        ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      },
    });
    return mapBank(row);
  },

  async countPaymentsForBank(id: string, db: DbClient = getPrisma()): Promise<number> {
    return db.payment.count({ where: { bankId: id } });
  },

  async deleteBank(id: string, db: DbClient = getPrisma()): Promise<void> {
    await db.bankMaster.delete({ where: { id } });
  },
};
