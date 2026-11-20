-- CreateTable
CREATE TABLE "AppSyncRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "users" INTEGER,
    "created" INTEGER,
    "updated" INTEGER,
    "error" TEXT,

    CONSTRAINT "AppSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppMetricSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppSyncRun_tenantId_startedAt_idx" ON "AppSyncRun"("tenantId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppMetricSnapshot_tenantId_date_key" ON "AppMetricSnapshot"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "AppSyncRun" ADD CONSTRAINT "AppSyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppMetricSnapshot" ADD CONSTRAINT "AppMetricSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

