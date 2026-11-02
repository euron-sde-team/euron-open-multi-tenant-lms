import type { ApiResponse } from "../types/auth";
import type { DashboardData } from "../types/dashboard";

import { apiClient } from "./axios";

export async function getDashboardData(): Promise<DashboardData> {
  const response = await apiClient.get<ApiResponse<DashboardData>>(
    "/tenant/dashboard"
  );
  return response.data.data;
}

export interface CourseStatsByMode {
  self_paced: number;
}

export interface BookStatsWithAccess {
  total: number;
  published: number;
  draft: number;
  total_access: number;
}

export interface EnrollmentBreakdownItem {
  course_id: string;
  course_title: string;
  course_slug: string;
  mode: string;
  enrollment_count: number;
}

export interface BookAccessBreakdownItem {
  book_id: string;
  book_title: string;
  book_slug: string;
  access_count: number;
}

export interface UserStatsItem {
  id: string;
  name: string;
  email: string | null;
  enrollments_count: number;
  book_access_count: number;
  completed_enrollments: number;
  joined_at: string;
}

export interface UserStatsResponse {
  members: UserStatsItem[];
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Shared PostHog types                                               */
/* ------------------------------------------------------------------ */

export interface LocationItem { country: string; city: string; count: number }
export interface DeviceItem { name: string; count: number }
export interface ReferrerItem { domain: string; count: number }
export interface CustomEventItem { event: string; count: number }

export interface ClickedElement {
  tag: string;
  text: string;
  click_count: number;
  /** Normalized X (0–1) from PostHog when available */
  x?: number;
  /** Normalized Y (0–1) from PostHog when available */
  y?: number;
}

export interface PageHeatmapItem {
  page_url: string;
  total_clicks: number;
  unique_clickers: number;
  avg_scroll_depth: number;
  top_clicked_elements: ClickedElement[];
}

export interface UserSessionItem {
  session_id: string;
  distinct_id: string;
  start_time: string;
  duration_seconds: number;
  page_count: number;
  entry_url: string;
  exit_url: string;
  country: string;
  city: string;
  browser: string;
  os: string;
  device_type: string;
}

/* ------------------------------------------------------------------ */
/*  Global insights                                                    */
/* ------------------------------------------------------------------ */

export interface PostHogInsights {
  page_views: number;
  unique_visitors: number;
  session_count: number;
  avg_session_duration_seconds: number;
  top_pages: Array<{ url: string; count: number }>;
  locations: LocationItem[];
  browsers: DeviceItem[];
  operating_systems: DeviceItem[];
  device_types: DeviceItem[];
  referrers: ReferrerItem[];
  custom_events: CustomEventItem[];
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
  new_visitors: number;
  returning_visitors: number;
  bounce_rate: number;
  page_heatmaps: PageHeatmapItem[];
  user_sessions: UserSessionItem[];
}

/* ------------------------------------------------------------------ */
/*  Per-entity analytics types                                         */
/* ------------------------------------------------------------------ */

export interface EntityAnalytics {
  page_views: number;
  unique_visitors: number;
  session_count: number;
  avg_session_duration_seconds: number;
  total_clicks: number;
  locations: LocationItem[];
  browsers: DeviceItem[];
  operating_systems: DeviceItem[];
  device_types: DeviceItem[];
  referrers: ReferrerItem[];
  daily_views: Array<{ date: string; count: number }>;
  sessions: UserSessionItem[];
}

export interface CourseAnalytics extends EntityAnalytics {
  course_viewed_count: number;
  enrollment_initiated_count: number;
  add_to_cart_count: number;
  payment_initiated_count: number;
  payment_completed_count: number;
}

export interface BookAnalytics extends EntityAnalytics {
  book_viewed_count: number;
  book_purchase_count: number;
  add_to_cart_count: number;
}

export interface UserAnalytics {
  total_events: number;
  total_sessions: number;
  total_pageviews: number;
  avg_session_duration_seconds: number;
  first_seen: string;
  last_seen: string;
  locations: LocationItem[];
  browsers: DeviceItem[];
  operating_systems: DeviceItem[];
  device_types: DeviceItem[];
  top_pages: Array<{ url: string; count: number }>;
  events_breakdown: CustomEventItem[];
  sessions: UserSessionItem[];
  courses_viewed: Array<{ course_id: string; count: number }>;
  books_viewed: Array<{ book_id: string; count: number }>;
}

/* ------------------------------------------------------------------ */
/*  API functions                                                      */
/* ------------------------------------------------------------------ */

export async function getCourseStats(): Promise<CourseStatsByMode> {
  const response = await apiClient.get<ApiResponse<CourseStatsByMode>>(
    "/tenant/dashboard/courses-stats"
  );
  return response.data.data;
}

export async function getBookStats(): Promise<BookStatsWithAccess> {
  const response = await apiClient.get<ApiResponse<BookStatsWithAccess>>(
    "/tenant/dashboard/books-stats"
  );
  return response.data.data;
}

export async function getEnrollmentBreakdown(
  limit?: number,
  search?: string
): Promise<EnrollmentBreakdownItem[]> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (search?.trim()) params.set("search", search.trim());
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await apiClient.get<
    ApiResponse<EnrollmentBreakdownItem[]>
  >(`/tenant/dashboard/enrollment-breakdown${query}`);
  return response.data.data;
}

