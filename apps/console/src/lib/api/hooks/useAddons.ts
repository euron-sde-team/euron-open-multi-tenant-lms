import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  Addon,
  AddonsListResponse,
  ApiResponse,
  CancelAddonRequest,
  CreateAddonRequest,
  GrantAddonRequest,
  TenantAddon,
  TenantAddonsListResponse,
  UpdateAddonRequest,
} from '../types';

export interface AddonsFilters {
  search?: string;
  application_id?: string;
  product_id?: string;
  is_active?: boolean;
  is_public?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Get available addons (catalog)
 */
export const useGetAvailableAddons = (filters?: AddonsFilters) => {
  return useQuery<AddonsListResponse, Error>({
    queryKey: ['addons', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<AddonsListResponse>>(
        '/admin/entitlements/addons',
        { params: filters },
      );
      return response.data.data;
    },
    keepPreviousData: true,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create addon (catalog)
 */
export const useCreateAddon = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Addon>, Error, { data: CreateAddonRequest }>({
    mutationFn: async ({ data }) => {
      const response = await apiClient.post<ApiResponse<Addon>>(
        '/admin/entitlements/addons',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['addons']);
    },
  });
};

/**
 * Update addon (catalog)
 */
export const useUpdateAddon = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Addon>,
    Error,
    { id: string; data: UpdateAddonRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put<ApiResponse<Addon>>(
        `/admin/entitlements/addons/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['addons']);
      queryClient.invalidateQueries(['addons', variables.id]);
    },
  });
};

/**
 * Get addon by ID
 */
export const useGetAddon = (id: string | undefined) => {
  return useQuery<Addon, Error>({
    queryKey: ['addons', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Addon>>(
        `/admin/entitlements/addons/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get tenant addons
 */
export const useGetTenantAddons = (
  tenantId: string | undefined,
  filters?: AddonsFilters,
) => {
  return useQuery<TenantAddonsListResponse, Error>({
    queryKey: ['tenants', tenantId, 'addons', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<TenantAddonsListResponse>
      >(`/admin/tenants/${tenantId}/addons`, { params: filters });
      return response.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get tenant addon by ID
 */
export const useGetTenantAddon = (
  tenantId: string | undefined,
  addonId: string | undefined,
) => {
  return useQuery<TenantAddon, Error>({
    queryKey: ['tenants', tenantId, 'addons', addonId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<TenantAddon>>(
        `/admin/tenants/${tenantId}/addons/${addonId}`,
      );
      return response.data.data;
    },
    enabled: !!tenantId && !!addonId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Grant addon to tenant
 */
export const useGrantAddonToTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantAddon>,
    Error,
    { tenantId: string; data: GrantAddonRequest }
  >({
    mutationFn: async ({ tenantId, data }) => {
      const response = await apiClient.post<ApiResponse<TenantAddon>>(
        `/admin/tenants/${tenantId}/addons`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'addons']);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
    },
  });
};

/**
 * Cancel tenant addon
 */
export const useCancelTenantAddon = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantAddon>,
    Error,
    { tenantId: string; addonId: string; data: CancelAddonRequest }
  >({
    mutationFn: async ({ tenantId, addonId, data }) => {
      const response = await apiClient.post<ApiResponse<TenantAddon>>(
        `/admin/tenants/${tenantId}/addons/${addonId}/cancel`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'addons']);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'addons',
        variables.addonId,
      ]);
    },
  });
};
