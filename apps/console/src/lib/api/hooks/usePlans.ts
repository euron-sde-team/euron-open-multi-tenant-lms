import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  CreatePlanRequest,
  CreatePlanVersionRequest,
  CreatePlanWithVersionRequest,
  CreatePlanWithVersionResponse,
  EntitlementSyncApplyRequest,
  EntitlementSyncOptions,
  EntitlementSyncPreview,
  EntitlementSyncResult,
  Plan,
  PlanApplicationsResponse,
  PlansListResponse,
  PlanType,
  PlanVersion,
  PlanVersionsListResponse,
  UpdatePlanRequest,
  UpdatePlanVersionRequest,
} from '../types';

export interface PlansFilters {
  page?: number;
  limit?: number;
  plan_type?: PlanType;
  is_active?: boolean;
  is_public?: boolean;
  has_active_version?: boolean;
  search?: string;
}

/**
 * Get all plans
 */
export const useGetPlans = (filters?: PlansFilters) => {
  return useQuery<PlansListResponse, Error>({
    queryKey: ['plans', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PlansListResponse>>(
        '/admin/plans',
        { params: filters },
      );
      return response.data.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get plan by ID
 */
export const useGetPlan = (id: string | undefined) => {
  return useQuery<Plan, Error>({
    queryKey: ['plans', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Plan>>(
        `/admin/plans/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create plan
 */
export const useCreatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Plan>, Error, CreatePlanRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<Plan>>(
        '/admin/plans',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['plans']);
    },
  });
};

/**
 * Create plan with first version (version 1) atomically
 */
export const useCreatePlanWithVersion = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<CreatePlanWithVersionResponse>,
    Error,
    CreatePlanWithVersionRequest
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post<
        ApiResponse<CreatePlanWithVersionResponse>
      >('/admin/plans/with-version', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['plans']);
    },
  });
};

/**
 * Update plan
 */
export const useUpdatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Plan>,
    Error,
    { id: string; data: UpdatePlanRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.patch<ApiResponse<Plan>>(
        `/admin/plans/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['plans']);
      queryClient.invalidateQueries(['plans', variables.id]);
    },
  });
};

/**
 * Deactivate plan
 */
export const useDeactivatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.delete<ApiResponse<null>>(
        `/admin/plans/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['plans']);
    },
  });
};

// ============================================
// Plan Versions
// ============================================

/**
 * Get plan versions
 */
export const useGetPlanVersions = (
  planId: string | undefined,
  filters?: { page?: number; limit?: number },
) => {
  return useQuery<PlanVersionsListResponse, Error>({
    queryKey: ['plans', planId, 'versions', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<PlanVersionsListResponse>
      >(`/admin/plans/${planId}/versions`, { params: filters });
      return response.data.data;
    },
    enabled: !!planId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get plan version by ID
 */
export const useGetPlanVersion = (
  planId: string | undefined,
  versionId: string | undefined,
) => {
  return useQuery<PlanVersion, Error>({
    queryKey: ['plans', planId, 'versions', versionId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PlanVersion>>(
        `/admin/plans/${planId}/versions/${versionId}`,
      );
      return response.data.data;
    },
    enabled: !!planId && !!versionId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create plan version
 */
export const useCreatePlanVersion = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<PlanVersion>,
    Error,
    { planId: string; data: CreatePlanVersionRequest }
  >({
    mutationFn: async ({ planId, data }) => {
      const response = await apiClient.post<ApiResponse<PlanVersion>>(
        `/admin/plans/${planId}/versions`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['plans', variables.planId, 'versions']);
      queryClient.invalidateQueries(['plans', variables.planId]);
    },
  });
};

/**
 * Update a draft plan version (pricing only)
 */
export const useUpdatePlanVersion = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<PlanVersion>,
    Error,
    { planId: string; versionId: string; data: UpdatePlanVersionRequest }
  >({
    mutationFn: async ({ planId, versionId, data }) => {
      const response = await apiClient.patch<ApiResponse<PlanVersion>>(
        `/admin/plans/${planId}/versions/${versionId}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'plans',
        variables.planId,
        'versions',
        variables.versionId,
      ]);
      queryClient.invalidateQueries(['plans', variables.planId, 'versions']);
      queryClient.invalidateQueries(['plans', variables.planId]);
    },
  });
};

/**
 * Publish plan version
 */
export const usePublishPlanVersion = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<PlanVersion>,
    Error,
    { planId: string; versionId: string }
  >({
    mutationFn: async ({ planId, versionId }) => {
      const response = await apiClient.post<ApiResponse<PlanVersion>>(
        `/admin/plans/${planId}/versions/${versionId}/publish`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['plans', variables.planId, 'versions']);
      queryClient.invalidateQueries(['plans', variables.planId]);
      queryClient.invalidateQueries(['plans']);
    },
  });
};

