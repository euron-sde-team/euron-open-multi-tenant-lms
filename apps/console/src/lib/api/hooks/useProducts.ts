import { useMutation, useQuery, useQueryClient } from 'react-query';

import apiClient from '../client';
import {
  ApiResponse,
  ConstraintType,
  CreateProductRequest,
  Product,
  ProductsListResponse,
  UpdateProductRequest,
} from '../types';

export interface ProductsFilters {
  page?: number;
  limit?: number;
  feature_id?: string;
  application_id?: string;
  constraint_type?: ConstraintType;
  is_hard_limit?: boolean;
  search?: string;
}

/**
 * Get all products
 */
export const useGetProducts = (filters?: ProductsFilters) => {
  return useQuery<ProductsListResponse, Error>({
    queryKey: ['products', filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProductsListResponse>>(
        '/admin/products',
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
 * Get product by ID
 */
export const useGetProduct = (id: string | undefined) => {
  return useQuery<Product, Error>({
    queryKey: ['products', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Product>>(
        `/admin/products/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Create product
 */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Product>, Error, CreateProductRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post<ApiResponse<Product>>(
        '/admin/products',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['features']);
    },
  });
};

/**
 * Update product
 */
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Product>,
    Error,
    { id: string; data: UpdateProductRequest }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.patch<ApiResponse<Product>>(
        `/admin/products/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['products', variables.id]);
    },
  });
};
