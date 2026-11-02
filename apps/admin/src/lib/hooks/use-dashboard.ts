import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "../api/dashboard";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  data: (tenantId: string) => [...dashboardKeys.all, tenantId] as const,
  courseStats: (tenantId: string) =>
    [...dashboardKeys.all, "course-stats", tenantId] as const,
  bookStats: (tenantId: string) =>
    [...dashboardKeys.all, "book-stats", tenantId] as const,
  enrollmentBreakdown: (tenantId: string, search?: string) =>
    [...dashboardKeys.all, "enrollment-breakdown", tenantId, search ?? ""] as const,
  bookAccessBreakdown: (tenantId: string, search?: string) =>
    [...dashboardKeys.all, "book-access-breakdown", tenantId, search ?? ""] as const,
  userStats: (tenantId: string, page?: number, search?: string) =>
    [...dashboardKeys.all, "user-stats", tenantId, page, search ?? ""] as const,
  posthogInsights: (tenantId: string) =>
    [...dashboardKeys.all, "posthog-insights", tenantId] as const,
  posthogCourseAnalytics: (tenantId: string, slug: string) =>
    [...dashboardKeys.all, "posthog-course", tenantId, slug] as const,
  posthogBookAnalytics: (tenantId: string, slug: string) =>
    [...dashboardKeys.all, "posthog-book", tenantId, slug] as const,
  posthogUserAnalytics: (tenantId: string, userId: string) =>
    [...dashboardKeys.all, "posthog-user", tenantId, userId] as const,
  posthogPageHeatmap: (tenantId: string, pageUrl: string) =>
    [...dashboardKeys.all, "posthog-page-heatmap", tenantId, pageUrl] as const,
};

export function useDashboard(tenantId: string | undefined) {
  return useQuery({
    queryKey: dashboardKeys.data(tenantId ?? ""),
    queryFn: () => dashboardApi.getDashboardData(),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useCourseStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: dashboardKeys.courseStats(tenantId ?? ""),
    queryFn: () => dashboardApi.getCourseStats(),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useBookStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: dashboardKeys.bookStats(tenantId ?? ""),
    queryFn: () => dashboardApi.getBookStats(),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useEnrollmentBreakdown(
  tenantId: string | undefined,
  limit = 20,
  search?: string
) {
  return useQuery({
    queryKey: [...dashboardKeys.enrollmentBreakdown(tenantId ?? "", search), limit],
    queryFn: () => dashboardApi.getEnrollmentBreakdown(limit, search),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useBookAccessBreakdown(
  tenantId: string | undefined,
  limit = 20,
  search?: string
) {
  return useQuery({
    queryKey: [...dashboardKeys.bookAccessBreakdown(tenantId ?? "", search), limit],
    queryFn: () => dashboardApi.getBookAccessBreakdown(limit, search),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useUserStats(
  tenantId: string | undefined,
  page = 1,
  limit = 20,
  search?: string
) {
  return useQuery({
    queryKey: dashboardKeys.userStats(tenantId ?? "", page, search),
    queryFn: () => dashboardApi.getUserStats(page, limit, search),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function usePostHogInsights(tenantId: string | undefined, tenantSlug?: string) {
  return useQuery({
    queryKey: dashboardKeys.posthogInsights(tenantId ?? ""),
    queryFn: () => dashboardApi.getPostHogInsights(tenantSlug),
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  });
}

export function useCourseAnalytics(tenantId: string | undefined, slug: string | undefined, tenantSlug?: string) {
  return useQuery({
    queryKey: dashboardKeys.posthogCourseAnalytics(tenantId ?? "", slug ?? ""),
    queryFn: () => dashboardApi.getPostHogCourseAnalytics(slug!, tenantSlug),
    enabled: !!tenantId && !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useBookAnalytics(tenantId: string | undefined, slug: string | undefined, tenantSlug?: string) {
  return useQuery({
    queryKey: dashboardKeys.posthogBookAnalytics(tenantId ?? "", slug ?? ""),
    queryFn: () => dashboardApi.getPostHogBookAnalytics(slug!, tenantSlug),
    enabled: !!tenantId && !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useUserAnalytics(tenantId: string | undefined, userId: string | undefined, tenantSlug?: string) {
  return useQuery({
    queryKey: dashboardKeys.posthogUserAnalytics(tenantId ?? "", userId ?? ""),
    queryFn: () => dashboardApi.getPostHogUserAnalytics(userId!, tenantSlug),
    enabled: !!tenantId && !!userId,
    staleTime: 5 * 60_000,
  });
}

export function usePageHeatmap(tenantId: string | undefined, pageUrl: string | undefined, tenantSlug?: string) {
  return useQuery({
    queryKey: dashboardKeys.posthogPageHeatmap(tenantId ?? "", pageUrl ?? ""),
    queryFn: () => dashboardApi.getPostHogPageHeatmap(pageUrl!, tenantSlug),
    enabled: !!tenantId && !!pageUrl,
    staleTime: 5 * 60_000,
  });
}
