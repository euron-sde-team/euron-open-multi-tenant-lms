import { useMutation, useQuery, useQueryClient } from 'react-query';

import {
  createBillingProvider,
  deleteBillingProvider,
  getBillingProvider,
  getBillingProvidersAnalytics,
  listBillingProviders,
  updateBillingProvider,
} from '../billingProviders';
import type {
  ApiResponse,
  BillingProvider,
  BillingProviderAnalyticsResponse,
  BillingProviderListResponse,
  BillingProvidersFilters,
  CreateBillingProviderRequest,
  UpdateBillingProviderRequest,
} from '../types';

/**
 * Get all billing providers
 */
export const useGetBillingProviders = (filters?: BillingProvidersFilters) => {
  return useQuery<BillingProviderListResponse, Error>({
    queryKey: ['billing-providers', filters],
    queryFn: async () => {
      const res = await listBillingProviders(filters);
      return res.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Get billing provider by ID
 */
export const useGetBillingProvider = (id: string | undefined) => {
  return useQuery<BillingProvider, Error>({
    queryKey: ['billing-providers', id],
    queryFn: async () => {
      if (!id) throw new Error('Provider ID required');
      const res = await getBillingProvider(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get billing providers analytics
 */
export const useGetBillingProvidersAnalytics = () => {
  return useQuery<BillingProviderAnalyticsResponse, Error>({
    queryKey: ['billing-providers', 'analytics'],
    queryFn: async () => {
      const res = await getBillingProvidersAnalytics();
      return res.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create billing provider
 */
export const useCreateBillingProvider = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<BillingProvider>,
    Error,
    CreateBillingProviderRequest
  >({
    mutationFn: createBillingProvider,
    onSuccess: () => {
      queryClient.invalidateQueries(['billing-providers']);
      queryClient.invalidateQueries(['billing-providers', 'analytics']);
    },
  });
};

/**
 * Update billing provider
 */
export const useUpdateBillingProvider = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<BillingProvider>,
    Error,
    { id: string; data: UpdateBillingProviderRequest }
  >({
    mutationFn: ({ id, data }) => updateBillingProvider(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['billing-providers']);
      queryClient.invalidateQueries(['billing-providers', variables.id]);
      queryClient.invalidateQueries(['billing-providers', 'analytics']);
    },
  });
};

/**
 * Delete billing provider
 */
export const useDeleteBillingProvider = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string>({
    mutationFn: deleteBillingProvider,
    onSuccess: () => {
      queryClient.invalidateQueries(['billing-providers']);
      queryClient.invalidateQueries(['billing-providers', 'analytics']);
    },
  });
};
