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
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Search,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { useAnalyticsQuizzes } from "@/lib/hooks/use-analytics";

export default function QuizzesAnalyticsPage() {
  const router = useRouter();
  const { dateRange } = useAnalyticsDateRange();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { data, isLoading } = useAnalyticsQuizzes(page, search);

  const quizzes = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;
  const dailyAttempts = useMemo(() => data?.daily_attempts ?? [], [data?.daily_attempts]);

  const totalAttempts = quizzes.reduce((s, q) => s + (q.attempt_count ?? 0), 0);
  const totalPassed = quizzes.reduce((s, q) => s + (q.passed ?? 0), 0);
  const totalFailed = quizzes.reduce((s, q) => s + (q.failed ?? 0), 0);
  const overallPassRate = totalAttempts > 0 ? ((totalPassed / totalAttempts) * 100).toFixed(1) : "0";

  const passedVsFailedPieData = useMemo(() => {
    const items: Array<{ name: string; value: number }> = [];
    if (totalPassed > 0) items.push({ name: "Passed", value: totalPassed });
    if (totalFailed > 0) items.push({ name: "Failed", value: totalFailed });
    return items;
  }, [totalPassed, totalFailed]);

  const cumulativeAttempts = useMemo(() => {
    let cum = 0;
    return dailyAttempts.map((d) => {
      cum += d.count ?? 0;
      return { date: d.date, count: cum };
    });
  }, [dailyAttempts]);

  const topQuizzesByAttemptsData = useMemo(() => {
    return quizzes.slice(0, 10).map((q) => ({
      date: String(q.title ?? "Unknown").slice(0, 25),
      count: q.attempt_count ?? 0,
    }));
  }, [quizzes]);

  const summaryComparisonData = useMemo(() => {
    return [
      { date: "Quizzes", count: total },
      { date: "Attempts", count: totalAttempts },
      { date: "Passed", count: totalPassed },
      { date: "Failed", count: totalFailed },
    ];
  }, [total, totalAttempts, totalPassed, totalFailed]);

  const exportData = quizzes.map((q) => ({
    Title: q.title ?? "",
    Course: q.course_title ?? "",
    Attempts: q.attempt_count ?? 0,
    "Avg Score": (q.avg_score ?? 0).toFixed(1),
    Passed: q.passed ?? 0,
    Failed: q.failed ?? 0,
    "Pass Rate (%)": (q.pass_rate ?? 0).toFixed(1),
  }));

  // Graphical Excel report (KPIs + charts) over the current quiz set.
  const buildReport = useCallback(async () => {
    const exportRows = quizzes.map((q) => ({
      Title: decodeHtmlEntities(q.title ?? ""),
      Course: decodeHtmlEntities(q.course_title ?? ""),
      Attempts: q.attempt_count ?? 0,
      "Avg Score": Number((q.avg_score ?? 0).toFixed(1)),
      Passed: q.passed ?? 0,
      Failed: q.failed ?? 0,
      "Pass Rate (%)": Number((q.pass_rate ?? 0).toFixed(1)),
    }));

    const charts: ChartSpec[] = [];
    if (passedVsFailedPieData.length)
      charts.push({
        kind: "donut",
        title: "Passed vs failed",
        segments: passedVsFailedPieData.map((d) => ({ label: d.name, value: d.value })),
      });
    if (dailyAttempts.length)
      charts.push({
        kind: "line",
        title: "Daily quiz attempts",
        labels: dailyAttempts.map((d) => d.date),
        series: [{ name: "Attempts", color: REPORT_COLORS.blue, values: dailyAttempts.map((d) => d.count ?? 0) }],
      });
    if (topQuizzesByAttemptsData.length)
      charts.push({
        kind: "bar",
        title: "Top quizzes by attempts",
        bars: topQuizzesByAttemptsData.map((d) => ({ label: decodeHtmlEntities(d.date), value: d.count })),
      });

    await buildAnalyticsReport({
      fileName: "quizzes-report",
      title: "Quizzes report",
      subtitle: dateRange?.label,
      kpis: [
        { label: "Total quizzes", value: String(total) },
        { label: "Total attempts", value: String(totalAttempts) },
        { label: "Passed", value: String(totalPassed) },
        { label: "Failed", value: String(totalFailed) },
        { label: "Pass rate", value: `${overallPassRate}%` },
      ],
      charts,
      sheets: [
        {
          name: "Quizzes",
          columns: [
            { header: "Title", key: "Title", width: 28 },
            { header: "Course", key: "Course", width: 28 },
            { header: "Attempts", key: "Attempts", width: 12, numFmt: "#,##0" },
            { header: "Avg Score", key: "Avg Score", width: 12, numFmt: "#,##0.0" },
            { header: "Passed", key: "Passed", width: 10, numFmt: "#,##0" },
            { header: "Failed", key: "Failed", width: 10, numFmt: "#,##0" },
            { header: "Pass Rate (%)", key: "Pass Rate (%)", width: 14, numFmt: "#,##0.0" },
          ],
          rows: exportRows,
          dataBarColumn: "Attempts",
        },
      ],
    });
  }, [
    quizzes,
    passedVsFailedPieData,
    dailyAttempts,
    topQuizzesByAttemptsData,
    dateRange?.label,
    total,
    totalAttempts,
    totalPassed,
    totalFailed,
    overallPassRate,
  ]);

  const totalPages = total === 0 ? 1 : Math.ceil(total / 20);

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data) return <p className="text-sm text-muted-foreground py-10 text-center">No quiz data available</p>;

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
            <ClipboardCheck className="h-6 w-6" />
            Quizzes Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} quizzes total
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
          fileName="quizzes-analytics"
          sheetName="Quizzes"
        />
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAttempts.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <ThumbsUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalPassed.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <ThumbsDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalFailed.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallPassRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAttempts > 0 ? "Overall pass rate" : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Passed vs Failed pie */}
      {passedVsFailedPieData.length > 0 && (
        <AnalyticsPieChart
          title="Passed vs Failed"
          description="Quiz attempt outcomes distribution"
          data={passedVsFailedPieData}
          height={260}
        />
      )}

      {/* Summary comparison bar */}
      {(total > 0 || totalAttempts > 0 || totalPassed > 0 || totalFailed > 0) && (
        <AnalyticsBarChart
          title="Quizzes Overview"
          description="Total quizzes, attempts, passed, and failed"
          data={summaryComparisonData}
          dataKey="count"
          name="Count"
          layout="vertical"
          height={200}
        />
      )}

      {/* Daily Attempts - Line chart */}
      <AnalyticsLineChart
        title="Daily Quiz Attempts"
        description="Quiz attempts over time"
        data={dailyAttempts}
        dataKey="count"
        name="Attempts"
        height={280}
      />

      {/* Cumulative Attempts - Area chart */}
      {cumulativeAttempts.length > 0 && (
        <AnalyticsAreaChart
          title="Cumulative Quiz Attempts"
          description="Running total of attempts in selected period"
          data={cumulativeAttempts}
          dataKey="count"
          name="Cumulative"
          height={280}
          color={CHART_COLORS[1]}
        />
      )}

      {/* Top Quizzes by Attempts - Bar chart */}
      {topQuizzesByAttemptsData.length > 0 && (
        <AnalyticsBarChart
          title="Top Quizzes by Attempts"
          description="Most attempted quizzes"
          data={topQuizzesByAttemptsData}
          dataKey="count"
          name="Attempts"
          layout="vertical"
          height={Math.min(400, 120 + topQuizzesByAttemptsData.length * 36)}
        />
      )}

      {/* Quizzes table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quizzes</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search quizzes..."
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
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Title</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Course</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Attempts</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Avg Score</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Passed</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Failed</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No quizzes found
                    </td>
                  </tr>
                ) : (
                  quizzes.map((q) => (
                    <tr
                      key={q.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/dashboard/analytics/quizzes-analytics/${q.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/dashboard/analytics/quizzes-analytics/${q.id}`);
                        }
                      }}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="max-w-[180px] truncate px-4 py-3 font-medium" title={q.title ?? ""}>
                        {q.title ?? "-"}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground" title={q.course_title ?? ""}>
                        {q.course_title ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{q.attempt_count ?? 0}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{(q.avg_score ?? 0).toFixed(1)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-600">{q.passed ?? 0}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-red-600">{q.failed ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${Math.min(q.pass_rate ?? 0, 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs text-muted-foreground">
                            {(q.pass_rate ?? 0).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? "No quizzes"
                : `Showing ${(page - 1) * 20 + 1} to ${Math.min(page * 20, total)} of ${total}`}
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
              <span className="text-sm font-medium">Page {page} of {totalPages}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
