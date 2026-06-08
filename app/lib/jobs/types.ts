export const JOB_QUEUE = {
  AUDIT: "run-audit",
  LINK_SCAN: "link-scan",
  PAGESPEED: "pagespeed-scan",
} as const;

export type JobQueueName = (typeof JOB_QUEUE)[keyof typeof JOB_QUEUE];

export const JOB_MAX_ATTEMPTS: Record<JobQueueName, number> = {
  [JOB_QUEUE.AUDIT]: 3,
  [JOB_QUEUE.LINK_SCAN]: 2,
  [JOB_QUEUE.PAGESPEED]: 2,
};

export type AuditJobPayload = { auditId: string };
export type ScanJobPayload = { scanId: string };
