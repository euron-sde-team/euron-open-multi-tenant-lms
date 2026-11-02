import { Transaction } from "kysely";
import { db } from "../db/connection";
import { DB } from "../db/types";
import { EntitlementQueryParams, EntitlementSource } from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

export interface Entitlement {
  id: string;
  tenant_id: string;
  product_id: string;
  application_code: string;
  feature_key: string;
  product_code: string;
  is_unlimited: boolean;
  limit_value: number;
  used_value: number;
  source: EntitlementSource;
  source_subscription_id: string | null;
  source_plan_version_id: string | null;
  source_addon_id: string | null;
  is_active: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface EntitlementInsert {
  id: string;
  tenant_id: string;
  product_id: string;
  application_code: string;
  feature_key: string;
  product_code: string;
  is_unlimited?: boolean;
  limit_value: number;
  used_value?: number;
  source: EntitlementSource;
  source_subscription_id?: string | null;
  source_plan_version_id?: string | null;
  source_addon_id?: string | null;
  is_active?: boolean;
  created_at: Date;
  updated_at: Date;
}

interface EntitlementUpdate {
  limit_value?: number;
  used_value?: number;
  is_unlimited?: boolean;
  is_active?: boolean;
  archived_at?: Date | null;
  updated_at?: Date;
}

interface EntitlementOverride {
  id: string;
  entitlement_id: string;
  old_limit_value: number;
  new_limit_value: number;
  reason: string;
  admin_id: string;
  created_at: Date;
}

interface EntitlementOverrideInsert {
  id: string;
  entitlement_id: string;
  old_limit_value: number;
  new_limit_value: number;
  reason: string;
  admin_id: string;
  created_at?: Date;
}

interface EntitlementWithProduct extends Entitlement {
  product_constraint_type: string;
  product_unit: string | null;
  product_is_hard_limit: boolean;
  feature_name: string | null;
}

// ============================================
// REPOSITORY
// ============================================

class EntitlementRepository {
  /**
   * Find entitlement by ID
   */
  async findById(id: string): Promise<Entitlement | null> {
    const entitlement = await db
      .selectFrom("entitlements")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return entitlement ? this.mapToEntitlement(entitlement) : null;
  }

  /**
   * Find entitlement by ID with product details
   */
  async findByIdWithProduct(id: string): Promise<EntitlementWithProduct | null> {
    const result = await db
      .selectFrom("entitlements")
      .innerJoin("products", "entitlements.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id")
      .select([
        "entitlements.id",
        "entitlements.tenant_id",
        "entitlements.product_id",
        "entitlements.application_code",
        "entitlements.feature_key",
        "entitlements.product_code",
        "entitlements.is_unlimited",
        "entitlements.limit_value",
        "entitlements.used_value",
        "entitlements.source",
        "entitlements.source_subscription_id",
        "entitlements.source_plan_version_id",
        "entitlements.source_addon_id",
        "entitlements.is_active",
        "entitlements.archived_at",
        "entitlements.created_at",
        "entitlements.updated_at",
        "products.constraint_type as product_constraint_type",
        "products.unit as product_unit",
        "products.is_hard_limit as product_is_hard_limit",
        "features.name as feature_name",
      ])
      .where("entitlements.id", "=", id)
      .executeTakeFirst();

    return result ? this.mapToEntitlementWithProduct(result) : null;
  }

  /**
   * Find active entitlement by tenant and feature key
   * This is the primary lookup for authorization checks
   */
  async findByTenantAndFeature(tenantId: string, featureKey: string): Promise<Entitlement | null> {
    const entitlement = await db
      .selectFrom("entitlements")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("feature_key", "=", featureKey)
      .where("is_active", "=", true)
      .executeTakeFirst();

    return entitlement ? this.mapToEntitlement(entitlement) : null;
  }

  /**
   * Find active entitlement by tenant and product code
   */
  async findByTenantAndProduct(tenantId: string, productCode: string, trx?: Transaction<DB>): Promise<Entitlement | null> {
    const executor = trx || db;
    const entitlement = await executor
      .selectFrom("entitlements")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", productCode)
      .where("is_active", "=", true)
      .executeTakeFirst();

    return entitlement ? this.mapToEntitlement(entitlement) : null;
  }

