import { db } from "../db/connection";
import { staff_membership_status } from "../db/enums";
import {
  StaffMembershipStatus,
  TenantRoleResponse,
  TenantUserQueryParams,
} from "../types/tenant.type";
import { Transaction } from "kysely";
import { DB } from "../db/types";

// ============================================
// TYPES
// ============================================

interface TenantStaffMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  status: StaffMembershipStatus;
  invited_by: string | null;
  invited_at: Date | null;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TenantStaffMembershipInsert {
  id: string;
  tenant_id: string;
  user_id: string;
  status?: StaffMembershipStatus;
  invited_by?: string | null;
  invited_at?: Date | null;
  joined_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TenantStaffMembershipUpdate {
  status?: StaffMembershipStatus;
  invited_by?: string | null;
  invited_at?: Date | null;
  joined_at?: Date | null;
  updated_at?: Date;
}

interface MembershipWithUser extends TenantStaffMembership {
  user_email: string;
  user_name: string;
  user_avatar_url: string | null;
  user_status: string;
  user_email_verified: boolean;
  user_last_login_at: Date | null;
  user_created_at: Date;
  // Phone/geo/metadata fields
  user_phone: string | null;
  user_phone_verified: boolean;
  user_signup_country: string | null;
  user_signup_city: string | null;
  user_timezone: string | null;
  user_designation: string | null;
  user_login_count: number;
  user_last_login_ip: string | null;
  user_signup_ip: string | null;
}

interface MembershipWithTenant extends TenantStaffMembership {
  tenant_name: string;
  tenant_slug: string;
  tenant_status: string;
}

interface MembershipWithRoles extends TenantStaffMembership {
  roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

// ============================================
// REPOSITORY
// ============================================

class TenantMembershipRepository {
  /**
   * Find membership by ID
   */
  async findById(id: string): Promise<TenantStaffMembership | null> {
    const membership = await db
      .selectFrom("tenant_staff_memberships")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return membership ? this.mapToMembership(membership) : null;
  }

  /**
   * Find membership by tenant and user
   */
  async findByTenantAndUser(
    tenantId: string,
    userId: string
  ): Promise<TenantStaffMembership | null> {
    const membership = await db
      .selectFrom("tenant_staff_memberships")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    return membership ? this.mapToMembership(membership) : null;
  }

  /**
   * Check if user is a member of tenant
   */
  async userIsMemberOfTenant(
    tenantId: string,
    userId: string
  ): Promise<boolean> {
    const result = await db
      .selectFrom("tenant_staff_memberships")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * List memberships for a tenant with user details
   */
  async findByTenant(
    tenantId: string,
    params: TenantUserQueryParams
  ): Promise<{ memberships: MembershipWithUser[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("tenant_staff_memberships")
      .innerJoin("tenant_users", "tenant_staff_memberships.user_id", "tenant_users.id")
      .where("tenant_staff_memberships.tenant_id", "=", tenantId);

    let countQuery = db
      .selectFrom("tenant_staff_memberships")
      .innerJoin("tenant_users", "tenant_staff_memberships.user_id", "tenant_users.id")
      .select(db.fn.countAll().as("count"))
      .where("tenant_staff_memberships.tenant_id", "=", tenantId);

    // Filter by membership status
    if (params.status) {
      query = query.where("tenant_staff_memberships.status", "=", params.status);
      countQuery = countQuery.where("tenant_staff_memberships.status", "=", params.status);
    }

    // Exclude globally suspended users unless specified
    if (!params.include_global_suspended) {
      query = query.where("tenant_users.status", "!=", "SUSPENDED");
      countQuery = countQuery.where("tenant_users.status", "!=", "SUSPENDED");
    }

    // Search by name, email, or phone
    if (params.search) {
      const searchPattern = `%${params.search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("tenant_users.name", "ilike", searchPattern),
          eb("tenant_users.email", "ilike", searchPattern),
          eb("tenant_users.phone", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("tenant_users.name", "ilike", searchPattern),
          eb("tenant_users.email", "ilike", searchPattern),
          eb("tenant_users.phone", "ilike", searchPattern),
        ])
      );
    }

    // Execute queries
    const [memberships, countResult] = await Promise.all([
      query
        .select([
          "tenant_staff_memberships.id",
          "tenant_staff_memberships.tenant_id",
          "tenant_staff_memberships.user_id",
          "tenant_staff_memberships.status",
          "tenant_staff_memberships.invited_by",
          "tenant_staff_memberships.invited_at",
          "tenant_staff_memberships.joined_at",
          "tenant_staff_memberships.created_at",
          "tenant_staff_memberships.updated_at",
          "tenant_users.email as user_email",
          "tenant_users.name as user_name",
          "tenant_users.avatar_url as user_avatar_url",
          "tenant_users.status as user_status",
          "tenant_users.email_verified as user_email_verified",
          "tenant_users.last_login_at as user_last_login_at",
          "tenant_users.created_at as user_created_at",
          "tenant_users.phone as user_phone",
          "tenant_users.phone_verified as user_phone_verified",
          "tenant_users.signup_country as user_signup_country",
          "tenant_users.signup_city as user_signup_city",
          "tenant_users.timezone as user_timezone",
          "tenant_users.designation as user_designation",
          "tenant_users.login_count as user_login_count",
          "tenant_users.last_login_ip as user_last_login_ip",
          "tenant_users.signup_ip as user_signup_ip",
        ])
        .orderBy("tenant_staff_memberships.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      memberships: memberships.map((m) => this.mapToMembershipWithUser(m)),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * List tenants a user belongs to
   */
  async findByUser(
    userId: string,
    params: { page?: number; limit?: number; status?: StaffMembershipStatus }
  ): Promise<{ memberships: MembershipWithTenant[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("tenant_staff_memberships")
      .innerJoin("tenants", "tenant_staff_memberships.tenant_id", "tenants.id")
      .where("tenant_staff_memberships.user_id", "=", userId);

    let countQuery = db
      .selectFrom("tenant_staff_memberships")
      .select(db.fn.countAll().as("count"))
      .where("tenant_staff_memberships.user_id", "=", userId);

    if (params.status) {
      query = query.where("tenant_staff_memberships.status", "=", params.status);
      countQuery = countQuery.where("tenant_staff_memberships.status", "=", params.status);
    }

    const [memberships, countResult] = await Promise.all([
      query
        .select([
          "tenant_staff_memberships.id",
          "tenant_staff_memberships.tenant_id",
          "tenant_staff_memberships.user_id",
          "tenant_staff_memberships.status",
          "tenant_staff_memberships.invited_by",
          "tenant_staff_memberships.invited_at",
          "tenant_staff_memberships.joined_at",
          "tenant_staff_memberships.created_at",
          "tenant_staff_memberships.updated_at",
          "tenants.name as tenant_name",
          "tenants.slug as tenant_slug",
          "tenants.status as tenant_status",
        ])
        .orderBy("tenant_staff_memberships.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      memberships: memberships.map((m) => this.mapToMembershipWithTenant(m)),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * Get membership with roles
   */
  async findByIdWithRoles(id: string): Promise<MembershipWithRoles | null> {
    const membership = await this.findById(id);
    if (!membership) return null;

    const roles = await db
      .selectFrom("tenant_user_roles")
      .innerJoin("tenant_roles", "tenant_user_roles.role_id", "tenant_roles.id")
      .select([
        "tenant_roles.id",
        "tenant_roles.code",
        "tenant_roles.name",
      ])
      .where("tenant_user_roles.membership_id", "=", id)
      .execute();

    return {
      ...membership,
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
      })),
    };
  }

  /**
   * Get roles for multiple membership IDs in one query.
   * Returns a Map of membership_id -> TenantRoleResponse[].
   */
  async getRolesByMembershipIds(
    membershipIds: string[]
  ): Promise<Map<string, TenantRoleResponse[]>> {
    if (membershipIds.length === 0) {
      return new Map();
    }

    const rows = await db
      .selectFrom("tenant_user_roles")
      .innerJoin("tenant_roles", "tenant_user_roles.role_id", "tenant_roles.id")
      .select([
        "tenant_user_roles.membership_id as membership_id",
        "tenant_roles.id",
        "tenant_roles.code",
        "tenant_roles.name",
        "tenant_roles.description",
        "tenant_roles.is_system",
      ])
      .where("tenant_user_roles.membership_id", "in", membershipIds)
      .execute();

    const map = new Map<string, TenantRoleResponse[]>();
    for (const membershipId of membershipIds) {
      map.set(membershipId, []);
    }
    for (const r of rows) {
      const list = map.get(r.membership_id) ?? [];
      list.push({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        is_system: r.is_system,
      });
      map.set(r.membership_id, list);
    }
    return map;
  }

  /**
   * Create a new membership
   */
  async create(
    data: TenantStaffMembershipInsert,
    trx?: Transaction<DB>
  ): Promise<TenantStaffMembership> {
    const executor = trx || db;
    const membership = await executor
      .insertInto("tenant_staff_memberships")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        user_id: data.user_id,
        status: (data.status || staff_membership_status.ACTIVE) as staff_membership_status,
        invited_by: data.invited_by || null,
        invited_at: data.invited_at || null,
        joined_at: data.joined_at || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToMembership(membership);
  }

  /**
   * Update a membership
   */
  async update(
    id: string,
    data: TenantStaffMembershipUpdate,
    trx?: Transaction<DB>
  ): Promise<TenantStaffMembership | null> {
    const executor = trx || db;
    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at || new Date(),
    };

    if (data.status !== undefined) updateData.status = data.status;
    if (data.invited_by !== undefined) updateData.invited_by = data.invited_by;
    if (data.invited_at !== undefined) updateData.invited_at = data.invited_at;
    if (data.joined_at !== undefined) updateData.joined_at = data.joined_at;

    const membership = await executor
      .updateTable("tenant_staff_memberships")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return membership ? this.mapToMembership(membership) : null;
  }

  /**
   * Delete a membership (remove user from tenant)
   */
  async delete(id: string, trx?: Transaction<DB>): Promise<boolean> {
    const executor = trx || db;
    const result = await executor
      .deleteFrom("tenant_staff_memberships")
      .where("id", "=", id)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  /**
   * Assign role to membership
   */
  async assignRole(
    membershipId: string,
    roleId: string,
    assignedBy?: string,
    trx?: Transaction<DB>
  ): Promise<void> {
    const executor = trx || db;
    await executor
      .insertInto("tenant_user_roles")
      .values({
        membership_id: membershipId,
        role_id: roleId,
        assigned_at: new Date(),
        assigned_by: assignedBy || null,
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  /**
   * Revoke role from membership
   */
  async revokeRole(membershipId: string, roleId: string, trx?: Transaction<DB>): Promise<void> {
    const executor = trx || db;
    await executor
      .deleteFrom("tenant_user_roles")
      .where("membership_id", "=", membershipId)
      .where("role_id", "=", roleId)
      .execute();
  }

  /**
   * Count active memberships for a tenant
   */
  async countByTenant(
    tenantId: string,
    status?: StaffMembershipStatus
  ): Promise<number> {
    let query = db
      .selectFrom("tenant_staff_memberships")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId);

    if (status) {
      query = query.where("status", "=", status);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }

  /**
   * Count tenants a user belongs to
   */
  async countByUser(userId: string, status?: StaffMembershipStatus): Promise<number> {
    let query = db
      .selectFrom("tenant_staff_memberships")
      .select(db.fn.countAll().as("count"))
      .where("user_id", "=", userId);

    if (status) {
      query = query.where("status", "=", status);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }

  /**
   * Check if membership has a specific role
   */
  async hasRole(membershipId: string, roleCode: string): Promise<boolean> {
    const result = await db
      .selectFrom("tenant_user_roles")
      .innerJoin("tenant_roles", "tenant_user_roles.role_id", "tenant_roles.id")
      .select("tenant_user_roles.role_id")
      .where("tenant_user_roles.membership_id", "=", membershipId)
      .where("tenant_roles.code", "=", roleCode)
      .executeTakeFirst();

    return !!result;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToMembership(row: Record<string, unknown>): TenantStaffMembership {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      user_id: row.user_id as string,
      status: row.status as StaffMembershipStatus,
      invited_by: row.invited_by as string | null,
      invited_at: row.invited_at as Date | null,
      joined_at: row.joined_at as Date | null,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }

  private mapToMembershipWithUser(row: Record<string, unknown>): MembershipWithUser {
    return {
      ...this.mapToMembership(row),
      user_email: row.user_email as string,
      user_name: row.user_name as string,
      user_avatar_url: row.user_avatar_url as string | null,
      user_status: row.user_status as string,
      user_email_verified: row.user_email_verified as boolean,
      user_last_login_at: row.user_last_login_at as Date | null,
      user_created_at: row.user_created_at as Date,
      user_phone: (row.user_phone as string) ?? null,
      user_phone_verified: (row.user_phone_verified as boolean) ?? false,
      user_signup_country: (row.user_signup_country as string) ?? null,
      user_signup_city: (row.user_signup_city as string) ?? null,
      user_timezone: (row.user_timezone as string) ?? null,
      user_designation: (row.user_designation as string) ?? null,
      user_login_count: typeof row.user_login_count === "string"
        ? parseInt(row.user_login_count, 10) : Number(row.user_login_count ?? 0),
      user_last_login_ip: (row.user_last_login_ip as string) ?? null,
      user_signup_ip: (row.user_signup_ip as string) ?? null,
    };
  }

  private mapToMembershipWithTenant(row: Record<string, unknown>): MembershipWithTenant {
    return {
      ...this.mapToMembership(row),
      tenant_name: row.tenant_name as string,
      tenant_slug: row.tenant_slug as string,
      tenant_status: row.tenant_status as string,
    };
  }
}

export default new TenantMembershipRepository();
