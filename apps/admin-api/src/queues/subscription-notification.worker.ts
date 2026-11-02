import { Worker, type Job } from "bullmq";
import { ulid } from "ulid";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { QUEUE_NAME, type SubscriptionNotificationJob } from "./subscription-notification.queue";
import { queueSubscriptionNotification } from "./subscription-notification.queue";
import notificationService from "../services/notification.service";
import subscriptionEventsRepository from "../repositories/subscription-events.repository";
import { db } from "../db/connection";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  logger.info(
    `[subscription-notification-worker] Processing job=${job.id} name=${job.name} attempt=${job.attemptsMade + 1}/${job.opts?.attempts ?? 3}`
  );

  if (job.name === "check-notification-schedule") {
    await handleNotificationScheduleCheck();
    return;
  }

  const data = job.data as SubscriptionNotificationJob;
  await handleNotification(data);
}

async function handleNotification(data: SubscriptionNotificationJob): Promise<void> {
  const { type, tenantId, subscriptionId, metadata } = data;

  logger.info(
    `[subscription-notification-worker] handleNotification: type=${type} tenant=${tenantId} sub=${subscriptionId}`
  );

  switch (type) {
    case "PAYMENT_FAILED":
      await notificationService.sendPaymentFailedEmail(tenantId, subscriptionId, metadata);
      break;
    case "GRACE_WARNING":
    case "GRACE_MIDPOINT": {
      const daysRemaining = (metadata?.days_remaining as number) ?? 0;
      await notificationService.sendGraceWarningEmail(tenantId, subscriptionId, daysRemaining);
      break;
    }
    case "GRACE_EXPIRED":
    case "SUSPENSION_NOTICE":
      await notificationService.sendSuspensionNotice(tenantId, subscriptionId);
      break;
    case "REACTIVATION_REMINDER":
    case "DATA_DELETION_WARNING": {
      const daysUntilDeletion = metadata?.days_until_deletion as number | undefined;
      await notificationService.sendReactivationReminder(tenantId, subscriptionId, daysUntilDeletion);
      break;
    }
    case "PAYMENT_RECOVERED":
      await notificationService.sendPaymentRecoveredEmail(tenantId, subscriptionId);
      break;
    case "PLAN_PURCHASED":
      await notificationService.sendPlanPurchaseConfirmationEmail(
        tenantId,
        subscriptionId,
        (metadata?.planName as string) ?? "Unknown",
        (metadata?.billingCycle as string) ?? "MONTHLY",
        Number(metadata?.price ?? 0),
        (metadata?.currency as string) ?? "INR",
        (metadata?.paymentId as string) ?? undefined,
        (metadata?.backDue as
          | { cycles: number; total: number; from?: string; to?: string }
          | undefined) ?? undefined
      );
      break;
    case "FREE_PLAN_ACTIVATED":
      await notificationService.sendFreePlanActivationEmail(
        tenantId,
        (metadata?.planName as string) ?? "Free"
      );
      break;
    case "REACTIVATION_CONFIRMED":
      await notificationService.sendReactivationConfirmedEmail(
        tenantId,
        (metadata?.planName as string) ?? "Unknown"
      );
      break;
    case "CANCELLATION_SCHEDULED":
      await notificationService.sendCancellationScheduledEmail(
        tenantId,
        subscriptionId,
        (metadata?.cancelEffectiveAt as string) ?? undefined
      );
      break;
    default:
      logger.warn(`[subscription-notification-worker] Unknown notification type: ${type}`);
      return;
  }

  // Record that notification was sent
  try {
    await subscriptionEventsRepository.create({
      id: ulid(),
      subscription_id: subscriptionId,
      tenant_id: tenantId,
      event_type: "NOTIFICATION_SENT",
      event_source: "SYSTEM",
      metadata: { notification_type: type, ...metadata },
    });
  } catch {
    // Non-critical, don't fail the job
  }
}

/**
 * Daily check: queue notifications based on dunning timeline.
 *
 * PAST_DUE subscriptions:
 *   Day 3 → GRACE_WARNING
 *   Day 5 → GRACE_MIDPOINT
 *
 * SUSPENDED tenants (CANCELLED subscriptions):
 *   Day 14 → REACTIVATION_REMINDER
 *   Day 44 → DATA_DELETION_WARNING
 */
