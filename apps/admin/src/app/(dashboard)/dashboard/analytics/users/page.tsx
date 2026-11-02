"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { Users, Award, BookOpen, CreditCard, GraduationCap, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { AnalyticsDataTable } from "@/components/analytics/analytics-data-table";
import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { ExportMenu } from "@/components/analytics/export-menu";
import { LearnerFilterBar } from "@/components/analytics/learner-filter-bar";
import { RecentPaymentsTable } from "@/components/analytics/recent-payments-table";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { StudentPerformanceTable } from "@/components/analytics/student-performance-table";
import { TrendStat } from "@/components/analytics/trend-stat";
import { RevenueBreakdownDisplay } from "@/components/shared/RevenueBreakdown";
import { analyticsApi, type AnalyticsUserItem, type LearnerFilters } from "@/lib/api/analytics";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsUsers } from "@/lib/hooks/use-analytics";
import { useHasPermission } from "@/lib/hooks/use-permissions";
import { formatInr } from "@/lib/utils/currency";

const EXPORT_LIMIT = 20000;

const LEARNER_SHEET_COLUMNS = [
  { header: "Name", key: "Name", width: 22 },
  { header: "Email", key: "Email", width: 26 },
  { header: "Phone", key: "Phone", width: 16 },
  { header: "Status", key: "Status", width: 12 },
  { header: "Joined", key: "Joined", width: 14 },
  { header: "Enrollments", key: "Enrollments", width: 12 },
  { header: "Books", key: "Books", width: 10 },
  { header: "Completed", key: "Completed", width: 12 },
  { header: "Spent INR", key: "Spent INR", width: 12, numFmt: "#,##0" },
  { header: "Spent USD", key: "Spent USD", width: 12, numFmt: "#,##0" },
  { header: "Spent Combined (INR eq.)", key: "Spent Combined (≈ INR)", width: 20, numFmt: "#,##0" },
  { header: "Certificates", key: "Certificates", width: 12 },
];

function toExportRow(u: AnalyticsUserItem) {
  return {
    Name: u.name,
    Email: u.email ?? "-",
    Phone: u.phone ?? "-",
    Status: u.status,
    Joined: u.joined_at ? new Date(u.joined_at).toLocaleDateString() : "-",
    Enrollments: u.enrollments_count,
    Books: u.book_access_count,
    Completed: u.completed_enrollments,
    "Spent INR": u.total_spent.inr,
    "Spent USD": u.total_spent.usd,
    "Spent Combined (≈ INR)": u.total_spent.combined_inr,
    Certificates: u.certificates_count,
  };
}

const usersTableColumns = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "joined_at", label: "Joined", format: "date" as const },
  { key: "enrollments_count", label: "Enrollments", align: "right" as const, format: "number" as const },
  { key: "book_access_count", label: "Books", align: "right" as const, format: "number" as const },
  { key: "completed_enrollments", label: "Completed", align: "right" as const, format: "number" as const },
  {
    key: "total_spent",
    label: "Spent",
    align: "right" as const,
    // Multi-currency revenue shown as combined-in-INR with a tooltip
    // revealing the INR vs USD split.
    render: (row: Record<string, unknown>) => {
      const spent = (row as unknown as AnalyticsUserItem).total_spent;
      return <RevenueBreakdownDisplay value={spent} variant="cell" />;
    },
  },
  { key: "certificates_count", label: "Certificates", align: "right" as const, format: "number" as const },
];

