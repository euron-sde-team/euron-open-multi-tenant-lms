import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  CreatePermissionRequest,
  Permission,
  PermissionCategoriesResponse,
  PermissionsListResponse,
  UpdatePermissionRequest,
} from '../types';

export interface PermissionsFilters {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

/**
 * Get all permissions
 */
export const useGetPermissions = (filters?: PermissionsFilters) => {
  return useQuery<PermissionsListResponse, Error>({
    queryKey: ['permissions', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<PermissionsListResponse>
      >('/admin/permissions', { params: filters });
      return response.data.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get permission categories
 */
export const useGetPermissionCategories = () => {
  return useQuery<PermissionCategoriesResponse, Error>({
    queryKey: ['permissions', 'categories'],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<PermissionCategoriesResponse>
      >('/admin/permissions/categories');
      return response.data.data;
    },
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Get permission by ID
 */
export const useGetPermission = (id: string | undefined) => {
  return useQuery<Permission, Error>({
    queryKey: ['permissions', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Permission>>(
        `/admin/permissions/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create permission
 */
export const useCreatePermission = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Permission>, Error, CreatePermissionRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<Permission>>(
        '/admin/permissions',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['permissions']);
    },
  });
};

/**
 * Update permission
 */
export const useUpdatePermission = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Permission>,
    Error,
    { id: string; data: UpdatePermissionRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.patch<ApiResponse<Permission>>(
        `/admin/permissions/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['permissions']);
      queryClient.invalidateQueries(['permissions', variables.id]);
    },
  });
};

/**
 * Delete permission
 */
export const useDeletePermission = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<{ message: string }>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(
        `/admin/permissions/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['permissions']);
    },
  });
};
