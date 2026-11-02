"use client";

import { Button, Input } from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { GraduationCap, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { AnalyticsDataTable } from "@/components/analytics/analytics-data-table";
import {
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { TrendStat } from "@/components/analytics/trend-stat";
import { RevenueBreakdownDisplay } from "@/components/shared/RevenueBreakdown";
import type { AnalyticsCourseItem } from "@/lib/api/analytics";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsCourses } from "@/lib/hooks/use-analytics";
import { formatInr } from "@/lib/utils/currency";

// Turns "SELF_PACED" into "Self Paced" etc. Used for chart legends and badge text.
function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .split("_")
    .map((p) => (p.length === 0 ? p : p[0].toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");
}

// Color-coded badge for Status / Mode columns. Falls back to muted gray for
// unknown values so the UI doesn't crash on new enum members.
function EnumBadge({
  value,
  kind,
}: {
  value: string | null | undefined;
  kind: "status" | "mode";
}) {
  const tone =
    kind === "status"
      ? value === "PUBLISHED"
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800"
        : value === "DRAFT"
          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800"
          : "bg-muted text-muted-foreground ring-1 ring-border"
      : value === "SELF_PACED"
        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800"
        : "bg-muted text-muted-foreground ring-1 ring-border";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {formatEnumLabel(value)}
    </span>
  );
}

export default function CoursesAnalyticsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useAnalyticsCourses(page, search);

  const courses = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;

  const statusDistribution = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const c of courses) {
      const s = c.status ?? "UNKNOWN";
      byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
    }
    return Array.from(byStatus.entries())
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: formatEnumLabel(name), value }));
  }, [courses]);

  const modeDistribution = useMemo(() => {
    const byMode = new Map<string, number>();
    for (const c of courses) {
      const m = c.mode ?? "UNKNOWN";
      byMode.set(m, (byMode.get(m) ?? 0) + 1);
    }
    return Array.from(byMode.entries())
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: formatEnumLabel(name), value }));
  }, [courses]);

  // Full (decoded) title is kept in the chart data; the chart component
  // truncates with an ellipsis on the Y axis and shows the full title in
  // the tooltip.
  const topCoursesByEnrollment = useMemo(() => {
    const sorted = [...courses].sort((a, b) => b.enrollment_count - a.enrollment_count);
    return sorted.slice(0, 8).map((c) => ({
      date: decodeHtmlEntities(c.title ?? ""),
      count: c.enrollment_count,
    }));
  }, [courses]);

  const topCoursesByRevenue = useMemo(() => {
    // Sort by combined-in-INR so INR and USD earners are comparable
    const sorted = [...courses].sort(
      (a, b) => b.revenue.combined_inr - a.revenue.combined_inr,
    );
    return sorted.slice(0, 8).map((c) => ({
      date: decodeHtmlEntities(c.title ?? ""),
      count: c.revenue.combined_inr,
    }));
  }, [courses]);

  // Graphical Excel report (KPIs + charts) over the current course set.
  const buildReport = useCallback(async () => {
    const totalEnrollments = courses.reduce((s, c) => s + c.enrollment_count, 0);
    const totalSales = courses.reduce((s, c) => s + c.sales_count, 0);
    const totalRevenueCombined = courses.reduce(
      (s, c) => s + (c.revenue?.combined_inr ?? 0),
      0,
    );

    const charts: ChartSpec[] = [];
    if (data?.daily_enrollments?.length)
      charts.push({
        kind: "line",
        title: "Daily enrollments",
        labels: data.daily_enrollments.map((d) => d.date),
        series: [
          {
            name: "Enrollments",
            color: REPORT_COLORS.blue,
            values: data.daily_enrollments.map((d) => d.count),
          },
        ],
      });
    if (statusDistribution.length)
      charts.push({
        kind: "donut",
        title: "Status distribution",
        segments: statusDistribution.map((d) => ({ label: d.name, value: d.value })),
      });
    if (modeDistribution.length)
      charts.push({
        kind: "donut",
        title: "Mode distribution",
        segments: modeDistribution.map((d) => ({ label: d.name, value: d.value })),
      });
    if (topCoursesByEnrollment.length)
      charts.push({
        kind: "bar",
        title: "Top courses by enrollments",
        bars: topCoursesByEnrollment.map((c) => ({ label: c.date, value: c.count })),
      });
    if (topCoursesByRevenue.some((c) => c.count > 0))
      charts.push({
        kind: "bar",
        title: "Top courses by revenue (INR eq.)",
        bars: topCoursesByRevenue.map((c) => ({ label: c.date, value: Math.round(c.count) })),
        valueFormat: formatInr,
      });

    await buildAnalyticsReport({
      fileName: "courses-report",
      title: "Courses report",
      kpis: [
        { label: "Total courses", value: String(data?.total ?? courses.length) },
        { label: "Total enrollments", value: String(totalEnrollments) },
        { label: "Total sales", value: String(totalSales) },
        { label: "Total revenue (INR eq.)", value: formatInr(totalRevenueCombined) },
      ],
      charts,
      sheets: [
        {
          name: "Courses",
          columns: [
            { header: "Title", key: "Title", width: 32 },
            { header: "Status", key: "Status", width: 12 },
            { header: "Mode", key: "Mode", width: 12 },
            { header: "Purchase Mode", key: "Purchase Mode", width: 14 },
            { header: "Price INR", key: "Price INR", width: 12, numFmt: "#,##0" },
            { header: "Price USD", key: "Price USD", width: 12, numFmt: "#,##0" },
            { header: "Enrollments", key: "Enrollments", width: 12, numFmt: "#,##0" },
            { header: "Active", key: "Active", width: 10, numFmt: "#,##0" },
            { header: "Completed", key: "Completed", width: 12, numFmt: "#,##0" },
            { header: "Completion Rate (%)", key: "Completion Rate (%)", width: 16, numFmt: "#,##0" },
            { header: "Avg Rating", key: "Avg Rating", width: 10 },
            { header: "Reviews", key: "Reviews", width: 10, numFmt: "#,##0" },
            { header: "Revenue INR", key: "Revenue INR", width: 14, numFmt: "#,##0" },
            { header: "Revenue USD", key: "Revenue USD", width: 14, numFmt: "#,##0" },
            { header: "Revenue Combined (INR eq.)", key: "Revenue Combined (≈ INR)", width: 22, numFmt: "#,##0" },
            { header: "Sales", key: "Sales", width: 10, numFmt: "#,##0" },
          ],
          rows: courses.map((c) => ({
            Title: decodeHtmlEntities(c.title ?? ""),
            Status: formatEnumLabel(c.status),
            Mode: formatEnumLabel(c.mode),
            "Purchase Mode": formatEnumLabel(c.purchase_mode),
            "Price INR": c.price_inr ?? 0,
            "Price USD": c.price_usd ?? 0,
            Enrollments: c.enrollment_count,
            Active: c.active_count,
            Completed: c.completed_count,
            "Completion Rate (%)": c.completion_rate,
            "Avg Rating": c.avg_rating,
            Reviews: c.review_count,
            "Revenue INR": c.revenue.inr,
            "Revenue USD": c.revenue.usd,
            "Revenue Combined (≈ INR)": c.revenue.combined_inr,
            Sales: c.sales_count,
          })),
          dataBarColumn: "Revenue Combined (≈ INR)",
        },
      ],
    });
  }, [
    courses,
    data?.total,
    data?.daily_enrollments,
    statusDistribution,
    modeDistribution,
    topCoursesByEnrollment,
    topCoursesByRevenue,
  ]);

  if (isLoading) return <AnalyticsSkeleton />;

  const exportData = courses.map((c) => ({
    Title: decodeHtmlEntities(c.title ?? ""),
    Status: formatEnumLabel(c.status),
    Mode: formatEnumLabel(c.mode),
    "Purchase Mode": formatEnumLabel(c.purchase_mode),
    "Price INR": c.price_inr ?? 0,
    "Price USD": c.price_usd ?? 0,
    Enrollments: c.enrollment_count,
    Active: c.active_count,
    Completed: c.completed_count,
    "Completion Rate (%)": c.completion_rate,
    "Avg Rating": c.avg_rating,
    Reviews: c.review_count,
    "Revenue INR": c.revenue.inr,
    "Revenue USD": c.revenue.usd,
    "Revenue Combined (≈ INR)": c.revenue.combined_inr,
    Sales: c.sales_count,
  }));

  const totalEnrollments = courses.reduce((s, c) => s + c.enrollment_count, 0);
  const totalRevenueInr = courses.reduce((s, c) => s + c.revenue.inr, 0);
  const totalRevenueUsd = courses.reduce((s, c) => s + c.revenue.usd, 0);
  const conversionRate = courses[0]?.revenue.conversion_rate ?? 90;
  const totalRevenueBreakdown = {
    inr: totalRevenueInr,
    usd: totalRevenueUsd,
    combined_inr: totalRevenueInr + totalRevenueUsd * conversionRate,
    conversion_rate: conversionRate,
  };
  const totalSales = courses.reduce((s, c) => s + c.sales_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Courses Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} courses total
          </p>
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="courses-analytics"
          sheetName="Courses"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            className="pl-9"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={() => { setSearch(searchInput); setPage(1); }}>
          Search
        </Button>
        {search && (
          <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <TrendStat
          title="Total Courses"
          value={data?.total ?? courses.length}
          icon={GraduationCap}
        />
        <TrendStat title="Total Enrollments" value={totalEnrollments} />
        <TrendStat title="Total Sales" value={totalSales} />
      </div>

      {/* Multi-currency revenue breakdown for courses on this page */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium text-muted-foreground mb-2">
          Total Revenue (this page)
        </p>
        <RevenueBreakdownDisplay
          value={totalRevenueBreakdown}
          variant="inline"
          showSubnote
        />
      </div>

      {data?.daily_enrollments && data.daily_enrollments.length > 0 && (
        <AnalyticsLineChart
          title="Daily Enrollments"
          description="Course enrollments over time"
          data={data.daily_enrollments}
          dataKey="count"
          name="Enrollments"
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {statusDistribution.length > 0 && (
          <AnalyticsPieChart
            title="Status Distribution"
            description="Courses by status"
            data={statusDistribution}
          />
        )}
        {modeDistribution.length > 0 && (
          <AnalyticsPieChart
            title="Mode Distribution"
            description="Courses by delivery mode"
            data={modeDistribution}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {topCoursesByEnrollment.length > 0 && (
          <AnalyticsBarChart
            title="Top Courses by Enrollments"
            description="Courses with most enrollments"
            data={topCoursesByEnrollment}
            dataKey="count"
            name="Enrollments"
            layout="vertical"
            height={Math.max(280, topCoursesByEnrollment.length * 36)}
          />
        )}
        {topCoursesByRevenue.length > 0 && topCoursesByRevenue.some((r) => r.count > 0) && (
          <AnalyticsBarChart
            title="Top Courses by Revenue"
            description="Ranked by combined ≈ INR (INR + USD × rate)"
            data={topCoursesByRevenue}
            dataKey="count"
            name="Revenue (≈ INR)"
            layout="vertical"
            height={Math.max(280, topCoursesByRevenue.length * 36)}
          />
        )}
      </div>

      <AnalyticsDataTable
        columns={[
          {
            key: "title",
            label: "Title",
            render: (row) =>
              decodeHtmlEntities(
                (row as unknown as AnalyticsCourseItem).title ?? ""
              ),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <EnumBadge
                value={(row as unknown as AnalyticsCourseItem).status}
                kind="status"
              />
            ),
          },
          {
            key: "mode",
            label: "Mode",
            render: (row) => (
              <EnumBadge
                value={(row as unknown as AnalyticsCourseItem).mode}
                kind="mode"
              />
            ),
          },
          { key: "enrollment_count", label: "Enrollments", align: "right", format: "number" },
          { key: "completed_count", label: "Completed", align: "right", format: "number" },
          { key: "completion_rate", label: "Completion Rate", align: "center", format: "percent" },
          { key: "avg_rating", label: "Avg Rating", align: "right" },
          {
            key: "revenue",
            label: "Revenue",
            align: "right",
            render: (row) => {
              const rev = (row as unknown as AnalyticsCourseItem).revenue;
              return <RevenueBreakdownDisplay value={rev} variant="cell" />;
            },
          },
          { key: "sales_count", label: "Sales", align: "right", format: "number" },
        ]}
        data={courses as unknown as Array<Record<string, unknown>>}
        total={data?.total ?? 0}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/dashboard/analytics/courses-analytics/${row.id}`)}
        emptyMessage="No courses found"
      />
    </div>
  );
}
