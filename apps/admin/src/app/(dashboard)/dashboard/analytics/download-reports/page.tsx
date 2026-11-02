"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useToast,
} from "@open-mtlms/core";
import {
  Activity,
  Award,
  BookMarked,
  Bookmark,
  BookOpen,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Package,
  PlayCircle,
  ShoppingCart,
  Ticket,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { useState } from "react";

import { exportMultiSheetExcel } from "@/components/analytics/excel-export";
import { analyticsApi } from "@/lib/api/analytics";
import { assignmentsApi } from "@/lib/api/assignments";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";

/**
 * Reports pull the full result set rather than the table view's page size.
 * the backend caps analytics list endpoints at this value.
 */
const EXPORT_LIMIT = 10000;

type Row = Record<string, unknown>;
type Sheet = { name: string; data: Row[] };

interface ReportItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  /** Returns one workbook tab per entry; empty tabs are dropped on write. */
  fetchFn: (s?: string, e?: string) => Promise<Sheet[]>;
  fileName: string;
}

// ─── Shared shaping helpers ─────────────────────────────────────────────────

/** Flatten a { label, value } map into the one-row-per-metric "Summary" tab. */
function metricsSheet(name: string, metrics: Record<string, unknown>): Sheet {
  return {
    name,
    data: Object.entries(metrics)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([Metric, Value]) => ({ Metric, Value: Value as unknown })),
  };
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return +((part / whole) * 100).toFixed(2);
}

const dailyCountSheet = (
  name: string,
  rows: Array<{ date: string; count: number }> | undefined
): Sheet => ({
  name,
  data: (rows ?? []).map((r) => ({ Date: r.date, Count: r.count })),
});

/** Seconds are unreadable in a spreadsheet; report hours to two decimals. */
function hours(seconds: number | null | undefined): number {
  return +(((seconds ?? 0) as number) / 3600).toFixed(2);
}

// ─── Reports ────────────────────────────────────────────────────────────────

