import apiClient from './client';
import {
  ApiResponse,
  ConstraintType,
  CreateProductRequest,
  PaginationParams,
  Product,
  ProductsListResponse,
  UpdateProductRequest,
} from './types';

interface ProductsParams extends PaginationParams {
  feature_id?: string;
  application_id?: string;
  constraint_type?: ConstraintType;
  is_hard_limit?: boolean;
  search?: string;
}

/**
 * List all products
 * GET /admin/products
 */
export const listProducts = async (
  params?: ProductsParams,
): Promise<ApiResponse<ProductsListResponse>> => {
  const response = await apiClient.get<ApiResponse<ProductsListResponse>>(
    '/admin/products',
    { params },
  );
  return response.data;
};

/**
 * Create a new product
 * POST /admin/products
 */
export const createProduct = async (
  data: CreateProductRequest,
): Promise<ApiResponse<Product>> => {
  const response = await apiClient.post<ApiResponse<Product>>(
    '/admin/products',
    data,
  );
  return response.data;
};

/**
 * Get product by ID
 * GET /admin/products/:id
 */
export const getProduct = async (id: string): Promise<ApiResponse<Product>> => {
  const response = await apiClient.get<ApiResponse<Product>>(
    `/admin/products/${id}`,
  );
  return response.data;
};

/**
 * Update product
 * PATCH /admin/products/:id
 */
export const updateProduct = async (
  id: string,
  data: UpdateProductRequest,
): Promise<ApiResponse<Product>> => {
  const response = await apiClient.patch<ApiResponse<Product>>(
    `/admin/products/${id}`,
    data,
  );
  return response.data;
};
