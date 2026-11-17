/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const createB2bInvoiceSchema = z
  .object({
    supplierGstin: z.string().trim().length(15, 'Valid 15-character Supplier GSTIN is required.'),
    supplierName: z.string().trim().optional(),
    invoiceNumber: z.string().trim().min(1, 'Invoice Number is required.'),
    invoiceType: z.string().trim().default('Regular'),
    invoiceDate: z.string().trim().min(1, 'Invoice Date is required.'),
    invoiceValue: z.coerce.number().optional(),
    placeOfSupply: z.string().optional(),
    reverseCharge: z.string().optional(),
    taxableValue: z.coerce.number().default(0),
    integratedTax: z.coerce.number().default(0),
    centralTax: z.coerce.number().default(0),
    stateUtTax: z.coerce.number().default(0),
    cess: z.coerce.number().default(0),
    gstrPeriod: z.string().trim().min(1, 'GSTR Period is required.'),
    filingDate: z.string().optional(),
    itcAvailability: z.string().optional(),
    reason: z.string().optional(),
    applicableTaxRate: z.coerce.number().optional(),
    source: z.string().optional(),
    irn: z.string().optional(),
    irnDate: z.string().optional(),
  })
  .passthrough();

export const updateB2bInvoiceSchema = createB2bInvoiceSchema.partial();

export const createSupplierSchema = z.object({
  gstin: z.string().trim().length(15, 'Valid 15-character GSTIN is required.'),
  legalName: z.string().trim().min(1, 'Supplier legal name is required.'),
  tradeName: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const commitB2bImportSchema = z.object({
  previewData: z.object({
    allParsedRecords: z.array(z.record(z.string(), z.unknown())).optional(),
    sampleRows: z.array(z.record(z.string(), z.unknown())).optional(),
    errors: z.array(z.unknown()).optional(),
    duplicates: z.array(z.unknown()).optional(),
  }).passthrough(),
  mode: z.enum(['SKIP_EXISTING', 'OVERWRITE_EXISTING', 'INSERT_ALL']).default('SKIP_EXISTING'),
  fileName: z.string().optional(),
  fileSizeBytes: z.coerce.number().optional(),
});
