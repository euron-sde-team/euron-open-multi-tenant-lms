import { useMutation, useQueryClient } from 'react-query';

import { AUTH_TOKEN_KEY } from '@/constant/env';

import apiClient from '../client';
import { ApiResponse, LoginRequest, LoginResponse } from '../types';

/**
 * Login mutation hook
 */
export const useLogin = () => {
  return useMutation<ApiResponse<LoginResponse>, Error, LoginRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<LoginResponse>>(
        '/admin/auth/login',
        data,
      );
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success && data.data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.data.token);
      }
    },
  });
};

/**
 * Logout mutation hook
 */
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<{ message: string }>, Error>({
    mutationFn: async () => {
      const response =
        await apiClient.post<ApiResponse<{ message: string }>>(
          '/admin/auth/logout',
        );
      return response.data;
    },
    onSuccess: () => {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      queryClient.clear();
    },
  });
};
