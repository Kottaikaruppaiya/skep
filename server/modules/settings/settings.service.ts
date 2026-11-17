/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppSettings } from '../../../src/types/index.ts';
import { withTransaction } from '../../config/prisma.ts';
import { fileStorageService } from '../documents/file-storage.service.ts';
import { seedService } from './seed.service.ts';
import { settingsRepository } from './settings.repository.ts';

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    return settingsRepository.getSettings();
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    return withTransaction((tx) => settingsRepository.upsertSettings(updates, tx));
  },

  async clearAllOperationalData(): Promise<{ success: boolean; cleared: Record<string, number> }> {
    const { cleared, paths } = await withTransaction(async (tx) => {
      const docPaths = await settingsRepository.findAllStoredDocumentPaths(tx);
      const summary = await settingsRepository.clearOperationalData(tx);
      return { cleared: summary, paths: docPaths };
    });

    for (const storedPath of paths) {
      fileStorageService.deletePrivateFile(storedPath);
    }

    return { success: true, cleared };
  },

  async reseedDefaults(): Promise<{ success: boolean; count: number }> {
    return seedService.reseedWithDefaults();
  },
};
