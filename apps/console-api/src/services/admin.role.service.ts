import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import adminPermissionRepository from "../repositories/admin-permission.repository";
import adminRoleRepository from "../repositories/admin-role.repository";
import {
    AdminRoleListResponse,
    AdminRoleQueryParams,
    AdminRoleResponse,
    CreateAdminRoleRequest,
    UpdateAdminRoleRequest,
} from "../types/admin.type";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";

class AdminRoleService {
  /**
   * Create a new role
   */
  async createRole(
    data: CreateAdminRoleRequest,
    actor: AuditActor
  ): Promise<AdminRoleResponse> {
    // Validate code format (uppercase letters, numbers, and underscores only)
    if (!data.code || !/^[A-Z][A-Z0-9_]*$/.test(data.code)) {
      throw new BadRequestError(
        "Role code must start with uppercase letter and contain only uppercase letters, numbers, and underscores"
      );
    }

    // Check if code already exists
    const codeExists = await adminRoleRepository.codeExists(data.code);
    if (codeExists) {
      throw new ConflictError("Role code already exists");
    }

    // Create role
    const now = new Date();
    const role = await adminRoleRepository.create({
      id: ulid(),
      code: data.code, // Keep uppercase as provided
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      is_system: false, // User-created roles are never system roles
      created_at: now,
      updated_at: now,
    });

    // Assign permissions if provided
    if (data.permissionIds && data.permissionIds.length > 0) {
      for (const permissionId of data.permissionIds) {
        const permission = await adminPermissionRepository.findById(permissionId);
        if (!permission) {
          throw new NotFoundError(`Permission with ID ${permissionId} not found`);
        }
        await adminRoleRepository.assignPermission(role.id, permissionId);
      }
    }

    // Get permissions for response
    const permissions = await adminRoleRepository.getRolePermissions(role.id);
    const userCount = await adminRoleRepository.countUsersWithRole(role.id);

    await auditService.record({
      actor,
      action: "ADMIN_ROLE_CREATED",
      category: "ADMIN_ROLE",
      resourceId: role.id,
      resourceLabel: role.code,
      summary: `Created admin role ${role.code} (${role.name})`,
      metadata: { permissionIds: data.permissionIds ?? [] },
    });

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      is_system: role.is_system,
      created_at: role.created_at,
      updated_at: role.updated_at,
      permissions,
      user_count: userCount,
    };
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string): Promise<AdminRoleResponse> {
    const role = await adminRoleRepository.findById(id);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    const permissions = await adminRoleRepository.getRolePermissions(role.id);
    const userCount = await adminRoleRepository.countUsersWithRole(role.id);

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      is_system: role.is_system,
      created_at: role.created_at,
      updated_at: role.updated_at,
      permissions,
      user_count: userCount,
    };
  }

  /**
   * List all roles
   */
  async listRoles(_params: AdminRoleQueryParams): Promise<AdminRoleListResponse> {
    const roles = await adminRoleRepository.findAll();

    // Get permissions and user count for each role
    const rolesWithDetails = await Promise.all(
      roles.map(async (role) => {
        const permissions = await adminRoleRepository.getRolePermissions(role.id);
        const userCount = await adminRoleRepository.countUsersWithRole(role.id);
        return {
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description,
          is_system: role.is_system,
          created_at: role.created_at,
          updated_at: role.updated_at,
          permissions,
          user_count: userCount,
        };
      })
    );

    return {
      roles: rolesWithDetails,
      total: rolesWithDetails.length,
    };
  }

  /**
   * Update a role
   */
  async updateRole(
    id: string,
    data: UpdateAdminRoleRequest,
    actor: AuditActor
  ): Promise<AdminRoleResponse> {
    const role = await adminRoleRepository.findById(id);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    // System roles have limited updates (only name and description)
    const updatedRole = await adminRoleRepository.update(id, {
      name: data.name?.trim(),
      description: data.description?.trim() ?? null,
    });

    if (!updatedRole) {
      throw new NotFoundError("Role not found");
    }

    await auditService.record({
      actor,
      action: "ADMIN_ROLE_UPDATED",
      category: "ADMIN_ROLE",
      resourceId: updatedRole.id,
      resourceLabel: updatedRole.code,
      summary: `Updated admin role ${updatedRole.code}`,
      metadata: {
        before: { name: role.name, description: role.description },
        after: {
          name: updatedRole.name,
          description: updatedRole.description,
        },
      },
    });

    const permissions = await adminRoleRepository.getRolePermissions(updatedRole.id);
    const userCount = await adminRoleRepository.countUsersWithRole(updatedRole.id);

    return {
      id: updatedRole.id,
      code: updatedRole.code,
      name: updatedRole.name,
      description: updatedRole.description,
      is_system: updatedRole.is_system,
      created_at: updatedRole.created_at,
      updated_at: updatedRole.updated_at,
      permissions,
      user_count: userCount,
    };
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string, actor: AuditActor): Promise<void> {
    const role = await adminRoleRepository.findById(id);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    // Cannot delete system roles
    if (role.is_system) {
      throw new ForbiddenError("Cannot delete system role");
    }

    // Check if role has users
    const userCount = await adminRoleRepository.countUsersWithRole(id);
    if (userCount > 0) {
      throw new ForbiddenError(
        `Cannot delete role with ${userCount} assigned user(s). Remove users first.`
      );
    }

    const deleted = await adminRoleRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError("Role not found or is a system role");
    }

    await auditService.record({
      actor,
      action: "ADMIN_ROLE_DELETED",
      category: "ADMIN_ROLE",
      resourceId: id,
      resourceLabel: role.code,
      summary: `Deleted admin role ${role.code}`,
    });
  }

  /**
   * Assign permission to role
   */
  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
    actor: AuditActor
  ): Promise<AdminRoleResponse> {
    const role = await adminRoleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    const permission = await adminPermissionRepository.findById(permissionId);
    if (!permission) {
      throw new NotFoundError("Permission not found");
    }

    // Check if already assigned
    const hasPermission = await adminRoleRepository.hasPermission(roleId, permissionId);
    if (hasPermission) {
      throw new ConflictError("Role already has this permission");
    }

    await adminRoleRepository.assignPermission(roleId, permissionId);

    await auditService.record({
      actor,
      action: "ADMIN_ROLE_PERMISSION_ASSIGNED",
      category: "ADMIN_ROLE",
      resourceId: role.id,
      resourceLabel: role.code,
      summary: `Assigned permission ${permission.code} to role ${role.code}`,
      metadata: { permission_id: permission.id, permission_code: permission.code },
    });

    return this.getRoleById(roleId);
  }

  /**
   * Revoke permission from role
   */
  async revokePermissionFromRole(
    roleId: string,
    permissionId: string,
    actor: AuditActor
  ): Promise<AdminRoleResponse> {
    const role = await adminRoleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    const permission = await adminPermissionRepository.findById(permissionId);
    if (!permission) {
      throw new NotFoundError("Permission not found");
    }

    // Check if role has the permission
    const hasPermission = await adminRoleRepository.hasPermission(roleId, permissionId);
    if (!hasPermission) {
      throw new NotFoundError("Role does not have this permission");
    }

    const revoked = await adminRoleRepository.revokePermission(roleId, permissionId);
    if (!revoked) {
      throw new NotFoundError("Permission assignment not found");
    }

    await auditService.record({
      actor,
      action: "ADMIN_ROLE_PERMISSION_REVOKED",
      category: "ADMIN_ROLE",
      resourceId: role.id,
      resourceLabel: role.code,
      summary: `Revoked permission ${permission.code} from role ${role.code}`,
      metadata: { permission_id: permission.id, permission_code: permission.code },
    });

    return this.getRoleById(roleId);
  }
}

export default new AdminRoleService();
