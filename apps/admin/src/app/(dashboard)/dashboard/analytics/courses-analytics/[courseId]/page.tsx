"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, useToast } from "@open-mtlms/core";
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Download,
  Eye,
  GraduationCap,
  Loader2,
  MousePointerClick,
  ShoppingCart,
  Star,
  TrendingUp,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { coursesApi } from "@/lib/api/courses";

import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { CHART_COLORS } from "@/components/analytics/chart-utils";
import {
  AnalyticsSkeleton,
  EntityBreakdownGrid,
  formatDuration,
  SessionsGrid,
} from "@/components/analytics/shared";
import { RevenueBreakdownDisplay } from "@/components/shared/RevenueBreakdown";
import { CourseAssignmentSection } from "@/components/analytics/course-assignment-section";
import { CourseQuizSection } from "@/components/analytics/course-quiz-section";
import { CourseWatchTimeSection } from "@/components/analytics/course-watch-time-section";
import { useCourseDetailAnalytics } from "@/lib/hooks/use-analytics";


export default function CourseDetailAnalyticsPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const { data, isLoading } = useCourseDetailAnalytics(courseId ?? null);

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/analytics/courses-analytics"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Courses
        </Link>
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Course not found or no analytics available.
        </div>
      </div>
    );
  }

  const {
    course,
    summary,
    daily_enrollments,
    daily_revenue,
    daily_bookmarks,
    daily_cart_adds,
    daily_completions,
    enrollment_status_distribution,
    posthog,
  } = data;

  const enrollmentPieData = (enrollment_status_distribution ?? [])
    .filter((d) => (d.count ?? 0) > 0)
    .map((d) => ({ name: String(d.status ?? "Unknown"), value: d.count ?? 0 }));

  const referrerPieData = (posthog?.referrers ?? [])
    .filter((r) => (r.count ?? 0) > 0)
    .slice(0, 8)
    .map((r) => ({ name: r.domain || "Direct", value: r.count ?? 0 }));

  const combinedEnrollmentsRevenue = (() => {
    const byDate = new Map<string, { enrollments: number; revenue: number }>();
    for (const r of daily_enrollments ?? []) {
      const d = String(r.date ?? "").slice(0, 10);
      if (d)
        byDate.set(d, {
          ...(byDate.get(d) ?? { enrollments: 0, revenue: 0 }),
          enrollments: r.count ?? 0,
        });
    }
    for (const r of daily_revenue ?? []) {
      const d = String(r.date ?? "").slice(0, 10);
      if (d)
        byDate.set(d, {
          ...(byDate.get(d) ?? { enrollments: 0, revenue: 0 }),
          // Combined-in-INR for the dual-axis line chart. Per-currency split
          // is visible in the Revenue card + export.
          revenue: r.amount?.combined_inr ?? 0,
        });
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, enrollments: v.enrollments, revenue: v.revenue }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics/courses-analytics"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Link>
          <ChevronRight className="text-muted-foreground h-4 w-4" />
          <span
            className="max-w-[200px] truncate text-sm font-medium sm:max-w-full"
            title={course.title}
          >
            {course.title}
          </span>
        </div>
        <ExportCourseAnalyticsButton courseId={courseId} />
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GraduationCap className="h-6 w-6" />
          Course Performance
        </h1>
        <p className="text-muted-foreground text-sm">
          {course.title}, {course.status} · {course.mode}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
            <GraduationCap className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.enrollment_count ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.completed_count ?? 0).toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              Completion rate: {summary.completion_rate ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <span className="text-xs text-muted-foreground">
              {summary.sales_count ?? 0} sales
            </span>
          </CardHeader>
          <CardContent>
            <RevenueBreakdownDisplay
              value={summary.revenue}
              variant="inline"
              showSubnote
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bookmarks</CardTitle>
            <Bookmark className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.bookmark_count ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Cart</CardTitle>
            <ShoppingCart className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.cart_count ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.avg_rating ?? 0).toFixed(1)}</div>
            <p className="text-muted-foreground text-xs">{summary.review_count ?? 0} reviews</p>
          </CardContent>
        </Card>
      </div>

      {/* Web Vitals & Conversion Funnel (date-independent) */}
      {posthog && (
        <>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Web Vitals</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                  <Eye className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.page_views ?? 0).toLocaleString()}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {posthog.unique_visitors ?? 0} unique visitors
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Sessions</CardTitle>
                  <Video className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.session_count ?? 0).toLocaleString()}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Avg. {formatDuration(posthog.avg_session_duration_seconds ?? 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                  <MousePointerClick className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.total_clicks ?? 0).toLocaleString()}
                  </div>
                  <p className="text-muted-foreground text-xs">Autocapture + rage clicks</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Add to Cart (Events)</CardTitle>
                  <ShoppingCart className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.add_to_cart_count ?? 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Conversion Funnel</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Course Viewed</CardTitle>
                  <CardDescription className="text-xs">course_viewed events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.course_viewed_count ?? 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Add to Cart</CardTitle>
                  <CardDescription className="text-xs">add_to_cart events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.add_to_cart_count ?? 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Enrollment Initiated</CardTitle>
                  <CardDescription className="text-xs">enrollment_initiated events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.enrollment_initiated_count ?? 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Payment Initiated</CardTitle>
                  <CardDescription className="text-xs">payment_initiated events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.payment_initiated_count ?? 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Payment Completed</CardTitle>
                  <CardDescription className="text-xs">payment_completed events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(posthog.payment_completed_count ?? 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsLineChart
          title="Daily Enrollments & Revenue"
          description="Enrollments and revenue over time"
          data={combinedEnrollmentsRevenue}
          lines={[
            { dataKey: "enrollments", name: "Enrollments", color: CHART_COLORS[0] },
            { dataKey: "revenue", name: "Revenue (₹)", color: CHART_COLORS[1], yAxisId: "right" },
          ]}
          height={260}
        />

        {posthog && (posthog.daily_views?.length ?? 0) > 0 && (
          <AnalyticsAreaChart
            title="Daily Page Views"
            description="Page views over time"
            data={posthog.daily_views}
            dataKey="count"
            name="Views"
            height={260}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(daily_bookmarks?.length ?? 0) > 0 && (
          <AnalyticsBarChart
            title="Daily Bookmarks"
            description="Course bookmarks added over time"
            data={daily_bookmarks}
            dataKey="count"
            name="Bookmarks"
            height={240}
          />
        )}

        {(daily_cart_adds?.length ?? 0) > 0 && (
          <AnalyticsBarChart
            title="Daily Add to Cart"
            description="Items added to cart over time"
            data={daily_cart_adds}
            dataKey="count"
            name="Cart Adds"
            height={240}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(daily_completions?.length ?? 0) > 0 && (
          <AnalyticsLineChart
            title="Daily Completions"
            description="Course completions over time"
            data={daily_completions}
            dataKey="count"
            name="Completions"
            height={240}
          />
        )}

        {(daily_revenue?.length ?? 0) > 0 && (
          <AnalyticsAreaChart
            title="Daily Revenue (≈ INR)"
            description="Combined revenue (INR + USD converted)"
            data={daily_revenue.map((r) => ({ date: r.date, count: r.amount?.combined_inr ?? 0 }))}
            dataKey="count"
            name="Revenue (≈ INR)"
            height={240}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {enrollmentPieData.length > 0 && (
          <AnalyticsPieChart
            title="Enrollment Status"
            description="Distribution of enrollment status"
            data={enrollmentPieData}
            height={260}
          />
        )}

        {referrerPieData.length > 0 && (
          <AnalyticsPieChart
            title="Traffic Sources"
            description="Top referrers"
            data={referrerPieData}
            height={260}
          />
        )}
      </div>

      {/* Locations, Browsers, OS, Devices */}
      {posthog && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Location & Device Breakdown</h2>
          <EntityBreakdownGrid
            locations={posthog.locations ?? []}
            browsers={posthog.browsers ?? []}
            operatingSystems={posthog.operating_systems ?? []}
            deviceTypes={posthog.device_types ?? []}
            referrers={(posthog.referrers ?? []).map((r) => ({ domain: r.domain, count: r.count }))}
          />
        </div>
      )}

      {/* Sessions */}
      {posthog && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Video className="text-muted-foreground h-4 w-4" />
            <div>
              <CardTitle className="text-sm font-medium">Recent Sessions</CardTitle>
              <CardDescription className="text-xs">
                Sessions that visited this course page
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SessionsGrid
              sessions={(posthog.sessions ?? []).map((s) => ({
                session_id: s.session_id,
                distinct_id: s.distinct_id,
                start_time: s.start_time,
                duration_seconds: s.duration_seconds,
                page_count: s.page_count,
                entry_url: s.entry_url,
                exit_url: s.exit_url,
                country: s.country ?? "Unknown",
                city: s.city ?? "Unknown",
                browser: s.browser ?? "Unknown",
                os: s.os ?? "Unknown",
                device_type: s.device_type ?? "Unknown",
              }))}
              emptyMessage="No sessions for this course yet"
            />
          </CardContent>
        </Card>
      )}

      {!posthog && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No web analytics data yet for this course.
          </CardContent>
        </Card>
      )}

      {/* Watch time, quiz, and assignment sections aggregate across every
          enrolled learner. All three hit pre-existing single-query backend
          aggregates (rollup table for watch time, course-scoped indexed
          aggregates for quiz + assignment). */}
      <CourseWatchTimeSection courseId={courseId} />
      <CourseQuizSection courseId={courseId} />
      <CourseAssignmentSection courseId={courseId} />
    </div>
  );
}

function ExportCourseAnalyticsButton({ courseId }: { courseId: string }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await coursesApi.downloadAnalyticsXlsx(courseId);
      toast({
        title: "Report ready",
        description:
          "6-sheet workbook downloaded: profile, video, quiz, assignment, daily engagement, top learners.",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description:
          err instanceof Error ? err.message : "Could not generate the report",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleExport}
      disabled={exporting}
      title="Download a detailed .xlsx report of this course's analytics"
    >
      {exporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Download detailed report
    </Button>
  );
}
