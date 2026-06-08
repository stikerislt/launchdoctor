import type { BackgroundJob } from "@prisma/client";
import prisma from "../../db.server";
import { runAudit } from "../../../worker/jobs/run-audit";
import { runLinkScanJob } from "../../../worker/jobs/run-link-scan";
import { runPageSpeedScanJob } from "../../../worker/jobs/run-pagespeed-scan";
import { JOB_QUEUE } from "./types";
import { retryDelayMs } from "./queue.server";

function payloadString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Invalid job payload (missing ${key})`);
  }
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid job payload (missing ${key})`);
  }
  return value;
}

export async function processBackgroundJob(job: BackgroundJob): Promise<void> {
  try {
    switch (job.queue) {
      case JOB_QUEUE.AUDIT:
        await runAudit(payloadString(job.payload, "auditId"));
        break;
      case JOB_QUEUE.LINK_SCAN:
        await runLinkScanJob(payloadString(job.payload, "scanId"));
        break;
      case JOB_QUEUE.PAGESPEED:
        await runPageSpeedScanJob(payloadString(job.payload, "scanId"));
        break;
      default:
        throw new Error(`Unknown job queue: ${job.queue}`);
    }

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const canRetry = job.attempts < job.maxAttempts;

    if (canRetry) {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          startedAt: null,
          runAfter: new Date(Date.now() + retryDelayMs(job.attempts)),
          errorMessage: message,
        },
      });
    } else {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: message,
        },
      });
    }

    throw err;
  }
}
