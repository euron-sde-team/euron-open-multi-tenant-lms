import { ulid } from "ulid";
import { db } from "../db/connection";
import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import teamRepository, {
  type Role,
  type Permission,
  type StaffWithRoles,
} from "../repositories/team.repository";
import {
  capabilitiesToPermissionCodes,
  getCapability,
  getCapabilityTree,
  permissionCodesToCapabilities,
  type CapabilityAreaView,
} from "../capabilities";
import tenantUserRepository from "../repositories/tenant-user.repository";
import tenantAuthService from "./tenant-auth.service";
import tenantOrgS3Service from "./tenant-org.s3.service";
import notificationService from "./notification.service";
import logger from "../utils/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Role code that grants full administrative access. Users assigned this role
 * implicitly receive every tenant permission at auth time, no manual
 * role-permission mapping is required when new permissions are introduced.
 */
export const TENANT_ADMIN_ROLE_CODE = "admin";

/**
 * Permissions reserved for the tenant owner (the "super admin") alone. Even the
 * `admin` role does NOT receive these via the auto-grant, they stay locked to
 * `req.tenantUser.isOwner`.
 *
 * This set was previously EMPTY, which meant an admin could do literally
 * everything the owner could: change the payment gateway, alter billing, grant
 * themselves more power, or remove other admins. The owner tier existed in name
 * only.
 *
 * These are the irreversible / money / who-holds-the-keys operations, the usual
 * "root admin" carve-out (everything EXCEPT payment gateways, admin users,
 * upgrades and cancellations).
 */
export const OWNER_ONLY_PERMISSIONS: ReadonlySet<string> = new Set<string>([
  // Money: who gets paid, and how the tenant pays us.
  "gateway.configure",

  // Who holds the keys. Without this an admin could grant themselves anything,
  // which makes every other restriction here meaningless.
  "roles.manage",
  "staff.manage",

  // Who is allowed to sign in: changing auth methods / the Google OAuth client
  // id is an authentication-boundary decision that belongs to the owner alone.
  "settings.auth",
]);

/**
 * Permissions the `admin` role does NOT receive via the auto-grant, but which.
 * unlike OWNER_ONLY_PERMISSIONS, the owner CAN still delegate to a specific
 * role in Team Management.
 *
 * The distinction matters:
 *   - OWNER_ONLY_PERMISSIONS  → owner and ONLY the owner; never delegatable
 *     (stripped from roles at save time, and from delegated roles at read time).
 *   - ADMIN_AUTOGRANT_EXCLUDED → withheld from the admin auto-grant, but honored
 *     when the owner explicitly ticks it for a role. Used ONLY by the admin
 *     auto-pass checks, never by the strip/delegatability guards.
 */
export const ADMIN_AUTOGRANT_EXCLUDED: ReadonlySet<string> = new Set<string>([
  ...OWNER_ONLY_PERMISSIONS,
]);

/**
 * How many custom roles one tenant may create, on top of the shared built-in
 * templates. A cap keeps the roles screen comprehensible; raise it if customers genuinely need more.
 */
