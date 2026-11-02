import { Worker } from "bullmq";
import { subscriptionLifecycleQueue } from "./subscription-lifecycle.queue";
import config from "../config";
import { bullmqConnection } from "../lib/redis";
import type { SubscriptionLifecycleJob } from "./subscription-lifecycle.queue";
import { queueNotification } from "./notification.queue";
import tenantUserSubscriptionsRepo from "../repositories/tenant-user-subscriptions.repository";
import userSubscriptionService from "../services/user-subscription.service";
import { resolveConnection, getSubscriptionAdapter } from "../services/payment/gateway.factory";
import logger from "../utils/logger";
import { db } from "../db/connection";

const redisConnection = bullmqConnection;

let worker: Worker | null = null;

async function processJob(job: { data: SubscriptionLifecycleJob }) {
  const { type } = job.data;

  switch (type) {
    case "grace-period-check":
      await processGracePeriodExpiry();
      break;
    case "dunning-email":
      await processDunningEmails();
      break;
    case "renewal-reminder":
      await processRenewalReminders();
      break;
    case "verify-pending-subscriptions":
      await processVerifyPendingSubscriptions();
      break;
    case "grace-period-warning":
      await processGracePeriodWarnings();
      break;
    default:
      logger.warn(`[sub-lifecycle] Unknown job type: ${type}`);
  }
}

/**
 * Grace Period Expiry: Revoke access for subscriptions where grace period has ended
 */
async function processGracePeriodExpiry() {
  const expired = await tenantUserSubscriptionsRepo.findExpiredGracePeriodSubscriptions();

  for (const sub of expired) {
    try {
      // With subscription flag check pattern, access is denied dynamically
      // when checkSubscriptionAccess returns hasAccess=false.
      // Just mark as processed in metadata for tracking.
      const meta = sub.metadata as Record<string, unknown> | null;
      if (meta?.grace_expired_processed) continue;

      queueNotification({
        type: "subscription-grace-expired",
        tenantId: sub.tenant_id,
        memberId: sub.member_id,
        metadata: {
          plan_name_snapshot: sub.plan_name_snapshot,
          billing_cycle_snapshot: sub.billing_cycle_snapshot,
          amount_snapshot: sub.amount_snapshot,
          currency_snapshot: sub.currency_snapshot,
          short_url: sub.short_url,
        },
      }).catch(err => {
        logger.warn(`[sub-lifecycle] Failed to queue grace-expired notification for sub ${sub.id}:`, err);
      });

      await db
        .updateTable("tenant_user_subscriptions")
        .set({
          metadata: JSON.stringify({ ...(meta ?? {}), grace_expired_processed: true }),
          updated_at: new Date(),
        })
        .where("id", "=", sub.id)
        .where("tenant_id", "=", sub.tenant_id)
        .execute();

      logger.info(`[sub-lifecycle] Grace period expired for sub ${sub.id}, access denied dynamically`);
    } catch (err) {
      logger.error(`[sub-lifecycle] Error processing grace period expiry for sub ${sub.id}:`, err);
    }
  }

  if (expired.length > 0) {
    logger.info(`[sub-lifecycle] Grace period check: processed ${expired.length} subscriptions`);
  }
}

/**
 * Dunning Emails: Send payment failure reminders to users with PENDING/HALTED subscriptions
 */
async function processDunningEmails() {
  const subs = await tenantUserSubscriptionsRepo.findSubscriptionsForReminders(["PENDING", "HALTED"]);
  const now = new Date();

  for (const sub of subs) {
    try {
      // Check tenant's dunning interval
      const settings = await db
        .selectFrom("tenant_subscription_settings")
        .select(["dunning_email_interval_hours"])
        .where("tenant_id", "=", sub.tenant_id)
        .executeTakeFirst();

      const intervalHours = settings?.dunning_email_interval_hours ?? 48;
      const lastDunning = sub.last_dunning_email_at
        ? new Date(sub.last_dunning_email_at as any)
        : null;

      if (lastDunning) {
        const hoursSinceLast = (now.getTime() - lastDunning.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < intervalHours) continue;
      }

      await db
        .updateTable("tenant_user_subscriptions")
        .set({ last_dunning_email_at: now, updated_at: now })
        .where("id", "=", sub.id)
        .where("tenant_id", "=", sub.tenant_id)
        .execute();

      queueNotification({
        type: sub.status === "HALTED" ? "subscription-halted" : "subscription-payment-failed",
        tenantId: sub.tenant_id,
        memberId: sub.member_id,
        metadata: {
          plan_name_snapshot: sub.plan_name_snapshot,
          billing_cycle_snapshot: sub.billing_cycle_snapshot,
          amount_snapshot: sub.amount_snapshot,
          currency_snapshot: sub.currency_snapshot,
          short_url: sub.short_url,
        },
      }).catch(err => {
        logger.warn(`[sub-lifecycle] Failed to queue dunning notification for sub ${sub.id}:`, err);
      });

      logger.info(`[sub-lifecycle] Dunning email queued for sub ${sub.id}`);
    } catch (err) {
      logger.error(`[sub-lifecycle] Error processing dunning for sub ${sub.id}:`, err);
    }
  }
}

