"use client";

import { Badge, Button, Input, useToast } from "@open-mtlms/core";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ListChecks,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

import { testsApi, type TestAttemptReport } from "@/lib/api/test-series";

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

/** RFC-4180-ish CSV cell escaping. */
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(rows: TestAttemptReport[], showTest: boolean): string {
  const headers = [
    "Learner",
    "Email",
    "Phone",
    ...(showTest ? ["Test"] : []),
    "Status",
    "Score",
    "Out of",
    "Percentage",
    "Scaled score",
    "Scaled max",
    "Percentile",
    "Rank",
    "Duration (sec)",
    "Tab switches",
    "Proctoring flags",
    "Flag types",
    "Started at",
    "Submitted at",
  ];
  const lines = [headers.join(",")];
  for (const a of rows) {
    const cells = [
      a.learnerName,
      a.learnerEmail ?? "",
      a.learnerPhone ?? "",
      ...(showTest ? [a.testName ?? ""] : []),
      a.status,
      a.score ?? "",
      a.totalMarks ?? "",
      a.percentage ?? "",
      a.scaledScore ?? "",
      a.scaledScoreMax ?? "",
      a.percentile ?? "",
      a.rank ?? "",
      a.durationSec ?? "",
      a.tabSwitchCount,
      a.flagCount,
      a.flags.map((f) => f.type).join(" | "),
      a.startedAt,
      a.submittedAt ?? "",
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n");
}

/** Rows rendered at once. Thousands of attempts must not all hit the DOM. */
const ROWS_PER_PAGE = 25;

/**
 * Admin attempt report, used per-test (exam-wise) and per-series (batch-wise).
 * Shows full learner details + scores + proctoring, with a CSV export of every
 * column (including ones not shown in the compact table).
 */
export function AttemptsReport({
  attempts,
  loading,
  showTest = false,
  filename = "attempts",
  testId,
}: {
  attempts: TestAttemptReport[];
  loading?: boolean;
  /** Series (batch) view shows which test each attempt belongs to. */
  showTest?: boolean;
  filename?: string;
  /** When set (per-test view), the export is the charted .xlsx analytics report. */
  testId?: string;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // A busy test can carry thousands of attempts. Filter and page in memory.
  // the rows are already loaded, this only bounds what the DOM has to render
  // and gives a way to reach one learner without scrolling for them.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attempts;
    return attempts.filter((a) =>
      [a.learnerName, a.learnerEmail, a.learnerPhone, a.testName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [attempts, query]);

  const totalPages = Math.max(1, Math.ceil(visible.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => visible.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE),
    [visible, safePage]
  );

  useEffect(() => {
    setPage(1);
  }, [query, attempts]);

  const summary = useMemo(() => {
    const submitted = attempts.filter((a) => a.submittedAt);
    const scored = submitted.filter((a) => a.scaledScore != null || a.score != null);
    const avgScaled =
      scored.filter((a) => a.scaledScore != null).reduce((s, a) => s + (a.scaledScore ?? 0), 0) /
      (scored.filter((a) => a.scaledScore != null).length || 1);
    return {
      total: attempts.length,
      submitted: submitted.length,
      flagged: attempts.filter((a) => a.flagCount > 0 || a.tabSwitchCount > 0).length,
      avgScaled: scored.some((a) => a.scaledScore != null) ? Math.round(avgScaled) : null,
    };
  }, [attempts]);

  const downloadCsv = () => {
    const csv = buildCsv(attempts, showTest);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    if (!testId) return;
    setExporting(true);
    try {
      const blob = await testsApi.exportAnalytics(testId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Export failed",
        description: "Could not generate the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
          <span>
            <b className="text-foreground">{summary.total}</b> attempts
          </span>
          <span>
            <b className="text-foreground">{summary.submitted}</b> submitted
          </span>
          {summary.avgScaled != null && (
            <span>
              avg scaled <b className="text-foreground">{summary.avgScaled}</b>
            </span>
          )}
          <span>
            <b className="text-foreground">{summary.flagged}</b> flagged
          </span>
        </div>
        {testId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={exportExcel}
            disabled={exporting || attempts.length === 0}
          >
            {exporting ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            Export Excel
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={downloadCsv}
            disabled={attempts.length === 0}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Download CSV
          </Button>
        )}
      </div>

      {attempts.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Find a learner…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : attempts.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No attempts yet.</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No learner matches “{query}”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Learner</th>
                {showTest && <th className="px-3 py-2 text-left font-medium">Test</th>}
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Scaled</th>
                <th className="px-3 py-2 text-right font-medium">%ile</th>
                <th className="px-3 py-2 text-right font-medium">Rank</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
                <th className="px-3 py-2 text-right font-medium">Proctoring</th>
                <th className="px-3 py-2 text-left font-medium">Submitted</th>
                <th className="px-3 py-2 text-right font-medium">Answers</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((a) => (
                <Fragment key={a.id}>
                  <tr className="border-t">
                    <td className="px-3 py-2">
                      {/* Through to everything this learner has sat, across
                          every series, not just the report being viewed. */}
                      <Link
                        href={`/dashboard/test-series/learners/${a.learnerId}`}
                        className="font-medium hover:underline"
                      >
                        {a.learnerName}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {a.learnerEmail ?? a.learnerPhone ?? a.learnerId}
                      </div>
                    </td>
                    {showTest && (
                      <td className="px-3 py-2 text-xs">{a.testName ?? "-"}</td>
                    )}
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {a.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a.score != null ? a.score : "-"}
                      {/* The denominator is per attempt, not per test: random-X
                          and blueprint tests serve a different question set to
                          every learner. Without it, two learners on the same
                          score and different percentages look like a bug. */}
                      {a.totalMarks != null && (
                        <span className="text-muted-foreground"> / {a.totalMarks}</span>
                      )}
                      {a.percentage != null && (
                        <span className="text-muted-foreground text-xs"> ({a.percentage}%)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a.scaledScore != null
                        ? `${a.scaledScore}${a.scaledScoreMax ? `/${a.scaledScoreMax}` : ""}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-right">{a.percentile != null ? a.percentile : "-"}</td>
                    <td className="px-3 py-2 text-right">{a.rank != null ? a.rank : "-"}</td>
                    <td className="px-3 py-2 text-right text-xs">{fmtDuration(a.durationSec)}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {a.tabSwitchCount === 0 && a.flagCount === 0 ? (
                        <span className="text-muted-foreground">clean</span>
                      ) : (
                        <button
                          className="text-amber-600 hover:underline"
                          onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        >
                          {a.tabSwitchCount} tabs · {a.flagCount} flags
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{fmtDate(a.submittedAt)}</td>
                    <td className="px-3 py-2 text-right">
                      {/* Question by question replay of this learner's attempt.
                          what faculty need to see where a cohort lost marks. */}
                      {a.startedAt ? (
                        <Link
                          href={`/dashboard/test-series/attempts/${a.id}`}
                          className="text-primary inline-flex items-center text-xs hover:underline"
                        >
                          <ListChecks className="mr-1 h-3.5 w-3.5" />
                          Review
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                  {expanded === a.id && a.flags.length > 0 && (
                    <tr className="bg-muted/20 border-t">
                      <td colSpan={showTest ? 11 : 10} className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {a.flags.map((f, i) => (
                            <span
                              key={i}
                              className="bg-background rounded border px-2 py-0.5 text-[11px]"
                            >
                              {f.type.replace(/_/g, " ")}
                              {f.detail ? `, ${f.detail}` : ""}
                              {f.at ? ` @ ${new Date(f.at).toLocaleTimeString()}` : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && visible.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Showing {(safePage - 1) * ROWS_PER_PAGE + 1} to{" "}
            {Math.min(safePage * ROWS_PER_PAGE, visible.length)} of {visible.length}
            {query ? " matching" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
