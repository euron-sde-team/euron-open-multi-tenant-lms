import apiClient from './client';
import {
  ApiResponse,
  CreateTenantPermissionRequest,
  CreateTenantRequest,
  CreateTenantRoleRequest,
  GlobalMembersFilters,
  GlobalMembersListResponse,
  PaginationParams,
  Tenant,
  TenantApplicationsFilters,
  TenantApplicationsListResponse,
  TenantAuditLogFilters,
  TenantAuditLogListResponse,
  TenantMembersFilters,
  TenantMembersListResponse,
  TenantPermission,
  TenantRole,
  TenantRoleWithPermissions,
  TenantsListResponse,
  TenantStatus,
  UpdateTenantPermissionRequest,
  UpdateTenantRequest,
  UpdateTenantRoleRequest,
} from './types';

interface TenantsParams extends PaginationParams {
  status?: TenantStatus;
}

/**
 * List all tenants
 * GET /admin/tenants
 */
export const listTenants = async (
  params?: TenantsParams,
): Promise<ApiResponse<TenantsListResponse>> => {
  const response = await apiClient.get<ApiResponse<TenantsListResponse>>(
    '/admin/tenants',
    { params },
  );
  return response.data;
};

/**
 * Export tenants as Excel file, filtered by signup date range
 * GET /admin/tenants/export
 */
export const exportTenants = async (
  startDate?: string,
  endDate?: string,
): Promise<Blob> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await apiClient.get('/admin/tenants/export', {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
};

/**
 * Create a new tenant
 * POST /admin/tenants
 */
export const createTenant = async (
  data: CreateTenantRequest,
): Promise<ApiResponse<Tenant>> => {
  const response = await apiClient.post<ApiResponse<Tenant>>(
    '/admin/tenants',
    data,
  );
  return response.data;
};

/**
 * Get tenant by ID
 * GET /admin/tenants/:id
 */
export const getTenant = async (id: string): Promise<ApiResponse<Tenant>> => {
  const response = await apiClient.get<ApiResponse<Tenant>>(
    `/admin/tenants/${id}`,
  );
  return response.data;
};

/**
 * Update tenant
 * PATCH /admin/tenants/:id
 */
export const updateTenant = async (
  id: string,
  data: UpdateTenantRequest,
): Promise<ApiResponse<Tenant>> => {
  const response = await apiClient.patch<ApiResponse<Tenant>>(
    `/admin/tenants/${id}`,
    data,
  );
  return response.data;
};

/**
 * Suspend tenant
 * POST /admin/tenants/:id/suspend
 */
export const suspendTenant = async (
  id: string,
  reason: string,
): Promise<ApiResponse<Tenant>> => {
  const response = await apiClient.post<ApiResponse<Tenant>>(
    `/admin/tenants/${id}/suspend`,
    { reason },
  );
  return response.data;
};

/**
 * Reactivate tenant
 * POST /admin/tenants/:id/reactivate
 */
export const reactivateTenant = async (
  id: string,
): Promise<ApiResponse<Tenant>> => {
  const response = await apiClient.post<ApiResponse<Tenant>>(
    `/admin/tenants/${id}/reactivate`,
  );
  return response.data;
};

/**
 * Permanently delete a tenant and all related data
 * DELETE /admin/tenants/:id
 */
export const deleteTenant = async (
  id: string,
): Promise<ApiResponse<{ id: string; name: string; slug: string }>> => {
  const response = await apiClient.delete<
    ApiResponse<{ id: string; name: string; slug: string }>
  >(`/admin/tenants/${id}`);
  return response.data;
};

/**
 * List tenant applications
 * GET /admin/tenants/:tenantId/applications
 */
export const listTenantApplications = async (
  tenantId: string,
  params?: TenantApplicationsFilters,
): Promise<ApiResponse<TenantApplicationsListResponse>> => {
  const response = await apiClient.get<
    ApiResponse<TenantApplicationsListResponse>
  >(`/admin/tenants/${tenantId}/applications`, { params });
  return response.data;
};

/**
 * List tenant members (end-users)
 * GET /admin/tenants/:tenantId/members
 */
export const listTenantMembers = async (
  tenantId: string,
  params?: TenantMembersFilters,
): Promise<ApiResponse<TenantMembersListResponse>> => {
  const response = await apiClient.get<ApiResponse<TenantMembersListResponse>>(
    `/admin/tenants/${tenantId}/members`,
    { params },
  );
  return response.data;
};

/**
 * List tenant audit logs
 * GET /admin/tenants/:tenantId/audit-logs
 */
export const listTenantAuditLogs = async (
  tenantId: string,
  params?: TenantAuditLogFilters,
): Promise<ApiResponse<TenantAuditLogListResponse>> => {
  const response = await apiClient.get<ApiResponse<TenantAuditLogListResponse>>(
    `/admin/tenants/${tenantId}/audit-logs`,
    { params },
  );
  return response.data;
};

/**
 * List all members (end-users) across all tenants
 * GET /admin/members
 */
export const listAllMembers = async (
  params?: GlobalMembersFilters,
): Promise<ApiResponse<GlobalMembersListResponse>> => {
  const response = await apiClient.get<ApiResponse<GlobalMembersListResponse>>(
    '/admin/members',
    { params },
  );
  return response.data;
};

/**
 * Export tenant staff members as Excel file
 * GET /admin/tenants/:tenantId/users/export
 */
export const exportTenantStaffMembers = async (
  tenantId: string,
  startDate?: string,
  endDate?: string,
): Promise<Blob> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await apiClient.get(
    `/admin/tenants/${tenantId}/users/export`,
    { params, responseType: 'blob' },
  );
  return response.data as Blob;
};

