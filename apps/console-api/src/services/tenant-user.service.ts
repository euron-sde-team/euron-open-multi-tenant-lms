import bcrypt from "bcrypt";
import { ulid } from "ulid";
import * as XLSX from "xlsx";
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantMembershipRepository from "../repositories/tenant-membership.repository";
import tenantUserRepository from "../repositories/tenant-user.repository";
import tenantRepository from "../repositories/tenant.repository";
import geoService from "./geo.service";
import {
  AssignTenantUserRoleRequest,
  CreateTenantUserRequest,
  GlobalStaffMemberDetailsResponse,
  GlobalStaffMemberListResponse,
  GlobalStaffMemberQueryParams,
  GlobalTenantUserSearchItem,
  GlobalTenantUserSearchListResponse,
  InviteTenantUserRequest,
  TenantRoleResponse,
  TenantStaffMembershipResponse,
  TenantUserListResponse,
  TenantUserQueryParams,
  TenantUserResponse,
  TenantUserStatus,
  TenantUserWithMembershipResponse,
  UpdateTenantMembershipRequest,
  UpdateTenantUserRequest,
  UserTenantsListResponse,
  UserTenantsQueryParams,
} from "../types/tenant.type";
import logger from "../utils/logger";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

/**
 * Service for managing tenant users in M:M model.
 * Users can belong to multiple tenants via memberships.
 * Operations are membership-centric within tenant context.
 */
class TenantUserService {
  /**
   * List users in a tenant (via memberships)
   */
  async listUsers(
    tenantId: string,
    params: TenantUserQueryParams
  ): Promise<TenantUserListResponse> {
    // Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    const page = params.page || 1;
    const limit = params.limit || 50;

    const { memberships, total } = await tenantMembershipRepository.findByTenant(
      tenantId,
      params
    );

    const membershipIds = memberships.map((m) => m.id);
    const rolesByMembership =
      await tenantMembershipRepository.getRolesByMembershipIds(membershipIds);

    return {
      data: memberships.map((m) =>
        this.mapMembershipToUserResponse(
          m,
          tenant.owner_user_id,
          rolesByMembership.get(m.id)
        )
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Search global tenant users by email/name (for admin e.g. owner picker).
   * No tenant context; returns minimal DTO.
   */
  async searchGlobalUsers(params: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<GlobalTenantUserSearchListResponse> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const { users, total } = await tenantUserRepository.search({
      search: params.search,
      page,
      limit,
    });
    const data: GlobalTenantUserSearchItem[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
    }));
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new user and add to tenant, or add existing user to tenant
   * If user with email exists globally, creates membership only
   * If user doesn't exist, creates user + membership
   */
  async createUser(
    tenantId: string,
    data: CreateTenantUserRequest,
    createdBy?: string
  ): Promise<TenantUserWithMembershipResponse> {
    // Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    // Check if user with email already exists globally
    const existingUser = await tenantUserRepository.findByEmail(data.email);

    if (existingUser) {
      // Check if user is already a member of this tenant
      const existingMembership = await tenantMembershipRepository.findByTenantAndUser(
        tenantId,
        existingUser.id
      );
      if (existingMembership) {
        throw new ConflictError(`User with email '${data.email}' is already a member of this tenant`);
      }

      // Add existing user to tenant
      return this.addExistingUserToTenant(
        tenantId,
        existingUser.id,
        data.role_ids,
        createdBy,
        tenant.owner_user_id
      );
    }

    // Create new user and add to tenant
    if (!data.name) {
      throw new BadRequestError("Name is required when creating a new user");
    }

    // Hash password if provided
    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 12);
    }

    const now = new Date();
    const userId = ulid();
    const membershipId = ulid();

    // Create user and membership in transaction
    const result = await db.transaction().execute(async (trx) => {
      // 1. Create user
      const user = await tenantUserRepository.create(
        {
          id: userId,
          email: data.email,
          name: data.name!,
          password_hash: passwordHash,
          status: data.password ? "ACTIVE" : "INVITED",
          created_at: now,
          updated_at: now,
        },
        trx
      );

      // 2. Create membership
      const membership = await tenantMembershipRepository.create(
        {
          id: membershipId,
          tenant_id: tenantId,
          user_id: userId,
          status: data.password ? "ACTIVE" : "INVITED",
          invited_by: createdBy,
          invited_at: now,
          joined_at: data.password ? now : null,
          created_at: now,
          updated_at: now,
        },
        trx
      );

      // 3. Assign initial roles if provided
      if (data.role_ids && data.role_ids.length > 0) {
        for (const roleId of data.role_ids) {
          await tenantMembershipRepository.assignRole(membershipId, roleId, createdBy, trx);
        }
      }

      return { user, membership };
    });

    logger.info(`Created new user '${data.email}' and added to tenant '${tenantId}'`);

    return {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      avatar_url: result.user.avatar_url,
      status: result.user.status,
      email_verified: result.user.email_verified,
      last_login_at: result.user.last_login_at,
      created_at: result.user.created_at,
      updated_at: result.user.updated_at,
      membership_id: result.membership.id,
      tenant_id: tenantId,
      membership_status: result.membership.status,
      joined_at: result.membership.joined_at,
      is_owner: result.user.id === tenant.owner_user_id,
    };
  }

