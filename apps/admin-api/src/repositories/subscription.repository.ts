import { Transaction } from "kysely";
import { db } from "../db/connection";
import {
  subscription_status,
  tenant_app_status,
} from "../db/enums";
import { DB } from "../db/types";
import type { billing_cycle } from "../db/enums";

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_version_id: string;
  plan_code_snapshot: string;
  plan_name_snapshot: string;
  plan_version_snapshot: number;
  billing_cycle: billing_cycle;
  currency: string;
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
  grace_period_ends_at: Date | null;
  dunning_started_at: Date | null;
  last_payment_attempt_at: Date | null;
  payment_failure_count: number;
  billing_provider_name: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface PlanVersionProduct {
  product_id: string;
  product_code: string;
  feature_key: string;
  application_id: string;
  application_code: string;
  limit_value: number;
  is_unlimited: boolean;
}

function mapToSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    plan_version_id: row.plan_version_id as string,
    plan_code_snapshot: row.plan_code_snapshot as string,
    plan_name_snapshot: row.plan_name_snapshot as string,
    plan_version_snapshot: Number(row.plan_version_snapshot),
    billing_cycle: row.billing_cycle as billing_cycle,
    currency: row.currency as string,
    original_price: Number(row.original_price),
    discount_applied: Number(row.discount_applied),
    price_snapshot: Number(row.price_snapshot),
    billing_provider_id: (row.billing_provider_id as string) ?? null,
    external_subscription_id: (row.external_subscription_id as string) ?? null,
    external_customer_id: (row.external_customer_id as string) ?? null,
    started_at: new Date(row.started_at as string),
    current_period_start: new Date(row.current_period_start as string),
    current_period_end: new Date(row.current_period_end as string),
    cancelled_at: row.cancelled_at ? new Date(row.cancelled_at as string) : null,
    cancel_effective_at: row.cancel_effective_at
      ? new Date(row.cancel_effective_at as string)
      : null,
    grace_period_ends_at: row.grace_period_ends_at
      ? new Date(row.grace_period_ends_at as string)
      : null,
    dunning_started_at: row.dunning_started_at
      ? new Date(row.dunning_started_at as string)
      : null,
    last_payment_attempt_at: row.last_payment_attempt_at
      ? new Date(row.last_payment_attempt_at as string)
      : null,
    payment_failure_count: Number(row.payment_failure_count ?? 0),
    billing_provider_name: (row.billing_provider_name as string) ?? null,
    status: row.status as string,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}

class SubscriptionRepository {
  async findByIdAndTenant(
    id: string,
    tenantId: string
  ): Promise<Subscription | null> {
    const row = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return row ? mapToSubscription(row) : null;
  }

  async findByExternalId(
    externalSubscriptionId: string,
    trx?: Transaction<DB>
  ): Promise<Subscription | null> {
    const executor = trx || db;
    const row = await executor
      .selectFrom("subscriptions")
      .selectAll()
      .where("external_subscription_id", "=", externalSubscriptionId)
      .executeTakeFirst();
    return row ? mapToSubscription(row) : null;
  }

  async findBlockingByTenant(tenantId: string): Promise<Subscription | null> {
    const row = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .where("cancelled_at", "is", null)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    return row ? mapToSubscription(row) : null;
  }

