import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { useTenantStore } from "@/lib/stores/tenant-store";

import { analyticsApi, type LearnerFilters, type PaymentFilters, type UsersProgressSortBy } from "../api/analytics";
import { assignmentsApi } from "../api/assignments";
import { quizzesApi } from "../api/quizzes";

const keys = {
  base: ["bi-analytics"] as const,
  overview: (tid: string, s: string, e: string, rk: number) => [...keys.base, "overview", tid, s, e, rk] as const,
  recentSignups: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "recent-signups", tid, s, e, p, search, rk] as const,
  recentOrders: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "recent-orders", tid, s, e, p, search, rk] as const,
  users: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "users", tid, s, e, p, search, rk] as const,
  recentPayments: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "recent-payments", tid, s, e, p, search, rk] as const,
  usersProgress: (tid: string, p: number, search: string, sortBy: string, sortOrder: string, rk: number, courseId: string) =>
    [...keys.base, "users-progress", tid, p, search, sortBy, sortOrder, rk, courseId] as const,
  userCourseProgress: (tid: string, userId: string, rk: number) =>
    [...keys.base, "user-course-progress", tid, userId, rk] as const,
  userDetail: (tid: string, userId: string, tenantSlug: string, s: string, e: string, rk: number) => [...keys.base, "user-detail", tid, userId, tenantSlug, s, e, rk] as const,
  courses: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "courses", tid, s, e, p, search, rk] as const,
  courseDetail: (tid: string, courseId: string, s: string, e: string, rk: number) => [...keys.base, "course-detail", tid, courseId, s, e, rk] as const,
  books: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "books", tid, s, e, p, search, rk] as const,
  bookDetail: (tid: string, bookId: string, s: string, e: string, rk: number) => [...keys.base, "book-detail", tid, bookId, s, e, rk] as const,
  bundles: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "bundles", tid, s, e, p, search, rk] as const,
  payments: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "payments", tid, s, e, p, search, rk] as const,
  certificates: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "certificates", tid, s, e, p, search, rk] as const,
  certificateDetails: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "certificate-details", tid, s, e, p, search, rk] as const,
  coupons: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "coupons", tid, s, e, p, search, rk] as const,
  quizzes: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "quizzes", tid, s, e, p, search, rk] as const,
  quizDetail: (tid: string, quizId: string, page: number, search: string, rk: number) =>
    [...keys.base, "quiz-detail", tid, quizId, page, search, rk] as const,
  engagement: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "engagement", tid, s, e, p, search, rk] as const,
  bookReading: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "book-reading", tid, s, e, p, search, rk] as const,
  cart: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "cart", tid, s, e, p, search, rk] as const,
  bookmarks: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "bookmarks", tid, s, e, p, search, rk] as const,
  bookmarkDetails: (tid: string, s: string, e: string, p: number, search: string, rk: number) => [...keys.base, "bookmark-details", tid, s, e, p, search, rk] as const,
  assignmentsOverview: (tid: string, page: number, search: string, rk: number) =>
    [...keys.base, "assignments-overview", tid, page, search, rk] as const,
  courseAssignments: (tid: string, courseId: string, rk: number) => [...keys.base, "course-assignments", tid, courseId, rk] as const,
  courseQuizzes: (tid: string, courseId: string, rk: number) => [...keys.base, "course-quizzes", tid, courseId, rk] as const,
  courseWatchTime: (tid: string, courseId: string, s: string, e: string, rk: number) =>
    [...keys.base, "course-watch-time", tid, courseId, s, e, rk] as const,
  memberWatchTime: (tid: string, userId: string, s: string, e: string, rk: number) =>
    [...keys.base, "member-watch-time", tid, userId, s, e, rk] as const,
  watchTimeOverview: (tid: string, s: string, e: string, rk: number) =>
    [...keys.base, "watch-time-overview", tid, s, e, rk] as const,
};

function useTid() {
  return useTenantStore((s) => s.selectedTenantId) ?? "";
}

