import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  CreateTenantUserRequest,
  GlobalTenantUserSearchListResponse,
  GlobalUser,
  InviteTenantUserRequest,
  MembershipStatus,
  TenantUser,
  TenantUsersListResponse,
  UpdateMembershipRequest,
  UpdateTenantUserRequest,
  UserTenantsResponse,
} from '../types';

export interface TenantUsersFilters {
  page?: number;
  limit?: number;
  status?: MembershipStatus;
  search?: string;
  include_global_suspended?: boolean;
}

/**
 * Get tenant users
 */
export const useGetTenantUsers = (
  tenantId: string | undefined,
  filters?: TenantUsersFilters,
) => {
  return useQuery<TenantUsersListResponse, Error>({
    queryKey: ['tenants', tenantId, 'users', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<TenantUsersListResponse>
      >(`/admin/tenants/${tenantId}/users`, { params: filters });
      return response.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get tenant user by ID
 */
export const useGetTenantUser = (
  tenantId: string | undefined,
  userId: string | undefined,
) => {
  return useQuery<TenantUser, Error>({
    queryKey: ['tenants', tenantId, 'users', userId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<TenantUser>>(
        `/admin/tenants/${tenantId}/users/${userId}`,
      );
      return response.data.data;
    },
    enabled: !!tenantId && !!userId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create tenant user
 */
export const useCreateTenantUser = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantUser>,
    Error,
    { tenantId: string; data: CreateTenantUserRequest }
  >({
    mutationFn: async ({ tenantId, data }) => {
      const response = await apiClient.post<ApiResponse<TenantUser>>(
        `/admin/tenants/${tenantId}/users`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'users']);
    },
  });
};

/**
 * Invite user to tenant
 */
export const useInviteUserToTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantUser>,
    Error,
    { tenantId: string; data: InviteTenantUserRequest }
  >({
    mutationFn: async ({ tenantId, data }) => {
      const response = await apiClient.post<ApiResponse<TenantUser>>(
        `/admin/tenants/${tenantId}/users/invite`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'users']);
    },
  });
};

/**
 * Update tenant user
 */
export const useUpdateTenantUser = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantUser>,
    Error,
    { tenantId: string; userId: string; data: UpdateTenantUserRequest }
  >({
    mutationFn: async ({ tenantId, userId, data }) => {
      const response = await apiClient.patch<ApiResponse<TenantUser>>(
        `/admin/tenants/${tenantId}/users/${userId}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'users']);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'users',
        variables.userId,
      ]);
      queryClient.invalidateQueries(['members', 'all']);
      queryClient.invalidateQueries(['staff-members']);
    },
  });
};

/**
 * Update user membership
 */
export const useUpdateUserMembership = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantUser>,
    Error,
    { tenantId: string; userId: string; data: UpdateMembershipRequest }
  >({
    mutationFn: async ({ tenantId, userId, data }) => {
      const response = await apiClient.patch<ApiResponse<TenantUser>>(
        `/admin/tenants/${tenantId}/users/${userId}/membership`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'users']);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'users',
        variables.userId,
      ]);
    },
  });
};

/**
 * Remove user from tenant
 */
export const useRemoveUserFromTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<{ message: string }>,
    Error,
    { tenantId: string; userId: string }
  >({
    mutationFn: async ({ tenantId, userId }) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(
        `/admin/tenants/${tenantId}/users/${userId}`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'users']);
    },
  });
};

/**
 * Assign role to tenant user
 */
export const useAssignRoleToTenantUser = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantUser>,
    Error,
    { tenantId: string; userId: string; roleId: string }
  >({
    mutationFn: async ({ tenantId, userId, roleId }) => {
      const response = await apiClient.post<ApiResponse<TenantUser>>(
        `/admin/tenants/${tenantId}/users/${userId}/roles`,
        { role_id: roleId },
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'users']);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'users',
        variables.userId,
      ]);
    },
  });
};

/**
 * Revoke role from tenant user
 */
export const useRevokeRoleFromTenantUser = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantUser>,
    Error,
    { tenantId: string; userId: string; roleId: string }
  >({
    mutationFn: async ({ tenantId, userId, roleId }) => {
      const response = await apiClient.delete<ApiResponse<TenantUser>>(
        `/admin/tenants/${tenantId}/users/${userId}/roles/${roleId}`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants', variables.tenantId, 'users']);
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'users',
        variables.userId,
      ]);
    },
  });
};

// ============================================
// Global User APIs
// ============================================

const MIN_SEARCH_LENGTH = 2;

/**
 * Search global tenant users (e.g. for owner picker).
 * Only runs when search has at least MIN_SEARCH_LENGTH characters.
 */
export const useSearchGlobalTenantUsers = (
  search: string,
  options?: { page?: number; limit?: number },
) => {
  const trimmed = search.trim();
  const enabled = trimmed.length >= MIN_SEARCH_LENGTH;

  return useQuery<GlobalTenantUserSearchListResponse, Error>({
    queryKey: [
      'tenant-users',
      'search',
      trimmed,
      options?.page,
      options?.limit,
    ],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<GlobalTenantUserSearchListResponse>
      >('/admin/tenant-users', {
        params: {
          search: trimmed,
          page: options?.page ?? 1,
          limit: options?.limit ?? 10,
        },
      });
      return response.data.data;
    },
    enabled,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get global user
 */
export const useGetGlobalUser = (userId: string | undefined) => {
  return useQuery<GlobalUser, Error>({
    queryKey: ['tenant-users', userId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<GlobalUser>>(
        `/admin/tenant-users/${userId}`,
      );
      return response.data.data;
    },
    enabled: !!userId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get user's tenants
 */
export const useGetUserTenants = (
  userId: string | undefined,
  filters?: { page?: number; limit?: number; status?: MembershipStatus },
) => {
  return useQuery<UserTenantsResponse, Error>({
    queryKey: ['tenant-users', userId, 'tenants', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<UserTenantsResponse>>(
        `/admin/tenant-users/${userId}/tenants`,
        { params: filters },
      );
      return response.data.data;
    },
    enabled: !!userId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};
