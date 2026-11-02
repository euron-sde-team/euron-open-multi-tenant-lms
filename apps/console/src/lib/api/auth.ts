import apiClient from './client';
import { AdminUser, ApiResponse, LoginRequest, LoginResponse } from './types';

/**
 * Login with email and password
 * POST /admin/auth/login
 */
export const login = async (
  data: LoginRequest,
): Promise<ApiResponse<LoginResponse>> => {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/admin/auth/login',
    data,
  );
  return response.data;
};

/**
 * Get current authenticated user profile
 * GET /admin/auth/me
 */
export const getMe = async (): Promise<ApiResponse<AdminUser>> => {
  const response =
    await apiClient.get<ApiResponse<AdminUser>>('/admin/auth/me');
  return response.data;
};

/**
 * Logout current user
 * POST /admin/auth/logout
 */
export const logout = async (): Promise<ApiResponse<{ message: string }>> => {
  const response =
    await apiClient.post<ApiResponse<{ message: string }>>(
      '/admin/auth/logout',
    );
  return response.data;
};
