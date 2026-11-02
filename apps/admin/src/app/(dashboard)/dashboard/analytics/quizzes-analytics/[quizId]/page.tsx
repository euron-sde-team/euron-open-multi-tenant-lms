"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@open-mtlms/core";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Search,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  AnalyticsBarChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { ExcelExportButton } from "@/components/analytics/excel-export";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { useQuizDetailAnalytics } from "@/lib/hooks/use-analytics";

export default function QuizDetailAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params?.quizId as string;
  const [studentPage, setStudentPage] = useState(1);
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const { data, isLoading } = useQuizDetailAnalytics(
    quizId ?? null,
    studentPage,
    studentSearch
  );

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/analytics/quizzes-analytics"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quizzes
        </Link>
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Quiz not found or no analytics available.
        </div>
      </div>
    );
  }

  const studentResults = data.student_results ?? [];
  const studentTotal = data.student_results_total ?? 0;
  const studentLimit = data.student_results_limit ?? 20;
  const studentTotalPages = studentLimit > 0 ? Math.ceil(studentTotal / studentLimit) : 1;
  const passRate = data.pass_rate ?? 0;
  const passedVsFailedPieData = [
    ...(data.passed_count > 0 ? [{ name: "Passed", value: data.passed_count }] : []),
    ...(data.failed_count > 0 ? [{ name: "Failed", value: data.failed_count }] : []),
  ];
  const scoreDistributionData = (data.score_distribution ?? []).map((d) => ({
    date: d.range,
    count: d.count,
  }));

  const exportData = studentResults.map((s) => ({
    Name: s.member_name,
    Email: s.member_email ?? "",
    Attempted: s.attempted ? "Yes" : "No",
    Status: s.attempt_status ?? "-",
    Score: s.score ?? "-",
    "Score %": s.score_percentage != null ? `${s.score_percentage}%` : "-",
    Passed: s.passed ? "Yes" : "No",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics/quizzes-analytics"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quizzes
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="max-w-[200px] truncate text-sm font-medium sm:max-w-full">
            {data.title}
          </span>
        </div>
        <ExcelExportButton
          data={exportData}
          fileName={`quiz-analytics-${quizId}`}
          sheetName="Student Results"
          label="Export"
        />
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardCheck className="h-6 w-6" />
          Quiz Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          {data.title} · Max score: {data.max_score} · Pass: {data.pass_percentage}%
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_attempts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <ThumbsUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{data.passed_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <ThumbsDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.failed_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.average_score != null ? `${data.average_score.toFixed(1)}%` : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {passedVsFailedPieData.length > 0 && (
          <AnalyticsPieChart
            title="Passed vs Failed"
            description="Attempt outcomes"
            data={passedVsFailedPieData}
          />
        )}
        {scoreDistributionData.length > 0 && (
          <AnalyticsBarChart
            title="Score Distribution"
            description="Attempts by score range"
            data={scoreDistributionData}
            dataKey="count"
            name="Attempts"
            layout="vertical"
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            People Who Attempted
          </CardTitle>
          <CardDescription>
            Enrolled students and their quiz attempt status
          </CardDescription>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={studentSearchInput}
                  onChange={(e) => setStudentSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setStudentSearch(studentSearchInput);
                      setStudentPage(1);
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStudentSearch(studentSearchInput);
                  setStudentPage(1);
                }}
              >
                Search
              </Button>
              {studentSearch && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setStudentSearch("");
                    setStudentSearchInput("");
                    setStudentPage(1);
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
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Name</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Email</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Attempted</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Score</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Score %</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Passed</th>
                </tr>
              </thead>
              <tbody>
                {studentResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      {studentSearch
                        ? "No students match your search."
                        : "No enrolled students yet. Students must be enrolled in the course and attempt the quiz."}
                    </td>
                  </tr>
                ) : (
                  studentResults.map((s) => (
                    <tr
                      key={s.tenant_member_id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        router.push(`/dashboard/analytics/users/${s.tenant_member_id}`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/dashboard/analytics/users/${s.tenant_member_id}`);
                        }
                      }}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium">{s.member_name}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                        {s.member_email ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.attempted ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.attempt_status ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.attempt_status === "PASSED"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {s.attempt_status}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {s.score != null ? s.score : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {s.score_percentage != null ? `${s.score_percentage}%` : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.attempted ? (s.passed ? "Yes" : "No") : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              {studentTotal === 0
                ? "No students"
                : `Showing ${(studentPage - 1) * studentLimit + 1} to ${Math.min(studentPage * studentLimit, studentTotal)} of ${studentTotal}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={studentPage <= 1}
                onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm font-medium">
                Page {studentPage} of {studentTotalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={studentPage >= studentTotalPages}
                onClick={() => setStudentPage((p) => Math.min(studentTotalPages, p + 1))}
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