/**
 * Renewal Reminders: Remind active subscribers about upcoming renewals
 */
async function processRenewalReminders() {
  // Check for subscriptions renewing in the next 7 days
  const reminderDays = [7, 3, 1];
  for (const days of reminderDays) {
    const subs = await tenantUserSubscriptionsRepo.findActiveSubscriptionsApproachingRenewal(days);

    for (const sub of subs) {
      try {
        // Check tenant's reminder config
        const settings = await db
          .selectFrom("tenant_subscription_settings")
          .select(["reminder_days_before"])
          .where("tenant_id", "=", sub.tenant_id)
          .executeTakeFirst();

        const reminderConfig = settings?.reminder_days_before as number[] | null;
        if (!reminderConfig || !reminderConfig.includes(days)) continue;

        queueNotification({
          type: "subscription-renewal-reminder",
          tenantId: sub.tenant_id,
          memberId: sub.member_id,
          metadata: {
            plan_name_snapshot: sub.plan_name_snapshot,
            billing_cycle_snapshot: sub.billing_cycle_snapshot,
            amount_snapshot: sub.amount_snapshot,
            currency_snapshot: sub.currency_snapshot,
            daysUntilRenewal: days,
          },
        }).catch(err => {
          logger.warn(`[sub-lifecycle] Failed to queue renewal reminder notification for sub ${sub.id}:`, err);
        });

        logger.info(`[sub-lifecycle] Renewal reminder (${days}d) for sub ${sub.id}`);
      } catch (err) {
        logger.error(`[sub-lifecycle] Error processing renewal reminder for sub ${sub.id}:`, err);
      }
    }
  }
}

/**
 * Verify Pending Subscriptions: Poll Razorpay for subscriptions stuck at CREATED/AUTHENTICATED
 * and apply the correct state transition if the gateway has progressed.
 */
async function processVerifyPendingSubscriptions() {
  const stale = await tenantUserSubscriptionsRepo.findPendingVerificationSubscriptions();
  if (stale.length === 0) return;

  logger.info(`[sub-lifecycle] verify-pending: found ${stale.length} subscriptions to check`);

  for (const sub of stale) {
    try {
      if (!sub.gateway_subscription_id) continue;

      const connection = await resolveConnection(sub.tenant_id);
      if (!connection) {
        logger.warn(`[sub-lifecycle] verify-pending: no gateway connection for tenant=${sub.tenant_id}`);
        continue;
      }

      const adapter = getSubscriptionAdapter(connection);
      const gatewaySub = await adapter.fetchSubscription(sub.gateway_subscription_id);
      const gatewayStatus = gatewaySub.status?.toLowerCase();

      if (gatewayStatus === "active" && sub.status !== "ACTIVE") {
        logger.info(`[sub-lifecycle] verify-pending: activating subscription ${sub.id} (gateway=${gatewayStatus}, local=${sub.status})`);
        await userSubscriptionService.applyFallbackTransition(sub, "subscription.activated", gatewaySub);
      } else if (gatewayStatus === "authenticated" && sub.status === "CREATED") {
        logger.info(`[sub-lifecycle] verify-pending: authenticating subscription ${sub.id} (gateway=${gatewayStatus}, local=${sub.status})`);
        await userSubscriptionService.applyFallbackTransition(sub, "subscription.authenticated", gatewaySub);
      } else {
        logger.debug(`[sub-lifecycle] verify-pending: no transition needed for ${sub.id} (gateway=${gatewayStatus}, local=${sub.status})`);
      }
    } catch (err) {
      logger.error(`[sub-lifecycle] verify-pending: error processing subscription ${sub.id}:`, err);
    }
  }
}

