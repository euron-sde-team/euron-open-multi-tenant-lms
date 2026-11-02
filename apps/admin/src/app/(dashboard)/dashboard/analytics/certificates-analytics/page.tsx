"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import {
  Award,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Search,
  ShieldCheck,
  ShieldX,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { CHART_COLORS } from "@/components/analytics/chart-utils";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import {
  useAnalyticsCertificateDetails,
  useAnalyticsCertificates,
  useAnalyticsOverview,
} from "@/lib/hooks/use-analytics";

export default function CertificatesAnalyticsPage() {
  const { dateRange } = useAnalyticsDateRange();
  const { data: overviewData } = useAnalyticsOverview();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { data, isLoading } = useAnalyticsCertificates(page, search);

  const [detailsPage, setDetailsPage] = useState(1);
  const [detailsSearch, setDetailsSearch] = useState("");
  const [detailsSearchInput, setDetailsSearchInput] = useState("");
  const { data: detailsData, isLoading: detailsLoading } = useAnalyticsCertificateDetails(
    detailsPage,
    detailsSearch
  );

  const total = data?.total ?? 0;
  const issued = data?.issued ?? 0;
  const revoked = data?.revoked ?? 0;
  const byCourse = useMemo(() => data?.by_course ?? [], [data?.by_course]);
  const byCourseTotal = data?.by_course_total ?? 0;
  const dailyIssued = useMemo(() => data?.daily_issued ?? [], [data?.daily_issued]);

  const statusDistribution = useMemo(() => {
    const items: Array<{ name: string; value: number }> = [];
    if (issued > 0) items.push({ name: "Issued", value: issued });
    if (revoked > 0) items.push({ name: "Revoked", value: revoked });
    return items;
  }, [issued, revoked]);

  const cumulativeIssued = useMemo(() => {
    let cum = 0;
    return dailyIssued.map((d) => {
      cum += d.count ?? 0;
      return { date: d.date, count: cum };
    });
  }, [dailyIssued]);

  const topCoursesChartData = useMemo(() => {
    return byCourse.slice(0, 10).map((c) => ({
      date: String(c.title ?? "Unknown").slice(0, 30),
      count: c.count ?? 0,
    }));
  }, [byCourse]);

  const totalEnrollments = overviewData?.total_enrollments ?? 0;
  const enrollmentsVsCertificatesChartData = useMemo(() => {
    return [
      { date: "Enrollments", count: totalEnrollments },
      { date: "Certificates Issued", count: issued },
    ];
  }, [totalEnrollments, issued]);

  const exportData = byCourse.map((c) => ({
    Course: decodeHtmlEntities(c.title ?? ""),
    "Certificates Issued": c.count ?? 0,
  }));

  // Graphical Excel report (KPIs + charts) for certificate issuance.
  const reportSubtitle =
    dateRange?.label ??
    (dateRange?.startDate && dateRange?.endDate
      ? `${new Date(dateRange.startDate).toLocaleDateString()} – ${new Date(dateRange.endDate).toLocaleDateString()}`
      : undefined);
  const buildReport = useCallback(async () => {
    const completionRate =
      totalEnrollments > 0 ? `${((issued / totalEnrollments) * 100).toFixed(1)}%` : "-";

    const charts: ChartSpec[] = [];
    if (statusDistribution.length)
      charts.push({
        kind: "donut",
        title: "Status distribution",
        segments: statusDistribution.map((d) => ({
          label: d.name,
          value: d.value,
          color: d.name === "Revoked" ? REPORT_COLORS.red : REPORT_COLORS.emerald,
        })),
      });
    if (totalEnrollments > 0 || issued > 0)
      charts.push({
        kind: "bar",
        title: "Enrollments vs certificates issued",
        bars: enrollmentsVsCertificatesChartData.map((d) => ({ label: d.date, value: d.count })),
      });
    if (dailyIssued.length)
      charts.push({
        kind: "line",
        title: "Daily certificates issued",
        labels: dailyIssued.map((d) => d.date),
        series: [
          {
            name: "Issued",
            color: REPORT_COLORS.blue,
            values: dailyIssued.map((d) => d.count ?? 0),
          },
        ],
      });
    if (cumulativeIssued.length)
      charts.push({
        kind: "line",
        title: "Cumulative certificates issued",
        labels: cumulativeIssued.map((d) => d.date),
        series: [
          {
            name: "Cumulative",
            color: REPORT_COLORS.violet,
            values: cumulativeIssued.map((d) => d.count),
          },
        ],
      });
    if (topCoursesChartData.length)
      charts.push({
        kind: "bar",
        title: "Top certificates by course",
        bars: topCoursesChartData.map((c) => ({ label: c.date, value: c.count })),
      });

    await buildAnalyticsReport({
      fileName: "certificates-report",
      title: "Certificates report",
      subtitle: reportSubtitle,
      kpis: [
        { label: "Total certificates", value: String(total) },
        { label: "Issued", value: String(issued) },
        { label: "Revoked", value: String(revoked) },
        { label: "Course enrollments", value: String(totalEnrollments) },
        { label: "Completion rate", value: completionRate },
      ],
      charts,
      sheets: [
        {
          name: "Certificates by course",
          columns: [
            { header: "Course", key: "Course", width: 40 },
            { header: "Certificates Issued", key: "Certificates Issued", width: 18, numFmt: "#,##0" },
          ],
          rows: byCourse.map((c) => ({
            Course: decodeHtmlEntities(c.title ?? ""),
            "Certificates Issued": c.count ?? 0,
          })),
          dataBarColumn: "Certificates Issued",
        },
      ],
    });
  }, [
    total,
    issued,
    revoked,
    totalEnrollments,
    byCourse,
    statusDistribution,
    dailyIssued,
    cumulativeIssued,
    topCoursesChartData,
    enrollmentsVsCertificatesChartData,
    reportSubtitle,
  ]);

  const detailsItems = detailsData?.items ?? [];
  const detailsTotal = detailsData?.total ?? 0;
  const detailsLimit = 20;
  const detailsTotalPages = detailsTotal === 0 ? 1 : Math.ceil(detailsTotal / detailsLimit);
  const byCourseTotalPages = byCourseTotal === 0 ? 1 : Math.ceil(byCourseTotal / 20);
  const detailsExportData = detailsItems.map((d) => ({
    Member: d.member_name ?? "-",
    Email: d.member_email ?? "-",
    Course: d.course_title ?? "-",
    Status: d.status ?? "-",
    "Issued At": d.issued_at ? new Date(d.issued_at).toLocaleString() : "-",
    "Revoked At": d.revoked_at ? new Date(d.revoked_at).toLocaleString() : "-",
  }));

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data) return <p className="text-sm text-muted-foreground py-10 text-center">No certificate data available</p>;

  const filterLabel =
    dateRange?.label ??
    (dateRange?.startDate && dateRange?.endDate
      ? `${new Date(dateRange.startDate).toLocaleDateString()} – ${new Date(dateRange.endDate).toLocaleDateString()}`
      : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6" />
            Certificates Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Certificate issuance overview and insights
          </p>
          {filterLabel && (
            <p className="text-xs text-muted-foreground mt-1">
              Date range: {filterLabel}
            </p>
          )}
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="certificates-analytics"
          sheetName="Certificates"
        />
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Certificates</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Issued</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{issued.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revoked</CardTitle>
            <ShieldX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{revoked.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments vs Certificates Issued */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Courses Enrolled</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnrollments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total course enrollments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Certificates Issued</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{issued.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalEnrollments > 0
                ? `${((issued / totalEnrollments) * 100).toFixed(1)}% completion rate`
                : "Certificates issued"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments vs Certificates bar chart */}
      {(totalEnrollments > 0 || issued > 0) && (
        <AnalyticsBarChart
          title="Enrollments vs Certificates Issued"
          description="Total course enrollments compared to certificates issued"
          data={enrollmentsVsCertificatesChartData}
          dataKey="count"
          name="Count"
          layout="vertical"
          height={180}
        />
      )}

      {/* Status distribution pie chart */}
      {statusDistribution.length > 0 && (
        <AnalyticsPieChart
          title="Status Distribution"
          description="Issued vs revoked certificates"
          data={statusDistribution}
          height={260}
        />
      )}

      {/* Daily issued - Line chart */}
      <AnalyticsLineChart
        title="Daily Certificates Issued"
        description="Certificates issued over time"
        data={dailyIssued}
        dataKey="count"
        name="Issued"
        height={280}
      />

      {/* Cumulative issued - Area chart */}
      {cumulativeIssued.length > 0 && (
        <AnalyticsAreaChart
          title="Cumulative Certificates Issued"
          description="Running total of certificates issued in selected period"
          data={cumulativeIssued}
          dataKey="count"
          name="Cumulative"
          height={280}
          color={CHART_COLORS[1]}
        />
      )}

      {/* Top courses by certificates - Bar chart */}
      {topCoursesChartData.length > 0 && (
        <AnalyticsBarChart
          title="Top Certificates by Course"
          description="Courses with most certificates issued"
          data={topCoursesChartData}
          dataKey="count"
          name="Certificates"
          layout="vertical"
          height={Math.min(400, 120 + topCoursesChartData.length * 36)}
        />
      )}

      {/* Certificates by Course table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Certificates by Course</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 pt-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSearch(searchInput);
                      setPage(1);
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch(searchInput);
                  setPage(1);
                }}
              >
                Search
              </Button>
              {search && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Course</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Certificates</th>
                </tr>
              </thead>
              <tbody>
                {byCourse.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-10 text-center text-muted-foreground">
                      No certificates issued yet
                    </td>
                  </tr>
                ) : (
                  byCourse.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="max-w-[350px] truncate px-4 py-3 font-medium" title={c.title ?? ""}>
                        {c.title ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{c.count ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {byCourse.length} of {byCourseTotal}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm font-medium">Page {page} of {byCourseTotalPages}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= byCourseTotalPages}
                onClick={() => setPage((p) => Math.min(byCourseTotalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificates by User */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Certificates by User
            </CardTitle>
            <ExportMenu
              data={detailsExportData}
              fileName="certificate-details"
              sheetName="Certificates by User"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Individual certificates with member name and course
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by member or course..."
                value={detailsSearchInput}
                onChange={(e) => setDetailsSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setDetailsSearch(detailsSearchInput);
                    setDetailsPage(1);
                  }
                }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDetailsSearch(detailsSearchInput);
                  setDetailsPage(1);
                }}
              >
                Search
              </Button>
              {detailsSearch && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDetailsSearch("");
                    setDetailsSearchInput("");
                    setDetailsPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          {detailsLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Member</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Email</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Course</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Issued At</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Revoked At</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        No certificates found
                      </td>
                    </tr>
                  ) : (
                    detailsItems.map((d) => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{d.member_name ?? "-"}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground" title={d.member_email ?? ""}>
                          {d.member_email ?? "-"}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3" title={d.course_title ?? ""}>
                          {d.course_title ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              d.status === "ISSUED"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {d.status ?? "-"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {d.issued_at ? new Date(d.issued_at).toLocaleDateString() : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {d.revoked_at ? new Date(d.revoked_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {detailsItems.length} of {detailsTotal}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={detailsPage <= 1}
                onClick={() => setDetailsPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm font-medium">Page {detailsPage} of {detailsTotalPages}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={detailsPage >= detailsTotalPages}
                onClick={() => setDetailsPage((p) => Math.min(detailsTotalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
