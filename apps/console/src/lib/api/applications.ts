import apiClient from './client';
import {
  ApiResponse,
  Application,
  ApplicationsListResponse,
  CreateApplicationRequest,
  FeaturesListResponse,
  PaginationParams,
  UpdateApplicationRequest,
} from './types';

interface ApplicationsParams extends PaginationParams {
  is_active?: boolean;
  is_public?: boolean;
}

/**
 * List all applications
 * GET /admin/applications
 */
export const listApplications = async (
  params?: ApplicationsParams,
): Promise<ApiResponse<ApplicationsListResponse>> => {
  const response = await apiClient.get<ApiResponse<ApplicationsListResponse>>(
    '/admin/applications',
    { params },
  );
  return response.data;
};

/**
 * Create a new application
 * POST /admin/applications
 */
export const createApplication = async (
  data: CreateApplicationRequest,
): Promise<ApiResponse<Application>> => {
  const response = await apiClient.post<ApiResponse<Application>>(
    '/admin/applications',
    data,
  );
  return response.data;
};

/**
 * Get application by ID
 * GET /admin/applications/:id
 */
export const getApplication = async (
  id: string,
): Promise<ApiResponse<Application>> => {
  const response = await apiClient.get<ApiResponse<Application>>(
    `/admin/applications/${id}`,
  );
  return response.data;
};

/**
 * Update application
 * PATCH /admin/applications/:id
 */
export const updateApplication = async (
  id: string,
  data: UpdateApplicationRequest,
): Promise<ApiResponse<Application>> => {
  const response = await apiClient.patch<ApiResponse<Application>>(
    `/admin/applications/${id}`,
    data,
  );
  return response.data;
};

/**
 * Deactivate application
 * DELETE /admin/applications/:id
 */
export const deactivateApplication = async (
  id: string,
): Promise<ApiResponse<null>> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/admin/applications/${id}`,
  );
  return response.data;
};

/**
 * List features by application
 * GET /admin/applications/:appId/features
 */
export const listFeaturesByApplication = async (
  appId: string,
  params?: PaginationParams,
): Promise<ApiResponse<FeaturesListResponse>> => {
  const response = await apiClient.get<ApiResponse<FeaturesListResponse>>(
    `/admin/applications/${appId}/features`,
    { params },
  );
  return response.data;
};
