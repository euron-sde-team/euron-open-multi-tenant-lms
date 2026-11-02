import { db } from "../db/connection";

// Define proper types for repository use
interface AdminRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AdminRoleInsert {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_system?: boolean;
  created_at: Date;
  updated_at: Date;
}

class AdminRoleRepository {
  /**
   * Find role by code
   */
  async findByCode(code: string): Promise<AdminRole | undefined> {
    const result = await db
      .selectFrom("admin_roles")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      is_system: result.is_system as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find role by ID
   */
  async findById(id: string): Promise<AdminRole | undefined> {
    const result = await db
      .selectFrom("admin_roles")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      is_system: result.is_system as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Create a new role
   */
  async create(data: AdminRoleInsert): Promise<AdminRole> {
    const result = await db
      .insertInto("admin_roles")
      .values({
        id: data.id,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        is_system: data.is_system ?? false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      is_system: result.is_system as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Get all roles
   */
  async findAll(): Promise<AdminRole[]> {
    const results = await db
      .selectFrom("admin_roles")
      .selectAll()
      .orderBy("name", "asc")
      .execute();

    return results.map((r) => ({
      ...r,
      is_system: r.is_system as boolean,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));
  }

  /**
   * Update a role
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
    }>
  ): Promise<AdminRole | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const result = await db
      .updateTable("admin_roles")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      is_system: result.is_system as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Delete a role (hard delete - only for non-system roles)
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .deleteFrom("admin_roles")
      .where("id", "=", id)
      .where("is_system", "=", false)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  /**
   * Get permissions for a role
   */
  async getRolePermissions(roleId: string): Promise<Array<{
    id: string;
    code: string;
    name: string;
  }>> {
    const results = await db
      .selectFrom("admin_role_permissions")
      .innerJoin("admin_permissions", "admin_permissions.id", "admin_role_permissions.permission_id")
      .select([
        "admin_permissions.id",
        "admin_permissions.code",
        "admin_permissions.name",
      ])
      .where("admin_role_permissions.role_id", "=", roleId)
      .execute();

    return results;
  }

  /**
   * Assign a permission to a role
   */
  async assignPermission(roleId: string, permissionId: string): Promise<void> {
    await db
      .insertInto("admin_role_permissions")
      .values({
        role_id: roleId,
        permission_id: permissionId,
        created_at: new Date(),
      })
      .execute();
  }

  /**
   * Revoke a permission from a role
   */
  async revokePermission(roleId: string, permissionId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("admin_role_permissions")
      .where("role_id", "=", roleId)
      .where("permission_id", "=", permissionId)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  /**
   * Check if role has a specific permission
   */
  async hasPermission(roleId: string, permissionId: string): Promise<boolean> {
    const result = await db
      .selectFrom("admin_role_permissions")
      .select("permission_id")
      .where("role_id", "=", roleId)
      .where("permission_id", "=", permissionId)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Count users assigned to a role
   */
  async countUsersWithRole(roleId: string): Promise<number> {
    const result = await db
      .selectFrom("admin_user_roles")
      .select(db.fn.count("admin_user_id").as("count"))
      .where("role_id", "=", roleId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  /**
   * Check if role code exists (for validation)
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("admin_roles")
      .select("id")
      .where("code", "=", code);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }
}

export default new AdminRoleRepository();
