import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  Application,
  ApplicationsListResponse,
  CreateApplicationRequest,
  FeaturesListResponse,
  UpdateApplicationRequest,
} from '../types';

export interface ApplicationsFilters {
  page?: number;
  limit?: number;
  is_active?: boolean;
  is_public?: boolean;
  search?: string;
}

/**
 * Get all applications
 */
export const useGetApplications = (filters?: ApplicationsFilters) => {
  return useQuery<ApplicationsListResponse, Error>({
    queryKey: ['applications', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<ApplicationsListResponse>
      >('/admin/applications', { params: filters });
      return response.data.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
    keepPreviousData: true, // Keep showing old data while fetching new data
  });
};

/**
 * Get application by ID
 */
export const useGetApplication = (id: string | undefined) => {
  return useQuery<Application, Error>({
    queryKey: ['applications', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Application>>(
        `/admin/applications/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create application
 */
export const useCreateApplication = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Application>, Error, CreateApplicationRequest>(
    {
      mutationFn: async (data) => {
        const response = await apiClient.post<ApiResponse<Application>>(
          '/admin/applications',
          data,
        );
        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries(['applications']);
      },
    },
  );
};

/**
 * Update application
 */
export const useUpdateApplication = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Application>,
    Error,
    { id: string; data: UpdateApplicationRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.patch<ApiResponse<Application>>(
        `/admin/applications/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['applications']);
      queryClient.invalidateQueries(['applications', variables.id]);
    },
  });
};

/**
 * Deactivate application
 */
export const useDeactivateApplication = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.delete<ApiResponse<null>>(
        `/admin/applications/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['applications']);
    },
  });
};

/**
 * Get features by application
 */
export const useGetFeaturesByApplication = (
  appId: string | undefined,
  filters?: { page?: number; limit?: number },
) => {
  return useQuery<FeaturesListResponse, Error>({
    queryKey: ['applications', appId, 'features', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<FeaturesListResponse>>(
        `/admin/applications/${appId}/features`,
        { params: filters },
      );
      return response.data.data;
    },
    enabled: !!appId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};
