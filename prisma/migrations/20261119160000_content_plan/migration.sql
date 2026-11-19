-- AlterTable
ALTER TABLE "MarketingPost" ADD COLUMN     "brief" TEXT,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "hook" TEXT,
ADD COLUMN     "materials" TEXT,
ADD COLUMN     "planKey" TEXT,
ADD COLUMN     "storyPlan" TEXT,
ADD COLUMN     "template" TEXT,
ADD COLUMN     "variant" TEXT;

-- CreateTable
CREATE TABLE "MarketingWeek" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "theme" TEXT,
    "reach" INTEGER,
    "saves" INTEGER,
    "shares" INTEGER,
    "newFollowers" INTEGER,
    "bioClicks" INTEGER,
    "newTeams" INTEGER,
    "bestPost" TEXT,
    "nextChange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingWeek_campaignId_week_key" ON "MarketingWeek"("campaignId", "week");

-- CreateIndex
CREATE INDEX "MarketingPost_tenantId_planKey_idx" ON "MarketingPost"("tenantId", "planKey");

-- AddForeignKey
ALTER TABLE "MarketingWeek" ADD CONSTRAINT "MarketingWeek_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