async function handleNotificationScheduleCheck(): Promise<void> {
  const now = new Date();

  // 1. PAST_DUE subscriptions, check dunning timeline
  const pastDueSubs = await db
    .selectFrom("subscriptions")
    .select(["id", "tenant_id", "dunning_started_at", "grace_period_ends_at"])
    .where("status", "=", "PAST_DUE")
    .where("dunning_started_at", "is not", null)
    .execute();

  for (const sub of pastDueSubs) {
    if (!sub.dunning_started_at) continue;
    const daysSinceDunning = Math.floor(
      (now.getTime() - new Date(sub.dunning_started_at as unknown as string).getTime()) / (24 * 60 * 60 * 1000)
    );
    const graceEnd = sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at as unknown as string) : null;
    const daysRemaining = graceEnd
      ? Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;

    // Check if notification was already sent for this type
    if (daysSinceDunning >= 3 && daysSinceDunning < 5) {
      const existing = await subscriptionEventsRepository.findBySubscriptionAndType(
        sub.id,
        "NOTIFICATION_SENT"
      );
      const alreadySent = existing.some(
        (e) => (e.metadata as Record<string, unknown>)?.notification_type === "GRACE_WARNING"
      );
      if (!alreadySent) {
        await queueSubscriptionNotification({
          type: "GRACE_WARNING",
          tenantId: sub.tenant_id,
          subscriptionId: sub.id,
          metadata: { days_remaining: daysRemaining },
        });
      }
    }

    if (daysSinceDunning >= 5) {
      const existing = await subscriptionEventsRepository.findBySubscriptionAndType(
        sub.id,
        "NOTIFICATION_SENT"
      );
      const alreadySent = existing.some(
        (e) => (e.metadata as Record<string, unknown>)?.notification_type === "GRACE_MIDPOINT"
      );
      if (!alreadySent) {
        await queueSubscriptionNotification({
          type: "GRACE_MIDPOINT",
          tenantId: sub.tenant_id,
          subscriptionId: sub.id,
          metadata: { days_remaining: daysRemaining },
        });
      }
    }
  }

  // 2. SUSPENDED tenants, reactivation reminders
  const suspendedSubs = await db
    .selectFrom("subscriptions")
    .select(["id", "tenant_id", "cancelled_at"])
    .where("status", "=", "CANCELLED")
    .where("cancelled_at", "is not", null)
    .execute();

  for (const sub of suspendedSubs) {
    if (!sub.cancelled_at) continue;
    const daysSinceCancelled = Math.floor(
      (now.getTime() - new Date(sub.cancelled_at as unknown as string).getTime()) / (24 * 60 * 60 * 1000)
    );

    // Check tenant is actually suspended
    const tenant = await db
      .selectFrom("tenants")
      .select(["status"])
      .where("id", "=", sub.tenant_id)
      .executeTakeFirst();
    if (!tenant || tenant.status !== "SUSPENDED") continue;

    if (daysSinceCancelled >= 14 && daysSinceCancelled < 44) {
      const existing = await subscriptionEventsRepository.findBySubscriptionAndType(
        sub.id,
        "NOTIFICATION_SENT"
      );
      const alreadySent = existing.some(
        (e) => (e.metadata as Record<string, unknown>)?.notification_type === "REACTIVATION_REMINDER"
      );
      if (!alreadySent) {
        await queueSubscriptionNotification({
          type: "REACTIVATION_REMINDER",
          tenantId: sub.tenant_id,
          subscriptionId: sub.id,
        });
      }
    }

    // NOTE: DATA_DELETION_WARNING notification removed, no actual data deletion
    // pipeline exists yet. Re-add once the deletion job is implemented.
  }

  logger.info(
    `[subscription-notification-worker] Schedule check completed: ${pastDueSubs.length} past-due, ${suspendedSubs.length} cancelled subscriptions checked`
  );
}

export function startSubscriptionNotificationWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 3,
  });

  worker.on("completed", (job) => {
    const data = job.data as SubscriptionNotificationJob;
    logger.info(
      `[subscription-notification-worker] Job completed: id=${job.id} name=${job.name} type=${data?.type ?? "unknown"} tenant=${data?.tenantId ?? "unknown"}`
    );
  });

  worker.on("failed", (job, err) => {
    const data = job?.data as SubscriptionNotificationJob | undefined;
    logger.error(
      `[subscription-notification-worker] Job failed: id=${job?.id ?? "unknown"} name=${job?.name ?? "unknown"} type=${data?.type ?? "unknown"} tenant=${data?.tenantId ?? "unknown"} attempt=${job?.attemptsMade ?? "?"} error=${err.message}`
    );
  });

  worker.on("error", (err) => {
    logger.error("[subscription-notification-worker] Worker error:", err);
  });

  logger.info("[subscription-notification-worker] Started");
  return worker;
}

export async function stopSubscriptionNotificationWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[subscription-notification-worker] Stopped");
}
