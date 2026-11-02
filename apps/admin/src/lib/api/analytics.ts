import type { ApiResponse } from "../types/auth";
import type { RevenueBreakdown } from "../utils/currency";

import { apiClient } from "./axios";

function buildParams(startDate?: string, endDate?: string, extra?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface AnalyticsOverview {
  total_users: number;
  active_users: number;
  new_users_in_range: number;
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  enrollments_in_range: number;
  /** Gross revenue split by currency (INR / USD / Combined-in-INR). */
  total_revenue: RevenueBreakdown;
  /** Revenue within the selected date range, same split. */
  revenue_in_range: RevenueBreakdown;
  paid_orders: number;
  total_orders: number;
  orders_in_range: number;
  published_courses: number;
  total_courses: number;
  published_books: number;
  total_books: number;
  course_sales: number;
  book_sales: number;
  certificates: number;
  active_period_users: number;
  conversion_rate: number;
  daily_new_users: Array<{ date: string; count: number }>;
  daily_revenue: Array<{ date: string; amount: RevenueBreakdown; count: number }>;
  enrollment_distribution: Array<{ status: string; count: number }>;
  top_courses: Array<{ title: string; enrollment_count: number }>;
  top_books: Array<{ title: string; access_count: number }>;
  revenue_by_type: Array<{ type: string; count: number; revenue: RevenueBreakdown }>;
  monthly_growth: Array<{ month: string; count: number }>;
  active_coupons: number;
  coupon_redemptions: number;
  quiz_attempts_in_range: number;
  quiz_pass_rate: number;
  signup_to_enrollment_rate: number;
  enrollment_to_completion_rate: number;
  total_watch_time_seconds: number;
  lectures_completed: number;
  books_in_progress: number;
  books_completed: number;
  total_cart_items: number;
  total_bookmarks: number;
  total_highlights: number;
}

export interface RecentSignupItem {
  id: string;
  name: string;
  email: string | null;
  status: string;
  joined_at: string | null;
  enrollments_count: number;
  total_spent: RevenueBreakdown;
}

export interface RecentSignupsResponse {
  members: RecentSignupItem[];
  total: number;
}

export interface RecentOrderItem {
  id: string;
  order_number: string;
  member_name: string | null;
  member_email: string | null;
  total_amount: string;
  currency: string;
  status: string;
  order_type: string;
  paid_at: string | null;
  created_at: string;
}

export interface RecentOrdersResponse {
  orders: RecentOrderItem[];
  total: number;
}

/**
 * One successful purchase of one item. A cart order contributes one entry per
 * line, each with its share of the order total, so every row can name and link
 * the thing that was actually bought.
 */
export interface RecentSuccessfulPayment {
  order_id: string;
  order_number: string;
  member_id: string;
  member_name: string;
  member_email: string | null;
  /** Null when the purchased entity has since been deleted. */
  item_id: string | null;
  item_name: string | null;
  /** COURSE | BOOK | BUNDLE | BATCH | TEST_SERIES */
  item_type: string;
  amount: string;
  currency: string;
  paid_at: string | null;
}

export interface RecentSuccessfulPaymentsResponse {
  payments: RecentSuccessfulPayment[];
  total: number;
  page: number;
  limit: number;
}

export interface AnalyticsUserItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  joined_at: string | null;
  last_login_at: string | null;
  enrollments_count: number;
  book_access_count: number;
  completed_enrollments: number;
  total_spent: RevenueBreakdown;
  certificates_count: number;
}

export interface AnalyticsUsersResponse {
  members: AnalyticsUserItem[];
  total: number;
  daily_signups?: Array<{ date: string; count: number }>;
  status_distribution?: Array<{ status: string; count: number }>;
  sum_enrollments?: number;
  sum_books?: number;
  sum_certificates?: number;
}

