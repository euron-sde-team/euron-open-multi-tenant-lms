import apiClient from './client';
import {
  ApiResponse,
  CreatePermissionRequest,
  PaginationParams,
  Permission,
  PermissionCategoriesResponse,
  PermissionsListResponse,
  UpdatePermissionRequest,
} from './types';

interface PermissionsParams extends PaginationParams {
  category?: string;
}

/**
 * List all permissions
 * GET /admin/permissions
 */
export const listPermissions = async (
  params?: PermissionsParams,
): Promise<ApiResponse<PermissionsListResponse>> => {
  const response = await apiClient.get<ApiResponse<PermissionsListResponse>>(
    '/admin/permissions',
    { params },
  );
  return response.data;
};

/**
 * Get permission categories
 * GET /admin/permissions/categories
 */
export const getPermissionCategories = async (): Promise<
  ApiResponse<PermissionCategoriesResponse>
> => {
  const response = await apiClient.get<
    ApiResponse<PermissionCategoriesResponse>
  >('/admin/permissions/categories');
  return response.data;
};

/**
 * Create a new permission
 * POST /admin/permissions
 */
export const createPermission = async (
  data: CreatePermissionRequest,
): Promise<ApiResponse<Permission>> => {
  const response = await apiClient.post<ApiResponse<Permission>>(
    '/admin/permissions',
    data,
  );
  return response.data;
};

/**
 * Get permission by ID
 * GET /admin/permissions/:id
 */
export const getPermission = async (
  id: string,
): Promise<ApiResponse<Permission>> => {
  const response = await apiClient.get<ApiResponse<Permission>>(
    `/admin/permissions/${id}`,
  );
  return response.data;
};

/**
 * Update permission
 * PATCH /admin/permissions/:id
 */
export const updatePermission = async (
  id: string,
  data: UpdatePermissionRequest,
): Promise<ApiResponse<Permission>> => {
  const response = await apiClient.patch<ApiResponse<Permission>>(
    `/admin/permissions/${id}`,
    data,
  );
  return response.data;
};

/**
 * Delete permission
 * DELETE /admin/permissions/:id
 */
export const deletePermission = async (
  id: string,
): Promise<ApiResponse<{ message: string }>> => {
  const response = await apiClient.delete<ApiResponse<{ message: string }>>(
    `/admin/permissions/${id}`,
  );
  return response.data;
};
