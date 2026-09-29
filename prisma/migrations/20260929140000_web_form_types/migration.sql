-- AlterTable
ALTER TABLE "WebForm" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "lastSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "submissions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'demo';

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

