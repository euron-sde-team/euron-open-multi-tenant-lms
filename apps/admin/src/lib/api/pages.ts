import type { ApiResponse } from "../types/auth";
import type {
  CreatePageRequest,
  Page,
  PagesListResponse,
  UpdatePageRequest,
} from "../types/page";

import { apiClient } from "./axios";

export const pagesApi = {
  // Get all pages for a tenant (x-tenant-id set by axios interceptor from tenant store)
  getPages: async (tenantId: string, page = 1, limit = 20): Promise<PagesListResponse> => {
    const response = await apiClient.get<ApiResponse<PagesListResponse>>(
      `/pages?tenantId=${tenantId}&page=${page}&limit=${limit}`
    );
    return response.data.data;
  },

  // Get a single page by ID
  getPage: async (pageId: string): Promise<Page> => {
    const response = await apiClient.get<ApiResponse<Page>>(`/pages/${pageId}`);
    return response.data.data;
  },

  // Get a page by tenant and slug via the PUBLIC route (published pages only).
  // Note: this route never returns drafts, so it is not suitable for editors.
  getPageBySlug: async (tenantId: string, slug: string): Promise<Page> => {
    const response = await apiClient.get<ApiResponse<Page>>(
      `/pages/tenant/${tenantId}/slug/${encodeURIComponent(slug)}`
    );
    return response.data.data;
  },

  /**
   * Get the tenant's homepage as a full record (sections, theme, layout, seo).
   *
   * Single indexed point read. Resolves every historical homepage slug
   * ("home", "/", "") server-side, so it cannot miss the row the way scanning
   * a page of the list did once a tenant owned more pages than the list
   * returns. Null means the tenant has no homepage yet (normal during
   * onboarding); callers fall back to the default theme.
   */
  getHomepage: async (tenantId: string): Promise<Page | null> => {
    const response = await apiClient.get<ApiResponse<Page | null>>(
      `/pages/homepage?tenantId=${tenantId}`
    );
    return response.data.data ?? null;
  },

  // Create a new page
  createPage: async (data: CreatePageRequest): Promise<Page> => {
    const response = await apiClient.post<ApiResponse<Page>>("/pages", data);
    return response.data.data;
  },

  // Update an existing page
  updatePage: async (pageId: string, data: UpdatePageRequest): Promise<Page> => {
    const response = await apiClient.put<ApiResponse<Page>>(
      `/pages/${pageId}`,
      data
    );
    return response.data.data;
  },

  // Delete a page
  deletePage: async (pageId: string): Promise<void> => {
    await apiClient.delete(`/pages/${pageId}`);
  },

  // Publish/unpublish a page (using POST for better CORS compatibility)
  togglePublish: async (pageId: string, isPublished: boolean): Promise<Page> => {
    const response = await apiClient.post<ApiResponse<Page>>(
      `/pages/${pageId}/publish`,
      { isPublished }
    );
    return response.data.data;
  },

  // Duplicate a page
  duplicatePage: async (pageId: string): Promise<Page> => {
    const response = await apiClient.post<ApiResponse<Page>>(
      `/pages/${pageId}/duplicate`
    );
    return response.data.data;
  },

  // List saved versions (custom-code pages), newest first, most recent 20
  listRevisions: async (pageId: string): Promise<PageRevision[]> => {
    const response = await apiClient.get<ApiResponse<PageRevision[]>>(
      `/pages/${pageId}/revisions`
    );
    return response.data.data;
  },

  // Restore a saved version into the page draft (does not publish)
  restoreRevision: async (
    pageId: string,
    revisionId: string
  ): Promise<Page> => {
    const response = await apiClient.post<ApiResponse<Page>>(
      `/pages/${pageId}/revisions/${revisionId}/restore`
    );
    return response.data.data;
  },
};

// A saved snapshot of a custom-code page's served HTML (metadata only).
export interface PageRevision {
  id: string;
  customCodeKind: "SANITIZED_INLINE" | "SANDBOXED_IFRAME" | null;
  label: string | null;
  createdBy: string | null;
  createdAt: string;
}
