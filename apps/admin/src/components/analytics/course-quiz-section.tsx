"use client";

/**
 * Per-course quiz analytics section.
 *
 * Aggregates quiz performance across every learner in this course.
 * Backed by the existing /tenant/quizzes/analytics/course/:courseId
 * endpoint, which is a single-query aggregate scoped to the course
 * (no per-quiz N+1).
 *
 * Renders:
 *   - 4 KPI cards (total quizzes, attempts, avg score, avg pass rate)
 *   - Two bar charts (attempts per quiz, pass rate per quiz)
 *   - Detail table with drill-down to single-quiz analytics
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { BookOpenCheck, CheckCircle2, ListChecks, Target } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useCourseQuizAnalytics } from "@/lib/hooks/use-analytics";

import { AnalyticsBarChart } from "./chart-components";

interface CourseQuizSectionProps {
  courseId: string;
}

interface KPICardProps {
  label: string;
  value: string;
  Icon: typeof Target;
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
        {hint ? (
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CourseQuizSection({ courseId }: CourseQuizSectionProps) {
  const { data, isLoading, error } = useCourseQuizAnalytics(courseId);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        totalQuizzes: 0,
        totalAttempts: 0,
        avgScore: 0,
        avgPassRate: 0,
      };
    }
    let totalAttempts = 0;
    let weightedScoreSum = 0;
    let scoredQuizCount = 0;
    let weightedPassRateSum = 0;
    let ratedQuizCount = 0;
    for (const q of data.quizzes) {
      totalAttempts += q.attempt_count;
      if (q.average_score != null) {
        weightedScoreSum += q.average_score;
        scoredQuizCount += 1;
      }
      if (q.pass_rate != null) {
        weightedPassRateSum += q.pass_rate;
        ratedQuizCount += 1;
      }
    }
    return {
      totalQuizzes: data.total_quizzes,
      totalAttempts,
      avgScore:
        scoredQuizCount > 0
          ? Math.round(weightedScoreSum / scoredQuizCount)
          : 0,
      avgPassRate:
        ratedQuizCount > 0
          ? Math.round(weightedPassRateSum / ratedQuizCount)
          : 0,
    };
  }, [data]);

  const attemptsChartData = useMemo(() => {
    if (!data) return [];
    return [...data.quizzes]
      .sort((a, b) => b.attempt_count - a.attempt_count)
      .slice(0, 10)
      .map((q) => ({
        date: decodeHtmlEntities(q.title),
        count: q.attempt_count,
      }));
  }, [data]);

  const passRateChartData = useMemo(() => {
    if (!data) return [];
    return [...data.quizzes]
      .filter((q) => q.pass_rate != null)
      .sort((a, b) => (b.pass_rate ?? 0) - (a.pass_rate ?? 0))
      .slice(0, 10)
      .map((q) => ({
        date: decodeHtmlEntities(q.title),
        count: q.pass_rate ?? 0,
      }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quiz Performance</CardTitle>
          <CardDescription>
            Loading aggregated quiz analytics for this course...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-md bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quiz Performance</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load quiz analytics.{" "}
            {error instanceof Error ? error.message : "Please try again."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || data.total_quizzes === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" /> Quiz Performance
          </CardTitle>
          <CardDescription>
            No quizzes published for this course yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" /> Quiz Performance
        </CardTitle>
        <CardDescription>
          {kpis.totalAttempts} attempts across {data.total_quizzes} quizzes,
          aggregated over {data.enrolled_count} enrolled learners.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            label="Published quizzes"
            value={String(data.published_count)}
            Icon={ListChecks}
            hint={`${data.draft_count} draft`}
          />
          <KPICard
            label="Total attempts"
            value={String(kpis.totalAttempts)}
            Icon={BookOpenCheck}
            hint={`${data.enrolled_count} enrolled`}
          />
          <KPICard
            label="Avg score"
            value={`${kpis.avgScore}%`}
            Icon={Target}
            hint="across all quizzes"
          />
          <KPICard
            label="Avg pass rate"
            value={`${kpis.avgPassRate}%`}
            Icon={CheckCircle2}
            hint="across all quizzes"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsBarChart
            title="Most-attempted quizzes"
            description="Top 10 quizzes by attempt volume"
            data={attemptsChartData}
            dataKey="count"
            name="Attempts"
            layout="vertical"
            height={Math.max(220, attemptsChartData.length * 32)}
          />
          <AnalyticsBarChart
            title="Highest pass rates"
            description="Top 10 quizzes by % learners passing"
            data={passRateChartData}
            dataKey="count"
            name="Pass %"
            layout="vertical"
            height={Math.max(220, passRateChartData.length * 32)}
          />
        </div>

        <div className="rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Per-quiz breakdown
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Quiz</th>
                  <th className="px-3 py-2 text-left">Scope</th>
                  <th className="px-3 py-2 text-right">Attempts</th>
                  <th className="px-3 py-2 text-right">Attempt rate</th>
                  <th className="px-3 py-2 text-right">Passed</th>
                  <th className="px-3 py-2 text-right">Failed</th>
                  <th className="px-3 py-2 text-right">Avg score</th>
                  <th className="px-3 py-2 text-right">Pass rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.quizzes.map((q) => (
                  <tr key={q.quiz_id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/analytics/quizzes-analytics/${q.quiz_id}`}
                        className="font-medium hover:underline"
                      >
                        {decodeHtmlEntities(q.title)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">
                      {q.scope.toLowerCase()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {q.attempt_count}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {q.attempt_rate}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                      {q.passed_count}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-500">
                      {q.failed_count}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {q.average_score != null ? `${q.average_score}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {q.pass_rate != null ? `${q.pass_rate}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
