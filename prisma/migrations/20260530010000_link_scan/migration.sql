-- Broken Link Finder (Audit Plus, Phase 1: read-only crawl + report).
CREATE TYPE "LinkScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "LinkScan" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "LinkScanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pagesScanned" INTEGER NOT NULL DEFAULT 0,
    "linksChecked" INTEGER NOT NULL DEFAULT 0,
    "brokenCount" INTEGER NOT NULL DEFAULT 0,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    CONSTRAINT "LinkScan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkIssue" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "sourceAdminUrl" TEXT,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "statusCode" INTEGER,
    "redirectChain" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    CONSTRAINT "LinkIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LinkScan_storeId_status_idx" ON "LinkScan"("storeId", "status");
CREATE INDEX "LinkScan_storeId_completedAt_idx" ON "LinkScan"("storeId", "completedAt");
CREATE INDEX "LinkIssue_scanId_idx" ON "LinkIssue"("scanId");

ALTER TABLE "LinkScan" ADD CONSTRAINT "LinkScan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LinkIssue" ADD CONSTRAINT "LinkIssue_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "LinkScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