const REPORTS: ReportItem[] = [
  {
    id: "users",
    title: "Users Report",
    description:
      "Every user with enrollments, spend, certificates and activity, plus signup trend and status split",
    icon: Users,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getUsers(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "Users",
          // `total_spent` is a RevenueBreakdown object; expand into explicit
          // numeric columns so cells hold usable values instead of the JS
          // default "[object Object]" serialization.
          data: data.members.map((m) => ({
            Name: m.name,
            Email: m.email ?? "",
            Phone: m.phone ?? "",
            Status: m.status,
            "Joined At": m.joined_at ?? "",
            "Last Login": m.last_login_at ?? "",
            Enrollments: m.enrollments_count,
            Books: m.book_access_count,
            "Completed Courses": m.completed_enrollments,
            "Completion Rate %": pct(m.completed_enrollments, m.enrollments_count),
            Certificates: m.certificates_count,
            "Spent INR": m.total_spent.inr,
            "Spent USD": m.total_spent.usd,
            "Spent Combined (≈ INR)": m.total_spent.combined_inr,
          })),
        },
        metricsSheet("Summary", {
          "Total Users": data.total,
          "Total Enrollments": data.sum_enrollments,
          "Total Book Access": data.sum_books,
          "Total Certificates": data.sum_certificates,
        }),
        {
          name: "Status Split",
          data: (data.status_distribution ?? []).map((r) => ({
            Status: r.status,
            Users: r.count,
          })),
        },
        dailyCountSheet("Daily Signups", data.daily_signups),
      ];
    },
    fileName: "users-report",
  },
  {
    id: "course-learners",
    title: "Course-wise Learners",
    description:
      "Every learner on every course with name, email, phone and access validity, plus a per-course headcount",
    icon: Users,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getEnrolmentRoster(s, e, EXPORT_LIMIT);
      const rows = data.rows ?? [];

      // A NULL expiry means access never ends. Blank reads as missing data to
      // an admin checking who is about to lose access, so it says so.
      const validity = (v: string | null) => (v ? v.slice(0, 10) : "Lifetime");
      const day = (v: string | null) => (v ? v.slice(0, 10) : "");
      const today = new Date().toISOString().slice(0, 10);

      // The headcount question, counted from the same rows the detail sheet
      // shows, so the two sheets cannot disagree. Active, expired and
      // cancelled add up to the total.
      const summary = new Map<
        string,
        { Course: string; "Course Type": string; "Total Learners": number; Active: number; "Access Expired": number; Cancelled: number; Completed: number }
      >();
      for (const r of rows) {
        const entry = summary.get(r.course_title) ?? {
          Course: r.course_title,
          "Course Type": r.course_mode,
          "Total Learners": 0,
          Active: 0,
          "Access Expired": 0,
          Cancelled: 0,
          Completed: 0,
        };
        entry["Total Learners"] += 1;
        const till = r.valid_till ? r.valid_till.slice(0, 10) : null;
        if (r.enrollment_status === "CANCELLED") entry.Cancelled += 1;
        else if (till && till < today) entry["Access Expired"] += 1;
        else if (r.enrollment_status === "ACTIVE") entry.Active += 1;
        if (r.completed_at) entry.Completed += 1;
        summary.set(r.course_title, entry);
      }

      return [
        {
          name: "Course Summary",
          data: [...summary.values()].sort(
            (a, b) => b["Total Learners"] - a["Total Learners"]
          ),
        },
        {
          name: "Course Learners",
          data: rows.map((r) => ({
            Course: r.course_title,
            "Course Type": r.course_mode,
            Name: r.member_name,
            Email: r.member_email ?? "",
            Phone: r.member_phone ?? "",
            "Enrolment Status": r.enrollment_status,
            Source: r.enrollment_source,
            "Enrolled On": day(r.enrolled_at),
            "Access Valid Till": validity(r.valid_till),
            "Completed On": day(r.completed_at),
            "Learner Status": r.member_status,
            Joined: day(r.joined_at),
          })),
        },
        metricsSheet("Summary", {
          "Total Enrolments": rows.length,
          "Courses With Learners": summary.size,
          "Unique Learners": new Set(rows.map((r) => r.member_email || r.member_name)).size,
        }),
      ];
    },
    fileName: "course-learners-report",
  },
  {
    id: "courses",
    title: "Courses Report",
    description:
      "Every course with enrollments, active vs completed, ratings, revenue and enrollment trend",
    icon: GraduationCap,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getCourses(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "Courses",
          data: data.items.map((c) => ({
            Title: c.title,
            Slug: c.slug,
            Status: c.status,
            Mode: c.mode,
            "Purchase Mode": c.purchase_mode,
            "Price INR": c.price_inr ?? "",
            "Price USD": c.price_usd ?? "",
            Enrollments: c.enrollment_count,
            Active: c.active_count,
            Completed: c.completed_count,
            "Completion Rate %": c.completion_rate,
            "Avg Rating": c.avg_rating,
            Reviews: c.review_count,
            Sales: c.sales_count,
            "Revenue INR": c.revenue.inr,
            "Revenue USD": c.revenue.usd,
            "Revenue Combined (≈ INR)": c.revenue.combined_inr,
            "Created At": c.created_at ?? "",
          })),
        },
        metricsSheet("Summary", { "Total Courses": data.total }),
        dailyCountSheet("Daily Enrollments", data.daily_enrollments),
      ];
    },
    fileName: "courses-report",
  },
  {
    id: "books",
    title: "Books Report",
    description:
      "Every book with access counts, revenue, status split and access trend",
    icon: BookOpen,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getBooks(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "Books",
          data: data.items.map((b) => ({
            Title: b.title,
            Slug: b.slug,
            Status: b.status,
            "Purchase Mode": b.purchase_mode,
            "Price INR": b.price_inr ?? "",
            "Price USD": b.price_usd ?? "",
            "Access Count": b.access_count,
            "Active Access": b.active_access,
            Sales: b.sales_count,
            "Revenue INR": b.revenue.inr,
            "Revenue USD": b.revenue.usd,
            "Revenue Combined (≈ INR)": b.revenue.combined_inr,
            "Created At": b.created_at ?? "",
          })),
        },
        metricsSheet("Summary", {
          "Total Books": data.total,
          "Total Access": data.sum_access,
          "Total Sales": data.sum_sales,
          "Revenue INR": data.sum_revenue?.inr,
          "Revenue USD": data.sum_revenue?.usd,
          "Revenue Combined (≈ INR)": data.sum_revenue?.combined_inr,
        }),
        {
          name: "Status Split",
          data: (data.status_distribution ?? []).map((r) => ({
            Status: r.status,
            Books: r.count,
          })),
        },
        dailyCountSheet("Daily Access", data.daily_access),
      ];
    },
    fileName: "books-report",
  },
  {
    id: "bundles",
    title: "Bundles Report",
    description:
      "Every bundle with pricing, item counts, sales, revenue and sales trend",
    icon: Package,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getBundles(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "Bundles",
          data: data.items.map((b) => ({
            Title: b.title,
            Slug: b.slug,
            Status: b.status,
            "Purchase Mode": b.purchase_mode,
            "Price INR": b.price_inr ?? "",
            "Price USD": b.price_usd ?? "",
            Items: b.item_count,
            Sales: b.sales_count,
            "Revenue INR": b.revenue.inr,
            "Revenue USD": b.revenue.usd,
            "Revenue Combined (≈ INR)": b.revenue.combined_inr,
            "Created At": b.created_at ?? "",
          })),
        },
        metricsSheet("Summary", {
          "Total Bundles": data.total,
          "Total Items Bundled": data.sum_items,
          "Total Sales": data.sum_sales,
          "Revenue INR": data.sum_revenue?.inr,
          "Revenue USD": data.sum_revenue?.usd,
          "Revenue Combined (≈ INR)": data.sum_revenue?.combined_inr,
        }),
        dailyCountSheet("Daily Sales", data.daily_sales),
      ];
    },
    fileName: "bundles-report",
  },
  {
    id: "payments",
    title: "Payments Report",
    description:
      "Full order ledger with failure reasons, plus revenue summary, order type split and daily revenue",
    icon: CreditCard,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getPayments(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "Orders",
          data: data.recent_orders.map((o) => ({
            "Order Number": o.order_number,
            Member: o.member_name ?? "",
            Email: o.member_email ?? "",
            Amount: o.total_amount,
            Currency: o.currency,
            Status: o.status,
            Type: o.order_type,
            "Failure Reason": o.failure_reason ?? "",
            "Paid At": o.paid_at ?? "",
            "Created At": o.created_at,
          })),
        },
        metricsSheet("Summary", {
          "Total Orders": data.total_orders,
          Paid: data.paid,
          Failed: data.failed,
          Pending: data.pending,
          Refunded: data.refunded,
          "Conversion Rate %": data.conversion_rate,
          "Revenue INR": data.total_revenue.inr,
          "Revenue USD": data.total_revenue.usd,
          "Revenue Combined (≈ INR)": data.total_revenue.combined_inr,
          "Avg Order Value INR": data.avg_order_value_inr ?? "",
          "Avg Order Value USD": data.avg_order_value_usd ?? "",
          "Failed Amount INR": data.failed_amount.inr,
          "Failed Amount USD": data.failed_amount.usd,
          "Pending Amount INR": data.pending_amount.inr,
          "Pending Amount USD": data.pending_amount.usd,
          "Refunded Amount INR": data.refunded_amount.inr,
          "Refunded Amount USD": data.refunded_amount.usd,
        }),
        {
          name: "By Order Type",
          data: data.by_type.map((t) => ({
            Type: t.type,
            Orders: t.count,
            "Revenue INR": t.revenue.inr,
            "Revenue USD": t.revenue.usd,
            "Revenue Combined (≈ INR)": t.revenue.combined_inr,
          })),
        },
        {
          name: "Daily Revenue",
          data: data.daily_revenue.map((d) => ({
            Date: d.date,
            Orders: d.count,
            "Revenue INR": d.amount.inr,
            "Revenue USD": d.amount.usd,
            "Revenue Combined (≈ INR)": d.amount.combined_inr,
          })),
        },
        {
          name: "Daily Orders",
          data: data.daily_orders.map((d) => ({
            Date: d.date,
            Paid: d.paid,
            Failed: d.failed,
            Pending: d.pending,
          })),
        },
        {
          name: "Failure Reasons",
          data: data.failure_reasons.map((f) => ({
            Reason: f.reason,
            Count: f.count,
          })),
        },
      ];
    },
    fileName: "payments-report",
  },
  {
    id: "certificates",
    title: "Certificates Report",
    description:
      "Every issued certificate with recipient and course, plus per course totals",
    icon: Award,
    fetchFn: async (s, e) => {
      const [details, summary] = await Promise.all([
        analyticsApi.getCertificateDetails(s, e, 1, EXPORT_LIMIT),
        analyticsApi.getCertificates(s, e, 1, EXPORT_LIMIT),
      ]);
      return [
        {
          name: "Certificates",
          data: details.items.map((c) => ({
            Member: c.member_name,
            Email: c.member_email ?? "",
            Course: c.course_title,
            Status: c.status,
            "Issued At": c.issued_at ?? "",
            "Revoked At": c.revoked_at ?? "",
          })),
        },
        metricsSheet("Summary", {
          Total: summary.total,
          Issued: summary.issued,
          Revoked: summary.revoked,
        }),
        {
          name: "By Course",
          data: summary.by_course.map((c) => ({
            Course: c.title,
            "Certificates Issued": c.count,
          })),
        },
        dailyCountSheet("Daily Issued", summary.daily_issued),
      ];
    },
    fileName: "certificates-report",
  },
  {
    id: "coupons",
    title: "Coupons Report",
    description:
      "Every coupon with usage, remaining uses, validity window and redemption trend",
    icon: Ticket,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getCoupons(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "Coupons",
          data: data.coupons.map((c) => ({
            Code: c.code,
            Type: c.discount_type,
            Discount: c.discount_value,
            Active: c.is_active ? "Yes" : "No",
            Used: c.used_count,
            "Max Uses": c.max_uses ?? "Unlimited",
            "Remaining Uses":
              c.max_uses == null
                ? "Unlimited"
                : Math.max(0, c.max_uses - c.used_count),
            "Valid From": c.valid_from ?? "",
            "Valid To": c.valid_to ?? "",
            "Created At": c.created_at,
          })),
        },
        metricsSheet("Summary", {
          "Total Coupons": data.total,
          Active: data.active,
          "Total Redemptions": data.total_usage,
        }),
        dailyCountSheet("Daily Redemptions", data.daily_redemptions),
      ];
    },
    fileName: "coupons-report",
  },
  {
    id: "quizzes",
    title: "Quizzes Report",
    description: "Quiz performance with scores, pass and fail rates, plus attempt trend",
    icon: Trophy,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getQuizzes(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "Quizzes",
          data: data.items.map((q) => ({
            Title: q.title,
            Course: q.course_title,
            Attempts: q.attempt_count,
            "Avg Score": q.avg_score,
            Passed: q.passed,
            Failed: q.failed,
            "Pass Rate %": q.pass_rate,
          })),
        },
        metricsSheet("Summary", { "Total Quizzes": data.total }),
        dailyCountSheet("Daily Attempts", data.daily_attempts),
      ];
    },
    fileName: "quizzes-report",
  },
  {
    id: "learner-progress",
    title: "Learner Progress Report",
    description:
      "Every learner's progress across all their courses: completion, watch time, quiz average and assignment submission",
    icon: Activity,
    fetchFn: async () => {
      const data = await analyticsApi.getUsersProgress(1, EXPORT_LIMIT);
      return [
        {
          name: "Learner Progress",
          data: data.users.map((u) => ({
            Name: u.name,
            Email: u.email ?? "",
            Phone: u.phone ?? "",
            Status: u.status,
            "Joined At": u.joinedAt ?? "",
            "Courses Enrolled": u.coursesEnrolled,
            "Courses Completed": u.coursesCompleted,
            "Lectures Completed": u.completedLectures,
            "Total Lectures": u.totalLectures,
            "Overall Progress %": u.overallProgressPct,
            "Watch Time (hrs)": hours(u.totalWatchSeconds),
            "Quizzes Taken": u.quizzesTaken,
            "Quiz Average": u.quizAvg ?? "",
            "Assignments Submitted": u.assignmentsSubmitted,
            "Assignments Total": u.assignmentsTotal,
            "Assignment %": u.assignmentPct ?? "",
            "Last Active": u.lastActive ?? "",
          })),
        },
        metricsSheet("Summary", { "Total Learners": data.total }),
      ];
    },
    fileName: "learner-progress-report",
  },
  {
    id: "engagement",
    title: "Engagement Report",
    description:
      "Watch time and lecture completion per course, with active learners and daily trend",
    icon: Video,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getEngagement(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "By Course",
          data: data.items.map((i) => ({
            Course: i.title,
            "Watch Time (hrs)": i.total_watch_time_hours,
            "Completed Lectures": i.completed_lectures,
            "Active Learners": i.active_learners,
            "Avg Time Per Learner (hrs)": hours(i.avg_time_per_learner_seconds),
          })),
        },
        metricsSheet("Summary", {
          "Total Watch Time (hrs)": hours(data.total_watch_time_seconds),
          "Lectures Completed": data.lectures_completed,
          "Active Learners": data.active_learners,
          "Avg Watch Time Per User (hrs)": hours(data.avg_watch_time_per_user_seconds),
        }),
        {
          name: "Daily Watch Time",
          data: (data.daily_watch_time ?? []).map((d) => ({
            Date: d.date,
            "Watch Time (hrs)": hours(d.seconds),
          })),
        },
        dailyCountSheet("Daily Lectures", data.daily_lectures),
      ];
    },
    fileName: "engagement-report",
  },
  {
    id: "watch-time",
    title: "Video Watch Report",
    description:
      "Watch time rollup with top courses, top viewers, top lectures and the daily curve",
    icon: PlayCircle,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getWatchTimeOverview(s, e);
      return [
        metricsSheet("Summary", {
          "Total Watch Time (hrs)": data.summary.total_hours,
          Sessions: data.summary.sessions_count,
          "Lectures Touched": data.summary.lectures_touched,
          "Active Learners": data.summary.active_learners,
          "Avg Hours Per Learner": data.summary.avg_hours_per_learner,
          "Avg Completion %": data.summary.avg_completion_pct,
        }),
        {
          name: "Top Courses",
          data: data.topCourses.map((c) => ({
            Course: c.title ?? "",
            "Watch Time (hrs)": c.total_hours,
            Sessions: c.sessions_count,
            "Lectures Touched": c.lectures_touched,
            "Avg Completion %": c.avg_completion_pct,
          })),
        },
        {
          name: "Top Viewers",
          data: data.topViewers.map((v) => ({
            Name: v.member_name ?? "",
            Email: v.member_email ?? "",
            "Watch Time (hrs)": v.total_hours,
            "Courses Touched": v.courses_touched,
            "Lectures Touched": v.lectures_touched,
            "Last Active": v.last_active_at,
          })),
        },
        {
          name: "Top Lectures",
          data: data.topLectures.map((l) => ({
            Lecture: l.title ?? "",
            Course: l.course_title ?? "",
            "Lecture Length (hrs)": hours(l.duration_seconds),
            "Watch Time (hrs)": l.total_hours,
            Sessions: l.sessions_count,
            "Avg Completion %": l.avg_completion_pct,
          })),
        },
        {
          name: "Daily Watch",
          data: data.dailyWatchHours.map((d) => ({
            Date: d.date,
            "Watch Time (hrs)": d.hours,
            Sessions: d.sessions,
          })),
        },
      ];
    },
    fileName: "watch-time-report",
  },
  {
    id: "book-reading",
    title: "Book Reading Report",
    description:
      "Reader counts, completions, highlights and bookmarks per book, with completion trend",
    icon: BookMarked,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getBookReading(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "By Book",
          data: data.items.map((b) => ({
            Book: b.title,
            Readers: b.readers,
            Completed: b.completed,
            "In Progress": b.in_progress,
            Highlights: b.highlights,
            "Page Bookmarks": b.page_bookmarks,
          })),
        },
        metricsSheet("Summary", {
          "Books In Progress": data.books_in_progress,
          "Books Completed": data.books_completed,
          "Total Highlights": data.total_highlights,
          "Total Page Bookmarks": data.total_page_bookmarks,
        }),
        dailyCountSheet("Daily Completions", data.daily_completions),
      ];
    },
    fileName: "book-reading-report",
  },
  {
    id: "cart",
    title: "Cart Report",
    description:
      "Items sitting in carts with the member who added them, the abandoned cart follow up list",
    icon: ShoppingCart,
    fetchFn: async (s, e) => {
      const data = await analyticsApi.getCart(s, e, 1, EXPORT_LIMIT);
      return [
        {
          name: "Cart Items",
          data: data.items.map((i) => ({
            Member: i.member_name,
            Email: i.member_email ?? "",
            "Item Type": i.item_type,
            Item: i.item_title,
            "Added At": i.created_at ?? "",
          })),
        },
        metricsSheet("Summary", {
          "Total Items In Carts": data.total_items,
          "Unique Users": data.unique_users,
          "Courses In Cart": data.courses_in_cart,
          "Books In Cart": data.books_in_cart,
          "Bundles In Cart": data.bundles_in_cart,
        }),
        dailyCountSheet("Daily Items Added", data.daily_items_added),
      ];
    },
    fileName: "cart-report",
  },
  {
    id: "bookmarks",
    title: "Bookmarks Report",
    description:
      "What learners are saving: per item counts plus who bookmarked what and when",
    icon: Bookmark,
    fetchFn: async (s, e) => {
      const [summary, details] = await Promise.all([
        analyticsApi.getBookmarks(s, e, 1, EXPORT_LIMIT),
        analyticsApi.getBookmarkDetails(s, e, 1, EXPORT_LIMIT),
      ]);
      return [
        {
          name: "Bookmarks",
          data: details.items.map((b) => ({
            Member: b.member_name,
            Email: b.member_email ?? "",
            Type: b.bookmark_type,
            Item: b.item_title,
            "Bookmarked At": b.created_at ?? "",
          })),
        },
        {
          name: "By Item",
          data: summary.items.map((i) => ({
            Item: i.title,
            Type: i.type,
            Bookmarks: i.bookmark_count,
          })),
        },
        metricsSheet("Summary", {
          "Total Bookmarks": summary.total_bookmarks,
          "Course Bookmarks": summary.course_bookmarks,
          "Book Bookmarks": summary.book_bookmarks,
          "Bundle Bookmarks": summary.bundle_bookmarks,
        }),
        dailyCountSheet("Daily Bookmarks", summary.daily_bookmarks),
      ];
    },
    fileName: "bookmarks-report",
  },
  {
    id: "assignments",
    title: "Assignments Report",
    description:
      "Assignments per course with submission counts and how much evaluation is still pending",
    icon: FileText,
    fetchFn: async () => {
      const data = await assignmentsApi.getAssignmentAnalyticsOverview({
        page: 1,
        limit: EXPORT_LIMIT,
      });
      return [
        {
          name: "By Course",
          data: data.courses.map((c) => ({
            Course: c.course_title,
            Assignments: c.total_assignments,
            Published: c.published_count,
            Draft: c.draft_count,
            Submissions: c.total_submissions,
            Evaluated: c.evaluated_count,
            "Pending Evaluation": c.pending_evaluation,
          })),
        },
        metricsSheet("Summary", {
          "Total Assignments": data.total_assignments,
          Published: data.published_count,
          Draft: data.draft_count,
          "Total Submissions": data.total_submissions,
          Evaluated: data.evaluated_count,
          "Pending Evaluation": data.pending_evaluation_count,
        }),
      ];
    },
    fileName: "assignments-report",
  },
];

export default function DownloadReportsPage() {
  const { dateRange } = useAnalyticsDateRange();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleDownload = async (report: ReportItem) => {
    setLoading(report.id);
    try {
      const sheets = await report.fetchFn(
        dateRange.startDate,
        dateRange.endDate
      );
      const written = exportMultiSheetExcel(sheets, report.fileName);
      if (!written) {
        toast({
          title: "Nothing to export",
          description: `${report.title} has no data for the selected date range.`,
        });
      }
    } catch (error) {
      toast({
        title: "Export failed",
        description:
          error instanceof Error
            ? error.message
            : `Could not build ${report.title}.`,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Download Reports</h1>
        <p className="text-sm text-muted-foreground">
          Export analytics as Excel workbooks for the selected date range. Each
          report includes a summary tab alongside the detailed rows.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const isLoading = loading === report.id;
          return (
            <Card
              key={report.id}
              className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => !isLoading && handleDownload(report)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-sm font-semibold">
                      {report.title}
                    </CardTitle>
                  </div>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  {report.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
