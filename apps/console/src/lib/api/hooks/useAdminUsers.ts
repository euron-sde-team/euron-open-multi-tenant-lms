import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  AdminUser,
  AdminUsersListResponse,
  ApiResponse,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from '../types';

export interface AdminUsersFilters {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  search?: string;
}

/**
 * Get all admin users
 */
export const useGetAdminUsers = (filters?: AdminUsersFilters) => {
  return useQuery<AdminUsersListResponse, Error>({
    queryKey: ['admin-users', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<AdminUsersListResponse>>(
        '/admin/users',
        { params: filters },
      );
      return response.data.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get admin user by ID
 */
export const useGetAdminUser = (id: string | undefined) => {
  return useQuery<AdminUser, Error>({
    queryKey: ['admin-users', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<AdminUser>>(
        `/admin/users/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create admin user
 */
export const useCreateAdminUser = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<AdminUser>, Error, CreateAdminUserRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<AdminUser>>(
        '/admin/users',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
    },
  });
};

/**
 * Update admin user
 */
export const useUpdateAdminUser = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<AdminUser>,
    Error,
    { id: string; data: UpdateAdminUserRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.patch<ApiResponse<AdminUser>>(
        `/admin/users/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['admin-users']);
      queryClient.invalidateQueries(['admin-users', variables.id]);
    },
  });
};

/**
 * Deactivate admin user
 */
export const useDeactivateAdminUser = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<{ message: string }>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(
        `/admin/users/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
    },
  });
};

/**
 * Permanently (hard) delete admin user
 */
export const useDeleteAdminUser = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<{ message: string }>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(
        `/admin/users/${id}/permanent`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
    },
  });
};

/**
 * Reactivate admin user
 */
export const useReactivateAdminUser = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<AdminUser>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.post<ApiResponse<AdminUser>>(
        `/admin/users/${id}/reactivate`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
    },
  });
};

/**
 * Assign role to admin user
 */
export const useAssignRoleToUser = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<AdminUser>,
    Error,
    { userId: string; roleId: string }
  >({
    mutationFn: async ({ userId, roleId }) => {
      const response = await apiClient.post<ApiResponse<AdminUser>>(
        `/admin/users/${userId}/roles`,
        { roleId },
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['admin-users']);
      queryClient.invalidateQueries(['admin-users', variables.userId]);
    },
  });
};

/**
 * Revoke role from admin user
 */
export const useRevokeRoleFromUser = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<AdminUser>,
    Error,
    { userId: string; roleId: string }
  >({
    mutationFn: async ({ userId, roleId }) => {
      const response = await apiClient.delete<ApiResponse<AdminUser>>(
        `/admin/users/${userId}/roles/${roleId}`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['admin-users']);
      queryClient.invalidateQueries(['admin-users', variables.userId]);
    },
  });
};
