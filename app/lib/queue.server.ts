import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const auditQueue = new Queue("run-audit", { connection });

export async function enqueueAudit(auditId: string) {
  await auditQueue.add(
    "run-audit",
    { auditId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );
}

export { connection as redisConnection };
