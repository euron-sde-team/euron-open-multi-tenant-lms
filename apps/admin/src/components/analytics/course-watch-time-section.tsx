"use client";

/**
 * Watch time section for the per-course analytics page.
 *
 * Pulls from rollup-driven endpoint /analytics/courses/:courseId/watch-time.
 * Renders 4 sub-views:
 *   - 4 KPI cards (total hours, sessions, unique learners, avg completion)
 *   - Daily watch hours area chart (date-range aware)
 *   - Per-lecture bar chart (top lectures by watch hours)
 *   - Drop-off curve (per-lecture, focused on the lecture user clicks)
 *   - Top viewers table (last 90 days hot window)
 *
 * Loading & empty states are localized so the parent page doesn't need to
 * branch.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";
import { Clock, Users, Video, BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";

import { AnalyticsAreaChart, AnalyticsBarChart, AnalyticsLineChart } from "./chart-components";
import { useCourseWatchTime } from "@/lib/hooks/use-analytics";

function formatHours(seconds: number): string {
  if (!seconds || seconds <= 0) return "0h";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface KPICardProps {
  label: string;
  value: string;
  Icon: typeof Clock;
  hint?: string;
}

function KPICard({ label, value, Icon, hint }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs">{label}</CardDescription>
          <Icon className="text-muted-foreground h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function CourseWatchTimeSection({ courseId }: { courseId: string }) {
  const { data, isLoading, error } = useCourseWatchTime(courseId);
  const [focusedLectureId, setFocusedLectureId] = useState<string | null>(null);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        totalSeconds: 0,
        totalSessions: 0,
        peakLearners: 0,
        avgCompletion: 0,
      };
    }
    let totalSeconds = 0;
    let totalSessions = 0;
    let peakLearners = 0;
    let avgCompletionSum = 0;
    for (const l of data.perLecture) {
      totalSeconds += l.total_seconds;
      totalSessions += l.sessions_count;
      if (l.max_daily_members > peakLearners) peakLearners = l.max_daily_members;
      avgCompletionSum += l.avg_completion_pct;
    }
    return {
      totalSeconds,
      totalSessions,
      peakLearners,
      avgCompletion: data.perLecture.length > 0
        ? Math.round(avgCompletionSum / data.perLecture.length)
        : 0,
    };
  }, [data]);

  const focusedLecture = useMemo(() => {
    if (!data) return null;
    if (focusedLectureId) {
      const found = data.perLecture.find((l) => l.lecture_id === focusedLectureId);
      if (found) return found;
    }
    return data.perLecture[0] ?? null;
  }, [data, focusedLectureId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading watch-time data…
        </CardContent>
      </Card>
    );
  }

  // Surface API errors explicitly, most common cause is the migration not
  // being applied yet (missing tables/columns → 500), or the role missing
  // analytics.engagement (→ 403). Without this, the section silently shows
  // the empty state and admins can't tell why.
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Watch time</CardTitle>
          <CardDescription>How learners are watching this course</CardDescription>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Couldn&apos;t load watch-time data: {error instanceof Error ? error.message : String(error)}
          <div className="mt-2 text-xs">
            If this is the first deploy, confirm the migration at{" "}
            <code>docs/migrations/lecture-watch-tracking.sql</code> has been applied.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.perLecture.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Watch time</CardTitle>
          <CardDescription>How learners are watching this course</CardDescription>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No watch-time data yet. Data appears within an hour of the first lecture being watched.
        </CardContent>
      </Card>
    );
  }

  const dailySeries = data.dailyWatchHours.map((d) => ({
    date: d.date,
    count: Math.round((d.seconds / 3600) * 100) / 100, // hours, 2-decimal
  }));

  const perLectureSeries = data.perLecture.slice(0, 10).map((l) => ({
    date: l.title ?? l.lecture_id,
    count: l.total_hours,
  }));

  const dropoffSeries = focusedLecture
    ? focusedLecture.dropoff.map((b) => ({
        date: `${b.bucket * 10}-${b.bucket * 10 + 10}%`,
        count: b.sessions,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Watch time</h2>
        <p className="text-muted-foreground text-sm">
          Real-engagement metrics from lecture playback sessions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Total Watch Hours"
          value={formatHours(kpis.totalSeconds)}
          Icon={Clock}
          hint="Including re-watches"
        />
        <KPICard
          label="Total Sessions"
          value={kpis.totalSessions.toLocaleString()}
          Icon={Video}
          hint="Distinct play→end cycles"
        />
        <KPICard
          label="Peak Daily Learners"
          value={kpis.peakLearners.toLocaleString()}
          Icon={Users}
          hint="Max single-day distinct watchers"
        />
        <KPICard
          label="Avg Completion %"
          value={`${kpis.avgCompletion}%`}
          Icon={BarChart3}
          hint="Across all lectures"
        />
      </div>

      {dailySeries.length > 0 && (
        <AnalyticsAreaChart
          title="Daily watch hours"
          description="Hours of real playback per day"
          data={dailySeries}
          dataKey="count"
          name="Hours"
          height={240}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsBarChart
          title="Top lectures by watch hours"
          description="Click a lecture below to see its drop-off curve"
          data={perLectureSeries}
          dataKey="count"
          name="Hours"
          height={Math.max(180, perLectureSeries.length * 32)}
        />

        {focusedLecture && (
          <AnalyticsLineChart
            title={`Drop-off, ${focusedLecture.title ?? "Lecture"}`}
            description="All-time drop-off across last 90 days of sessions (not date-filtered). Sessions ending in each 10% bucket of the lecture."
            data={dropoffSeries}
            dataKey="count"
            name="Sessions"
            height={Math.max(180, perLectureSeries.length * 32)}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-lecture breakdown</CardTitle>
          <CardDescription>Click a row to focus its drop-off curve above.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Lecture</th>
                <th className="px-4 py-2 text-right">Watch hours</th>
                <th className="px-4 py-2 text-right">Sessions</th>
                <th className="px-4 py-2 text-right">Avg completion</th>
              </tr>
            </thead>
            <tbody>
              {data.perLecture.map((l) => {
                const isFocused = focusedLecture?.lecture_id === l.lecture_id;
                return (
                  <tr
                    key={l.lecture_id}
                    onClick={() => setFocusedLectureId(l.lecture_id)}
                    className={`cursor-pointer border-t hover:bg-muted/30 ${isFocused ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-2">{l.title ?? l.lecture_id}</td>
                    <td className="px-4 py-2 text-right">{l.total_hours.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{l.sessions_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{l.avg_completion_pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data.topViewers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top viewers (last 90 days)</CardTitle>
            <CardDescription>Members who watched the most for this course.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-right">Watch hours</th>
                  <th className="px-4 py-2 text-right">Lectures touched</th>
                </tr>
              </thead>
              <tbody>
                {data.topViewers.map((v) => (
                  <tr key={v.member_id} className="border-t">
                    <td className="px-4 py-2">{v.member_name ?? "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{v.member_email ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{v.total_hours.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{v.lectures_touched.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
