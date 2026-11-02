/**
 * API client for fetching categories from the learner API.
 * Used by the categories listing section in the admin page editor preview.
 * The learner API serves public category data; tenant is resolved via X-Tenant-Host.
 */

import { LEARNER_API_BASE_URL } from "@/lib/config/env";

function getApiBaseUrl(): string {
  return LEARNER_API_BASE_URL;
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

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch active categories for a tenant.
 * Requires tenantHost to resolve the tenant via X-Tenant-Host header.
 */
export async function fetchPublishedCategories(
  tenantHost: string,
): Promise<CategoriesResponse> {
  const url = `${getApiBaseUrl()}/categories`;

  const headers: Record<string, string> = {};
  if (tenantHost) {
    headers["X-Tenant-Host"] = tenantHost;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }

  const json: ApiResponse<CategoriesResponse> = await response.json();

  if (!json.success || !json.data) {
    throw new Error("Invalid response from server");
  }

  return json.data;
}
