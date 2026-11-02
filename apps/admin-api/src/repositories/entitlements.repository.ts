import { Transaction } from "kysely";
import { db } from "../db/connection";
import { DB } from "../db/types";
import type { entitlements } from "../db/types";

export type EntitlementRow = entitlements;

export interface EntitlementInsert {
  id: string;
  tenant_id: string;
  product_id: string;
  application_code: string;
  feature_key: string;
  product_code: string;
  is_unlimited?: boolean;
  limit_value: number;
  used_value?: number;
  source: "PLAN" | "ADMIN" | "ADDON" | "PROMO";
  source_subscription_id?: string | null;
  source_plan_version_id?: string | null;
  source_addon_id?: string | null;
  is_active?: boolean;
  created_at: Date;
  updated_at: Date;
}

class EntitlementsRepository {
  /**
   * Find all active entitlements for a tenant
   */
  async findActiveByTenantId(
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<EntitlementRow[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("entitlements")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", true)
      .orderBy("feature_key")
      .orderBy("product_code")
      .execute();
    return rows as unknown as EntitlementRow[];
  }

  /**
   * Find a single active entitlement by tenant and product code
   */
  async findByTenantAndProduct(
    tenantId: string,
    productCode: string
  ): Promise<EntitlementRow | null> {
    const row = await db
      .selectFrom("entitlements")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", productCode)
      .where("is_active", "=", true)
      .orderBy("used_value", "desc")
      .executeTakeFirst();
    return row as unknown as EntitlementRow | null;
  }

  /**
   * Find all active entitlements sourced from a subscription.
   */
  async findActiveBySubscription(
    subscriptionId: string,
    trx?: Transaction<DB>
  ): Promise<EntitlementRow[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("entitlements")
      .selectAll()
      .where("source_subscription_id", "=", subscriptionId)
      .where("is_active", "=", true)
      .execute();
    return rows as unknown as EntitlementRow[];
  }

  /**
   * Archive entitlements by subscription.
   */
  async archiveBySubscription(
    subscriptionId: string,
    trx?: Transaction<DB>
  ): Promise<number> {
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
  async archiveAllPlanByTenant(
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<number> {
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
   * Find archived PLAN-sourced entitlements for a tenant,
   * deduplicated by product_code, keeps the entry with the highest used_value
   * (handles cases where usage was split across multiple subscriptions).
   */
  async findArchivedUsageByTenant(
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<EntitlementRow[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("entitlements")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", false)
      .where("source", "=", "PLAN")
      .execute();

    // Keep the entry with the highest used_value per product_code
    const best = new Map<string, EntitlementRow>();
    for (const row of rows) {
      const r = row as unknown as EntitlementRow;
      const usedVal = typeof r.used_value === "string"
        ? parseInt(r.used_value as unknown as string, 10)
        : Number(r.used_value ?? 0);
      const existing = best.get(r.product_code);
      if (!existing) {
        best.set(r.product_code, r);
      } else {
        const existingUsed = typeof existing.used_value === "string"
          ? parseInt(existing.used_value as unknown as string, 10)
          : Number(existing.used_value ?? 0);
        if (usedVal > existingUsed) {
          best.set(r.product_code, r);
        }
      }
    }
    return Array.from(best.values());
  }

  /**
   * Create entitlement.
   */
  async create(
    data: EntitlementInsert,
    trx?: Transaction<DB>
  ): Promise<EntitlementRow> {
    const executor = trx || db;
    const row = await executor
      .insertInto("entitlements")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        product_id: data.product_id,
        application_code: data.application_code,
        feature_key: data.feature_key,
        product_code: data.product_code,
        is_unlimited: data.is_unlimited ?? false,
        limit_value: data.limit_value,
        used_value: data.used_value ?? 0,
        source: data.source,
        source_subscription_id: data.source_subscription_id ?? null,
        source_plan_version_id: data.source_plan_version_id ?? null,
        source_addon_id: data.source_addon_id ?? null,
        is_active: data.is_active !== false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as EntitlementRow;
  }
}

const entitlementsRepository = new EntitlementsRepository();
export default entitlementsRepository;
