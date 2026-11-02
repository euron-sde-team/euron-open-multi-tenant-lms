/**
 * API client for fetching categories from the user server.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */

import { apiGet } from "./api-client";

function getApiBaseUrl(): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }
  if (process.env.USER_SERVER_URL) {
    return process.env.USER_SERVER_URL.replace(/\/$/, "");
  }
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1`;
}

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  parent_id: string | null;
  sort_order: number;
}

export interface CategoriesResponse {
  categories: CategoryListItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch active categories for the current tenant.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */
export async function fetchCategories(host?: string): Promise<CategoriesResponse> {
  const path = "/categories";

  if (typeof window !== "undefined") {
    return apiGet<CategoriesResponse>(path);
  }

  const tenantHost = host || "";
  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers,
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`Failed to fetch categories: ${response.status}`);
  const json: ApiResponse<CategoriesResponse> = await response.json();
  if (!json.success || !json.data) throw new Error("Invalid response from server");
  return json.data;
}

/**
 * Fetch a single category by slug.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */
export async function fetchCategoryBySlug(
  slug: string,
  host?: string
): Promise<CategoryListItem | null> {
  const path = `/categories/${encodeURIComponent(slug)}`;

  if (typeof window !== "undefined") {
    try {
      return await apiGet<CategoryListItem>(path);
    } catch (e) {
      if ((e as import("./api-client").ApiError).status === 404) return null;
      throw e;
    }
  }

  const tenantHost = host || "";
  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };
  const response = await fetch(`${getApiBaseUrl()}${path}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch category: ${response.status}`);
  const json: ApiResponse<CategoryListItem> = await response.json();
  return json.success && json.data ? json.data : null;
}

/**
 * Fetch courses filtered by category slug.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */
export async function fetchCoursesByCategory(
  categorySlug: string,
  host?: string
): Promise<{ courses: Array<Record<string, unknown>> }> {
  const path = `/courses?${new URLSearchParams({ category: categorySlug }).toString()}`;

  if (typeof window !== "undefined") {
    const data = await apiGet<{ courses?: Record<string, unknown>[] }>(path);
    return { courses: (data?.courses ?? []) as Record<string, unknown>[] };
  }

  const tenantHost = host || "";
  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };
  const response = await fetch(`${getApiBaseUrl()}${path}`, { headers });
  if (!response.ok) return { courses: [] };
  const json = (await response.json()) as { success?: boolean; data?: { courses?: Record<string, unknown>[] } };
  return { courses: (json.data?.courses ?? []) as Record<string, unknown>[] };
}

/**
 * Fetch books filtered by category slug.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */
export async function fetchBooksByCategory(
  categorySlug: string,
  host?: string
): Promise<{ books: Array<Record<string, unknown>> }> {
  const path = `/books?${new URLSearchParams({ category: categorySlug }).toString()}`;

  if (typeof window !== "undefined") {
    const data = await apiGet<{ books?: Record<string, unknown>[] }>(path);
    return { books: (data?.books ?? []) as Record<string, unknown>[] };
  }

  const tenantHost = host || "";
  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };
  const response = await fetch(`${getApiBaseUrl()}${path}`, { headers });
  if (!response.ok) return { books: [] };
  const json = (await response.json()) as { success?: boolean; data?: { books?: Record<string, unknown>[] } };
  return { books: (json.data?.books ?? []) as Record<string, unknown>[] };
}
