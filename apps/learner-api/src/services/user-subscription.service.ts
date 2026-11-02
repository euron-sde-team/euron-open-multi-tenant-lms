import { db } from "../db/connection";
import { tenant_subscription_status } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { queueNotification } from "../queues/notification.queue";
import tenantSubscriptionPlansRepo from "../repositories/tenant-subscription-plans.repository";
import tenantUserSubscriptionsRepo from "../repositories/tenant-user-subscriptions.repository";
import tenantSubscriptionEventsRepo from "../repositories/tenant-subscription-events.repository";
import { resolveConnection } from "./payment/gateway.factory";
import { getSubscriptionAdapter } from "./payment/gateway.factory";
import { assertSelfServeAllowed, isAccessManaged } from "../utils/assert-self-serve";
import logger from "../utils/logger";

class UserSubscriptionService {
  // Status hierarchy, higher index = more progressed state.
  // Used to prevent backward transitions from out-of-order webhooks.
  private static readonly STATUS_RANK: Record<string, number> = {
    CREATED: 0,
    AUTHENTICATED: 1,
    ACTIVE: 2,
    PENDING: 3,
    HALTED: 4,
    PAUSED: 5,
    CANCELLED: 6,
    COMPLETED: 7,
    EXPIRED: 8,
  };

  // ─── Public Plan Listing ──────────────────────────────────────────────────

  async listActivePlans(tenantId: string) {
    // Access-managed storefront: memberships are a self-serve purchase, so
    // the plan catalog (with its amounts) is simply not offered, the
    // /subscribe page renders its existing "not enabled" state.
    if (await isAccessManaged(tenantId)) {
      return { subscription_name: null, plans: [], is_enabled: false };
    }

    // Also check subscription settings
    const settings = await db
      .selectFrom("tenant_subscription_settings")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!settings?.is_enabled) {
      return { subscription_name: null, plans: [], is_enabled: false };
    }

