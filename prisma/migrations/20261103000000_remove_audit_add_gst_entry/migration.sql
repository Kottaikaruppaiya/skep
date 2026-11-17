-- Migration: Remove Audit History & Add GST Entry
-- 1. Permanently delete Audit History table and references
DROP TABLE IF EXISTS "AuditLog" CASCADE;

-- 2. Create GstResult Enum
DO $$ BEGIN
  CREATE TYPE "GstResult" AS ENUM ('GAIN', 'LOSS', 'NIL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create GstEntry Table with strict Decimal precision and foreign key to ConsigneeMaster
CREATE TABLE IF NOT EXISTS "GstEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "consigneeId" TEXT NOT NULL,
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

-- 4. Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "GstEntry_entryNumber_key" ON "GstEntry"("entryNumber");
CREATE INDEX IF NOT EXISTS "GstEntry_consigneeId_idx" ON "GstEntry"("consigneeId");
CREATE INDEX IF NOT EXISTS "GstEntry_entryDate_idx" ON "GstEntry"("entryDate");
CREATE INDEX IF NOT EXISTS "GstEntry_result_idx" ON "GstEntry"("result");

-- 5. Foreign Key Constraint ensuring ConsigneeMaster protection
DO $$ BEGIN
  ALTER TABLE "GstEntry" ADD CONSTRAINT "GstEntry_consigneeId_fkey"
    FOREIGN KEY ("consigneeId") REFERENCES "ConsigneeMaster"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
