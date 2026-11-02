import apiClient from './client';
import type {
  ApiResponse,
  BillingProvider,
  BillingProviderAnalyticsResponse,
  BillingProviderListResponse,
  BillingProvidersFilters,
  CreateBillingProviderRequest,
  UpdateBillingProviderRequest,
} from './types';

/**
 * List billing providers
 * GET /admin/billing-providers
 */
export const listBillingProviders = async (
  params?: BillingProvidersFilters,
): Promise<ApiResponse<BillingProviderListResponse>> => {
  const response = await apiClient.get<
    ApiResponse<BillingProviderListResponse>
  >('/admin/billing-providers', { params });
  return response.data;
};

/**
 * Get billing provider by ID
 * GET /admin/billing-providers/:id
 */
export const getBillingProvider = async (
  id: string,
): Promise<ApiResponse<BillingProvider>> => {
  const response = await apiClient.get<ApiResponse<BillingProvider>>(
    `/admin/billing-providers/${id}`,
  );
  return response.data;
};

/**
 * Get billing providers analytics
 * GET /admin/billing-providers/analytics
 */
export const getBillingProvidersAnalytics = async (): Promise<
  ApiResponse<BillingProviderAnalyticsResponse>
> => {
  const response = await apiClient.get<
    ApiResponse<BillingProviderAnalyticsResponse>
  >('/admin/billing-providers/analytics');
  return response.data;
};

/**
 * Create billing provider
 * POST /admin/billing-providers
 */
export const createBillingProvider = async (
  data: CreateBillingProviderRequest,
): Promise<ApiResponse<BillingProvider>> => {
  const response = await apiClient.post<ApiResponse<BillingProvider>>(
    '/admin/billing-providers',
    data,
  );
  return response.data;
};

/**
 * Update billing provider
 * PATCH /admin/billing-providers/:id
 */
export const updateBillingProvider = async (
  id: string,
  data: UpdateBillingProviderRequest,
): Promise<ApiResponse<BillingProvider>> => {
  const response = await apiClient.patch<ApiResponse<BillingProvider>>(
    `/admin/billing-providers/${id}`,
    data,
  );
  return response.data;
};

/**
 * Delete billing provider
 * DELETE /admin/billing-providers/:id
 */
export const deleteBillingProvider = async (
  id: string,
): Promise<ApiResponse<null>> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/admin/billing-providers/${id}`,
  );
  return response.data;
};