export async function getBookAccessBreakdown(
  limit?: number,
  search?: string
): Promise<BookAccessBreakdownItem[]> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (search?.trim()) params.set("search", search.trim());
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await apiClient.get<
    ApiResponse<BookAccessBreakdownItem[]>
  >(`/tenant/dashboard/book-access-breakdown${query}`);
  return response.data.data;
}

export async function getUserStats(
  page?: number,
  limit?: number,
  search?: string
): Promise<UserStatsResponse> {
  const searchParams = new URLSearchParams();
  if (page) searchParams.set("page", String(page));
  if (limit) searchParams.set("limit", String(limit));
  if (search?.trim()) searchParams.set("search", search.trim());
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const response = await apiClient.get<ApiResponse<UserStatsResponse>>(
    `/tenant/dashboard/users-stats${query}`
  );
  return response.data.data;
}

export async function getPostHogInsights(tenantSlug?: string): Promise<PostHogInsights> {
  const params = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";
  const response = await apiClient.get<ApiResponse<PostHogInsights>>(
    `/tenant/dashboard/posthog-insights${params}`
  );
  return response.data.data;
}

export async function getPostHogCourseAnalytics(slug: string, tenantSlug?: string): Promise<CourseAnalytics> {
  const params = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";
  const response = await apiClient.get<ApiResponse<CourseAnalytics>>(
    `/tenant/dashboard/posthog-insights/course/${slug}${params}`
  );
  return response.data.data;
}

export async function getPostHogBookAnalytics(slug: string, tenantSlug?: string): Promise<BookAnalytics> {
  const params = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";
  const response = await apiClient.get<ApiResponse<BookAnalytics>>(
    `/tenant/dashboard/posthog-insights/book/${slug}${params}`
  );
  return response.data.data;
}

export async function getPostHogUserAnalytics(userId: string, tenantSlug?: string): Promise<UserAnalytics> {
  const params = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";
  const response = await apiClient.get<ApiResponse<UserAnalytics>>(
    `/tenant/dashboard/posthog-insights/user/${userId}${params}`
  );
  return response.data.data;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  count: number;
}

export interface PageHeatmapDetail {
  page_url: string;
  total_clicks: number;
  unique_clickers: number;
  total_pageviews: number;
  unique_viewers: number;
  avg_time_on_page_seconds: number;
  top_clicked_elements: ClickedElement[];
  /** Coordinate-based heatmap points (0-1 normalized) from PostHog when available */
  heatmap_points: HeatmapPoint[];
  click_by_device: DeviceItem[];
  click_by_browser: DeviceItem[];
  click_timeline: Array<{ hour: string; count: number }>;
  sessions_on_page: UserSessionItem[];
}

export async function getPostHogPageHeatmap(pageUrl: string, tenantSlug?: string): Promise<PageHeatmapDetail> {
  const searchParams = new URLSearchParams();
  searchParams.set("pageUrl", pageUrl);
  if (tenantSlug) searchParams.set("tenantSlug", tenantSlug);
  const response = await apiClient.get<ApiResponse<PageHeatmapDetail>>(
    `/tenant/dashboard/posthog-insights/page-heatmap?${searchParams.toString()}`
  );
  return response.data.data;
}

export async function getPostHogReplayEmbedToken(
  sessionId: string,
  tenantSlug?: string
): Promise<{ embedUrl: string } | null> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("sessionId", sessionId);
    if (tenantSlug) searchParams.set("tenantSlug", tenantSlug);
    const response = await apiClient.get<ApiResponse<{ embedUrl: string }>>(
      `/tenant/dashboard/posthog-insights/replay-embed-token?${searchParams.toString()}`
    );
    return response.data?.data ?? null;
  } catch {
    return null;
  }
}

export const dashboardApi = {
  getDashboardData,
  getCourseStats,
  getBookStats,
  getEnrollmentBreakdown,
  getBookAccessBreakdown,
  getUserStats,
  getPostHogInsights,
  getPostHogCourseAnalytics,
  getPostHogBookAnalytics,
  getPostHogUserAnalytics,
  getPostHogPageHeatmap,
  getPostHogReplayEmbedToken,
};
