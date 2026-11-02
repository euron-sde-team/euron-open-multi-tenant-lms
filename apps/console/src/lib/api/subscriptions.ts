import apiClient from './client';
import {
  ApiResponse,
  CancelSubscriptionRequest,
  CreateSubscriptionRequest,
  PaginationParams,
  Subscription,
  SubscriptionsListResponse,
  UpgradeSubscriptionRequest,
} from './types';

/**
 * List subscriptions for a tenant
 * GET /admin/tenants/:tenantId/subscriptions
 */
export const listSubscriptions = async (
  tenantId: string,
  params?: PaginationParams,
): Promise<ApiResponse<SubscriptionsListResponse>> => {
  const response = await apiClient.get<ApiResponse<SubscriptionsListResponse>>(
    `/admin/tenants/${tenantId}/subscriptions`,
    { params },
  );
  return response.data;
};

/**
 * Assign plan to tenant (create subscription)
 * POST /admin/tenants/:tenantId/subscriptions
 */
export const createSubscription = async (
  tenantId: string,
  data: CreateSubscriptionRequest,
): Promise<ApiResponse<Subscription>> => {
  const response = await apiClient.post<ApiResponse<Subscription>>(
    `/admin/tenants/${tenantId}/subscriptions`,
    data,
  );
  return response.data;
};

/**
 * Get subscription by ID
 * GET /admin/tenants/:tenantId/subscriptions/:id
 */
export const getSubscription = async (
  tenantId: string,
  subscriptionId: string,
): Promise<ApiResponse<Subscription>> => {
  const response = await apiClient.get<ApiResponse<Subscription>>(
    `/admin/tenants/${tenantId}/subscriptions/${subscriptionId}`,
  );
  return response.data;
};

/**
 * Cancel subscription
 * POST /admin/tenants/:tenantId/subscriptions/:id/cancel
 */
export const cancelSubscription = async (
  tenantId: string,
  subscriptionId: string,
  data: CancelSubscriptionRequest,
): Promise<ApiResponse<Subscription>> => {
  const response = await apiClient.post<ApiResponse<Subscription>>(
    `/admin/tenants/${tenantId}/subscriptions/${subscriptionId}/cancel`,
    data,
  );
  return response.data;
};

/**
 * Upgrade subscription
 * POST /admin/tenants/:tenantId/subscriptions/:id/upgrade
 */
export const upgradeSubscription = async (
  tenantId: string,
  subscriptionId: string,
  data: UpgradeSubscriptionRequest,
): Promise<ApiResponse<Subscription>> => {
  const response = await apiClient.post<ApiResponse<Subscription>>(
    `/admin/tenants/${tenantId}/subscriptions/${subscriptionId}/upgrade`,
    data,
  );
  return response.data;
};
