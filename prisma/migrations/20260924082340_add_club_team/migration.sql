-- CreateTable
CREATE TABLE "ClubTeam" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "league" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubTeamContact" (
    "id" TEXT NOT NULL,
    "clubTeamId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClubTeamContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubTeam_tenantId_companyId_idx" ON "ClubTeam"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "ClubTeam_tenantId_category_idx" ON "ClubTeam"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ClubTeamContact_clubTeamId_contactId_key" ON "ClubTeamContact"("clubTeamId", "contactId");

-- AddForeignKey
ALTER TABLE "ClubTeam" ADD CONSTRAINT "ClubTeam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTeam" ADD CONSTRAINT "ClubTeam_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTeamContact" ADD CONSTRAINT "ClubTeamContact_clubTeamId_fkey" FOREIGN KEY ("clubTeamId") REFERENCES "ClubTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTeamContact" ADD CONSTRAINT "ClubTeamContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
