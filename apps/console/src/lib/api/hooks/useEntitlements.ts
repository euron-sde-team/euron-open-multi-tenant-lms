import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  CheckEntitlementRequest,
  CheckEntitlementResponse,
  ConsumeEntitlementRequest,
  Entitlement,
  EntitlementsListResponse,
  OverrideEntitlementRequest,
  OverrideHistoryResponse,
  ResetUsageRequest,
  UpdateUsageRequest,
} from '../types';

export interface EntitlementsFilters {
  page?: number;
  limit?: number;
  /** When true, only active entitlements are returned */
  is_active?: boolean;
}

/**
 * Get entitlements for a tenant. Result has .data (array), .total, .page, .limit, .totalPages
 */
export const useGetEntitlements = (
  tenantId: string | undefined,
  filters?: EntitlementsFilters,
) => {
  return useQuery<EntitlementsListResponse, Error>({
    queryKey: ['tenants', tenantId, 'entitlements', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<EntitlementsListResponse>
      >(`/admin/tenants/${tenantId}/entitlements`, { params: filters });
      return response.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get entitlement by ID
 */
export const useGetEntitlement = (
  tenantId: string | undefined,
  entitlementId: string | undefined,
) => {
  return useQuery<Entitlement, Error>({
    queryKey: ['tenants', tenantId, 'entitlements', entitlementId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Entitlement>>(
        `/admin/tenants/${tenantId}/entitlements/${entitlementId}`,
      );
      return response.data.data;
    },
    enabled: !!tenantId && !!entitlementId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Override entitlement
 */
export const useOverrideEntitlement = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Entitlement>,
    Error,
    {
      tenantId: string;
      entitlementId: string;
      data: OverrideEntitlementRequest;
    }
  >({
    mutationFn: async ({ tenantId, entitlementId, data }) => {
      const response = await apiClient.post<ApiResponse<Entitlement>>(
        `/admin/tenants/${tenantId}/entitlements/${entitlementId}/override`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
        variables.entitlementId,
      ]);
    },
  });
};

/**
 * Reset entitlement usage
 */
export const useResetEntitlementUsage = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Entitlement>,
    Error,
    { tenantId: string; entitlementId: string; data: ResetUsageRequest }
  >({
    mutationFn: async ({ tenantId, entitlementId, data }) => {
      const response = await apiClient.post<ApiResponse<Entitlement>>(
        `/admin/tenants/${tenantId}/entitlements/${entitlementId}/reset-usage`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
        variables.entitlementId,
      ]);
    },
  });
};

/**
 * Update entitlement usage
 */
export const useUpdateEntitlementUsage = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Entitlement>,
    Error,
    { tenantId: string; entitlementId: string; data: UpdateUsageRequest }
  >({
    mutationFn: async ({ tenantId, entitlementId, data }) => {
      const response = await apiClient.post<ApiResponse<Entitlement>>(
        `/admin/tenants/${tenantId}/entitlements/${entitlementId}/update-usage`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
        variables.entitlementId,
      ]);
    },
  });
};

/**
 * Get override history
 */
export const useGetOverrideHistory = (
  tenantId: string | undefined,
  entitlementId: string | undefined,
  filters?: { page?: number; limit?: number },
) => {
  return useQuery<OverrideHistoryResponse, Error>({
    queryKey: [
      'tenants',
      tenantId,
      'entitlements',
      entitlementId,
      'overrides',
      filters,
    ],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<OverrideHistoryResponse>
      >(`/admin/tenants/${tenantId}/entitlements/${entitlementId}/overrides`, {
        params: filters,
      });
      return response.data.data;
    },
    enabled: !!tenantId && !!entitlementId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Reconcile usage counters for a tenant
 */
export const useReconcileUsage = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Record<string, unknown>>,
    Error,
    { tenantId: string }
  >({
    mutationFn: async ({ tenantId }) => {
      const response = await apiClient.post<
        ApiResponse<Record<string, unknown>>
      >(`/admin/tenants/${tenantId}/entitlements/reconcile`);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
    },
  });
};

/**
 * Create ADMIN-sourced entitlement
 */
export const useCreateAdminEntitlement = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Entitlement & { warnings?: string[] }>,
    Error,
    {
      tenantId: string;
      data: {
        product_id: string;
        limit_value: number;
        is_unlimited?: boolean;
        reason: string;
      };
    }
  >({
    mutationFn: async ({ tenantId, data }) => {
      const response = await apiClient.post<
        ApiResponse<Entitlement & { warnings?: string[] }>
      >(`/admin/tenants/${tenantId}/entitlements/admin-grant`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
    },
  });
};

/**
 * Revoke ADMIN-sourced entitlement
 */
export const useRevokeAdminEntitlement = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Entitlement>,
    Error,
    { tenantId: string; entitlementId: string; data: { reason: string } }
  >({
    mutationFn: async ({ tenantId, entitlementId, data }) => {
      const response = await apiClient.post<ApiResponse<Entitlement>>(
        `/admin/tenants/${tenantId}/entitlements/${entitlementId}/revoke`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'entitlements',
      ]);
    },
  });
};

// ============================================
// Global Entitlement APIs
// ============================================

/**
 * Check entitlement
 */
export const useCheckEntitlement = () => {
  return useMutation<
    ApiResponse<CheckEntitlementResponse>,
    Error,
    CheckEntitlementRequest
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post<
        ApiResponse<CheckEntitlementResponse>
      >('/admin/entitlements/check', data);
      return response.data;
    },
  });
};

/**
 * Consume entitlement
 */
export const useConsumeEntitlement = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Entitlement>,
    Error,
    ConsumeEntitlementRequest
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<Entitlement>>(
        '/admin/entitlements/consume',
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenant_id,
        'entitlements',
      ]);
    },
  });
};
