-- AlterTable
ALTER TABLE "PartnershipTerm" ADD COLUMN     "bonusMetric" TEXT,
ADD COLUMN     "bonusTiers" JSONB,
ADD COLUMN     "rewardAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PartnershipFulfillment" ADD COLUMN     "metricValue" INTEGER,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "rewardAmount" DOUBLE PRECISION;