/**
 * Retire plan version
 */
export const useRetirePlanVersion = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<PlanVersion>,
    Error,
    { planId: string; versionId: string }
  >({
    mutationFn: async ({ planId, versionId }) => {
      const response = await apiClient.post<ApiResponse<PlanVersion>>(
        `/admin/plans/${planId}/versions/${versionId}/retire`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['plans', variables.planId, 'versions']);
      queryClient.invalidateQueries(['plans', variables.planId]);
    },
  });
};

/**
 * Add product to version
 */
export const useAddProductToVersion = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<unknown>,
    Error,
    {
      planId: string;
      versionId: string;
      data: {
        product_id: string;
        limit_value?: number;
        is_unlimited?: boolean;
      };
    }
  >({
    mutationFn: async ({ planId, versionId, data }) => {
      const response = await apiClient.post(
        `/admin/plans/${planId}/versions/${versionId}/products`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'plans',
        variables.planId,
        'versions',
        variables.versionId,
      ]);
    },
  });
};

/**
 * Remove product from version
 */
export const useRemoveProductFromVersion = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<null>,
    Error,
    { planId: string; versionId: string; productId: string }
  >({
    mutationFn: async ({ planId, versionId, productId }) => {
      const response = await apiClient.delete<ApiResponse<null>>(
        `/admin/plans/${planId}/versions/${versionId}/products/${productId}`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'plans',
        variables.planId,
        'versions',
        variables.versionId,
      ]);
    },
  });
};

// ============================================
// Plan Applications
// ============================================

/**
 * Get plan applications
 */
export const useGetPlanApplications = (planId: string | undefined) => {
  return useQuery<PlanApplicationsResponse, Error>({
    queryKey: ['plans', planId, 'applications'],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<PlanApplicationsResponse>
      >(`/admin/plans/${planId}/applications`);
      return response.data.data;
    },
    enabled: !!planId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Link application to plan
 */
export const useLinkApplicationToPlan = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<unknown>,
    Error,
    { planId: string; applicationId: string }
  >({
    mutationFn: async ({ planId, applicationId }) => {
      const response = await apiClient.post(
        `/admin/plans/${planId}/applications`,
        { application_id: applicationId },
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'plans',
        variables.planId,
        'applications',
      ]);
      queryClient.invalidateQueries(['plans', variables.planId]);
    },
  });
};

/**
 * Unlink application from plan
 */
export const useUnlinkApplicationFromPlan = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<null>,
    Error,
    { planId: string; appId: string }
  >({
    mutationFn: async ({ planId, appId }) => {
      const response = await apiClient.delete<ApiResponse<null>>(
        `/admin/plans/${planId}/applications/${appId}`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'plans',
        variables.planId,
        'applications',
      ]);
      queryClient.invalidateQueries(['plans', variables.planId]);
    },
  });
};

// ============================================
// Entitlement Sync (backfill to existing tenants)
// ============================================

/**
 * Preview the sync. A mutation rather than a query: it is a POST with a body,
 * and it must only run when the operator explicitly asks for it.
 */
export const usePreviewEntitlementSync = () => {
  return useMutation<
    ApiResponse<EntitlementSyncPreview>,
    Error,
    { planId: string; options?: EntitlementSyncOptions }
  >({
    mutationFn: async ({ planId, options }) => {
      const response = await apiClient.post<
        ApiResponse<EntitlementSyncPreview>
      >(`/admin/plans/${planId}/entitlement-sync/preview`, options ?? {});
      return response.data;
    },
  });
};

/**
 * Apply the sync. Invalidates entitlement, tenant and subscription views since
 * the run writes entitlements (and possibly applications) across many tenants.
 */
export const useApplyEntitlementSync = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<EntitlementSyncResult>,
    Error,
    { planId: string; data: EntitlementSyncApplyRequest }
  >({
    mutationFn: async ({ planId, data }) => {
      // A large run writes one transaction per tenant server side; the client's
      // default 30s axios timeout would abandon the request mid-run and show a
      // false failure while the server keeps writing. Give apply five minutes.
      const response = await apiClient.post<ApiResponse<EntitlementSyncResult>>(
        `/admin/plans/${planId}/entitlement-sync/apply`,
        data,
        { timeout: 300000 },
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['entitlements']);
      queryClient.invalidateQueries(['tenants']);
      queryClient.invalidateQueries(['subscriptions']);
      queryClient.invalidateQueries(['plans', variables.planId]);
    },
  });
};