  /**
   * Bulk-load the active entitlements of many tenants at once, keyed by tenant.
   *
   * The plan-level entitlement sync needs "what does each tenant already have"
   * for every subscriber of a plan. Doing that per tenant is an N+1 that turns a
   * 200-tenant preview into 200 round trips; this collapses it into one query.
   */
  async findActiveByTenantIds(
    tenantIds: string[],
    trx?: Transaction<DB>
  ): Promise<Map<string, Entitlement[]>> {
    const grouped = new Map<string, Entitlement[]>();
    if (tenantIds.length === 0) return grouped;

    const rows = await (trx || db)
      .selectFrom("entitlements")
      .selectAll()
      .where("tenant_id", "in", tenantIds)
      .where("is_active", "=", true)
      .execute();

    for (const row of rows) {
      const entitlement = this.mapToEntitlement(row);
      const existing = grouped.get(entitlement.tenant_id);
      if (existing) {
        existing.push(entitlement);
      } else {
        grouped.set(entitlement.tenant_id, [entitlement]);
      }
    }

    return grouped;
  }

  /**
   * Bulk-load every tenant_applications row's status, keyed by tenant then
   * application id. The sync needs the full status, not just "live or not":
   * an ACTIVE/TRIALING app makes an entitlement effective, an absent or
   * CANCELLED one may be granted/reactivated, and a SUSPENDED one is a
   * deliberate operator action the sync must never silently undo.
   */
  async findApplicationStatusesByTenantIds(
    tenantIds: string[]
  ): Promise<Map<string, Map<string, string>>> {
    const grouped = new Map<string, Map<string, string>>();
    if (tenantIds.length === 0) return grouped;

    const rows = await db
      .selectFrom("tenant_applications")
      .select(["tenant_id", "application_id", "status"])
      .where("tenant_id", "in", tenantIds)
      .execute();

    for (const row of rows) {
      const existing = grouped.get(row.tenant_id);
      if (existing) {
        existing.set(row.application_id, row.status as string);
      } else {
        grouped.set(row.tenant_id, new Map([[row.application_id, row.status as string]]));
      }
    }

    return grouped;
  }

  /**
   * Bulk-load the highest recorded usage per product for each tenant, from
   * tenant_usage_counters (max across scopes/windows, the conservative read).
   * The sync uses this to warn when a to-be-created entitlement's limit is
   * already below what the tenant has consumed.
   */
  async findMaxUsageByTenantIds(
    tenantIds: string[]
  ): Promise<Map<string, Map<string, number>>> {
    const grouped = new Map<string, Map<string, number>>();
    if (tenantIds.length === 0) return grouped;

    const rows = await db
      .selectFrom("tenant_usage_counters")
      .select(({ fn }) => [
        "tenant_id",
        "product_code",
        fn.max("current_value").as("used"),
      ])
      .where("tenant_id", "in", tenantIds)
      .groupBy(["tenant_id", "product_code"])
      .execute();

    for (const row of rows) {
      const used = Number(row.used ?? 0);
      const existing = grouped.get(row.tenant_id);
      if (existing) {
        existing.set(row.product_code, used);
      } else {
        grouped.set(row.tenant_id, new Map([[row.product_code, used]]));
      }
    }

    return grouped;
  }

