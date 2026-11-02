/**
 * Bundles API Client
 *
 * Bundle records live in the `bundles` table with items in `bundle_items`.
 * Bundles group courses and books into a single purchasable offering.
 */

import type { ContentPrice } from "@open-mtlms/shared";

import type { ApiResponse } from "../types/auth";
import { generateSlug } from "../utils/slug";

import { apiClient } from "./axios";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type BundleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type BundleItemType = "COURSE" | "BOOK" | "TEST_SERIES";

export interface BundleItem {
  id: string;
  tenantId: string;
  bundleId: string;
  itemType: BundleItemType;
  courseId: string | null;
  bookId: string | null;
  testSeriesId: string | null;
  sortOrder: number;
  createdAt: string;
  // Joined details
  courseTitle?: string | null;
  courseSlug?: string | null;
  courseThumbnailKey?: string | null;
  bookTitle?: string | null;
  bookSlug?: string | null;
  bookThumbnailUrl?: string | null;
  testSeriesTitle?: string | null;
  testSeriesSlug?: string | null;
  testSeriesCoverImageKey?: string | null;
}

export interface Bundle {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  /** Multi-currency price book (returned on detail GETs; bundles use no discounts). */
  prices?: ContentPrice[];
  thumbnailUrl: string | null;
  previewUrl: string | null;
  status: BundleStatus;
  purchaseMode: string;
  validityDays: number | null;
  sortOrder: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BundleDetail extends Bundle {
  items: BundleItem[];
}

export interface BundlesListResponse {
  bundles: Bundle[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateBundleRequest {
  title: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  prices?: ContentPrice[];
  thumbnail_url?: string | null;
  preview_url?: string | null;
  status?: BundleStatus;
  purchase_mode?: "FREE" | "PAID";
  validity_days?: number | null;
  sort_order?: number;
}

export interface UpdateBundleRequest {
  title?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  prices?: ContentPrice[];
  thumbnail_url?: string | null;
  preview_url?: string | null;
  status?: BundleStatus;
  purchase_mode?: "FREE" | "PAID";
  validity_days?: number | null;
  sort_order?: number;
}

export interface AddBundleItemRequest {
  item_type: BundleItemType;
  course_id?: string | null;
  book_id?: string | null;
  test_series_id?: string | null;
}

// ─────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────

export const bundlesApi = {
  /**
   * List bundles for a tenant.
   */
  getBundles: async (
    page = 1,
    limit = 100,
    filters?: { status?: string; search?: string }
  ): Promise<BundlesListResponse> => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filters?.status) params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);

    const response = await apiClient.get<ApiResponse<BundlesListResponse>>(
      `/tenant/bundles?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get a single bundle by ID (with items).
   */
  getBundle: async (bundleId: string): Promise<BundleDetail> => {
    const response = await apiClient.get<ApiResponse<BundleDetail>>(
      `/tenant/bundles/${bundleId}`
    );
    return response.data.data;
  },

  /**
   * Get a bundle by slug (with items).
   */
  getBundleBySlug: async (slug: string): Promise<BundleDetail> => {
    const response = await apiClient.get<ApiResponse<BundleDetail>>(
      `/tenant/bundles/by-slug/${encodeURIComponent(slug)}`
    );
    return response.data.data;
  },

  /**
   * Create a new bundle.
   */
  createBundle: async (data: CreateBundleRequest): Promise<Bundle> => {
    const slug = data.slug || generateSlug(data.title);
    if (!slug) {
      throw new Error("Invalid bundle title, cannot generate slug");
    }

    const response = await apiClient.post<ApiResponse<Bundle>>("/tenant/bundles", {
      ...data,
      slug,
    });
    return response.data.data;
  },

  /**
   * Update an existing bundle.
   */
  updateBundle: async (bundleId: string, data: UpdateBundleRequest): Promise<BundleDetail> => {
    const response = await apiClient.put<ApiResponse<BundleDetail>>(
      `/tenant/bundles/${bundleId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete a bundle.
   */
  deleteBundle: async (bundleId: string): Promise<void> => {
    await apiClient.delete(`/tenant/bundles/${bundleId}`);
  },

  /**
   * Toggle publish: DRAFT ↔ PUBLISHED.
   * Backend validates bundle has at least one item before publishing.
   */
  togglePublish: async (bundleId: string, isPublished: boolean): Promise<BundleDetail> => {
    const response = await apiClient.post<ApiResponse<BundleDetail>>(
      `/tenant/bundles/${bundleId}/toggle-publish`,
      { publish: isPublished }
    );
    return response.data.data;
  },

  // ─────────────────────────────────────────────────────────────
  // Bundle Items
  // ─────────────────────────────────────────────────────────────

  /**
   * List items in a bundle.
   */
  getBundleItems: async (bundleId: string): Promise<BundleItem[]> => {
    const response = await apiClient.get<ApiResponse<BundleItem[]>>(
      `/tenant/bundles/${bundleId}/items`
    );
    return response.data.data;
  },

  /**
   * Add an item (course or book) to a bundle.
   */
  addBundleItem: async (bundleId: string, data: AddBundleItemRequest): Promise<BundleItem> => {
    const response = await apiClient.post<ApiResponse<BundleItem>>(
      `/tenant/bundles/${bundleId}/items`,
      data
    );
    return response.data.data;
  },

  /**
   * Remove an item from a bundle.
   */
  removeBundleItem: async (bundleId: string, itemId: string): Promise<void> => {
    await apiClient.delete(`/tenant/bundles/${bundleId}/items/${itemId}`);
  },

  /**
   * Reorder items in a bundle.
   */
  reorderBundleItems: async (bundleId: string, itemIds: string[]): Promise<BundleItem[]> => {
    const response = await apiClient.patch<ApiResponse<BundleItem[]>>(
      `/tenant/bundles/${bundleId}/items/reorder`,
      { item_ids: itemIds }
    );
    return response.data.data;
  },
};