/**
 * One row of the master cohort table, a member's rolled-up performance across
 * all their enrolled courses. Mirrors the backend `MasterUserProgressRow`.
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
  overallProgressPct: number;
  totalWatchSeconds: number;
  quizAvg: number | null;
  quizzesTaken: number;
  assignmentsTotal: number;
  assignmentsSubmitted: number;
  assignmentPct: number | null;
  lastActive: string | null;
}

export type UsersProgressSortBy =
  | "name"
  | "overall_progress_pct"
  | "quiz_avg"
  | "assignment_pct"
  | "total_watch_seconds"
  | "last_active"
  | "courses_enrolled";

export interface UsersProgressResponse {
  users: MasterUserProgressRow[];
  total: number;
  page: number;
  limit: number;
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

export interface MemberCourseProgressResponse {
  courses: MemberCourseProgressRow[];
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

export interface CourseLearnerProgressResponse {
  learners: CourseLearnerProgressRow[];
}

export interface UserDetailAnalytics {
  profile: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    joined_at: string | null;
    last_login_at: string | null;
  };
  summary: {
    enrollments_count: number;
    book_access_count: number;
    completed_enrollments: number;
    total_spent: RevenueBreakdown;
    certificates_count: number;
    cart_count: number;
    bookmark_count: number;
  };
  enrollments: Array<{
    id: string;
    course_id: string;
    course_title: string;
    status: string;
    enrolled_at: string | null;
  }>;
  book_access: Array<{
    id: string;
    book_id: string;
    book_title: string;
    status: string;
    created_at: string | null;
  }>;
  orders: Array<{
    id: string;
    order_number: string;
    total_amount: string;
    currency: string;
    status: string;
    order_type: string;
    created_at: string;
  }>;
  certificates: Array<{
    id: string;
    course_title: string;
    status: string;
    issued_at: string | null;
  }>;
  daily_enrollments: Array<{ date: string; count: number }>;
  daily_orders: Array<{ date: string; count: number }>;
  posthog?: {
    total_events: number;
    total_sessions: number;
    total_pageviews: number;
    avg_session_duration_seconds: number;
    first_seen: string;
    last_seen: string;
    locations: Array<{ country: string; city: string; count: number }>;
    browsers: Array<{ name: string; count: number }>;
    operating_systems: Array<{ name: string; count: number }>;
    device_types: Array<{ name: string; count: number }>;
    top_pages: Array<{ url: string; count: number }>;
    events_breakdown: Array<{ event: string; count: number }>;
    sessions: Array<{
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
    }>;
    courses_viewed: Array<{ course_id: string; count: number }>;
    books_viewed: Array<{ book_id: string; count: number }>;
  } | null;
}

export interface AnalyticsCourseItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  mode: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  enrollment_count: number;
  completed_count: number;
  active_count: number;
  completion_rate: number;
  avg_rating: number;
  review_count: number;
  revenue: RevenueBreakdown;
  sales_count: number;
  created_at: string | null;
}

export interface AnalyticsCoursesResponse {
  items: AnalyticsCourseItem[];
  total: number;
  daily_enrollments?: Array<{ date: string; count: number }>;
}

export interface CourseDetailAnalytics {
  course: {
    id: string;
    title: string;
    slug: string;
    status: string;
    mode: string;
    purchase_mode: string;
    price_inr: number | null;
    price_usd: number | null;
  };
  summary: {
    enrollment_count: number;
    completed_count: number;
    active_count: number;
    completion_rate: number;
    avg_rating: number;
    review_count: number;
    revenue: RevenueBreakdown;
    sales_count: number;
    bookmark_count: number;
    cart_count: number;
  };
  daily_enrollments: Array<{ date: string; count: number }>;
  daily_revenue: Array<{ date: string; amount: RevenueBreakdown; count: number }>;
  daily_bookmarks: Array<{ date: string; count: number }>;
  daily_cart_adds: Array<{ date: string; count: number }>;
  daily_completions: Array<{ date: string; count: number }>;
  enrollment_status_distribution: Array<{ status: string; count: number }>;
  posthog?: {
    page_views: number;
    unique_visitors: number;
    session_count: number;
    avg_session_duration_seconds: number;
    total_clicks: number;
    course_viewed_count: number;
    enrollment_initiated_count: number;
    add_to_cart_count: number;
    payment_initiated_count: number;
    payment_completed_count: number;
    daily_views: Array<{ date: string; count: number }>;
    referrers: Array<{ domain: string; count: number }>;
    locations: Array<{ country: string; city: string; count: number }>;
    browsers: Array<{ name: string; count: number }>;
    operating_systems: Array<{ name: string; count: number }>;
    device_types: Array<{ name: string; count: number }>;
    sessions: Array<{
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
    }>;
  } | null;
}

export interface AnalyticsBookItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  access_count: number;
  active_access: number;
  revenue: RevenueBreakdown;
  sales_count: number;
  created_at: string | null;
}

export interface AnalyticsBooksResponse {
  items: AnalyticsBookItem[];
  total: number;
  daily_access?: Array<{ date: string; count: number }>;
  daily_revenue?: Array<{ date: string; amount: RevenueBreakdown; count: number }>;
  status_distribution?: Array<{ status: string; count: number }>;
  sum_access?: number;
  sum_revenue?: RevenueBreakdown;
  sum_sales?: number;
}

export interface BookDetailAnalytics {
  book: {
    id: string;
    title: string;
    slug: string;
    status: string;
    purchase_mode: string;
    price_inr: number | null;
    price_usd: number | null;
  };
  summary: {
    access_count: number;
    active_access: number;
    completed_count: number;
    completion_rate: number;
    revenue: RevenueBreakdown;
    sales_count: number;
    bookmark_count: number;
    cart_count: number;
  };
  daily_access: Array<{ date: string; count: number }>;
  daily_revenue: Array<{ date: string; amount: RevenueBreakdown; count: number }>;
  daily_bookmarks: Array<{ date: string; count: number }>;
  daily_cart_adds: Array<{ date: string; count: number }>;
  daily_completions: Array<{ date: string; count: number }>;
  posthog?: {
    page_views: number;
    unique_visitors: number;
    session_count: number;
    avg_session_duration_seconds: number;
    total_clicks: number;
    book_viewed_count: number;
    add_to_cart_count: number;
    book_purchase_count: number;
    daily_views: Array<{ date: string; count: number }>;
    referrers: Array<{ domain: string; count: number }>;
    locations: Array<{ country: string; city: string; count: number }>;
    browsers: Array<{ name: string; count: number }>;
    operating_systems: Array<{ name: string; count: number }>;
    device_types: Array<{ name: string; count: number }>;
    sessions: Array<{
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
    }>;
  } | null;
}

export interface AnalyticsBundleItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  item_count: number;
  revenue: RevenueBreakdown;
  sales_count: number;
  created_at: string | null;
}

export interface AnalyticsBundlesResponse {
  items: AnalyticsBundleItem[];
  total: number;
  daily_sales?: Array<{ date: string; count: number }>;
  daily_revenue?: Array<{ date: string; amount: RevenueBreakdown; count: number }>;
  status_distribution?: Array<{ status: string; count: number }>;
  sum_items?: number;
  sum_revenue?: RevenueBreakdown;
  sum_sales?: number;
}

export interface PaymentAnalytics {
  total_revenue: RevenueBreakdown;
  total_orders: number;
  paid: number;
  paid_inr: number;
  paid_usd: number;
  failed: number;
  pending: number;
  refunded: number;
  failed_amount: RevenueBreakdown;
  pending_amount: RevenueBreakdown;
  refunded_amount: RevenueBreakdown;
  avg_order_value_inr: number | null;
  avg_order_value_usd: number | null;
  conversion_rate: number;
  failure_reasons: Array<{ reason: string; count: number }>;
  daily_orders: Array<{ date: string; paid: number; failed: number; pending: number }>;
  daily_revenue: Array<{ date: string; amount: RevenueBreakdown; count: number }>;
  by_type: Array<{ type: string; count: number; revenue: RevenueBreakdown }>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    member_name: string | null;
    member_email: string | null;
    total_amount: string;
    currency: string;
    status: string;
    order_type: string;
    failure_reason: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
  recent_orders_total: number;
}

export interface CertificateAnalytics {
  total: number;
  issued: number;
  revoked: number;
  by_course: Array<{ id: string; title: string; count: number }>;
  by_course_total: number;
  daily_issued?: Array<{ date: string; count: number }>;
}

export interface CertificateDetailItem {
  id: string;
  member_name: string;
  member_email: string | null;
  course_title: string;
  status: string;
  issued_at: string | null;
  revoked_at: string | null;
}

export interface CertificateDetailsResponse {
  items: CertificateDetailItem[];
  total: number;
}

export interface CommunityAnalytics {
  total_posts: number;
  posts_in_range: number;
  total_comments: number;
  comments_in_range: number;
  top_posters: Array<{ id: string; name: string; email: string | null; post_count: number }>;
  top_posters_total: number;
  daily_posts?: Array<{ date: string; count: number }>;
  daily_comments?: Array<{ date: string; count: number }>;
}

export interface CouponAnalyticsItem {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
}

export interface CouponAnalytics {
  total: number;
  active: number;
  total_usage: number;
  coupons: CouponAnalyticsItem[];
  coupons_total: number;
  daily_redemptions?: Array<{ date: string; count: number }>;
}

export interface QuizAnalyticsItem {
  id: string;
  title: string;
  course_title: string;
  attempt_count: number;
  avg_score: number;
  passed: number;
  failed: number;
  pass_rate: number;
}

export interface QuizzesAnalyticsResponse {
  items: QuizAnalyticsItem[];
  total: number;
  daily_attempts?: Array<{ date: string; count: number }>;
}

export interface RoadmapAnalyticsItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  milestone_count: number;
  item_count: number;
  participants: number;
  completed_items: number;
  total_progress_entries: number;
  completion_rate: number;
}

export interface RoadmapsAnalyticsResponse {
  items: RoadmapAnalyticsItem[];
  total: number;
  daily_progress?: Array<{ date: string; count: number }>;
}

export interface LiveSessionAnalytics {
  total: number;
  scheduled: number;
  live: number;
  ended: number;
  cancelled: number;
  sessions: Array<{
    id: string;
    title: string;
    status: string;
    start_time: string | null;
    end_time: string | null;
    course_title: string | null;
    registrations: number;
  }>;
  sessions_total: number;
  daily_sessions?: Array<{ date: string; count: number }>;
}

export interface EngagementAnalyticsItem {
  id: string;
  title: string;
  total_seconds: number;
  total_watch_time_hours: number;
  completed_lectures: number;
  active_learners: number;
  avg_time_per_learner_seconds: number;
}

export interface EngagementAnalytics {
  total_watch_time_seconds: number;
  lectures_completed: number;
  active_learners: number;
  avg_watch_time_per_user_seconds: number;
  items: EngagementAnalyticsItem[];
  total: number;
  daily_watch_time?: Array<{ date: string; seconds: number }>;
  daily_lectures?: Array<{ date: string; count: number }>;
}

export interface BookReadingAnalyticsItem {
  id: string;
  title: string;
  readers: number;
  completed: number;
  in_progress: number;
  highlights: number;
  page_bookmarks: number;
}

export interface BookReadingAnalytics {
  books_in_progress: number;
  books_completed: number;
  total_highlights: number;
  total_page_bookmarks: number;
  items: BookReadingAnalyticsItem[];
  total: number;
  daily_completions?: Array<{ date: string; count: number }>;
}

export interface CartAnalyticsItem {
  id: string;
  item_type: string;
  item_title: string;
  member_name: string;
  member_email: string | null;
  created_at: string | null;
}

export interface CartAnalytics {
  total_items: number;
  unique_users: number;
  courses_in_cart: number;
  books_in_cart: number;
  bundles_in_cart: number;
  items: CartAnalyticsItem[];
  total: number;
  daily_items_added?: Array<{ date: string; count: number }>;
}

export interface BookmarksAnalyticsItem {
  id: string;
  title: string;
  type: "COURSE" | "BOOK" | "BUNDLE";
  bookmark_count: number;
}

export interface BookmarksAnalytics {
  total_bookmarks: number;
  course_bookmarks: number;
  book_bookmarks: number;
  bundle_bookmarks: number;
  items: BookmarksAnalyticsItem[];
  total: number;
  daily_bookmarks?: Array<{ date: string; count: number }>;
}

export interface BookmarkDetailItem {
  id: string;
  bookmark_type: string;
  member_name: string;
  member_email: string | null;
  item_title: string;
  created_at: string | null;
}

export interface BookmarkDetailsResponse {
  items: BookmarkDetailItem[];
  total: number;
}

export interface ResumeAnalyticsItem {
  id: string;
  file_name: string | null;
  status: string;
  is_tailored: boolean;
  template_name: string | null;
  company_name: string | null;
  user_name: string;
  user_email: string;
  analyses_count: number;
  created_at: string | null;
}

export interface ResumeAnalyticsResponse {
  items: ResumeAnalyticsItem[];
  total: number;
  daily_resumes?: Array<{ date: string; count: number }>;
  status_distribution?: Array<{ status: string; count: number }>;
  unique_users?: number;
  total_analyses?: number;
  tailored_count?: number;
  top_templates?: Array<{ name: string; count: number }>;
}

export interface JobAnalyticsSavedItem {
  id: string;
  title: string;
  company_name: string;
  location: string;
  employment_type: string | null;
  experience_level: string | null;
  user_name: string;
  user_email: string;
  created_at: string | null;
}

export interface JobAnalyticsResponse {
  total_searches: number;
  unique_searchers: number;
  saved_jobs: number;
  unique_savers: number;
  daily_searches?: Array<{ date: string; count: number }>;
  daily_saved_jobs?: Array<{ date: string; count: number }>;
  top_searchers?: Array<{ name: string; email: string; search_count: number }>;
  top_companies?: Array<{ name: string; count: number }>;
  top_locations?: Array<{ name: string; count: number }>;
  items: JobAnalyticsSavedItem[];
  total: number;
}

async function fetchAnalytics<T>(path: string, startDate?: string, endDate?: string, extra?: Record<string, string | number | undefined>): Promise<T> {
  const url = `/tenant/dashboard/analytics/${path}${buildParams(startDate, endDate, extra)}`;
  const response = await apiClient.get<ApiResponse<T>>(url);
  return response.data.data;
}

/** Optional filters for the learner (Users) analytics list + export. */
export interface LearnerFilters {
  courseIds?: string[];
  bundleIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  amountScope?: "total" | "selected";
  enrollmentStatus?: string[];
  signupFrom?: string;
  signupTo?: string;
}

