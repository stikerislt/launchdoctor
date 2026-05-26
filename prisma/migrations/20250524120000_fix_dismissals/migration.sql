-- CreateTable
CREATE TABLE "FixDismissal" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fixId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixDismissal_storeId_idx" ON "FixDismissal"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "FixDismissal_storeId_fixId_key" ON "FixDismissal"("storeId", "fixId");

-- AddForeignKey
ALTER TABLE "FixDismissal" ADD CONSTRAINT "FixDismissal_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
