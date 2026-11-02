import apiClient from './client';
import {
  ApiResponse,
  CreateFeatureRequest,
  Feature,
  FeatureCategoriesResponse,
  FeaturesListResponse,
  PaginationParams,
  ProductsListResponse,
  UpdateFeatureRequest,
} from './types';

interface FeaturesParams extends PaginationParams {
  application_id?: string;
  category?: string;
  is_deprecated?: boolean;
}

/**
 * List all features
 * GET /admin/features
 */
export const listFeatures = async (
  params?: FeaturesParams,
): Promise<ApiResponse<FeaturesListResponse>> => {
  const response = await apiClient.get<ApiResponse<FeaturesListResponse>>(
    '/admin/features',
    { params },
  );
  return response.data;
};

/**
 * Get feature categories
 * GET /admin/features/categories
 */
export const getFeatureCategories = async (): Promise<
  ApiResponse<FeatureCategoriesResponse>
> => {
  const response = await apiClient.get<ApiResponse<FeatureCategoriesResponse>>(
    '/admin/features/categories',
  );
  return response.data;
};

/**
 * Create a new feature
 * POST /admin/features
 */
export const createFeature = async (
  data: CreateFeatureRequest,
): Promise<ApiResponse<Feature>> => {
  const response = await apiClient.post<ApiResponse<Feature>>(
    '/admin/features',
    data,
  );
  return response.data;
};

/**
 * Get feature by ID
 * GET /admin/features/:id
 */
export const getFeature = async (id: string): Promise<ApiResponse<Feature>> => {
  const response = await apiClient.get<ApiResponse<Feature>>(
    `/admin/features/${id}`,
  );
  return response.data;
};

/**
 * Update feature
 * PATCH /admin/features/:id
 */
export const updateFeature = async (
  id: string,
  data: UpdateFeatureRequest,
): Promise<ApiResponse<Feature>> => {
  const response = await apiClient.patch<ApiResponse<Feature>>(
    `/admin/features/${id}`,
    data,
  );
  return response.data;
};

/**
 * Deprecate feature
 * POST /admin/features/:id/deprecate
 */
export const deprecateFeature = async (
  id: string,
): Promise<ApiResponse<Feature>> => {
  const response = await apiClient.post<ApiResponse<Feature>>(
    `/admin/features/${id}/deprecate`,
  );
  return response.data;
};

/**
 * List products by feature
 * GET /admin/features/:featureId/products
 */
export const listProductsByFeature = async (
  featureId: string,
  params?: PaginationParams,
): Promise<ApiResponse<ProductsListResponse>> => {
  const response = await apiClient.get<ApiResponse<ProductsListResponse>>(
    `/admin/features/${featureId}/products`,
    { params },
  );
  return response.data;
};
