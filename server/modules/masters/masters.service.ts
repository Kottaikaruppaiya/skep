/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BankMaster, ConsigneeMaster, FinancialYear } from '../../../src/types/index.ts';
import type { DbClient } from '../../config/prisma.ts';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { mastersRepository } from './masters.repository.ts';

export const mastersService = {
  async listFinancialYears(): Promise<FinancialYear[]> {
    return mastersRepository.findAllFinancialYears();
  },

  async getCurrentFinancialYear(db?: DbClient): Promise<FinancialYear> {
    const current = await mastersRepository.findCurrentFinancialYear(db);
    if (!current) {
      throw new NotFoundError('No financial year configured in PostgreSQL.');
    }
    return current;
  },

  async getFinancialYearById(id: string, db?: DbClient): Promise<FinancialYear | null> {
    return mastersRepository.findFinancialYearById(id, db);
  },

  // --- Consignees ---
  async listConsignees(db?: DbClient): Promise<ConsigneeMaster[]> {
    return mastersRepository.findAllConsignees(db);
  },

  async createConsignee(
    data: {
      name: string;
      country: string;
      portOfDischarge?: string;
      paymentTerms?: string;
      currency?: string;
      contactEmail?: string;
      isActive?: boolean;
    },
    db?: DbClient
  ): Promise<ConsigneeMaster> {
    const existing = await mastersRepository.findConsigneeByName(data.name, db);
    if (existing) {
      throw new ConflictError(`Consignee '${data.name.trim()}' already exists.`);
    }
    return mastersRepository.createConsignee(data, db);
  },

  async resolveOrCreateConsignee(
    input: { consigneeId?: string; consigneeName?: string; portOfDischarge?: string },
    db?: DbClient
  ): Promise<ConsigneeMaster> {
    if (input.consigneeId && input.consigneeId.trim()) {
      const byId = await mastersRepository.findConsigneeById(input.consigneeId.trim(), db);
      if (!byId) {
        throw new NotFoundError(`Consignee '${input.consigneeId}' not found.`);
      }
      return byId;
    }

    if (input.consigneeName && input.consigneeName.trim()) {
      const cleanName = input.consigneeName.trim();
      const byName = await mastersRepository.findConsigneeByName(cleanName, db);
      if (byName) return byName;

      return mastersRepository.createConsignee(
        {
          name: cleanName,
          country: cleanName.toLowerCase().includes('lanka') ? 'Sri Lanka' : 'International',
          portOfDischarge: input.portOfDischarge || 'LKCMB - Colombo',
          paymentTerms: 'DA 90 DAYS',
          currency: 'USD',
          isActive: true,
        },
        db
      );
    }

    throw new ValidationError('A valid consigneeId or consigneeName is required.');
  },

  async updateConsignee(
    id: string,
    updates: Partial<Omit<ConsigneeMaster, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ConsigneeMaster> {
    const existing = await mastersRepository.findConsigneeById(id);
    if (!existing) throw new NotFoundError('Consignee not found.');

    if (updates.name && updates.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const dup = await mastersRepository.findConsigneeByName(updates.name);
      if (dup && dup.id !== id) {
        throw new ConflictError(`Consignee '${updates.name.trim()}' already exists.`);
      }
    }

    return mastersRepository.updateConsignee(id, updates);
  },

  async deleteConsignee(id: string): Promise<{ success: boolean }> {
    const existing = await mastersRepository.findConsigneeById(id);
    if (!existing) throw new NotFoundError('Consignee not found.');

    const links = await mastersRepository.countLinkedRecordsForConsignee(id);
    if (links.shipments > 0) {
      throw new ConflictError(
        `Cannot delete consignee "${existing.name}": ${links.shipments} shipment(s) are registered against this buyer. Deactivate it instead.`
      );
    }
    if (links.gstEntries > 0) {
      throw new ConflictError(
        `Cannot delete consignee "${existing.name}": ${links.gstEntries} GST ledger entries reference this buyer.`
      );
    }

    await mastersRepository.deleteConsignee(id);
    return { success: true };
  },

  // --- Banks ---
  async listBanks(db?: DbClient): Promise<BankMaster[]> {
    return mastersRepository.findAllBanks(db);
  },

  async resolveBankId(bankId?: string, bankName?: string, db?: DbClient): Promise<string> {
    if (bankId && bankId.trim()) {
      const found = await mastersRepository.findBankById(bankId.trim(), db);
      if (!found) {
        throw new NotFoundError(`Authorised Dealer Bank '${bankId}' not found.`);
      }
      return found.id;
    }
    if (bankName && bankName.trim()) {
      const found = await mastersRepository.findBankByName(bankName, db);
      if (!found) {
        throw new NotFoundError(`Authorised Dealer Bank '${bankName.trim()}' not found in Bank Master.`);
      }
      return found.id;
    }
    throw new ValidationError('A valid bankId or bankName is required.');
  },

  async createBank(
    data: {
      name: string;
      branch?: string;
      adCode?: string;
      ifscCode?: string;
      swiftCode?: string;
      accountNumber?: string;
      isActive?: boolean;
    },
    db?: DbClient
  ): Promise<BankMaster> {
    const all = await mastersRepository.findAllBanks(db);
    if (all.some((b) => b.name.toLowerCase() === data.name.trim().toLowerCase())) {
      throw new ConflictError(`Bank '${data.name.trim()}' already exists.`);
    }
    return mastersRepository.createBank(data, db);
  },

  async updateBank(
    id: string,
    updates: Partial<Omit<BankMaster, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<BankMaster> {
    const existing = await mastersRepository.findBankById(id);
    if (!existing) throw new NotFoundError('Bank not found.');
    return mastersRepository.updateBank(id, updates);
  },

  async deleteBank(id: string): Promise<{ success: boolean }> {
    const existing = await mastersRepository.findBankById(id);
    if (!existing) throw new NotFoundError('Bank not found.');

    const paymentCount = await mastersRepository.countPaymentsForBank(id);
    if (paymentCount > 0) {
      throw new ConflictError(
        `Cannot delete bank "${existing.name}": ${paymentCount} FIRC payment record(s) are linked to this bank. Deactivate it instead.`
      );
    }

    await mastersRepository.deleteBank(id);
    return { success: true };
  },
};
