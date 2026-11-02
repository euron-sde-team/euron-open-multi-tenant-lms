import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { pagesApi } from "../api/pages";
import { useEditorStore } from "../stores/editor-store";
import type { CreatePageRequest, UpdatePageRequest } from "../types/page";
import { pageToPageConfig } from "../types/page";

import { availableRoutesKeys } from "./use-available-routes";
import { entitlementKeys } from "./use-entitlements";

// ============================================================================
// REACT QUERY HOOKS (using real backend API)
// ============================================================================

// Query keys for pages
export const pageKeys = {
  all: ["pages"] as const,
  lists: () => [...pageKeys.all, "list"] as const,
  list: (tenantId: string) => [...pageKeys.lists(), tenantId] as const,
  details: () => [...pageKeys.all, "detail"] as const,
  detail: (pageId: string) => [...pageKeys.details(), pageId] as const,
  revisions: (pageId: string) =>
    [...pageKeys.detail(pageId), "revisions"] as const,
};

// Hook to get all pages for a tenant
export const usePages = (tenantId: string | undefined, page = 1, limit = 20) => {
  return useQuery({
    queryKey: pageKeys.list(tenantId || ""),
    queryFn: () => pagesApi.getPages(tenantId!, page, limit),
    enabled: !!tenantId,
  });
};

// Hook to get a single page by ID
export const usePage = (pageId: string | undefined) => {
  return useQuery({
    queryKey: pageKeys.detail(pageId || ""),
    queryFn: () => pagesApi.getPage(pageId!),
    enabled: !!pageId,
  });
};

// Hook to load a page into the editor
export const useLoadPageToEditor = () => {
  const { initializePageConfig } = useEditorStore();

  return useMutation({
    mutationFn: async (pageId: string) => {
      const page = await pagesApi.getPage(pageId);
      return page;
    },
    onSuccess: (page) => {
      const config = pageToPageConfig(page);
      initializePageConfig(config);
    },
  });
};

// Hook to create a new page
export const useCreatePage = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreatePageRequest) => pagesApi.createPage(data),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      router.push(`/dashboard/pages/${page.id}/editor`);
    },
    onError: (error) => {
      console.error("Create page error:", error);
    },
  });
};

// Hook to save/update a page
export const useSavePage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      data,
    }: {
      pageId: string;
      data: UpdatePageRequest;
    }) => pagesApi.updatePage(pageId, data),
    onSuccess: (page) => {
      queryClient.setQueryData(pageKeys.detail(page.id), page);
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
    },
    onError: (error) => {
      console.error("Save page error:", error);
    },
    // Disable retries to prevent duplicate save requests
    retry: false,
  });
};

// Hook to delete a page
export const useDeletePage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) => pagesApi.deletePage(pageId),
    onSuccess: (_, pageId) => {
      queryClient.removeQueries({ queryKey: pageKeys.detail(pageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
    },
    onError: (error) => {
      console.error("Delete page error:", error);
    },
  });
};

// Hook to toggle page publish status
export const useTogglePublish = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      isPublished,
    }: {
      pageId: string;
      isPublished: boolean;
    }) => pagesApi.togglePublish(pageId, isPublished),
    onSuccess: (page) => {
      queryClient.setQueryData(pageKeys.detail(page.id), page);
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
    },
    onError: (error) => {
      console.error("Toggle publish error:", error);
    },
    retry: false, // Prevent duplicate requests on transient errors
  });
};

// Hook to duplicate a page
export const useDuplicatePage = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (pageId: string) => pagesApi.duplicatePage(pageId),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      router.push(`/dashboard/pages/${page.id}/editor`);
    },
    onError: (error) => {
      console.error("Duplicate page error:", error);
    },
  });
};

// Hook to list saved versions of a custom-code page (metadata only)
export const usePageRevisions = (
  pageId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: pageKeys.revisions(pageId || ""),
    queryFn: () => pagesApi.listRevisions(pageId as string),
    enabled: !!pageId && enabled,
  });
};

// Hook to restore a saved version into the page draft
export const useRestoreRevision = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pageId, revisionId }: { pageId: string; revisionId: string }) =>
      pagesApi.restoreRevision(pageId, revisionId),
    onSuccess: (page) => {
      queryClient.setQueryData(pageKeys.detail(page.id), page);
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(page.id) });
    },
    onError: (error) => {
      console.error("Restore revision error:", error);
    },
    retry: false,
  });
};

// Combined hook for common page operations
export const usePageOperations = () => {
  const createPage = useCreatePage();
  const savePage = useSavePage();
  const deletePage = useDeletePage();
  const togglePublish = useTogglePublish();
  const duplicatePage = useDuplicatePage();
  const loadPageToEditor = useLoadPageToEditor();

  return {
    createPage,
    savePage,
    deletePage,
    togglePublish,
    duplicatePage,
    loadPageToEditor,
    isLoading:
      createPage.isPending ||
      savePage.isPending ||
      deletePage.isPending ||
      togglePublish.isPending ||
      duplicatePage.isPending ||
      loadPageToEditor.isPending,
  };
};