export const MAX_CUSTOM_ROLES_PER_TENANT = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface PermissionsByCategory {
  category: string;
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const specials = "!@#$%";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  password += specials[Math.floor(Math.random() * specials.length)];
  password += Math.floor(Math.random() * 10);
  return password;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class TeamService {
  // -------------------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------------------

  /**
   * A tenant sees the shared built-in templates (Admin / Educator / Ops /
   * Finance, `tenant_id IS NULL`) plus any custom roles it has created. It can
   * only ever MODIFY its own. Templates are the starting points you duplicate,
   * never the things you edit.
   */
  async listRoles(tenantId: string): Promise<Role[]> {
    return teamRepository.findAllRoles(tenantId);
  }

  async getRole(tenantId: string, roleId: string): Promise<RoleWithPermissions> {
    const role = await teamRepository.findRoleById(tenantId, roleId);
    if (!role) {
      // Also the answer when the role belongs to another tenant, we never
      // reveal that it exists.
      throw new NotFoundError("Role not found");
    }

    const permissions = await teamRepository.findPermissionsByRoleId(roleId);
    return { ...role, permissions };
  }

  /**
   * Create a custom role. The caller supplies a NAME, "Content Team", and
   * nothing else.
   *
   * `code` is deliberately NOT accepted from the client. It's an internal
   * identifier (the engine matches `role.code === "admin"` for the admin
   * bypass); a tenant admin has no reason to know it exists, and every reason
   * not to be handed a permanent, invisible, typo-able slug on the very first
   * screen. We derive it, and we guarantee it's free.
   */
  async createRole(
    tenantId: string,
    data: {
      name: string;
      description?: string;
    }
  ): Promise<Role> {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestError("Give the role a name");
    }

    // A name a human can't tell apart from an existing one is a footgun, even
    // though the derived codes would differ. Say so in their words.
    const roles = await teamRepository.findAllRoles(tenantId);
    if (roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      throw new ConflictError(`You already have a role called "${name}"`);
    }

    const count = await teamRepository.countCustomRoles(tenantId);
    if (count >= MAX_CUSTOM_ROLES_PER_TENANT) {
      throw new BadRequestError(
        `You can have at most ${MAX_CUSTOM_ROLES_PER_TENANT} custom roles. Delete one to add another.`
      );
    }

    return teamRepository.createRole(tenantId, {
      name,
      code: await this.deriveFreeRoleCode(tenantId, slugify(name)),
      description: data.description?.trim() || null,
      is_system: false,
    });
  }

  /**
   * Copy a role, usually a built-in template, into an editable role of this
   * tenant's own, carrying its permissions across.
   *
   * This is the ONLY way into a custom role from the UI. Templates are shared by
   * every tenant so they can't be edited in place; "Duplicate & edit" gives the
   * admin a sensible starting point (Educator, say) instead of a blank grid of
   * eighty checkboxes.
   */
  async duplicateRole(
    tenantId: string,
    roleId: string,
    data?: { name?: string }
  ): Promise<Role> {
    const source = await teamRepository.findRoleById(tenantId, roleId);
    if (!source) {
      throw new NotFoundError("Role not found");
    }

    const count = await teamRepository.countCustomRoles(tenantId);
    if (count >= MAX_CUSTOM_ROLES_PER_TENANT) {
      throw new BadRequestError(
        `You can have at most ${MAX_CUSTOM_ROLES_PER_TENANT} custom roles. Delete one to add another.`
      );
    }

    const name = data?.name?.trim() || `${source.name} (copy)`;
    const code = await this.deriveFreeRoleCode(tenantId, `${source.code}-copy`);

    const created = await teamRepository.createRole(tenantId, {
      name,
      code,
      description: source.description,
      is_system: false,
    });

    // Carry the source's permissions over, minus anything only the owner may
    // hold, duplicating Admin must not hand out billing or role management.
    const sourcePerms = await teamRepository.findPermissionsByRoleId(roleId);
    const grantable = sourcePerms.filter(
      (p) => !OWNER_ONLY_PERMISSIONS.has(p.code)
    );
    await teamRepository.setRolePermissions(
      created.id,
      grantable.map((p) => p.id)
    );

    return created;
  }

  /**
   * The first free code at or after `base`: `content-team`, else `content-team-2`,
   * `content-team-3`… Used for both creating ("Content Team" → `content-team`)
   * and duplicating (`educator` → `educator-copy`).
   *
   * The user never sees any of this. It exists so the column stays unique.
   */
  private async deriveFreeRoleCode(
    tenantId: string,
    base: string
  ): Promise<string> {
    // A name of only punctuation/emoji slugifies to "", fall back rather than
    // writing an empty code.
    const stem = base || "role";

    for (let n = 1; n <= MAX_CUSTOM_ROLES_PER_TENANT + 2; n++) {
      const candidate = n === 1 ? stem : `${stem}-${n}`;
      const clash = await teamRepository.findRoleByCode(tenantId, candidate);
      if (!clash) return candidate;
    }
    // Unreachable while the cap holds, but never hand back a colliding code.
    throw new ConflictError(
      "Could not find a free role code, rename an existing role and try again."
    );
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    data: { name?: string; description?: string }
  ): Promise<Role> {
    const role = await teamRepository.findRoleById(tenantId, roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    this.assertRoleIsEditable(role);

    const updated = await teamRepository.updateRole(tenantId, roleId, {
      name: data.name,
      description: data.description,
    });

    if (!updated) {
      throw new NotFoundError("Role not found");
    }

    return updated;
  }

  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    const role = await teamRepository.findRoleById(tenantId, roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    this.assertRoleIsEditable(role);

    await teamRepository.deleteRole(tenantId, roleId);
  }

  /**
   * Built-in templates are shared by every tenant, so nobody may edit or delete
   * one, the UI offers "Duplicate & edit" instead, which creates a private
   * copy owned by the tenant.
   */
  private assertRoleIsEditable(role: Role): void {
    if (role.is_system || role.tenant_id === null) {
      throw new ForbiddenError(
        "Built-in roles can't be changed. Duplicate this role to create your own editable copy."
      );
    }
  }

  // -------------------------------------------------------------------------
  // Capabilities, the plain-English layer the admin UI actually uses.
  //
  // An admin ticks "Can create and publish courses"; we translate that into the
  // permission codes the engine enforces. They never see a code. The Advanced
  // view below still exposes raw permissions for the rare power user.
  // -------------------------------------------------------------------------

  /** Areas → features → capabilities, ready to render. */
  getCapabilities(): CapabilityAreaView[] {
    return getCapabilityTree();
  }

  /**
   * What a role can do, expressed as capabilities.
   *
   * `exact: false` means the role's permissions don't map cleanly onto
   * capabilities, someone edited it in the Advanced view. The UI shows it as
   * "Custom" rather than silently misrepresenting it, and the stored codes stay
   * the source of truth.
   */
  async getRoleCapabilities(
    tenantId: string,
    roleId: string
  ): Promise<{ capabilityIds: string[]; exact: boolean }> {
    const role = await teamRepository.findRoleById(tenantId, roleId);
    if (!role) throw new NotFoundError("Role not found");

    const perms = await teamRepository.findPermissionsByRoleId(roleId);
    return permissionCodesToCapabilities(perms.map((p) => p.code));
  }

  /**
   * Save a role by capability. This is the write path the Simple editor uses.
   *
   * Owner-only capabilities (billing, payment gateways, team access) are
   * silently dropped, they belong to the account owner and can never be
   * delegated to a role, no matter what the client sends.
   */
  async setRoleCapabilities(
    tenantId: string,
    roleId: string,
    capabilityIds: string[]
  ): Promise<void> {
    const role = await teamRepository.findRoleById(tenantId, roleId);
    if (!role) throw new NotFoundError("Role not found");

    this.assertRoleIsEditable(role);

    const grantable = capabilityIds.filter((id) => {
      const cap = getCapability(id);
      return cap && !cap.ownerOnly;
    });

    const codes = capabilitiesToPermissionCodes(grantable);
    const perms = await teamRepository.findPermissionsByCodes(codes);

    await teamRepository.setRolePermissions(
      roleId,
      perms.map((p) => p.id)
    );
  }

  // -------------------------------------------------------------------------
  // Permissions (the "Advanced" view, raw codes)
  // -------------------------------------------------------------------------

  async listPermissions(): Promise<PermissionsByCategory[]> {
    const allPerms = await teamRepository.findAllPermissions();

    // Group by category
    const grouped = new Map<string, Permission[]>();
    for (const perm of allPerms) {
      const cat = perm.category || "other";
      const list = grouped.get(cat) || [];
      list.push(perm);
      grouped.set(cat, list);
    }

    return Array.from(grouped.entries()).map(([category, permissions]) => ({
      category,
      permissions,
    }));
  }

  async updateRolePermissions(
    tenantId: string,
    roleId: string,
    permissionIds: string[]
  ): Promise<void> {
    const role = await teamRepository.findRoleById(tenantId, roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    // Changing a template's permissions would change it for EVERY tenant.
    // the exact leak this scoping exists to prevent.
    this.assertRoleIsEditable(role);

    // Strip owner-only permissions. The friendly (capabilities) path already
    // filters these via `!cap.ownerOnly`; the raw-codes "Advanced" path must
    // apply the SAME guard, or a role holding `roles.manage` could grant itself
    // (or any role) staff.manage / roles.manage / gateway.configure and escape
    // the ownerOnly guarantee entirely. See OWNER_ONLY_PERMISSIONS.
    const allPerms = await teamRepository.findAllPermissions();
    const codeById = new Map(allPerms.map((p) => [p.id, p.code]));
    const grantableIds = permissionIds.filter((id) => {
      const code = codeById.get(id);
      return code !== undefined && !OWNER_ONLY_PERMISSIONS.has(code);
    });

    await teamRepository.setRolePermissions(roleId, grantableIds);
  }

  // -------------------------------------------------------------------------
  // Staff management
  // -------------------------------------------------------------------------

  async listStaff(tenantId: string): Promise<(StaffWithRoles & { is_owner: boolean })[]> {
    const staff = await teamRepository.findStaffWithRoles(tenantId);

    // Determine who is the tenant owner
    const tenant = await db
      .selectFrom("tenants")
      .select(["owner_user_id"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    return staff.map((s) => ({
      ...s,
      // Resolve S3 keys to full URLs (keys don't start with http)
      avatar_url:
        s.avatar_url && !s.avatar_url.startsWith("http")
          ? tenantOrgS3Service.getPublicUrl(s.avatar_url)
          : s.avatar_url,
      is_owner: tenant?.owner_user_id === s.user_id,
    }));
  }

  async assignRoles(
    tenantId: string,
    userId: string,
    roleIds: string[],
    assignedBy: string
  ): Promise<void> {
    const membership = await teamRepository.findMembershipByUserAndTenant(
      userId,
      tenantId
    );
    if (!membership) {
      throw new NotFoundError("Staff membership not found");
    }

    // Validate all role IDs exist
    for (const roleId of roleIds) {
      const role = await teamRepository.findRoleById(tenantId, roleId);
      if (!role) {
        throw new BadRequestError(`Role "${roleId}" not found`);
      }
    }

    await teamRepository.setStaffRoles(membership.id, roleIds, assignedBy);
  }

  async removeRole(
    tenantId: string,
    userId: string,
    roleId: string
  ): Promise<void> {
    const membership = await teamRepository.findMembershipByUserAndTenant(
      userId,
      tenantId
    );
    if (!membership) {
      throw new NotFoundError("Staff membership not found");
    }

    await teamRepository.removeRoleFromStaff(membership.id, roleId);
  }

  // -------------------------------------------------------------------------
  // Permission loading (used by auth middleware)
  // -------------------------------------------------------------------------

  async loadUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<{ roles: string[]; permissions: string[]; isOwner: boolean }> {

    // Check if user is tenant owner
    const tenant = await db
      .selectFrom("tenants")
      .select(["owner_user_id"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    const isOwner = tenant?.owner_user_id === userId;

    const { roles, permissions } =
      await teamRepository.findRolesByUserAndTenant(userId, tenantId);

    const roleCodes = roles.map((r) => r.code);
    const isAdmin = roleCodes.includes(TENANT_ADMIN_ROLE_CODE);

    const effectiveAdmin = isAdmin;

    let permissionCodes: string[];
    if (isOwner || effectiveAdmin) {
      // Owners get every permission. Admins get every permission except those
      // excluded from the admin auto-grant (OWNER_ONLY plus admin-restricted
      // codes like videos.download). This auto-grant means new permissions added
      // to the system require no role-permission re-seed for admins.
      const allPerms = await teamRepository.findAllPermissions();
      permissionCodes = allPerms
        .map((p) => p.code)
        .filter((code) => isOwner || !ADMIN_AUTOGRANT_EXCLUDED.has(code));
    } else {
      // Defense-in-depth: even if a strictly owner-only code somehow landed on a
      // delegated role (legacy data, a future write path that forgets the
      // filter), never let it take effect for a non-owner/non-admin holder.
      // NOTE: only OWNER_ONLY_PERMISSIONS is stripped here, admin-restricted-but-
      // delegatable codes (e.g. videos.download) MUST survive when the owner has
      // explicitly granted them to this role.
      permissionCodes = permissions
        .map((p) => p.code)
        .filter((code) => !OWNER_ONLY_PERMISSIONS.has(code));
    }

    return {
      roles: roleCodes,
      permissions: permissionCodes,
      isOwner,
    };
  }

  // -------------------------------------------------------------------------
  // Email check (for invite flow)
  // -------------------------------------------------------------------------

  async checkEmail(
    tenantId: string,
    email: string
  ): Promise<{
    exists: boolean;
    already_member: boolean;
    user?: { id: string; name: string; email: string; avatar_url: string | null };
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await tenantUserRepository.findByEmail(normalizedEmail);
    if (!existingUser) {
      return { exists: false, already_member: false };
    }

    // Check if already a member of this tenant
    const membership = await teamRepository.findMembershipByUserAndTenant(
      existingUser.id,
      tenantId
    );

    return {
      exists: true,
      already_member: !!membership,
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        avatar_url: existingUser.avatar_url ?? null,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Team member management
  // -------------------------------------------------------------------------

  async inviteMember(
    tenantId: string,
    data: { email: string; name: string; roleIds: string[] },
    invitedBy: string
  ): Promise<{ userId: string; email: string; name: string; tempPassword?: string }> {
    // Validate inputs
    if (!data.email || !data.email.includes("@")) {
      throw new BadRequestError("A valid email is required");
    }
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestError("Name is required");
    }
    if (!Array.isArray(data.roleIds) || data.roleIds.length === 0) {
      throw new BadRequestError("At least one role is required");
    }

    const email = data.email.toLowerCase().trim();
    const name = data.name.trim();

    // Validate all role IDs exist
    for (const roleId of data.roleIds) {
      const role = await teamRepository.findRoleById(tenantId, roleId);
      if (!role) {
        throw new BadRequestError(`Role "${roleId}" not found`);
      }
    }

    let userId: string;
    let tempPassword: string | undefined;

    // Check if user already exists
    const existingUser = await tenantUserRepository.findByEmail(email);

    if (existingUser) {
      // Check if they already have a membership for this tenant
      const existingMembership = await teamRepository.findMembershipByUserAndTenant(
        existingUser.id,
        tenantId
      );
      if (existingMembership) {
        throw new ConflictError("User is already a team member of this tenant");
      }

      userId = existingUser.id;
    } else {
      // Create new user with random temp password
      tempPassword = generateTempPassword();
      const passwordHash = await tenantAuthService.hashPassword(tempPassword);
      const now = new Date();

      const newUser = await tenantUserRepository.create({
        id: ulid(),
        email,
        password_hash: passwordHash,
        name,
        status: "ACTIVE",
        email_verified: false,
        created_at: now,
        updated_at: now,
      });

      userId = newUser.id;
    }

    // Create staff membership
    const now = new Date();
    const membershipId = ulid();
    await db
      .insertInto("tenant_staff_memberships")
      .values({
        id: membershipId,
        tenant_id: tenantId,
        user_id: userId,
        status: "ACTIVE" as const,
        joined_at: now,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Assign roles
    await teamRepository.setStaffRoles(membershipId, data.roleIds, invitedBy);

    // Get tenant name, inviter name, and role names for email
    const tenant = await db
      .selectFrom("tenants")
      .select(["name"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    const inviter = await tenantUserRepository.findById(invitedBy);

    // Get role names for email
    const roleNames: string[] = [];
    for (const roleId of data.roleIds) {
      const role = await teamRepository.findRoleById(tenantId, roleId);
      if (role) roleNames.push(role.name);
    }

    const tenantName = tenant?.name ?? "your organization";
    const inviterName = inviter?.name ?? "An administrator";
    const roleName = roleNames.join(", ") || "Team Member";
    const loginUrl = `${config.ADMIN_PORTAL_URL}/login`;

    // Send invitation email (fire-and-forget)
    notificationService
      .sendTeamInvitationEmail(
        email,
        name,
        tenantName,
        inviterName,
        loginUrl,
        tempPassword ?? null,
        roleName,
      )
      .catch((err) => logger.warn(`Failed to send invitation email to ${email}: ${(err as Error).message}`));

    return { userId, email, name, tempPassword };
  }

  async resetMemberPassword(
    tenantId: string,
    userId: string,
    requestedBy: string
  ): Promise<{ tempPassword: string }> {
    // Check membership exists
    const membership = await teamRepository.findMembershipByUserAndTenant(userId, tenantId);
    if (!membership) {
      throw new NotFoundError("Staff member not found in this tenant");
    }

    // Check user exists
    const user = await tenantUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Generate and set new temporary password
    const tempPassword = generateTempPassword();
    const passwordHash = await tenantAuthService.hashPassword(tempPassword);
    await tenantUserRepository.updatePassword(userId, passwordHash);

    // Get tenant name and requester name for email
    const tenant = await db
      .selectFrom("tenants")
      .select(["name"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    const requester = await tenantUserRepository.findById(requestedBy);

    const tenantName = tenant?.name ?? "your organization";
    const resetByName = requester?.name ?? "An administrator";
    const loginUrl = `${config.ADMIN_PORTAL_URL}/login`;

    // Send password reset email (fire-and-forget)
    notificationService
      .sendAdminPasswordResetEmail(
        user.email,
        user.name,
        tenantName,
        resetByName,
        loginUrl,
        tempPassword,
      )
      .catch((err) => logger.warn(`Failed to send password reset email to ${user.email}: ${(err as Error).message}`));

    return { tempPassword };
  }

  /**
   * Suspend or reactivate a staff member.
   *
   * WHY THIS EXISTS: until now the only way to stop someone's access was to
   * DELETE them, which throws away their roles and their history, and can't be
   * undone. Someone on leave, under investigation, or serving notice needs their
   * access switched OFF, not erased.
   *
   * A suspended member keeps their roles and their trail in the Activity Log;
   * they simply cannot sign in. Reactivating restores them exactly as they were.
   */
  async setMemberSuspended(
    tenantId: string,
    userId: string,
    suspended: boolean
  ): Promise<void> {
    // The owner can never be locked out of their own tenant, the same rule that
    // guards removeMember(). Without it, an admin could suspend the owner and
    // nobody would be able to undo it.
    const tenant = await db
      .selectFrom("tenants")
      .select(["owner_user_id"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (tenant?.owner_user_id === userId) {
      throw new ForbiddenError(
        suspended
          ? "The account owner can't be suspended."
          : "The account owner is never suspended."
      );
    }

    const membership = await teamRepository.findMembershipByUserAndTenant(
      userId,
      tenantId
    );
    if (!membership) {
      throw new NotFoundError("Staff member not found in this tenant");
    }

    const status = suspended ? "SUSPENDED" : "ACTIVE";

    // Suspension lives on the MEMBERSHIP, not the user: someone can be suspended
    // in one tenant and active in another. tenant_users.status is global.
    await db
      .updateTable("tenant_staff_memberships")
      .set({ status, updated_at: new Date() })
      .where("id", "=", membership.id)
      .execute();
  }

  async removeMember(tenantId: string, userId: string): Promise<void> {
    // Check if user is the tenant owner, owners cannot be removed
    const tenant = await db
      .selectFrom("tenants")
      .select(["owner_user_id"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (tenant?.owner_user_id === userId) {
      throw new ForbiddenError("Cannot remove the tenant owner");
    }

    // Check membership exists
    const membership = await teamRepository.findMembershipByUserAndTenant(userId, tenantId);
    if (!membership) {
      throw new NotFoundError("Staff member not found in this tenant");
    }

    // Delete roles for this membership
    await db
      .deleteFrom("tenant_user_roles")
      .where("membership_id", "=", membership.id)
      .execute();

    // Delete the membership
    await db
      .deleteFrom("tenant_staff_memberships")
      .where("id", "=", membership.id)
      .execute();
  }

}

/**
 * "Content Team" → "content-team". Purely internal, the tenant never types
 * this, sees this, or needs to know it exists.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: "Créateur" → "createur"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default new TeamService();
