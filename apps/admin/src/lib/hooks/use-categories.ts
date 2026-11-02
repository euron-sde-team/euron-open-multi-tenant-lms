import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { categoriesApi } from "../api/categories";
import type { CategoriesListResponse } from "../types/category";

export const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  list: (tenantId: string) => [...categoryKeys.lists(), tenantId] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};

export const useCategories = (tenantId: string | undefined) => {
  return useQuery<CategoriesListResponse>({
    queryKey: categoryKeys.list(tenantId ?? ""),
    queryFn: () => categoriesApi.getCategories({ limit: 100 }),
    enabled: !!tenantId,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      slug?: string;
      description?: string | null;
      icon_url?: string | null;
      parent_id?: string | null;
      sort_order?: number;
      is_active?: boolean;
    }) => categoriesApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: {
        name?: string;
        slug?: string;
        description?: string | null;
        icon_url?: string | null;
        parent_id?: string | null;
        sort_order?: number;
        is_active?: boolean;
      };
    }) => categoriesApi.updateCategory(categoryId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: categoryKeys.detail(variables.categoryId),
      });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) =>
      categoriesApi.deleteCategory(categoryId),
    onSuccess: (_, categoryId) => {
      queryClient.removeQueries({
        queryKey: categoryKeys.detail(categoryId),
      });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};
