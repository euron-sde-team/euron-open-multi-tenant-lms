/**
 * API client for fetching published courses from the learner API.
 * Used by the course cards section in the admin page editor preview.
 * The learner API serves public course data; tenant is resolved via X-Tenant-Host.
 */

import { LEARNER_API_BASE_URL } from "@/lib/config/env";

function getApiBaseUrl(): string {
  return LEARNER_API_BASE_URL;
}

export interface PublishedCourseListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  mode: string;
  difficulty: string;
  language: string[];
  instructor: { id: string; name: string; avatar: string | null } | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PublishedCoursesResponse {
  courses: PublishedCourseListItem[];
  pagination: PaginationMeta;
}

export interface CoursesListParams {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
  mode?: "SELF_PACED";
  courseType?: "NORMAL" | "PROJECT";
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch published courses for a tenant.
 * Requires tenantHost (e.g. "northwind.lvh.me:3620") to resolve the tenant.
 */
export async function fetchPublishedCourses(
  tenantHost: string,
  params: CoursesListParams = {}
): Promise<PublishedCoursesResponse> {
  const { page = 1, limit = 8, sortBy = "sort_order", sortOrder = "asc", mode, courseType } = params;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  });
  if (mode) queryParams.set("mode", mode);
  if (courseType) queryParams.set("courseType", courseType);

  const url = `${getApiBaseUrl()}/courses?${queryParams.toString()}`;

  const headers: Record<string, string> = {};
  if (tenantHost) {
    headers["X-Tenant-Host"] = tenantHost;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch courses: ${response.status}`);
  }

  const json: ApiResponse<PublishedCoursesResponse> = await response.json();

  if (!json.success || !json.data) {
    throw new Error("Invalid response from server");
  }

  return json.data;
}
