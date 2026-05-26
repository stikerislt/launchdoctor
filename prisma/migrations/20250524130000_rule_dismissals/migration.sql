-- CreateTable
CREATE TABLE "RuleDismissal" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RuleDismissal_storeId_idx" ON "RuleDismissal"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleDismissal_storeId_ruleCode_key" ON "RuleDismissal"("storeId", "ruleCode");

-- AddForeignKey
ALTER TABLE "RuleDismissal" ADD CONSTRAINT "RuleDismissal_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
