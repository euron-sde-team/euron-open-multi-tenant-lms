import apiClient from './client';
import {
  ApiResponse,
  CheckEntitlementRequest,
  CheckEntitlementResponse,
  ConsumeEntitlementRequest,
  Entitlement,
  EntitlementsListResponse,
  OverrideEntitlementRequest,
  OverrideHistoryResponse,
  PaginationParams,
  ResetUsageRequest,
  UpdateUsageRequest,
} from './types';

// ============================================
// Tenant Entitlement APIs
// ============================================

/**
 * List entitlements for a tenant
 * GET /admin/tenants/:tenantId/entitlements
 */
export const listEntitlements = async (
  tenantId: string,
  params?: PaginationParams,
): Promise<ApiResponse<EntitlementsListResponse>> => {
  const response = await apiClient.get<ApiResponse<EntitlementsListResponse>>(
    `/admin/tenants/${tenantId}/entitlements`,
    { params },
  );
  return response.data;
};

/**
 * Get entitlement by ID
 * GET /admin/tenants/:tenantId/entitlements/:id
 */
export const getEntitlement = async (
  tenantId: string,
  entitlementId: string,
): Promise<ApiResponse<Entitlement>> => {
  const response = await apiClient.get<ApiResponse<Entitlement>>(
    `/admin/tenants/${tenantId}/entitlements/${entitlementId}`,
  );
  return response.data;
};

/**
 * Override entitlement limit
 * POST /admin/tenants/:tenantId/entitlements/:id/override
 */
export const overrideEntitlement = async (
  tenantId: string,
  entitlementId: string,
  data: OverrideEntitlementRequest,
): Promise<ApiResponse<Entitlement>> => {
  const response = await apiClient.post<ApiResponse<Entitlement>>(
    `/admin/tenants/${tenantId}/entitlements/${entitlementId}/override`,
    data,
  );
  return response.data;
};

/**
 * Reset entitlement usage
 * POST /admin/tenants/:tenantId/entitlements/:id/reset-usage
 */
export const resetEntitlementUsage = async (
  tenantId: string,
  entitlementId: string,
  data: ResetUsageRequest,
): Promise<ApiResponse<Entitlement>> => {
  const response = await apiClient.post<ApiResponse<Entitlement>>(
    `/admin/tenants/${tenantId}/entitlements/${entitlementId}/reset-usage`,
    data,
  );
  return response.data;
};

/**
 * Update entitlement usage value
 * POST /admin/tenants/:tenantId/entitlements/:id/update-usage
 */
export const updateEntitlementUsage = async (
  tenantId: string,
  entitlementId: string,
  data: UpdateUsageRequest,
): Promise<ApiResponse<Entitlement>> => {
  const response = await apiClient.post<ApiResponse<Entitlement>>(
    `/admin/tenants/${tenantId}/entitlements/${entitlementId}/update-usage`,
    data,
  );
  return response.data;
};

/**
 * Get override history
 * GET /admin/tenants/:tenantId/entitlements/:id/overrides
 */
export const getOverrideHistory = async (
  tenantId: string,
  entitlementId: string,
  params?: PaginationParams,
): Promise<ApiResponse<OverrideHistoryResponse>> => {
  const response = await apiClient.get<ApiResponse<OverrideHistoryResponse>>(
    `/admin/tenants/${tenantId}/entitlements/${entitlementId}/overrides`,
    { params },
  );
  return response.data;
};

/**
 * Reconcile usage counters for a tenant
 * POST /admin/tenants/:tenantId/entitlements/reconcile
 */
export const reconcileUsage = async (
  tenantId: string,
): Promise<ApiResponse<Record<string, unknown>>> => {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    `/admin/tenants/${tenantId}/entitlements/reconcile`,
  );
  return response.data;
};

/**
 * Create an ADMIN-sourced entitlement (standalone)
 * POST /admin/tenants/:tenantId/entitlements/admin-grant
 */
export const createAdminEntitlement = async (
  tenantId: string,
  data: {
    product_id: string;
    limit_value: number;
    is_unlimited?: boolean;
    reason: string;
  },
): Promise<ApiResponse<Entitlement & { warnings?: string[] }>> => {
  const response = await apiClient.post<
    ApiResponse<Entitlement & { warnings?: string[] }>
  >(`/admin/tenants/${tenantId}/entitlements/admin-grant`, data);
  return response.data;
};

/**
 * Revoke an ADMIN-sourced entitlement
 * POST /admin/tenants/:tenantId/entitlements/:id/revoke
 */
export const revokeAdminEntitlement = async (
  tenantId: string,
  entitlementId: string,
  data: { reason: string },
): Promise<ApiResponse<Entitlement>> => {
  const response = await apiClient.post<ApiResponse<Entitlement>>(
    `/admin/tenants/${tenantId}/entitlements/${entitlementId}/revoke`,
    data,
  );
  return response.data;
};

// ============================================
// Global Entitlement APIs
// ============================================

/**
 * Check if tenant can consume a feature
 * POST /admin/entitlements/check
 */
export const checkEntitlement = async (
  data: CheckEntitlementRequest,
): Promise<ApiResponse<CheckEntitlementResponse>> => {
  const response = await apiClient.post<ApiResponse<CheckEntitlementResponse>>(
    '/admin/entitlements/check',
    data,
  );
  return response.data;
};

/**
 * Consume from entitlement
 * POST /admin/entitlements/consume
 */
export const consumeEntitlement = async (
  data: ConsumeEntitlementRequest,
): Promise<ApiResponse<Entitlement>> => {
  const response = await apiClient.post<ApiResponse<Entitlement>>(
    '/admin/entitlements/consume',
    data,
  );
  return response.data;
};
