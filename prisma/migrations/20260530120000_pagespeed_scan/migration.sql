-- PageSpeed Insights tool (Audit Plus): dedicated mobile performance scans.

CREATE TABLE "PageSpeedScan" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "LinkScanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "measuredUrl" TEXT,
    "score" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "PageSpeedScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageSpeedScan_storeId_status_idx" ON "PageSpeedScan"("storeId", "status");
CREATE INDEX "PageSpeedScan_storeId_completedAt_idx" ON "PageSpeedScan"("storeId", "completedAt");

ALTER TABLE "PageSpeedScan" ADD CONSTRAINT "PageSpeedScan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
