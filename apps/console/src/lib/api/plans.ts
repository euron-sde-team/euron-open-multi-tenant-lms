import apiClient from './client';
import {
  ApiResponse,
  CreatePlanRequest,
  CreatePlanVersionRequest,
  EntitlementSyncApplyRequest,
  EntitlementSyncOptions,
  EntitlementSyncPreview,
  EntitlementSyncResult,
  PaginationParams,
  Plan,
  PlanApplicationsResponse,
  PlansListResponse,
  PlanType,
  PlanVersion,
  PlanVersionsListResponse,
  UpdatePlanRequest,
} from './types';

interface PlansParams extends PaginationParams {
  plan_type?: PlanType;
  is_active?: boolean;
  is_public?: boolean;
}

/**
 * List all plans
 * GET /admin/plans
 */
export const listPlans = async (
  params?: PlansParams,
): Promise<ApiResponse<PlansListResponse>> => {
  const response = await apiClient.get<ApiResponse<PlansListResponse>>(
    '/admin/plans',
    { params },
  );
  return response.data;
};

/**
 * Create a new plan
 * POST /admin/plans
 */
export const createPlan = async (
  data: CreatePlanRequest,
): Promise<ApiResponse<Plan>> => {
  const response = await apiClient.post<ApiResponse<Plan>>(
    '/admin/plans',
    data,
  );
  return response.data;
};

/**
 * Get plan by ID
 * GET /admin/plans/:id
 */
export const getPlan = async (id: string): Promise<ApiResponse<Plan>> => {
  const response = await apiClient.get<ApiResponse<Plan>>(`/admin/plans/${id}`);
  return response.data;
};

/**
 * Update plan
 * PATCH /admin/plans/:id
 */
export const updatePlan = async (
  id: string,
  data: UpdatePlanRequest,
): Promise<ApiResponse<Plan>> => {
  const response = await apiClient.patch<ApiResponse<Plan>>(
    `/admin/plans/${id}`,
    data,
  );
  return response.data;
};

/**
 * Deactivate plan
 * DELETE /admin/plans/:id
 */
export const deactivatePlan = async (
  id: string,
): Promise<ApiResponse<null>> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/admin/plans/${id}`,
  );
  return response.data;
};

// ============================================
// Plan Versions
// ============================================

/**
 * List plan versions
 * GET /admin/plans/:planId/versions
 */
export const listPlanVersions = async (
  planId: string,
  params?: PaginationParams,
): Promise<ApiResponse<PlanVersionsListResponse>> => {
  const response = await apiClient.get<ApiResponse<PlanVersionsListResponse>>(
    `/admin/plans/${planId}/versions`,
    { params },
  );
  return response.data;
};

/**
 * Create plan version
 * POST /admin/plans/:planId/versions
 */
export const createPlanVersion = async (
  planId: string,
  data: CreatePlanVersionRequest,
): Promise<ApiResponse<PlanVersion>> => {
  const response = await apiClient.post<ApiResponse<PlanVersion>>(
    `/admin/plans/${planId}/versions`,
    data,
  );
  return response.data;
};

/**
 * Get plan version by ID
 * GET /admin/plans/:planId/versions/:versionId
 */
export const getPlanVersion = async (
  planId: string,
  versionId: string,
): Promise<ApiResponse<PlanVersion>> => {
  const response = await apiClient.get<ApiResponse<PlanVersion>>(
    `/admin/plans/${planId}/versions/${versionId}`,
  );
  return response.data;
};

/**
 * Publish plan version
 * POST /admin/plans/:planId/versions/:versionId/publish
 */
export const publishPlanVersion = async (
  planId: string,
  versionId: string,
): Promise<ApiResponse<PlanVersion>> => {
  const response = await apiClient.post<ApiResponse<PlanVersion>>(
    `/admin/plans/${planId}/versions/${versionId}/publish`,
  );
  return response.data;
};

/**
 * Retire plan version
 * POST /admin/plans/:planId/versions/:versionId/retire
 */
export const retirePlanVersion = async (
  planId: string,
  versionId: string,
): Promise<ApiResponse<PlanVersion>> => {
  const response = await apiClient.post<ApiResponse<PlanVersion>>(
    `/admin/plans/${planId}/versions/${versionId}/retire`,
  );
  return response.data;
};

/**
 * Add product to version
 * POST /admin/plans/:planId/versions/:versionId/products
 */
export const addProductToVersion = async (
  planId: string,
  versionId: string,
  data: { product_id: string; limit_value?: number; is_unlimited?: boolean },
): Promise<ApiResponse<unknown>> => {
  const response = await apiClient.post(
    `/admin/plans/${planId}/versions/${versionId}/products`,
    data,
  );
  return response.data;
};

/**
 * Remove product from version
 * DELETE /admin/plans/:planId/versions/:versionId/products/:productId
 */
export const removeProductFromVersion = async (
  planId: string,
  versionId: string,
  productId: string,
): Promise<ApiResponse<null>> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/admin/plans/${planId}/versions/${versionId}/products/${productId}`,
  );
  return response.data;
};

// ============================================
// Plan Applications
// ============================================

/**
 * Get plan applications
 * GET /admin/plans/:planId/applications
 */
export const getPlanApplications = async (
  planId: string,
): Promise<ApiResponse<PlanApplicationsResponse>> => {
  const response = await apiClient.get<ApiResponse<PlanApplicationsResponse>>(
    `/admin/plans/${planId}/applications`,
  );
  return response.data;
};

/**
 * Link application to plan
 * POST /admin/plans/:planId/applications
 */
export const linkApplicationToPlan = async (
  planId: string,
  applicationId: string,
): Promise<ApiResponse<unknown>> => {
  const response = await apiClient.post(`/admin/plans/${planId}/applications`, {
    application_id: applicationId,
  });
  return response.data;
};

/**
 * Unlink application from plan
 * DELETE /admin/plans/:planId/applications/:appId
 */
export const unlinkApplicationFromPlan = async (
  planId: string,
  appId: string,
): Promise<ApiResponse<null>> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/admin/plans/${planId}/applications/${appId}`,
  );
  return response.data;
};

// ============================================
// Entitlement Sync (backfill to existing tenants)
// ============================================

/**
 * Dry run: what would each tenant on this plan receive from the source version.
 * Writes nothing.
 * POST /admin/plans/:planId/entitlement-sync/preview
 */
export const previewEntitlementSync = async (
  planId: string,
  options: EntitlementSyncOptions = {},
): Promise<ApiResponse<EntitlementSyncPreview>> => {
  const response = await apiClient.post<ApiResponse<EntitlementSyncPreview>>(
    `/admin/plans/${planId}/entitlement-sync/preview`,
    options,
  );
  return response.data;
};

/**
 * Grant the missing entitlements to the plan's existing tenants.
 * POST /admin/plans/:planId/entitlement-sync/apply
 */
export const applyEntitlementSync = async (
  planId: string,
  data: EntitlementSyncApplyRequest,
): Promise<ApiResponse<EntitlementSyncResult>> => {
  const response = await apiClient.post<ApiResponse<EntitlementSyncResult>>(
    `/admin/plans/${planId}/entitlement-sync/apply`,
    data,
    // Long-running bulk write; the default 30s client timeout is not enough.
    { timeout: 300000 },
  );
  return response.data;
};
