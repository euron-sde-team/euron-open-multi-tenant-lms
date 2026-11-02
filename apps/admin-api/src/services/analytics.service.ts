import analyticsRepository, { type UserAnalyticsFilters, type PaymentAnalyticsFilters, type UsersProgressOptions } from "../repositories/analytics.repository";
import analyticsCacheService from "./analytics-cache.service";
import watchTimeAnalyticsRepository from "../repositories/watch-time-analytics.repository";
import { getCourseAnalytics, getBookAnalytics, getUserAnalytics } from "../services/posthog-analytics.service";
import logger from "../utils/logger";

// TTL constants (L1 in ms, L2 in seconds)
const OVERVIEW_L1 = 30_000;
const OVERVIEW_L2 = 120;
const LIST_L1 = 15_000;
const LIST_L2 = 60;
const DETAIL_L1 = 15_000;
const DETAIL_L2 = 60;
const PAYMENTS_L1 = 10_000;
const PAYMENTS_L2 = 45;
const GENERIC_L1 = 15_000;
const GENERIC_L2 = 90;

// Negative-cache TTL for the watch-time endpoints. Triggered when the
// lecture-watch-tracking migration hasn't been applied yet, we want to
// recover within ~1 minute of the migration landing, but not pound RDS with
// failing queries every page load until then.
const WATCH_TIME_PENDING_L1 = 60_000;
const WATCH_TIME_PENDING_L2 = 60;

/**
 * Postgres SQLSTATE 42P01 = `undefined_table`. Fired when a query references
 * a table that doesn't exist, the canonical signal that a migration hasn't
 * been applied to this database yet. Distinct from runtime data shape errors,
 * permission errors, or connection errors, all of which should still surface
 * as 500s so they get surfaced/retried instead of silently masked.
 */
const isMissingTableError = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code?: unknown }).code === "42P01";

/** Kysely BIGINT / raw `::int` counts arrive as strings, parse safely to a number. */
const toInt = (val: unknown): number => {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "string") {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** Parse a raw pct (string|number|null) and clamp to 0–100. */
const clampPct = (val: unknown): number => {
  const n = toInt(val);
  return Math.max(0, Math.min(100, n));
};

/**
 * One normalized row of the master cohort table, a single member's rolled-up
 * performance across all their enrolled courses. Consumed by the admin User
 * Progress page; clicking a row drills into the full member-detail analytics.
 */
export interface MasterUserProgressRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  joinedAt: string | null;
  coursesEnrolled: number;
  coursesCompleted: number;
  totalLectures: number;
  completedLectures: number;
  /** 0–100, lecture-completion based (matches the member-detail drill-down). */
  overallProgressPct: number;
  totalWatchSeconds: number;
  /** Average best-% across taken PUBLISHED quizzes, or null if none taken. */
  quizAvg: number | null;
  quizzesTaken: number;
  assignmentsTotal: number;
  assignmentsSubmitted: number;
  /** submitted/total PUBLISHED assignments, or null if the member has none. */
  assignmentPct: number | null;
  lastActive: string | null;
}

/** One enrolled course's progress for a member, the cohort-table expand payload. */
export interface MemberCourseProgressRow {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  enrollmentStatus: string;
  enrolledAt: string | null;
  totalLectures: number;
  completedLectures: number;
  progressPct: number;
  totalWatchSeconds: number;
  lastActive: string | null;
  quizzesTotal: number;
  quizzesTaken: number;
  quizAvg: number | null;
  assignmentsTotal: number;
  assignmentsSubmitted: number;
}

/** One enrolled learner's progress in a SINGLE course (course-scoped metrics). */
export interface CourseLearnerProgressRow {
  memberId: string;
  name: string;
  email: string | null;
  status: string;
  enrollmentStatus: string;
  enrolledAt: string | null;
  totalLectures: number;
  completedLectures: number;
  progressPct: number;
  totalWatchSeconds: number;
  lastActive: string | null;
  quizzesTotal: number;
  quizzesTaken: number;
  quizAvg: number | null;
  assignmentsTotal: number;
  assignmentsSubmitted: number;
}

