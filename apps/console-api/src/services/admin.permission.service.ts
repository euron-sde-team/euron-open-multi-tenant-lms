import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import adminPermissionRepository from "../repositories/admin-permission.repository";
import {
  AdminPermissionListResponse,
  AdminPermissionQueryParams,
  AdminPermissionResponse,
  CreateAdminPermissionRequest,
  UpdateAdminPermissionRequest,
} from "../types/admin.type";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";

class AdminPermissionService {
  /**
   * Create a new permission
   */
  async createPermission(
    data: CreateAdminPermissionRequest,
    actor: AuditActor
  ): Promise<AdminPermissionResponse> {
    // Validate code format (resource.action pattern)
    if (!data.code || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(data.code)) {
      throw new BadRequestError(
        "Permission code must follow format: resource.action (e.g., tenants.manage)"
      );
    }

    // Check if code already exists
    const codeExists = await adminPermissionRepository.codeExists(data.code);
    if (codeExists) {
      throw new ConflictError("Permission code already exists");
    }

    // Create permission
    const now = new Date();
    const permission = await adminPermissionRepository.create({
      id: ulid(),
      code: data.code.toLowerCase(),
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      category: data.category?.toLowerCase().trim() ?? null,
      created_at: now,
    });

    const roleCount = await adminPermissionRepository.countRolesWithPermission(permission.id);

    await auditService.record({
      actor,
      action: "ADMIN_PERMISSION_CREATED",
      category: "ADMIN_PERMISSION",
      resourceId: permission.id,
      resourceLabel: permission.code,
      summary: `Created admin permission ${permission.code}`,
    });

    return {
      id: permission.id,
      code: permission.code,
      name: permission.name,
      description: permission.description,
      category: permission.category,
      created_at: permission.created_at,
      role_count: roleCount,
    };
  }

  /**
   * Get permission by ID
   */
  async getPermissionById(id: string): Promise<AdminPermissionResponse> {
    const permission = await adminPermissionRepository.findById(id);
    if (!permission) {
      throw new NotFoundError("Permission not found");
    }

    const roleCount = await adminPermissionRepository.countRolesWithPermission(permission.id);

    return {
      id: permission.id,
      code: permission.code,
      name: permission.name,
      description: permission.description,
      category: permission.category,
      created_at: permission.created_at,
      role_count: roleCount,
    };
  }

  /**
   * List all permissions with optional filtering
   */
  async listPermissions(params: AdminPermissionQueryParams): Promise<AdminPermissionListResponse> {
    const limit = params.limit ?? 100;
    const page = params.page ?? 1;
    const offset = (page - 1) * limit;

    const { permissions, total } = await adminPermissionRepository.findAll({
      category: params.category,
      search: params.search,
      limit,
      offset,
    });

    // Get role count for each permission
    const permissionsWithCount = await Promise.all(
      permissions.map(async (permission) => {
        const roleCount = await adminPermissionRepository.countRolesWithPermission(permission.id);
        return {
          id: permission.id,
          code: permission.code,
          name: permission.name,
          description: permission.description,
          category: permission.category,
          created_at: permission.created_at,
          role_count: roleCount,
        };
      })
    );

    // Group by category
    const byCategory: Record<string, AdminPermissionResponse[]> = {};
    for (const permission of permissionsWithCount) {
      const category = permission.category ?? "uncategorized";
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(permission);
    }

    return {
      permissions: permissionsWithCount,
      total,
      by_category: byCategory,
    };
  }

  /**
   * Update a permission
   */
  async updatePermission(
    id: string,
    data: UpdateAdminPermissionRequest,
    actor: AuditActor
  ): Promise<AdminPermissionResponse> {
    const permission = await adminPermissionRepository.findById(id);
    if (!permission) {
      throw new NotFoundError("Permission not found");
    }

    const updatedPermission = await adminPermissionRepository.update(id, {
      name: data.name?.trim(),
      description: data.description?.trim() ?? null,
      category: data.category?.toLowerCase().trim() ?? null,
    });

    if (!updatedPermission) {
      throw new NotFoundError("Permission not found");
    }

    await auditService.record({
      actor,
      action: "ADMIN_PERMISSION_UPDATED",
      category: "ADMIN_PERMISSION",
      resourceId: updatedPermission.id,
      resourceLabel: updatedPermission.code,
      summary: `Updated admin permission ${updatedPermission.code}`,
      metadata: {
        before: {
          name: permission.name,
          description: permission.description,
          category: permission.category,
        },
        after: {
          name: updatedPermission.name,
          description: updatedPermission.description,
          category: updatedPermission.category,
        },
      },
    });

    const roleCount = await adminPermissionRepository.countRolesWithPermission(
      updatedPermission.id
    );

    return {
      id: updatedPermission.id,
      code: updatedPermission.code,
      name: updatedPermission.name,
      description: updatedPermission.description,
      category: updatedPermission.category,
      created_at: updatedPermission.created_at,
      role_count: roleCount,
    };
  }

  /**
   * Delete a permission
   */
  async deletePermission(id: string, actor: AuditActor): Promise<void> {
    const permission = await adminPermissionRepository.findById(id);
    if (!permission) {
      throw new NotFoundError("Permission not found");
    }

    // Check if permission is in use
    const roleCount = await adminPermissionRepository.countRolesWithPermission(id);
    if (roleCount > 0) {
      throw new ForbiddenError(
        `Cannot delete permission used by ${roleCount} role(s). Remove from roles first.`
      );
    }

    const deleted = await adminPermissionRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError("Permission not found");
    }

    await auditService.record({
      actor,
      action: "ADMIN_PERMISSION_DELETED",
      category: "ADMIN_PERMISSION",
      resourceId: id,
      resourceLabel: permission.code,
      summary: `Deleted admin permission ${permission.code}`,
    });
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    return adminPermissionRepository.getCategories();
  }
}

export default new AdminPermissionService();
