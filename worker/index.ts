import { claimNextBackgroundJob } from "../app/lib/jobs/claim.server";
import { processBackgroundJob } from "../app/lib/jobs/process.server";
import { sweepScheduledMonitors } from "./jobs/scheduled-monitor";
import pino from "pino";

const logger = pino({ name: "worker" });

/** How long the worker sleeps when no jobs are due (Postgres poll interval). */
const IDLE_POLL_MS = Number(process.env.WORKER_IDLE_POLL_MS ?? 10_000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorkerLoop() {
  logger.info({ idlePollMs: IDLE_POLL_MS }, "Background job worker started (Postgres queue)");

  while (true) {
    try {
      const job = await claimNextBackgroundJob();
      if (!job) {
        await sleep(IDLE_POLL_MS);
        continue;
      }

      logger.info({ jobId: job.id, queue: job.queue, attempt: job.attempts }, "Processing job");
      try {
        await processBackgroundJob(job);
        logger.info({ jobId: job.id, queue: job.queue }, "Job completed");
      } catch (err) {
        logger.error(
          {
            jobId: job.id,
            queue: job.queue,
            err: err instanceof Error ? err.message : String(err),
          },
          "Job failed",
        );
      }
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "Worker loop error",
      );
      await sleep(5000);
    }
  }
}

runWorkerLoop();

if (process.env.NODE_ENV === "production") {
  const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const runSweep = () => {
    sweepScheduledMonitors().catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "Scheduled monitor sweep crashed",
      );
    });
  };
  setTimeout(runSweep, 2 * 60 * 1000);
  setInterval(runSweep, SWEEP_INTERVAL_MS);
  logger.info("Scheduled monitor sweep enabled (production)");
}
