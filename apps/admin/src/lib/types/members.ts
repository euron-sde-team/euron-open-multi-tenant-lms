import type { RevenueBreakdown } from "../utils/currency";

export type MemberStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface MemberListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: MemberStatus;
  joined_at: string;
  last_login_at: string | null;
  enrollment_count: number;
  book_access_count: number;
  certificate_count: number;
  /** Total spent per currency (INR/USD) + combined-in-INR. */
  total_spent: RevenueBreakdown;
}

export interface MembersListResult {
  members: MemberListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface MemberDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: MemberStatus;
  email_verified: boolean;
  phone_verified: boolean;
  oauth_provider: string | null;
  joined_at: string;
  last_login_at: string | null;
  created_at: string;
}

export interface MemberEnrollment {
  id: string;
  course_id: string;
  course_title: string;
  course_mode: string;
  status: string;
  source: string;
  enrolled_at: string;
  completed_at: string | null;
  valid_till: string | null;
  progress_percent: number;
}

export interface MemberBookAccess {
  id: string;
  book_id: string;
  book_title: string;
  status: string;
  source: string;
  valid_till: string | null;
  created_at: string;
}

export interface MemberBatchEnrollment {
  id: string;
  batch_id: string;
  batch_title: string;
  status: string;
  source: string;
  joined_at: string;
  valid_till: string | null;
}

export interface MemberTestSeriesEnrollment {
  id: string;
  test_series_id: string;
  test_series_title: string;
  status: string;
  source: string;
  enrolled_at: string;
  valid_till: string | null;
}

/** Outcome of a single admin access grant (batch/test-series/bundle). */
export type MemberAccessGrantAction =
  | "ACCESS_GRANTED"
  | "ACCESS_REACTIVATED"
  | "ACCESS_ALREADY_ACTIVE";

export interface MemberOrder {
  id: string;
  order_number: string;
  order_type: string;
  base_amount: string;
  discount_amount: string;
  total_amount: string;
  currency: string;
  coupon_code_snapshot: string | null;
  gateway_provider_name: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface MemberCertificate {
  id: string;
  course_id: string;
  course_title: string;
  certificate_number: string;
  status: string;
  issued_at: string;
}

export interface MemberStats {
  total_members: number;
  active_members: number;
  suspended_members: number;
  new_members_30d: number;
}

export interface MembersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PublishedCourse {
  id: string;
  title: string;
  mode: string;
}

export interface PublishedBook {
  id: string;
  title: string;
}

export interface MemberDetailStats {
  enrollment_count: number;
  book_access_count: number;
  certificate_count: number;
  order_count: number;
  /** Total spent per currency + combined-in-INR. */
  total_spent: RevenueBreakdown;
}

export interface MemberCartItem {
  id: string;
  item_type: string;
  item_title: string;
  coupon_code: string | null;
  created_at: string;
}

export interface MemberCouponRedemption {
  id: string;
  coupon_code: string;
  coupon_discount_type: string;
  coupon_discount_value: string;
  order_number: string;
  discount_amount: string;
  currency: string;
  created_at: string;
}

export interface MemberRefund {
  id: string;
  order_id: string;
  order_number: string;
  amount: string;
  reason: string | null;
  status: string;
  processed_at: string | null;
  created_at: string;
}

export interface MemberCourseAnalyticsSummary {
  course_id: string;
  course_title: string;
  course_slug: string;
  course_mode: string;
  enrollment_id: string;
  enrollment_status: string;
  enrollment_source: string;
  enrolled_at: string;
  completed_at: string | null;
  total_lectures: number;
  touched_lectures: number;
  completed_lectures: number;
  not_started_lectures: number;
  completion_percent: number;
  total_duration_seconds: number;
  watched_seconds: number;
  total_watch_seconds: number;
  last_activity_at: string | null;
}

export interface MemberLectureAnalyticsItem {
  lecture_id: string;
  lecture_title: string;
  duration_seconds: number;
  watched_seconds: number;
  total_watch_seconds: number;
  last_position_seconds: number;
  completed: boolean;
  percent_watched: number;
  last_watched_at: string | null;
  has_video: boolean;
}

export interface MemberLessonAnalyticsGroup {
  lesson_id: string;
  lesson_title: string;
  lesson_sort: number;
  lectures: MemberLectureAnalyticsItem[];
}

export interface MemberSectionAnalyticsGroup {
  section_id: string;
  section_title: string;
  section_sort: number;
  lessons: MemberLessonAnalyticsGroup[];
}

export interface MemberCourseAnalyticsDetail {
  course: {
    course_id: string;
    course_title: string;
    total_lectures: number;
    touched_lectures: number;
    completed_lectures: number;
    not_started_lectures: number;
    completion_percent: number;
    total_duration_seconds: number;
    watched_seconds: number;
    total_watch_seconds: number;
  };
  sections: MemberSectionAnalyticsGroup[];
}

export interface MemberCourseAnalyticsExportLecture {
  course_id: string;
  course_title: string;
  section_title: string;
  lesson_title: string;
  lecture_id: string;
  lecture_title: string;
  duration_seconds: number;
  watched_seconds: number;
  total_watch_seconds: number;
  last_position_seconds: number;
  completed: boolean;
  percent_watched: number;
  last_watched_at: string | null;
}

export interface MemberCourseAnalyticsExportPayload {
  summary: MemberCourseAnalyticsSummary[];
  lectures: MemberCourseAnalyticsExportLecture[];
}

export interface MemberQuizAnalyticsItem {
  quiz_id: string;
  quiz_title: string;
  course_id: string;
  course_title: string;
  max_score: number;
  pass_percentage: number;
  attempt_count: number;
  best_score: number;
  best_total_marks: number;
  best_percentage: number;
  /** "PASSED" | "FAILED" | "IN_PROGRESS" | "NOT_ATTEMPTED" */
  status: string;
  last_attempt_at: string | null;
}

export interface MemberQuizAnalyticsSummary {
  total_quizzes: number;
  attempted: number;
  passed: number;
  average_best_percent: number | null;
}

export interface MemberQuizAnalyticsResponse {
  summary: MemberQuizAnalyticsSummary;
  quizzes: MemberQuizAnalyticsItem[];
}

export interface MemberAssignmentAnalyticsItem {
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  course_title: string;
  max_score: number;
  due_date: string | null;
  /** submission_status or "NOT_SUBMITTED" */
  submission_status: string;
  submitted_at: string | null;
  score: number | null;
  score_percentage: number | null;
  is_evaluated: boolean;
  is_late: boolean | null;
  feedback: string | null;
  evaluated_at: string | null;
}

export interface MemberAssignmentAnalyticsSummary {
  total_assignments: number;
  submitted: number;
  evaluated: number;
  average_score_percent: number | null;
}

export interface MemberAssignmentAnalyticsResponse {
  summary: MemberAssignmentAnalyticsSummary;
  assignments: MemberAssignmentAnalyticsItem[];
}

export interface MemberCourseAnalyticsSyncResult {
  checked: number;
  updated: number;
  failed: number;
  notReady: number;
}
