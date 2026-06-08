import type { BackgroundJob } from "@prisma/client";
import prisma from "../../db.server";

const STALE_RUNNING_MS = 45 * 60 * 1000;

/** Re-queue jobs a worker claimed but never finished (crash, deploy, OOM). */
export async function releaseStaleBackgroundJobs() {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
  await prisma.backgroundJob.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: staleBefore },
    },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      errorMessage: "Job timed out while running.",
    },
  });
}

/**
 * Atomically claim the next due job (Postgres SKIP LOCKED).
 * One round-trip per idle poll — vs BullMQ's constant Redis chatter.
 */
export async function claimNextBackgroundJob(): Promise<BackgroundJob | null> {
  await releaseStaleBackgroundJobs();

  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "BackgroundJob"
    SET
      status = 'RUNNING'::"BackgroundJobStatus",
      "startedAt" = NOW(),
      "attempts" = "attempts" + 1
    WHERE id = (
      SELECT id
      FROM "BackgroundJob"
      WHERE status = 'PENDING'::"BackgroundJobStatus"
        AND "runAfter" <= NOW()
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;

  if (!claimed.length) return null;

  return prisma.backgroundJob.findUnique({
    where: { id: claimed[0]!.id },
  });
}
