-- AI Chat: per-store per-audit conversation history and daily usage tracking.

CREATE TABLE "AIChatMessage" (
    "id"        TEXT NOT NULL,
    "storeId"   TEXT NOT NULL,
    "auditId"   TEXT NOT NULL,
    "role"      TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIChatMessage_storeId_auditId_createdAt_idx" ON "AIChatMessage"("storeId", "auditId", "createdAt");
CREATE INDEX "AIChatMessage_storeId_createdAt_idx" ON "AIChatMessage"("storeId", "createdAt");

CREATE TABLE "AIChatUsage" (
    "id"      TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date"    TIMESTAMP(3) NOT NULL,
    "count"   INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AIChatUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIChatUsage_storeId_date_key" ON "AIChatUsage"("storeId", "date");
CREATE INDEX "AIChatUsage_storeId_idx" ON "AIChatUsage"("storeId");

ALTER TABLE "AIChatMessage" ADD CONSTRAINT "AIChatMessage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIChatMessage" ADD CONSTRAINT "AIChatMessage_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIChatUsage" ADD CONSTRAINT "AIChatUsage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
