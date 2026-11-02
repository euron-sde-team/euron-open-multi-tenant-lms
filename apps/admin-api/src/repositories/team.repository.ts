import { ulid } from "ulid";
import { db } from "../db/connection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Role {
  id: string;
  /** NULL = a built-in template shared by every tenant. Otherwise the tenant
   *  that owns this custom role. Only own-tenant roles may be edited. */
  tenant_id: string | null;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: Date;
}

export interface CreateRoleData {
  name: string;
  code: string;
  description?: string | null;
  is_system?: boolean;
}

export interface UpdateRoleData {
  name?: string;
  description?: string | null;
}

export interface StaffWithRoles {
  membership_id: string;
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: string;
  joined_at: Date | null;
  roles: Role[];
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

class TeamRepository {
  // -------------------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------------------

  /**
   * Roles a tenant can SEE: its own custom roles plus the built-in templates
   * (`tenant_id IS NULL`), which every tenant shares and starts from.
   *
   * Roles a tenant can WRITE: only its own (`tenant_id = ?`). The templates are
   * never mutated, the editor duplicates one instead. Before `tenant_id`
   * existed this table was global and every tenant could edit every other
   * tenant's roles; that is the leak these filters close.
   */
  async findAllRoles(tenantId: string): Promise<Role[]> {
    const rows = await db
      .selectFrom("tenant_roles")
      .selectAll()
      .where((eb) =>
        eb.or([eb("tenant_id", "=", tenantId), eb("tenant_id", "is", null)])
      )
      // Templates first, then the tenant's own roles, oldest first.
      .orderBy("tenant_id", "asc")
      .orderBy("created_at", "asc")
      .execute();

    return rows.map((r) => ({
      ...r,
      is_system: r.is_system as boolean,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));
  }

  /** Used for the create-role uniqueness check, a code must be free within
   *  this tenant AND must not collide with a template's code. */
  async findRoleByCode(
    tenantId: string,
    code: string
  ): Promise<Role | undefined> {
    const row = await db
      .selectFrom("tenant_roles")
      .selectAll()
      .where("code", "=", code)
      .where((eb) =>
        eb.or([eb("tenant_id", "=", tenantId), eb("tenant_id", "is", null)])
      )
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      ...row,
      is_system: row.is_system as boolean,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /** Visible to this tenant = its own role, or a shared template. Anything else
   *  returns undefined, which the service surfaces as a 404, so one tenant can
   *  never read another's role by guessing an id. */
  async findRoleById(tenantId: string, id: string): Promise<Role | undefined> {
    const row = await db
      .selectFrom("tenant_roles")
      .selectAll()
      .where("id", "=", id)
      .where((eb) =>
        eb.or([eb("tenant_id", "=", tenantId), eb("tenant_id", "is", null)])
      )
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      ...row,
      is_system: row.is_system as boolean,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /** Always creates a role OWNED by the tenant. Templates are seeded, never
   *  created through this path. */
  async createRole(tenantId: string, data: CreateRoleData): Promise<Role> {
    const id = ulid();
    const now = new Date();

    const row = await db
      .insertInto("tenant_roles")
      .values({
        id,
        tenant_id: tenantId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        is_system: data.is_system ?? false,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...row,
      is_system: row.is_system as boolean,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /** Scoped to the tenant's OWN roles, a template (tenant_id NULL) will not
   *  match, so it can never be edited. */
  async updateRole(
    tenantId: string,
    id: string,
    data: UpdateRoleData
  ): Promise<Role | undefined> {
    const now = new Date();
    const row = await db
      .updateTable("tenant_roles")
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        updated_at: now,
      })
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      ...row,
      is_system: row.is_system as boolean,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  /** Custom roles this tenant owns (templates don't count towards the cap). */
  async countCustomRoles(tenantId: string): Promise<number> {
    const row = await db
      .selectFrom("tenant_roles")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    // Kysely returns BIGINT as a string, parse before comparing.
    return row ? parseInt(String(row.count), 10) : 0;
  }

  async deleteRole(tenantId: string, id: string): Promise<void> {
    await db
      .deleteFrom("tenant_role_permissions")
      .where("role_id", "=", id)
      .execute();

    await db
      .deleteFrom("tenant_user_roles")
      .where("role_id", "=", id)
      .execute();

    // Tenant-scoped: a template (tenant_id NULL) or another tenant's role will
    // not match, so it cannot be deleted even if its id is known. The service
    // has already resolved the role within this tenant's visibility, so this is
    // belt-and-braces.
    await db
      .deleteFrom("tenant_roles")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  async findAllPermissions(): Promise<Permission[]> {
    const rows = await db
      .selectFrom("tenant_permissions")
      .selectAll()
      .orderBy("category", "asc")
      .orderBy("code", "asc")
      .execute();

    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at),
    }));
  }

  async findPermissionsByCategory(category: string): Promise<Permission[]> {
    const rows = await db
      .selectFrom("tenant_permissions")
      .selectAll()
      .where("category", "=", category)
      .orderBy("code", "asc")
      .execute();

    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at),
    }));
  }

  // -------------------------------------------------------------------------
  // Role-Permission mappings
  // -------------------------------------------------------------------------

  async findPermissionsByRoleId(roleId: string): Promise<Permission[]> {
    const rows = await db
      .selectFrom("tenant_role_permissions")
      .innerJoin("tenant_permissions", "tenant_permissions.id", "tenant_role_permissions.permission_id")
      .selectAll("tenant_permissions")
      .where("tenant_role_permissions.role_id", "=", roleId)
      .orderBy("tenant_permissions.category", "asc")
      .orderBy("tenant_permissions.code", "asc")
      .execute();

    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at),
    }));
  }

  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    // Delete existing
    await db
      .deleteFrom("tenant_role_permissions")
      .where("role_id", "=", roleId)
      .execute();

    // Insert new
    if (permissionIds.length > 0) {
      await db
        .insertInto("tenant_role_permissions")
        .values(
          permissionIds.map((pid) => ({
            role_id: roleId,
            permission_id: pid,
          }))
        )
        .execute();
    }
  }

  // -------------------------------------------------------------------------
  // Staff roles
  // -------------------------------------------------------------------------

  async findRolesByMembershipId(membershipId: string): Promise<Role[]> {
    const rows = await db
      .selectFrom("tenant_user_roles")
      .innerJoin("tenant_roles", "tenant_roles.id", "tenant_user_roles.role_id")
      .selectAll("tenant_roles")
      .where("tenant_user_roles.membership_id", "=", membershipId)
      .execute();

    return rows.map((r) => ({
      ...r,
      is_system: r.is_system as boolean,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));
  }

  async findRolesByUserAndTenant(
    userId: string,
    tenantId: string
  ): Promise<{ roles: Role[]; permissions: Permission[] }> {
    // Find the membership
    const membership = await db
      .selectFrom("tenant_staff_memberships")
      .select(["id"])
      .where("user_id", "=", userId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!membership) {
      return { roles: [], permissions: [] };
    }

    // Get roles through membership
    const roleRows = await db
      .selectFrom("tenant_user_roles")
      .innerJoin("tenant_roles", "tenant_roles.id", "tenant_user_roles.role_id")
      .selectAll("tenant_roles")
      .where("tenant_user_roles.membership_id", "=", membership.id)
      .execute();

    const roles: Role[] = roleRows.map((r) => ({
      ...r,
      is_system: r.is_system as boolean,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));

    if (roles.length === 0) {
      return { roles: [], permissions: [] };
    }

    // Get permissions for all roles (deduplicated)
    const roleIds = roles.map((r) => r.id);
    const permRows = await db
      .selectFrom("tenant_role_permissions")
      .innerJoin("tenant_permissions", "tenant_permissions.id", "tenant_role_permissions.permission_id")
      .selectAll("tenant_permissions")
      .where("tenant_role_permissions.role_id", "in", roleIds)
      .execute();

    // Deduplicate permissions by id
    const permMap = new Map<string, Permission>();
    for (const r of permRows) {
      if (!permMap.has(r.id)) {
        permMap.set(r.id, {
          ...r,
          created_at: new Date(r.created_at),
        });
      }
    }

    return { roles, permissions: Array.from(permMap.values()) };
  }

  async assignRoleToStaff(
    membershipId: string,
    roleId: string,
    assignedBy: string
  ): Promise<void> {
    await db
      .insertInto("tenant_user_roles")
      .values({
        membership_id: membershipId,
        role_id: roleId,
        assigned_by: assignedBy,
      })
      .onConflict((oc) => oc.columns(["membership_id", "role_id"]).doNothing())
      .execute();
  }

  async removeRoleFromStaff(membershipId: string, roleId: string): Promise<void> {
    await db
      .deleteFrom("tenant_user_roles")
      .where("membership_id", "=", membershipId)
      .where("role_id", "=", roleId)
      .execute();
  }

  async setStaffRoles(
    membershipId: string,
    roleIds: string[],
    assignedBy: string
  ): Promise<void> {
    // Delete existing
    await db
      .deleteFrom("tenant_user_roles")
      .where("membership_id", "=", membershipId)
      .execute();

    // Insert new
    if (roleIds.length > 0) {
      await db
        .insertInto("tenant_user_roles")
        .values(
          roleIds.map((roleId) => ({
            membership_id: membershipId,
            role_id: roleId,
            assigned_by: assignedBy,
          }))
        )
        .execute();
    }
  }

  // -------------------------------------------------------------------------
  // Staff listing with roles
  // -------------------------------------------------------------------------

  async findStaffWithRoles(tenantId: string): Promise<StaffWithRoles[]> {
    // Get all active staff memberships for this tenant
    const memberships = await db
      .selectFrom("tenant_staff_memberships")
      .innerJoin("tenant_users", "tenant_users.id", "tenant_staff_memberships.user_id")
      .select([
        "tenant_staff_memberships.id as membership_id",
        "tenant_staff_memberships.user_id",
        "tenant_staff_memberships.status",
        "tenant_staff_memberships.joined_at",
        "tenant_users.email",
        "tenant_users.name",
        "tenant_users.avatar_url",
      ])
      .where("tenant_staff_memberships.tenant_id", "=", tenantId)
      .execute();

    if (memberships.length === 0) return [];

    // Get all roles for these memberships
    const membershipIds = memberships.map((m) => m.membership_id);
    const roleAssignments = await db
      .selectFrom("tenant_user_roles")
      .innerJoin("tenant_roles", "tenant_roles.id", "tenant_user_roles.role_id")
      .select([
        "tenant_user_roles.membership_id",
        "tenant_roles.id",
        "tenant_roles.tenant_id",
        "tenant_roles.code",
        "tenant_roles.name",
        "tenant_roles.description",
        "tenant_roles.is_system",
        "tenant_roles.created_at",
        "tenant_roles.updated_at",
      ])
      .where("tenant_user_roles.membership_id", "in", membershipIds)
      .execute();

    // Group roles by membership_id
    const rolesByMembership = new Map<string, Role[]>();
    for (const ra of roleAssignments) {
      const roles = rolesByMembership.get(ra.membership_id) || [];
      roles.push({
        id: ra.id,
        tenant_id: ra.tenant_id,
        code: ra.code,
        name: ra.name,
        description: ra.description,
        is_system: ra.is_system as boolean,
        created_at: new Date(ra.created_at),
        updated_at: new Date(ra.updated_at),
      });
      rolesByMembership.set(ra.membership_id, roles);
    }

    return memberships.map((m) => ({
      membership_id: m.membership_id,
      user_id: m.user_id,
      email: m.email,
      name: m.name,
      avatar_url: m.avatar_url,
      status: m.status as string,
      joined_at: m.joined_at ? new Date(m.joined_at) : null,
      roles: rolesByMembership.get(m.membership_id) || [],
    }));
  }

  // -------------------------------------------------------------------------
  // Helpers for seeding
  // -------------------------------------------------------------------------

  async countRoles(): Promise<number> {
    const result = await db
      .selectFrom("tenant_roles")
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    return typeof result.count === "string"
      ? parseInt(result.count, 10)
      : Number(result.count ?? 0);
  }

  async findPermissionByCode(code: string): Promise<Permission | undefined> {
    const row = await db
      .selectFrom("tenant_permissions")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!row) return undefined;
    return { ...row, created_at: new Date(row.created_at) };
  }

  async createPermission(data: {
    code: string;
    name: string;
    description?: string | null;
    category?: string | null;
  }): Promise<Permission> {
    const id = ulid();
    const now = new Date();

    const row = await db
      .insertInto("tenant_permissions")
      .values({
        id,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        created_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ...row, created_at: new Date(row.created_at) };
  }

  async bulkCreatePermissions(
    permissions: Array<{
      code: string;
      name: string;
      description: string | null;
      category: string | null;
    }>
  ): Promise<void> {
    if (permissions.length === 0) return;
    const now = new Date();
    await db
      .insertInto("tenant_permissions")
      .values(
        permissions.map((p) => ({
          id: ulid(),
          code: p.code,
          name: p.name,
          description: p.description,
          category: p.category,
          created_at: now,
        }))
      )
      .execute();
  }

  async findPermissionsByCodes(codes: string[]): Promise<Permission[]> {
    if (codes.length === 0) return [];
    const rows = await db
      .selectFrom("tenant_permissions")
      .selectAll()
      .where("code", "in", codes)
      .execute();

    return rows.map((r) => ({ ...r, created_at: new Date(r.created_at) }));
  }

  /**
   * Find the membership for a given user + tenant
   */
  async findMembershipByUserAndTenant(
    userId: string,
    tenantId: string
  ): Promise<{ id: string; status: string } | undefined> {
    const row = await db
      .selectFrom("tenant_staff_memberships")
      .select(["id", "status"])
      .where("user_id", "=", userId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!row) return undefined;
    return { id: row.id, status: row.status as string };
  }
}

export default new TeamRepository();