// Empty-shape responses returned when the watch-tracking schema isn't present.
// Each one matches the shape of its corresponding repository return so the
// frontend renders the existing "no data yet" empty states rather than crashing.
const EMPTY_WATCH_TIME_OVERVIEW = {
  summary: {
    total_seconds: 0,
    total_hours: 0,
    sessions_count: 0,
    lectures_touched: 0,
    active_learners: 0,
    avg_seconds_per_learner: 0,
    avg_hours_per_learner: 0,
    avg_completion_pct: 0,
  },
  dailyWatchHours: [] as Array<{ date: string; seconds: number; hours: number; sessions: number }>,
  topCourses: [] as Array<{
    course_id: string; title: string | null;
    total_seconds: number; total_hours: number;
    sessions_count: number; lectures_touched: number;
    avg_completion_pct: number;
  }>,
  topViewers: [] as Array<{
    member_id: string; member_name: string | null; member_email: string | null;
    total_seconds: number; total_hours: number;
    courses_touched: number; lectures_touched: number;
    last_active_at: string;
  }>,
  topLectures: [] as Array<{
    lecture_id: string; title: string | null; duration_seconds: number;
    course_id: string; course_title: string | null;
    total_seconds: number; total_hours: number;
    sessions_count: number; max_daily_members: number; avg_completion_pct: number;
  }>,
  meta: {
    // Lets the dashboard distinguish "no data yet, feature just shipped"
    // from "feature broken / migration not applied". Filled in by the
    // service layer right before returning.
    hasAnyData: false,
    lastRollupAt: null as string | null,
  },
};

const EMPTY_MEMBER_WATCH_TIME = {
  perCourse: [] as Array<{
    course_id: string; title: string | null;
    total_seconds: number; total_hours: number;
    lectures_watched: number; sessions_count: number; last_active_at: string;
  }>,
  recentSessions: [] as Array<{
    session_id: string;
    lecture_id: string; lecture_title: string | null;
    course_id: string; course_title: string | null;
    started_at: string; last_heartbeat_at: string;
    end_position: number; seconds_watched: number;
  }>,
};

const EMPTY_COURSE_WATCH_TIME = {
  perLecture: [] as Array<{
    lecture_id: string; title: string | null; duration_seconds: number;
    total_seconds: number; total_hours: number;
    sessions_count: number; max_daily_members: number; avg_completion_pct: number;
    dropoff: Array<{ bucket: number; sessions: number }>;
  }>,
  topViewers: [] as Array<{
    member_id: string; member_name: string | null; member_email: string | null;
    total_seconds: number; total_hours: number; lectures_touched: number;
  }>,
  dailyWatchHours: [] as Array<{ date: string; seconds: number }>,
};

class AnalyticsService {
  async getOverview(tenantId: string, startDate?: string, endDate?: string, nocache = false) {
    const key = analyticsCacheService.overviewKey(tenantId, startDate, endDate);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getOverview(tenantId, startDate, endDate);
    analyticsCacheService.set(key, data, OVERVIEW_L1, OVERVIEW_L2).catch(() => {});
    return data;
  }

