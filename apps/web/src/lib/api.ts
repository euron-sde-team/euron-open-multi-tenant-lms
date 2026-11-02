/**
 * learner-api base URL and course list fetch.
 * Reuses same env as template.server (NEXT_PUBLIC_API_BASE_URL, USER_SERVER_URL, NEXT_PUBLIC_USER_SERVER_PORT).
 */

import { THUMBNAILS_BASE_URL } from "@/lib/utils/constants";

/**
 * Resolve course thumbnail_key to a public URL.
 * If the value is already an absolute URL (http/https/data), return it as-is.
 * Otherwise use THUMBNAILS_BASE_URL (NEXT_PUBLIC_THUMBNAILS_BASE_URL) when set.
 */
export function getCourseThumbnailUrl(thumbnailKey: string | null | undefined): string | null {
  if (!thumbnailKey?.trim()) return null;
  const key = thumbnailKey.trim();
  if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("data:")) {
    return key;
  }
  if (!THUMBNAILS_BASE_URL) return null;
  const path = key.startsWith("/") ? key.slice(1) : key;
  return `${THUMBNAILS_BASE_URL}/${path}`;
}

export type CourseMode = "LIVE" | "SELF_PACED" | "HYBRID";

export interface CourseListItem {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  mode: string;
  difficulty: string;
  duration: string | null;
  thumbnail_key: string | null;
  secondary_thumbnail_key: string | null;
  price_inr: string | null;
  price_usd: string | null;
  purchase_mode: string;
  sort_order: number;
  /** PUBLISHED bundles containing this course, drives the "Part of X" chip. */
  bundles?: { id: string; title: string; slug: string }[];
  created_at: string;
  status?: string;
  has_access?: boolean;
  instructor?: { id: string; name: string; avatar: string | null } | null;
  is_bookmarked?: boolean;
  progress_percent?: number;
  completed_lectures?: number;
  total_lectures?: number;
}

export interface CourseListResponse {
  courses: CourseListItem[];
  total: number;
  page: number;
  limit: number;
}

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

/**
 * Fetch course list from learner-api. Use from RSC with tenantHost from headers.
 */
export type CourseTypeFilter = "NORMAL" | "PROJECT";

export async function fetchCourseList(
  options: {
    mode?: CourseMode;
    page?: number;
    limit?: number;
    courseType?: CourseTypeFilter;
    bookmarkedOnly?: boolean;
    enrolledOnly?: boolean;
    purchaseMode?: "FREE" | "PAID";
    completedOnly?: boolean;
  },
  tenantHost: string
): Promise<CourseListResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options.mode) params.set("mode", options.mode);
  if (options.courseType) params.set("course_type", options.courseType);
  if (options.page != null) params.set("page", String(options.page));
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.bookmarkedOnly) params.set("bookmarked_only", "true");
  if (options.enrolledOnly) params.set("enrolled_only", "true");
  if (options.purchaseMode) params.set("purchase_mode", options.purchaseMode);
  if (options.completedOnly) params.set("completed_only", "true");
  const url = `${base}/courses${params.toString() ? `?${params.toString()}` : ""}`;

  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("authToken") || localStorage.getItem("auth_token")
      : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, {
    headers,
    next: token ? undefined : { revalidate: 60 },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Course list failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    success?: boolean;
    data?: {
      courses?: Array<
        Record<string, unknown> & {
          thumbnailUrl?: string | null;
          thumbnail_key?: string | null;
          is_bookmarked?: boolean;
        }
      >;
      pagination?: { page: number; limit: number; total: number; hasMore?: boolean };
    };
  };
  if (!json.success || !json.data) {
    throw new Error("Invalid course list response");
  }

  const data = json.data;
  const rawCourses = data.courses ?? [];
  const pag = data.pagination;

  // Normalize: learner-api returns thumbnailUrl (S3 key or full URL); accept camelCase and snake_case
  const normalized: CourseListItem[] = (rawCourses as unknown[]).map((raw) => {
    const c = raw as CourseListItem & {
      thumbnailUrl?: string | null;
      thumbnail_url?: string | null;
      secondaryThumbnailUrl?: string | null;
      is_bookmarked?: boolean;
      progress_percent?: number;
      completed_lectures?: number;
      total_lectures?: number;
    };
    const thumb =
      c.thumbnail_key ??
      c.thumbnailUrl ??
      c.thumbnail_url ??
      null;
    const secondaryThumb =
      c.secondary_thumbnail_key ??
      c.secondaryThumbnailUrl ??
      null;
    return {
      ...c,
      thumbnail_key: thumb,
      secondary_thumbnail_key: secondaryThumb,
      is_bookmarked: c.is_bookmarked ?? false,
      progress_percent: c.progress_percent,
      completed_lectures: c.completed_lectures,
      total_lectures: c.total_lectures,
    } as CourseListItem;
  });

  return {
    courses: normalized,
    total: pag?.total ?? normalized.length,
    page: pag?.page ?? 1,
    limit: pag?.limit ?? options.limit ?? 24,
  };
}
