export interface ContentOverview {
  total_courses: number;
  published_courses: number;
  draft_courses: number;
  self_paced_courses: number;
  total_books: number;
  published_books: number;
  draft_books: number;
  total_bundles: number;
  published_bundles: number;
  total_categories: number;
  total_instructors: number;
  total_pages: number;
  published_pages: number;
}

export interface MemberOverview {
  total_members: number;
  active_members: number;
  members_joined_last_30_days: number;
}

export interface EnrollmentOverview {
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  free_enrollments: number;
  paid_enrollments: number;
}

import type { RevenueBreakdown } from "../utils/currency";

export interface RevenueOverview {
  /** Gross revenue split by payment currency (INR / USD / Combined-in-INR). */
  total_revenue: RevenueBreakdown;
  /** Revenue for the last 30 days, same currency split. */
  revenue_last_30_days: RevenueBreakdown;
  total_orders: number;
  /** Paid order counts split per currency so AOV is interpretable. */
  paid_orders_inr: number;
  paid_orders_usd: number;
  /** Per-currency average order value. `null` when that currency has no paid orders. */
  average_order_value_inr: number | null;
  average_order_value_usd: number | null;
  /** Refunds, same currency split. */
  total_refunds: RevenueBreakdown;
  /** USD→INR rate used for the `combined_inr` fields. */
  conversion_rate: number;
}

export interface RecentEnrollment {
  id: string;
  member_name: string | null;
  member_email: string | null;
  course_title: string;
  source: string;
  enrolled_at: string;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  member_name: string | null;
  member_email: string | null;
  total_amount: string;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface TopCourse {
  id: string;
  title: string;
  enrollment_count: number;
  status: string;
  mode: string;
}

export interface DashboardData {
  content: ContentOverview;
  members: MemberOverview;
  enrollments: EnrollmentOverview;
  revenue: RevenueOverview;
  recent_enrollments: RecentEnrollment[];
  recent_orders: RecentOrder[];
  top_courses: TopCourse[];
}
