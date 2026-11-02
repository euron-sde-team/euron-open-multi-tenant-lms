import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const EMAIL_SENDING_DOMAIN_VERIFICATION_QUEUE_NAME =
  "email-sending-domain-verification";

export const emailSendingDomainVerificationQueue = new Queue(
  EMAIL_SENDING_DOMAIN_VERIFICATION_QUEUE_NAME,
  {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  },
);

export interface PollPendingSendingDomainsJob {
  triggeredBy: "schedule" | "on-demand";
}

/**
 * Register the repeatable SES sending-domain verification poll job.
 *
 * This is DISTINCT from `domain-verification.queue.ts` which polls Cloudflare
 * for storefront subdomain verification. This queue polls SES for sending
 * identity DKIM + MAIL FROM verification.
 *
 * Cadence: every 60 seconds. Safe to call from every cluster worker: BullMQ
 * deduplicates repeatables by scheduler key.
 */
export async function registerEmailSendingDomainVerificationJob(): Promise<void> {
  await emailSendingDomainVerificationQueue.upsertJobScheduler(
    "email-sending-domain-verification-scheduler",
    { every: 60 * 1000 },
    {
      name: "poll-pending-domains",
      data: {
        triggeredBy: "schedule",
      } satisfies PollPendingSendingDomainsJob,
    },
  );
}
