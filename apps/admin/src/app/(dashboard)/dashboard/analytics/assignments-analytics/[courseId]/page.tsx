"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import {
  ArrowLeft,
  ChevronRight,
  FileCheck,
  FileText,
  GraduationCap,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  AnalyticsBarChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { ExcelExportButton } from "@/components/analytics/excel-export";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { useCourseAssignmentAnalytics } from "@/lib/hooks/use-analytics";

export default function CourseAssignmentsAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;
  const { data, isLoading } = useCourseAssignmentAnalytics(courseId ?? null);

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/analytics/assignments-analytics"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assignments
        </Link>
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Course not found or no assignment analytics available.
        </div>
      </div>
    );
  }

  const assignments = data.assignments ?? [];
  const statusPieData = [
    ...(data.published_count > 0
      ? [{ name: "Published", value: data.published_count }]
      : []),
    ...(data.draft_count > 0 ? [{ name: "Draft", value: data.draft_count }] : []),
  ];
  const topBySubmissions = [...assignments]
    .sort((a, b) => b.submission_count - a.submission_count)
    .slice(0, 8)
    .map((a) => ({ date: String(a.title).slice(0, 25), count: a.submission_count }));

  const exportData = assignments.map((a) => ({
    Title: a.title,
    Scope: a.scope,
    Status: a.status,
    "Max Score": a.max_score,
    Submissions: a.submission_count,
    "Submission Rate (%)": a.submission_rate,
    Evaluated: a.evaluated_count,
    "Avg Score (%)": a.average_score ?? "-",
    "Pass Rate (%)": a.pass_rate ?? "-",
    "Pending Evaluation": a.pending_evaluation,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics/assignments-analytics"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assignments
          </Link>
          <ChevronRight className="text-muted-foreground h-4 w-4" />
          <span className="max-w-[200px] truncate text-sm font-medium sm:max-w-full">
            Course Assignments
          </span>
        </div>
        <ExcelExportButton
          data={exportData}
          fileName={`assignments-analytics-${courseId}`}
          sheetName="Assignments"
          label="Export"
        />
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GraduationCap className="h-6 w-6" />
          Course Assignment Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          {data.total_assignments} assignments · {data.enrolled_count} enrolled
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_assignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.published_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignments.reduce((s, a) => s + a.submission_count, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Evaluated</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignments.reduce((s, a) => s + a.evaluated_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {statusPieData.length > 0 && (
          <AnalyticsPieChart
            title="Assignment Status"
            description="Published vs Draft"
            data={statusPieData}
          />
        )}
        {topBySubmissions.length > 0 && (
          <AnalyticsBarChart
            title="Top Assignments by Submissions"
            description="Assignments with most submissions"
            data={topBySubmissions}
            dataKey="count"
            name="Submissions"
            layout="vertical"
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>
            Per-assignment submission and evaluation status
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Assignment</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Scope</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Max Score</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Submissions</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Rate %</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Evaluated</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Avg Score</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Pass Rate</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Pending</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                      No assignments in this course
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr
                      key={a.assignment_id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/assignments/${a.assignment_id}/submissions`)
                      }
                    >
                      <td className="max-w-[180px] truncate px-4 py-3 font-medium" title={a.title}>
                        {a.title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {a.scope}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            a.status === "PUBLISHED"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{a.max_score}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {a.submission_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {a.submission_rate}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {a.evaluated_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {a.average_score != null ? `${a.average_score}%` : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {a.pass_rate != null ? `${a.pass_rate}%` : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {a.pending_evaluation}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/dashboard/assignments/${a.assignment_id}/submissions`}
                            className="inline-flex items-center gap-1"
                          >
                            View
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