  /**
   * Invite an existing user (by email) to a tenant
   */
  async inviteUser(
    tenantId: string,
    data: InviteTenantUserRequest,
    invitedBy?: string
  ): Promise<TenantUserWithMembershipResponse> {
    // Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    // Find user by email
    const user = await tenantUserRepository.findByEmail(data.email);
    if (!user) {
      throw new NotFoundError(`User with email '${data.email}' not found. Use create endpoint to add new users.`);
    }

    // Check if already a member
    const existingMembership = await tenantMembershipRepository.findByTenantAndUser(
      tenantId,
      user.id
    );
    if (existingMembership) {
      throw new ConflictError(`User with email '${data.email}' is already a member of this tenant`);
    }

    // Create membership with INVITED status
    const now = new Date();
    const membershipId = ulid();

    const membership = await db.transaction().execute(async (trx) => {
      const membership = await tenantMembershipRepository.create(
        {
          id: membershipId,
          tenant_id: tenantId,
          user_id: user.id,
          status: "INVITED",
          invited_by: invitedBy,
          invited_at: now,
          created_at: now,
          updated_at: now,
        },
        trx
      );

      // Assign roles if provided
      if (data.role_ids && data.role_ids.length > 0) {
        for (const roleId of data.role_ids) {
          await tenantMembershipRepository.assignRole(membershipId, roleId, invitedBy, trx);
        }
      }

      return membership;
    });

    logger.info(`Invited user '${data.email}' to tenant '${tenantId}'`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      status: user.status,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      membership_id: membership.id,
      tenant_id: tenantId,
      membership_status: membership.status,
      joined_at: membership.joined_at,
      is_owner: user.id === tenant.owner_user_id,
    };
  }

  /**
   * Get user by ID within tenant context
   */
  async getUserById(
    tenantId: string,
    userId: string
  ): Promise<TenantUserWithMembershipResponse> {
    // Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    // Find user
    const user = await tenantUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    // Find membership
    const membership = await tenantMembershipRepository.findByIdWithRoles(
      await this.getMembershipId(tenantId, userId)
    );
    if (!membership) {
      throw new NotFoundError(`User with ID '${userId}' is not a member of this tenant`);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      status: user.status,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      membership_id: membership.id,
      tenant_id: tenantId,
      membership_status: membership.status,
      joined_at: membership.joined_at,
      roles: membership.roles?.map((r) => ({
        id: r.id,
        tenant_id: tenantId,
        code: r.code,
        name: r.name,
        description: null,
        is_system: false,
      })),
      is_owner: user.id === tenant.owner_user_id,
    };
  }

  /**
   * Update user's global profile fields
   */
  async updateUser(
    tenantId: string,
    userId: string,
    data: UpdateTenantUserRequest
  ): Promise<TenantUserWithMembershipResponse> {
    // Verify tenant and membership exist
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    const membership = await tenantMembershipRepository.findByTenantAndUser(tenantId, userId);
    if (!membership) {
      throw new NotFoundError(`User with ID '${userId}' is not a member of this tenant`);
    }

    const existingUser = await tenantUserRepository.findById(userId);
    if (!existingUser) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    const updatePayload: Parameters<typeof tenantUserRepository.update>[1] = {
      updated_at: new Date(),
    };
    const changedFields: string[] = [];

    if (data.name !== undefined) {
      updatePayload.name = data.name;
      changedFields.push("name");
    }
    if (data.avatar_url !== undefined) {
      updatePayload.avatar_url = data.avatar_url;
      changedFields.push("avatar_url");
    }

    if (data.email !== undefined) {
      const normalizedEmail = data.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new BadRequestError("Invalid email format");
      }
      if (normalizedEmail !== existingUser.email) {
        const taken = await tenantUserRepository.emailExists(normalizedEmail, userId);
        if (taken) {
          throw new ConflictError("Email is already in use");
        }
        updatePayload.email = normalizedEmail;
        updatePayload.email_verified = false;
        changedFields.push("email");
      }
    }

