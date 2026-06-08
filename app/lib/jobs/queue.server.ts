import prisma from "../../db.server";
import { JOB_MAX_ATTEMPTS, JOB_QUEUE, type JobQueueName } from "./types";

const BACKOFF_MS = [5_000, 15_000, 60_000] as const;

export async function enqueueBackgroundJob(
  queue: JobQueueName,
  payload: Record<string, string>,
  options?: { storeId?: string },
) {
  await prisma.backgroundJob.create({
    data: {
      queue,
      payload,
      storeId: options?.storeId,
      maxAttempts: JOB_MAX_ATTEMPTS[queue],
      status: "PENDING",
    },
  });
}

export async function enqueueAudit(auditId: string, storeId?: string) {
  await enqueueBackgroundJob(
    JOB_QUEUE.AUDIT,
    { auditId },
    storeId ? { storeId } : undefined,
  );
}

export async function enqueueLinkScan(scanId: string, storeId?: string) {
  await enqueueBackgroundJob(
    JOB_QUEUE.LINK_SCAN,
    { scanId },
    storeId ? { storeId } : undefined,
  );
}

export async function enqueuePageSpeedScan(scanId: string, storeId?: string) {
  await enqueueBackgroundJob(
    JOB_QUEUE.PAGESPEED,
    { scanId },
    storeId ? { storeId } : undefined,
  );
}

export function retryDelayMs(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 60_000;
}
