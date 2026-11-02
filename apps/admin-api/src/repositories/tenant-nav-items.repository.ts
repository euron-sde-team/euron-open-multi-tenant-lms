import { sql } from "kysely";
import { db } from "../db/connection";

export interface TenantNavItemRow {
  id: string;
  tenant_id: string;
  item_type: string; // SYSTEM, FEATURE, CUSTOM
  feature_key: string | null;
  label: string;
  href: string;
  icon: string | null;
  sort_order: number;
  visible: boolean;
  is_external: boolean;
  badge_text: string | null;
  badge_variant: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TenantNavItemInsert {
  id: string;
  tenant_id: string;
  item_type: string;
  feature_key?: string | null;
  label: string;
  href: string;
  icon?: string | null;
  sort_order?: number;
  visible?: boolean;
  is_external?: boolean;
  badge_text?: string | null;
  badge_variant?: string | null;
}

class TenantNavItemsRepository {
  /**
   * Find all nav items for a tenant, ordered by sort_order
   */
  async findByTenantId(tenantId: string): Promise<TenantNavItemRow[]> {
    const rows = await db
      .selectFrom("tenant_nav_items")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("sort_order", "asc")
      .execute();

    return rows.map((r) => ({
      ...r,
      visible: r.visible as boolean,
      is_external: r.is_external as boolean,
      sort_order: Number(r.sort_order ?? 0),
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));
  }

  /**
   * Insert default nav items if none exist for the tenant.
   * Uses pg_advisory_xact_lock to prevent race conditions across workers.
   */
  async insertDefaultsIfEmpty(
    tenantId: string,
    items: TenantNavItemInsert[]
  ): Promise<void> {
    await db.transaction().execute(async (trx) => {
      // Advisory lock scoped to tenant to prevent concurrent default inserts
      await sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`.execute(trx);

      // Check if rows already exist
      const existing = await trx
        .selectFrom("tenant_nav_items")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .limit(1)
        .execute();

      if (existing.length > 0) return;

      // Bulk insert defaults
      if (items.length > 0) {
        await trx
          .insertInto("tenant_nav_items")
          .values(
            items.map((item) => ({
              id: item.id,
              tenant_id: tenantId,
              item_type: item.item_type,
              feature_key: item.feature_key ?? null,
              label: item.label,
              href: item.href,
              icon: item.icon ?? null,
              sort_order: item.sort_order ?? 0,
              visible: item.visible ?? true,
              is_external: item.is_external ?? false,
              badge_text: item.badge_text ?? null,
              badge_variant: item.badge_variant ?? null,
              created_at: new Date(),
              updated_at: new Date(),
            }))
          )
          .execute();
      }
    });
  }

  /**
   * Bulk insert items with ON CONFLICT DO NOTHING (for appending new features safely)
   */
  async insertItems(
    tenantId: string,
    items: TenantNavItemInsert[]
  ): Promise<void> {
    if (items.length === 0) return;

    await db
      .insertInto("tenant_nav_items")
      .values(
        items.map((item) => ({
          id: item.id,
          tenant_id: tenantId,
          item_type: item.item_type,
          feature_key: item.feature_key ?? null,
          label: item.label,
          href: item.href,
          icon: item.icon ?? null,
          sort_order: item.sort_order ?? 0,
          visible: item.visible ?? true,
          is_external: item.is_external ?? false,
          badge_text: item.badge_text ?? null,
          badge_variant: item.badge_variant ?? null,
          created_at: new Date(),
          updated_at: new Date(),
        }))
      )
      .onConflict((oc) => oc.column("id").doNothing())
      .execute();
  }

  /**
   * Update a single nav item with tenant_id guard
   */
  async updateItem(
    tenantId: string,
    itemId: string,
    updates: {
      label?: string;
      icon?: string | null;
      visible?: boolean;
      badge_text?: string | null;
      badge_variant?: string | null;
      is_external?: boolean;
    }
  ): Promise<TenantNavItemRow | undefined> {
    const rows = await db
      .updateTable("tenant_nav_items")
      .set({ ...updates, updated_at: new Date() })
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .execute();

    if (rows.length === 0) return undefined;

    const r = rows[0];
    return {
      ...r,
      visible: r.visible as boolean,
      is_external: r.is_external as boolean,
      sort_order: Number(r.sort_order ?? 0),
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    };
  }

  /**
   * Delete a single nav item with tenant_id guard, returns the deleted row
   */
  async deleteItem(
    tenantId: string,
    itemId: string
  ): Promise<TenantNavItemRow | undefined> {
    const rows = await db
      .deleteFrom("tenant_nav_items")
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .execute();

    if (rows.length === 0) return undefined;

    const r = rows[0];
    return {
      ...r,
      visible: r.visible as boolean,
      is_external: r.is_external as boolean,
      sort_order: Number(r.sort_order ?? 0),
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    };
  }

  /**
   * Find a single nav item by ID with tenant_id guard
   */
  async findById(
    tenantId: string,
    itemId: string
  ): Promise<TenantNavItemRow | undefined> {
    const rows = await db
      .selectFrom("tenant_nav_items")
      .selectAll()
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .execute();

    if (rows.length === 0) return undefined;

    const r = rows[0];
    return {
      ...r,
      visible: r.visible as boolean,
      is_external: r.is_external as boolean,
      sort_order: Number(r.sort_order ?? 0),
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    };
  }

  /**
   * Get the maximum sort_order for a tenant's nav items
   */
  async getMaxSortOrder(tenantId: string): Promise<number> {
    const result = await db
      .selectFrom("tenant_nav_items")
      .select(sql<number>`COALESCE(MAX(sort_order), -1)`.as("max_sort"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();

    return typeof result.max_sort === "string"
      ? parseInt(result.max_sort, 10)
      : Number(result.max_sort ?? -1);
  }

  /**
   * Update sort_order for multiple items in a transaction
   */
  async updateSortOrders(
    tenantId: string,
    orders: { id: string; sort_order: number }[]
  ): Promise<void> {
    if (orders.length === 0) return;

    await db.transaction().execute(async (trx) => {
      for (const order of orders) {
        await trx
          .updateTable("tenant_nav_items")
          .set({ sort_order: order.sort_order, updated_at: new Date() })
          .where("id", "=", order.id)
          .where("tenant_id", "=", tenantId)
          .execute();
      }
    });
  }

  /**
   * Replace all nav items for a tenant (transaction: delete all + bulk insert)
   */
  async replaceAll(
    tenantId: string,
    items: TenantNavItemInsert[]
  ): Promise<void> {
    await db.transaction().execute(async (trx) => {
      // Delete all existing items for tenant
      await trx
        .deleteFrom("tenant_nav_items")
        .where("tenant_id", "=", tenantId)
        .execute();

      // Bulk insert new items
      if (items.length > 0) {
        await trx
          .insertInto("tenant_nav_items")
          .values(
            items.map((item) => ({
              id: item.id,
              tenant_id: tenantId,
              item_type: item.item_type,
              feature_key: item.feature_key ?? null,
              label: item.label,
              href: item.href,
              icon: item.icon ?? null,
              sort_order: item.sort_order ?? 0,
              visible: item.visible ?? true,
              is_external: item.is_external ?? false,
              badge_text: item.badge_text ?? null,
              badge_variant: item.badge_variant ?? null,
              created_at: new Date(),
              updated_at: new Date(),
            }))
          )
          .execute();
      }
    });
  }
}

const tenantNavItemsRepository = new TenantNavItemsRepository();
export default tenantNavItemsRepository;
