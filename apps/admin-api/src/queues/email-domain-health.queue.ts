import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const EMAIL_DOMAIN_HEALTH_QUEUE_NAME = "email-domain-health";

export const emailDomainHealthQueue = new Queue(
  EMAIL_DOMAIN_HEALTH_QUEUE_NAME,
  {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 100 },
    },
  },
);

export interface SweepDomainHealthJob {
  triggeredBy: "schedule" | "on-demand";
}

/**
 * Register the daily 03:00 UTC sweep. Cron pattern lets the schedule survive
 * DST shifts (no naive 24h offset) and runs at a low-traffic hour so the SES
 * + DNS calls don't compete with peak campaign sends.
 *
 * Idempotent across cluster workers via BullMQ scheduler dedup.
 */
export async function registerEmailDomainHealthJob(): Promise<void> {
  await emailDomainHealthQueue.upsertJobScheduler(
    "email-domain-health-scheduler",
    { pattern: "0 3 * * *", tz: "UTC" },
    {
      name: "sweep-domain-health",
      data: { triggeredBy: "schedule" } satisfies SweepDomainHealthJob,
    },
  );
}
