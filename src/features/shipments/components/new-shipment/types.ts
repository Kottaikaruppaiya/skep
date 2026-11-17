/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BrcMode = 'SINGLE' | 'MULTIPLE';

export interface SelectedFileItem {
  file: File;
  name: string;
  size: string;
}

export interface ExtractionResultSummary {
  fieldsExtracted: number;
  missingFields: string[];
  docCount: number;
  summaryText?: string;
}