function useTenantSlug() {
  return useTenantStore((s) => s.selectedTenant?.tenant_slug) ?? "";
}

export function useAnalyticsOverview() {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.overview(tid, startDate, endDate, refreshKey),
    queryFn: () => analyticsApi.getOverview(startDate, endDate),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useOverviewRecentSignups(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.recentSignups(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getRecentSignups(startDate, endDate, page, 10, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useOverviewRecentOrders(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.recentOrders(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getRecentOrders(startDate, endDate, page, 10, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useAnalyticsUsers(page = 1, search = "", filters?: LearnerFilters) {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: [...keys.users(tid, startDate, endDate, page, search, refreshKey), filters ?? null],
    queryFn: () => analyticsApi.getUsers(startDate, endDate, page, 50, search || undefined, filters),
    enabled: !!tid,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Master cohort table, one row per member with course/quiz/assignment progress.
 * All-time (no date filter): reflects lifetime progress.
 */
export function useAnalyticsUsersProgress(
  page = 1,
  search = "",
  sortBy: UsersProgressSortBy = "overall_progress_pct",
  sortOrder: "asc" | "desc" = "desc",
  limit = 20,
  courseId = "",
) {
  const tid = useTid();
  const { refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.usersProgress(tid, page, search, sortBy, sortOrder, refreshKey, courseId),
    queryFn: () => analyticsApi.getUsersProgress(page, limit, search || undefined, sortBy, sortOrder, courseId || undefined),
    enabled: !!tid,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Per-course progress breakdown for one member, fetched lazily on row expand. */
export function useMemberCourseProgress(userId: string | null, enabled = true) {
  const tid = useTid();
  const { refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.userCourseProgress(tid, userId ?? "", refreshKey),
    queryFn: () => analyticsApi.getUserCourseProgress(userId!),
    enabled: !!tid && !!userId && enabled,
    staleTime: 60_000,
  });
}

export function useUserDetailAnalytics(userId: string | null) {
  const tid = useTid();
  const tenantSlug = useTenantSlug();
  const { refreshKey } = useAnalyticsDateRange();
  // User detail uses all-time data (no date filter): PostHog is date-independent, DB tables show full history
  return useQuery({
    queryKey: keys.userDetail(tid, userId ?? "", tenantSlug ?? "", "", "", refreshKey),
    queryFn: () => analyticsApi.getUserDetail(userId!, undefined, undefined, tenantSlug || undefined),
    enabled: !!tid && !!userId,
    staleTime: 60_000,
  });
}

export function useAnalyticsCourses(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.courses(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getCourses(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useCourseDetailAnalytics(courseId: string | null) {
  const tid = useTid();
  const tenantSlug = useTenantSlug();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.courseDetail(tid, courseId ?? "", startDate, endDate, refreshKey),
    queryFn: () => analyticsApi.getCourseDetail(courseId!, startDate, endDate, tenantSlug || undefined),
    enabled: !!tid && !!courseId,
    staleTime: 60_000,
  });
}

export function useAssignmentAnalyticsOverview(page = 1, search = "") {
  const tid = useTid();
  const { refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.assignmentsOverview(tid, page, search, refreshKey),
    queryFn: () =>
      assignmentsApi.getAssignmentAnalyticsOverview({
        page,
        limit: 20,
        search: search || undefined,
      }),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useCourseAssignmentAnalytics(courseId: string | null) {
  const tid = useTid();
  const { refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.courseAssignments(tid, courseId ?? "", refreshKey),
    queryFn: () => assignmentsApi.getCourseAssignmentAnalytics(courseId!),
    enabled: !!tid && !!courseId,
    staleTime: 60_000,
  });
}

export function useCourseQuizAnalytics(courseId: string | null) {
  const tid = useTid();
  const { refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.courseQuizzes(tid, courseId ?? "", refreshKey),
    queryFn: () => quizzesApi.getCourseQuizAnalytics(courseId!),
    enabled: !!tid && !!courseId,
    staleTime: 60_000,
  });
}

export function useAnalyticsBooks(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.books(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getBooks(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useBookDetailAnalytics(bookId: string | null) {
  const tid = useTid();
  const tenantSlug = useTenantSlug();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.bookDetail(tid, bookId ?? "", startDate, endDate, refreshKey),
    queryFn: () => analyticsApi.getBookDetail(bookId!, startDate, endDate, tenantSlug || undefined),
    enabled: !!tid && !!bookId,
    staleTime: 60_000,
  });
}

export function useAnalyticsBundles(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.bundles(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getBundles(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useAnalyticsPayments(page = 1, search = "", filters?: PaymentFilters) {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: [...keys.payments(tid, startDate, endDate, page, search, refreshKey), filters ?? null],
    queryFn: () => analyticsApi.getPayments(startDate, endDate, page, 20, search || undefined, filters),
    enabled: !!tid,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Successful purchases, one row per purchased item, for the table on the Users
 * Analytics page. Gated server-side on `analytics.revenue`; callers should hide
 * the card for users without it rather than render a 403.
 */
export function useAnalyticsRecentPayments(page = 1, search = "", enabled = true) {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.recentPayments(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getRecentSuccessfulPayments(startDate, endDate, page, 10, search || undefined),
    enabled: !!tid && enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useAnalyticsCertificates(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.certificates(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getCertificates(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useAnalyticsCertificateDetails(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.certificateDetails(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getCertificateDetails(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}


export function useAnalyticsCoupons(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.coupons(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getCoupons(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useAnalyticsQuizzes(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.quizzes(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getQuizzes(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useQuizDetailAnalytics(
  quizId: string | null,
  studentPage = 1,
  studentSearch = ""
) {
  const tid = useTid();
  const { refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.quizDetail(tid, quizId ?? "", studentPage, studentSearch, refreshKey),
    queryFn: () =>
      quizzesApi.getAnalytics(quizId!, {
        includeStudentResults: true,
        studentPage,
        studentLimit: 20,
        studentSearch: studentSearch || undefined,
      }),
    enabled: !!tid && !!quizId,
    staleTime: 60_000,
  });
}



export function useAnalyticsEngagement(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.engagement(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getEngagement(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useAnalyticsBookReading(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.bookReading(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getBookReading(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useAnalyticsCart(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.cart(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getCart(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useAnalyticsBookmarks(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.bookmarks(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getBookmarks(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useAnalyticsBookmarkDetails(page = 1, search = "") {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.bookmarkDetails(tid, startDate, endDate, page, search, refreshKey),
    queryFn: () => analyticsApi.getBookmarkDetails(startDate, endDate, page, 20, search || undefined),
    enabled: !!tid,
    staleTime: 60_000,
  });
}



/** Per-course watch-time drilldown (per-lecture, drop-off, top viewers). */
export function useCourseWatchTime(courseId: string | null) {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.courseWatchTime(tid, courseId ?? "", startDate, endDate, refreshKey),
    queryFn: () => analyticsApi.getCourseWatchTime(courseId!, startDate, endDate),
    enabled: !!tid && !!courseId,
    staleTime: 60_000,
  });
}

/** Per-user watch-time drilldown (per-course breakdown + recent sessions). */
export function useMemberWatchTime(userId: string | null) {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.memberWatchTime(tid, userId ?? "", startDate, endDate, refreshKey),
    queryFn: () => analyticsApi.getMemberWatchTime(userId!, startDate, endDate),
    enabled: !!tid && !!userId,
    staleTime: 60_000,
  });
}

/** Tenant-wide watch-time overview (top courses, top viewers, daily trend). */
export function useWatchTimeOverview() {
  const tid = useTid();
  const { dateRange: { startDate, endDate }, refreshKey } = useAnalyticsDateRange();
  return useQuery({
    queryKey: keys.watchTimeOverview(tid, startDate, endDate, refreshKey),
    queryFn: () => analyticsApi.getWatchTimeOverview(startDate, endDate),
    enabled: !!tid,
    staleTime: 60_000,
  });
}