export default function UsersAnalyticsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LearnerFilters>({});
  const { data, isLoading } = useAnalyticsUsers(page, search, filters);
  // The payments table carries money, so it is gated on analytics.revenue
  // rather than this page's own analytics.users, hide it rather than 403.
  const canViewRevenue = useHasPermission("analytics.revenue");
  const {
    dateRange: { startDate, endDate, label: dateLabel },
  } = useAnalyticsDateRange();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFiltersChange = useCallback((next: LearnerFilters) => {
    setFilters(next);
    setPage(1);
  }, []);

  // Export pulls the COMPLETE filtered set (not just the visible page) by
  // re-fetching with a high limit + the same active filters.
  const fetchAllForExport = useCallback(async () => {
    const res = await analyticsApi.getUsers(
      startDate,
      endDate,
      1,
      EXPORT_LIMIT,
      search || undefined,
      filters,
    );
    return (res.members ?? []).map(toExportRow);
  }, [startDate, endDate, search, filters]);

  // Graphical Excel report (KPIs + insights + charts) over the full filtered set.
  const buildReport = useCallback(async () => {
    const res = await analyticsApi.getUsers(startDate, endDate, 1, EXPORT_LIMIT, search || undefined, filters);
    const all = res.members ?? [];
    const totalSpend = all.reduce((s, u) => s + (u.total_spent?.combined_inr ?? 0), 0);
    const t = res.total ?? all.length;
    const avg = (sum?: number) => (t > 0 && sum != null ? parseFloat((sum / t).toFixed(1)) : 0);
    const dist = (res.status_distribution ?? []).filter((d) => (d.count ?? 0) > 0);
    const signups = res.daily_signups ?? [];
    const byEnroll = [...all].sort((a, b) => (b.enrollments_count ?? 0) - (a.enrollments_count ?? 0)).slice(0, 10);
    const bySpend = [...all].sort((a, b) => (b.total_spent?.combined_inr ?? 0) - (a.total_spent?.combined_inr ?? 0)).slice(0, 10);

    const charts: ChartSpec[] = [];
    if (signups.length)
      charts.push({ kind: "line", title: "Daily signups", labels: signups.map((s) => s.date), series: [{ name: "Signups", color: REPORT_COLORS.blue, values: signups.map((s) => s.count) }] });
    if (dist.length)
      charts.push({ kind: "donut", title: "Status distribution", segments: dist.map((d) => ({ label: String(d.status ?? "Unknown"), value: d.count ?? 0 })) });
    if (byEnroll.length)
      charts.push({ kind: "bar", title: "Top learners by enrollments", bars: byEnroll.map((u) => ({ label: String(u.name ?? "Unknown"), value: u.enrollments_count ?? 0 })) });
    if (bySpend.some((u) => (u.total_spent?.combined_inr ?? 0) > 0))
      charts.push({ kind: "bar", title: "Top learners by spend (INR eq.)", bars: bySpend.map((u) => ({ label: String(u.name ?? "Unknown"), value: Math.round(u.total_spent?.combined_inr ?? 0) })), valueFormat: formatInr });

    await buildAnalyticsReport({
      fileName: "learners-report",
      title: "Learners report",
      subtitle: dateLabel,
      kpis: [
        { label: "Total learners", value: String(t) },
        { label: "Avg enrollments", value: String(avg(res.sum_enrollments)) },
        { label: "Avg books", value: String(avg(res.sum_books)) },
        { label: "Avg certificates", value: String(avg(res.sum_certificates)) },
        { label: "Total spend (INR eq.)", value: formatInr(totalSpend) },
      ],
      insights: [
        `${all.length} learners in the current view.`,
        bySpend[0] && (bySpend[0].total_spent?.combined_inr ?? 0) > 0
          ? `Top spender: ${bySpend[0].name} (${formatInr(bySpend[0].total_spent?.combined_inr ?? 0)}).`
          : "",
        byEnroll[0] ? `Most enrolled: ${byEnroll[0].name} (${byEnroll[0].enrollments_count} enrollments).` : "",
      ].filter(Boolean),
      charts,
      sheets: [{ name: "Learners", columns: LEARNER_SHEET_COLUMNS, rows: all.map(toExportRow), dataBarColumn: "Spent Combined (≈ INR)" }],
    });
  }, [startDate, endDate, search, filters, dateLabel]);

  const topUsersByEnrollments = useMemo(() => {
    const m = data?.members ?? [];
    const sorted = [...m].sort((a, b) => (b.enrollments_count ?? 0) - (a.enrollments_count ?? 0));
    return sorted.slice(0, 10).map((u) => ({
      date: String(u.name ?? "Unknown").slice(0, 20),
      count: u.enrollments_count ?? 0,
    }));
  }, [data?.members]);

  const topUsersBySpent = useMemo(() => {
    const m = data?.members ?? [];
    // Rank by combined-in-INR so USD + INR spenders are comparable.
    const sorted = [...m].sort(
      (a, b) => (b.total_spent?.combined_inr ?? 0) - (a.total_spent?.combined_inr ?? 0),
    );
    return sorted.slice(0, 10).map((u) => ({
      date: String(u.name ?? "Unknown").slice(0, 20),
      count: u.total_spent?.combined_inr ?? 0,
    }));
  }, [data?.members]);

  const statusDistribution = useMemo(() => {
    const dist = data?.status_distribution ?? [];
    return dist
      .filter((d) => (d.count ?? 0) > 0)
      .map((d) => ({ name: String(d.status ?? "Unknown"), value: d.count ?? 0 }));
  }, [data?.status_distribution]);

  if (isLoading) return <AnalyticsSkeleton />;

  const members = data?.members ?? [];
  const total = data?.total ?? 0;
  const sumEnrollments = data?.sum_enrollments ?? 0;
  const sumBooks = data?.sum_books ?? 0;
  const sumCertificates = data?.sum_certificates ?? 0;

  const avgEnrollments = total > 0 && sumEnrollments != null ? parseFloat((sumEnrollments / total).toFixed(1)) : 0;
  const avgBooks = total > 0 && sumBooks != null ? parseFloat((sumBooks / total).toFixed(1)) : 0;
  const avgCertificates = total > 0 && sumCertificates != null ? parseFloat((sumCertificates / total).toFixed(1)) : 0;

  const exportData = members.map(toExportRow);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Users Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total users
          </p>
        </div>
        <ExportMenu
          data={exportData}
          getData={fetchAllForExport}
          buildReport={{ run: buildReport }}
          fileName="users-analytics"
          sheetName="Users"
        />
      </div>

      {/* Filters, narrow the learner set, then export the full filtered list */}
      <LearnerFilterBar value={filters} onChange={handleFiltersChange} />

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <TrendStat title="Total Users" value={total} icon={Users} />
        <TrendStat title="Avg Enrollments" value={avgEnrollments} icon={GraduationCap} />
        <TrendStat title="Avg Books" value={avgBooks} icon={BookOpen} />
        <TrendStat title="Avg Certificates" value={avgCertificates} icon={Award} />
      </div>

      {/* Student Performance, surfaced high on the page (right under the KPIs)
          so admins reviewing user performance notice it immediately. Filter
          learners by course and see per-learner course/quiz/assignment progress. */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Student Performance</CardTitle>
          </div>
          <CardDescription>
            Course, quiz &amp; assignment progress per learner. Filter by a
            specific course to see only its enrolled students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentPerformanceTable />
        </CardContent>
      </Card>

      {/* Recent successful payments, one row per purchased item, so a cart
          order appears once per line with its own item link. */}
      {canViewRevenue && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Recent Successful Payments</CardTitle>
            </div>
            <CardDescription>
              Completed purchases in this period. Click a buyer to open their
              profile, or an item to open it in the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentPaymentsTable enabled={canViewRevenue} />
          </CardContent>
        </Card>
      )}

      {/* Charts - API-driven */}
      {data?.daily_signups != null && data.daily_signups.length > 0 && (
        <AnalyticsAreaChart
          title="Daily Signups"
          description="User registrations over time"
          data={data.daily_signups}
          dataKey="count"
          name="Signups"
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {statusDistribution.length > 0 && (
          <AnalyticsPieChart
            title="User Status Distribution"
            description="Breakdown by status"
            data={statusDistribution}
          />
        )}
        {topUsersByEnrollments.length > 0 && (
          <AnalyticsBarChart
            title="Top Users by Enrollments"
            description="From current page"
            data={topUsersByEnrollments}
            dataKey="count"
            name="Enrollments"
            layout="vertical"
          />
        )}
        {topUsersBySpent.length > 0 && (
          <AnalyticsBarChart
            title="Top Users by Spent"
            description="From current page"
            data={topUsersBySpent}
            dataKey="count"
            name="Spent (₹)"
            layout="vertical"
          />
        )}
      </div>

      {/* Users table with search and pagination */}
      <AnalyticsDataTable
        columns={usersTableColumns}
        data={members as unknown as Record<string, unknown>[]}
        total={total}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        search={search}
        onSearchChange={handleSearchChange}
        onRowClick={(row) => router.push(`/dashboard/analytics/users/${row.id}`)}
        emptyMessage="No users found"
        searchPlaceholder="Search by name or email..."
      />
    </div>
  );
}
