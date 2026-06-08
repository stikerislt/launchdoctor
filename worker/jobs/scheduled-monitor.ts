import prisma from "../../app/lib/prisma.server";
import { hasAuditPlus } from "../../app/lib/billing.server";
import { enqueueAudit } from "../../app/lib/queue.server";
import pino from "pino";

const logger = pino({ name: "scheduled-monitor" });

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Spread enqueues so we don't hand the audit worker a thundering herd.
const STAGGER_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Weekly Store Monitor sweep. For every installed Audit Plus store whose last
 * completed audit is older than a week (and which has nothing already running),
 * enqueue a fresh audit tagged SCHEDULED_WEEKLY. This is what makes the monitor
 * feel like an always-on service rather than a manual tool.
 */
export async function sweepScheduledMonitors(): Promise<void> {
  const cutoff = new Date(Date.now() - WEEK_MS);
  const stores = await prisma.store.findMany({
    where: { uninstalledAt: null },
    select: { id: true, shopDomain: true },
  });

  let enqueued = 0;
  for (const store of stores) {
    try {
      if (!(await hasAuditPlus(store.id))) continue;

      const recent = await prisma.audit.findFirst({
        where: { storeId: store.id, status: "COMPLETED", completedAt: { gt: cutoff } },
        select: { id: true },
      });
      if (recent) continue;

      const inFlight = await prisma.audit.findFirst({
        where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
        select: { id: true },
      });
      if (inFlight) continue;

      const audit = await prisma.audit.create({
        data: { storeId: store.id, status: "PENDING", triggeredBy: "SCHEDULED_WEEKLY" },
      });
      await enqueueAudit(audit.id, store.id);
      enqueued += 1;
      logger.info({ shop: store.shopDomain, auditId: audit.id }, "Scheduled weekly audit queued");

      await sleep(STAGGER_MS);
    } catch (err) {
      logger.error(
        { shop: store.shopDomain, err: err instanceof Error ? err.message : String(err) },
        "Scheduled monitor failed for store",
      );
    }
  }

  logger.info({ stores: stores.length, enqueued }, "Scheduled monitor sweep complete");
}
