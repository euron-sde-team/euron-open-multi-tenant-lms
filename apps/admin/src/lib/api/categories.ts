import type { ApiResponse } from "../types/auth";
import type { Category, CategoriesListResponse } from "../types/category";

import { apiClient } from "./axios";

const BASE = "/tenant/categories";

export const categoriesApi = {
  getCategories: async (
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      is_active?: boolean;
      parent_id?: string | null;
    }
  ): Promise<CategoriesListResponse> => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.search) search.set("search", params.search);
    if (params?.is_active !== undefined) search.set("is_active", String(params.is_active));
    if (params?.parent_id !== undefined) {
      search.set("parent_id", params.parent_id === null ? "null" : params.parent_id);
    }
    const q = search.toString();
    const response = await apiClient.get<ApiResponse<CategoriesListResponse>>(
      q ? `${BASE}?${q}` : BASE
    );
    return response.data.data;
  },

  getCategory: async (categoryId: string): Promise<Category> => {
    const response = await apiClient.get<ApiResponse<Category>>(
      `${BASE}/${categoryId}`
    );
    return response.data.data;
  },

  createCategory: async (data: {
    name: string;
    slug?: string;
    description?: string | null;
    icon_url?: string | null;
    parent_id?: string | null;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<Category> => {
    const response = await apiClient.post<ApiResponse<Category>>(BASE, data);
    return response.data.data;
  },

  updateCategory: async (
    categoryId: string,
    data: {
      name?: string;
      slug?: string;
      description?: string | null;
      icon_url?: string | null;
      parent_id?: string | null;
      sort_order?: number;
      is_active?: boolean;
    }
  ): Promise<Category> => {
    const response = await apiClient.put<ApiResponse<Category>>(
      `${BASE}/${categoryId}`,
      data
    );
    return response.data.data;
  },

  deleteCategory: async (categoryId: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${categoryId}`);
  },
};
