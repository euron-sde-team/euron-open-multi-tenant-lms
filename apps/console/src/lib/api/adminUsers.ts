import apiClient from './client';
import {
  AdminUser,
  AdminUsersListResponse,
  ApiResponse,
  CreateAdminUserRequest,
  PaginationParams,
  UpdateAdminUserRequest,
} from './types';

interface AdminUsersParams extends PaginationParams {
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

/**
 * List all admin users
 * GET /admin/users
 */
export const listAdminUsers = async (
  params?: AdminUsersParams,
): Promise<ApiResponse<AdminUsersListResponse>> => {
  const response = await apiClient.get<ApiResponse<AdminUsersListResponse>>(
    '/admin/users',
    { params },
  );
  return response.data;
};

/**
 * Create a new admin user
 * POST /admin/users
 */
export const createAdminUser = async (
  data: CreateAdminUserRequest,
): Promise<ApiResponse<AdminUser>> => {
  const response = await apiClient.post<ApiResponse<AdminUser>>(
    '/admin/users',
    data,
  );
  return response.data;
};

/**
 * Get admin user by ID
 * GET /admin/users/:id
 */
export const getAdminUser = async (
  id: string,
): Promise<ApiResponse<AdminUser>> => {
  const response = await apiClient.get<ApiResponse<AdminUser>>(
    `/admin/users/${id}`,
  );
  return response.data;
};

/**
 * Update admin user
 * PATCH /admin/users/:id
 */
export const updateAdminUser = async (
  id: string,
  data: UpdateAdminUserRequest,
): Promise<ApiResponse<AdminUser>> => {
  const response = await apiClient.patch<ApiResponse<AdminUser>>(
    `/admin/users/${id}`,
    data,
  );
  return response.data;
};

/**
 * Deactivate admin user
 * DELETE /admin/users/:id
 */
export const deactivateAdminUser = async (
  id: string,
): Promise<ApiResponse<{ message: string }>> => {
  const response = await apiClient.delete<ApiResponse<{ message: string }>>(
    `/admin/users/${id}`,
  );
  return response.data;
};

/**
 * Assign role to admin user
 * POST /admin/users/:id/roles
 */
export const assignRoleToUser = async (
  userId: string,
  roleId: string,
): Promise<ApiResponse<AdminUser>> => {
  const response = await apiClient.post<ApiResponse<AdminUser>>(
    `/admin/users/${userId}/roles`,
    { roleId },
  );
  return response.data;
};

/**
 * Revoke role from admin user
 * DELETE /admin/users/:id/roles/:roleId
 */
export const revokeRoleFromUser = async (
  userId: string,
  roleId: string,
): Promise<ApiResponse<AdminUser>> => {
  const response = await apiClient.delete<ApiResponse<AdminUser>>(
    `/admin/users/${userId}/roles/${roleId}`,
  );
  return response.data;
};
