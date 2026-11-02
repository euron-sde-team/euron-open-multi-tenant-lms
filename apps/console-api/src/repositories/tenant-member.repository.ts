import { db } from "../db/connection";
import { TenantMemberStatus } from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

export interface TenantMemberQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantMemberStatus;
}

export interface GlobalMemberQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantMemberStatus;
  tenant_id?: string;
}

/** Row shape from tenant_members only (no separate members table) */
export interface TenantMemberWithDetails {
  id: string;
  tenant_id: string;
  status: TenantMemberStatus;
  joined_at: Date;
  invited_by: string | null;
  created_at: Date;
  updated_at: Date;
  email: string | null;
  name: string;
  avatar_url: string | null;
  email_verified: boolean;
  last_login_at: Date | null;
  phone: string | null;
}

export interface GlobalMemberWithDetails extends TenantMemberWithDetails {
  tenant_name: string;
  tenant_slug: string;
}

// ============================================
// REPOSITORY
// ============================================

class TenantMemberRepository {
  /**
   * List tenant members (end-users) with pagination, search, and status filter.
   * Data lives only in tenant_members (no separate members table).
   */
  async findByTenant(
    tenantId: string,
    params: TenantMemberQueryParams
  ): Promise<{ members: TenantMemberWithDetails[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("tenant_members")
      .where("tenant_members.tenant_id", "=", tenantId);

    let countQuery = db
      .selectFrom("tenant_members")
      .select(db.fn.countAll().as("count"))
      .where("tenant_members.tenant_id", "=", tenantId);

    if (params.status) {
      query = query.where("tenant_members.status", "=", params.status);
      countQuery = countQuery.where("tenant_members.status", "=", params.status);
    }

    if (params.search?.trim()) {
      const searchPattern = `%${params.search.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("tenant_members.name", "ilike", searchPattern),
          eb("tenant_members.email", "ilike", searchPattern),
          eb("tenant_members.phone", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("tenant_members.name", "ilike", searchPattern),
          eb("tenant_members.email", "ilike", searchPattern),
          eb("tenant_members.phone", "ilike", searchPattern),
        ])
      );
    }

    const [rows, countResult] = await Promise.all([
      query
        .select([
          "tenant_members.id",
          "tenant_members.tenant_id",
          "tenant_members.status",
          "tenant_members.joined_at",
          "tenant_members.invited_by",
          "tenant_members.created_at",
          "tenant_members.updated_at",
          "tenant_members.email",
          "tenant_members.name",
          "tenant_members.avatar_url",
          "tenant_members.email_verified",
          "tenant_members.last_login_at",
          "tenant_members.phone",
        ])
        .orderBy("tenant_members.joined_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    const total = Number(countResult?.count ?? 0);
    const members: TenantMemberWithDetails[] = rows.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      status: r.status as TenantMemberStatus,
      joined_at: r.joined_at,
      invited_by: r.invited_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      email: r.email,
      name: r.name,
      avatar_url: r.avatar_url,
      email_verified: r.email_verified,
      last_login_at: r.last_login_at,
      phone: r.phone,
    }));

    return { members, total };
  }

  /**
   * List all members (end-users) across all tenants with pagination, search, status, and tenant filter.
   * Data lives only in tenant_members; join tenants for tenant name/slug.
   */
  async findAllMembers(
    params: GlobalMemberQueryParams
  ): Promise<{ members: GlobalMemberWithDetails[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("tenant_members")
      .innerJoin("tenants", "tenant_members.tenant_id", "tenants.id");

    let countQuery = db
      .selectFrom("tenant_members")
      .innerJoin("tenants", "tenant_members.tenant_id", "tenants.id")
      .select(db.fn.countAll().as("count"));

    if (params.tenant_id) {
      query = query.where("tenant_members.tenant_id", "=", params.tenant_id);
      countQuery = countQuery.where("tenant_members.tenant_id", "=", params.tenant_id);
    }

    if (params.status) {
      query = query.where("tenant_members.status", "=", params.status);
      countQuery = countQuery.where("tenant_members.status", "=", params.status);
    }

    if (params.search?.trim()) {
      const searchPattern = `%${params.search.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("tenant_members.name", "ilike", searchPattern),
          eb("tenant_members.email", "ilike", searchPattern),
          eb("tenant_members.phone", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("tenant_members.name", "ilike", searchPattern),
          eb("tenant_members.email", "ilike", searchPattern),
          eb("tenant_members.phone", "ilike", searchPattern),
        ])
      );
    }

    const [rows, countResult] = await Promise.all([
      query
        .select([
          "tenant_members.id",
          "tenant_members.tenant_id",
          "tenant_members.status",
          "tenant_members.joined_at",
          "tenant_members.invited_by",
          "tenant_members.created_at",
          "tenant_members.updated_at",
          "tenant_members.email",
          "tenant_members.name",
          "tenant_members.avatar_url",
          "tenant_members.email_verified",
          "tenant_members.last_login_at",
          "tenant_members.phone",
          "tenants.name as tenant_name",
          "tenants.slug as tenant_slug",
        ])
        .orderBy("tenant_members.joined_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    const total = Number(countResult?.count ?? 0);
    const members: GlobalMemberWithDetails[] = rows.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      status: r.status as TenantMemberStatus,
      joined_at: r.joined_at,
      invited_by: r.invited_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      email: r.email,
      name: r.name,
      avatar_url: r.avatar_url,
      email_verified: r.email_verified,
      last_login_at: r.last_login_at,
      phone: r.phone,
      tenant_name: r.tenant_name,
      tenant_slug: r.tenant_slug,
    }));

    return { members, total };
  }
}

export default new TenantMemberRepository();
