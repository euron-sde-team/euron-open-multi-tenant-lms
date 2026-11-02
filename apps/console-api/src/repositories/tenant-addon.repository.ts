import { Transaction } from "kysely";
import { db } from "../db/connection";
import { DB } from "../db/types";
import {
  tenant_addon_status,
  tenant_addon_event_type,
} from "../db/enums";
import {
  TenantAddonSource,
  TenantAddonStatus,
  TenantAddonQueryParams,
} from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

interface TenantAddon {
  id: string;
  tenant_id: string;
  addon_id: string;
  source: TenantAddonSource;
  status: TenantAddonStatus;
  custom_grant_value: number | null;
  addon_subscription_id: string | null;
  entitlement_id: string | null;
  granted_by: string | null;
  reason: string | null;
  activated_at: Date;
  cancelled_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TenantAddonInsert {
  id: string;
  tenant_id: string;
  addon_id: string;
  source: TenantAddonSource;
  status?: TenantAddonStatus;
  custom_grant_value?: number | null;
  addon_subscription_id?: string | null;
  entitlement_id?: string | null;
  granted_by?: string | null;
  reason?: string | null;
  activated_at?: Date;
  expires_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TenantAddonUpdate {
  status?: TenantAddonStatus;
  cancelled_at?: Date | null;
  entitlement_id?: string | null;
  updated_at?: Date;
}

interface TenantAddonWithDetails extends TenantAddon {
  addon_code: string;
  addon_name: string;
  addon_description: string | null;
  application_code: string;
  product_code: string;
  grant_value: number;
  is_unlimited: boolean;
}

interface TenantAddonEvent {
  id: string;
  tenant_addon_id: string;
  tenant_id: string;
  addon_id: string;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  admin_id: string | null;
  is_system: boolean;
  metadata: unknown | null;
  created_at: Date;
}

interface TenantAddonEventInsert {
  id: string;
  tenant_addon_id: string;
  tenant_id: string;
  addon_id: string;
  event_type: string;
  old_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  admin_id?: string | null;
  is_system?: boolean;
  metadata?: unknown | null;
  created_at?: Date;
}

// ============================================
// REPOSITORY
// ============================================

class TenantAddonRepository {
  /**
   * Find tenant addon by ID
   */
  async findById(id: string): Promise<TenantAddon | null> {
    const tenantAddon = await db
      .selectFrom("tenant_addons")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return tenantAddon ? this.mapToTenantAddon(tenantAddon) : null;
  }

  /**
   * Find tenant addon by ID and tenant
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<TenantAddon | null> {
    const tenantAddon = await db
      .selectFrom("tenant_addons")
      .selectAll()
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    return tenantAddon ? this.mapToTenantAddon(tenantAddon) : null;
  }

  /**
   * Find tenant addon by ID with addon details
   */
  async findByIdWithDetails(id: string): Promise<TenantAddonWithDetails | null> {
    const result = await db
      .selectFrom("tenant_addons")
      .innerJoin("addons", "tenant_addons.addon_id", "addons.id")
      .innerJoin("applications", "addons.application_id", "applications.id")
      .innerJoin("products", "addons.product_id", "products.id")
      .select([
        "tenant_addons.id",
        "tenant_addons.tenant_id",
        "tenant_addons.addon_id",
        "tenant_addons.source",
        "tenant_addons.status",
        "tenant_addons.custom_grant_value",
        "tenant_addons.addon_subscription_id",
        "tenant_addons.entitlement_id",
        "tenant_addons.granted_by",
        "tenant_addons.reason",
        "tenant_addons.activated_at",
        "tenant_addons.cancelled_at",
        "tenant_addons.expires_at",
        "tenant_addons.created_at",
        "tenant_addons.updated_at",
        "addons.code as addon_code",
        "addons.name as addon_name",
        "addons.description as addon_description",
        "applications.code as application_code",
        "products.code as product_code",
        "addons.grant_value",
        "addons.is_unlimited",
      ])
      .where("tenant_addons.id", "=", id)
      .executeTakeFirst();

    return result ? this.mapToTenantAddonWithDetails(result) : null;
  }

  /**
   * Check if tenant already has this addon (active or cancelled)
   */
  async tenantHasAddon(tenantId: string, addonId: string): Promise<boolean> {
    const result = await db
      .selectFrom("tenant_addons")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("addon_id", "=", addonId)
      .where("status", "in", ["ACTIVE", "SUSPENDED"])
      .executeTakeFirst();

    return !!result;
  }

  /**
   * List tenant addons with filters
   */
  async findByTenant(
    tenantId: string,
    params: TenantAddonQueryParams
  ): Promise<{ addons: TenantAddonWithDetails[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("tenant_addons")
      .innerJoin("addons", "tenant_addons.addon_id", "addons.id")
      .innerJoin("applications", "addons.application_id", "applications.id")
      .innerJoin("products", "addons.product_id", "products.id")
      .where("tenant_addons.tenant_id", "=", tenantId);

    let countQuery = db
      .selectFrom("tenant_addons")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId);

    // Apply filters
    if (params.status) {
      query = query.where("tenant_addons.status", "=", params.status);
      countQuery = countQuery.where("status", "=", params.status);
    }

    if (params.source) {
      query = query.where("tenant_addons.source", "=", params.source);
      countQuery = countQuery.where("source", "=", params.source);
    }

    // Execute queries
    const [addons, countResult] = await Promise.all([
      query
        .select([
          "tenant_addons.id",
          "tenant_addons.tenant_id",
          "tenant_addons.addon_id",
          "tenant_addons.source",
          "tenant_addons.status",
          "tenant_addons.custom_grant_value",
          "tenant_addons.addon_subscription_id",
          "tenant_addons.entitlement_id",
          "tenant_addons.granted_by",
          "tenant_addons.reason",
          "tenant_addons.activated_at",
          "tenant_addons.cancelled_at",
          "tenant_addons.expires_at",
          "tenant_addons.created_at",
          "tenant_addons.updated_at",
          "addons.code as addon_code",
          "addons.name as addon_name",
          "addons.description as addon_description",
          "applications.code as application_code",
          "products.code as product_code",
          "addons.grant_value",
          "addons.is_unlimited",
        ])
        .orderBy("tenant_addons.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      addons: addons.map((a) => this.mapToTenantAddonWithDetails(a)),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * Create tenant addon
   */
  async create(data: TenantAddonInsert, trx?: Transaction<DB>): Promise<TenantAddon> {
    const executor = trx || db;
    const now = new Date();

    const tenantAddon = await executor
      .insertInto("tenant_addons")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        addon_id: data.addon_id,
        source: data.source,
        status: (data.status || tenant_addon_status.ACTIVE) as tenant_addon_status,
        custom_grant_value: data.custom_grant_value ?? null,
        addon_subscription_id: data.addon_subscription_id || null,
        entitlement_id: data.entitlement_id || null,
        granted_by: data.granted_by || null,
        reason: data.reason || null,
        activated_at: data.activated_at || now,
        expires_at: data.expires_at || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToTenantAddon(tenantAddon);
  }

  /**
   * Update tenant addon
   */
  async update(id: string, data: TenantAddonUpdate, trx?: Transaction<DB>): Promise<TenantAddon | null> {
    const executor = trx || db;

    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at || new Date(),
    };

    if (data.status !== undefined) updateData.status = data.status;
    if (data.cancelled_at !== undefined) updateData.cancelled_at = data.cancelled_at;
    if (data.entitlement_id !== undefined) updateData.entitlement_id = data.entitlement_id;

    const tenantAddon = await executor
      .updateTable("tenant_addons")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return tenantAddon ? this.mapToTenantAddon(tenantAddon) : null;
  }

  // ============================================
  // EVENTS
  // ============================================

  /**
   * Record tenant addon event
   */
  async createEvent(data: TenantAddonEventInsert, trx?: Transaction<DB>): Promise<TenantAddonEvent> {
    const executor = trx || db;

    const event = await executor
      .insertInto("tenant_addon_events")
      .values({
        id: data.id,
        tenant_addon_id: data.tenant_addon_id,
        tenant_id: data.tenant_id,
        addon_id: data.addon_id,
        event_type: data.event_type as tenant_addon_event_type,
        old_status: (data.old_status || null) as tenant_addon_status | null,
        new_status: (data.new_status || null) as tenant_addon_status | null,
        reason: data.reason || null,
        admin_id: data.admin_id || null,
        is_system: data.is_system || false,
        metadata: data.metadata || null,
        created_at: data.created_at || new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToEvent(event);
  }

  /**
   * Get events for tenant addon
   */
  async getEvents(tenantAddonId: string): Promise<TenantAddonEvent[]> {
    const events = await db
      .selectFrom("tenant_addon_events")
      .selectAll()
      .where("tenant_addon_id", "=", tenantAddonId)
      .orderBy("created_at", "desc")
      .execute();

    return events.map((e) => this.mapToEvent(e));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToTenantAddon(row: Record<string, unknown>): TenantAddon {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      addon_id: row.addon_id as string,
      source: row.source as TenantAddonSource,
      status: row.status as TenantAddonStatus,
      custom_grant_value: row.custom_grant_value ? Number(row.custom_grant_value) : null,
      addon_subscription_id: row.addon_subscription_id as string | null,
      entitlement_id: row.entitlement_id as string | null,
      granted_by: row.granted_by as string | null,
      reason: row.reason as string | null,
      activated_at: row.activated_at as Date,
      cancelled_at: row.cancelled_at as Date | null,
      expires_at: row.expires_at as Date | null,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }

  private mapToTenantAddonWithDetails(row: Record<string, unknown>): TenantAddonWithDetails {
    return {
      ...this.mapToTenantAddon(row),
      addon_code: row.addon_code as string,
      addon_name: row.addon_name as string,
      addon_description: row.addon_description as string | null,
      application_code: row.application_code as string,
      product_code: row.product_code as string,
      grant_value: Number(row.grant_value),
      is_unlimited: row.is_unlimited as boolean,
    };
  }

  private mapToEvent(row: Record<string, unknown>): TenantAddonEvent {
    return {
      id: row.id as string,
      tenant_addon_id: row.tenant_addon_id as string,
      tenant_id: row.tenant_id as string,
      addon_id: row.addon_id as string,
      event_type: row.event_type as string,
      old_status: row.old_status as string | null,
      new_status: row.new_status as string | null,
      reason: row.reason as string | null,
      admin_id: row.admin_id as string | null,
      is_system: row.is_system as boolean,
      metadata: row.metadata,
      created_at: row.created_at as Date,
    };
  }
}

export default new TenantAddonRepository();
