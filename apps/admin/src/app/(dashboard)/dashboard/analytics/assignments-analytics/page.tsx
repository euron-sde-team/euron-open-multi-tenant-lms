"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@open-mtlms/core";
import {
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  GraduationCap,
  Loader2,
  Search,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { ExcelExportButton } from "@/components/analytics/excel-export";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { useAssignmentAnalyticsOverview } from "@/lib/hooks/use-analytics";

export default function AssignmentsAnalyticsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { data, isLoading } = useAssignmentAnalyticsOverview(page, search);

  if (isLoading) return <AnalyticsSkeleton />;

  const overview = data ?? {
    total_assignments: 0,
    published_count: 0,
    draft_count: 0,
    total_submissions: 0,
    evaluated_count: 0,
    pending_evaluation_count: 0,
    courses: [],
    total: 0,
    page: 1,
    limit: 20,
  };

  const courses = overview.courses ?? [];
  const total = overview.total ?? 0;
  const limit = overview.limit ?? 20;
  const statusPieData = [
    ...(overview.published_count > 0
      ? [{ name: "Published", value: overview.published_count }]
      : []),
    ...(overview.draft_count > 0
      ? [{ name: "Draft", value: overview.draft_count }]
      : []),
  ];
  const submissionStatusPieData = [
    ...(overview.evaluated_count > 0
      ? [{ name: "Evaluated", value: overview.evaluated_count }]
      : []),
    ...(overview.pending_evaluation_count > 0
      ? [{ name: "Pending Evaluation", value: overview.pending_evaluation_count }]
      : []),
  ];

  const exportData = courses.map((c) => ({
    Course: c.course_title,
    "Total Assignments": c.total_assignments,
    Published: c.published_count,
    Draft: c.draft_count,
    Submissions: c.total_submissions,
    Evaluated: c.evaluated_count,
    "Pending Evaluation": c.pending_evaluation,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Assignments Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Overall assignment status and course-wise breakdown
          </p>
        </div>
        <ExcelExportButton
          data={exportData}
          fileName="assignments-analytics"
          sheetName="Assignments"
          label="Export"
        />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.total_assignments.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.published_count.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.draft_count.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.total_submissions.toLocaleString()}
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
              {overview.evaluated_count.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Evaluation</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.pending_evaluation_count.toLocaleString()}
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
        {submissionStatusPieData.length > 0 && (
          <AnalyticsPieChart
            title="Submission Status"
            description="Evaluated vs Pending"
            data={submissionStatusPieData}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Course-wise Assignment Status
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Click a course to view detailed assignment analytics
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Course</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Assignments</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Published</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Draft</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Submissions</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Evaluated</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Pending</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No courses with assignments found
                    </td>
                  </tr>
                ) : (
                  courses.map((c) => (
                    <tr
                      key={c.course_id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/dashboard/analytics/assignments-analytics/${c.course_id}`
                        )
                      }
                    >
                      <td className="max-w-[200px] truncate px-4 py-3 font-medium" title={c.course_title}>
                        <Link
                          href={`/dashboard/analytics/assignments-analytics/${c.course_id}`}
                          className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.course_title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {c.total_assignments}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {c.published_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {c.draft_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {c.total_submissions}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {c.evaluated_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {c.pending_evaluation}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/dashboard/analytics/assignments-analytics/${c.course_id}`}
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

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {courses.length} of {total} courses
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm font-medium">Page {page}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
