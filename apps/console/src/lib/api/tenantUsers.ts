import apiClient from './client';
import {
  ApiResponse,
  CreateTenantUserRequest,
  GlobalTenantUserSearchListResponse,
  GlobalUser,
  InviteTenantUserRequest,
  MembershipStatus,
  PaginationParams,
  TenantUser,
  TenantUsersListResponse,
  UpdateMembershipRequest,
  UpdateTenantUserRequest,
  UserTenantsResponse,
} from './types';

interface TenantUsersParams extends PaginationParams {
  status?: MembershipStatus;
  include_global_suspended?: boolean;
}

// ============================================
// Tenant-scoped User APIs
// ============================================

/**
 * List users in a tenant
 * GET /admin/tenants/:tenantId/users
 */
export const listTenantUsers = async (
  tenantId: string,
  params?: TenantUsersParams,
): Promise<ApiResponse<TenantUsersListResponse>> => {
  const response = await apiClient.get<ApiResponse<TenantUsersListResponse>>(
    `/admin/tenants/${tenantId}/users`,
    { params },
  );
  return response.data;
};

/**
 * Create/Add user to tenant
 * POST /admin/tenants/:tenantId/users
 */
export const createTenantUser = async (
  tenantId: string,
  data: CreateTenantUserRequest,
): Promise<ApiResponse<TenantUser>> => {
  const response = await apiClient.post<ApiResponse<TenantUser>>(
    `/admin/tenants/${tenantId}/users`,
    data,
  );
  return response.data;
};

/**
 * Invite existing user to tenant
 * POST /admin/tenants/:tenantId/users/invite
 */
export const inviteUserToTenant = async (
  tenantId: string,
  data: InviteTenantUserRequest,
): Promise<ApiResponse<TenantUser>> => {
  const response = await apiClient.post<ApiResponse<TenantUser>>(
    `/admin/tenants/${tenantId}/users/invite`,
    data,
  );
  return response.data;
};

/**
 * Get tenant user
 * GET /admin/tenants/:tenantId/users/:id
 */
export const getTenantUser = async (
  tenantId: string,
  userId: string,
): Promise<ApiResponse<TenantUser>> => {
  const response = await apiClient.get<ApiResponse<TenantUser>>(
    `/admin/tenants/${tenantId}/users/${userId}`,
  );
  return response.data;
};

/**
 * Update tenant user profile
 * PATCH /admin/tenants/:tenantId/users/:id
 */
export const updateTenantUser = async (
  tenantId: string,
  userId: string,
  data: UpdateTenantUserRequest,
): Promise<ApiResponse<TenantUser>> => {
  const response = await apiClient.patch<ApiResponse<TenantUser>>(
    `/admin/tenants/${tenantId}/users/${userId}`,
    data,
  );
  return response.data;
};

/**
 * Update user membership status
 * PATCH /admin/tenants/:tenantId/users/:id/membership
 */
export const updateUserMembership = async (
  tenantId: string,
  userId: string,
  data: UpdateMembershipRequest,
): Promise<ApiResponse<TenantUser>> => {
  const response = await apiClient.patch<ApiResponse<TenantUser>>(
    `/admin/tenants/${tenantId}/users/${userId}/membership`,
    data,
  );
  return response.data;
};

/**
 * Remove user from tenant
 * DELETE /admin/tenants/:tenantId/users/:id
 */
export const removeUserFromTenant = async (
  tenantId: string,
  userId: string,
): Promise<ApiResponse<{ message: string }>> => {
  const response = await apiClient.delete<ApiResponse<{ message: string }>>(
    `/admin/tenants/${tenantId}/users/${userId}`,
  );
  return response.data;
};

/**
 * Assign role to user in tenant
 * POST /admin/tenants/:tenantId/users/:id/roles
 */
export const assignRoleToTenantUser = async (
  tenantId: string,
  userId: string,
  roleId: string,
): Promise<ApiResponse<TenantUser>> => {
  const response = await apiClient.post<ApiResponse<TenantUser>>(
    `/admin/tenants/${tenantId}/users/${userId}/roles`,
    { role_id: roleId },
  );
  return response.data;
};

/**
 * Revoke role from user in tenant
 * DELETE /admin/tenants/:tenantId/users/:id/roles/:roleId
 */
export const revokeRoleFromTenantUser = async (
  tenantId: string,
  userId: string,
  roleId: string,
): Promise<ApiResponse<TenantUser>> => {
  const response = await apiClient.delete<ApiResponse<TenantUser>>(
    `/admin/tenants/${tenantId}/users/${userId}/roles/${roleId}`,
  );
  return response.data;
};

// ============================================
// Global User APIs
// ============================================

/**
 * Search global tenant users (e.g. for owner picker)
 * GET /admin/tenant-users?search=...&page=1&limit=20
 */
export const searchGlobalTenantUsers = async (params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<GlobalTenantUserSearchListResponse>> => {
  const response = await apiClient.get<
    ApiResponse<GlobalTenantUserSearchListResponse>
  >('/admin/tenant-users', { params });
  return response.data;
};

/**
 * Get global user
 * GET /admin/tenant-users/:userId
 */
export const getGlobalUser = async (
  userId: string,
): Promise<ApiResponse<GlobalUser>> => {
  const response = await apiClient.get<ApiResponse<GlobalUser>>(
    `/admin/tenant-users/${userId}`,
  );
  return response.data;
};

/**
 * List user's tenants
 * GET /admin/tenant-users/:userId/tenants
 */
export const listUserTenants = async (
  userId: string,
  params?: PaginationParams & { status?: MembershipStatus },
): Promise<ApiResponse<UserTenantsResponse>> => {
  const response = await apiClient.get<ApiResponse<UserTenantsResponse>>(
    `/admin/tenant-users/${userId}/tenants`,
    { params },
  );
  return response.data;
};