export interface PaymentFilters {
  statuses?: string[];
  orderTypes?: string[];
  minAmount?: number;
  maxAmount?: number;
}

/** One row per (learner x course) for the course-wise roster report. */
export interface EnrolmentRosterRow {
  course_title: string;
  course_mode: string;
  member_name: string;
  member_email: string | null;
  member_phone: string | null;
  enrollment_status: string;
  enrollment_source: string;
  enrolled_at: string | null;
  valid_till: string | null;
  completed_at: string | null;
  member_status: string;
  joined_at: string | null;
}

export interface EnrolmentRosterResponse {
  rows: EnrolmentRosterRow[];
  total: number;
}

export const analyticsApi = {
  getOverview: (s?: string, e?: string) => fetchAnalytics<AnalyticsOverview>("overview", s, e),
  getRecentSignups: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<RecentSignupsResponse>("overview/recent-signups", s, e, { page, limit, search }),
  getRecentOrders: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<RecentOrdersResponse>("overview/recent-orders", s, e, { page, limit, search }),
  getRecentSuccessfulPayments: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<RecentSuccessfulPaymentsResponse>("users/recent-payments", s, e, { page, limit, search }),
  getUsers: (s?: string, e?: string, page?: number, limit?: number, search?: string, filters?: LearnerFilters) =>
    fetchAnalytics<AnalyticsUsersResponse>("users", s, e, {
      page,
      limit,
      search,
      courseIds: filters?.courseIds?.length ? filters.courseIds.join(",") : undefined,
      bundleIds: filters?.bundleIds?.length ? filters.bundleIds.join(",") : undefined,
      minAmount: filters?.minAmount,
      maxAmount: filters?.maxAmount,
      amountScope: filters?.amountScope,
      enrollmentStatus: filters?.enrollmentStatus?.length ? filters.enrollmentStatus.join(",") : undefined,
      signupFrom: filters?.signupFrom || undefined,
      signupTo: filters?.signupTo || undefined,
    }),
  /** One row per learner per course, for the course-wise roster report. */
  getEnrolmentRoster: (s?: string, e?: string, limit?: number, search?: string) =>
    fetchAnalytics<EnrolmentRosterResponse>("enrolment-roster", s, e, { limit, search }),
  getUsersProgress: (page?: number, limit?: number, search?: string, sortBy?: UsersProgressSortBy, sortOrder?: "asc" | "desc", courseId?: string) =>
    fetchAnalytics<UsersProgressResponse>("users/progress", undefined, undefined, { page, limit, search, sortBy, sortOrder, courseId }),
  getUserCourseProgress: (userId: string) =>
    fetchAnalytics<MemberCourseProgressResponse>(`users/${userId}/course-progress`),
  // All enrolled learners of one course with their IN-THAT-COURSE progress.
  getCourseLearnerProgress: (courseId: string) =>
    fetchAnalytics<CourseLearnerProgressResponse>(`courses/${courseId}/learner-progress`),
  getUserDetail: (userId: string, s?: string, e?: string, tenantSlug?: string) =>
    fetchAnalytics<UserDetailAnalytics>(`users/${userId}`, s, e, tenantSlug ? { tenantSlug } : undefined),
  getCourses: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<AnalyticsCoursesResponse>("courses", s, e, { page, limit, search }),
  getCourseDetail: (courseId: string, s?: string, e?: string, tenantSlug?: string) =>
    fetchAnalytics<CourseDetailAnalytics>(`courses/${courseId}`, s, e, tenantSlug ? { tenantSlug } : undefined),
  getBooks: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<AnalyticsBooksResponse>("books", s, e, { page, limit, search }),
  getBookDetail: (bookId: string, s?: string, e?: string, tenantSlug?: string) =>
    fetchAnalytics<BookDetailAnalytics>(`books/${bookId}`, s, e, tenantSlug ? { tenantSlug } : undefined),
  getBundles: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<AnalyticsBundlesResponse>("bundles", s, e, { page, limit, search }),
  getPayments: (s?: string, e?: string, page?: number, limit?: number, search?: string, filters?: PaymentFilters) =>
    fetchAnalytics<PaymentAnalytics>("payments", s, e, {
      page,
      limit,
      search,
      statuses: filters?.statuses?.length ? filters.statuses.join(",") : undefined,
      orderTypes: filters?.orderTypes?.length ? filters.orderTypes.join(",") : undefined,
      minAmount: filters?.minAmount,
      maxAmount: filters?.maxAmount,
    }),
  getCertificates: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<CertificateAnalytics>("certificates", s, e, { page, limit, search }),
  getCertificateDetails: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<CertificateDetailsResponse>("certificates/details", s, e, { page, limit, search }),
  getCoupons: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<CouponAnalytics>("coupons", s, e, { page, limit, search }),
  getQuizzes: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<QuizzesAnalyticsResponse>("quizzes", s, e, { page, limit, search }),
  getEngagement: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<EngagementAnalytics>("engagement", s, e, { page, limit, search }),
  getBookReading: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<BookReadingAnalytics>("book-reading", s, e, { page, limit, search }),
  getCart: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<CartAnalytics>("cart", s, e, { page, limit, search }),
  getBookmarks: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<BookmarksAnalytics>("bookmarks", s, e, { page, limit, search }),
  getBookmarkDetails: (s?: string, e?: string, page?: number, limit?: number, search?: string) =>
    fetchAnalytics<BookmarkDetailsResponse>("bookmarks/details", s, e, { page, limit, search }),
  getCourseWatchTime: (courseId: string, s?: string, e?: string) =>
    fetchAnalytics<CourseWatchTimeAnalytics>(`courses/${courseId}/watch-time`, s, e),
  getMemberWatchTime: (userId: string, s?: string, e?: string) =>
    fetchAnalytics<MemberWatchTimeAnalytics>(`users/${userId}/watch-time`, s, e),
  getWatchTimeOverview: (s?: string, e?: string) =>
    fetchAnalytics<WatchTimeOverviewAnalytics>("watch-time", s, e),
};

