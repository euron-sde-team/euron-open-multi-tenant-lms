/**
 * API client for fetching published bundles from the learner API.
 * Used by the content listing section in the admin page editor preview.
 * The learner API serves public bundle data; tenant is resolved via X-Tenant-Host.
 */

import { LEARNER_API_BASE_URL } from "@/lib/config/env";

function getApiBaseUrl(): string {
  return LEARNER_API_BASE_URL;
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
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch published bundles for a tenant.
 * Requires tenantHost (e.g. "northwind.lvh.me:3620") to resolve the tenant.
 */
export async function fetchPublishedBundles(
  tenantHost: string,
  params: BundlesListParams = {},
): Promise<PublishedBundlesResponse> {
  const {
    page = 1,
    limit = 8,
    sortBy = "sort_order",
    sortOrder = "asc",
  } = params;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  });

  const url = `${getApiBaseUrl()}/bundles?${queryParams.toString()}`;

  const headers: Record<string, string> = {};
  if (tenantHost) {
    headers["X-Tenant-Host"] = tenantHost;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch bundles: ${response.status}`);
  }

  const json: ApiResponse<PublishedBundlesResponse> = await response.json();

  if (!json.success || !json.data) {
    throw new Error("Invalid response from server");
  }

  return json.data;
}
