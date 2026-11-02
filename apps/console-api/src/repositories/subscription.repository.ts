import { Transaction } from "kysely";
import { db } from "../db/connection";
import {
    subscription_status,
    tenant_app_status,
} from "../db/enums";
import { DB } from "../db/types";
import {
    BillingCycle,
    Currency,
    GlobalSubscriptionQueryParams,
    SubscriptionQueryParams,
    SubscriptionStatus,
    TenantAppSource,
    TenantAppStatus,
} from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

interface Subscription {
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
  billing_provider_id: string | null;
  external_subscription_id: string | null;
  external_customer_id: string | null;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  cancelled_at: Date | null;
  cancel_effective_at: Date | null;
  status: SubscriptionStatus;
  created_at: Date;
  updated_at: Date;
}

interface SubscriptionInsert {
  id: string;
  tenant_id: string;
  plan_version_id: string;
  plan_code_snapshot: string;
  plan_name_snapshot: string;
  plan_version_snapshot: number;
  billing_cycle: BillingCycle;
  currency: Currency;
  original_price: number;
  discount_applied?: number;
  price_snapshot: number;
  billing_provider_id?: string | null;
  external_subscription_id?: string | null;
  external_customer_id?: string | null;
  started_at?: Date;
  current_period_start?: Date;
  current_period_end: Date;
  status?: SubscriptionStatus;
  created_at: Date;
  updated_at: Date;
}

interface SubscriptionUpdate {
  status?: SubscriptionStatus;
  current_period_start?: Date;
  current_period_end?: Date;
  cancelled_at?: Date | null;
  cancel_effective_at?: Date | null;
  external_subscription_id?: string | null;
  external_customer_id?: string | null;
  updated_at?: Date;
}

