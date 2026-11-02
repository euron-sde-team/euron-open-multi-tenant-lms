import { Worker } from "bullmq";
import config from "../config";
import { bullmqConnection } from "../lib/redis";
import type { NotificationJob } from "./notification.queue";
import notificationService from "../services/notification.service";
import subscriptionNotificationService from "../services/subscription-notification.service";
import logger from "../utils/logger";

const redisConnection = bullmqConnection;

let worker: Worker | null = null;

async function processJob(job: { data: NotificationJob }) {
  const { type, tenantId, memberId, orderId, orderType } = job.data;
  logger.info(`[notification-worker] Processing ${type} for tenant ${tenantId}`);

  switch (type) {
    case "user-welcome":
      if (memberId) await notificationService.processUserWelcome(tenantId, memberId);
      break;
    case "purchase-confirmation":
      if (orderId && memberId)
        await notificationService.processPurchaseConfirmation(tenantId, orderId, memberId, orderType);
      break;
    case "course-welcome":
      if (orderId && memberId)
        await notificationService.processCourseWelcome(tenantId, orderId, memberId, orderType);
      break;
    case "tenant-purchase-alert":
      if (orderId && memberId)
        await notificationService.processTenantPurchaseAlert(tenantId, orderId, memberId, orderType);
      break;
    case "enrollment-confirmation":
      if (memberId && job.data.metadata) {
        await notificationService.processEnrollmentConfirmation(
          tenantId,
          memberId,
          job.data.metadata as { itemName: string; itemType: string; itemId: string }
        );
      }
      break;
    case "subscription-charged":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.processSubscriptionCharged(
          tenantId, memberId, job.data.metadata as Record<string, unknown>
        );
      break;
    case "subscription-activated":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.sendSubscriptionActivated(
          tenantId, memberId, job.data.metadata as any
        );
      break;
    case "subscription-payment-failed":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.sendPaymentFailed(
          tenantId, memberId, job.data.metadata as any
        );
      break;
    case "subscription-halted":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.sendSubscriptionHalted(
          tenantId, memberId, job.data.metadata as any
        );
      break;
    case "subscription-cancelled":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.sendSubscriptionCancelled(
          tenantId, memberId, job.data.metadata as any
        );
      break;
    case "subscription-paused":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.sendSubscriptionPaused(
          tenantId, memberId, job.data.metadata as any
        );
      break;
    case "subscription-resumed":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.sendSubscriptionResumed(
          tenantId, memberId, job.data.metadata as any
        );
      break;
    case "subscription-completed":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.sendSubscriptionEnded(
          tenantId, memberId, job.data.metadata as any
        );
      break;
    case "subscription-renewal-reminder":
      if (memberId && job.data.metadata) {
        const meta = job.data.metadata as Record<string, unknown>;
        await subscriptionNotificationService.sendRenewalReminder(
          tenantId, memberId, meta as any, Number(meta.daysUntilRenewal ?? 7)
        );
      }
      break;
    case "subscription-grace-warning":
      if (memberId && job.data.metadata) {
        const meta = job.data.metadata as Record<string, unknown>;
        await subscriptionNotificationService.sendGracePeriodWarning(
          tenantId, memberId, meta as any, Number(meta.daysRemaining ?? 1)
        );
      }
      break;
    case "subscription-grace-expired":
      if (memberId && job.data.metadata)
        await subscriptionNotificationService.sendSubscriptionEnded(
          tenantId, memberId, job.data.metadata as any
        );
      break;
    default:
      logger.warn(`[notification-worker] Unknown job type: ${type}`);
  }
}

export function startNotificationWorker() {
  if (worker) return worker;
  worker = new Worker("user-notification", async (job) => processJob(job), {
    connection: redisConnection,
    prefix: config.BULLMQ_PREFIX,
    concurrency: 5,
  });
  worker.on("completed", (job) => {
    logger.info(`[notification-worker] Job ${job.data.type} completed`);
  });
  worker.on("failed", (job, err) => {
    logger.error(`[notification-worker] Job ${job?.data?.type} failed: ${err.message}`);
  });
  logger.info("[notification-worker] Worker started");
  return worker;
}

export async function stopNotificationWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
}