  /**
   * List entitlements for a tenant with filters
   */
  async findByTenant(
    tenantId: string,
    params: EntitlementQueryParams
  ): Promise<{ entitlements: EntitlementWithProduct[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("entitlements")
      .innerJoin("products", "entitlements.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id")
      .where("entitlements.tenant_id", "=", tenantId);

    let countQuery = db
      .selectFrom("entitlements")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId);

    // Apply filters
    if (params.application_code) {
      query = query.where("entitlements.application_code", "=", params.application_code);
      countQuery = countQuery.where("application_code", "=", params.application_code);
    }

    if (params.feature_key) {
      query = query.where("entitlements.feature_key", "=", params.feature_key);
      countQuery = countQuery.where("feature_key", "=", params.feature_key);
    }

    if (params.source) {
      query = query.where("entitlements.source", "=", params.source);
      countQuery = countQuery.where("source", "=", params.source);
    }

    if (params.is_active !== undefined) {
      query = query.where("entitlements.is_active", "=", params.is_active);
      countQuery = countQuery.where("is_active", "=", params.is_active);
    }

    // Execute queries
    const [entitlements, countResult] = await Promise.all([
      query
        .select([
          "entitlements.id",
          "entitlements.tenant_id",
          "entitlements.product_id",
          "entitlements.application_code",
          "entitlements.feature_key",
          "entitlements.product_code",
          "entitlements.is_unlimited",
          "entitlements.limit_value",
          "entitlements.used_value",
          "entitlements.source",
          "entitlements.source_subscription_id",
          "entitlements.source_plan_version_id",
          "entitlements.source_addon_id",
          "entitlements.is_active",
          "entitlements.archived_at",
          "entitlements.created_at",
          "entitlements.updated_at",
          "products.constraint_type as product_constraint_type",
          "products.unit as product_unit",
          "products.is_hard_limit as product_is_hard_limit",
          "features.name as feature_name",
        ])
        .orderBy("entitlements.application_code", "asc")
        .orderBy("entitlements.feature_key", "asc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      entitlements: entitlements.map((e) => this.mapToEntitlementWithProduct(e)),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * Create entitlement
   */
  async create(data: EntitlementInsert, trx?: Transaction<DB>): Promise<Entitlement> {
    const executor = trx || db;

    const entitlement = await executor
      .insertInto("entitlements")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        product_id: data.product_id,
        application_code: data.application_code,
        feature_key: data.feature_key,
        product_code: data.product_code,
        is_unlimited: data.is_unlimited || false,
        limit_value: data.limit_value,
        used_value: data.used_value || 0,
        source: data.source,
        source_subscription_id: data.source_subscription_id || null,
        source_plan_version_id: data.source_plan_version_id || null,
        source_addon_id: data.source_addon_id || null,
        is_active: data.is_active !== false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToEntitlement(entitlement);
  }

  /**
   * Update entitlement
   */
  async update(id: string, data: EntitlementUpdate, trx?: Transaction<DB>): Promise<Entitlement | null> {
    const executor = trx || db;

    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at || new Date(),
    };

    if (data.limit_value !== undefined) updateData.limit_value = data.limit_value;
    if (data.used_value !== undefined) updateData.used_value = data.used_value;
    if (data.is_unlimited !== undefined) updateData.is_unlimited = data.is_unlimited;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.archived_at !== undefined) updateData.archived_at = data.archived_at;

    const entitlement = await executor
      .updateTable("entitlements")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return entitlement ? this.mapToEntitlement(entitlement) : null;
  }

  /**
   * Find all active entitlements sourced from a specific subscription.
   * Used during plan replacement to gather current usage before archival.
   */
  async findActiveBySubscription(subscriptionId: string, trx?: Transaction<DB>): Promise<Entitlement[]> {
    const executor = trx || db;

    const results = await executor
      .selectFrom("entitlements")
      .selectAll()
      .where("source_subscription_id", "=", subscriptionId)
      .where("is_active", "=", true)
      .execute();

    return results.map((r) => this.mapToEntitlement(r));
  }

  /**
   * Archive entitlements by subscription
   */
  async archiveBySubscription(subscriptionId: string, trx?: Transaction<DB>): Promise<number> {
    const executor = trx || db;

    const result = await executor
      .updateTable("entitlements")
      .set({
        is_active: false,
        archived_at: new Date(),
        updated_at: new Date(),
      })
      .where("source_subscription_id", "=", subscriptionId)
      .where("is_active", "=", true)
      .execute();

    return result.length;
  }

  /**
   * Archive ALL active PLAN-sourced entitlements for a tenant.
   * More thorough than archiveBySubscription, catches orphaned entitlements
   * from multiple subscriptions or dirty state.
   */
  async archiveAllPlanEntitlements(tenantId: string, trx?: Transaction<DB>): Promise<number> {
    const executor = trx || db;

    const result = await executor
      .updateTable("entitlements")
      .set({
        is_active: false,
        archived_at: new Date(),
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", true)
      .where("source", "=", "PLAN")
      .execute();

    return result.length;
  }

  /**
   * Archive entitlements by addon
   */
  async archiveByAddon(addonId: string, trx?: Transaction<DB>): Promise<number> {
    const executor = trx || db;

    const result = await executor
      .updateTable("entitlements")
      .set({
        is_active: false,
        archived_at: new Date(),
        updated_at: new Date(),
      })
      .where("source_addon_id", "=", addonId)
      .where("is_active", "=", true)
      .execute();

    return result.length;
  }

  // ============================================
  // OVERRIDE OPERATIONS
  // ============================================

  /**
   * Create override record
   */
  async createOverride(data: EntitlementOverrideInsert, trx?: Transaction<DB>): Promise<EntitlementOverride> {
    const executor = trx || db;

    const override = await executor
      .insertInto("entitlement_overrides")
      .values({
        id: data.id,
        entitlement_id: data.entitlement_id,
        old_limit_value: data.old_limit_value,
        new_limit_value: data.new_limit_value,
        reason: data.reason,
        admin_id: data.admin_id,
        created_at: data.created_at || new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToOverride(override);
  }

  /**
   * Get overrides for entitlement
   */
  async getOverrides(entitlementId: string): Promise<EntitlementOverride[]> {
    const overrides = await db
      .selectFrom("entitlement_overrides")
      .selectAll()
      .where("entitlement_id", "=", entitlementId)
      .orderBy("created_at", "desc")
      .execute();

    return overrides.map((o) => this.mapToOverride(o));
  }

  /**
   * Get latest override for entitlement
   */
  async getLatestOverride(entitlementId: string): Promise<EntitlementOverride | null> {
    const override = await db
      .selectFrom("entitlement_overrides")
      .selectAll()
      .where("entitlement_id", "=", entitlementId)
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    return override ? this.mapToOverride(override) : null;
  }

  /**
   * Count overrides for entitlement
   */
  async countOverrides(entitlementId: string): Promise<number> {
    const result = await db
      .selectFrom("entitlement_overrides")
      .select(db.fn.countAll().as("count"))
      .where("entitlement_id", "=", entitlementId)
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  // ============================================
  // USAGE COUNTERS
  // ============================================

  /**
   * Read all usage counters for a tenant from tenant_usage_counters.
   * Returns a map of product_code → current_value.
   */
  async getUsageCounters(tenantId: string): Promise<Map<string, number>> {
    const rows = await db
      .selectFrom("tenant_usage_counters")
      .select(["product_code", "current_value"])
      .where("tenant_id", "=", tenantId)
      .where("scope_type", "=", "TENANT")
      .where("window_type", "=", "LIFETIME")
      .orderBy("created_at", "asc")
      .execute();

    const map = new Map<string, number>();
    for (const row of rows) {
      if (!map.has(row.product_code)) {
        map.set(row.product_code, Number(row.current_value ?? 0));
      }
    }
    return map;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToEntitlement(row: Record<string, unknown>): Entitlement {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      product_id: row.product_id as string,
      application_code: row.application_code as string,
      feature_key: row.feature_key as string,
      product_code: row.product_code as string,
      is_unlimited: row.is_unlimited as boolean,
      limit_value: row.limit_value as number,
      used_value: row.used_value as number,
      source: row.source as EntitlementSource,
      source_subscription_id: row.source_subscription_id as string | null,
      source_plan_version_id: row.source_plan_version_id as string | null,
      source_addon_id: row.source_addon_id as string | null,
      is_active: row.is_active as boolean,
      archived_at: row.archived_at as Date | null,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }

  private mapToEntitlementWithProduct(row: Record<string, unknown>): EntitlementWithProduct {
    return {
      ...this.mapToEntitlement(row),
      product_constraint_type: row.product_constraint_type as string,
      product_unit: row.product_unit as string | null,
      product_is_hard_limit: row.product_is_hard_limit as boolean,
      feature_name: row.feature_name as string | null,
    };
  }

  private mapToOverride(row: Record<string, unknown>): EntitlementOverride {
    return {
      id: row.id as string,
      entitlement_id: row.entitlement_id as string,
      old_limit_value: row.old_limit_value as number,
      new_limit_value: row.new_limit_value as number,
      reason: row.reason as string,
      admin_id: row.admin_id as string,
      created_at: row.created_at as Date,
    };
  }
}

export default new EntitlementRepository();
