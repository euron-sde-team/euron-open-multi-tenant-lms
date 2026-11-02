"use client";

import { Badge, Button, Card, CardContent, SkeletonRows } from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, ListChecks } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useMemo } from "react";

import { testsApi, type TestAttemptReport } from "@/lib/api/test-series";
import { testSeriesKeys } from "@/lib/hooks/use-test-series";

function fmtDuration(sec: number | null): string {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Everything one learner has sat, newest first, grouped by series.
 *
 * Complements the per test and per series reports: those answer "how did this
 * test go", this answers "how is this person doing", which is what faculty need
 * when they want a specific test taken by a specific user without first knowing
 * which series it belonged to.
 */
export default function LearnerTestHistoryPage() {
  const params = useParams<{ learnerId: string }>();
  const learnerId = params?.learnerId ?? "";

  const { data, isLoading, isError } = useQuery({
    queryKey: testSeriesKeys.tests.learnerAttempts(learnerId),
    queryFn: () => testsApi.getLearnerAttempts(learnerId),
    enabled: Boolean(learnerId),
  });

  const attempts = useMemo(() => data?.attempts ?? [], [data?.attempts]);

  // Group by series so a learner on several batches reads as several blocks.
  const grouped = useMemo(() => {
    const bySeries = new Map<
      string,
      { title: string; seriesId: string | null; rows: TestAttemptReport[] }
    >();
    for (const a of attempts) {
      const key = a.seriesId ?? "__none__";
      const bucket = bySeries.get(key) ?? {
        title: a.seriesTitle ?? "Not in a series",
        seriesId: a.seriesId ?? null,
        rows: [],
      };
      bucket.rows.push(a);
      bySeries.set(key, bucket);
    }
    return Array.from(bySeries.values());
  }, [attempts]);

  const downloadCsv = () => {
    if (!data) return;
    const headers = [
      "Series",
      "Test",
      "Status",
      "Score",
      "Out of",
      "Percentage",
      "Percentile",
      "Rank",
      "Duration (sec)",
      "Tab switches",
      "Started at",
      "Submitted at",
    ];
    const lines = [headers.join(",")];
    for (const a of attempts) {
      lines.push(
        [
          a.seriesTitle ?? "",
          a.testName ?? "",
          a.status,
          a.score ?? "",
          a.totalMarks ?? "",
          a.percentage ?? "",
          a.percentile ?? "",
          a.rank ?? "",
          a.durationSec ?? "",
          a.tabSwitchCount,
          a.startedAt,
          a.submittedAt ?? "",
        ]
          .map(csvCell)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `${data.learner.name}-tests.csv`.replace(/[^\w.-]+/g, "-");
    el.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <SkeletonRows rows={8} rowClassName="h-14" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              This learner could not be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { learner, summary } = data;

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series/learners"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to learners
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{learner.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {learner.email ?? learner.phone ?? learner.learnerId}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={downloadCsv}
          disabled={attempts.length === 0}
        >
          <Download className="mr-1 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tests taken", value: summary.testCount },
          { label: "Attempts", value: summary.attemptCount },
          { label: "Submitted", value: summary.submittedCount },
          {
            label: "Average score",
            value:
              summary.avgPercentage != null ? `${summary.avgPercentage}%` : "-",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{s.label}</p>
              <p className="text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              This learner has not attempted any test yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <div key={group.seriesId ?? "__none__"} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              {group.seriesId && (
                <Link
                  href={`/dashboard/test-series/series/${group.seriesId}`}
                  className="text-primary text-xs hover:underline"
                >
                  open series
                </Link>
              )}
              <span className="text-muted-foreground text-xs">
                {group.rows.length}{" "}
                {group.rows.length === 1 ? "attempt" : "attempts"}
              </span>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Test</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Score</th>
                    <th className="px-3 py-2 text-right font-medium">%ile</th>
                    <th className="px-3 py-2 text-right font-medium">Rank</th>
                    <th className="px-3 py-2 text-right font-medium">Time</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Submitted
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((a) => (
                    <Fragment key={a.id}>
                      <tr className="border-t">
                        <td className="px-3 py-2">
                          {a.testId ? (
                            <Link
                              href={`/dashboard/test-series/tests/${a.testId}`}
                              className="hover:underline"
                            >
                              {a.testName ?? "-"}
                            </Link>
                          ) : (
                            (a.testName ?? "-")
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {a.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {a.score != null ? a.score : "-"}
                          {a.totalMarks != null && (
                            <span className="text-muted-foreground">
                              {" "}
                              / {a.totalMarks}
                            </span>
                          )}
                          {a.percentage != null && (
                            <span className="text-muted-foreground text-xs">
                              {" "}
                              ({a.percentage}%)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {a.percentile ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-right">{a.rank ?? "-"}</td>
                        <td className="px-3 py-2 text-right text-xs">
                          {fmtDuration(a.durationSec)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {fmtDate(a.submittedAt)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/dashboard/test-series/attempts/${a.id}`}
                            className="text-primary inline-flex items-center text-xs hover:underline"
                          >
                            <ListChecks className="mr-1 h-3.5 w-3.5" />
                            Review
                          </Link>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
