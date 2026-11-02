import { Queue } from "bullmq";

import logger from "../utils/logger";

import { QUEUE_PREFIX, redisConnection } from "./connection";

/**
 * Cross-service producer for the end-user notification queue.
 *
 * The queue named "user-notification" is OWNED and CONSUMED by
 * learner-api (its notification worker). Both services share the
 * same Redis, so we can enqueue jobs here that the learner-api worker drains.
 * We only ever PRODUCE jobs onto this queue, never add a worker here.
 *
 * The learner-api worker turns an "enrollment-confirmation" job into a
 * tenant-branded email (sent from the tenant, same engine as OTP) plus an
 * in-app notification, idempotent per (member, item). It only sends the email
 * when the member has a real email address.
 */
export const USER_NOTIFICATION_QUEUE_NAME = "user-notification";

export const userNotificationQueue = new Queue(USER_NOTIFICATION_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 2000 },
  },
});

/** Item types the enrollment email understands (mapped to a human label). */
export type GrantItemType =
  | "COURSE"
  | "BOOK"
  | "BUNDLE"
  | "TEST_SERIES"
  | "BATCH";

export interface EnrollmentConfirmationJob {
  type: "enrollment-confirmation";
  tenantId: string;
  memberId: string;
  metadata: { itemName: string; itemType: GrantItemType; itemId: string };
}

/**
 * Enqueue a single enrollment-confirmation email. Best-effort: a queue failure
 * must never block or fail the grant it is notifying about.
 */
export async function queueEnrollmentConfirmation(
  job: EnrollmentConfirmationJob,
): Promise<void> {
  try {
    await userNotificationQueue.add(job.type, job);
  } catch (error) {
    logger.error(
      `Failed to enqueue enrollment-confirmation for member ${job.memberId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Enqueue many enrollment-confirmation emails at once (bulk grant). Uses
 * addBulk so a large grant does not make one Redis round-trip per learner.
 * Best-effort, never throws into the caller.
 */
export async function queueEnrollmentConfirmationsBulk(
  jobs: EnrollmentConfirmationJob[],
): Promise<void> {
  if (jobs.length === 0) return;
  try {
    await userNotificationQueue.addBulk(
      jobs.map((job) => ({ name: job.type, data: job })),
    );
  } catch (error) {
    logger.error(
      `Failed to bulk-enqueue ${jobs.length} enrollment-confirmations: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
