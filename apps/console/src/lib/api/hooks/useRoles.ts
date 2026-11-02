import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  CreateRoleRequest,
  Role,
  RolesListResponse,
  UpdateRoleRequest,
} from '../types';

export interface RolesFilters {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Get all roles
 */
export const useGetRoles = (filters?: RolesFilters) => {
  return useQuery<RolesListResponse, Error>({
    queryKey: ['roles', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<RolesListResponse>>(
        '/admin/roles',
        { params: filters },
      );
      return response.data.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get role by ID
 */
export const useGetRole = (id: string | undefined) => {
  return useQuery<Role, Error>({
    queryKey: ['roles', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Role>>(
        `/admin/roles/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create role
 */
export const useCreateRole = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Role>, Error, CreateRoleRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<Role>>(
        '/admin/roles',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['roles']);
    },
  });
};

/**
 * Update role
 */
export const useUpdateRole = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Role>,
    Error,
    { id: string; data: UpdateRoleRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.patch<ApiResponse<Role>>(
        `/admin/roles/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['roles']);
      queryClient.invalidateQueries(['roles', variables.id]);
    },
  });
};

/**
 * Delete role
 */
export const useDeleteRole = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<{ message: string }>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(
        `/admin/roles/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['roles']);
    },
  });
};

/**
 * Assign permission to role
 */
export const useAssignPermissionToRole = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Role>,
    Error,
    { roleId: string; permissionId: string }
  >({
    mutationFn: async ({ roleId, permissionId }) => {
      const response = await apiClient.post<ApiResponse<Role>>(
        `/admin/roles/${roleId}/permissions`,
        { permissionId },
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['roles']);
      queryClient.invalidateQueries(['roles', variables.roleId]);
    },
  });
};

/**
 * Revoke permission from role
 */
export const useRevokePermissionFromRole = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Role>,
    Error,
    { roleId: string; permissionId: string }
  >({
    mutationFn: async ({ roleId, permissionId }) => {
      const response = await apiClient.delete<ApiResponse<Role>>(
        `/admin/roles/${roleId}/permissions/${permissionId}`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['roles']);
      queryClient.invalidateQueries(['roles', variables.roleId]);
    },
  });
};