  async getRecentSignups(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.recentSignupsKey(tenantId, startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getRecentSignups(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, LIST_L1, LIST_L2).catch(() => {});
    return data;
  }

  async getRecentOrders(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.recentOrdersKey(tenantId, startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getRecentOrders(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, LIST_L1, LIST_L2).catch(() => {});
    return data;
  }

  async getUsersAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false, filters?: UserAnalyticsFilters) {
    // Filtered exports are ad-hoc and high-cardinality, skip the cache for them
    // so we never serve a stale/over-broad set (and never poison the base key).
    const hasFilters = !!filters && (
      !!filters.courseIds?.length ||
      !!filters.bundleIds?.length ||
      filters.minAmount != null ||
      filters.maxAmount != null ||
      !!filters.enrollmentStatus?.length ||
      !!filters.signupFrom ||
      !!filters.signupTo
    );
    const key = analyticsCacheService.usersKey(tenantId, startDate, endDate, page, limit, search);
    if (!nocache && !hasFilters) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getUsersAnalytics(tenantId, startDate, endDate, page, limit, search, filters);
    if (!hasFilters) analyticsCacheService.set(key, data, LIST_L1, LIST_L2).catch(() => {});
    return data;
  }

  /**
   * Master cohort table: one normalized row per member with course-wise progress
   * + quiz avg + assignment % + watch time + last active. Raw SQL counts arrive
   * as strings (Kysely bigint / ::int); normalize to numbers here so the frontend
   * gets clean typed rows.
   */
  async getUsersProgressAnalytics(tenantId: string, opts: UsersProgressOptions = {}, nocache = false) {
    const key = analyticsCacheService.usersProgressKey(
      tenantId,
      opts.page,
      opts.limit,
      opts.search,
      opts.sortBy,
      opts.sortOrder,
      opts.courseId
    );
    // Skip the cache for ad-hoc, high-cardinality slices, a search term or a
    // course filter. (The key varies by courseId too, so this is belt-and-braces.)
    const cacheable = !opts.search?.trim() && !opts.courseId?.trim();
    if (!nocache && cacheable) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }

    const { rows, total, page, limit } = await analyticsRepository.getUsersProgressAnalytics(tenantId, opts);

    const users: MasterUserProgressRow[] = rows.map((r) => {
      const enrolled = toInt(r.courses_enrolled);
      const completed = toInt(r.courses_completed);
      const quizzesTaken = toInt(r.quizzes_taken);
      const assignmentsTotal = toInt(r.assignments_total);
      const assignmentsSubmitted = toInt(r.assignments_submitted);
      return {
        id: r.id,
        name: r.name ?? r.email ?? "Unknown",
        email: r.email ?? null,
        phone: r.phone ?? null,
        status: r.status,
        joinedAt: r.joined_at ? new Date(r.joined_at).toISOString() : null,
        coursesEnrolled: enrolled,
        coursesCompleted: completed,
        totalLectures: toInt(r.total_lectures),
        completedLectures: toInt(r.completed_lectures),
        overallProgressPct: clampPct(r.overall_progress_pct),
        totalWatchSeconds: toInt(r.total_watch_seconds),
        quizAvg: r.quiz_avg == null ? null : clampPct(r.quiz_avg),
        quizzesTaken,
        assignmentsTotal,
        assignmentsSubmitted,
        assignmentPct: r.assignment_pct == null ? null : clampPct(r.assignment_pct),
        lastActive: r.last_active ? new Date(r.last_active).toISOString() : null,
      };
    });

    const result = { users, total, page, limit };
    if (cacheable) analyticsCacheService.set(key, result, LIST_L1, LIST_L2).catch(() => {});
    return result;
  }

  /**
   * Per-course progress breakdown for one member, the inline-expand payload for
   * the cohort table. Normalizes raw counts to numbers + clamps pct.
   */
  async getMemberCourseProgressBreakdown(tenantId: string, memberId: string): Promise<MemberCourseProgressRow[]> {
    const rows = await analyticsRepository.getMemberCourseProgressBreakdown(tenantId, memberId);
    return rows.map((r) => ({
      courseId: r.course_id,
      courseTitle: r.course_title,
      courseSlug: r.course_slug,
      enrollmentStatus: r.enrollment_status,
      enrolledAt: r.enrolled_at ? new Date(r.enrolled_at).toISOString() : null,
      totalLectures: toInt(r.total_lectures),
      completedLectures: toInt(r.completed_lectures),
      progressPct: clampPct(r.progress_pct),
      totalWatchSeconds: toInt(r.total_watch_seconds),
      lastActive: r.last_active ? new Date(r.last_active).toISOString() : null,
      quizzesTotal: toInt(r.quizzes_total),
      quizzesTaken: toInt(r.quizzes_taken),
      quizAvg: r.quiz_avg == null ? null : clampPct(r.quiz_avg),
      assignmentsTotal: toInt(r.assignments_total),
      assignmentsSubmitted: toInt(r.assignments_submitted),
    }));
  }

