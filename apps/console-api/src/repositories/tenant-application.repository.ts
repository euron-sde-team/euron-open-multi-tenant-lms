import { db } from "../db/connection";
import { tenant_app_source, tenant_app_status } from "../db/enums";
import { TenantAppSource, TenantAppStatus } from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

export interface TenantApplicationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantAppStatus;
  source?: TenantAppSource;
}

export interface TenantApplicationWithDetails {
  id: string;
  tenant_id: string;
  application_id: string;
  application_code: string;
  application_name: string;
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
  trial_ends_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TenantApplicationUpdate {
  status?: TenantAppStatus;
  suspended_at?: Date | null;
  updated_at?: Date;
}

// ============================================
// REPOSITORY
// ============================================

class TenantApplicationRepository {
  /**
   * Find tenant application by ID (with application details)
   */
  async findByIdWithDetails(
    id: string,
    tenantId: string
  ): Promise<TenantApplicationWithDetails | null> {
    const row = await db
      .selectFrom("tenant_applications")
      .innerJoin("applications", "tenant_applications.application_id", "applications.id")
      .select([
        "tenant_applications.id",
        "tenant_applications.tenant_id",
        "tenant_applications.application_id",
        "applications.code as application_code",
        "applications.name as application_name",
        "tenant_applications.status",
        "tenant_applications.source",
        "tenant_applications.source_subscription_id",
        "tenant_applications.granted_by",
        "tenant_applications.grant_reason",
        "tenant_applications.activated_at",
        "tenant_applications.suspended_at",
        "tenant_applications.trial_ends_at",
        "tenant_applications.created_at",
        "tenant_applications.updated_at",
      ])
      .where("tenant_applications.id", "=", id)
      .where("tenant_applications.tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      application_id: row.application_id,
      application_code: row.application_code,
      application_name: row.application_name,
      status: row.status as TenantAppStatus,
      source: row.source as TenantAppSource,
      source_subscription_id: row.source_subscription_id,
      granted_by: row.granted_by,
      grant_reason: row.grant_reason,
      activated_at: row.activated_at,
      suspended_at: row.suspended_at,
      trial_ends_at: row.trial_ends_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Check if tenant already has an active/trialing assignment for this application
   */
  async findActiveByTenantAndApp(
    tenantId: string,
    applicationId: string
  ): Promise<TenantApplicationWithDetails | null> {
    const row = await db
      .selectFrom("tenant_applications")
      .innerJoin("applications", "tenant_applications.application_id", "applications.id")
      .select([
        "tenant_applications.id",
        "tenant_applications.tenant_id",
        "tenant_applications.application_id",
        "applications.code as application_code",
        "applications.name as application_name",
        "tenant_applications.status",
        "tenant_applications.source",
        "tenant_applications.source_subscription_id",
        "tenant_applications.granted_by",
        "tenant_applications.grant_reason",
        "tenant_applications.activated_at",
        "tenant_applications.suspended_at",
        "tenant_applications.trial_ends_at",
        "tenant_applications.created_at",
        "tenant_applications.updated_at",
      ])
      .where("tenant_applications.tenant_id", "=", tenantId)
      .where("tenant_applications.application_id", "=", applicationId)
      .where("tenant_applications.status", "in", ["ACTIVE", "TRIALING"])
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      application_id: row.application_id,
      application_code: row.application_code,
      application_name: row.application_name,
      status: row.status as TenantAppStatus,
      source: row.source as TenantAppSource,
      source_subscription_id: row.source_subscription_id,
      granted_by: row.granted_by,
      grant_reason: row.grant_reason,
      activated_at: row.activated_at,
      suspended_at: row.suspended_at,
      trial_ends_at: row.trial_ends_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Create a tenant application assignment
   */
  async create(data: TenantApplicationInsert): Promise<TenantApplicationWithDetails> {
    const now = new Date();

    await db
      .insertInto("tenant_applications")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        application_id: data.application_id,
        status: (data.status || tenant_app_status.ACTIVE) as tenant_app_status,
        source: data.source as tenant_app_source,
        source_subscription_id: data.source_subscription_id || null,
        granted_by: data.granted_by || null,
        grant_reason: data.grant_reason || null,
        activated_at: now,
        trial_ends_at: data.trial_ends_at || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .executeTakeFirstOrThrow();

    // Re-fetch with application details
    const result = await this.findByIdWithDetails(data.id, data.tenant_id);
    return result!;
  }

  /**
   * Update a tenant application
   */
  async update(
    id: string,
    tenantId: string,
    data: TenantApplicationUpdate
  ): Promise<TenantApplicationWithDetails | null> {
    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at || new Date(),
    };

    if (data.status !== undefined) updateData.status = data.status;
    if (data.suspended_at !== undefined) updateData.suspended_at = data.suspended_at;

    await db
      .updateTable("tenant_applications")
      .set(updateData)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .execute();

    return this.findByIdWithDetails(id, tenantId);
  }

  /**
   * List tenant applications with pagination, search, and filters.
   * Joins applications table for code/name.
   */
  async findByTenant(
    tenantId: string,
    params: TenantApplicationQueryParams
  ): Promise<{ applications: TenantApplicationWithDetails[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("tenant_applications")
      .innerJoin("applications", "tenant_applications.application_id", "applications.id")
      .where("tenant_applications.tenant_id", "=", tenantId);

    let countQuery = db
      .selectFrom("tenant_applications")
      .innerJoin("applications", "tenant_applications.application_id", "applications.id")
      .select(db.fn.countAll().as("count"))
      .where("tenant_applications.tenant_id", "=", tenantId);

    if (params.status) {
      query = query.where("tenant_applications.status", "=", params.status);
      countQuery = countQuery.where("tenant_applications.status", "=", params.status);
    }

    if (params.source) {
      query = query.where("tenant_applications.source", "=", params.source);
      countQuery = countQuery.where("tenant_applications.source", "=", params.source);
    }

    if (params.search?.trim()) {
      const searchPattern = `%${params.search.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("applications.name", "ilike", searchPattern),
          eb("applications.code", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("applications.name", "ilike", searchPattern),
          eb("applications.code", "ilike", searchPattern),
        ])
      );
    }

    const [rows, countResult] = await Promise.all([
      query
        .select([
          "tenant_applications.id",
          "tenant_applications.tenant_id",
          "tenant_applications.application_id",
          "applications.code as application_code",
          "applications.name as application_name",
          "tenant_applications.status",
          "tenant_applications.source",
          "tenant_applications.source_subscription_id",
          "tenant_applications.granted_by",
          "tenant_applications.grant_reason",
          "tenant_applications.activated_at",
          "tenant_applications.suspended_at",
          "tenant_applications.trial_ends_at",
          "tenant_applications.created_at",
          "tenant_applications.updated_at",
        ])
        .orderBy("tenant_applications.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    const total = Number(countResult?.count ?? 0);
    const applications: TenantApplicationWithDetails[] = rows.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      application_id: r.application_id,
      application_code: r.application_code,
      application_name: r.application_name,
      status: r.status as TenantAppStatus,
      source: r.source as TenantAppSource,
      source_subscription_id: r.source_subscription_id,
      granted_by: r.granted_by,
      grant_reason: r.grant_reason,
      activated_at: r.activated_at,
      suspended_at: r.suspended_at,
      trial_ends_at: r.trial_ends_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return { applications, total };
  }
}

export default new TenantApplicationRepository();
