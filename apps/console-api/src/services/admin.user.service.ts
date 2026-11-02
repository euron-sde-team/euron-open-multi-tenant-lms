import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import adminRoleRepository from "../repositories/admin-role.repository";
import adminUserRepository from "../repositories/admin-user.repository";
import {
  AdminUserListResponse,
  AdminUserQueryParams,
  AdminUserResponse,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from "../types/admin.type";
import { AuditActor } from "../types/audit-log.type";
import adminAuthService from "./admin.auth.service";
import auditService from "./audit.service";

class AdminUserService {
  /**
   * Create a new admin user
   */
  async createUser(
    data: CreateAdminUserRequest,
    actor: AuditActor
  ): Promise<AdminUserResponse> {
    const createdBy = actor.adminId ?? "";
    // Validate email uniqueness
    const emailExists = await adminUserRepository.emailExists(data.email.toLowerCase());
    if (emailExists) {
      throw new ConflictError("Email already exists");
    }

    // Validate password
    if (!data.password || data.password.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters");
    }

    // Check if creator is ADMIN (not SUPERADMIN) - restrict role assignments
    const creatorIsSuperAdmin = await adminUserRepository.hasRole(createdBy, "SUPERADMIN");
    const restrictedRoleCodes = ["SUPERADMIN", "ADMIN"];

    // Validate roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      for (const roleId of data.roleIds) {
        const role = await adminRoleRepository.findById(roleId);
        if (!role) {
          throw new NotFoundError(`Role with ID ${roleId} not found`);
        }

        // ADMIN users cannot assign SUPERADMIN or ADMIN roles
        if (!creatorIsSuperAdmin && restrictedRoleCodes.includes(role.code)) {
          throw new ForbiddenError(
            `Cannot assign ${role.code} role. Only SUPERADMIN can assign ${restrictedRoleCodes.join(" or ")} roles.`
          );
        }
      }
    }

    // Hash password
    const passwordHash = await adminAuthService.hashPassword(data.password);

    // Create user
    const now = new Date();
    const user = await adminUserRepository.create({
      id: ulid(),
      email: data.email.toLowerCase().trim(),
      password_hash: passwordHash,
      name: data.name.trim(),
      avatar_url: data.avatar_url ?? null,
      status: "ACTIVE",
      email_verified: false,
      created_at: now,
      updated_at: now,
    });

    // Assign roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      for (const roleId of data.roleIds) {
        await adminUserRepository.assignRole({
          admin_user_id: user.id,
          role_id: roleId,
          assigned_by: createdBy,
        });
      }
    }

    // Get roles for response
    const roles = await adminUserRepository.getUserRolesWithDetails(user.id);

    await auditService.record({
      actor,
      action: "ADMIN_USER_CREATED",
      category: "ADMIN_USER",
      resourceId: user.id,
      resourceLabel: user.email,
      summary: `Created admin user ${user.email}`,
      metadata: { roleIds: data.roleIds ?? [] },
    });

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
      roles,
    };
  }

  /**
   * Get admin user by ID
   */
  async getUserById(id: string): Promise<AdminUserResponse> {
    const user = await adminUserRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Admin user not found");
    }

    const roles = await adminUserRepository.getUserRolesWithDetails(user.id);

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
      roles,
    };
  }

  /**
   * List admin users with optional filtering
   */
  async listUsers(params: AdminUserQueryParams): Promise<AdminUserListResponse> {
    const limit = params.limit ?? 20;
    const page = params.page ?? 1;
    const offset = (page - 1) * limit;

    const { users, total } = await adminUserRepository.findAll({
      status: params.status,
      search: params.search,
      limit,
      offset,
    });

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roles = await adminUserRepository.getUserRolesWithDetails(user.id);
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
          roles,
        };
      })
    );

    return {
      users: usersWithRoles,
      total,
    };
  }

  /**
   * Update admin user
   */
  async updateUser(
    id: string,
    data: UpdateAdminUserRequest,
    actor: AuditActor
  ): Promise<AdminUserResponse> {
    const user = await adminUserRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Admin user not found");
    }

    const updatedUser = await adminUserRepository.update(id, {
      name: data.name?.trim(),
      avatar_url: data.avatar_url,
      email_verified: data.email_verified,
    });

    if (!updatedUser) {
      throw new NotFoundError("Admin user not found");
    }

    const roles = await adminUserRepository.getUserRolesWithDetails(updatedUser.id);

    await auditService.record({
      actor,
      action: "ADMIN_USER_UPDATED",
      category: "ADMIN_USER",
      resourceId: updatedUser.id,
      resourceLabel: updatedUser.email,
      summary: `Updated admin user ${updatedUser.email}`,
      metadata: {
        before: {
          name: user.name,
          avatar_url: user.avatar_url,
          email_verified: user.email_verified,
        },
        after: {
          name: updatedUser.name,
          avatar_url: updatedUser.avatar_url,
          email_verified: updatedUser.email_verified,
        },
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar_url: updatedUser.avatar_url,
      status: updatedUser.status,
      email_verified: updatedUser.email_verified,
      last_login_at: updatedUser.last_login_at,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
      roles,
    };
  }

  /**
   * Deactivate (soft delete) admin user
   */
  async deactivateUser(id: string, actor: AuditActor): Promise<void> {
    const user = await adminUserRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Admin user not found");
    }

    // Cannot deactivate self
    if (id === actor.adminId) {
      throw new ForbiddenError("Cannot deactivate your own account");
    }

    // Check if this is the last SUPERADMIN
    const isSuperAdmin = await adminUserRepository.hasRole(id, "SUPERADMIN");
    if (isSuperAdmin) {
      const superAdminCount = await adminUserRepository.countUsersWithRole("SUPERADMIN");
      if (superAdminCount <= 1) {
        throw new ForbiddenError("Cannot deactivate the last SUPERADMIN");
      }
    }

    await adminUserRepository.deactivate(id);

    await auditService.record({
      actor,
      action: "ADMIN_USER_DEACTIVATED",
      category: "ADMIN_USER",
      resourceId: user.id,
      resourceLabel: user.email,
      summary: `Deactivated admin user ${user.email}`,
    });
  }

  /**
   * Permanently (hard) delete an admin user.
   */
  async deleteUser(id: string, actor: AuditActor): Promise<void> {
    const user = await adminUserRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Admin user not found");
    }

    // Cannot delete self
    if (id === actor.adminId) {
      throw new ForbiddenError("Cannot delete your own account");
    }

    // Cannot delete the last SUPERADMIN
    const isSuperAdmin = await adminUserRepository.hasRole(id, "SUPERADMIN");
    if (isSuperAdmin) {
      const superAdminCount =
        await adminUserRepository.countUsersWithRole("SUPERADMIN");
      if (superAdminCount <= 1) {
        throw new ForbiddenError("Cannot delete the last SUPERADMIN");
      }
    }

    const deleted = await adminUserRepository.hardDelete(id);
    if (!deleted) {
      throw new NotFoundError("Admin user not found");
    }

    await auditService.record({
      actor,
      action: "ADMIN_USER_DELETED",
      category: "ADMIN_USER",
      resourceId: id,
      resourceLabel: user.email,
      summary: `Permanently deleted admin user ${user.email}`,
    });
  }

  /**
   * Reactivate a deactivated admin user
   */
  async reactivateUser(
    id: string,
    actor: AuditActor
  ): Promise<AdminUserResponse> {
    const user = await adminUserRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Admin user not found");
    }

    // Only deactivated or suspended users can be reactivated
    if (user.status === "ACTIVE") {
      throw new BadRequestError("User is already active");
    }

    const updatedUser = await adminUserRepository.reactivate(id);
    if (!updatedUser) {
      throw new NotFoundError("Admin user not found");
    }

    const roles = await adminUserRepository.getUserRolesWithDetails(updatedUser.id);

    await auditService.record({
      actor,
      action: "ADMIN_USER_REACTIVATED",
      category: "ADMIN_USER",
      resourceId: updatedUser.id,
      resourceLabel: updatedUser.email,
      summary: `Reactivated admin user ${updatedUser.email}`,
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar_url: updatedUser.avatar_url,
      status: updatedUser.status,
      email_verified: updatedUser.email_verified,
      last_login_at: updatedUser.last_login_at,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
      roles,
    };
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    actor: AuditActor
  ): Promise<AdminUserResponse> {
    const assignedBy = actor.adminId ?? "";
    const user = await adminUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Admin user not found");
    }

    const role = await adminRoleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    // Check if already assigned
    const hasRole = await adminUserRepository.hasRoleById(userId, roleId);
    if (hasRole) {
      throw new ConflictError("User already has this role");
    }

    // Check if assigner is ADMIN (not SUPERADMIN) - restrict role assignments
    const assignerIsSuperAdmin = await adminUserRepository.hasRole(assignedBy, "SUPERADMIN");
    const restrictedRoleCodes = ["SUPERADMIN", "ADMIN"];

    // ADMIN users cannot assign SUPERADMIN or ADMIN roles
    if (!assignerIsSuperAdmin && restrictedRoleCodes.includes(role.code)) {
      throw new ForbiddenError(
        `Cannot assign ${role.code} role. Only SUPERADMIN can assign ${restrictedRoleCodes.join(" or ")} roles.`
      );
    }

    await adminUserRepository.assignRole({
      admin_user_id: userId,
      role_id: roleId,
      assigned_by: assignedBy,
    });

    await auditService.record({
      actor,
      action: "ADMIN_USER_ROLE_ASSIGNED",
      category: "ADMIN_USER",
      resourceId: user.id,
      resourceLabel: user.email,
      summary: `Assigned role ${role.code} to admin user ${user.email}`,
      metadata: { role_id: role.id, role_code: role.code },
    });

    return this.getUserById(userId);
  }

  /**
   * Revoke role from user
   */
  async revokeRoleFromUser(
    userId: string,
    roleId: string,
    actor: AuditActor
  ): Promise<AdminUserResponse> {
    const revokedBy = actor.adminId ?? "";
    const user = await adminUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Admin user not found");
    }

    const role = await adminRoleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    // Check if user has the role
    const hasRole = await adminUserRepository.hasRoleById(userId, roleId);
    if (!hasRole) {
      throw new NotFoundError("User does not have this role");
    }

    // Cannot remove SUPERADMIN role from self
    if (role.code === "SUPERADMIN" && userId === revokedBy) {
      throw new ForbiddenError("Cannot remove SUPERADMIN role from yourself");
    }

    // Cannot remove SUPERADMIN if it's the last one
    if (role.code === "SUPERADMIN") {
      const superAdminCount = await adminUserRepository.countUsersWithRole("SUPERADMIN");
      if (superAdminCount <= 1) {
        throw new ForbiddenError("Cannot remove the last SUPERADMIN role");
      }
    }

    const revoked = await adminUserRepository.revokeRole(userId, roleId);
    if (!revoked) {
      throw new NotFoundError("Role assignment not found");
    }

    await auditService.record({
      actor,
      action: "ADMIN_USER_ROLE_REVOKED",
      category: "ADMIN_USER",
      resourceId: user.id,
      resourceLabel: user.email,
      summary: `Revoked role ${role.code} from admin user ${user.email}`,
      metadata: { role_id: role.id, role_code: role.code },
    });

    return this.getUserById(userId);
  }
}

export default new AdminUserService();
