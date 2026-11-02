"use client";

/**
 * Per-course assignment analytics section.
 *
 * Aggregates assignment performance across every learner in this course.
 * Backed by /tenant/assignments/analytics/course/:courseId, a single-query
 * service aggregate (no per-assignment N+1).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { ClipboardCheck, FileCheck2, Hourglass, Target } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useCourseAssignmentAnalytics } from "@/lib/hooks/use-analytics";

import { AnalyticsBarChart } from "./chart-components";

interface CourseAssignmentSectionProps {
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

export function CourseAssignmentSection({
  courseId,
}: CourseAssignmentSectionProps) {
  const { data, isLoading, error } = useCourseAssignmentAnalytics(courseId);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        totalAssignments: 0,
        totalSubmissions: 0,
        avgSubmissionRate: 0,
        avgScore: 0,
        pendingEvaluation: 0,
      };
    }
    let submissions = 0;
    let pending = 0;
    let weightedSubmissionRateSum = 0;
    let assignmentsWithRate = 0;
    let weightedScoreSum = 0;
    let scoredAssignments = 0;
    for (const a of data.assignments) {
      submissions += a.submission_count;
      pending += a.pending_evaluation;
      weightedSubmissionRateSum += a.submission_rate;
      assignmentsWithRate += 1;
      if (a.average_score != null) {
        weightedScoreSum += a.average_score;
        scoredAssignments += 1;
      }
    }
    return {
      totalAssignments: data.total_assignments,
      totalSubmissions: submissions,
      pendingEvaluation: pending,
      avgSubmissionRate:
        assignmentsWithRate > 0
          ? Math.round(weightedSubmissionRateSum / assignmentsWithRate)
          : 0,
      avgScore:
        scoredAssignments > 0
          ? Math.round(weightedScoreSum / scoredAssignments)
          : 0,
    };
  }, [data]);

  const submissionRateChart = useMemo(() => {
    if (!data) return [];
    return [...data.assignments]
      .sort((a, b) => b.submission_rate - a.submission_rate)
      .slice(0, 10)
      .map((a) => ({
        date: decodeHtmlEntities(a.title),
        count: a.submission_rate,
      }));
  }, [data]);

  const avgScoreChart = useMemo(() => {
    if (!data) return [];
    return [...data.assignments]
      .filter((a) => a.average_score != null)
      .sort((a, b) => (b.average_score ?? 0) - (a.average_score ?? 0))
      .slice(0, 10)
      .map((a) => ({
        date: decodeHtmlEntities(a.title),
        count: a.average_score ?? 0,
      }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignment Performance</CardTitle>
          <CardDescription>
            Loading aggregated assignment analytics for this course...
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
          <CardTitle>Assignment Performance</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load assignment analytics.{" "}
            {error instanceof Error ? error.message : "Please try again."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || data.total_assignments === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Assignment Performance
          </CardTitle>
          <CardDescription>
            No assignments published for this course yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> Assignment Performance
        </CardTitle>
        <CardDescription>
          {kpis.totalSubmissions} submissions across {data.total_assignments}{" "}
          assignments, aggregated over {data.enrolled_count} enrolled learners.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            label="Published assignments"
            value={String(data.published_count)}
            Icon={ClipboardCheck}
            hint={`${data.draft_count} draft`}
          />
          <KPICard
            label="Submissions"
            value={String(kpis.totalSubmissions)}
            Icon={FileCheck2}
            hint={`${kpis.avgSubmissionRate}% avg submission rate`}
          />
          <KPICard
            label="Avg score"
            value={`${kpis.avgScore}%`}
            Icon={Target}
            hint="across evaluated"
          />
          <KPICard
            label="Pending evaluation"
            value={String(kpis.pendingEvaluation)}
            Icon={Hourglass}
            hint="awaiting grading"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsBarChart
            title="Submission rate per assignment"
            description="Top 10 by % of enrolled who submitted"
            data={submissionRateChart}
            dataKey="count"
            name="Submission %"
            layout="vertical"
            height={Math.max(220, submissionRateChart.length * 32)}
          />
          <AnalyticsBarChart
            title="Average score per assignment"
            description="Top 10 evaluated assignments by mean score"
            data={avgScoreChart}
            dataKey="count"
            name="Avg %"
            layout="vertical"
            height={Math.max(220, avgScoreChart.length * 32)}
          />
        </div>

        <div className="rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Per-assignment breakdown
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Assignment</th>
                  <th className="px-3 py-2 text-left">Scope</th>
                  <th className="px-3 py-2 text-right">Submissions</th>
                  <th className="px-3 py-2 text-right">Submission rate</th>
                  <th className="px-3 py-2 text-right">Evaluated</th>
                  <th className="px-3 py-2 text-right">Pending</th>
                  <th className="px-3 py-2 text-right">Avg score</th>
                  <th className="px-3 py-2 text-right">Pass rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.assignments.map((a) => (
                  <tr key={a.assignment_id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/analytics/assignments-analytics/${courseId}`}
                        className="font-medium hover:underline"
                      >
                        {decodeHtmlEntities(a.title)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">
                      {a.scope.toLowerCase()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.submission_count}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.submission_rate}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                      {a.evaluated_count}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                      {a.pending_evaluation}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.average_score != null ? `${a.average_score}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.pass_rate != null ? `${a.pass_rate}%` : "-"}
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