interface TenantApplication {
  id: string;
  tenant_id: string;
  application_id: string;
  status: TenantAppStatus;
  source: TenantAppSource;
  source_subscription_id: string | null;
  granted_by: string | null;
  grant_reason: string | null;
  activated_at: Date;
  suspended_at: Date | null;
  trial_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TenantApplicationInsert {
  id: string;
  tenant_id: string;
  application_id: string;
  status?: TenantAppStatus;
  source: TenantAppSource;
  source_subscription_id?: string | null;
  granted_by?: string | null;
  grant_reason?: string | null;
  activated_at?: Date;
  trial_ends_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface SubscriptionWithTenant extends Subscription {
  tenant_name: string;
  tenant_slug: string;
}

/**
 * One live subscription on a plan, joined with the tenant and the plan version
 * it snapshotted from. Used by the plan-level entitlement sync to enumerate
 * "who is currently on this plan" in a single query.
 */
export interface PlanSubscriber {
  subscription_id: string;
  subscription_status: SubscriptionStatus;
  /** Doubles as the trial end for TRIALING subscriptions (see assignPlanToTenant). */
  current_period_end: Date;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_status: string;
  plan_version_id: string;
  plan_version: number;
}

interface PlanVersionProduct {
  product_id: string;
  product_code: string;
  product_constraint_type: string;
  product_unit: string | null;
  product_is_hard_limit: boolean;
  feature_id: string;
  feature_key: string;
  application_id: string;
  application_code: string;
  limit_value: number;
  is_unlimited: boolean;
}

// ============================================
// REPOSITORY
// ============================================

class SubscriptionRepository {
  /**
   * Find subscription by ID
   */
  async findById(id: string): Promise<Subscription | null> {
    const subscription = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return subscription ? this.mapToSubscription(subscription) : null;
  }

  /**
   * Find subscription by ID and tenant
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<Subscription | null> {
    const subscription = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    return subscription ? this.mapToSubscription(subscription) : null;
  }

  /**
   * Find active subscription for tenant
   */
  async findActiveByTenant(tenantId: string): Promise<Subscription | null> {
    const subscription = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "ACTIVE")
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    return subscription ? this.mapToSubscription(subscription) : null;
  }

  /**
   * Find subscription that blocks creating a new one (ACTIVE or TRIALING)
   */
  async findBlockingSubscriptionByTenant(
    tenantId: string
  ): Promise<Subscription | null> {
    const subscription = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    return subscription ? this.mapToSubscription(subscription) : null;
  }

  /**
   * List subscriptions for tenant
   */
  async findByTenant(
    tenantId: string,
    params: SubscriptionQueryParams
  ): Promise<{ subscriptions: Subscription[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = db.selectFrom("subscriptions").where("tenant_id", "=", tenantId);
    let countQuery = db
      .selectFrom("subscriptions")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId);

    // Apply filters
    if (params.status) {
      query = query.where("status", "=", params.status);
      countQuery = countQuery.where("status", "=", params.status);
    }

    // Execute queries
    const [subscriptions, countResult] = await Promise.all([
      query
        .selectAll()
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      subscriptions: subscriptions.map((s) => this.mapToSubscription(s)),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * List all subscriptions across all tenants (global view)
   */
  async findAll(
    params: GlobalSubscriptionQueryParams
  ): Promise<{ subscriptions: SubscriptionWithTenant[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("subscriptions")
      .innerJoin("tenants", "subscriptions.tenant_id", "tenants.id");

    let countQuery = db
      .selectFrom("subscriptions")
      .innerJoin("tenants", "subscriptions.tenant_id", "tenants.id")
      .select(db.fn.countAll().as("count"));

    // Apply filters
    if (params.status) {
      query = query.where("subscriptions.status", "=", params.status);
      countQuery = countQuery.where("subscriptions.status", "=", params.status);
    }

    if (params.billing_cycle) {
      query = query.where("subscriptions.billing_cycle", "=", params.billing_cycle);
      countQuery = countQuery.where("subscriptions.billing_cycle", "=", params.billing_cycle);
    }

    if (params.currency) {
      query = query.where("subscriptions.currency", "=", params.currency);
      countQuery = countQuery.where("subscriptions.currency", "=", params.currency);
    }

    if (params.search?.trim()) {
      const searchPattern = `%${params.search.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("tenants.name", "ilike", searchPattern),
          eb("tenants.slug", "ilike", searchPattern),
          eb("subscriptions.plan_name_snapshot", "ilike", searchPattern),
          eb("subscriptions.plan_code_snapshot", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("tenants.name", "ilike", searchPattern),
          eb("tenants.slug", "ilike", searchPattern),
          eb("subscriptions.plan_name_snapshot", "ilike", searchPattern),
          eb("subscriptions.plan_code_snapshot", "ilike", searchPattern),
        ])
      );
    }

    const [subscriptions, countResult] = await Promise.all([
      query
        .select([
          "subscriptions.id",
          "subscriptions.tenant_id",
          "subscriptions.plan_version_id",
          "subscriptions.plan_code_snapshot",
          "subscriptions.plan_name_snapshot",
          "subscriptions.plan_version_snapshot",
          "subscriptions.billing_cycle",
          "subscriptions.currency",
          "subscriptions.original_price",
          "subscriptions.discount_applied",
          "subscriptions.price_snapshot",
          "subscriptions.billing_provider_id",
          "subscriptions.external_subscription_id",
          "subscriptions.external_customer_id",
          "subscriptions.started_at",
          "subscriptions.current_period_start",
          "subscriptions.current_period_end",
          "subscriptions.cancelled_at",
          "subscriptions.cancel_effective_at",
          "subscriptions.status",
          "subscriptions.created_at",
          "subscriptions.updated_at",
          "tenants.name as tenant_name",
          "tenants.slug as tenant_slug",
        ])
        .orderBy("subscriptions.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      subscriptions: subscriptions.map((s) => ({
        ...this.mapToSubscription(s),
        tenant_name: s.tenant_name as string,
        tenant_slug: s.tenant_slug as string,
      })),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * Find every live subscription sitting on a plan, across ALL of its versions.
   *
   * Plan scoped by construction: the join filters on `plan_versions.plan_id`,
   * so a run can never touch a tenant subscribed to a different plan.
   * One tenant can legitimately appear once only, since a tenant may hold at
   * most one ACTIVE/TRIALING subscription (see findBlockingSubscriptionByTenant),
   * but we still order deterministically and let the caller dedupe.
   */
  async findSubscribersByPlan(
    planId: string,
    options?: { statuses?: SubscriptionStatus[]; versionIds?: string[] }
  ): Promise<PlanSubscriber[]> {
    const statuses = options?.statuses?.length
      ? options.statuses
      : (["ACTIVE", "TRIALING"] as SubscriptionStatus[]);

    let query = db
      .selectFrom("subscriptions")
      .innerJoin("plan_versions", "subscriptions.plan_version_id", "plan_versions.id")
      .innerJoin("tenants", "subscriptions.tenant_id", "tenants.id")
      .select([
        "subscriptions.id as subscription_id",
        "subscriptions.status as subscription_status",
        "subscriptions.current_period_end as current_period_end",
        "subscriptions.tenant_id as tenant_id",
        "tenants.name as tenant_name",
        "tenants.slug as tenant_slug",
        "tenants.status as tenant_status",
        "plan_versions.id as plan_version_id",
        "plan_versions.version as plan_version",
      ])
      .where("plan_versions.plan_id", "=", planId)
      .where("subscriptions.status", "in", statuses as subscription_status[]);

    if (options?.versionIds?.length) {
      query = query.where("subscriptions.plan_version_id", "in", options.versionIds);
    }

    const rows = await query
      .orderBy("tenants.name", "asc")
      .orderBy("subscriptions.created_at", "desc")
      .execute();

    return rows.map((row) => ({
      subscription_id: row.subscription_id,
      subscription_status: row.subscription_status as SubscriptionStatus,
      current_period_end: row.current_period_end as Date,
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      tenant_slug: row.tenant_slug,
      tenant_status: row.tenant_status as string,
      plan_version_id: row.plan_version_id,
      plan_version: row.plan_version,
    }));
  }

  /**
   * Create subscription
   */
  async create(data: SubscriptionInsert, trx?: Transaction<DB>): Promise<Subscription> {
    const executor = trx || db;
    const now = new Date();

    const subscription = await executor
      .insertInto("subscriptions")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        plan_version_id: data.plan_version_id,
        plan_code_snapshot: data.plan_code_snapshot,
        plan_name_snapshot: data.plan_name_snapshot,
        plan_version_snapshot: data.plan_version_snapshot,
        billing_cycle: data.billing_cycle,
        currency: data.currency,
        original_price: data.original_price.toString(),
        discount_applied: (data.discount_applied || 0).toString(),
        price_snapshot: data.price_snapshot.toString(),
        billing_provider_id: data.billing_provider_id || null,
        external_subscription_id: data.external_subscription_id || null,
        external_customer_id: data.external_customer_id || null,
        started_at: data.started_at || now,
        current_period_start: data.current_period_start || now,
        current_period_end: data.current_period_end,
        status: (data.status || subscription_status.ACTIVE) as subscription_status,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToSubscription(subscription);
  }

  /**
   * Update subscription
   */
  async update(id: string, data: SubscriptionUpdate, trx?: Transaction<DB>): Promise<Subscription | null> {
    const executor = trx || db;

    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at || new Date(),
    };

    if (data.status !== undefined) updateData.status = data.status;
    if (data.current_period_start !== undefined) updateData.current_period_start = data.current_period_start;
    if (data.current_period_end !== undefined) updateData.current_period_end = data.current_period_end;
    if (data.cancelled_at !== undefined) updateData.cancelled_at = data.cancelled_at;
    if (data.cancel_effective_at !== undefined) updateData.cancel_effective_at = data.cancel_effective_at;
    if (data.external_subscription_id !== undefined) updateData.external_subscription_id = data.external_subscription_id;
    if (data.external_customer_id !== undefined) updateData.external_customer_id = data.external_customer_id;

    const subscription = await executor
      .updateTable("subscriptions")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return subscription ? this.mapToSubscription(subscription) : null;
  }

  // ============================================
  // PLAN VERSION PRODUCTS (for entitlement creation)
  // ============================================

  /**
   * Get plan version products with full product/feature/application details
   * This is used when creating entitlements from a subscription
   */
  async getPlanVersionProducts(planVersionId: string, trx?: Transaction<DB>): Promise<PlanVersionProduct[]> {
    const executor = trx || db;

    const results = await executor
      .selectFrom("plan_version_products")
      .innerJoin("products", "plan_version_products.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id")
      .innerJoin("applications", "features.application_id", "applications.id")
      .select([
        "products.id as product_id",
        "products.code as product_code",
        "products.constraint_type as product_constraint_type",
        "products.unit as product_unit",
        "products.is_hard_limit as product_is_hard_limit",
        "features.id as feature_id",
        "features.key as feature_key",
        "applications.id as application_id",
        "applications.code as application_code",
        "plan_version_products.limit_value",
        "plan_version_products.is_unlimited",
      ])
      .where("plan_version_products.plan_version_id", "=", planVersionId)
      .execute();

    return results.map((r) => ({
      product_id: r.product_id,
      product_code: r.product_code,
      product_constraint_type: r.product_constraint_type,
      product_unit: r.product_unit,
      product_is_hard_limit: r.product_is_hard_limit,
      feature_id: r.feature_id,
      feature_key: r.feature_key,
      application_id: r.application_id,
      application_code: r.application_code,
      limit_value: r.limit_value,
      is_unlimited: r.is_unlimited,
    }));
  }

  /**
   * Get plan applications (which apps a plan covers)
   */
  async getPlanApplications(planId: string, trx?: Transaction<DB>): Promise<Array<{ application_id: string; application_code: string }>> {
    const executor = trx || db;

    const results = await executor
      .selectFrom("plan_applications")
      .innerJoin("applications", "plan_applications.application_id", "applications.id")
      .select([
        "applications.id as application_id",
        "applications.code as application_code",
      ])
      .where("plan_applications.plan_id", "=", planId)
      .execute();

    return results;
  }

  /**
   * Get plan version with plan details
   */
  async getPlanVersion(planVersionId: string, trx?: Transaction<DB>): Promise<{
    id: string;
    plan_id: string;
    plan_code: string;
    plan_name: string;
    version: number;
    price_monthly_inr: number;
    price_yearly_inr: number;
    price_monthly_usd: number;
    price_yearly_usd: number;
    is_active: boolean;
  } | null> {
    const executor = trx || db;

    const result = await executor
      .selectFrom("plan_versions")
      .innerJoin("plans", "plan_versions.plan_id", "plans.id")
      .select([
        "plan_versions.id",
        "plan_versions.plan_id",
        "plans.code as plan_code",
        "plans.name as plan_name",
        "plan_versions.version",
        "plan_versions.price_monthly_inr",
        "plan_versions.price_yearly_inr",
        "plan_versions.price_monthly_usd",
        "plan_versions.price_yearly_usd",
        "plan_versions.is_active",
      ])
      .where("plan_versions.id", "=", planVersionId)
      .executeTakeFirst();

    if (!result) return null;

    return {
      id: result.id,
      plan_id: result.plan_id,
      plan_code: result.plan_code,
      plan_name: result.plan_name,
      version: result.version,
      price_monthly_inr: Number(result.price_monthly_inr),
      price_yearly_inr: Number(result.price_yearly_inr),
      price_monthly_usd: Number(result.price_monthly_usd),
      price_yearly_usd: Number(result.price_yearly_usd),
      is_active: result.is_active,
    };
  }

  // ============================================
  // TENANT APPLICATIONS
  // ============================================

  /**
   * Create tenant application
   */
  async createTenantApplication(data: TenantApplicationInsert, trx?: Transaction<DB>): Promise<TenantApplication> {
    const executor = trx || db;
    const now = new Date();

    const tenantApp = await executor
      .insertInto("tenant_applications")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        application_id: data.application_id,
        status: (data.status || tenant_app_status.ACTIVE) as tenant_app_status,
        source: data.source,
        source_subscription_id: data.source_subscription_id || null,
        granted_by: data.granted_by || null,
        grant_reason: data.grant_reason || null,
        activated_at: data.activated_at || now,
        trial_ends_at: data.trial_ends_at || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToTenantApplication(tenantApp);
  }

  /**
   * Update tenant applications by subscription (e.g., on cancellation)
   */
  async updateTenantApplicationsBySubscription(
    subscriptionId: string,
    status: TenantAppStatus,
    trx?: Transaction<DB>
  ): Promise<number> {
    const executor = trx || db;

    const result = await executor
      .updateTable("tenant_applications")
      .set({
        status: status as tenant_app_status,
        suspended_at: status === "SUSPENDED" || status === "CANCELLED" ? new Date() : null,
        updated_at: new Date(),
      })
      .where("source_subscription_id", "=", subscriptionId)
      .execute();

    return result.length;
  }

  /**
   * Get tenant applications
   */
  async getTenantApplications(tenantId: string): Promise<TenantApplication[]> {
    const results = await db
      .selectFrom("tenant_applications")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .execute();

    return results.map((r) => this.mapToTenantApplication(r));
  }

  /**
   * Check if tenant has active application.
   * Accepts optional trx so it can see uncommitted changes within a transaction
   * (e.g., after cancelling old subscription's apps in the same transaction).
   */
  async tenantHasApplication(tenantId: string, applicationId: string, trx?: Transaction<DB>): Promise<boolean> {
    const executor = trx || db;

    const result = await executor
      .selectFrom("tenant_applications")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("application_id", "=", applicationId)
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Find tenant application record regardless of status.
   * Returns the row if it exists (even if CANCELLED/SUSPENDED), or undefined.
   */
  async findTenantApplication(
    tenantId: string,
    applicationId: string,
    trx?: Transaction<DB>
  ): Promise<TenantApplication | undefined> {
    const executor = trx || db;

    const result = await executor
      .selectFrom("tenant_applications")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("application_id", "=", applicationId)
      .executeTakeFirst();

    return result ? this.mapToTenantApplication(result) : undefined;
  }

  /**
   * Reactivate a cancelled/suspended tenant application with new subscription details.
   */
  async reactivateTenantApplication(
    id: string,
    data: {
      status: TenantAppStatus;
      source: TenantAppSource;
      source_subscription_id: string;
      trial_ends_at?: Date | null;
    },
    trx?: Transaction<DB>
  ): Promise<TenantApplication> {
    const executor = trx || db;
    const now = new Date();

    const result = await executor
      .updateTable("tenant_applications")
      .set({
        status: data.status as tenant_app_status,
        source: data.source,
        source_subscription_id: data.source_subscription_id,
        trial_ends_at: data.trial_ends_at || null,
        suspended_at: null,
        activated_at: now,
        updated_at: now,
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToTenantApplication(result);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToSubscription(row: Record<string, unknown>): Subscription {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      plan_version_id: row.plan_version_id as string,
      plan_code_snapshot: row.plan_code_snapshot as string,
      plan_name_snapshot: row.plan_name_snapshot as string,
      plan_version_snapshot: row.plan_version_snapshot as number,
      billing_cycle: row.billing_cycle as BillingCycle,
      currency: row.currency as Currency,
      original_price: Number(row.original_price),
      discount_applied: Number(row.discount_applied),
      price_snapshot: Number(row.price_snapshot),
      billing_provider_id: row.billing_provider_id as string | null,
      external_subscription_id: row.external_subscription_id as string | null,
      external_customer_id: row.external_customer_id as string | null,
      started_at: row.started_at as Date,
      current_period_start: row.current_period_start as Date,
      current_period_end: row.current_period_end as Date,
      cancelled_at: row.cancelled_at as Date | null,
      cancel_effective_at: row.cancel_effective_at as Date | null,
      status: row.status as SubscriptionStatus,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }

  private mapToTenantApplication(row: Record<string, unknown>): TenantApplication {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      application_id: row.application_id as string,
      status: row.status as TenantAppStatus,
      source: row.source as TenantAppSource,
      source_subscription_id: row.source_subscription_id as string | null,
      granted_by: row.granted_by as string | null,
      grant_reason: row.grant_reason as string | null,
      activated_at: row.activated_at as Date,
      suspended_at: row.suspended_at as Date | null,
      trial_ends_at: row.trial_ends_at as Date | null,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }
}

export default new SubscriptionRepository();