    if (data.phone !== undefined) {
      const rawPhone = typeof data.phone === "string" ? data.phone.trim() : data.phone;
      const normalizedPhone = rawPhone === "" ? null : rawPhone;

      if (normalizedPhone !== null) {
        if (!PHONE_REGEX.test(normalizedPhone)) {
          throw new BadRequestError("Invalid phone number");
        }
      }

      if (normalizedPhone !== existingUser.phone) {
        if (normalizedPhone !== null) {
          const taken = await tenantUserRepository.phoneExists(normalizedPhone, userId);
          if (taken) {
            throw new ConflictError("Phone number is already in use");
          }
        }
        updatePayload.phone = normalizedPhone;
        updatePayload.phone_verified = false;
        changedFields.push("phone");
      }
    }

    const updated = await tenantUserRepository.update(userId, updatePayload);

    if (!updated) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    if (changedFields.length > 0) {
      logger.info(
        `Updated user '${userId}' profile (fields: ${changedFields.join(", ")})`
      );
    }

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatar_url: updated.avatar_url,
      status: updated.status,
      email_verified: updated.email_verified,
      last_login_at: updated.last_login_at,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      phone: updated.phone,
      phone_verified: updated.phone_verified,
      membership_id: membership.id,
      tenant_id: tenantId,
      membership_status: membership.status,
      joined_at: membership.joined_at,
      is_owner: updated.id === tenant.owner_user_id,
    };
  }

  /**
   * Update a staff member's global profile (email/phone/name/avatar) without requiring tenant membership.
   * Used by the /admin/staff-members listing where members may have zero tenant memberships.
   */
  async updateStaffMemberProfile(
    userId: string,
    data: UpdateTenantUserRequest
  ): Promise<{
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    status: TenantUserStatus;
    email_verified: boolean;
    phone: string | null;
    phone_verified: boolean;
    last_login_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }> {
    const existingUser = await tenantUserRepository.findById(userId);
    if (!existingUser) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    const updatePayload: Parameters<typeof tenantUserRepository.update>[1] = {
      updated_at: new Date(),
    };
    const changedFields: string[] = [];

    if (data.name !== undefined) {
      updatePayload.name = data.name;
      changedFields.push("name");
    }
    if (data.avatar_url !== undefined) {
      updatePayload.avatar_url = data.avatar_url;
      changedFields.push("avatar_url");
    }

    if (data.email !== undefined) {
      const normalizedEmail = data.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new BadRequestError("Invalid email format");
      }
      if (normalizedEmail !== existingUser.email) {
        const taken = await tenantUserRepository.emailExists(normalizedEmail, userId);
        if (taken) {
          throw new ConflictError("Email is already in use");
        }
        updatePayload.email = normalizedEmail;
        updatePayload.email_verified = false;
        changedFields.push("email");
      }
    }

    if (data.phone !== undefined) {
      const rawPhone = typeof data.phone === "string" ? data.phone.trim() : data.phone;
      const normalizedPhone = rawPhone === "" ? null : rawPhone;

      if (normalizedPhone !== null) {
        if (!PHONE_REGEX.test(normalizedPhone)) {
          throw new BadRequestError("Invalid phone number");
        }
      }

      if (normalizedPhone !== existingUser.phone) {
        if (normalizedPhone !== null) {
          const taken = await tenantUserRepository.phoneExists(normalizedPhone, userId);
          if (taken) {
            throw new ConflictError("Phone number is already in use");
          }
        }
        updatePayload.phone = normalizedPhone;
        updatePayload.phone_verified = false;
        changedFields.push("phone");
      }
    }

    const updated = await tenantUserRepository.update(userId, updatePayload);

    if (!updated) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    if (changedFields.length > 0) {
      logger.info(
        `Updated staff member '${userId}' profile (fields: ${changedFields.join(", ")})`
      );
    }

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatar_url: updated.avatar_url,
      status: updated.status,
      email_verified: updated.email_verified,
      phone: updated.phone,
      phone_verified: updated.phone_verified,
      last_login_at: updated.last_login_at,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  /**
   * Update user's membership status in tenant
   */
  async updateMembership(
    tenantId: string,
    userId: string,
    data: UpdateTenantMembershipRequest
  ): Promise<TenantUserWithMembershipResponse> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    // Cannot modify owner's membership status
    if (userId === tenant.owner_user_id) {
      throw new BadRequestError("Cannot modify tenant owner's membership status");
    }

    const membership = await tenantMembershipRepository.findByTenantAndUser(tenantId, userId);
    if (!membership) {
      throw new NotFoundError(`User with ID '${userId}' is not a member of this tenant`);
    }

    const updated = await tenantMembershipRepository.update(membership.id, {
      status: data.status,
      joined_at: data.status === "ACTIVE" && !membership.joined_at ? new Date() : undefined,
      updated_at: new Date(),
    });

    if (!updated) {
      throw new NotFoundError(`Membership not found`);
    }

    const user = await tenantUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User not found`);
    }

    logger.info(`Updated membership for user '${userId}' in tenant '${tenantId}' to status '${data.status}'`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      status: user.status,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      membership_id: updated.id,
      tenant_id: tenantId,
      membership_status: updated.status,
      joined_at: updated.joined_at,
      is_owner: false,
    };
  }

  /**
   * Remove user from tenant (delete membership, not user)
   */
  async removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    // Cannot remove owner
    if (userId === tenant.owner_user_id) {
      throw new BadRequestError("Cannot remove tenant owner from tenant");
    }

    const membership = await tenantMembershipRepository.findByTenantAndUser(tenantId, userId);
    if (!membership) {
      throw new NotFoundError(`User with ID '${userId}' is not a member of this tenant`);
    }

    await tenantMembershipRepository.delete(membership.id);
    logger.info(`Removed user '${userId}' from tenant '${tenantId}'`);
  }

  /**
   * Assign role to user's membership in tenant
   */
  async assignRole(
    tenantId: string,
    userId: string,
    data: AssignTenantUserRoleRequest,
    assignedBy?: string
  ): Promise<void> {
    const membership = await tenantMembershipRepository.findByTenantAndUser(tenantId, userId);
    if (!membership) {
      throw new NotFoundError(`User with ID '${userId}' is not a member of this tenant`);
    }

    await tenantMembershipRepository.assignRole(membership.id, data.role_id, assignedBy);
    logger.info(`Assigned role '${data.role_id}' to user '${userId}' in tenant '${tenantId}'`);
  }

  /**
   * Revoke role from user's membership in tenant
   */
  async revokeRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    const membership = await tenantMembershipRepository.findByTenantAndUser(tenantId, userId);
    if (!membership) {
      throw new NotFoundError(`User with ID '${userId}' is not a member of this tenant`);
    }

    await tenantMembershipRepository.revokeRole(membership.id, roleId);
    logger.info(`Revoked role '${roleId}' from user '${userId}' in tenant '${tenantId}'`);
  }

  /**
   * Get user count for tenant
   */
  async getUserCount(tenantId: string): Promise<number> {
    return tenantMembershipRepository.countByTenant(tenantId);
  }

  /**
   * List tenants a user belongs to (for user-centric view)
   */
  async listUserTenants(
    userId: string,
    params: UserTenantsQueryParams
  ): Promise<UserTenantsListResponse> {
    const user = await tenantUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    const page = params.page || 1;
    const limit = params.limit || 50;

    const { memberships, total } = await tenantMembershipRepository.findByUser(userId, params);

    return {
      data: memberships.map((m) => this.mapToMembershipResponse(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get global user by ID (for admin purposes)
   */
  async getGlobalUserById(userId: string): Promise<TenantUserResponse> {
    const user = await tenantUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    const tenantCount = await tenantMembershipRepository.countByUser(userId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      status: user.status,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      tenant_count: tenantCount,
    };
  }

  /**
   * List all staff members globally (for /members page)
   */
  async listAllStaffMembers(params: GlobalStaffMemberQueryParams): Promise<GlobalStaffMemberListResponse> {
    const page = params.page || 1;
    const limit = params.limit || 20;

    const { users, total } = await tenantUserRepository.findAllWithDetails({
      search: params.search,
      status: params.status,
      tenant_id: params.tenant_id,
      page,
      limit,
    });

    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        avatar_url: u.avatar_url,
        status: u.status,
        last_login_at: u.last_login_at,
        created_at: u.created_at,
        tenant_count: u.tenant_count,
        primary_role: u.primary_role,
        primary_tenant_name: u.primary_tenant_name,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get global staff member details including all memberships and roles
   */
  async getGlobalStaffMemberDetails(userId: string): Promise<GlobalStaffMemberDetailsResponse> {
    const user = await tenantUserRepository.findUserWithAllMemberships(userId);
    if (!user) {
      throw new NotFoundError(`User with ID '${userId}' not found`);
    }

    const primaryMembership = user.memberships[0];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      status: user.status,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      tenant_count: user.memberships.length,
      primary_role: primaryMembership?.roles[0]?.name || null,
      primary_tenant_name: primaryMembership?.tenant_name || null,
      phone: user.phone,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name,
        tenant_slug: m.tenant_slug,
        status: m.status,
        joined_at: m.joined_at,
        roles: m.roles,
      })),
    };
  }

  /**
   * Export all staff members as Excel (.xlsx) buffer.
   */
  async exportAllStaffMembers(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const rows = await tenantUserRepository.findAllStaffForExport(startDate, endDate);

    // Batch-resolve geo from all unique last_login_ip values
    const uniqueIps = [...new Set(rows.map((r) => r.last_login_ip).filter(Boolean))] as string[];
    const geoMap = new Map<string, { country: string | null; city: string | null }>();
    await Promise.all(
      uniqueIps.map(async (ip) => {
        const geo = await geoService.getGeoFromIp(ip);
        geoMap.set(ip, geo);
      })
    );

    const sheetRows = rows.map((r) => {
      const loginGeo = r.last_login_ip ? geoMap.get(r.last_login_ip) : null;
      return {
        "Name": r.name,
        "Email": r.email,
        "Phone": r.phone ?? "",
        "Phone Verified": r.phone_verified ? "Yes" : "No",
        "Status": r.status,
        "Designation": r.designation ?? "",
        "Primary Tenant": r.primary_tenant_name ?? "",
        "Primary Role": r.primary_role ?? "",
        "Signup Country": r.signup_country ?? "",
        "Signup City": r.signup_city ?? "",
        "Signup IP": r.signup_ip ?? "",
        "Device": geoService.formatDevice(r.signup_user_agent),
        "Last Login": r.last_login_at
          ? new Date(r.last_login_at).toISOString().replace("T", " ").substring(0, 19)
          : "",
        "Last Login IP": r.last_login_ip ?? "",
        "Last Login Country": loginGeo?.country ?? "",
        "Last Login City": loginGeo?.city ?? "",
        "Login Count": r.login_count,
        "Timezone": r.timezone ?? "",
        "Signed Up": r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff Members");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  /**
   * Export staff members for a specific tenant as Excel (.xlsx) buffer.
   */
  async exportTenantStaffMembers(tenantId: string, startDate?: Date, endDate?: Date): Promise<Buffer> {
    const rows = await tenantUserRepository.findByTenantStaffForExport(tenantId, startDate, endDate);

    // Batch-resolve geo from all unique last_login_ip values
    const uniqueIps = [...new Set(rows.map((r) => r.last_login_ip).filter(Boolean))] as string[];
    const geoMap = new Map<string, { country: string | null; city: string | null }>();
    await Promise.all(
      uniqueIps.map(async (ip) => {
        const geo = await geoService.getGeoFromIp(ip);
        geoMap.set(ip, geo);
      })
    );

    const sheetRows = rows.map((r) => {
      const loginGeo = r.last_login_ip ? geoMap.get(r.last_login_ip) : null;
      return {
        "Name": r.name,
        "Email": r.email,
        "Phone": r.phone ?? "",
        "Phone Verified": r.phone_verified ? "Yes" : "No",
        "Status": r.status,
        "Designation": r.designation ?? "",
        "Primary Role": r.primary_role ?? "",
        "Signup Country": r.signup_country ?? "",
        "Signup City": r.signup_city ?? "",
        "Signup IP": r.signup_ip ?? "",
        "Device": geoService.formatDevice(r.signup_user_agent),
        "Last Login": r.last_login_at
          ? new Date(r.last_login_at).toISOString().replace("T", " ").substring(0, 19)
          : "",
        "Last Login IP": r.last_login_ip ?? "",
        "Last Login Country": loginGeo?.country ?? "",
        "Last Login City": loginGeo?.city ?? "",
        "Login Count": r.login_count,
        "Timezone": r.timezone ?? "",
        "Signed Up": r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tenant Staff Members");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async addExistingUserToTenant(
    tenantId: string,
    userId: string,
    roleIds?: string[],
    addedBy?: string,
    ownerId?: string
  ): Promise<TenantUserWithMembershipResponse> {
    const now = new Date();
    const membershipId = ulid();

    const result = await db.transaction().execute(async (trx) => {
      const membership = await tenantMembershipRepository.create(
        {
          id: membershipId,
          tenant_id: tenantId,
          user_id: userId,
          status: "ACTIVE",
          invited_by: addedBy,
          invited_at: now,
          joined_at: now,
          created_at: now,
          updated_at: now,
        },
        trx
      );

      if (roleIds && roleIds.length > 0) {
        for (const roleId of roleIds) {
          await tenantMembershipRepository.assignRole(membershipId, roleId, addedBy, trx);
        }
      }

      return membership;
    });

    const user = await tenantUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User not found`);
    }

    logger.info(`Added existing user '${user.email}' to tenant '${tenantId}'`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      status: user.status,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      membership_id: result.id,
      tenant_id: tenantId,
      membership_status: result.status,
      joined_at: result.joined_at,
      is_owner: user.id === ownerId,
    };
  }

  private async getMembershipId(tenantId: string, userId: string): Promise<string> {
    const membership = await tenantMembershipRepository.findByTenantAndUser(tenantId, userId);
    if (!membership) {
      throw new NotFoundError(`User with ID '${userId}' is not a member of this tenant`);
    }
    return membership.id;
  }

  private mapMembershipToUserResponse(
    membership: {
      id: string;
      tenant_id: string;
      user_id: string;
      status: string;
      invited_by: string | null;
      invited_at: Date | null;
      joined_at: Date | null;
      created_at: Date;
      updated_at: Date;
      user_email: string;
      user_name: string;
      user_avatar_url: string | null;
      user_status: string;
      user_email_verified: boolean;
      user_last_login_at: Date | null;
      user_created_at: Date;
      user_phone: string | null;
      user_phone_verified: boolean;
      user_signup_country: string | null;
      user_signup_city: string | null;
      user_timezone: string | null;
      user_designation: string | null;
      user_login_count: number;
      user_last_login_ip: string | null;
      user_signup_ip: string | null;
    },
    ownerId: string,
    roles?: TenantRoleResponse[]
  ): TenantUserWithMembershipResponse {
    return {
      id: membership.user_id,
      email: membership.user_email,
      name: membership.user_name,
      avatar_url: membership.user_avatar_url,
      status: membership.user_status as TenantUserWithMembershipResponse["status"],
      email_verified: membership.user_email_verified,
      last_login_at: membership.user_last_login_at,
      created_at: membership.user_created_at,
      updated_at: membership.updated_at,
      phone: membership.user_phone,
      phone_verified: membership.user_phone_verified,
      signup_country: membership.user_signup_country,
      signup_city: membership.user_signup_city,
      timezone: membership.user_timezone,
      designation: membership.user_designation,
      login_count: membership.user_login_count,
      last_login_ip: membership.user_last_login_ip,
      membership_id: membership.id,
      tenant_id: membership.tenant_id,
      membership_status: membership.status as TenantUserWithMembershipResponse["membership_status"],
      joined_at: membership.joined_at,
      is_owner: membership.user_id === ownerId,
      roles: roles?.length ? roles : undefined,
    };
  }

  private mapToMembershipResponse(membership: {
    id: string;
    tenant_id: string;
    user_id: string;
    status: string;
    invited_by: string | null;
    invited_at: Date | null;
    joined_at: Date | null;
    created_at: Date;
    updated_at: Date;
    tenant_name: string;
    tenant_slug: string;
    tenant_status: string;
  }): TenantStaffMembershipResponse {
    return {
      id: membership.id,
      tenant_id: membership.tenant_id,
      user_id: membership.user_id,
      status: membership.status as TenantStaffMembershipResponse["status"],
      invited_by: membership.invited_by,
      invited_at: membership.invited_at,
      joined_at: membership.joined_at,
      created_at: membership.created_at,
      updated_at: membership.updated_at,
      tenant: {
        id: membership.tenant_id,
        name: membership.tenant_name,
        slug: membership.tenant_slug,
        status: membership.tenant_status as "ACTIVE" | "PENDING" | "SUSPENDED" | "CANCELLED",
      },
    };
  }
}

export default new TenantUserService();
