import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantPermissionRepository from "../repositories/tenant-permission.repository";
import tenantRoleRepository from "../repositories/tenant-role.repository";
import {
  CreateTenantPermissionRequest,
  TenantPermissionQueryParams,
  TenantPermissionResponse,
  TenantRoleWithPermissionsResponse,
  UpdateTenantPermissionRequest,
} from "../types/tenant-permission.type";

const PERMISSION_CODE_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

class TenantPermissionService {
  // -------------------------------------------------------------------------
  // Permission CRUD
  // -------------------------------------------------------------------------

  async listPermissions(
    params?: TenantPermissionQueryParams
  ): Promise<TenantPermissionResponse[]> {
    return tenantPermissionRepository.findAll(params);
  }

  async createPermission(
    data: CreateTenantPermissionRequest
  ): Promise<TenantPermissionResponse> {
    const code = data.code?.trim();
    const name = data.name?.trim();
    const category = data.category?.trim();

    if (!code) throw new BadRequestError("Permission code is required");
    if (!name) throw new BadRequestError("Permission name is required");
    if (!category) throw new BadRequestError("Permission category is required");

    if (!PERMISSION_CODE_REGEX.test(code)) {
      throw new BadRequestError(
        "Permission code must be lowercase, dot-separated (e.g. courses.view, hub.products.create)"
      );
    }

    const exists = await tenantPermissionRepository.codeExists(code);
    if (exists) {
      throw new ConflictError(`Permission with code "${code}" already exists`);
    }

    return tenantPermissionRepository.create({
      id: ulid(),
      code,
      name,
      description: data.description?.trim() ?? null,
      category,
      created_at: new Date(),
    });
  }

  async updatePermission(
    id: string,
    data: UpdateTenantPermissionRequest
  ): Promise<TenantPermissionResponse> {
    const existing = await tenantPermissionRepository.findById(id);
    if (!existing) throw new NotFoundError("Permission not found");

    const updated = await tenantPermissionRepository.update(id, {
      name: data.name?.trim(),
      description: data.description !== undefined ? (data.description?.trim() ?? null) : undefined,
      category: data.category?.trim(),
    });

    if (!updated) throw new NotFoundError("Permission not found");
    return updated;
  }

  async deletePermission(id: string): Promise<void> {
    const existing = await tenantPermissionRepository.findById(id);
    if (!existing) throw new NotFoundError("Permission not found");

    const inUse = await tenantPermissionRepository.isUsedByAnyRole(id);
    if (inUse) {
      throw new ForbiddenError(
        "Cannot delete permission that is assigned to one or more roles. Remove it from all roles first."
      );
    }

    const deleted = await tenantPermissionRepository.delete(id);
    if (!deleted) throw new NotFoundError("Permission not found");
  }

  async listCategories(): Promise<string[]> {
    return tenantPermissionRepository.findDistinctCategories();
  }

  // -------------------------------------------------------------------------
  // Role-Permission Mapping
  // -------------------------------------------------------------------------

  async getRolePermissions(
    roleId: string
  ): Promise<TenantRoleWithPermissionsResponse> {
    const role = await tenantRoleRepository.findById(roleId);
    if (!role) throw new NotFoundError("Role not found");

    const permissions = await tenantRoleRepository.getPermissions(roleId);

    return {
      ...role,
      permission_count: permissions.length,
      permissions,
    };
  }

  async setRolePermissions(
    roleId: string,
    permissionIds: string[]
  ): Promise<TenantRoleWithPermissionsResponse> {
    const role = await tenantRoleRepository.findById(roleId);
    if (!role) throw new NotFoundError("Role not found");

    // Validate all permission IDs exist
    for (const permId of permissionIds) {
      const perm = await tenantPermissionRepository.findById(permId);
      if (!perm) {
        throw new BadRequestError(`Permission with ID "${permId}" not found`);
      }
    }

    await tenantRoleRepository.setPermissions(roleId, permissionIds);

    const permissions = await tenantRoleRepository.getPermissions(roleId);
    return {
      ...role,
      permission_count: permissions.length,
      permissions,
    };
  }

  async addRolePermission(
    roleId: string,
    permissionId: string
  ): Promise<TenantRoleWithPermissionsResponse> {
    const role = await tenantRoleRepository.findById(roleId);
    if (!role) throw new NotFoundError("Role not found");

    const perm = await tenantPermissionRepository.findById(permissionId);
    if (!perm) throw new NotFoundError("Permission not found");

    await tenantRoleRepository.addPermission(roleId, permissionId);

    const permissions = await tenantRoleRepository.getPermissions(roleId);
    return {
      ...role,
      permission_count: permissions.length,
      permissions,
    };
  }

  async removeRolePermission(
    roleId: string,
    permissionId: string
  ): Promise<TenantRoleWithPermissionsResponse> {
    const role = await tenantRoleRepository.findById(roleId);
    if (!role) throw new NotFoundError("Role not found");

    await tenantRoleRepository.removePermission(roleId, permissionId);

    const permissions = await tenantRoleRepository.getPermissions(roleId);
    return {
      ...role,
      permission_count: permissions.length,
      permissions,
    };
  }
}

export default new TenantPermissionService();
