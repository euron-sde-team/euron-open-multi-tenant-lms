import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  createTenantPermission,
  createTenantRole,
  deleteTenantPermission,
  getRolePermissions,
  listPermissionCategories,
  listTenantPermissions,
  listTenantRoles,
  setRolePermissions,
  updateTenantPermission,
  updateTenantRole,
} from '../tenants';
import {
  ApiResponse,
  CreateTenantPermissionRequest,
  CreateTenantRequest,
  CreateTenantRoleRequest,
  GlobalMembersFilters,
  GlobalMembersListResponse,
  GrantApplicationRequest,
  Tenant,
  TenantApplication,
  TenantApplicationsFilters,
  TenantApplicationsListResponse,
  TenantAuditLogFilters,
  TenantAuditLogListResponse,
  TenantMembersFilters,
  TenantMembersListResponse,
  TenantPermission,
  TenantRole,
  TenantRoleWithPermissions,
  TenantsListResponse,
  TenantStatus,
  UpdateTenantApplicationRequest,
  UpdateTenantPermissionRequest,
  UpdateTenantRequest,
  UpdateTenantRoleRequest,
} from '../types';

export type {
  GlobalMembersFilters,
  TenantApplicationsFilters,
  TenantAuditLogFilters,
  TenantMembersFilters,
} from '../types';

export interface TenantsFilters {
  page?: number;
  limit?: number;
  status?: TenantStatus;
  search?: string;
  /** Sort by signup date: latest (default) or oldest */
  sort?: 'latest' | 'oldest';
  /** Filter by active subscription plan code */
  plan?: string;
}

/**
 * Get all tenants (server-side pagination; use .data, .total, .totalPages from result)
 */
