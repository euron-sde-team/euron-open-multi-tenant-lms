import { Transaction } from "kysely";
import { db } from "../db/connection";
import { tenant_user_status } from "../db/enums";
import { DB } from "../db/types";
import { TenantUserStatus } from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

interface TenantUser {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  oauth_provider: string | null;
  oauth_provider_id: string | null;
  status: TenantUserStatus;
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  phone: string | null;
  phone_verified: boolean;
}

interface TenantUserInsert {
  id: string;
  email: string;
  password_hash?: string | null;
  name: string;
  avatar_url?: string | null;
  oauth_provider?: string | null;
  oauth_provider_id?: string | null;
  status?: TenantUserStatus;
  email_verified?: boolean;
  created_at: Date;
  updated_at: Date;
}

interface TenantUserUpdate {
  email?: string;
  password_hash?: string | null;
  name?: string;
  avatar_url?: string | null;
  status?: TenantUserStatus;
  email_verified?: boolean;
  last_login_at?: Date;
  updated_at?: Date;
  phone?: string | null;
  phone_verified?: boolean;
}

// ============================================
// REPOSITORY
// ============================================

/**
 * Repository for tenant_users - now a GLOBAL user table.
 * Users can belong to multiple tenants via tenant_staff_memberships.
 * This repository handles user-level operations only.
 * For tenant-specific operations (listing users in tenant, roles), use TenantMembershipRepository.
 */
