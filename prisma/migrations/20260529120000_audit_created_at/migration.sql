-- Add a creation timestamp so PENDING audits (never picked up by the worker)
-- can be aged out and surfaced as failures instead of spinning forever.
ALTER TABLE "Audit" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Speed up the dashboard "is an audit currently running?" lookup and the stale sweep.
CREATE INDEX "Audit_storeId_status_idx" ON "Audit"("storeId", "status");
