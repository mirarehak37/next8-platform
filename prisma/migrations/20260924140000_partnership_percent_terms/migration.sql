-- AlterTable
ALTER TABLE "PartnershipTerm" ADD COLUMN     "percent" DOUBLE PRECISION,
ADD COLUMN     "percentBase" TEXT,
ADD COLUMN     "valueType" TEXT NOT NULL DEFAULT 'fixed';

-- AlterTable
ALTER TABLE "PartnershipFulfillment" ADD COLUMN     "baseAmount" DOUBLE PRECISION;