  /** Find all ACTIVE/TRIALING subscriptions for tenant (for replacing with new subscription). */
  async findActiveSubscriptionsByTenant(
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<Subscription[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("subscriptions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .execute();
    return rows.map(mapToSubscription);
  }

  async findCurrentByTenant(tenantId: string): Promise<Subscription | null> {
    const row = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("status", "in", ["ACTIVE", "TRIALING", "PAST_DUE"])
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    return row ? mapToSubscription(row) : null;
  }

  async create(
    data: {
      id: string;
      tenant_id: string;
      plan_version_id: string;
      plan_code_snapshot: string;
      plan_name_snapshot: string;
      plan_version_snapshot: number;
      billing_cycle: billing_cycle;
      currency: string;
      original_price: number;
      discount_applied?: number;
      price_snapshot: number;
      billing_provider_id?: string | null;
      external_subscription_id?: string | null;
      external_customer_id?: string | null;
      started_at?: Date;
      current_period_start?: Date;
      current_period_end: Date;
      status?: string;
      grace_period_ends_at?: Date | null;
      billing_provider_name?: string | null;
      created_at: Date;
      updated_at: Date;
    },
    trx?: Transaction<DB>
  ): Promise<Subscription> {
    const executor = trx || db;
    const now = data.created_at;
    const row = await executor
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
        original_price: String(data.original_price),
        discount_applied: String(data.discount_applied ?? 0),
        price_snapshot: String(data.price_snapshot),
        billing_provider_id: data.billing_provider_id ?? null,
        external_subscription_id: data.external_subscription_id ?? null,
        external_customer_id: data.external_customer_id ?? null,
        started_at: data.started_at ?? now,
        current_period_start: data.current_period_start ?? now,
        current_period_end: data.current_period_end,
        status: (data.status ?? subscription_status.PENDING) as typeof subscription_status[keyof typeof subscription_status],
        grace_period_ends_at: data.grace_period_ends_at ?? null,
        billing_provider_name: data.billing_provider_name ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapToSubscription(row);
  }

  async update(
    id: string,
    data: {
      status?: string;
      plan_version_id?: string;
      plan_code_snapshot?: string;
      plan_name_snapshot?: string;
      plan_version_snapshot?: number;
      billing_cycle?: string;
      currency?: string;
      original_price?: number;
      price_snapshot?: number;
      billing_provider_id?: string;
      current_period_start?: Date;
      current_period_end?: Date;
      started_at?: Date;
      cancelled_at?: Date | null;
      cancel_effective_at?: Date | null;
      external_subscription_id?: string | null;
      grace_period_ends_at?: Date | null;
      dunning_started_at?: Date | null;
      last_payment_attempt_at?: Date | null;
      payment_failure_count?: number;
      billing_provider_name?: string | null;
      updated_at?: Date;
    },
    trx?: Transaction<DB>
  ): Promise<Subscription | null> {
    const executor = trx || db;
    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at ?? new Date(),
    };
    if (data.status !== undefined) updateData.status = data.status;
    if (data.plan_version_id !== undefined) updateData.plan_version_id = data.plan_version_id;
    if (data.plan_code_snapshot !== undefined) updateData.plan_code_snapshot = data.plan_code_snapshot;
    if (data.plan_name_snapshot !== undefined) updateData.plan_name_snapshot = data.plan_name_snapshot;
    if (data.plan_version_snapshot !== undefined) updateData.plan_version_snapshot = data.plan_version_snapshot;
    if (data.billing_cycle !== undefined) updateData.billing_cycle = data.billing_cycle;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.original_price !== undefined) updateData.original_price = data.original_price;
    if (data.price_snapshot !== undefined) updateData.price_snapshot = data.price_snapshot;
    if (data.billing_provider_id !== undefined) updateData.billing_provider_id = data.billing_provider_id;
    if (data.started_at !== undefined) updateData.started_at = data.started_at;
    if (data.current_period_start !== undefined)
      updateData.current_period_start = data.current_period_start;
    if (data.current_period_end !== undefined)
      updateData.current_period_end = data.current_period_end;
    if (data.cancelled_at !== undefined) updateData.cancelled_at = data.cancelled_at;
    if (data.cancel_effective_at !== undefined)
      updateData.cancel_effective_at = data.cancel_effective_at;
    if (data.external_subscription_id !== undefined)
      updateData.external_subscription_id = data.external_subscription_id;
    if (data.grace_period_ends_at !== undefined)
      updateData.grace_period_ends_at = data.grace_period_ends_at;
    if (data.dunning_started_at !== undefined)
      updateData.dunning_started_at = data.dunning_started_at;
    if (data.last_payment_attempt_at !== undefined)
      updateData.last_payment_attempt_at = data.last_payment_attempt_at;
    if (data.payment_failure_count !== undefined)
      updateData.payment_failure_count = data.payment_failure_count;
    if (data.billing_provider_name !== undefined)
      updateData.billing_provider_name = data.billing_provider_name;

    const row = await executor
      .updateTable("subscriptions")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapToSubscription(row) : null;
  }

