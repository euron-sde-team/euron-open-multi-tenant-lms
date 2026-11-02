import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  CreateFeatureRequest,
  Feature,
  FeatureCategoriesResponse,
  FeaturesListResponse,
  ProductsListResponse,
  UpdateFeatureRequest,
} from '../types';

export interface FeaturesFilters {
  page?: number;
  limit?: number;
  application_id?: string;
  category?: string;
  is_deprecated?: boolean;
  search?: string;
}

/**
 * Get all features
 */
export const useGetFeatures = (filters?: FeaturesFilters) => {
  return useQuery<FeaturesListResponse, Error>({
    queryKey: ['features', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<FeaturesListResponse>>(
        '/admin/features',
        { params: filters },
      );
      return response.data.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true, // Keep showing old data while fetching new data
  });
};

/**
 * Get feature categories
 */
export const useGetFeatureCategories = () => {
  return useQuery<FeatureCategoriesResponse, Error>({
    queryKey: ['features', 'categories'],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<FeatureCategoriesResponse>
      >('/admin/features/categories');
      return response.data.data;
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Get feature by ID
 */
export const useGetFeature = (id: string | undefined) => {
  return useQuery<Feature, Error>({
    queryKey: ['features', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Feature>>(
        `/admin/features/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create feature
 */
export const useCreateFeature = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Feature>, Error, CreateFeatureRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<Feature>>(
        '/admin/features',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['features']);
      queryClient.invalidateQueries(['applications']);
    },
  });
};

/**
 * Update feature
 */
export const useUpdateFeature = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Feature>,
    Error,
    { id: string; data: UpdateFeatureRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.patch<ApiResponse<Feature>>(
        `/admin/features/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['features']);
      queryClient.invalidateQueries(['features', variables.id]);
    },
  });
};

/**
 * Deprecate feature
 */
export const useDeprecateFeature = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Feature>, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.post<ApiResponse<Feature>>(
        `/admin/features/${id}/deprecate`,
      );
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['features']);
      queryClient.invalidateQueries(['features', id]);
    },
  });
};

/**
 * Get products by feature
 */
export const useGetProductsByFeature = (
  featureId: string | undefined,
  filters?: { page?: number; limit?: number },
) => {
  return useQuery<ProductsListResponse, Error>({
    queryKey: ['features', featureId, 'products', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProductsListResponse>>(
        `/admin/features/${featureId}/products`,
        { params: filters },
      );
      return response.data.data;
    },
    enabled: !!featureId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};
