-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "webFormId" TEXT;

-- CreateTable
CREATE TABLE "WebForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headline" TEXT,
    "intro" TEXT,
    "thankYou" TEXT,
    "source" TEXT NOT NULL DEFAULT 'Web – formulář',
    "campaign" TEXT,
    "ownerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebForm_tenantId_idx" ON "WebForm"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpRule_tenantId_key_key" ON "FollowUpRule"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_webFormId_fkey" FOREIGN KEY ("webFormId") REFERENCES "WebForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpRule" ADD CONSTRAINT "FollowUpRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

