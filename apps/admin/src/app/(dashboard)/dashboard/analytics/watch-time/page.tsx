"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import {
  Activity,
  Clock,
  Film,
  GraduationCap,
  Info,
  PlayCircle,
  Users,
} from "lucide-react";
import Link from "next/link";

import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
} from "@/components/analytics/chart-components";
import {
  AnalyticsSkeleton,
  formatTimeAgo,
  StatCard,
} from "@/components/analytics/shared";
import { useWatchTimeOverview } from "@/lib/hooks/use-analytics";

function formatHours(seconds: number): string {
  if (!seconds || seconds <= 0) return "0h";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function WatchTimeAnalyticsPage() {
  const { data, isLoading, error } = useWatchTimeOverview();

  if (isLoading) return <AnalyticsSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <PlayCircle className="h-6 w-6" />
            Video Watch Analytics
          </h1>
        </div>
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load watch-time data: {error instanceof Error ? error.message : String(error)}
            <div className="mt-2 text-xs">
              If this is the first deploy, confirm the migration at{" "}
              <code>docs/migrations/lecture-watch-tracking.sql</code> has been applied.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = data?.summary;
  const dailyHours = data?.dailyWatchHours ?? [];
  const topCourses = data?.topCourses ?? [];
  const topViewers = data?.topViewers ?? [];
  const topLectures = data?.topLectures ?? [];
  const meta = data?.meta;
  // Show the empty-state banner only when the backend explicitly tells us
  // there's no data yet. Older backends won't return `meta`, skip the
  // banner there so we don't false-positive on a healthy dashboard.
  const showEmptyStateBanner = meta != null && meta.hasAnyData === false;

  // Bar-chart data shape, date/count is the convention used by AnalyticsBarChart.
  const dailyChart = dailyHours.map((d) => ({ date: d.date, count: d.hours }));
  const courseChart = topCourses.slice(0, 10).map((c) => ({
    date: c.title ?? c.course_id,
    count: c.total_hours,
  }));
  const lectureChart = topLectures.slice(0, 10).map((l) => ({
    date: l.title ?? l.lecture_id,
    count: l.total_hours,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <PlayCircle className="h-6 w-6" />
            Video Watch Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Real video watch time across your platform, sourced from the lecture-watch tracking system.
          </p>
        </div>
      </div>

      {/* Empty-state banner, distinguishes "feature just shipped, no data
          yet" from "feature broken / migration not applied". Renders above
          the (zeroed) KPI cards so admins still see the dashboard layout. */}
      {showEmptyStateBanner && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                No watch data yet
              </p>
              <p className="text-blue-800/80 dark:text-blue-200/80">
                Heartbeats from learners are aggregated hourly. The first data
                appears within an hour of the first lecture being watched.
                {meta?.lastRollupAt ? (
                  <>
                    {" "}Last rollup tick:{" "}
                    <span className="font-mono text-xs">
                      {formatTimeAgo(meta.lastRollupAt)}
                    </span>
                    .
                  </>
                ) : (
                  <> The rollup job has not run for this tenant yet.</>
                )}
              </p>
              <p className="text-xs text-blue-800/60 dark:text-blue-200/60">
                If this persists for more than 24 hours, confirm the migration
                at <code>docs/migrations/lecture-watch-tracking.sql</code> has
                been applied and the learner-api&apos;s watch-time worker is
                running.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary KPI cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Watch Time"
          value={formatHours(summary?.total_seconds ?? 0)}
          icon={Clock}
          subtitle={`${(summary?.sessions_count ?? 0).toLocaleString()} sessions`}
        />
        <StatCard
          title="Active Learners"
          value={(summary?.active_learners ?? 0).toLocaleString()}
          icon={Users}
          subtitle={`Avg ${formatHours(summary?.avg_seconds_per_learner ?? 0)} / learner`}
        />
        <StatCard
          title="Lectures Touched"
          value={(summary?.lectures_touched ?? 0).toLocaleString()}
          icon={Film}
          subtitle="Distinct lectures with at least one play"
        />
        <StatCard
          title="Avg Completion"
          value={`${(summary?.avg_completion_pct ?? 0).toFixed(1)}%`}
          icon={Activity}
          subtitle="Across all lectures in window"
        />
      </div>

      {/* Daily watch hours trend */}
      {dailyChart.length > 0 ? (
        <AnalyticsAreaChart
          title="Daily Watch Hours"
          description="Total real video watch time per day"
          data={dailyChart}
          dataKey="count"
          name="Hours"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Watch Hours</CardTitle>
            <CardDescription>Total real video watch time per day</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              No watch activity in this window yet.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top courses by watch time */}
        {courseChart.length > 0 ? (
          <AnalyticsBarChart
            title="Top Courses by Watch Time"
            description="Courses with the most real watch hours"
            data={courseChart}
            dataKey="count"
            name="Hours"
            layout="vertical"
            height={Math.max(220, courseChart.length * 32)}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Courses by Watch Time</CardTitle>
              <CardDescription>Courses with the most real watch hours</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="py-6 text-center text-sm text-muted-foreground">No course watch data yet.</p>
            </CardContent>
          </Card>
        )}

        {/* Top lectures by watch time */}
        {lectureChart.length > 0 ? (
          <AnalyticsBarChart
            title="Top Lectures by Watch Time"
            description="Most-watched individual videos"
            data={lectureChart}
            dataKey="count"
            name="Hours"
            layout="vertical"
            height={Math.max(220, lectureChart.length * 32)}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Lectures by Watch Time</CardTitle>
              <CardDescription>Most-watched individual videos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="py-6 text-center text-sm text-muted-foreground">No lecture watch data yet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top courses table, drill-down link to course detail watch-time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            Course Breakdown
          </CardTitle>
          <CardDescription>Watch time, sessions, and completion per course (top 10)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {topCourses.length > 0 ? (
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Course</th>
                  <th className="px-4 py-2 text-right">Watch Time</th>
                  <th className="px-4 py-2 text-right">Sessions</th>
                  <th className="px-4 py-2 text-right">Lectures</th>
                  <th className="px-4 py-2 text-right">Avg Completion</th>
                </tr>
              </thead>
              <tbody>
                {topCourses.map((c) => (
                  <tr key={c.course_id} className="border-t">
                    <td className="px-4 py-2">
                      <Link
                        href={`/dashboard/analytics/courses-analytics/${c.course_id}`}
                        className="text-primary hover:underline"
                      >
                        {c.title ?? c.course_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatHours(c.total_seconds)}</td>
                    <td className="px-4 py-2 text-right">{c.sessions_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{c.lectures_touched.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{c.avg_completion_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No course watch data in this window.</p>
          )}
        </CardContent>
      </Card>

      {/* Top viewers, drill-down link to user detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Top Viewers
          </CardTitle>
          <CardDescription>Learners with the most real watch time (top 10)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {topViewers.length > 0 ? (
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Learner</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-right">Watch Time</th>
                  <th className="px-4 py-2 text-right">Courses</th>
                  <th className="px-4 py-2 text-right">Lectures</th>
                  <th className="px-4 py-2 text-right">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {topViewers.map((v) => (
                  <tr key={v.member_id} className="border-t">
                    <td className="px-4 py-2">
                      <Link
                        href={`/dashboard/analytics/users/${v.member_id}`}
                        className="text-primary hover:underline"
                      >
                        {v.member_name ?? "Unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{v.member_email ?? "-"}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatHours(v.total_seconds)}</td>
                    <td className="px-4 py-2 text-right">{v.courses_touched.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{v.lectures_touched.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {v.last_active_at ? formatTimeAgo(v.last_active_at) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No viewer activity in this window.</p>
          )}
        </CardContent>
      </Card>

      {/* Top lectures detail table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Film className="h-4 w-4 text-muted-foreground" />
            Lecture Breakdown
          </CardTitle>
          <CardDescription>Most-watched lectures with completion (top 10)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {topLectures.length > 0 ? (
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Lecture</th>
                  <th className="px-4 py-2 text-left">Course</th>
                  <th className="px-4 py-2 text-right">Watch Time</th>
                  <th className="px-4 py-2 text-right">Sessions</th>
                  <th className="px-4 py-2 text-right">Peak Daily Viewers</th>
                  <th className="px-4 py-2 text-right">Avg Completion</th>
                </tr>
              </thead>
              <tbody>
                {topLectures.map((l) => (
                  <tr key={l.lecture_id} className="border-t">
                    <td className="px-4 py-2 max-w-xs truncate" title={l.title ?? ""}>
                      {l.title ?? l.lecture_id}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/dashboard/analytics/courses-analytics/${l.course_id}`}
                        className="text-primary hover:underline"
                      >
                        {l.course_title ?? l.course_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatHours(l.total_seconds)}</td>
                    <td className="px-4 py-2 text-right">{l.sessions_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{l.max_daily_members.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{l.avg_completion_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No lecture watch data in this window.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
