/**
 * API client for fetching published bundles from the user server.
 * Used by the bundles listing page.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */

import { apiGet } from "./api-client";

export function getBundlesApiBaseUrl(): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1`;
}

export interface PublishedBundleListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  itemCount: number;
  sortOrder: number;
  createdAt: string;
  is_bookmarked?: boolean;
  has_access?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PublishedBundlesResponse {
  bundles: PublishedBundleListItem[];
  pagination: PaginationMeta;
}

export interface BundlesListParams {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
  bookmarkedOnly?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch published bundles for the current tenant.
 * Tenant is resolved from the request host header.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */
export async function fetchPublishedBundles(
  params: BundlesListParams = {},
  host?: string
): Promise<PublishedBundlesResponse> {
  const {
    page = 1,
    limit = 8,
    sortBy = "sort_order",
    sortOrder = "asc",
    bookmarkedOnly,
  } = params;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  });
  if (bookmarkedOnly) queryParams.set("bookmarked_only", "true");

  const path = `/bundles?${queryParams.toString()}`;

  if (typeof window !== "undefined") {
    return apiGet<PublishedBundlesResponse>(path);
  }

  const tenantHost = host || "";
  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };
  const response = await fetch(`${getBundlesApiBaseUrl()}${path}`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch bundles: ${response.status}`);
  const json: ApiResponse<PublishedBundlesResponse> = await response.json();
  if (!json.success || !json.data) throw new Error("Invalid response from server");
  return json.data;
}

export interface PublishedBundleItem {
  id: string;
  itemType: "COURSE" | "BOOK" | "TEST_SERIES";
  courseId: string | null;
  bookId: string | null;
  sortOrder: number;
  courseTitle: string | null;
  courseSlug: string | null;
  courseSubtitle: string | null;
  courseThumbnailKey: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
  bookPages: number | null;
  bookThumbnailUrl: string | null;
  testSeriesId: string | null;
  testSeriesTitle: string | null;
  testSeriesSlug: string | null;
  testSeriesCoverImageKey: string | null;
}

export interface LinkedProduct {
  productCode: string;
  productTitle: string | null;
  featureName: string | null;
  constraintType: string;
  unit: string | null;
}

export interface PublishedBundleDetail extends PublishedBundleListItem {
  previewUrl: string | null;
  validityDays: number | null;
  updatedAt: string;
  items?: PublishedBundleItem[];
  has_access?: boolean;
  is_archived?: boolean;
  linked_products?: LinkedProduct[];
}

/**
 * Fetch a single published bundle by slug.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */
export async function fetchBundleBySlug(
  slug: string,
  host?: string
): Promise<PublishedBundleDetail> {
  const path = `/bundles/${encodeURIComponent(slug)}`;

  if (typeof window !== "undefined") {
    try {
      return await apiGet<PublishedBundleDetail>(path);
    } catch (e) {
      if ((e as import("./api-client").ApiError).status === 404) {
        throw new Error("Bundle not found");
      }
      throw e;
    }
  }

  const tenantHost = host || "";
  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };
  const response = await fetch(`${getBundlesApiBaseUrl()}${path}`, { headers });
  if (response.status === 404) throw new Error("Bundle not found");
  if (!response.ok) throw new Error(`Failed to fetch bundle: ${response.status}`);
  const json: ApiResponse<PublishedBundleDetail> = await response.json();
  if (!json.success || !json.data) throw new Error("Invalid response from server");
  return json.data;
}
