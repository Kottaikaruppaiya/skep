-- Drop previous GstEntry if present
ALTER TABLE IF EXISTS "GstEntry" DROP CONSTRAINT IF EXISTS "GstEntry_consigneeId_fkey";
DROP TABLE IF EXISTS "GstEntry";
DROP TYPE IF EXISTS "GstResult";

-- CreateTable Supplier
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "address" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_gstin_key" ON "Supplier"("gstin");
CREATE INDEX "Supplier_gstin_idx" ON "Supplier"("gstin");

-- CreateTable ImportBatch
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" BIGINT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "importStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
    "gstrPeriodSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable B2bInvoice
CREATE TABLE "B2bInvoice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierGstin" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL DEFAULT 'Regular',
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "invoiceValue" DECIMAL(14,2) NOT NULL,
    "placeOfSupply" TEXT,
    "reverseCharge" TEXT NOT NULL DEFAULT 'N',
    "taxableValue" DECIMAL(14,2) NOT NULL,
    "integratedTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "centralTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stateUtTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cess" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalGst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gstrPeriod" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "filingDate" TIMESTAMP(3),
    "itcAvailability" TEXT NOT NULL DEFAULT 'Yes',
    "reason" TEXT,
    "applicableTaxRate" DECIMAL(5,2),
    "source" TEXT DEFAULT 'GSTR-1',
    "irn" TEXT,
    "irnDate" TIMESTAMP(3),
    "importBatchId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes for B2bInvoice
CREATE UNIQUE INDEX "B2bInvoice_supplierGstin_invoiceNumber_invoiceType_key" ON "B2bInvoice"("supplierGstin", "invoiceNumber", "invoiceType");
CREATE INDEX "B2bInvoice_periodKey_idx" ON "B2bInvoice"("periodKey");
CREATE INDEX "B2bInvoice_financialYear_idx" ON "B2bInvoice"("financialYear");
CREATE INDEX "B2bInvoice_supplierGstin_idx" ON "B2bInvoice"("supplierGstin");
CREATE INDEX "B2bInvoice_invoiceDate_idx" ON "B2bInvoice"("invoiceDate");
CREATE INDEX "B2bInvoice_importBatchId_idx" ON "B2bInvoice"("importBatchId");

-- AddForeignKeys
ALTER TABLE "B2bInvoice" ADD CONSTRAINT "B2bInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "B2bInvoice" ADD CONSTRAINT "B2bInvoice_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
