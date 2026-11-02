import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bundlesApi,
  type BundleDetail,
  type CreateBundleRequest,
  type UpdateBundleRequest,
  type AddBundleItemRequest,
} from "../api/bundles";

// ============================================================================
// REACT QUERY HOOKS FOR BUNDLES
// ============================================================================

export const bundleKeys = {
  all: ["bundles"] as const,
  lists: () => [...bundleKeys.all, "list"] as const,
  list: (filters?: { status?: string; search?: string }) =>
    [...bundleKeys.lists(), filters] as const,
  details: () => [...bundleKeys.all, "detail"] as const,
  detail: (bundleId: string) => [...bundleKeys.details(), bundleId] as const,
  items: (bundleId: string) => [...bundleKeys.detail(bundleId), "items"] as const,
};

/**
 * List all bundles for a tenant.
 */
export const useBundles = (
  page = 1,
  limit = 100,
  filters?: { status?: string; search?: string }
) => {
  return useQuery({
    queryKey: bundleKeys.list(filters),
    queryFn: () => bundlesApi.getBundles(page, limit, filters),
  });
};

/**
 * Get a single bundle by ID (with items).
 */
export const useBundle = (bundleId: string | undefined) => {
  return useQuery({
    queryKey: bundleKeys.detail(bundleId || ""),
    queryFn: () => bundlesApi.getBundle(bundleId!),
    enabled: !!bundleId,
  });
};

/**
 * Get a bundle by slug (with items).
 */
export const useBundleBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["bundles", "by-slug", slug],
    queryFn: () => bundlesApi.getBundleBySlug(slug!),
    enabled: !!slug,
  });
};

/**
 * Create a new bundle.
 */
export const useCreateBundle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBundleRequest) => bundlesApi.createBundle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bundleKeys.lists() });
    },
    onError: (error) => {
      console.error("Create bundle error:", error);
    },
  });
};

/**
 * Update a bundle.
 */
export const useUpdateBundle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bundleId,
      data,
    }: {
      bundleId: string;
      data: UpdateBundleRequest;
    }) => bundlesApi.updateBundle(bundleId, data),
    onSuccess: (result) => {
      queryClient.setQueryData(bundleKeys.detail(result.id), result);
      queryClient.invalidateQueries({ queryKey: bundleKeys.lists() });
    },
    onError: (error) => {
      console.error("Update bundle error:", error);
    },
  });
};

/**
 * Delete a bundle.
 */
export const useDeleteBundle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bundleId: string) => bundlesApi.deleteBundle(bundleId),
    onSuccess: (_, bundleId) => {
      queryClient.removeQueries({ queryKey: bundleKeys.detail(bundleId) });
      queryClient.invalidateQueries({ queryKey: bundleKeys.lists() });
    },
    onError: (error) => {
      console.error("Delete bundle error:", error);
    },
  });
};

/**
 * Toggle bundle publish status (DRAFT ↔ PUBLISHED).
 */
export const useToggleBundlePublish = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bundleId,
      isPublished,
    }: {
      bundleId: string;
      isPublished: boolean;
    }) => bundlesApi.togglePublish(bundleId, isPublished),
    onSuccess: (result) => {
      queryClient.setQueryData(bundleKeys.detail(result.id), result);
      queryClient.invalidateQueries({ queryKey: bundleKeys.lists() });
    },
    onError: (error) => {
      console.error("Toggle bundle publish error:", error);
    },
    retry: false,
  });
};

// ============================================================================
// BUNDLE ITEMS HOOKS
// ============================================================================

/**
 * Add an item to a bundle.
 */
export const useAddBundleItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bundleId,
      data,
    }: {
      bundleId: string;
      data: AddBundleItemRequest;
    }) => bundlesApi.addBundleItem(bundleId, data),
    onSuccess: (_, { bundleId }) => {
      queryClient.invalidateQueries({ queryKey: bundleKeys.detail(bundleId) });
      queryClient.invalidateQueries({ queryKey: bundleKeys.lists() });
    },
    onError: (error) => {
      console.error("Add bundle item error:", error);
    },
  });
};

/**
 * Remove an item from a bundle.
 */
export const useRemoveBundleItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bundleId, itemId }: { bundleId: string; itemId: string }) =>
      bundlesApi.removeBundleItem(bundleId, itemId),
    onSuccess: (_, { bundleId }) => {
      queryClient.invalidateQueries({ queryKey: bundleKeys.detail(bundleId) });
      queryClient.invalidateQueries({ queryKey: bundleKeys.lists() });
    },
    onError: (error) => {
      console.error("Remove bundle item error:", error);
    },
  });
};

/**
 * Reorder items in a bundle.
 */
export const useReorderBundleItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bundleId,
      itemIds,
    }: {
      bundleId: string;
      itemIds: string[];
    }) => bundlesApi.reorderBundleItems(bundleId, itemIds),
    onSuccess: (result, { bundleId }) => {
      // Update the bundle detail with new item order
      queryClient.setQueryData(
        bundleKeys.detail(bundleId),
        (old: BundleDetail | undefined) =>
          old ? { ...old, items: result } : old
      );
    },
    onError: (error) => {
      console.error("Reorder bundle items error:", error);
    },
  });
};
