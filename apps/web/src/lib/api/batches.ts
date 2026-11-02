/**
 * API client for fetching published batches and learner-side batch views.
 * Mirrors `bundles.ts` patterns: SSR via `fetch` + `X-Tenant-Host`; CSR via `apiGet`.
 */

import { apiGet } from "./api-client";

export function getBatchesApiBaseUrl(): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1`;
}

export interface PublishedBatchListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  webThumbnailUrl: string | null;
  mobileThumbnailUrl: string | null;
  startDate: string;
  endDate: string | null;
  enrollmentOpenDate: string | null;
  enrollmentCloseDate: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  itemCount: number;
  totalEnrollments: number;
  sortOrder: number;
  createdAt: string;
}

export interface PublishedBatchItem {
  id: string;
  itemType: "COURSE" | "BOOK";
  courseId: string | null;
  bookId: string | null;
  sortOrder: number;
  courseTitle: string | null;
  courseSlug: string | null;
  courseSubtitle: string | null;
  courseThumbnailKey: string | null;
  courseMode: string | null;
  courseType: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
  bookPages: number | null;
  bookThumbnailUrl: string | null;
}

export interface PublishedBatchDetail extends PublishedBatchListItem {
  previewUrl: string | null;
  durationDays: number | null;
  validityDays: number | null;
  learningOutcomes: string[];
  updatedAt: string;
  items: PublishedBatchItem[];
  hasAccess?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PublishedBatchesResponse {
  batches: PublishedBatchListItem[];
  pagination: PaginationMeta;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function ssrGet<T>(path: string, host?: string): Promise<T> {
  const headers: Record<string, string> = { "X-Tenant-Host": host || "" };
  const response = await fetch(`${getBatchesApiBaseUrl()}${path}`, { headers });
  if (response.status === 404) throw new Error("Not found");
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const json: ApiResponse<T> = await response.json();
  if (!json.success || !json.data) throw new Error("Invalid response");
  return json.data;
}

export async function fetchPublishedBatches(
  params: { page?: number; limit?: number } = {},
  host?: string
): Promise<PublishedBatchesResponse> {
  const { page = 1, limit = 12 } = params;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const path = `/batches?${qs.toString()}`;
  if (typeof window !== "undefined") {
    return apiGet<PublishedBatchesResponse>(path);
  }
  return ssrGet<PublishedBatchesResponse>(path, host);
}

export async function fetchBatchBySlug(
  slug: string,
  host?: string
): Promise<PublishedBatchDetail> {
  const path = `/batches/${encodeURIComponent(slug)}`;
  if (typeof window !== "undefined") {
    return apiGet<PublishedBatchDetail>(path);
  }
  return ssrGet<PublishedBatchDetail>(path, host);
}

export interface MyBatchListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  enrollmentStatus: string;
  joinedAt: string;
  validTill: string | null;
}

/**
 * Authenticated-only, returns the batches the current member is actively
 * enrolled in. Used by listing pages to swap the "Buy Now" CTA for a
 * "Go to Dashboard" CTA on cards the user already owns.
 */
export async function fetchMyBatches(): Promise<MyBatchListItem[]> {
  return apiGet<MyBatchListItem[]>("/me/batches");
}

// Enrolled-only views (CSR-only)

export interface BatchDashboardData {
  batch: PublishedBatchDetail;
  countdown: {
    startsAt: string;
    secondsUntilStart: number;
    inProgress: boolean;
    ended: boolean;
  };
  progress: {
    lessonsCompleted: number;
    totalLessons: number;
    lessonCompletionPct: number;
    overallCompletionPct: number;
  };
}

export interface LeaderboardEntry {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  lessonsCompleted: number;
  totalLessons: number;
  score: number;
  rank: number;
}

export interface BatchLeaderboard {
  batchId: string;
  snapshot: {
    topN: LeaderboardEntry[];
    totalParticipants: number;
    computedAt: string;
  };
  /** Caller's row, populated only when authenticated AND enrolled. */
  me: LeaderboardEntry | null;
}

export async function fetchBatchDashboard(slug: string): Promise<BatchDashboardData> {
  return apiGet<BatchDashboardData>(
    `/batches/${encodeURIComponent(slug)}/dashboard`
  );
}

export async function fetchBatchContent(
  slug: string
): Promise<{ batchId: string; items: PublishedBatchItem[] }> {
  return apiGet<{ batchId: string; items: PublishedBatchItem[] }>(
    `/batches/${encodeURIComponent(slug)}/content`
  );
}

export async function fetchBatchLeaderboard(slug: string): Promise<BatchLeaderboard> {
  return apiGet<BatchLeaderboard>(
    `/batches/${encodeURIComponent(slug)}/leaderboard`
  );
}

