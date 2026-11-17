-- CreateEnum
CREATE TYPE "GstResult" AS ENUM ('GAIN', 'LOSS', 'NIL');

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "AuditLog";

-- CreateTable
CREATE TABLE "GstEntry" (
    "id" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "consigneeId" TEXT NOT NULL,
    "consigneeName" TEXT NOT NULL,
    "igst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalGst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundEligible" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "result" "GstResult" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GstEntry_consigneeId_idx" ON "GstEntry"("consigneeId");
CREATE INDEX "GstEntry_entryDate_idx" ON "GstEntry"("entryDate");
CREATE INDEX "GstEntry_result_idx" ON "GstEntry"("result");

-- AddForeignKey
ALTER TABLE "GstEntry" ADD CONSTRAINT "GstEntry_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "ConsigneeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