  async getPlanVersionProducts(
    planVersionId: string,
    trx?: Transaction<DB>
  ): Promise<PlanVersionProduct[]> {
    const executor = trx || db;
    const results = await executor
      .selectFrom("plan_version_products")
      .innerJoin("products", "plan_version_products.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id")
      .innerJoin("applications", "features.application_id", "applications.id")
      .select([
        "products.id as product_id",
        "products.code as product_code",
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
      feature_key: r.feature_key,
      application_id: r.application_id,
      application_code: r.application_code,
      limit_value: r.limit_value,
      is_unlimited: r.is_unlimited,
    }));
  }

  async getPlanApplications(
    planId: string,
    trx?: Transaction<DB>
  ): Promise<Array<{ application_id: string; application_code: string }>> {
    const executor = trx || db;
    return executor
      .selectFrom("plan_applications")
      .innerJoin("applications", "plan_applications.application_id", "applications.id")
      .select([
        "applications.id as application_id",
        "applications.code as application_code",
      ])
      .where("plan_applications.plan_id", "=", planId)
      .execute();
  }

  async createTenantApplication(
    data: {
      id: string;
      tenant_id: string;
      application_id: string;
      status?: string;
      source: string;
      source_subscription_id?: string | null;
      trial_ends_at?: Date | null;
      created_at: Date;
      updated_at: Date;
    },
    trx?: Transaction<DB>
  ): Promise<void> {
    const executor = trx || db;
    await executor
      .insertInto("tenant_applications")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        application_id: data.application_id,
        status: (data.status ?? tenant_app_status.ACTIVE) as tenant_app_status,
        source: data.source as "SUBSCRIPTION" | "ADMIN_TRIAL" | "ADMIN_GRANT" | "PROMO",
        source_subscription_id: data.source_subscription_id ?? null,
        trial_ends_at: data.trial_ends_at ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .execute();
  }

  async updateTenantApplicationsBySubscription(
    subscriptionId: string,
    status: string,
    trx?: Transaction<DB>
  ): Promise<void> {
    const executor = trx || db;
    await executor
      .updateTable("tenant_applications")
      .set({
        status: status as typeof tenant_app_status[keyof typeof tenant_app_status],
        suspended_at: status === "SUSPENDED" || status === "CANCELLED" ? new Date() : null,
        updated_at: new Date(),
      })
      .where("source_subscription_id", "=", subscriptionId)
      .execute();
  }

  async findTenantApplication(
    tenantId: string,
    applicationId: string,
    trx?: Transaction<DB>
  ): Promise<{ id: string; status: string } | null> {
    const executor = trx || db;
    const row = await executor
      .selectFrom("tenant_applications")
      .select(["id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("application_id", "=", applicationId)
      .executeTakeFirst();
    return row ? { id: row.id, status: row.status } : null;
  }

  async reactivateTenantApplication(
    id: string,
    data: {
      status: string;
      source: string;
      source_subscription_id: string;
      trial_ends_at?: Date | null;
    },
    trx?: Transaction<DB>
  ): Promise<void> {
    const executor = trx || db;
    await executor
      .updateTable("tenant_applications")
      .set({
        status: data.status as typeof tenant_app_status[keyof typeof tenant_app_status],
        source: data.source as "SUBSCRIPTION" | "ADMIN_TRIAL" | "ADMIN_GRANT" | "PROMO",
        source_subscription_id: data.source_subscription_id,
        trial_ends_at: data.trial_ends_at ?? null,
        suspended_at: null,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Find subscriptions with expired grace period (PAST_DUE and grace_period_ends_at < now).
   */
  async findExpiredGracePeriodSubscriptions(): Promise<Subscription[]> {
    const now = new Date();
    const rows = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("status", "=", "PAST_DUE")
      .where("grace_period_ends_at", "<", now)
      .where("grace_period_ends_at", "is not", null)
      .execute();
    return rows.map(mapToSubscription);
  }

  /**
   * Find ACTIVE/TRIALING subscriptions that were scheduled for cancellation
   * and whose cancel_effective_at has passed.
   * Safety net for when billing provider webhooks fail to arrive.
   */
  async findExpiredScheduledCancellations(): Promise<Subscription[]> {
    const now = new Date();
    const rows = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .where("cancelled_at", "is not", null)
      .where("cancel_effective_at", "is not", null)
      .where("cancel_effective_at", "<", now)
      .execute();
    return rows.map(mapToSubscription);
  }
}

export default new SubscriptionRepository();
