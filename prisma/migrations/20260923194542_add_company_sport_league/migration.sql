-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "league" TEXT,
ADD COLUMN     "sport" TEXT;

-- CreateIndex
CREATE INDEX "Company_tenantId_sport_idx" ON "Company"("tenantId", "sport");

-- CreateIndex
CREATE INDEX "Company_tenantId_league_idx" ON "Company"("tenantId", "league");