export interface CourseWatchTimeLecture {
  lecture_id: string;
  title: string | null;
  duration_seconds: number;
  total_seconds: number;
  total_hours: number;
  sessions_count: number;
  max_daily_members: number;
  avg_completion_pct: number;
  dropoff: Array<{ bucket: number; sessions: number }>;
}

export interface CourseWatchTimeViewer {
  member_id: string;
  member_name: string | null;
  member_email: string | null;
  total_seconds: number;
  total_hours: number;
  lectures_touched: number;
}

export interface CourseWatchTimeAnalytics {
  perLecture: CourseWatchTimeLecture[];
  topViewers: CourseWatchTimeViewer[];
  dailyWatchHours: Array<{ date: string; seconds: number }>;
}

export interface MemberWatchTimeCourse {
  course_id: string;
  title: string | null;
  total_seconds: number;
  total_hours: number;
  lectures_watched: number;
  sessions_count: number;
  last_active_at: string;
}

export interface MemberWatchTimeRecentSession {
  session_id: string;
  lecture_id: string;
  lecture_title: string | null;
  course_id: string;
  course_title: string | null;
  started_at: string;
  last_heartbeat_at: string;
  end_position: number;
  seconds_watched: number;
}

export interface MemberWatchTimeAnalytics {
  perCourse: MemberWatchTimeCourse[];
  recentSessions: MemberWatchTimeRecentSession[];
}