  /**
   * All enrolled learners of one course with their IN-THAT-COURSE progress.
   * the per-course export sheet payload. Metrics are course-scoped (not the
   * learner's all-courses rollup).
   */
  async getCourseLearnerProgress(tenantId: string, courseId: string): Promise<CourseLearnerProgressRow[]> {
    const rows = await analyticsRepository.getCourseLearnerProgress(tenantId, courseId);
    return rows.map((r) => ({
      memberId: r.member_id,
      name: r.name,
      email: r.email,
      status: r.status,
      enrollmentStatus: r.enrollment_status,
      enrolledAt: r.enrolled_at ? new Date(r.enrolled_at).toISOString() : null,
      totalLectures: toInt(r.total_lectures),
      completedLectures: toInt(r.completed_lectures),
      progressPct: clampPct(r.progress_pct),
      totalWatchSeconds: toInt(r.total_watch_seconds),
      lastActive: r.last_active ? new Date(r.last_active).toISOString() : null,
      quizzesTotal: toInt(r.quizzes_total),
      quizzesTaken: toInt(r.quizzes_taken),
      quizAvg: r.quiz_avg == null ? null : clampPct(r.quiz_avg),
      assignmentsTotal: toInt(r.assignments_total),
      assignmentsSubmitted: toInt(r.assignments_submitted),
    }));
  }

