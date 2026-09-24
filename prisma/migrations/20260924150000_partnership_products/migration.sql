-- AlterTable
ALTER TABLE "PartnershipTerm" ADD COLUMN     "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PartnershipFulfillment" ADD COLUMN     "productId" TEXT;

-- AddForeignKey
ALTER TABLE "PartnershipFulfillment" ADD CONSTRAINT "PartnershipFulfillment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