export interface WatchTimeOverviewSummary {
  total_seconds: number;
  total_hours: number;
  sessions_count: number;
  lectures_touched: number;
  active_learners: number;
  avg_seconds_per_learner: number;
  avg_hours_per_learner: number;
  avg_completion_pct: number;
}

export interface WatchTimeDailyPoint {
  date: string;
  seconds: number;
  hours: number;
  sessions: number;
}

export interface WatchTimeTopCourse {
  course_id: string;
  title: string | null;
  total_seconds: number;
  total_hours: number;
  sessions_count: number;
  lectures_touched: number;
  avg_completion_pct: number;
}

export interface WatchTimeTopViewer {
  member_id: string;
  member_name: string | null;
  member_email: string | null;
  total_seconds: number;
  total_hours: number;
  courses_touched: number;
  lectures_touched: number;
  last_active_at: string;
}

export interface WatchTimeTopLecture {
  lecture_id: string;
  title: string | null;
  duration_seconds: number;
  course_id: string;
  course_title: string | null;
  total_seconds: number;
  total_hours: number;
  sessions_count: number;
  max_daily_members: number;
  avg_completion_pct: number;
}

export interface WatchTimeOverviewMeta {
  /** True when at least one rollup row exists in the selected window. */
  hasAnyData: boolean;
  /** ISO timestamp of the last successful rollup tick for this tenant, or null if it has never run. */
  lastRollupAt: string | null;
}

export interface WatchTimeOverviewAnalytics {
  summary: WatchTimeOverviewSummary;
  dailyWatchHours: WatchTimeDailyPoint[];
  topCourses: WatchTimeTopCourse[];
  topViewers: WatchTimeTopViewer[];
  topLectures: WatchTimeTopLecture[];
  /**
   * Optional, older backends won't return it. Frontend should treat the
   * absence of this field as "no signal", not as "no data".
   */
  meta?: WatchTimeOverviewMeta;
}