    const plans = await tenantSubscriptionPlansRepo.findActivePlansByTenantId(tenantId);
    return {
      subscription_name: settings.subscription_name ?? null,
      plans,
      is_enabled: true,
      page_config: settings.page_config ?? null,
    };
  }

  // ─── Subscribe ────────────────────────────────────────────────────────────

  async subscribe(tenantId: string, memberId: string, planId: string) {
    await assertSelfServeAllowed(tenantId);

    logger.info(`[sub] subscribe called: tenant=${tenantId} member=${memberId} plan=${planId}`);

    // 1. Expire stale pre-payment subscriptions (CREATED/AUTHENTICATED never progressed)
    for (const staleStatus of ["CREATED", "AUTHENTICATED"] as tenant_subscription_status[]) {
      const stale = await tenantUserSubscriptionsRepo.findByMemberIdAndStatus(
        tenantId, memberId, staleStatus
      );
      if (stale) {
        logger.info(`[sub] Expiring stale ${staleStatus} subscription=${stale.id} for member=${memberId}`);
        await tenantUserSubscriptionsRepo.updateStatus(tenantId, stale.id, {
          status: "EXPIRED" as tenant_subscription_status,
        });
      }
    }

    // 2. Check for existing active subscription (ACTIVE/PENDING only, stale ones already cleaned)
    const existing = await tenantUserSubscriptionsRepo.findActiveByMemberId(tenantId, memberId);
    if (existing) {
      logger.warn(`[sub] Member ${memberId} already has active subscription=${existing.id} status=${existing.status}`);
      throw new BadRequestError("You already have an active subscription. Cancel it first to subscribe to a new plan.");
    }

    // 2. Get plan
    const plan = await tenantSubscriptionPlansRepo.findById(tenantId, planId);
    if (!plan || !plan.is_active) {
      throw new NotFoundError("Subscription plan not found or not active");
    }
    if (!plan.gateway_plan_id) {
      throw new BadRequestError("Plan is not configured for gateway subscriptions");
    }

    // 3. Resolve SELF_MANAGED gateway connection
    const connection = await resolveConnection(tenantId);
    if (!connection) {
      throw new BadRequestError("No payment gateway configured");
    }
    if (connection.mode !== "SELF_MANAGED") {
      throw new BadRequestError("Subscription requires a SELF_MANAGED payment gateway");
    }

    // 4. Get member info for customer creation
    const member = await db
      .selectFrom("tenant_members")
      .select(["id", "email", "name", "phone"])
      .where("id", "=", memberId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!member) {
      throw new NotFoundError("Member not found");
    }

    // 5. Create subscription on Razorpay
    const adapter = getSubscriptionAdapter(connection);
    const gatewayResult = await adapter.createSubscription({
      gateway_plan_id: plan.gateway_plan_id,
      total_count: this.computeTotalCount(plan.billing_cycle),
      customer_notify: false,
      customer_email: member.email ?? undefined,
      customer_contact: member.phone ?? undefined,
      notes: {
        tenant_id: tenantId,
        member_id: memberId,
        plan_id: planId,
      },
    });

    // 6. Store subscription in DB
    const subscription = await tenantUserSubscriptionsRepo.create({
      tenant_id: tenantId,
      member_id: memberId,
      plan_id: planId,
      gateway_connection_id: connection.connection_id,
      gateway_subscription_id: gatewayResult.gateway_subscription_id,
      gateway_customer_id: gatewayResult.gateway_customer_id,
      gateway_provider: "RAZORPAY",
      plan_name_snapshot: plan.name,
      billing_cycle_snapshot: plan.billing_cycle,
      amount_snapshot: String(plan.amount),
      currency_snapshot: plan.currency,
      status: "CREATED" as tenant_subscription_status,
      short_url: gatewayResult.short_url,
      trial_ends_at: plan.trial_days > 0
        ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000)
        : undefined,
    });

    // 7. Record event
    await tenantSubscriptionEventsRepo.insertEventIfNew({
      tenant_id: tenantId,
      subscription_id: subscription.id,
      event_type: "subscription.created",
      new_status: "CREATED",
    });

    logger.info(
      `[sub] Subscription created: id=${subscription.id} gateway_sub_id=${gatewayResult.gateway_subscription_id} ` +
      `short_url=${gatewayResult.short_url ? "yes" : "none"}`
    );

    return {
      subscription_id: subscription.id,
      gateway_subscription_id: gatewayResult.gateway_subscription_id,
      short_url: gatewayResult.short_url,
      status: subscription.status,
      client_config: gatewayResult.client_config,
    };
  }

  // ─── Verify Auth Payment (Fallback) ──────────────────────────────────────
  //
  // Primary activation is via webhook. This endpoint is a fallback:
  // if the webhook hasn't arrived yet, it fetches the subscription status
  // directly from Razorpay and applies the state transition if needed.
  // All transitions use the same idempotent event system as webhooks.

  async verifyAuthPayment(
    tenantId: string,
    memberId: string,
    data: { razorpay_subscription_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }
  ) {
    logger.info(
      `[sub-verify] verifyAuthPayment called: tenant=${tenantId} member=${memberId} ` +
      `gateway_sub_id=${data.razorpay_subscription_id ?? "none"}`
    );

    // Find subscription, by gateway ID or by member's latest
    let sub;
    if (data.razorpay_subscription_id) {
      sub = await tenantUserSubscriptionsRepo.findByGatewaySubscriptionId(data.razorpay_subscription_id);
      if (sub && (sub.tenant_id !== tenantId || sub.member_id !== memberId)) {
        logger.warn(`[sub-verify] Subscription tenant/member mismatch: sub.tenant=${sub.tenant_id} sub.member=${sub.member_id}`);
        throw new NotFoundError("Subscription not found");
      }
    }
    if (!sub) {
      sub = await tenantUserSubscriptionsRepo.findByMemberId(tenantId, memberId);
    }
    if (!sub) {
      logger.warn(`[sub-verify] No subscription found for tenant=${tenantId} member=${memberId}`);
      throw new NotFoundError("Subscription not found");
    }

    logger.info(
      `[sub-verify] Found subscription: id=${sub.id} status=${sub.status} gateway_sub_id=${sub.gateway_subscription_id ?? "none"}`
    );

    // If already ACTIVE, no work needed, idempotent return
    if (sub.status === "ACTIVE") {
      logger.info(`[sub-verify] Subscription ${sub.id} already ACTIVE, returning`);
      return {
        subscription_id: sub.id,
        status: sub.status,
        message: "Subscription is active.",
      };
    }

    // Only attempt fallback verification for pre-activation statuses
    if (!["CREATED", "AUTHENTICATED"].includes(sub.status)) {
      return {
        subscription_id: sub.id,
        status: sub.status,
        message: `Subscription status is ${sub.status}.`,
      };
    }

    // Fetch current status from Razorpay
    if (!sub.gateway_subscription_id) {
      return {
        subscription_id: sub.id,
        status: sub.status,
        message: "No gateway subscription to verify.",
      };
    }

    try {
      const connection = await resolveConnection(tenantId);
      if (!connection) {
        logger.warn(`[sub-verify] No gateway connection for tenant=${tenantId}`);
        return { subscription_id: sub.id, status: sub.status, message: "Awaiting webhook confirmation." };
      }

      logger.info(`[sub-verify] Fetching subscription from Razorpay: gateway_sub_id=${sub.gateway_subscription_id}`);
      const adapter = getSubscriptionAdapter(connection);
      const gatewaySub = await adapter.fetchSubscription(sub.gateway_subscription_id);

      // Map Razorpay status to our event types and apply transitions
      // Razorpay statuses: created, authenticated, active, pending, halted, cancelled, paused, completed, expired
      const gatewayStatus = gatewaySub.status?.toLowerCase();
      logger.info(
        `[sub-verify] Razorpay status="${gatewayStatus}" vs local status="${sub.status}" for subscription=${sub.id}`
      );

      if (gatewayStatus === "active" && (sub.status as string) !== "ACTIVE") {
        // Gateway says active, apply the activated transition (idempotent via event dedup)
        logger.info(`[sub-verify] Applying fallback activation for subscription=${sub.id}`);
        await this.applyFallbackTransition(sub, "subscription.activated", gatewaySub);
        return { subscription_id: sub.id, status: "ACTIVE", message: "Subscription activated via verification." };
      }

      if (gatewayStatus === "authenticated" && sub.status === "CREATED") {
        logger.info(`[sub-verify] Applying fallback authentication for subscription=${sub.id}`);
        await this.applyFallbackTransition(sub, "subscription.authenticated", gatewaySub);
        return { subscription_id: sub.id, status: "AUTHENTICATED", message: "Subscription authenticated. Awaiting activation." };
      }

      // Gateway hasn't progressed yet
      logger.info(`[sub-verify] No transition needed: gateway=${gatewayStatus} local=${sub.status}`);
      return {
        subscription_id: sub.id,
        status: sub.status,
        message: "Payment is still being processed. Your subscription will activate shortly.",
      };
    } catch (err) {
      // Don't fail the endpoint, webhook may still process it
      logger.error("[sub-verify] Fallback verification failed", {
        subscriptionId: sub.id,
        gatewaySubId: sub.gateway_subscription_id,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return {
        subscription_id: sub.id,
        status: sub.status,
        message: "Awaiting webhook confirmation.",
      };
    }
  }

  /**
   * Apply a gateway-verified state transition using the same idempotent
   * event system as webhooks. If the webhook already processed this event,
   * insertEventIfNew returns false and the DB update is skipped.
   */
  async applyFallbackTransition(
    sub: any,
    eventType: string,
    gatewaySub: { id?: string; customer_id?: string; status?: string; current_start?: number; current_end?: number; charge_at?: number; short_url?: string }
  ) {
    const newStatus = this.mapEventToStatus(eventType, sub.status);

    const inserted = await tenantSubscriptionEventsRepo.insertEventIfNew({
      tenant_id: sub.tenant_id,
      subscription_id: sub.id,
      event_type: eventType,
      gateway_event_id: `fallback_verify_${sub.id}_${eventType}`,
      previous_status: sub.status,
      new_status: newStatus,
      metadata: { source: "fallback_verification", gateway_status: gatewaySub.status },
    });

    if (!inserted) {
      // Webhook already processed this, no action needed
      logger.info(`[sub-verify] Event ${eventType} already processed for subscription ${sub.id}`);
      return;
    }

    // Re-fetch to get latest status before applying handler (guards against TOCTOU races)
    const freshSub = await tenantUserSubscriptionsRepo.findByGatewaySubscriptionId(sub.gateway_subscription_id);
    const currentStatus = freshSub?.status ?? sub.status;

    // Apply the same handler logic as webhooks (with state machine guards)
    switch (eventType) {
      case "subscription.authenticated": {
        const currentRank = UserSubscriptionService.STATUS_RANK[currentStatus] ?? 0;
        const targetRank = UserSubscriptionService.STATUS_RANK["AUTHENTICATED"] ?? 1;
        if (currentRank > targetRank) {
          logger.info(`[sub-verify] Skipping fallback authenticated, already ${currentStatus}`);
          return;
        }
        await this.handleAuthenticated(sub, gatewaySub);
        break;
      }
      case "subscription.activated":
        await this.handleActivated(sub, gatewaySub);
        break;
      default:
        logger.warn(`[sub-verify] Unexpected fallback event type: ${eventType}`);
    }

    logger.info(`[sub-verify] Applied fallback ${eventType} for subscription ${sub.id}`);
  }

  // ─── My Subscription ─────────────────────────────────────────────────────

  async getMySubscription(tenantId: string, memberId: string) {
    const sub = await tenantUserSubscriptionsRepo.findByMemberId(tenantId, memberId);
    if (!sub) return null;

    const plan = await tenantSubscriptionPlansRepo.findById(tenantId, sub.plan_id);

    return {
      id: sub.id,
      plan_id: sub.plan_id,
      plan_name: sub.plan_name_snapshot,
      plan_description: plan?.description ?? null,
      billing_cycle: sub.billing_cycle_snapshot,
      amount: sub.amount_snapshot,
      currency: sub.currency_snapshot,
      status: sub.status,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      trial_ends_at: sub.trial_ends_at,
      grace_period_ends_at: sub.grace_period_ends_at,
      cancel_at_period_end: sub.cancel_at_period_end,
      next_charge_at: sub.next_charge_at,
      last_payment_at: sub.last_payment_at,
      last_payment_amount: sub.last_payment_amount,
      short_url: sub.short_url,
      created_at: sub.created_at,
    };
  }

  // ─── Cancel Subscription ──────────────────────────────────────────────────

  async cancelMySubscription(tenantId: string, memberId: string, _cancelAtPeriodEnd = true) {
    const sub = await tenantUserSubscriptionsRepo.findActiveByMemberId(tenantId, memberId);
    if (!sub) throw new NotFoundError("No active subscription found");
    if (!sub.gateway_subscription_id) throw new BadRequestError("Subscription has no gateway ID");

    const connection = await resolveConnection(tenantId);
    if (!connection) throw new BadRequestError("No payment gateway configured");

    const adapter = getSubscriptionAdapter(connection);
    // Cancel immediately on gateway, no more charges.
    // Access is preserved locally until current_period_end via grace period.
    await adapter.cancelSubscription(sub.gateway_subscription_id, false);

    await tenantUserSubscriptionsRepo.updateStatus(tenantId, sub.id, {
      status: sub.status as tenant_subscription_status, // keep current status until webhook
      cancel_at_period_end: true,
    });
    // Razorpay fires subscription.cancelled webhook immediately → handleCancelled()
    // sets grace_period_ends_at = current_period_end so access continues until paid period ends.
  }

  // ─── Update Payment Link ──────────────────────────────────────────────────

  async getPaymentUpdateLink(tenantId: string, memberId: string) {
    const sub = await tenantUserSubscriptionsRepo.findByMemberId(tenantId, memberId);
    if (!sub) throw new NotFoundError("No subscription found");
    return { short_url: sub.short_url };
  }

  // ─── Webhook Handling ─────────────────────────────────────────────────────

  async handleSubscriptionWebhook(
    tenantId: string,
    connectionId: string,
    eventType: string,
    eventId: string,
    payload: Record<string, unknown>
  ) {
    logger.info(`[sub-webhook] handleSubscriptionWebhook called: tenant=${tenantId} event=${eventType} eventId=${eventId}`);

    const subscriptionEntity = (payload as any)?.payload?.subscription?.entity;
    if (!subscriptionEntity?.id) {
      logger.warn(`[sub-webhook] No subscription entity in payload for ${eventType}`);
      return;
    }

    const gatewaySubId = subscriptionEntity.id as string;
    const sub = await tenantUserSubscriptionsRepo.findByGatewaySubscriptionId(gatewaySubId);
    if (!sub) {
      logger.warn(`[sub-webhook] Subscription not found for gateway_subscription_id=${gatewaySubId}`);
      return;
    }

    const newStatus = this.mapEventToStatus(eventType, sub.status);
    logger.info(
      `[sub-webhook] State transition: ${sub.status} → ${newStatus} for subscription=${sub.id} ` +
      `(gateway_status=${subscriptionEntity.status ?? "unknown"}, razorpay_sub_id=${gatewaySubId})`
    );

    // Idempotency check via events table
    const inserted = await tenantSubscriptionEventsRepo.insertEventIfNew({
      tenant_id: sub.tenant_id,
      subscription_id: sub.id,
      event_type: eventType,
      gateway_event_id: eventId,
      previous_status: sub.status,
      new_status: newStatus,
      gateway_payment_id: (payload as any)?.payload?.payment?.entity?.id ?? undefined,
      amount: subscriptionEntity.amount
        ? (Number(subscriptionEntity.amount) / 100).toFixed(2)
        : undefined,
      metadata: { razorpay_event: payload },
    });

    if (!inserted) {
      logger.info(`[sub-webhook] Duplicate event ${eventId} for subscription ${sub.id}, skipping`);
      return;
    }

    logger.info(`[sub-webhook] Event recorded, proceeding with handler for ${eventType}`);

    // Fetch grace period settings
    const settings = await db
      .selectFrom("tenant_subscription_settings")
      .selectAll()
      .where("tenant_id", "=", sub.tenant_id)
      .executeTakeFirst();
    const gracePeriodDays = settings?.grace_period_days ?? 0;

    // Re-fetch subscription to get latest status (another webhook may have updated it)
    const freshSub = await tenantUserSubscriptionsRepo.findByGatewaySubscriptionId(gatewaySubId);
    const currentStatus = freshSub?.status ?? sub.status;

    // Dispatch by event type (with state machine guards)
    switch (eventType) {
      case "subscription.authenticated": {
        // Guard: don't regress from ACTIVE or later back to AUTHENTICATED
        const currentRank = UserSubscriptionService.STATUS_RANK[currentStatus] ?? 0;
        const targetRank = UserSubscriptionService.STATUS_RANK["AUTHENTICATED"] ?? 1;
        if (currentRank > targetRank) {
          // Only update gateway_customer_id if missing
          if (!freshSub?.gateway_customer_id && subscriptionEntity.customer_id) {
            await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
              status: currentStatus as tenant_subscription_status,
              gateway_customer_id: subscriptionEntity.customer_id,
            });
          }
          logger.info(
            `[sub-webhook] Skipping authenticated handler, subscription ${sub.id} already ${currentStatus}`
          );
          break;
        }
        await this.handleAuthenticated(sub, subscriptionEntity);
        break;
      }
      case "subscription.activated": {
        // Guard: skip if already ACTIVE (idempotent, charged may have already set it)
        if (currentStatus === "ACTIVE") {
          logger.info(
            `[sub-webhook] Skipping activated handler, subscription ${sub.id} already ACTIVE`
          );
          break;
        }
        await this.handleActivated(sub, subscriptionEntity);
        break;
      }
      case "subscription.charged": {
        const paymentEntity = (payload as any)?.payload?.payment?.entity;
        await this.handleCharged(sub, subscriptionEntity, paymentEntity);
        break;
      }
      case "subscription.pending":
        await this.handlePending(sub, subscriptionEntity, gracePeriodDays);
        break;
      case "subscription.halted":
        await this.handleHalted(sub, subscriptionEntity, gracePeriodDays);
        break;
      case "subscription.cancelled":
        await this.handleCancelled(sub, subscriptionEntity, gracePeriodDays);
        break;
      case "subscription.paused":
        await this.handlePaused(sub, subscriptionEntity, gracePeriodDays);
        break;
      case "subscription.resumed":
        await this.handleResumed(sub, subscriptionEntity);
        break;
      case "subscription.completed":
        await this.handleCompleted(sub, subscriptionEntity, gracePeriodDays);
        break;
      default:
        logger.warn(`[sub-webhook] Unhandled subscription event: ${eventType}`);
    }

    logger.info(`[sub-webhook] Completed handling ${eventType} for subscription=${sub.id}`);
  }

  private mapEventToStatus(eventType: string, currentStatus: string): string {
    const mapping: Record<string, string> = {
      "subscription.authenticated": "AUTHENTICATED",
      "subscription.activated": "ACTIVE",
      "subscription.charged": "ACTIVE",
      "subscription.pending": "PENDING",
      "subscription.halted": "HALTED",
      "subscription.cancelled": "CANCELLED",
      "subscription.paused": "PAUSED",
      "subscription.resumed": "ACTIVE",
      "subscription.completed": "COMPLETED",
    };
    return mapping[eventType] ?? currentStatus;
  }

  private async handleAuthenticated(sub: any, entity: any) {
    logger.info(
      `[sub-webhook] handleAuthenticated: sub=${sub.id} customer_id=${entity.customer_id ?? "none"} ` +
      `razorpay_status=${entity.status ?? "unknown"}`
    );
    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "AUTHENTICATED" as tenant_subscription_status,
      gateway_customer_id: entity.customer_id ?? undefined,
    });
    logger.info(`[sub-webhook] Subscription ${sub.id} → AUTHENTICATED`);
  }

  private async handleActivated(sub: any, entity: any) {
    const periodStart = entity.current_start ? new Date(entity.current_start * 1000) : undefined;
    const periodEnd = entity.current_end ? new Date(entity.current_end * 1000) : undefined;
    const chargeAt = entity.charge_at ? new Date(entity.charge_at * 1000) : undefined;

    logger.info(
      `[sub-webhook] handleActivated: sub=${sub.id} period=${periodStart?.toISOString() ?? "none"}→${periodEnd?.toISOString() ?? "none"} ` +
      `charge_at=${chargeAt?.toISOString() ?? "none"} razorpay_status=${entity.status ?? "unknown"}`
    );

    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "ACTIVE" as tenant_subscription_status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      next_charge_at: chargeAt,
      short_url: entity.short_url ?? sub.short_url,
      gateway_customer_id: entity.customer_id ?? undefined,
    });

    logger.info(`[sub-webhook] Subscription ${sub.id} → ACTIVE`);

    queueNotification({
      type: "subscription-activated",
      tenantId: sub.tenant_id,
      memberId: sub.member_id,
      subscriptionId: sub.id,
      metadata: {
        plan_name_snapshot: sub.plan_name_snapshot,
        billing_cycle_snapshot: sub.billing_cycle_snapshot,
        amount_snapshot: sub.amount_snapshot,
        currency_snapshot: sub.currency_snapshot,
      },
    }).catch(err => {
      logger.warn(`[sub-webhook] Failed to queue subscription-activated notification for sub ${sub.id}:`, err);
    });
  }

  private async handleCharged(sub: any, entity: any, paymentEntity?: any) {
    const periodStart = entity.current_start ? new Date(entity.current_start * 1000) : undefined;
    const periodEnd = entity.current_end ? new Date(entity.current_end * 1000) : undefined;
    const chargeAt = entity.charge_at ? new Date(entity.charge_at * 1000) : undefined;
    // Prefer payment entity amount (actual charged) over subscription entity amount (plan amount)
    const rawAmount = paymentEntity?.amount ?? entity.amount;
    const amount = rawAmount ? (Number(rawAmount) / 100).toFixed(2) : undefined;

    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "ACTIVE" as tenant_subscription_status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      next_charge_at: chargeAt,
      last_payment_at: new Date(),
      last_payment_amount: amount,
      payment_failure_count: 0,
      grace_period_ends_at: undefined,
    });

    // Clear grace period tracking metadata so future grace periods start fresh
    const meta = sub.metadata as Record<string, unknown> | null;
    if (meta?.last_grace_warning_day !== undefined || meta?.grace_expired_processed) {
      const { last_grace_warning_day, grace_expired_processed, ...cleanMeta } = meta ?? {};
      await db
        .updateTable("tenant_user_subscriptions")
        .set({
          metadata: JSON.stringify(cleanMeta),
          updated_at: new Date(),
        })
        .where("id", "=", sub.id)
        .where("tenant_id", "=", sub.tenant_id)
        .execute();
    }

    logger.info(`[sub-webhook] Subscription ${sub.id} charged successfully`);

    queueNotification({
      type: "subscription-charged",
      tenantId: sub.tenant_id,
      memberId: sub.member_id,
      subscriptionId: sub.id,
      metadata: {
        subscriptionId: sub.id,
        planName: sub.plan_name_snapshot,
        billingCycle: sub.billing_cycle_snapshot,
        amount: amount ?? sub.amount_snapshot,
        currency: sub.currency_snapshot,
        gatewayPaymentId: paymentEntity?.id,
        periodStart: periodStart?.toISOString(),
        periodEnd: periodEnd?.toISOString(),
      },
    }).catch(err => {
      logger.warn(`[sub-webhook] Failed to queue subscription-charged notification for sub ${sub.id}:`, err);
    });
  }

  private async handlePending(sub: any, _entity: any, gracePeriodDays: number) {
    const gracePeriodEnd = gracePeriodDays > 0
      ? new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)
      : undefined;

    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "PENDING" as tenant_subscription_status,
      payment_failure_count: (sub.payment_failure_count ?? 0) + 1,
      grace_period_ends_at: gracePeriodEnd,
    });
    logger.info(`[sub-webhook] Subscription ${sub.id} pending (payment retry)`);

    queueNotification({
      type: "subscription-payment-failed",
      tenantId: sub.tenant_id,
      memberId: sub.member_id,
      subscriptionId: sub.id,
      metadata: {
        plan_name_snapshot: sub.plan_name_snapshot,
        billing_cycle_snapshot: sub.billing_cycle_snapshot,
        amount_snapshot: sub.amount_snapshot,
        currency_snapshot: sub.currency_snapshot,
        short_url: sub.short_url,
      },
    }).catch(err => {
      logger.warn(`[sub-webhook] Failed to queue subscription-payment-failed notification for sub ${sub.id}:`, err);
    });
  }

  private async handleHalted(sub: any, _entity: any, gracePeriodDays: number) {
    const gracePeriodEnd = gracePeriodDays > 0
      ? new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)
      : undefined;

    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "HALTED" as tenant_subscription_status,
      grace_period_ends_at: gracePeriodEnd,
    });

    logger.info(`[sub-webhook] Subscription ${sub.id} halted, grace=${gracePeriodDays}d`);

    queueNotification({
      type: "subscription-halted",
      tenantId: sub.tenant_id,
      memberId: sub.member_id,
      subscriptionId: sub.id,
      metadata: {
        plan_name_snapshot: sub.plan_name_snapshot,
        billing_cycle_snapshot: sub.billing_cycle_snapshot,
        amount_snapshot: sub.amount_snapshot,
        currency_snapshot: sub.currency_snapshot,
        short_url: sub.short_url,
      },
    }).catch(err => {
      logger.warn(`[sub-webhook] Failed to queue subscription-halted notification for sub ${sub.id}:`, err);
    });
  }

  private async handleCancelled(sub: any, entity: any, gracePeriodDays: number) {
    let gracePeriodEnd: Date | undefined;

    if (sub.cancel_at_period_end && sub.current_period_end) {
      // User-initiated cancel: access continues until the already-paid period ends
      gracePeriodEnd = new Date(sub.current_period_end);
    } else if (entity.current_end) {
      // Fallback: use period end from Razorpay entity
      gracePeriodEnd = new Date(entity.current_end * 1000);
    } else if (gracePeriodDays > 0) {
      // Last resort: tenant-configured grace period
      gracePeriodEnd = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000);
    }

    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "CANCELLED" as tenant_subscription_status,
      cancelled_at: new Date(),
      grace_period_ends_at: gracePeriodEnd,
      next_charge_at: null as unknown as Date,
    });

    logger.info(`[sub-webhook] Subscription ${sub.id} cancelled, gracePeriodEnd=${gracePeriodEnd?.toISOString() ?? "none"}`);

    queueNotification({
      type: "subscription-cancelled",
      tenantId: sub.tenant_id,
      memberId: sub.member_id,
      subscriptionId: sub.id,
      metadata: {
        plan_name_snapshot: sub.plan_name_snapshot,
        billing_cycle_snapshot: sub.billing_cycle_snapshot,
        amount_snapshot: sub.amount_snapshot,
        currency_snapshot: sub.currency_snapshot,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end as any).toISOString()
          : undefined,
        grace_period_ends_at: gracePeriodEnd?.toISOString(),
      },
    }).catch(err => {
      logger.warn(`[sub-webhook] Failed to queue subscription-cancelled notification for sub ${sub.id}:`, err);
    });
  }

  private async handlePaused(sub: any, _entity: any, gracePeriodDays: number) {
    const gracePeriodEnd = gracePeriodDays > 0
      ? new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)
      : undefined;

    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "PAUSED" as tenant_subscription_status,
      paused_at: new Date(),
      grace_period_ends_at: gracePeriodEnd,
    });

    logger.info(`[sub-webhook] Subscription ${sub.id} paused, grace=${gracePeriodDays}d`);

    queueNotification({
      type: "subscription-paused",
      tenantId: sub.tenant_id,
      memberId: sub.member_id,
      subscriptionId: sub.id,
      metadata: {
        plan_name_snapshot: sub.plan_name_snapshot,
        billing_cycle_snapshot: sub.billing_cycle_snapshot,
        amount_snapshot: sub.amount_snapshot,
        currency_snapshot: sub.currency_snapshot,
      },
    }).catch(err => {
      logger.warn(`[sub-webhook] Failed to queue subscription-paused notification for sub ${sub.id}:`, err);
    });
  }

  private async handleResumed(sub: any, entity: any) {
    const periodStart = entity.current_start ? new Date(entity.current_start * 1000) : undefined;
    const periodEnd = entity.current_end ? new Date(entity.current_end * 1000) : undefined;
    const chargeAt = entity.charge_at ? new Date(entity.charge_at * 1000) : undefined;

    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "ACTIVE" as tenant_subscription_status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      next_charge_at: chargeAt,
      paused_at: undefined,
      grace_period_ends_at: undefined,
    });

    logger.info(`[sub-webhook] Subscription ${sub.id} resumed`);

    queueNotification({
      type: "subscription-resumed",
      tenantId: sub.tenant_id,
      memberId: sub.member_id,
      subscriptionId: sub.id,
      metadata: {
        plan_name_snapshot: sub.plan_name_snapshot,
        billing_cycle_snapshot: sub.billing_cycle_snapshot,
        amount_snapshot: sub.amount_snapshot,
        currency_snapshot: sub.currency_snapshot,
      },
    }).catch(err => {
      logger.warn(`[sub-webhook] Failed to queue subscription-resumed notification for sub ${sub.id}:`, err);
    });
  }

  private async handleCompleted(sub: any, _entity: any, gracePeriodDays: number) {
    const gracePeriodEnd = gracePeriodDays > 0
      ? new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)
      : undefined;

    await tenantUserSubscriptionsRepo.updateStatus(sub.tenant_id, sub.id, {
      status: "COMPLETED" as tenant_subscription_status,
      ended_at: new Date(),
      grace_period_ends_at: gracePeriodEnd,
    });

    logger.info(`[sub-webhook] Subscription ${sub.id} completed, grace=${gracePeriodDays}d`);

    queueNotification({
      type: "subscription-completed",
      tenantId: sub.tenant_id,
      memberId: sub.member_id,
      subscriptionId: sub.id,
      metadata: {
        plan_name_snapshot: sub.plan_name_snapshot,
        billing_cycle_snapshot: sub.billing_cycle_snapshot,
        amount_snapshot: sub.amount_snapshot,
        currency_snapshot: sub.currency_snapshot,
      },
    }).catch(err => {
      logger.warn(`[sub-webhook] Failed to queue subscription-completed notification for sub ${sub.id}:`, err);
    });
  }

  // ─── Access Check ─────────────────────────────────────────────────────────

  /**
   * Lightweight helper: does this member have an active subscription?
   * Uses checkSubscriptionAccess() under the hood (respects grace periods).
   */
  async hasActiveSubscription(tenantId: string, memberId: string): Promise<boolean> {
    const result = await this.checkSubscriptionAccess(tenantId, memberId);
    return result.hasAccess;
  }


  async checkSubscriptionAccess(tenantId: string, memberId: string) {
    // Fetch settings for subscriptionsEnabled + subscriptionName
    const settings = await db
      .selectFrom("tenant_subscription_settings")
      .select(["is_enabled", "subscription_name"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const subscriptionsEnabled = settings?.is_enabled ?? false;
    const subscriptionName = settings?.subscription_name ?? null;

    const sub = await tenantUserSubscriptionsRepo.findByMemberId(tenantId, memberId);
    if (!sub) return { hasAccess: false, subscription: null, isGracePeriod: false, subscriptionsEnabled, subscriptionName };

    const now = new Date();

    if (sub.status === "ACTIVE") {
      return { hasAccess: true, subscription: sub, isGracePeriod: false, subscriptionsEnabled, subscriptionName };
    }

    // Check grace period for non-active statuses
    if (
      sub.grace_period_ends_at &&
      now < new Date(sub.grace_period_ends_at as any) &&
      ["PENDING", "HALTED", "CANCELLED", "PAUSED", "COMPLETED"].includes(sub.status)
    ) {
      return {
        hasAccess: true,
        subscription: sub,
        isGracePeriod: true,
        gracePeriodEndsAt: sub.grace_period_ends_at,
        subscriptionsEnabled,
        subscriptionName,
      };
    }

    return { hasAccess: false, subscription: sub, isGracePeriod: false, subscriptionsEnabled, subscriptionName };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Compute the number of billing cycles to cover 10 years.
   * Razorpay requires total_count >= 1.
   */
  private computeTotalCount(billingCycle: string): number {
    const YEARS = 10;
    switch (billingCycle) {
      case "MONTHLY":
        return YEARS * 12; // 120
      case "YEARLY":
        return YEARS; // 10
      case "TWO_YEARLY":
        return Math.ceil(YEARS / 2); // 5
      default:
        return YEARS * 12; // fallback to monthly
    }
  }
}

export default new UserSubscriptionService();
