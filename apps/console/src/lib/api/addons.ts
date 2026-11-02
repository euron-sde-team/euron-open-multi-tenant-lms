import apiClient from './client';
import {
  Addon,
  AddonsListResponse,
  ApiResponse,
  CancelAddonRequest,
  CreateAddonRequest,
  GrantAddonRequest,
  PaginationParams,
  TenantAddon,
  TenantAddonsListResponse,
  UpdateAddonRequest,
} from './types';

export type AddonsQueryParams = PaginationParams & {
  search?: string;
  application_id?: string;
  product_id?: string;
  is_active?: boolean;
  is_public?: boolean;
};

/**
 * List available addons (catalog)
 * GET /admin/entitlements/addons
 */
export const listAvailableAddons = async (
  params?: AddonsQueryParams,
): Promise<ApiResponse<AddonsListResponse>> => {
  const response = await apiClient.get<ApiResponse<AddonsListResponse>>(
    '/admin/entitlements/addons',
    { params },
  );
  return response.data;
};

/**
 * Get addon by ID
 * GET /admin/entitlements/addons/:id
 */
export const getAddon = async (id: string): Promise<ApiResponse<Addon>> => {
  const response = await apiClient.get<ApiResponse<Addon>>(
    `/admin/entitlements/addons/${id}`,
  );
  return response.data;
};

/**
 * Create addon (catalog)
 * POST /admin/entitlements/addons
 */
export const createAddon = async (
  data: CreateAddonRequest,
): Promise<ApiResponse<Addon>> => {
  const response = await apiClient.post<ApiResponse<Addon>>(
    '/admin/entitlements/addons',
    data,
  );
  return response.data;
};

/**
 * Update addon (catalog)
 * PUT /admin/entitlements/addons/:id
 */
export const updateAddon = async (
  id: string,
  data: UpdateAddonRequest,
): Promise<ApiResponse<Addon>> => {
  const response = await apiClient.put<ApiResponse<Addon>>(
    `/admin/entitlements/addons/${id}`,
    data,
  );
  return response.data;
};

/**
 * List addons for a tenant
 * GET /admin/tenants/:tenantId/addons
 */
export const listTenantAddons = async (
  tenantId: string,
  params?: PaginationParams,
): Promise<ApiResponse<TenantAddonsListResponse>> => {
  const response = await apiClient.get<ApiResponse<TenantAddonsListResponse>>(
    `/admin/tenants/${tenantId}/addons`,
    { params },
  );
  return response.data;
};

/**
 * Grant addon to tenant
 * POST /admin/tenants/:tenantId/addons
 */
export const grantAddonToTenant = async (
  tenantId: string,
  data: GrantAddonRequest,
): Promise<ApiResponse<TenantAddon>> => {
  const response = await apiClient.post<ApiResponse<TenantAddon>>(
    `/admin/tenants/${tenantId}/addons`,
    data,
  );
  return response.data;
};

/**
 * Get tenant addon by ID
 * GET /admin/tenants/:tenantId/addons/:id
 */
export const getTenantAddon = async (
  tenantId: string,
  addonId: string,
): Promise<ApiResponse<TenantAddon>> => {
  const response = await apiClient.get<ApiResponse<TenantAddon>>(
    `/admin/tenants/${tenantId}/addons/${addonId}`,
  );
  return response.data;
};

/**
 * Cancel tenant addon
 * POST /admin/tenants/:tenantId/addons/:id/cancel
 */
export const cancelTenantAddon = async (
  tenantId: string,
  addonId: string,
  data: CancelAddonRequest,
): Promise<ApiResponse<TenantAddon>> => {
  const response = await apiClient.post<ApiResponse<TenantAddon>>(
    `/admin/tenants/${tenantId}/addons/${addonId}/cancel`,
    data,
  );
  return response.data;
};
