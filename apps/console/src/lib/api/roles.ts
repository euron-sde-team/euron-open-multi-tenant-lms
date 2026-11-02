import apiClient from './client';
import {
  ApiResponse,
  CreateRoleRequest,
  PaginationParams,
  Role,
  RolesListResponse,
  UpdateRoleRequest,
} from './types';

/**
 * List all roles
 * GET /admin/roles
 */
export const listRoles = async (
  params?: PaginationParams,
): Promise<ApiResponse<RolesListResponse>> => {
  const response = await apiClient.get<ApiResponse<RolesListResponse>>(
    '/admin/roles',
    { params },
  );
  return response.data;
};

/**
 * Create a new role
 * POST /admin/roles
 */
export const createRole = async (
  data: CreateRoleRequest,
): Promise<ApiResponse<Role>> => {
  const response = await apiClient.post<ApiResponse<Role>>(
    '/admin/roles',
    data,
  );
  return response.data;
};

/**
 * Get role by ID
 * GET /admin/roles/:id
 */
export const getRole = async (id: string): Promise<ApiResponse<Role>> => {
  const response = await apiClient.get<ApiResponse<Role>>(`/admin/roles/${id}`);
  return response.data;
};

/**
 * Update role
 * PATCH /admin/roles/:id
 */
export const updateRole = async (
  id: string,
  data: UpdateRoleRequest,
): Promise<ApiResponse<Role>> => {
  const response = await apiClient.patch<ApiResponse<Role>>(
    `/admin/roles/${id}`,
    data,
  );
  return response.data;
};

/**
 * Delete role
 * DELETE /admin/roles/:id
 */
export const deleteRole = async (
  id: string,
): Promise<ApiResponse<{ message: string }>> => {
  const response = await apiClient.delete<ApiResponse<{ message: string }>>(
    `/admin/roles/${id}`,
  );
  return response.data;
};

/**
 * Assign permission to role
 * POST /admin/roles/:id/permissions
 */
export const assignPermissionToRole = async (
  roleId: string,
  permissionId: string,
): Promise<ApiResponse<Role>> => {
  const response = await apiClient.post<ApiResponse<Role>>(
    `/admin/roles/${roleId}/permissions`,
    { permissionId },
  );
  return response.data;
};

/**
 * Revoke permission from role
 * DELETE /admin/roles/:id/permissions/:permissionId
 */
export const revokePermissionFromRole = async (
  roleId: string,
  permissionId: string,
): Promise<ApiResponse<Role>> => {
  const response = await apiClient.delete<ApiResponse<Role>>(
    `/admin/roles/${roleId}/permissions/${permissionId}`,
  );
  return response.data;
};
