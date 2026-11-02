/**
 * API client for fetching published courses from the user server.
 * Used by the course cards section on landing pages.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */

import { apiGet } from "./api-client";

function getApiBaseUrl(): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1`;
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
  has_access?: boolean;
  /** The member's progress on an owned course (0 to 100); absent otherwise. */
  progress_percent?: number;
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
  courseType?: "NORMAL" | "PROJECT";
  mode?: "SELF_PACED" | "LIVE" | "HYBRID";
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch published courses for the current tenant.
 * Tenant is resolved from the request host header.
 * Client-side: uses api-client (401 handling). Server-side: uses fetch.
 */
export async function fetchPublishedCourses(
  params: CoursesListParams = {},
  host?: string
): Promise<PublishedCoursesResponse> {
  const { page = 1, limit = 8, sortBy = "sort_order", sortOrder = "asc", courseType, mode } = params;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  });
  if (courseType) queryParams.set("course_type", courseType);
  if (mode) queryParams.set("mode", mode);

  const path = `/courses?${queryParams.toString()}`;

  if (typeof window !== "undefined") {
    return apiGet<PublishedCoursesResponse>(path);
  }

  const tenantHost = host || "";
  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };
  const response = await fetch(`${getApiBaseUrl()}${path}`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch courses: ${response.status}`);
  const json: ApiResponse<PublishedCoursesResponse> = await response.json();
  if (!json.success || !json.data) throw new Error("Invalid response from server");
  return json.data;
}
