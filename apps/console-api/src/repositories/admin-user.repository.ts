import { db } from "../db/connection";

// Define proper types for repository use
interface AdminUser {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  oauth_provider: string | null;
  oauth_provider_id: string | null;
  status: string;
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface AdminUserInsert {
  id: string;
  email: string;
  password_hash?: string | null;
  name: string;
  avatar_url?: string | null;
  oauth_provider?: string | null;
  oauth_provider_id?: string | null;
  status?: string;
  email_verified?: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AdminUserRoleInsert {
  admin_user_id: string;
  role_id: string;
  assigned_at?: Date;
  assigned_by?: string | null;
}

class AdminUserRepository {
  /**
   * Find admin user by email
   */
  async findByEmail(email: string): Promise<AdminUser | undefined> {
    const result = await db
      .selectFrom("admin_users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      email_verified: result.email_verified as boolean,
      last_login_at: result.last_login_at ? new Date(result.last_login_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find admin user by ID
   */
  async findById(id: string): Promise<AdminUser | undefined> {
    const result = await db
      .selectFrom("admin_users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      email_verified: result.email_verified as boolean,
      last_login_at: result.last_login_at ? new Date(result.last_login_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Create a new admin user
   */
  async create(data: AdminUserInsert): Promise<AdminUser> {
    const result = await db
      .insertInto("admin_users")
      .values({
        id: data.id,
        email: data.email,
        password_hash: data.password_hash ?? null,
        name: data.name,
        avatar_url: data.avatar_url ?? null,
        oauth_provider: data.oauth_provider ?? null,
        oauth_provider_id: data.oauth_provider_id ?? null,
        status: (data.status ?? "ACTIVE") as "ACTIVE" | "SUSPENDED" | "DEACTIVATED",
        email_verified: data.email_verified ?? false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      status: result.status as string,
      email_verified: result.email_verified as boolean,
      last_login_at: result.last_login_at ? new Date(result.last_login_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await db
      .updateTable("admin_users")
      .set({
        last_login_at: new Date(),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Get user roles by user ID
   */
  async getUserRoles(userId: string): Promise<string[]> {
    const results = await db
      .selectFrom("admin_user_roles")
      .innerJoin("admin_roles", "admin_roles.id", "admin_user_roles.role_id")
      .select("admin_roles.code")
      .where("admin_user_roles.admin_user_id", "=", userId)
      .execute();

    return results.map((r) => r.code);
  }

  /**
   * Get all permissions for a user via their roles
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const results = await db
      .selectFrom("admin_user_roles")
      .innerJoin("admin_role_permissions", "admin_role_permissions.role_id", "admin_user_roles.role_id")
      .innerJoin("admin_permissions", "admin_permissions.id", "admin_role_permissions.permission_id")
      .select("admin_permissions.code")
      .where("admin_user_roles.admin_user_id", "=", userId)
      .execute();

    // Return unique permission codes
    return [...new Set(results.map((r) => r.code))];
  }

  /**
   * Assign a role to a user
   */
  async assignRole(data: AdminUserRoleInsert): Promise<void> {
    await db
      .insertInto("admin_user_roles")
      .values({
        admin_user_id: data.admin_user_id,
        role_id: data.role_id,
        assigned_at: data.assigned_at ?? new Date(),
        assigned_by: data.assigned_by ?? null,
      })
      .execute();
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: string, roleCode: string): Promise<boolean> {
    const result = await db
      .selectFrom("admin_user_roles")
      .innerJoin("admin_roles", "admin_roles.id", "admin_user_roles.role_id")
      .select("admin_roles.code")
      .where("admin_user_roles.admin_user_id", "=", userId)
      .where("admin_roles.code", "=", roleCode)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const result = await db
      .selectFrom("admin_user_roles")
      .innerJoin("admin_role_permissions", "admin_role_permissions.role_id", "admin_user_roles.role_id")
      .innerJoin("admin_permissions", "admin_permissions.id", "admin_role_permissions.permission_id")
      .select("admin_permissions.code")
      .where("admin_user_roles.admin_user_id", "=", userId)
      .where("admin_permissions.code", "=", permissionCode)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * List all admin users with optional filtering
   */
  async findAll(params?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: AdminUser[]; total: number }> {
    let query = db.selectFrom("admin_users").selectAll();
    let countQuery = db.selectFrom("admin_users").select(db.fn.count("id").as("count"));

    // Apply status filter
    if (params?.status) {
      query = query.where("status", "=", params.status as "ACTIVE" | "SUSPENDED" | "DEACTIVATED");
      countQuery = countQuery.where("status", "=", params.status as "ACTIVE" | "SUSPENDED" | "DEACTIVATED");
    }

    // Apply search filter (email or name)
    if (params?.search) {
      const searchTerm = `%${params.search.toLowerCase()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("email", "ilike", searchTerm),
          eb("name", "ilike", searchTerm),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("email", "ilike", searchTerm),
          eb("name", "ilike", searchTerm),
        ])
      );
    }

    // Get total count
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    // Apply pagination
    query = query.orderBy("created_at", "desc");
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.offset(params.offset);
    }

    const results = await query.execute();

    const users = results.map((r) => ({
      ...r,
      status: r.status as string,
      email_verified: r.email_verified as boolean,
      last_login_at: r.last_login_at ? new Date(r.last_login_at) : null,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));

    return { users, total };
  }

  /**
   * Update admin user
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      avatar_url: string | null;
      email_verified: boolean;
      status: string;
    }>
  ): Promise<AdminUser | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
    if (data.email_verified !== undefined) updateData.email_verified = data.email_verified;
    if (data.status !== undefined) {
      updateData.status = data.status as "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
    }

    const result = await db
      .updateTable("admin_users")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      email_verified: result.email_verified as boolean,
      last_login_at: result.last_login_at ? new Date(result.last_login_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Soft delete (deactivate) admin user
   */
  async deactivate(id: string): Promise<AdminUser | undefined> {
    return this.update(id, { status: "DEACTIVATED" });
  }

  /**
   * Reactivate a deactivated admin user
   */
  async reactivate(id: string): Promise<AdminUser | undefined> {
    return this.update(id, { status: "ACTIVE" });
  }

  /**
   * Get user roles with full details
   */
  async getUserRolesWithDetails(userId: string): Promise<Array<{
    id: string;
    code: string;
    name: string;
  }>> {
    const results = await db
      .selectFrom("admin_user_roles")
      .innerJoin("admin_roles", "admin_roles.id", "admin_user_roles.role_id")
      .select(["admin_roles.id", "admin_roles.code", "admin_roles.name"])
      .where("admin_user_roles.admin_user_id", "=", userId)
      .execute();

    return results;
  }

  /**
   * Revoke a role from a user
   */
  async revokeRole(userId: string, roleId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("admin_user_roles")
      .where("admin_user_id", "=", userId)
      .where("role_id", "=", roleId)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  /**
   * Check if a user has a specific role by role ID
   */
  async hasRoleById(userId: string, roleId: string): Promise<boolean> {
    const result = await db
      .selectFrom("admin_user_roles")
      .select("role_id")
      .where("admin_user_id", "=", userId)
      .where("role_id", "=", roleId)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Count users with a specific role
   */
  async countUsersWithRole(roleCode: string): Promise<number> {
    const result = await db
      .selectFrom("admin_user_roles")
      .innerJoin("admin_roles", "admin_roles.id", "admin_user_roles.role_id")
      .select(db.fn.count("admin_user_roles.admin_user_id").as("count"))
      .where("admin_roles.code", "=", roleCode)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  /**
   * Check if email exists (for validation)
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("admin_users")
      .select("id")
      .where("email", "=", email.toLowerCase());

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Permanently delete an admin user. Cascading FKs (admin_user_roles) are
   * removed by the DB; nullable FKs are set to null.
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await db
      .deleteFrom("admin_users")
      .where("id", "=", id)
      .executeTakeFirst();
    return BigInt(result.numDeletedRows) > 0n;
  }
}

export default new AdminUserRepository();
