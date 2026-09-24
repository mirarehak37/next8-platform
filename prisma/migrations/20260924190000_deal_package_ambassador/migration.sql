-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "ambassadorId" TEXT,
ADD COLUMN     "billingPeriod" TEXT,
ADD COLUMN     "clubTeamId" TEXT,
ADD COLUMN     "commissionTermId" TEXT,
ADD COLUMN     "customPackage" TEXT,
ADD COLUMN     "discountPercent" DOUBLE PRECISION,
ADD COLUMN     "listPrice" DOUBLE PRECISION,
ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "PartnershipFulfillment" ADD COLUMN     "dealId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PartnershipFulfillment_dealId_key" ON "PartnershipFulfillment"("dealId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_clubTeamId_fkey" FOREIGN KEY ("clubTeamId") REFERENCES "ClubTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_commissionTermId_fkey" FOREIGN KEY ("commissionTermId") REFERENCES "PartnershipTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

