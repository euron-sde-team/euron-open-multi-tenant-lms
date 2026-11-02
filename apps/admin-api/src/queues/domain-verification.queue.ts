import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const DOMAIN_QUEUE_NAME = "domain-verification";

export const domainVerificationQueue = new Queue(DOMAIN_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export interface PollPendingDomainsJob {
  triggeredBy: "schedule";
}

/**
 * Register the repeatable domain verification polling job (every 2 minutes).
 * Safe to call from every worker: BullMQ deduplicates repeatables by key.
 */
export async function registerDomainVerificationJob(): Promise<void> {
  await domainVerificationQueue.upsertJobScheduler(
    "domain-verification-scheduler",
    { every: 2 * 60 * 1000 },
    {
      name: "poll-pending-domains",
      data: { triggeredBy: "schedule" } satisfies PollPendingDomainsJob,
    }
  );
}