/**
 * Grace Period Warnings: Notify users approaching grace period expiry
 * Sends warnings at 3 days and 1 day before access ends.
 */
async function processGracePeriodWarnings() {
  const warningDays = [3, 1];
  const subs = await tenantUserSubscriptionsRepo.findSubscriptionsInGracePeriod();

  for (const sub of subs) {
    try {
      if (!sub.grace_period_ends_at) continue;

      const gracePeriodEnd = new Date(sub.grace_period_ends_at as any);
      const now = new Date();
      const msRemaining = gracePeriodEnd.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

      // Find the appropriate warning threshold
      const matchedDay = warningDays.find(d => daysRemaining <= d);
      if (!matchedDay) continue;

      // Idempotency: check last_grace_warning_day in metadata
      const meta = sub.metadata as Record<string, unknown> | null;
      const lastWarningDay = meta?.last_grace_warning_day as number | undefined;
      if (lastWarningDay !== undefined && lastWarningDay <= matchedDay) continue;

      // Update metadata with warning day before sending (prevents duplicate on retry)
      await db
        .updateTable("tenant_user_subscriptions")
        .set({
          metadata: JSON.stringify({ ...(meta ?? {}), last_grace_warning_day: matchedDay }),
          updated_at: new Date(),
        })
        .where("id", "=", sub.id)
        .where("tenant_id", "=", sub.tenant_id)
        .execute();

      queueNotification({
        type: "subscription-grace-warning",
        tenantId: sub.tenant_id,
        memberId: sub.member_id,
        metadata: {
          plan_name_snapshot: sub.plan_name_snapshot,
          billing_cycle_snapshot: sub.billing_cycle_snapshot,
          amount_snapshot: sub.amount_snapshot,
          currency_snapshot: sub.currency_snapshot,
          short_url: sub.short_url,
          daysRemaining: matchedDay,
        },
      }).catch(err => {
        logger.warn(`[sub-lifecycle] Failed to queue grace-warning notification for sub ${sub.id}:`, err);
      });

      logger.info(`[sub-lifecycle] Grace period warning (${matchedDay}d) queued for sub ${sub.id}`);
    } catch (err) {
      logger.error(`[sub-lifecycle] Error processing grace period warning for sub ${sub.id}:`, err);
    }
  }
}

export function startSubscriptionLifecycleWorker() {
  if (worker) return;

  worker = new Worker("subscription-lifecycle", async (job) => processJob(job), {
    connection: redisConnection,
    prefix: config.BULLMQ_PREFIX,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    logger.debug(`[sub-lifecycle] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`[sub-lifecycle] Job ${job?.id} failed:`, err);
  });

  // Schedule recurring jobs

  // Grace period check: every hour
  subscriptionLifecycleQueue.add(
    "grace-period-check",
    { type: "grace-period-check" },
    {
      repeat: { every: 60 * 60 * 1000 }, // hourly
      jobId: "recurring-grace-period-check",
    }
  );

  // Dunning emails: every 6 hours
  subscriptionLifecycleQueue.add(
    "dunning-email",
    { type: "dunning-email" },
    {
      repeat: { every: 6 * 60 * 60 * 1000 }, // every 6 hours
      jobId: "recurring-dunning-email",
    }
  );

  // Renewal reminders: daily
  subscriptionLifecycleQueue.add(
    "renewal-reminder",
    { type: "renewal-reminder" },
    {
      repeat: { every: 24 * 60 * 60 * 1000 }, // daily
      jobId: "recurring-renewal-reminder",
    }
  );

  // Grace period warnings: every 6 hours
  subscriptionLifecycleQueue.add(
    "grace-period-warning",
    { type: "grace-period-warning" },
    {
      repeat: { every: 6 * 60 * 60 * 1000 }, // every 6 hours
      jobId: "recurring-grace-period-warning",
    }
  );

  // Verify pending subscriptions: every 2 minutes
  subscriptionLifecycleQueue.add(
    "verify-pending-subscriptions",
    { type: "verify-pending-subscriptions" },
    {
      repeat: { every: 2 * 60 * 1000 }, // every 2 minutes
      jobId: "recurring-verify-pending-subscriptions",
    }
  );

  logger.info("[sub-lifecycle] Subscription lifecycle worker started with recurring jobs");
}

export async function stopSubscriptionLifecycleWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[sub-lifecycle] Subscription lifecycle worker stopped");
  }
}