  async getUserDetailAnalytics(tenantId: string, memberId: string, startDate?: string, endDate?: string, tenantSlug?: string, nocache = false) {
    const key = analyticsCacheService.userDetailKey(tenantId, memberId, startDate, endDate);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const dbData = await analyticsRepository.getUserDetailAnalytics(tenantId, memberId, startDate, endDate);
    if (!dbData) return null;
    let posthogData = null;
    const POSTHOG_TIMEOUT_MS = 25000;
    try {
      posthogData = await Promise.race([
        getUserAnalytics(tenantId, memberId, { tenantSlug: tenantSlug ?? "", userEmail: dbData.profile.email ?? undefined }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("PostHog timeout")), POSTHOG_TIMEOUT_MS)
        ),
      ]);
    } catch {
      // PostHog may not be configured or timed out; continue with DB data only
    }
    const result = {
      ...dbData,
      posthog: posthogData,
    };
    analyticsCacheService.set(key, result, DETAIL_L1, DETAIL_L2).catch(() => {});
    return result;
  }

  async getCoursesAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.coursesKey(tenantId, startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getCoursesAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, LIST_L1, LIST_L2).catch(() => {});
    return data;
  }

  async getCourseDetailAnalytics(tenantId: string, courseId: string, startDate?: string, endDate?: string, tenantSlug?: string, nocache = false) {
    const key = analyticsCacheService.courseDetailKey(tenantId, courseId, startDate, endDate);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const dbData = await analyticsRepository.getCourseDetailAnalytics(tenantId, courseId, startDate, endDate);
    if (!dbData) return null;
    let posthogData = null;
    try {
      posthogData = await getCourseAnalytics(tenantId, dbData.course.slug, tenantSlug ?? "");
    } catch {
      // PostHog may not be configured; continue with DB data only
    }
    const result = {
      ...dbData,
      posthog: posthogData
        ? {
            page_views: posthogData.page_views,
            unique_visitors: posthogData.unique_visitors,
            session_count: posthogData.session_count,
            avg_session_duration_seconds: posthogData.avg_session_duration_seconds,
            total_clicks: posthogData.total_clicks,
            course_viewed_count: posthogData.course_viewed_count,
            enrollment_initiated_count: posthogData.enrollment_initiated_count,
            add_to_cart_count: posthogData.add_to_cart_count,
            payment_initiated_count: posthogData.payment_initiated_count,
            payment_completed_count: posthogData.payment_completed_count,
            daily_views: posthogData.daily_views ?? [],
            referrers: posthogData.referrers ?? [],
            locations: posthogData.locations ?? [],
            browsers: posthogData.browsers ?? [],
            operating_systems: posthogData.operating_systems ?? [],
            device_types: posthogData.device_types ?? [],
            sessions: posthogData.sessions ?? [],
          }
        : null,
    };
    analyticsCacheService.set(key, result, DETAIL_L1, DETAIL_L2).catch(() => {});
    return result;
  }

  async getBooksAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.booksKey(tenantId, startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getBooksAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, LIST_L1, LIST_L2).catch(() => {});
    return data;
  }

  async getBookDetailAnalytics(tenantId: string, bookId: string, startDate?: string, endDate?: string, tenantSlug?: string, nocache = false) {
    const key = analyticsCacheService.bookDetailKey(tenantId, bookId, startDate, endDate);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const dbData = await analyticsRepository.getBookDetailAnalytics(tenantId, bookId, startDate, endDate);
    if (!dbData) return null;
    let posthogData = null;
    try {
      posthogData = await getBookAnalytics(tenantId, dbData.book.slug, tenantSlug ?? "");
    } catch {
      // PostHog may not be configured; continue with DB data only
    }
    const result = {
      ...dbData,
      posthog: posthogData
        ? {
            page_views: posthogData.page_views,
            unique_visitors: posthogData.unique_visitors,
            session_count: posthogData.session_count,
            avg_session_duration_seconds: posthogData.avg_session_duration_seconds,
            total_clicks: posthogData.total_clicks,
            book_viewed_count: posthogData.book_viewed_count,
            add_to_cart_count: posthogData.add_to_cart_count,
            book_purchase_count: posthogData.book_purchase_count,
            daily_views: posthogData.daily_views ?? [],
            referrers: posthogData.referrers ?? [],
            locations: posthogData.locations ?? [],
            browsers: posthogData.browsers ?? [],
            operating_systems: posthogData.operating_systems ?? [],
            device_types: posthogData.device_types ?? [],
            sessions: posthogData.sessions ?? [],
          }
        : null,
    };
    analyticsCacheService.set(key, result, DETAIL_L1, DETAIL_L2).catch(() => {});
    return result;
  }

  async getBundlesAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "bundles", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getBundlesAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getPaymentsAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false, filters?: PaymentAnalyticsFilters) {
    // Filtered drill-downs/exports are ad-hoc, skip the cache so we never serve
    // a stale/over-broad set (and never poison the base key).
    const hasFilters = !!filters && (
      !!filters.statuses?.length ||
      !!filters.orderTypes?.length ||
      filters.minAmount != null ||
      filters.maxAmount != null
    );
    const key = analyticsCacheService.paymentsKey(tenantId, startDate, endDate, page, limit, search);
    if (!nocache && !hasFilters) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getPaymentsAnalytics(tenantId, startDate, endDate, page, limit, search, filters);
    if (!hasFilters) analyticsCacheService.set(key, data, PAYMENTS_L1, PAYMENTS_L2).catch(() => {});
    return data;
  }

  async getRecentSuccessfulPayments(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "recent-payments", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getRecentSuccessfulPayments(tenantId, startDate, endDate, page, limit, search);
    // Payments TTLs, not the generic ones, a "recent purchases" feed that lags
    // 90s reads as broken to an admin watching sales come in.
    analyticsCacheService.set(key, data, PAYMENTS_L1, PAYMENTS_L2).catch(() => {});
    return data;
  }

  async getCertificatesAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "certificates", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getCertificatesAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getCertificateDetails(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "cert-details", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getCertificateDetails(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getCouponsAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "coupons", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getCouponsAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getQuizzesAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "quizzes", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getQuizzesAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getEngagementAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "engagement", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getEngagementAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getBookReadingAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "book-reading", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getBookReadingAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getCartAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "cart", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getCartAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getBookmarksAnalytics(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "bookmarks", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getBookmarksAnalytics(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getBookmarkDetails(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string, nocache = false) {
    const key = analyticsCacheService.genericKey(tenantId, "bookmark-details", startDate, endDate, page, limit, search);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    const data = await analyticsRepository.getBookmarkDetails(tenantId, startDate, endDate, page, limit, search);
    analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
    return data;
  }

  async getCourseWatchTime(
    tenantId: string,
    courseId: string,
    startDate?: string,
    endDate?: string,
    nocache = false
  ) {
    const key = analyticsCacheService.genericKey(tenantId, `watch-time:course:${courseId}`, startDate, endDate);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    try {
      const data = await watchTimeAnalyticsRepository.getCourseWatchTime(
        tenantId,
        courseId,
        startDate,
        endDate
      );
      analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
      return data;
    } catch (err) {
      if (isMissingTableError(err)) {
        // Migration not applied, cache an empty shape so dashboards don't pound
        // RDS until the schema lands. See WATCH_TIME_PENDING_* constants.
        logger.warn(
          `[analytics] course watch-time: lecture-watch-tracking schema missing (42P01); serving empty shape (tenant=${tenantId} course=${courseId})`
        );
        analyticsCacheService.set(key, EMPTY_COURSE_WATCH_TIME, WATCH_TIME_PENDING_L1, WATCH_TIME_PENDING_L2).catch(() => {});
        return EMPTY_COURSE_WATCH_TIME;
      }
      throw err;
    }
  }

  async getMemberWatchTime(
    tenantId: string,
    memberId: string,
    startDate?: string,
    endDate?: string,
    nocache = false
  ) {
    const key = analyticsCacheService.genericKey(tenantId, `watch-time:user:${memberId}`, startDate, endDate);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    try {
      const data = await watchTimeAnalyticsRepository.getMemberWatchTime(
        tenantId,
        memberId,
        startDate,
        endDate
      );
      analyticsCacheService.set(key, data, GENERIC_L1, GENERIC_L2).catch(() => {});
      return data;
    } catch (err) {
      if (isMissingTableError(err)) {
        logger.warn(
          `[analytics] member watch-time: lecture-watch-tracking schema missing (42P01); serving empty shape (tenant=${tenantId} member=${memberId})`
        );
        analyticsCacheService.set(key, EMPTY_MEMBER_WATCH_TIME, WATCH_TIME_PENDING_L1, WATCH_TIME_PENDING_L2).catch(() => {});
        return EMPTY_MEMBER_WATCH_TIME;
      }
      throw err;
    }
  }

  async getWatchTimeOverview(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    nocache = false
  ) {
    const key = analyticsCacheService.genericKey(tenantId, "watch-time:overview", startDate, endDate);
    if (!nocache) {
      const cached = await analyticsCacheService.get(key);
      if (cached) return cached;
    }
    try {
      const data = await watchTimeAnalyticsRepository.getOverview(tenantId, startDate, endDate);
      // Populate `meta.lastRollupAt` from the rollup state table. Done in the
      // service so the read still happens when we serve the empty shape on
      // missing-table errors. The repo set hasAnyData based on the window's
      // totals; we don't override it here.
      const watermark = await watchTimeAnalyticsRepository
        .getRollupWatermark(tenantId)
        .catch((err: unknown) => {
          if (isMissingTableError(err)) return null;
          throw err;
        });
      data.meta = {
        hasAnyData: data.meta?.hasAnyData ?? false,
        lastRollupAt: watermark ? watermark.toISOString() : null,
      };
      analyticsCacheService.set(key, data, OVERVIEW_L1, OVERVIEW_L2).catch(() => {});
      return data;
    } catch (err) {
      if (isMissingTableError(err)) {
        logger.warn(
          `[analytics] watch-time overview: lecture-watch-tracking schema missing (42P01); serving empty shape (tenant=${tenantId})`
        );
        analyticsCacheService.set(key, EMPTY_WATCH_TIME_OVERVIEW, WATCH_TIME_PENDING_L1, WATCH_TIME_PENDING_L2).catch(() => {});
        return EMPTY_WATCH_TIME_OVERVIEW;
      }
      throw err;
    }
  }

  /**
   * The course-wise learner roster for the Download Reports screen.
   *
   * Straight pass-through to the repository: there is no derived figure to
   * compute here, and putting a service in front of it keeps the controller
   * from reaching into the data layer.
   */
  async getEnrolmentRoster(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    limit = 10000,
    search?: string
  ) {
    return analyticsRepository.getEnrolmentRosterForExport(
      tenantId,
      startDate,
      endDate,
      limit,
      search
    );
  }

}

export default new AnalyticsService();
