import { db } from "../db/connection";

// Define proper types for repository use
interface AdminPermission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: Date;
}

interface AdminPermissionInsert {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  created_at: Date;
}

class AdminPermissionRepository {
  /**
   * Find permission by ID
   */
  async findById(id: string): Promise<AdminPermission | undefined> {
    const result = await db
      .selectFrom("admin_permissions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Find permission by code
   */
  async findByCode(code: string): Promise<AdminPermission | undefined> {
    const result = await db
      .selectFrom("admin_permissions")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Create a new permission
   */
  async create(data: AdminPermissionInsert): Promise<AdminPermission> {
    const result = await db
      .insertInto("admin_permissions")
      .values({
        id: data.id,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        created_at: data.created_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Get all permissions with optional filtering
   */
  async findAll(params?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ permissions: AdminPermission[]; total: number }> {
    let query = db.selectFrom("admin_permissions").selectAll();
    let countQuery = db.selectFrom("admin_permissions").select(db.fn.count("id").as("count"));

    // Apply category filter
    if (params?.category) {
      query = query.where("category", "=", params.category);
      countQuery = countQuery.where("category", "=", params.category);
    }

    // Apply search filter
    if (params?.search) {
      const searchTerm = `%${params.search.toLowerCase()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("code", "ilike", searchTerm),
          eb("name", "ilike", searchTerm),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("code", "ilike", searchTerm),
          eb("name", "ilike", searchTerm),
        ])
      );
    }

    // Get total count
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    // Apply ordering and pagination
    query = query.orderBy("category", "asc").orderBy("code", "asc");
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.offset(params.offset);
    }

    const results = await query.execute();

    const permissions = results.map((r) => ({
      ...r,
      created_at: new Date(r.created_at),
    }));

    return { permissions, total };
  }

  /**
   * Update a permission
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      category: string | null;
    }>
  ): Promise<AdminPermission | undefined> {
    // Build update object dynamically
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;

    if (Object.keys(updateData).length === 0) {
      // Nothing to update, just return the current permission
      return this.findById(id);
    }

    const result = await db
      .updateTable("admin_permissions")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Delete a permission (hard delete)
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .deleteFrom("admin_permissions")
      .where("id", "=", id)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  /**
   * Count roles using a permission
   */
  async countRolesWithPermission(permissionId: string): Promise<number> {
    const result = await db
      .selectFrom("admin_role_permissions")
      .select(db.fn.count("role_id").as("count"))
      .where("permission_id", "=", permissionId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  /**
   * Check if permission code exists (for validation)
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("admin_permissions")
      .select("id")
      .where("code", "=", code);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    const results = await db
      .selectFrom("admin_permissions")
      .select("category")
      .distinct()
      .where("category", "is not", null)
      .orderBy("category", "asc")
      .execute();

    return results.map((r) => r.category).filter((c): c is string => c !== null);
  }

  /**
   * Bulk create permissions
   */
  async bulkCreate(permissions: AdminPermissionInsert[]): Promise<AdminPermission[]> {
    if (permissions.length === 0) return [];

    const results = await db
      .insertInto("admin_permissions")
      .values(
        permissions.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description ?? null,
          category: p.category ?? null,
          created_at: p.created_at,
        }))
      )
      .returningAll()
      .execute();

    return results.map((r) => ({
      ...r,
      created_at: new Date(r.created_at),
    }));
  }
}

export default new AdminPermissionRepository();
