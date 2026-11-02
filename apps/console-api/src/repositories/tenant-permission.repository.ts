import { db } from "../db/connection";
import { TenantPermissionResponse } from "../types/tenant-permission.type";

function mapRowToResponse(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: Date;
}): TenantPermissionResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    created_at: new Date(row.created_at as unknown as string),
  };
}

class TenantPermissionRepository {
  /**
   * List all tenant permissions, optionally filtered by category or search
   */
  async findAll(params?: {
    category?: string;
    search?: string;
  }): Promise<TenantPermissionResponse[]> {
    let query = db
      .selectFrom("tenant_permissions")
      .selectAll()
      .orderBy("category", "asc")
      .orderBy("code", "asc");

    if (params?.category) {
      query = query.where("category", "=", params.category);
    }

    if (params?.search) {
      const search = `%${params.search.toLowerCase()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("code", "ilike", search),
          eb("name", "ilike", search),
        ])
      );
    }

    const rows = await query.execute();
    return rows.map(mapRowToResponse);
  }

  /**
   * Find permission by ID
   */
  async findById(id: string): Promise<TenantPermissionResponse | undefined> {
    const row = await db
      .selectFrom("tenant_permissions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return undefined;
    return mapRowToResponse(row);
  }

  /**
   * Find permission by code
   */
  async findByCode(code: string): Promise<TenantPermissionResponse | undefined> {
    const row = await db
      .selectFrom("tenant_permissions")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!row) return undefined;
    return mapRowToResponse(row);
  }

  /**
   * Check if a permission code already exists
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("tenant_permissions")
      .select("id")
      .where("code", "=", code);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const row = await query.executeTakeFirst();
    return !!row;
  }

  /**
   * Create a new tenant permission
   */
  async create(data: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: string | null;
    created_at: Date;
  }): Promise<TenantPermissionResponse> {
    const row = await db
      .insertInto("tenant_permissions")
      .values({
        id: data.id,
        code: data.code,
        name: data.name,
        description: data.description,
        category: data.category,
        created_at: data.created_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapRowToResponse(row);
  }

  /**
   * Update a tenant permission
   */
  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      category?: string;
    }
  ): Promise<TenantPermissionResponse | undefined> {
    const updatePayload: Record<string, unknown> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.category !== undefined) updatePayload.category = data.category;

    if (Object.keys(updatePayload).length === 0) return this.findById(id);

    const row = await db
      .updateTable("tenant_permissions")
      .set(updatePayload)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!row) return undefined;
    return mapRowToResponse(row);
  }

  /**
   * Delete a tenant permission
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .deleteFrom("tenant_permissions")
      .where("id", "=", id)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  /**
   * Check if a permission is used by any role
   */
  async isUsedByAnyRole(permissionId: string): Promise<boolean> {
    const row = await db
      .selectFrom("tenant_role_permissions")
      .select("role_id")
      .where("permission_id", "=", permissionId)
      .limit(1)
      .executeTakeFirst();

    return !!row;
  }

  /**
   * Get distinct categories
   */
  async findDistinctCategories(): Promise<string[]> {
    const rows = await db
      .selectFrom("tenant_permissions")
      .select("category")
      .distinct()
      .where("category", "is not", null)
      .orderBy("category", "asc")
      .execute();

    return rows.map((r) => r.category).filter((c): c is string => c !== null);
  }
}

export default new TenantPermissionRepository();
