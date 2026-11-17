-- Reconcile schema drift: User tokenValidAfter, Shipment archival fields, OcrJob approval fields, and GstEntry table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenValidAfter" TIMESTAMP(3);

ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;
CREATE INDEX IF NOT EXISTS "Shipment_isArchived_idx" ON "Shipment"("isArchived");

ALTER TABLE "OcrJob" ADD COLUMN IF NOT EXISTS "targetPaymentId" TEXT;
ALTER TABLE "OcrJob" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;
ALTER TABLE "OcrJob" ADD COLUMN IF NOT EXISTS "approvedByName" TEXT;

DO $$ BEGIN
  CREATE TYPE "GstResult" AS ENUM ('GAIN', 'LOSS', 'NIL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "GstEntry" (
    "id" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "consigneeId" TEXT NOT NULL,
    "consigneeName" TEXT NOT NULL,
    "igst" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "cgst" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "sgst" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "totalGst" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "refundEligible" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "difference" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "result" "GstResult" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GstEntry_consigneeId_idx" ON "GstEntry"("consigneeId");
CREATE INDEX IF NOT EXISTS "GstEntry_entryDate_idx" ON "GstEntry"("entryDate");
CREATE INDEX IF NOT EXISTS "GstEntry_result_idx" ON "GstEntry"("result");

DO $$ BEGIN
  ALTER TABLE "GstEntry" ADD CONSTRAINT "GstEntry_consigneeId_fkey"
    FOREIGN KEY ("consigneeId") REFERENCES "ConsigneeMaster"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
