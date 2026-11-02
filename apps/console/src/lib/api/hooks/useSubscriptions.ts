import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  CancelSubscriptionRequest,
  CreateSubscriptionRequest,
  GlobalSubscriptionsFilters,
  GlobalSubscriptionsListResponse,
  Subscription,
  SubscriptionsListResponse,
  UpgradeSubscriptionRequest,
} from '../types';

export interface SubscriptionsFilters {
  page?: number;
  limit?: number;
  status?: string;
}

/**
 * Get all subscriptions across all tenants (global view)
 */
export const useGetAllSubscriptions = (
  filters?: GlobalSubscriptionsFilters,
) => {
  return useQuery<GlobalSubscriptionsListResponse, Error>({
    queryKey: ['subscriptions', 'all', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<GlobalSubscriptionsListResponse>
      >('/admin/subscriptions', { params: filters });
      return response.data.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Get subscriptions for a tenant. Result has .data (array), .total, .page, .limit, .totalPages
 */
export const useGetSubscriptions = (
  tenantId: string | undefined,
  filters?: SubscriptionsFilters,
) => {
  return useQuery<SubscriptionsListResponse, Error>({
    queryKey: ['tenants', tenantId, 'subscriptions', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<SubscriptionsListResponse>
      >(`/admin/tenants/${tenantId}/subscriptions`, { params: filters });
      return response.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get subscription by ID
 */
export const useGetSubscription = (
  tenantId: string | undefined,
  subscriptionId: string | undefined,
) => {
  return useQuery<Subscription, Error>({
    queryKey: ['tenants', tenantId, 'subscriptions', subscriptionId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Subscription>>(
        `/admin/tenants/${tenantId}/subscriptions/${subscriptionId}`,
      );
      return response.data.data;
    },
    enabled: !!tenantId && !!subscriptionId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create subscription (assign plan to tenant)
 */
export const useCreateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Subscription>,
    Error,
    { tenantId: string; data: CreateSubscriptionRequest }
  >({
    mutationFn: async ({ tenantId, data }) => {
      const response = await apiClient.post<ApiResponse<Subscription>>(
        `/admin/tenants/${tenantId}/subscriptions`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'subscriptions',
      ]);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
      queryClient.invalidateQueries(['tenants', variables.tenantId]);
    },
  });
};

/**
 * Cancel subscription
 */
export const useCancelSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Subscription>,
    Error,
    {
      tenantId: string;
      subscriptionId: string;
      data: CancelSubscriptionRequest;
    }
  >({
    mutationFn: async ({ tenantId, subscriptionId, data }) => {
      const response = await apiClient.post<ApiResponse<Subscription>>(
        `/admin/tenants/${tenantId}/subscriptions/${subscriptionId}/cancel`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'subscriptions',
      ]);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'subscriptions',
        variables.subscriptionId,
      ]);
      queryClient.invalidateQueries(['subscriptions', 'all']);
    },
  });
};

/**
 * Upgrade subscription
 */
export const useUpgradeSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Subscription>,
    Error,
    {
      tenantId: string;
      subscriptionId: string;
      data: UpgradeSubscriptionRequest;
    }
  >({
    mutationFn: async ({ tenantId, subscriptionId, data }) => {
      const response = await apiClient.post<ApiResponse<Subscription>>(
        `/admin/tenants/${tenantId}/subscriptions/${subscriptionId}/upgrade`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'subscriptions',
      ]);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
    },
  });
};
