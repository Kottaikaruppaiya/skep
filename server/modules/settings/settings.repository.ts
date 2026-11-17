/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppSettings } from '../../../src/types/index.ts';
import { getPrisma, type DbClient } from '../../config/prisma.ts';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  statutoryBrcDays: 270,
  defaultPortCode: 'INNSA1',
  baseCurrency: 'USD',
  allowOverAllocation: false,
  companyName: 'S K Enterprises',
  iecNumber: '0308019921',
  panNumber: 'AAECS9812K',
};

export const settingsRepository = {
  async getSettings(db: DbClient = getPrisma()): Promise<AppSettings> {
    const rows = await db.appSetting.findMany();
    if (rows.length === 0) return { ...DEFAULT_APP_SETTINGS };

    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      statutoryBrcDays: Number(map.get('statutoryBrcDays') ?? DEFAULT_APP_SETTINGS.statutoryBrcDays),
      defaultPortCode: map.get('defaultPortCode') || DEFAULT_APP_SETTINGS.defaultPortCode,
      baseCurrency: map.get('baseCurrency') || DEFAULT_APP_SETTINGS.baseCurrency,
      allowOverAllocation: map.get('allowOverAllocation') === 'true',
      companyName: map.get('companyName') || DEFAULT_APP_SETTINGS.companyName,
      iecNumber: map.get('iecNumber') || DEFAULT_APP_SETTINGS.iecNumber,
      panNumber: map.get('panNumber') || DEFAULT_APP_SETTINGS.panNumber,
    };
  },

  async upsertSettings(updates: Partial<AppSettings>, db: DbClient = getPrisma()): Promise<AppSettings> {
    const entries: Array<[string, string]> = [];
    if (updates.statutoryBrcDays !== undefined) entries.push(['statutoryBrcDays', String(updates.statutoryBrcDays)]);
    if (updates.defaultPortCode !== undefined) entries.push(['defaultPortCode', String(updates.defaultPortCode)]);
    if (updates.baseCurrency !== undefined) entries.push(['baseCurrency', String(updates.baseCurrency)]);
    if (updates.allowOverAllocation !== undefined) entries.push(['allowOverAllocation', String(Boolean(updates.allowOverAllocation))]);
    if (updates.companyName !== undefined) entries.push(['companyName', String(updates.companyName)]);
    if (updates.iecNumber !== undefined) entries.push(['iecNumber', String(updates.iecNumber)]);
    if (updates.panNumber !== undefined) entries.push(['panNumber', String(updates.panNumber)]);

    for (const [key, value] of entries) {
      await db.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return this.getSettings(db);
  },

  async findAllStoredDocumentPaths(db: DbClient = getPrisma()): Promise<string[]> {
    const rows = await db.document.findMany({ select: { storedPath: true } });
    return rows.map((r) => r.storedPath);
  },

  async clearOperationalData(db: DbClient = getPrisma()): Promise<Record<string, number>> {
    const [
      allocationsCount,
      itemsCount,
      docsCount,
      incentivesCount,
      brcsCount,
      paymentsCount,
      shipmentsCount,
    ] = await Promise.all([
      db.paymentAllocation.count(),
      db.invoiceItem.count(),
      db.document.count(),
      db.incentiveRecord.count(),
      db.brcRecord.count(),
      db.payment.count(),
      db.shipment.count(),
    ]);

    await db.paymentAllocation.deleteMany();
    await db.invoiceItem.deleteMany();
    await db.document.deleteMany();
    await db.incentiveRecord.deleteMany();
    await db.brcRecord.deleteMany();
    await db.payment.deleteMany();
    await db.shipment.deleteMany();

    return {
      shipments: shipmentsCount,
      invoiceItems: itemsCount,
      documents: docsCount,
      payments: paymentsCount,
      allocations: allocationsCount,
      incentives: incentivesCount,
      brcRecords: brcsCount,
    };
  },
};