/**
 * List global tenant roles
 * GET /admin/tenants/roles
 */
export const listTenantRoles = async (): Promise<ApiResponse<TenantRole[]>> => {
  const response =
    await apiClient.get<ApiResponse<TenantRole[]>>(`/admin/tenants/roles`);
  return response.data;
};

/**
 * Create a global tenant role
 * POST /admin/tenants/roles
 */
export const createTenantRole = async (
  data: CreateTenantRoleRequest,
): Promise<ApiResponse<TenantRole>> => {
  const response = await apiClient.post<ApiResponse<TenantRole>>(
    `/admin/tenants/roles`,
    data,
  );
  return response.data;
};

/**
 * Update a global tenant role
 * PATCH /admin/tenants/roles/:id
 */
export const updateTenantRole = async (
  roleId: string,
  data: UpdateTenantRoleRequest,
): Promise<ApiResponse<TenantRole>> => {
  const response = await apiClient.patch<ApiResponse<TenantRole>>(
    `/admin/tenants/roles/${roleId}`,
    data,
  );
  return response.data;
};

// ============================================
// Tenant Permissions
// ============================================

/**
 * List all tenant permissions
 * GET /admin/tenants/permissions
 */
export const listTenantPermissions = async (params?: {
  category?: string;
  search?: string;
}): Promise<ApiResponse<TenantPermission[]>> => {
  const response = await apiClient.get<ApiResponse<TenantPermission[]>>(
    '/admin/tenants/permissions',
    { params },
  );
  return response.data;
};

/**
 * List distinct permission categories
 * GET /admin/tenants/permissions/categories
 */
export const listPermissionCategories = async (): Promise<
  ApiResponse<string[]>
> => {
  const response = await apiClient.get<ApiResponse<string[]>>(
    '/admin/tenants/permissions/categories',
  );
  return response.data;
};

/**
 * Create a tenant permission
 * POST /admin/tenants/permissions
 */
export const createTenantPermission = async (
  data: CreateTenantPermissionRequest,
): Promise<ApiResponse<TenantPermission>> => {
  const response = await apiClient.post<ApiResponse<TenantPermission>>(
    '/admin/tenants/permissions',
    data,
  );
  return response.data;
};

/**
 * Update a tenant permission
 * PATCH /admin/tenants/permissions/:id
 */
export const updateTenantPermission = async (
  id: string,
  data: UpdateTenantPermissionRequest,
): Promise<ApiResponse<TenantPermission>> => {
  const response = await apiClient.patch<ApiResponse<TenantPermission>>(
    `/admin/tenants/permissions/${id}`,
    data,
  );
  return response.data;
};

/**
 * Delete a tenant permission
 * DELETE /admin/tenants/permissions/:id
 */
export const deleteTenantPermission = async (
  id: string,
): Promise<ApiResponse<null>> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/admin/tenants/permissions/${id}`,
  );
  return response.data;
};

// ============================================
// Role-Permission Mapping
// ============================================

/**
 * Get role with its permissions
 * GET /admin/tenants/roles/:id/permissions
 */
export const getRolePermissions = async (
  roleId: string,
): Promise<ApiResponse<TenantRoleWithPermissions>> => {
  const response = await apiClient.get<ApiResponse<TenantRoleWithPermissions>>(
    `/admin/tenants/roles/${roleId}/permissions`,
  );
  return response.data;
};

/**
 * Set all permissions for a role (replace)
 * PUT /admin/tenants/roles/:id/permissions
 */
export const setRolePermissions = async (
  roleId: string,
  permissionIds: string[],
): Promise<ApiResponse<TenantRoleWithPermissions>> => {
  const response = await apiClient.put<ApiResponse<TenantRoleWithPermissions>>(
    `/admin/tenants/roles/${roleId}/permissions`,
    {
      permission_ids: permissionIds,
    },
  );
  return response.data;
};
