import { sql } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import {
  EntitlementConflict,
  EntitlementConflictError,
} from "../errors/entitlement-conflict.error";
import { NotFoundError } from "../errors/not-found.error";
import entitlementRepository from "../repositories/entitlement.repository";
import subscriptionRepository from "../repositories/subscription.repository";
import tenantRepository from "../repositories/tenant.repository";
import {
  BillingCycle,
  CancelSubscriptionRequest,
  CreateSubscriptionRequest,
  Currency,
  GlobalSubscriptionListResponse,
  GlobalSubscriptionQueryParams,
  SubscriptionListResponse,
  SubscriptionQueryParams,
  SubscriptionResponse,
  UpgradeSubscriptionRequest,
} from "../types/tenant.type";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";
import logger from "../utils/logger";

class SubscriptionService {
  /**
   * List all subscriptions across all tenants (global view)
   */
  async listAllSubscriptions(
    params: GlobalSubscriptionQueryParams
  ): Promise<GlobalSubscriptionListResponse> {
    const page = params.page || 1;
    const limit = params.limit || 50;

    const { subscriptions, total } = await subscriptionRepository.findAll(params);

    return {
      data: subscriptions.map((s) => ({
        ...this.mapToResponse(s),
        tenant_name: s.tenant_name,
        tenant_slug: s.tenant_slug,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * List subscriptions for a tenant
   */
  async listSubscriptions(
    tenantId: string,
    params: SubscriptionQueryParams
  ): Promise<SubscriptionListResponse> {
    // Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    const page = params.page || 1;
    const limit = params.limit || 50;

    const { subscriptions, total } = await subscriptionRepository.findByTenant(
      tenantId,
      params
    );

    return {
      data: subscriptions.map((s) => this.mapToResponse(s)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Assign plan to tenant (create subscription)
   * This is the KEY transactional operation that:
   * 1. Pre-flight: Checks entitlement usage compatibility with new plan
   * 2. In a single transaction: cancels old subscription (if replacing),
   *    creates new subscription, reconciles app access, creates entitlements
   *    with usage carried over from matching old entitlements
   *
   * If existing usage exceeds new plan limits and force !== true,
   * throws EntitlementConflictError with detailed conflict breakdown.
   */
  async assignPlanToTenant(
    tenantId: string,
    data: CreateSubscriptionRequest,
    actor: AuditActor
  ): Promise<SubscriptionResponse> {
    // Verify tenant exists and is active
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    if (tenant.status !== "ACTIVE" && tenant.status !== "PENDING") {
      throw new BadRequestError(`Cannot create subscription for ${tenant.status.toLowerCase()} tenant`);
    }

    // Check for existing blocking subscription (ACTIVE or TRIALING)
    // If one exists, it will be cancelled and replaced within the transaction below.
    const existingBlocking =
      await subscriptionRepository.findBlockingSubscriptionByTenant(tenantId);

    // Get plan version details
    const planVersion = await subscriptionRepository.getPlanVersion(data.plan_version_id);
    if (!planVersion) {
      throw new NotFoundError(`Plan version '${data.plan_version_id}' not found`);
    }

    // Note: Inactive plan versions are allowed, admin discretion.
    // The plan version may have been retired but the admin can still assign it.

    // Get new plan version products and applications
    const newProducts = await subscriptionRepository.getPlanVersionProducts(data.plan_version_id);
    const newPlanApps = await subscriptionRepository.getPlanApplications(planVersion.plan_id);

    // ── Pre-flight: Read actual usage from counters & check compatibility ──
    // Usage is tracked independently in tenant_usage_counters, so we read
    // from there instead of entitlements.used_value.
    const usageMap = await this.getUsageFromCounters(tenantId);

    const usageForConflicts = newProducts.map((p) => ({
      feature_key: p.feature_key,
      product_code: p.product_code,
      application_code: p.application_code,
      used_value: usageMap.get(p.product_code) ?? 0,
    }));

    const conflicts = this.detectEntitlementConflicts(usageForConflicts, newProducts);
    if (conflicts.length > 0 && !data.force) {
      throw new EntitlementConflictError(conflicts);
    }

    // ── Price & period calculation ──────────────────────────────────────
    const originalPrice = this.getPrice(planVersion, data.billing_cycle, data.currency);
    const discountApplied = 0; // TODO: Apply discount codes/promotions
    const finalPrice = originalPrice - discountApplied;

    const now = new Date();
    let trialEndsAt: Date | null = null;
    let periodStart = now;
    let periodEnd = this.calculatePeriodEnd(now, data.billing_cycle);

    if (data.is_trial && data.trial_ends_at) {
      trialEndsAt = new Date(data.trial_ends_at);
      periodEnd = trialEndsAt;
    }

    // Custom validity range overrides the billing-cycle-derived period.
    if (data.valid_from) {
      periodStart = new Date(data.valid_from);
    }
    if (data.valid_to) {
      periodEnd = new Date(data.valid_to);
    }
    if (periodEnd <= periodStart) {
      throw new BadRequestError(
        "Subscription validity end must be after the start date"
      );
    }

    const subscriptionId = ulid();

    // ── Single atomic transaction ───────────────────────────────────────
    const subscription = await db.transaction().execute(async (trx) => {
      // Serialise against any other entitlement writer for this tenant (another
      // plan change, or a plan-level entitlement sync, plan-entitlement-sync
      // .service.ts takes the SAME key). Without it, two writers racing under
      // READ COMMITTED can both pass their existence checks and insert duplicate
      // active entitlements for the same product, since (tenant_id, product_code)
      // has no unique constraint. Transaction scoped, released on commit.
      await sql`SELECT pg_advisory_xact_lock(hashtext(${
        `tenant-entitlements:${tenantId}`
      }))`.execute(trx);

      // 1. Archive ALL active PLAN-sourced entitlements for the tenant
      // (catches orphaned entitlements from previous cycles, not just the current subscription)
      await entitlementRepository.archiveAllPlanEntitlements(tenantId, trx);

      // 2. Cancel old subscription if replacing
      if (existingBlocking) {
        await subscriptionRepository.update(
          existingBlocking.id,
          {
            status: "CANCELLED",
            cancelled_at: now,
            cancel_effective_at: now,
            updated_at: now,
          },
          trx
        );
        // Cancel SUBSCRIPTION-sourced apps from old subscription
        await subscriptionRepository.updateTenantApplicationsBySubscription(
          existingBlocking.id,
          "CANCELLED",
          trx
        );
      }

      // 3. Create subscription record
      const subscription = await subscriptionRepository.create(
        {
          id: subscriptionId,
          tenant_id: tenantId,
          plan_version_id: data.plan_version_id,
          plan_code_snapshot: planVersion.plan_code,
          plan_name_snapshot: planVersion.plan_name,
          plan_version_snapshot: planVersion.version,
          billing_cycle: data.billing_cycle,
          currency: data.currency,
          original_price: originalPrice,
          discount_applied: discountApplied,
          price_snapshot: finalPrice,
          external_subscription_id: data.external_subscription_id,
          external_customer_id: data.external_customer_id,
          started_at: now,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          status: data.is_trial ? "TRIALING" : "ACTIVE",
          created_at: now,
          updated_at: now,
        },
        trx
      );

      // 4. Reconcile tenant applications from plan records
      // After cancelling old sub's apps above, only non-subscription apps
      // (ADMIN_GRANT, ADMIN_TRIAL, PROMO) remain active. For each application
      // in the new plan: skip if already active, reactivate if cancelled/suspended,
      // or create new if no record exists.
      const newAppStatus = data.is_trial ? "TRIALING" : "ACTIVE";
      for (const app of newPlanApps) {
        const existingApp = await subscriptionRepository.findTenantApplication(
          tenantId,
          app.application_id,
          trx
        );

        if (!existingApp) {
          // No record at all, create new
          await subscriptionRepository.createTenantApplication(
            {
              id: ulid(),
              tenant_id: tenantId,
              application_id: app.application_id,
              status: newAppStatus,
              source: "SUBSCRIPTION",
              source_subscription_id: subscription.id,
              trial_ends_at: trialEndsAt,
              created_at: now,
              updated_at: now,
            },
            trx
          );
        } else if (existingApp.status !== "ACTIVE" && existingApp.status !== "TRIALING") {
          // Record exists but is CANCELLED/SUSPENDED, reactivate with new subscription
          await subscriptionRepository.reactivateTenantApplication(
            existingApp.id,
            {
              status: newAppStatus,
              source: "SUBSCRIPTION",
              source_subscription_id: subscription.id,
              trial_ends_at: trialEndsAt,
            },
            trx
          );
        }
        // else: already ACTIVE/TRIALING (from another source), skip
      }

      // 5. Create entitlements (used_value=0, usage is tracked in tenant_usage_counters)
      //    Skip if an ADMIN or ADDON entitlement already exists for the product
      let createdEntitlementCount = 0;
      for (const pvp of newProducts) {
        const existingNonPlan = await entitlementRepository.findByTenantAndProduct(
          tenantId, pvp.product_code, trx
        );
        if (existingNonPlan) {
          logger.info(
            `Skipping PLAN entitlement for '${pvp.product_code}', ` +
            `${existingNonPlan.source}-sourced entitlement '${existingNonPlan.id}' already active`
          );
          continue;
        }
        await entitlementRepository.create(
          {
            id: ulid(),
            tenant_id: tenantId,
            product_id: pvp.product_id,
            application_code: pvp.application_code,
            feature_key: pvp.feature_key,
            product_code: pvp.product_code,
            is_unlimited: pvp.is_unlimited,
            limit_value: pvp.limit_value,
            used_value: 0,
            source: "PLAN",
            source_subscription_id: subscription.id,
            source_plan_version_id: data.plan_version_id,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
          trx
        );
        createdEntitlementCount++;
      }

      logger.info(
        `Assigned plan '${planVersion.plan_code}' v${planVersion.version} to tenant '${tenantId}'. ` +
          `Created ${newPlanApps.length} app accesses and ${createdEntitlementCount}/${newProducts.length} entitlements.` +
          (existingBlocking ? ` Replaced subscription '${existingBlocking.id}'.` : "")
      );

      return subscription;
    });

    // Record the audit trail AFTER the transaction commits. Kept out of the
    // transaction so a slow/failed audit write can never delay the response or
    // roll back the plan assignment (auditService.record is fire-and-forget).
    await auditService.record({
      actor,
      action: "SUBSCRIPTION_ASSIGNED",
      category: "SUBSCRIPTION",
      resourceId: subscription.id,
      resourceLabel: `${planVersion.plan_name} v${planVersion.version}`,
      tenantId,
      summary: `Assigned plan ${planVersion.plan_name} (v${planVersion.version}) to tenant ${tenant.name}`,
      metadata: {
        plan_code: planVersion.plan_code,
        plan_version: planVersion.version,
        billing_cycle: data.billing_cycle,
        currency: data.currency,
        is_trial: !!data.is_trial,
        valid_from: periodStart,
        valid_to: periodEnd,
        replaced_subscription_id: existingBlocking?.id ?? null,
      },
    });

    return {
      ...this.mapToResponse(subscription),
      plan_version: {
        id: planVersion.id,
        plan_id: planVersion.plan_id,
        plan_code: planVersion.plan_code,
        plan_name: planVersion.plan_name,
        version: planVersion.version,
        is_active: planVersion.is_active,
      },
    };
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(
    tenantId: string,
    subscriptionId: string
  ): Promise<SubscriptionResponse> {
    const subscription = await subscriptionRepository.findByIdAndTenant(
      subscriptionId,
      tenantId
    );
    if (!subscription) {
      throw new NotFoundError(`Subscription with ID '${subscriptionId}' not found`);
    }

    // Get plan version
    const planVersion = await subscriptionRepository.getPlanVersion(
      subscription.plan_version_id
    );

    return {
      ...this.mapToResponse(subscription),
      plan_version: planVersion
        ? {
            id: planVersion.id,
            plan_id: planVersion.plan_id,
            plan_code: planVersion.plan_code,
            plan_name: planVersion.plan_name,
            version: planVersion.version,
            is_active: planVersion.is_active,
          }
        : undefined,
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    tenantId: string,
    subscriptionId: string,
    data: CancelSubscriptionRequest,
    actor: AuditActor
  ): Promise<SubscriptionResponse> {
    const subscription = await subscriptionRepository.findByIdAndTenant(
      subscriptionId,
      tenantId
    );
    if (!subscription) {
      throw new NotFoundError(`Subscription with ID '${subscriptionId}' not found`);
    }

    if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") {
      throw new BadRequestError("Subscription is already cancelled or expired");
    }

    const now = new Date();
    const cancelEffectiveAt = data.cancel_immediately
      ? now
      : subscription.current_period_end;

    // Execute in transaction
    await db.transaction().execute(async (trx) => {
      // 1. Update subscription
      await subscriptionRepository.update(
        subscriptionId,
        {
          status: data.cancel_immediately ? "CANCELLED" : subscription.status,
          cancelled_at: now,
          cancel_effective_at: cancelEffectiveAt,
          updated_at: now,
        },
        trx
      );

      // 2. If immediate cancellation, archive entitlements and suspend app access
      if (data.cancel_immediately) {
        await entitlementRepository.archiveAllPlanEntitlements(tenantId, trx);
        await subscriptionRepository.updateTenantApplicationsBySubscription(
          subscriptionId,
          "CANCELLED",
          trx
        );
      }
    });

    // If immediate cancellation, suspend the tenant
    if (data.cancel_immediately) {
      await db
        .updateTable("tenants")
        .set({ status: "SUSPENDED" as const, updated_at: new Date() })
        .where("id", "=", tenantId)
        .execute();
    }

    const updated = await subscriptionRepository.findById(subscriptionId);

    logger.info(
      `Cancelled subscription '${subscriptionId}' for tenant '${tenantId}'. ` +
        `Effective: ${data.cancel_immediately ? "immediately" : "end of period"}`
    );

    await auditService.record({
      actor,
      action: "SUBSCRIPTION_CANCELLED",
      category: "SUBSCRIPTION",
      resourceId: subscriptionId,
      resourceLabel: `${subscription.plan_name_snapshot} v${subscription.plan_version_snapshot}`,
      tenantId,
      summary: `Cancelled subscription ${subscription.plan_name_snapshot} for tenant ${tenantId}`,
      metadata: {
        cancel_immediately: !!data.cancel_immediately,
        reason: data.reason ?? null,
      },
    });

    return this.mapToResponse(updated!);
  }

  /**
   * Upgrade subscription to new plan version.
   * Preserves used_value honestly (no capping). If usage exceeds new limits
   * and force !== true, throws EntitlementConflictError with details.
   * Also reconciles application access between old and new plans.
   */
  async upgradeSubscription(
    tenantId: string,
    subscriptionId: string,
    data: UpgradeSubscriptionRequest,
    actor: AuditActor
  ): Promise<SubscriptionResponse> {
    const subscription = await subscriptionRepository.findByIdAndTenant(
      subscriptionId,
      tenantId
    );
    if (!subscription) {
      throw new NotFoundError(`Subscription with ID '${subscriptionId}' not found`);
    }

    if (subscription.status !== "ACTIVE" && subscription.status !== "TRIALING") {
      throw new BadRequestError("Can only upgrade active or trialing subscriptions");
    }

    // Get new plan version
    const newPlanVersion = await subscriptionRepository.getPlanVersion(
      data.new_plan_version_id
    );
    if (!newPlanVersion) {
      throw new NotFoundError(`Plan version '${data.new_plan_version_id}' not found`);
    }

    if (!newPlanVersion.is_active) {
      throw new BadRequestError("Cannot upgrade to an inactive plan version");
    }

    // Get new plan products and applications
    const newProducts = await subscriptionRepository.getPlanVersionProducts(data.new_plan_version_id);
    const newPlanApps = await subscriptionRepository.getPlanApplications(newPlanVersion.plan_id);

    // ── Pre-flight: Read actual usage from counters & check compatibility ──
    const upgradeUsageMap = await this.getUsageFromCounters(tenantId);
    const upgradeUsageForConflicts = newProducts.map((p) => ({
      feature_key: p.feature_key,
      product_code: p.product_code,
      application_code: p.application_code,
      used_value: upgradeUsageMap.get(p.product_code) ?? 0,
    }));

    const upgradeConflicts = this.detectEntitlementConflicts(upgradeUsageForConflicts, newProducts);
    if (upgradeConflicts.length > 0 && !data.force) {
      throw new EntitlementConflictError(upgradeConflicts);
    }

    const now = new Date();

    // Execute in transaction
    await db.transaction().execute(async (trx) => {
      // Same per-tenant entitlement-writer lock as assignPlanToTenant and the
      // plan-level entitlement sync; see the comment there.
      await sql`SELECT pg_advisory_xact_lock(hashtext(${
        `tenant-entitlements:${tenantId}`
      }))`.execute(trx);

      // 1. Archive ALL active PLAN-sourced entitlements for the tenant
      await entitlementRepository.archiveAllPlanEntitlements(tenantId, trx);

      // 2. Cancel old subscription's SUBSCRIPTION-sourced apps, then create new ones
      await subscriptionRepository.updateTenantApplicationsBySubscription(
        subscriptionId,
        "CANCELLED",
        trx
      );

      for (const app of newPlanApps) {
        const existingApp = await subscriptionRepository.tenantHasApplication(
          tenantId,
          app.application_id,
          trx
        );
        if (!existingApp) {
          await subscriptionRepository.createTenantApplication(
            {
              id: ulid(),
              tenant_id: tenantId,
              application_id: app.application_id,
              status: "ACTIVE",
              source: "SUBSCRIPTION",
              source_subscription_id: subscriptionId,
              created_at: now,
              updated_at: now,
            },
            trx
          );
        }
      }

      // 3. Create new entitlements (used_value=0, usage tracked in counters)
      //    Skip if an ADMIN or ADDON entitlement already exists for the product
      for (const pvp of newProducts) {
        const existingNonPlan = await entitlementRepository.findByTenantAndProduct(
          tenantId, pvp.product_code, trx
        );
        if (existingNonPlan) {
          logger.info(
            `[upgrade] Skipping PLAN entitlement for '${pvp.product_code}', ` +
            `${existingNonPlan.source}-sourced entitlement '${existingNonPlan.id}' already active`
          );
          continue;
        }
        await entitlementRepository.create(
          {
            id: ulid(),
            tenant_id: tenantId,
            product_id: pvp.product_id,
            application_code: pvp.application_code,
            feature_key: pvp.feature_key,
            product_code: pvp.product_code,
            is_unlimited: pvp.is_unlimited,
            limit_value: pvp.limit_value,
            used_value: 0,
            source: "PLAN",
            source_subscription_id: subscriptionId,
            source_plan_version_id: data.new_plan_version_id,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
          trx
        );
      }

      // 4. Update subscription with new plan version
      await subscriptionRepository.update(
        subscriptionId,
        {
          // Note: We don't update plan_version_id in subscription to preserve history
          // Instead, we update snapshots
          updated_at: now,
        },
        trx
      );
    });

    const updated = await subscriptionRepository.findById(subscriptionId);

    logger.info(
      `Upgraded subscription '${subscriptionId}' for tenant '${tenantId}' ` +
        `to plan version '${data.new_plan_version_id}'`
    );

    await auditService.record({
      actor,
      action: "SUBSCRIPTION_UPGRADED",
      category: "SUBSCRIPTION",
      resourceId: subscriptionId,
      resourceLabel: `${newPlanVersion.plan_name} v${newPlanVersion.version}`,
      tenantId,
      summary: `Upgraded subscription for tenant ${tenantId} to ${newPlanVersion.plan_name} (v${newPlanVersion.version})`,
      metadata: {
        new_plan_version_id: data.new_plan_version_id,
        plan_code: newPlanVersion.plan_code,
        plan_version: newPlanVersion.version,
      },
    });

    return this.mapToResponse(updated!);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async getUsageFromCounters(tenantId: string): Promise<Map<string, number>> {
    return entitlementRepository.getUsageCounters(tenantId);
  }

  /**
   * Compare old entitlement usage against new plan limits.
   * Returns conflicts where:
   *  - used_value > new limit (and new product is not unlimited)
   *  - feature exists in old plan with usage > 0 but is absent from new plan
   */
  private detectEntitlementConflicts(
    oldEntitlements: { feature_key: string; product_code: string; application_code: string; used_value: number }[],
    newProducts: { feature_key: string; product_code: string; application_code: string; limit_value: number; is_unlimited: boolean }[]
  ): EntitlementConflict[] {
    const conflicts: EntitlementConflict[] = [];

    // Check each new product against existing usage (match by product_code, not feature_key)
    for (const np of newProducts) {
      const old = oldEntitlements.find((e) => e.product_code === np.product_code);
      if (old && !np.is_unlimited && old.used_value > np.limit_value) {
        conflicts.push({
          feature_key: np.feature_key,
          product_code: np.product_code,
          application_code: np.application_code,
          current_used: old.used_value,
          new_limit: np.limit_value,
          dropped: false,
        });
      }
    }

    // Check for products dropping off entirely (old plan has usage, new plan doesn't include them)
    for (const old of oldEntitlements) {
      const existsInNew = newProducts.some((p) => p.product_code === old.product_code);
      if (!existsInNew && old.used_value > 0) {
        conflicts.push({
          feature_key: old.feature_key,
          product_code: old.product_code,
          application_code: old.application_code,
          current_used: old.used_value,
          new_limit: 0,
          dropped: true,
        });
      }
    }

    return conflicts;
  }

  private getPrice(
    planVersion: {
      price_monthly_inr: number;
      price_yearly_inr: number;
      price_monthly_usd: number;
      price_yearly_usd: number;
    },
    billingCycle: BillingCycle,
    currency: Currency
  ): number {
    if (currency === "INR") {
      return billingCycle === "MONTHLY"
        ? planVersion.price_monthly_inr
        : planVersion.price_yearly_inr;
    }
    return billingCycle === "MONTHLY"
      ? planVersion.price_monthly_usd
      : planVersion.price_yearly_usd;
  }

  private calculatePeriodEnd(start: Date, billingCycle: BillingCycle): Date {
    const end = new Date(start);
    if (billingCycle === "MONTHLY") {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 1);
    }
    return end;
  }

  private mapToResponse(subscription: {
    id: string;
    tenant_id: string;
    plan_version_id: string;
    plan_code_snapshot: string;
    plan_name_snapshot: string;
    plan_version_snapshot: number;
    billing_cycle: BillingCycle;
    currency: Currency;
    original_price: number;
    discount_applied: number;
    price_snapshot: number;
    external_subscription_id: string | null;
    external_customer_id: string | null;
    started_at: Date;
    current_period_start: Date;
    current_period_end: Date;
    cancelled_at: Date | null;
    cancel_effective_at: Date | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  }): SubscriptionResponse {
    return {
      id: subscription.id,
      tenant_id: subscription.tenant_id,
      plan_version_id: subscription.plan_version_id,
      plan_code_snapshot: subscription.plan_code_snapshot,
      plan_name_snapshot: subscription.plan_name_snapshot,
      plan_version_snapshot: subscription.plan_version_snapshot,
      billing_cycle: subscription.billing_cycle,
      currency: subscription.currency,
      original_price: subscription.original_price,
      discount_applied: subscription.discount_applied,
      price_snapshot: subscription.price_snapshot,
      external_subscription_id: subscription.external_subscription_id,
      external_customer_id: subscription.external_customer_id,
      started_at: subscription.started_at,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancelled_at: subscription.cancelled_at,
      cancel_effective_at: subscription.cancel_effective_at,
      status: subscription.status as SubscriptionResponse["status"],
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
    };
  }

}

export default new SubscriptionService();
