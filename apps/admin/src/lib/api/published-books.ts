/**
 * API client for fetching published books from the learner API.
 * Used by the book showcase section in the admin page editor preview.
 * The learner API serves public book data; tenant is resolved via X-Tenant-Host.
 */

import { LEARNER_API_BASE_URL } from "@/lib/config/env";

function getApiBaseUrl(): string {
  return LEARNER_API_BASE_URL;
}

export interface PublishedBookListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  pages: number | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  language: string[];
  author: string | null;
  authors: { id: string; name: string }[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PublishedBooksResponse {
  books: PublishedBookListItem[];
  pagination: PaginationMeta;
}

export interface BooksListParams {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch published books for a tenant.
 * Requires tenantHost (e.g. "northwind.lvh.me:3620") to resolve the tenant.
 */
export async function fetchPublishedBooks(
  tenantHost: string,
  params: BooksListParams = {}
): Promise<PublishedBooksResponse> {
  const { page = 1, limit = 8, sortBy = "sort_order", sortOrder = "asc" } = params;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  });

  const url = `${getApiBaseUrl()}/books?${queryParams.toString()}`;

  const headers: Record<string, string> = {};
  if (tenantHost) {
    headers["X-Tenant-Host"] = tenantHost;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch books: ${response.status}`);
  }

  const json: ApiResponse<PublishedBooksResponse> = await response.json();

  if (!json.success || !json.data) {
    throw new Error("Invalid response from server");
  }

  return json.data;
}