export const useGetTenants = (filters?: TenantsFilters) => {
  return useQuery<TenantsListResponse, Error>({
    queryKey: ['tenants', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<TenantsListResponse>>(
        '/admin/tenants',
        { params: filters },
      );
      return response.data.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Get all members (end-users) across all tenants (server-side pagination)
 */
export const useGetAllMembers = (filters?: GlobalMembersFilters) => {
  return useQuery<GlobalMembersListResponse, Error>({
    queryKey: ['members', 'all', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<GlobalMembersListResponse>
      >('/admin/members', { params: filters });
      return response.data.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Get tenant applications (paginated, search, status/source filters)
 */
export const useGetTenantApplications = (
  tenantId: string | undefined,
  filters?: TenantApplicationsFilters,
) => {
  return useQuery<TenantApplicationsListResponse, Error>({
    queryKey: ['tenants', tenantId, 'applications', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<TenantApplicationsListResponse>
      >(`/admin/tenants/${tenantId}/applications`, { params: filters });
      return response.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Grant (assign) an application to a tenant
 */
export const useGrantApplicationToTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantApplication>,
    Error,
    { tenantId: string; data: GrantApplicationRequest }
  >({
    mutationFn: async ({ tenantId, data }) => {
      const response = await apiClient.post<ApiResponse<TenantApplication>>(
        `/admin/tenants/${tenantId}/applications`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'applications',
      ]);
    },
  });
};

/**
 * Update a tenant application (suspend, reactivate, cancel)
 */
export const useUpdateTenantApplication = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantApplication>,
    Error,
    {
      tenantId: string;
      tenantAppId: string;
      data: UpdateTenantApplicationRequest;
    }
  >({
    mutationFn: async ({ tenantId, tenantAppId, data }) => {
      const response = await apiClient.patch<ApiResponse<TenantApplication>>(
        `/admin/tenants/${tenantId}/applications/${tenantAppId}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries([
        'tenants',
        variables.tenantId,
        'applications',
      ]);
    },
  });
};

/**
 * Get tenant members (paginated, search, status filter)
 */
export const useGetTenantMembers = (
  tenantId: string | undefined,
  filters?: TenantMembersFilters,
) => {
  return useQuery<TenantMembersListResponse, Error>({
    queryKey: ['tenants', tenantId, 'members', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<TenantMembersListResponse>
      >(`/admin/tenants/${tenantId}/members`, { params: filters });
      return response.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Get tenant audit logs (paginated)
 */
export const useGetTenantAuditLogs = (
  tenantId: string | undefined,
  filters?: TenantAuditLogFilters,
) => {
  return useQuery<TenantAuditLogListResponse, Error>({
    queryKey: ['tenants', tenantId, 'audit-logs', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<TenantAuditLogListResponse>
      >(`/admin/tenants/${tenantId}/audit-logs`, { params: filters });
      return response.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Get tenant by ID
 */
export const useGetTenant = (id: string | undefined) => {
  return useQuery<Tenant, Error>({
    queryKey: ['tenants', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Tenant>>(
        `/admin/tenants/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create tenant
 */
export const useCreateTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Tenant>, Error, CreateTenantRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<Tenant>>(
        '/admin/tenants',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants']);
    },
  });
};

/**
 * Update tenant
 */
export const useUpdateTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Tenant>,
    Error,
    { id: string; data: UpdateTenantRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.patch<ApiResponse<Tenant>>(
        `/admin/tenants/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants']);
      queryClient.invalidateQueries(['tenants', variables.id]);
    },
  });
};

/**
 * Suspend tenant
 */
export const useSuspendTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Tenant>,
    Error,
    { id: string; reason: string }
  >({
    mutationFn: async ({ id, reason }) => {
      const response = await apiClient.post<ApiResponse<Tenant>>(
        `/admin/tenants/${id}/suspend`,
        { reason },
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['tenants']);
      queryClient.invalidateQueries(['tenants', variables.id]);
    },
  });
};

/**
 * Reactivate tenant
 */
export const useReactivateTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Tenant>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.post<ApiResponse<Tenant>>(
        `/admin/tenants/${id}/reactivate`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants']);
    },
  });
};

/**
 * Permanently delete a tenant and all related data
 */
export const useDeleteTenant = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<{ id: string; name: string; slug: string }>,
    Error,
    string
  >({
    mutationFn: async (id) => {
      const response = await apiClient.delete<
        ApiResponse<{ id: string; name: string; slug: string }>
      >(`/admin/tenants/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants']);
    },
  });
};

/**
 * Get global tenant roles (no tenant context)
 */
export const useGetTenantRoles = () => {
  return useQuery<TenantRole[], Error>({
    queryKey: ['tenants', 'roles'],
    queryFn: async () => {
      const response = await listTenantRoles();
      return response.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create a global tenant role
 */
export const useCreateTenantRole = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantRole>,
    Error,
    { data: CreateTenantRoleRequest }
  >({
    mutationFn: async ({ data }) => {
      return createTenantRole(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', 'roles'] });
    },
  });
};

/**
 * Update a global tenant role
 */
export const useUpdateTenantRole = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantRole>,
    Error,
    { roleId: string; data: UpdateTenantRoleRequest }
  >({
    mutationFn: async ({ roleId, data }) => {
      return updateTenantRole(roleId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', 'roles'] });
    },
  });
};

// ============================================
// Tenant Permissions
// ============================================

/**
 * List all tenant permissions
 */
export const useGetTenantPermissions = (params?: {
  category?: string;
  search?: string;
}) => {
  return useQuery<TenantPermission[], Error>({
    queryKey: ['tenants', 'permissions', params],
    queryFn: async () => {
      const response = await listTenantPermissions(params);
      return response.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * List distinct permission categories
 */
export const useGetPermissionCategories = () => {
  return useQuery<string[], Error>({
    queryKey: ['tenants', 'permissions', 'categories'],
    queryFn: async () => {
      const response = await listPermissionCategories();
      return response.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create a tenant permission
 */
export const useCreateTenantPermission = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantPermission>,
    Error,
    CreateTenantPermissionRequest
  >({
    mutationFn: async (data) => {
      return createTenantPermission(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', 'permissions'] });
    },
  });
};

/**
 * Update a tenant permission
 */
export const useUpdateTenantPermission = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantPermission>,
    Error,
    { id: string; data: UpdateTenantPermissionRequest }
  >({
    mutationFn: async ({ id, data }) => {
      return updateTenantPermission(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', 'permissions'] });
    },
  });
};

/**
 * Delete a tenant permission
 */
export const useDeleteTenantPermission = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (id) => {
      return deleteTenantPermission(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', 'permissions'] });
    },
  });
};

// ============================================
// Role-Permission Mapping
// ============================================

/**
 * Get role with its permissions
 */
export const useGetRolePermissions = (roleId: string | undefined) => {
  return useQuery<TenantRoleWithPermissions, Error>({
    queryKey: ['tenants', 'roles', roleId, 'permissions'],
    queryFn: async () => {
      const response = await getRolePermissions(roleId!);
      return response.data;
    },
    enabled: !!roleId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Set all permissions for a role (replace)
 */
export const useSetRolePermissions = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<TenantRoleWithPermissions>,
    Error,
    { roleId: string; permissionIds: string[] }
  >({
    mutationFn: async ({ roleId, permissionIds }) => {
      return setRolePermissions(roleId, permissionIds);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tenants', 'roles', variables.roleId, 'permissions'],
      });
      queryClient.invalidateQueries({ queryKey: ['tenants', 'roles'] });
    },
  });
};
