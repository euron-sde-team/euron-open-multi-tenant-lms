import { db } from "../db/connection";
import { DB } from "../db/types";
import { TenantPermissionResponse } from "../types/tenant-permission.type";
import { TenantRoleResponse } from "../types/tenant.type";
import { Transaction } from "kysely";

function mapRowToResponse(role: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
}): TenantRoleResponse {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    is_system: role.is_system,
  };
}

class TenantRoleRepository {
  /**
   * List all global tenant roles
   */
  async findAll(): Promise<TenantRoleResponse[]> {
    const roles = await db
      .selectFrom("tenant_roles")
      .selectAll()
      .orderBy("name", "asc")
      .execute();

    return roles.map(mapRowToResponse);
  }

  /**
   * Check if a role code already exists (globally).
   * When excludeRoleId is provided, that role is excluded (for update: same code is allowed).
   */
  async codeExists(code: string, excludeRoleId?: string): Promise<boolean> {
    let query = db
      .selectFrom("tenant_roles")
      .select("id")
      .where("code", "=", code);
    if (excludeRoleId) {
      query = query.where("id", "!=", excludeRoleId);
    }
    const row = await query.executeTakeFirst();
    return !!row;
  }

  /**
   * Create a new global tenant role
   */
  async create(data: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    is_system: boolean;
    created_at: Date;
    updated_at: Date;
  }): Promise<TenantRoleResponse> {
    const role = await db
      .insertInto("tenant_roles")
      .values({
        id: data.id,
        code: data.code,
        name: data.name,
        description: data.description,
        is_system: data.is_system,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapRowToResponse(role);
  }

  /**
   * Find role by ID
   */
  async findById(roleId: string): Promise<TenantRoleResponse | undefined> {
    const role = await db
      .selectFrom("tenant_roles")
      .selectAll()
      .where("id", "=", roleId)
      .executeTakeFirst();

    if (!role) return undefined;

    return mapRowToResponse(role);
  }

  /**
   * Update a global tenant role (only provided fields)
   */
  async update(
    roleId: string,
    data: {
      code?: string;
      name?: string;
      description?: string | null;
      updated_at: Date;
    }
  ): Promise<TenantRoleResponse> {
    const updatePayload: Record<string, unknown> = {
      updated_at: data.updated_at,
    };
    if (data.code !== undefined) updatePayload.code = data.code;
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;

    const role = await db
      .updateTable("tenant_roles")
      .set(updatePayload)
      .where("id", "=", roleId)
      .returningAll()
      .executeTakeFirst();

    if (!role) {
      throw new Error(`Role with id ${roleId} not found`);
    }
    return mapRowToResponse(role);
  }

  /**
   * Find role by code (optionally within a transaction)
   */
  async findByCode(
    code: string,
    trx?: Transaction<DB>
  ): Promise<TenantRoleResponse | undefined> {
    const executor = trx ?? db;
    const role = await executor
      .selectFrom("tenant_roles")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!role) return undefined;

    return mapRowToResponse(role);
  }
  // -------------------------------------------------------------------------
  // Role-Permission Mapping
  // -------------------------------------------------------------------------

  /**
   * Get all permissions assigned to a role
   */
  async getPermissions(roleId: string): Promise<TenantPermissionResponse[]> {
    const rows = await db
      .selectFrom("tenant_role_permissions")
      .innerJoin(
        "tenant_permissions",
        "tenant_permissions.id",
        "tenant_role_permissions.permission_id"
      )
      .select([
        "tenant_permissions.id",
        "tenant_permissions.code",
        "tenant_permissions.name",
        "tenant_permissions.description",
        "tenant_permissions.category",
        "tenant_permissions.created_at",
      ])
      .where("tenant_role_permissions.role_id", "=", roleId)
      .orderBy("tenant_permissions.category", "asc")
      .orderBy("tenant_permissions.code", "asc")
      .execute();

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      category: r.category,
      created_at: new Date(r.created_at as unknown as string),
    }));
  }

  /**
   * Replace all permissions for a role (delete + insert)
   */
  async setPermissions(
    roleId: string,
    permissionIds: string[]
  ): Promise<void> {
    await db.transaction().execute(async (trx) => {
      // Delete all existing
      await trx
        .deleteFrom("tenant_role_permissions")
        .where("role_id", "=", roleId)
        .execute();

      // Insert new ones
      if (permissionIds.length > 0) {
        const now = new Date();
        await trx
          .insertInto("tenant_role_permissions")
          .values(
            permissionIds.map((permId) => ({
              role_id: roleId,
              permission_id: permId,
              created_at: now,
            }))
          )
          .execute();
      }
    });
  }

  /**
   * Add a single permission to a role (idempotent)
   */
  async addPermission(roleId: string, permissionId: string): Promise<void> {
    await db
      .insertInto("tenant_role_permissions")
      .values({
        role_id: roleId,
        permission_id: permissionId,
        created_at: new Date(),
      })
      .onConflict((oc) => oc.columns(["role_id", "permission_id"]).doNothing())
      .execute();
  }

  /**
   * Remove a single permission from a role
   */
  async removePermission(roleId: string, permissionId: string): Promise<void> {
    await db
      .deleteFrom("tenant_role_permissions")
      .where("role_id", "=", roleId)
      .where("permission_id", "=", permissionId)
      .execute();
  }

  /**
   * Add multiple permissions to a role (idempotent, additive)
   */
  async addPermissions(
    roleId: string,
    permissionIds: string[]
  ): Promise<void> {
    if (permissionIds.length === 0) return;

    const now = new Date();
    await db
      .insertInto("tenant_role_permissions")
      .values(
        permissionIds.map((permId) => ({
          role_id: roleId,
          permission_id: permId,
          created_at: now,
        }))
      )
      .onConflict((oc) => oc.columns(["role_id", "permission_id"]).doNothing())
      .execute();
  }
}

export default new TenantRoleRepository();
