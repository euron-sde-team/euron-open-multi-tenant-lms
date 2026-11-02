import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { EMAIL_SENDING_DOMAIN_VERIFICATION_QUEUE_NAME } from "./email-sending-domain-verification.queue";
import emailSendingDomainService from "../services/email-sending-domain.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "poll-pending-domains":
      await emailSendingDomainService.pollPendingDomains();
      break;
    default:
      logger.warn(
        `[email-sending-domain-verification-worker] Unknown job name: ${job.name}`,
      );
  }
}

export function startEmailSendingDomainVerificationWorker(): void {
  worker = new Worker(
    EMAIL_SENDING_DOMAIN_VERIFICATION_QUEUE_NAME,
    processJob,
    {
      connection: redisConnection,
      prefix: QUEUE_PREFIX,
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    logger.debug(
      `[email-sending-domain-verification-worker] Job ${job.name} completed`,
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[email-sending-domain-verification-worker] Job ${job?.name} failed:`,
      err,
    );
  });

  logger.info("[email-sending-domain-verification-worker] Worker started");
}

export async function stopEmailSendingDomainVerificationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[email-sending-domain-verification-worker] Worker stopped");
  }
}
