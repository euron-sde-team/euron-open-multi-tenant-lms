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
import { ChevronLeft, ChevronRight, Clock, Search, Video } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { AnalyticsLineChart } from "@/components/analytics/chart-components";
import { CHART_COLORS } from "@/components/analytics/chart-utils";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsEngagement } from "@/lib/hooks/use-analytics";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m`;
  return `${seconds}s`;
}

export default function EngagementAnalyticsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useAnalyticsEngagement(page, search);
  const {
    dateRange: { label: dateLabel },
  } = useAnalyticsDateRange();

  const engagementChartData = useMemo(() => {
    const watchTime = data?.daily_watch_time ?? [];
    const lectures = data?.daily_lectures ?? [];
    const dateMap = new Map<string, { date: string; seconds: number; lectures: number }>();
    for (const w of watchTime) {
      const d = String(w.date).slice(0, 10);
      dateMap.set(d, { date: d, seconds: w.seconds, lectures: dateMap.get(d)?.lectures ?? 0 });
    }
    for (const l of lectures) {
      const d = String(l.date).slice(0, 10);
      const existing = dateMap.get(d);
      dateMap.set(d, { date: d, seconds: existing?.seconds ?? 0, lectures: l.count });
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data?.daily_watch_time, data?.daily_lectures]);

  // Graphical Excel report (KPIs + engagement trend + top courses) over the loaded set.
  const buildReport = useCallback(async () => {
    if (!data) return;
    const courses = data.items ?? [];
    const trend = engagementChartData;
    const byWatch = [...courses].sort((a, b) => (b.total_seconds ?? 0) - (a.total_seconds ?? 0)).slice(0, 10);

    const charts: ChartSpec[] = [];
    if (trend.length)
      charts.push({
        kind: "line",
        title: "Engagement over time",
        labels: trend.map((d) => d.date),
        series: [
          { name: "Watch time (sec)", color: REPORT_COLORS.blue, values: trend.map((d) => d.seconds) },
          { name: "Lectures completed", color: REPORT_COLORS.emerald, values: trend.map((d) => d.lectures) },
        ],
      });
    if (byWatch.length)
      charts.push({
        kind: "bar",
        title: "Top courses by watch time (hours)",
        bars: byWatch.map((c) => ({
          label: decodeHtmlEntities(c.title ?? "Unknown"),
          value: c.total_watch_time_hours ?? 0,
        })),
      });

    await buildAnalyticsReport({
      fileName: "engagement-analytics-report",
      title: "Engagement analytics report",
      subtitle: dateLabel,
      kpis: [
        { label: "Total watch time (sec)", value: (data.total_watch_time_seconds ?? 0).toLocaleString() },
        { label: "Lectures completed", value: (data.lectures_completed ?? 0).toLocaleString() },
        { label: "Active learners", value: (data.active_learners ?? 0).toLocaleString() },
        { label: "Avg time per user (sec)", value: (data.avg_watch_time_per_user_seconds ?? 0).toLocaleString() },
      ],
      charts,
      sheets: [
        {
          name: "Watch Time",
          columns: [
            { header: "Course", key: "Course", width: 30 },
            { header: "Watch Time (hours)", key: "Watch Time (hours)", width: 18, numFmt: "#,##0" },
            { header: "Completed Lectures", key: "Completed Lectures", width: 18, numFmt: "#,##0" },
            { header: "Active Learners", key: "Active Learners", width: 16, numFmt: "#,##0" },
            { header: "Avg Time per Learner (sec)", key: "Avg Time per Learner (sec)", width: 24, numFmt: "#,##0" },
          ],
          rows: courses.map((c) => ({
            Course: decodeHtmlEntities(c.title ?? "Unknown"),
            "Watch Time (hours)": c.total_watch_time_hours,
            "Completed Lectures": c.completed_lectures,
            "Active Learners": c.active_learners,
            "Avg Time per Learner (sec)": c.avg_time_per_learner_seconds,
          })),
          dataBarColumn: "Watch Time (hours)",
        },
      ],
    });
  }, [data, engagementChartData, dateLabel]);

  if (isLoading) return <AnalyticsSkeleton />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const exportData = items.map((c) => ({
    Course: c.title,
    "Watch Time (hours)": c.total_watch_time_hours,
    "Completed Lectures": c.completed_lectures,
    "Active Learners": c.active_learners,
    "Avg Time per Learner (sec)": c.avg_time_per_learner_seconds,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6" />
            Engagement Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Watch time and lecture completion by course
          </p>
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="engagement-analytics"
          sheetName="Watch Time"
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Watch Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(data?.total_watch_time_seconds ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lectures Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.lectures_completed ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Learners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.active_learners ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Time per User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(data?.avg_watch_time_per_user_seconds ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      {engagementChartData.length > 0 && (
        <AnalyticsLineChart
          title="Engagement Over Time"
          description="Watch time and lectures completed per day"
          data={engagementChartData}
          lines={[
            { dataKey: "seconds", name: "Watch Time (sec)", color: CHART_COLORS[0], yAxisId: "left" },
            { dataKey: "lectures", name: "Lectures Completed", color: CHART_COLORS[1], yAxisId: "right" },
          ]}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Watch Time by Course</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Course</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Watch Time</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Lectures Completed</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Active Learners</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Avg per Learner</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No watch time data found
                    </td>
                  </tr>
                ) : (
                  items.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="max-w-[250px] truncate px-4 py-3 font-medium" title={c.title}>
                        {c.title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{formatDuration(c.total_seconds)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{c.completed_lectures}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{c.active_learners}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{formatDuration(c.avg_time_per_learner_seconds)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {items.length} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm font-medium">Page {page}</span>
            <Button size="sm" variant="outline" disabled={items.length < 20} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
