import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runAudit } from "./jobs/run-audit";
import pino from "pino";

const logger = pino({ name: "worker" });

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "run-audit",
  async (job) => {
    const { auditId } = job.data as { auditId: string };
    logger.info({ auditId, jobId: job.id }, "Processing audit job");
    await runAudit(auditId);
  },
  { connection, concurrency: 2 },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Job failed");
});

logger.info("Worker started, listening on run-audit queue");
