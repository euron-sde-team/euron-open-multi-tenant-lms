"use client";

/**
 * Watch time section for the per-user analytics page.
 *
 * Pulls from /analytics/users/:userId/watch-time. Renders:
 *   - Total watch hours + courses-watched KPI cards
 *   - Watch hours by course (bar chart, top 10)
 *   - Recent sessions table
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";
import { Clock, Library } from "lucide-react";
import { useMemo } from "react";

import { AnalyticsBarChart } from "./chart-components";
import { useMemberWatchTime } from "@/lib/hooks/use-analytics";

function formatHours(seconds: number): string {
  if (!seconds || seconds <= 0) return "0h";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatRelative(iso: string): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diff = Date.now() - t;
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < day) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

export function MemberWatchTimeSection({ userId }: { userId: string }) {
  const { data, isLoading, error } = useMemberWatchTime(userId);

  const totalSeconds = useMemo(() => {
    if (!data) return 0;
    return data.perCourse.reduce((sum, c) => sum + c.total_seconds, 0);
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Loading watch-time data…
        </CardContent>
      </Card>
    );
  }
  // Surface API errors explicitly, most common cause is the migration not
  // being applied yet (missing tables/columns → 500), or the role missing
  // analytics.users (→ 403). Without this, the section silently shows the
  // empty state and admins can't tell why.
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Watch time</CardTitle>
          <CardDescription>How this learner is spending time across courses</CardDescription>
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
  // Always render the section header even when empty, admins need to
  // discover that the feature exists before any data has been produced.
  if (!data || (data.perCourse.length === 0 && data.recentSessions.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Watch time</CardTitle>
          <CardDescription>How this learner is spending time across courses</CardDescription>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No watch-time data yet for this learner. Data appears within an hour of their first
          lecture playback (or sooner once the rollup job ticks).
        </CardContent>
      </Card>
    );
  }

  const perCourseSeries = data.perCourse.slice(0, 10).map((c) => ({
    date: c.title ?? c.course_id,
    count: c.total_hours,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Watch time</h2>
        <p className="text-muted-foreground text-sm">
          How this learner is spending time across courses (last 90 days hot window).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Total watch hours</CardDescription>
              <Clock className="text-muted-foreground h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totalSeconds)}</div>
            <p className="text-muted-foreground mt-1 text-xs">Across all courses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Courses watched</CardDescription>
              <Library className="text-muted-foreground h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.perCourse.length.toLocaleString()}</div>
            <p className="text-muted-foreground mt-1 text-xs">With at least one session</p>
          </CardContent>
        </Card>
      </div>

      {perCourseSeries.length > 0 && (
        <AnalyticsBarChart
          title="Watch hours by course"
          description="Top 10 courses by total real watch time"
          data={perCourseSeries}
          dataKey="count"
          name="Hours"
          height={Math.max(200, perCourseSeries.length * 32)}
        />
      )}

      {data.recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent sessions</CardTitle>
            <CardDescription>Most recent playback sessions for this learner.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Course</th>
                  <th className="px-4 py-2 text-left">Lecture</th>
                  <th className="px-4 py-2 text-right">Watched</th>
                  <th className="px-4 py-2 text-right">Last position</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSessions.map((s) => (
                  <tr key={s.session_id} className="border-t">
                    <td className="text-muted-foreground px-4 py-2 text-xs">
                      {formatRelative(s.last_heartbeat_at)}
                    </td>
                    <td className="px-4 py-2">{s.course_title ?? s.course_id}</td>
                    <td className="px-4 py-2">{s.lecture_title ?? s.lecture_id}</td>
                    <td className="px-4 py-2 text-right">{formatHours(s.seconds_watched)}</td>
                    <td className="px-4 py-2 text-right">{formatHours(s.end_position)}</td>
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
