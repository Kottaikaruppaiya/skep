/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { isValidGstin } from '../../shared/utils/gstin.ts';

const gstinSchema = z
  .string()
  .trim()
  .refine((val) => isValidGstin(val), 'Valid 15-character GSTIN (e.g. 33AABCU9603R1ZM) is required.');

export const createB2bInvoiceSchema = z
  .object({
    supplierGstin: gstinSchema,
    supplierName: z.string().trim().optional(),
    invoiceNumber: z.string().trim().min(1, 'Invoice Number is required.'),
    invoiceType: z.string().trim().default('Regular'),
    invoiceDate: z.string().trim().min(1, 'Invoice Date is required.'),
    invoiceValue: z.coerce.number().min(0, 'Invoice Value cannot be negative.').optional(),
    placeOfSupply: z.string().optional(),
    reverseCharge: z.string().optional(),
    taxableValue: z.coerce.number().min(0, 'Taxable Value cannot be negative.').default(0),
    integratedTax: z.coerce.number().min(0, 'IGST cannot be negative.').default(0),
    centralTax: z.coerce.number().min(0, 'CGST cannot be negative.').default(0),
    stateUtTax: z.coerce.number().min(0, 'SGST cannot be negative.').default(0),
    cess: z.coerce.number().min(0, 'Cess cannot be negative.').default(0),
    gstrPeriod: z.string().trim().min(1, 'GSTR Period is required.'),
    filingDate: z.string().optional(),
    itcAvailability: z.string().optional(),
    reason: z.string().optional(),
    applicableTaxRate: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
    source: z.union([z.string(), z.null()]).optional(),
    irn: z.string().optional(),
    irnDate: z.string().optional(),
  })
  .passthrough();

export const updateB2bInvoiceSchema = createB2bInvoiceSchema.partial();

export const createSupplierSchema = z.object({
  gstin: gstinSchema,
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