class TenantUserRepository {
  /**
   * Find user by ID
   */
  async findById(id: string): Promise<TenantUser | null> {
    const user = await db
      .selectFrom("tenant_users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return user ? this.mapToTenantUser(user) : null;
  }

  /**
   * Find user by email (globally unique)
   */
  async findByEmail(email: string): Promise<TenantUser | null> {
    const user = await db
      .selectFrom("tenant_users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    return user ? this.mapToTenantUser(user) : null;
  }

  /**
   * Check if email exists globally
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("tenant_users")
      .select("id")
      .where("email", "=", email);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Check if phone exists globally
   */
  async phoneExists(phone: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("tenant_users")
      .select("id")
      .where("phone", "=", phone);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Find user by OAuth provider
   */
  async findByOAuth(provider: string, providerId: string): Promise<TenantUser | null> {
    const user = await db
      .selectFrom("tenant_users")
      .selectAll()
      .where("oauth_provider", "=", provider)
      .where("oauth_provider_id", "=", providerId)
      .executeTakeFirst();

    return user ? this.mapToTenantUser(user) : null;
  }

  /**
   * Create a new user (global)
   */
  async create(data: TenantUserInsert, trx?: Transaction<DB>): Promise<TenantUser> {
    const executor = trx || db;
    const user = await executor
      .insertInto("tenant_users")
      .values({
        id: data.id,
        email: data.email,
        password_hash: data.password_hash || null,
        name: data.name,
        avatar_url: data.avatar_url || null,
        oauth_provider: data.oauth_provider || null,
        oauth_provider_id: data.oauth_provider_id || null,
        status: (data.status || tenant_user_status.ACTIVE) as tenant_user_status,
        email_verified: data.email_verified || false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToTenantUser(user);
  }

  /**
   * Update a user (global fields only)
   */
  async update(id: string, data: TenantUserUpdate, trx?: Transaction<DB>): Promise<TenantUser | null> {
    const executor = trx || db;
    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at || new Date(),
    };

    if (data.email !== undefined) updateData.email = data.email;
    if (data.password_hash !== undefined) updateData.password_hash = data.password_hash;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.email_verified !== undefined) updateData.email_verified = data.email_verified;
    if (data.last_login_at !== undefined) updateData.last_login_at = data.last_login_at;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.phone_verified !== undefined) updateData.phone_verified = data.phone_verified;

    const user = await executor
      .updateTable("tenant_users")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return user ? this.mapToTenantUser(user) : null;
  }

  /**
   * Update last login time
   */
  async updateLastLogin(id: string): Promise<void> {
    await db
      .updateTable("tenant_users")
      .set({
        last_login_at: new Date(),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Count tenants a user owns
   */
  async countOwnedTenants(userId: string): Promise<number> {
    const result = await db
      .selectFrom("tenants")
      .select(db.fn.countAll().as("count"))
      .where("owner_user_id", "=", userId)
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  /**
   * Check if user owns a specific tenant
   */
  async isOwnerOfTenant(userId: string, tenantId: string): Promise<boolean> {
    const result = await db
      .selectFrom("tenants")
      .select("id")
      .where("id", "=", tenantId)
      .where("owner_user_id", "=", userId)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Get IDs of tenants this user owns
   */
  async getOwnedTenantIds(userId: string): Promise<string[]> {
    const results = await db
      .selectFrom("tenants")
      .select("id")
      .where("owner_user_id", "=", userId)
      .execute();

    return results.map((r) => r.id);
  }

  /**
   * Count total users globally (for admin stats)
   */
  async countAll(status?: TenantUserStatus): Promise<number> {
    let query = db
      .selectFrom("tenant_users")
      .select(db.fn.countAll().as("count"));

    if (status) {
      query = query.where("status", "=", status);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }

  /**
   * Search users globally (for admin)
   */
  async search(params: {
    search?: string;
    status?: TenantUserStatus;
    page?: number;
    limit?: number;
  }): Promise<{ users: TenantUser[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = db.selectFrom("tenant_users");
    let countQuery = db
      .selectFrom("tenant_users")
      .select(db.fn.countAll().as("count"));

    if (params.status) {
      query = query.where("status", "=", params.status);
      countQuery = countQuery.where("status", "=", params.status);
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("name", "ilike", searchPattern),
          eb("email", "ilike", searchPattern),
          eb("phone", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("name", "ilike", searchPattern),
          eb("email", "ilike", searchPattern),
          eb("phone", "ilike", searchPattern),
        ])
      );
    }

    const [users, countResult] = await Promise.all([
      query
        .selectAll()
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      users: users.map((u) => this.mapToTenantUser(u)),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * Find all staff users with aggregated details (for /members page)
   * Returns tenant count, primary role, and primary tenant name
   */
  async findAllWithDetails(params: {
    search?: string;
    status?: TenantUserStatus;
    tenant_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    users: {
      id: string;
      email: string;
      name: string;
      avatar_url: string | null;
      status: TenantUserStatus;
      last_login_at: Date | null;
      created_at: Date;
      tenant_count: number;
      primary_role: string | null;
      primary_tenant_name: string | null;
    }[];
    total: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Base query on tenant_users
    let baseQuery = db.selectFrom("tenant_users");
    let countQuery = db.selectFrom("tenant_users").select(db.fn.countAll().as("count"));

    // If filtering by tenant, we need to filter users who have a membership in that tenant
    if (params.tenant_id) {
      // Use inner join to filter by tenant membership
      baseQuery = db
        .selectFrom("tenant_users")
        .innerJoin(
          "tenant_staff_memberships",
          "tenant_users.id",
          "tenant_staff_memberships.user_id"
        )
        .where("tenant_staff_memberships.tenant_id", "=", params.tenant_id);
      countQuery = db
        .selectFrom("tenant_users")
        .innerJoin(
          "tenant_staff_memberships",
          "tenant_users.id",
          "tenant_staff_memberships.user_id"
        )
        .where("tenant_staff_memberships.tenant_id", "=", params.tenant_id)
        .select(db.fn.countAll().as("count"));
    }

    // Apply status filter
    if (params.status) {
      baseQuery = baseQuery.where("status", "=", params.status);
      countQuery = countQuery.where("status", "=", params.status);
    }

    // Apply search filter
    if (params.search) {
      const searchPattern = `%${params.search}%`;
      baseQuery = baseQuery.where((eb) =>
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

    // Execute both queries in parallel
    const [usersResult, countResult] = await Promise.all([
      baseQuery
        .selectAll()
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    // For each user, fetch aggregated data in parallel
    const userIds = usersResult.map((u) => u.id);

    if (userIds.length === 0) {
      return { users: [], total: 0 };
    }

    // Get tenant counts and first tenant/role info
    const membershipInfo = await db
      .selectFrom("tenant_staff_memberships as tsm")
      .leftJoin("tenants", "tsm.tenant_id", "tenants.id")
      .leftJoin("tenant_user_roles as tur", "tsm.id", "tur.membership_id")
      .leftJoin("tenant_roles as tr", "tur.role_id", "tr.id")
      .select([
        "tsm.user_id",
        "tenants.name as tenant_name",
        "tr.name as role_name",
      ])
      .where("tsm.user_id", "in", userIds)
      .orderBy("tsm.created_at", "asc")
      .execute();

    // Build lookup maps
    const tenantCountMap = new Map<string, number>();
    const primaryTenantMap = new Map<string, string | null>();
    const primaryRoleMap = new Map<string, string | null>();

    for (const row of membershipInfo) {
      const userId = row.user_id;
      // Count tenants
      tenantCountMap.set(userId, (tenantCountMap.get(userId) || 0) + 1);
      // Set primary tenant (first one)
      if (!primaryTenantMap.has(userId)) {
        primaryTenantMap.set(userId, row.tenant_name);
      }
      // Set primary role (first one found)
      if (!primaryRoleMap.has(userId) && row.role_name) {
        primaryRoleMap.set(userId, row.role_name);
      }
    }

    return {
      users: usersResult.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        avatar_url: row.avatar_url,
        status: row.status as TenantUserStatus,
        last_login_at: row.last_login_at,
        created_at: row.created_at,
        tenant_count: tenantCountMap.get(row.id) || 0,
        primary_role: primaryRoleMap.get(row.id) || null,
        primary_tenant_name: primaryTenantMap.get(row.id) || null,
      })),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * Find user with all memberships and roles (for detailed view)
   */
  async findUserWithAllMemberships(userId: string) {
    const user = await this.findById(userId);
    if (!user) return null;

    // Fetch memberships with tenant info
    const memberships = await db
      .selectFrom("tenant_staff_memberships")
      .innerJoin("tenants", "tenant_staff_memberships.tenant_id", "tenants.id")
      .selectAll("tenant_staff_memberships")
      .select(["tenants.name as tenant_name", "tenants.slug as tenant_slug"])
      .where("tenant_staff_memberships.user_id", "=", userId)
      .execute();

    // Fetch roles for all memberships
    const membershipIds = memberships.map((m) => m.id);
    const roles =
      membershipIds.length > 0
        ? await db
          .selectFrom("tenant_user_roles")
          .innerJoin(
            "tenant_roles",
            "tenant_user_roles.role_id",
            "tenant_roles.id"
          )
          .select([
            "tenant_user_roles.membership_id",
            "tenant_roles.id",
            "tenant_roles.name",
            "tenant_roles.code",
          ])
          .where("tenant_user_roles.membership_id", "in", membershipIds)
          .execute()
        : [];

    // Combine
    const membershipDetails = memberships.map((m) => {
      const memberRoles = roles
        .filter((r) => r.membership_id === m.id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          code: r.code,
        }));
      return {
        id: m.id,
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name,
        tenant_slug: m.tenant_slug,
        status: m.status,
        joined_at: m.joined_at,
        roles: memberRoles,
      };
    });

    return {
      ...user,
      memberships: membershipDetails,
    };
  }

  /**
   * Find all staff users for Excel export (no pagination).
   * Includes tracking fields and aggregated primary tenant/role.
   */
  async findAllStaffForExport(
    startDate?: Date,
    endDate?: Date
  ): Promise<
    {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      phone_verified: boolean;
      designation: string | null;
      status: string;
      signup_country: string | null;
      signup_city: string | null;
      signup_ip: string | null;
      signup_user_agent: string | null;
      last_login_at: Date | null;
      last_login_ip: string | null;
      login_count: number;
      timezone: string | null;
      created_at: Date;
      primary_tenant_name: string | null;
      primary_role: string | null;
    }[]
  > {
    let query = db.selectFrom("tenant_users").select([
      "id",
      "name",
      "email",
      "phone",
      "phone_verified",
      "designation",
      "status",
      "signup_country",
      "signup_city",
      "signup_ip",
      "signup_user_agent",
      "last_login_at",
      "last_login_ip",
      "login_count",
      "timezone",
      "created_at",
    ]);

    if (startDate) {
      query = query.where("created_at", ">=", startDate);
    }
    if (endDate) {
      query = query.where("created_at", "<=", endDate);
    }

    const users = await query.orderBy("created_at", "desc").execute();

    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);

    // Batch-fetch membership info (same pattern as findAllWithDetails)
    const membershipInfo = await db
      .selectFrom("tenant_staff_memberships as tsm")
      .leftJoin("tenants", "tsm.tenant_id", "tenants.id")
      .leftJoin("tenant_user_roles as tur", "tsm.id", "tur.membership_id")
      .leftJoin("tenant_roles as tr", "tur.role_id", "tr.id")
      .select([
        "tsm.user_id",
        "tenants.name as tenant_name",
        "tr.name as role_name",
      ])
      .where("tsm.user_id", "in", userIds)
      .orderBy("tsm.created_at", "asc")
      .execute();

    const primaryTenantMap = new Map<string, string | null>();
    const primaryRoleMap = new Map<string, string | null>();

    for (const row of membershipInfo) {
      const userId = row.user_id;
      if (!primaryTenantMap.has(userId)) {
        primaryTenantMap.set(userId, row.tenant_name);
      }
      if (!primaryRoleMap.has(userId) && row.role_name) {
        primaryRoleMap.set(userId, row.role_name);
      }
    }

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone as string | null,
      phone_verified: u.phone_verified as boolean,
      designation: u.designation as string | null,
      status: u.status as string,
      signup_country: u.signup_country as string | null,
      signup_city: u.signup_city as string | null,
      signup_ip: u.signup_ip as string | null,
      signup_user_agent: u.signup_user_agent as string | null,
      last_login_at: u.last_login_at as Date | null,
      last_login_ip: u.last_login_ip as string | null,
      login_count: typeof u.login_count === "string" ? parseInt(u.login_count, 10) : Number(u.login_count ?? 0),
      timezone: u.timezone as string | null,
      created_at: u.created_at as Date,
      primary_tenant_name: primaryTenantMap.get(u.id) || null,
      primary_role: primaryRoleMap.get(u.id) || null,
    }));
  }

  /**
   * Find staff users for a specific tenant for Excel export (no pagination).
   * Same as findAllStaffForExport but filtered by tenant via memberships.
   */
  async findByTenantStaffForExport(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      phone_verified: boolean;
      designation: string | null;
      status: string;
      signup_country: string | null;
      signup_city: string | null;
      signup_ip: string | null;
      signup_user_agent: string | null;
      last_login_at: Date | null;
      last_login_ip: string | null;
      login_count: number;
      timezone: string | null;
      created_at: Date;
      primary_tenant_name: string | null;
      primary_role: string | null;
    }[]
  > {
    let query = db
      .selectFrom("tenant_users")
      .innerJoin(
        "tenant_staff_memberships",
        "tenant_users.id",
        "tenant_staff_memberships.user_id"
      )
      .where("tenant_staff_memberships.tenant_id", "=", tenantId)
      .select([
        "tenant_users.id",
        "tenant_users.name",
        "tenant_users.email",
        "tenant_users.phone",
        "tenant_users.phone_verified",
        "tenant_users.designation",
        "tenant_users.status",
        "tenant_users.signup_country",
        "tenant_users.signup_city",
        "tenant_users.signup_ip",
        "tenant_users.signup_user_agent",
        "tenant_users.last_login_at",
        "tenant_users.last_login_ip",
        "tenant_users.login_count",
        "tenant_users.timezone",
        "tenant_users.created_at",
      ]);

    if (startDate) {
      query = query.where("tenant_users.created_at", ">=", startDate);
    }
    if (endDate) {
      query = query.where("tenant_users.created_at", "<=", endDate);
    }

    const users = await query.orderBy("tenant_users.created_at", "desc").execute();

    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);

    // Batch-fetch membership info
    const membershipInfo = await db
      .selectFrom("tenant_staff_memberships as tsm")
      .leftJoin("tenants", "tsm.tenant_id", "tenants.id")
      .leftJoin("tenant_user_roles as tur", "tsm.id", "tur.membership_id")
      .leftJoin("tenant_roles as tr", "tur.role_id", "tr.id")
      .select([
        "tsm.user_id",
        "tenants.name as tenant_name",
        "tr.name as role_name",
      ])
      .where("tsm.user_id", "in", userIds)
      .orderBy("tsm.created_at", "asc")
      .execute();

    const primaryTenantMap = new Map<string, string | null>();
    const primaryRoleMap = new Map<string, string | null>();

    for (const row of membershipInfo) {
      const userId = row.user_id;
      if (!primaryTenantMap.has(userId)) {
        primaryTenantMap.set(userId, row.tenant_name);
      }
      if (!primaryRoleMap.has(userId) && row.role_name) {
        primaryRoleMap.set(userId, row.role_name);
      }
    }

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone as string | null,
      phone_verified: u.phone_verified as boolean,
      designation: u.designation as string | null,
      status: u.status as string,
      signup_country: u.signup_country as string | null,
      signup_city: u.signup_city as string | null,
      signup_ip: u.signup_ip as string | null,
      signup_user_agent: u.signup_user_agent as string | null,
      last_login_at: u.last_login_at as Date | null,
      last_login_ip: u.last_login_ip as string | null,
      login_count: typeof u.login_count === "string" ? parseInt(u.login_count, 10) : Number(u.login_count ?? 0),
      timezone: u.timezone as string | null,
      created_at: u.created_at as Date,
      primary_tenant_name: primaryTenantMap.get(u.id) || null,
      primary_role: primaryRoleMap.get(u.id) || null,
    }));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToTenantUser(row: Record<string, unknown>): TenantUser {
    return {
      id: row.id as string,
      email: row.email as string,
      password_hash: row.password_hash as string | null,
      name: row.name as string,
      avatar_url: row.avatar_url as string | null,
      oauth_provider: row.oauth_provider as string | null,
      oauth_provider_id: row.oauth_provider_id as string | null,
      status: row.status as TenantUserStatus,
      email_verified: row.email_verified as boolean,
      last_login_at: row.last_login_at as Date | null,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
      phone: (row.phone as string | null) ?? null,
      phone_verified: (row.phone_verified as boolean) ?? false,
    };
  }
}

export default new TenantUserRepository();
