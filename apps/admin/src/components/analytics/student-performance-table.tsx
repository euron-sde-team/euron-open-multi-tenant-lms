"use client";

import { Button, cn, Input } from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { analyticsApi } from "@/lib/api/analytics";
import type {
  CourseLearnerProgressRow,
  MasterUserProgressRow,
  UsersProgressSortBy,
} from "@/lib/api/analytics";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import {
  buildAnalyticsReport,
  REPORT_COLORS,
  type ChartSpec,
} from "@/lib/export/analytics-report";
import type { Kpi, TableColumn } from "@/lib/export/excel-report";
import { useAnalyticsUsersProgress, useMemberCourseProgress } from "@/lib/hooks/use-analytics";
import { useLMSCourses } from "@/lib/hooks/use-courses-lms";

import { ExportMenu } from "./export-menu";

const PAGE_SIZE = 10;

// The backend caps users/progress at 200 rows per call, so an "export all" pull
// pages through the full filtered cohort in 200-row batches.
const EXPORT_PAGE_SIZE = 200;
// Safety ceiling so a runaway loop can never hammer the API, 100 pages = 20k
// learners, far beyond any real tenant.
const EXPORT_MAX_PAGES = 100;

// Columns for the exported data sheet. `key` matches the flat row built by
// `toExportRow`; `numFmt` keeps counts/percentages clean in Excel.
const PERFORMANCE_SHEET_COLUMNS: TableColumn[] = [
  { header: "Learner", key: "Learner", width: 24 },
  { header: "Email", key: "Email", width: 28 },
  { header: "Status", key: "Status", width: 12 },
  { header: "Courses Enrolled", key: "Courses Enrolled", width: 16, numFmt: "#,##0" },
  { header: "Courses Completed", key: "Courses Completed", width: 17, numFmt: "#,##0" },
  { header: "Progress %", key: "Progress %", width: 12, numFmt: "0" },
  { header: "Lectures Completed", key: "Lectures Completed", width: 18, numFmt: "#,##0" },
  { header: "Total Lectures", key: "Total Lectures", width: 14, numFmt: "#,##0" },
  { header: "Quiz Avg %", key: "Quiz Avg %", width: 12, numFmt: "0" },
  { header: "Quizzes Taken", key: "Quizzes Taken", width: 14, numFmt: "#,##0" },
  { header: "Assignments Submitted", key: "Assignments Submitted", width: 21, numFmt: "#,##0" },
  { header: "Assignments Total", key: "Assignments Total", width: 17, numFmt: "#,##0" },
  { header: "Assignment %", key: "Assignment %", width: 13, numFmt: "0" },
  { header: "Watch Time (hrs)", key: "Watch Time (hrs)", width: 16, numFmt: "0.0" },
  { header: "Last Active", key: "Last Active", width: 14 },
];

// Per-course sheet columns, learner-focused (the sheet itself is one course).
const COURSE_SHEET_COLUMNS: TableColumn[] = [
  { header: "Learner", key: "Learner", width: 24 },
  { header: "Email", key: "Email", width: 28 },
  { header: "Enrollment", key: "Enrollment", width: 14 },
  { header: "Enrolled On", key: "Enrolled On", width: 14 },
  { header: "Progress %", key: "Progress %", width: 12, numFmt: "0" },
  { header: "Lectures Completed", key: "Lectures Completed", width: 18, numFmt: "#,##0" },
  { header: "Total Lectures", key: "Total Lectures", width: 14, numFmt: "#,##0" },
  { header: "Quiz Avg %", key: "Quiz Avg %", width: 12, numFmt: "0" },
  { header: "Quizzes Taken", key: "Quizzes Taken", width: 14, numFmt: "#,##0" },
  { header: "Assignments Submitted", key: "Assignments Submitted", width: 21, numFmt: "#,##0" },
  { header: "Assignments Total", key: "Assignments Total", width: 17, numFmt: "#,##0" },
  { header: "Watch Time (hrs)", key: "Watch Time (hrs)", width: 16, numFmt: "0.0" },
  { header: "Last Active", key: "Last Active", width: 14 },
];

const fmtSheetDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

/** Flatten one course-scoped learner row into the per-course sheet shape. */
function toCourseRow(u: CourseLearnerProgressRow) {
  return {
    Learner: u.name,
    Email: u.email ?? "-",
    Enrollment: u.enrollmentStatus,
    "Enrolled On": fmtSheetDate(u.enrolledAt),
    "Progress %": Math.round(u.progressPct),
    "Lectures Completed": u.completedLectures,
    "Total Lectures": u.totalLectures,
    "Quiz Avg %": u.quizAvg == null ? "" : Math.round(u.quizAvg),
    "Quizzes Taken": u.quizzesTaken,
    "Assignments Submitted": u.assignmentsSubmitted,
    "Assignments Total": u.assignmentsTotal,
    "Watch Time (hrs)": Math.round((u.totalWatchSeconds / 3600) * 10) / 10,
    "Last Active": fmtSheetDate(u.lastActive),
  };
}

// Excel sheet names: ≤31 chars, none of : \ / ? * [ ], and unique in the book.
// We prefix an index so same-named/truncated courses never collide.
function makeSheetName(title: string, index: number, used: Set<string>): string {
  const cleaned = title.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim() || "Course";
  const prefix = `${index}. `;
  let base = `${prefix}${cleaned}`.slice(0, 31);
  let name = base;
  let suffix = 1;
  while (used.has(name.toLowerCase())) {
    const tail = ` (${suffix})`;
    base = `${prefix}${cleaned}`.slice(0, 31 - tail.length);
    name = `${base}${tail}`;
    suffix++;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Run async tasks with bounded concurrency so a big course list can't fan out
 *  into hundreds of simultaneous requests. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Flatten one API row into the sheet's header-keyed shape. */
function toExportRow(u: MasterUserProgressRow) {
  return {
    Learner: u.name,
    Email: u.email ?? "-",
    Status: u.status,
    "Courses Enrolled": u.coursesEnrolled,
    "Courses Completed": u.coursesCompleted,
    "Progress %": Math.round(u.overallProgressPct),
    "Lectures Completed": u.completedLectures,
    "Total Lectures": u.totalLectures,
    "Quiz Avg %": u.quizAvg == null ? "" : Math.round(u.quizAvg),
    "Quizzes Taken": u.quizzesTaken,
    "Assignments Submitted": u.assignmentsSubmitted,
    "Assignments Total": u.assignmentsTotal,
    "Assignment %": u.assignmentPct == null ? "" : Math.round(u.assignmentPct),
    "Watch Time (hrs)": Math.round((u.totalWatchSeconds / 3600) * 10) / 10,
    "Last Active": u.lastActive
      ? new Date(u.lastActive).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "-",
  };
}

const SORT_OPTIONS: { key: UsersProgressSortBy; label: string }[] = [
  { key: "overall_progress_pct", label: "Progress" },
  { key: "quiz_avg", label: "Quiz avg" },
  { key: "assignment_pct", label: "Assignments" },
  { key: "total_watch_seconds", label: "Watch time" },
  { key: "last_active", label: "Last active" },
  { key: "courses_enrolled", label: "Courses" },
  { key: "name", label: "Name" },
];

function fmtWatch(seconds: number): string {
  if (!seconds || seconds < 60) return `${Math.round(seconds || 0)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

function progressTone(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 40) return "bg-blue-500";
  if (pct > 0) return "bg-amber-500";
  return "bg-muted-foreground/30";
}

function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", progressTone(clamped))} style={{ width: `${clamped}%` }} />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground w-9 text-right">{clamped}%</span>
    </div>
  );
}

// Expanded per-course detail, fetched lazily when a member row opens.
function CourseBreakdown({ userId }: { userId: string }) {
  const { data, isLoading } = useMemberCourseProgress(userId);
  const courses = data?.courses ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 py-3 pl-12 pr-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded bg-muted/60" />
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return <div className="py-4 pl-12 text-sm text-muted-foreground">No active course enrollments.</div>;
  }

  return (
    <div className="px-4 py-3 pl-12">
      <div className="overflow-hidden rounded-md border bg-muted/20">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Course</th>
              <th className="px-3 py-2 text-left font-medium w-[180px]">Lessons</th>
              <th className="px-3 py-2 text-center font-medium">Quiz</th>
              <th className="px-3 py-2 text-center font-medium">Assignments</th>
              <th className="px-3 py-2 text-right font-medium">Watch</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.courseId} className="border-b last:border-0">
                <td className="px-3 py-2">
                  {/* Titles are stored HTML-encoded (&amp;), decode for display. */}
                  <div className="font-medium text-foreground">
                    {decodeHtmlEntities(c.courseTitle)}
                  </div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {c.enrollmentStatus.toLowerCase()}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <ProgressBar pct={c.progressPct} />
                  <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {c.completedLectures}/{c.totalLectures} lessons
                  </div>
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {c.quizzesTotal === 0 ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <>
                      <div>{c.quizAvg == null ? "-" : `${c.quizAvg}%`}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.quizzesTaken}/{c.quizzesTotal} taken
                      </div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {c.assignmentsTotal === 0 ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <span>
                      {c.assignmentsSubmitted}/{c.assignmentsTotal}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {fmtWatch(c.totalWatchSeconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StudentPerformanceTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<UsersProgressSortBy>("overall_progress_pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");

  const { data, isLoading, isFetching } = useAnalyticsUsersProgress(page, search, sortBy, sortOrder, PAGE_SIZE, courseId);
  const { data: coursesData } = useLMSCourses({ limit: 200 });
  const courseOptions = useMemo(() => coursesData?.courses ?? [], [coursesData?.courses]);

  const users = useMemo(() => data?.users ?? [], [data?.users]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Commit a search term: reset to page 1 and collapse any open row.
  const commitSearch = useCallback((value: string) => {
    setSearch(value.trim());
    setPage(1);
    setExpanded(null);
  }, []);

  // Live typeahead, debounce keystrokes so the list filters as the admin
  // types (300ms after they stop), without a request per character.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Skip if the committed term already matches (e.g. after Enter/clear).
    if (searchInput.trim() === search) return;
    debounceRef.current = setTimeout(() => commitSearch(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, search, commitSearch]);

  // Enter / button: commit immediately (cancel the pending debounce).
  const applySearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commitSearch(searchInput);
  }, [searchInput, commitSearch]);

  const changeSort = useCallback((key: UsersProgressSortBy) => {
    setExpanded(null);
    setPage(1);
    setSortBy((prev) => {
      if (prev === key) {
        setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
        return prev;
      }
      setSortOrder(key === "name" ? "asc" : "desc");
      return key;
    });
  }, []);

  const toggleRow = useCallback((id: string) => {
    setExpanded((cur) => (cur === id ? null : id));
  }, []);

  const changeCourse = useCallback((id: string) => {
    setCourseId(id);
    setPage(1);
    setExpanded(null);
  }, []);

  // The label of the currently-filtered course, for the report subtitle.
  const courseLabel = useMemo(() => {
    if (!courseId) return "All courses";
    const match = courseOptions.find((c) => c.id === courseId);
    return match ? decodeHtmlEntities(match.title) : "Selected course";
  }, [courseId, courseOptions]);

  // Pull the COMPLETE filtered cohort (not just the visible page) by paging
  // through users/progress in 200-row batches with the active filters/sort.
  const fetchAllProgress = useCallback(async (): Promise<MasterUserProgressRow[]> => {
    const all: MasterUserProgressRow[] = [];
    for (let p = 1; p <= EXPORT_MAX_PAGES; p++) {
      const res = await analyticsApi.getUsersProgress(
        p,
        EXPORT_PAGE_SIZE,
        search || undefined,
        sortBy,
        sortOrder,
        courseId || undefined,
      );
      const batch = res.users ?? [];
      all.push(...batch);
      // Stop when we've gathered everyone (or the batch came back short).
      if (all.length >= (res.total ?? all.length) || batch.length < EXPORT_PAGE_SIZE) break;
    }
    return all;
  }, [search, sortBy, sortOrder, courseId]);

  // Every course (paged so it works for any number of courses), so the export
  // can add one detail sheet per course.
  const fetchAllCourses = useCallback(async () => {
    const out: { id: string; title: string }[] = [];
    for (let p = 1; p <= EXPORT_MAX_PAGES; p++) {
      const res = await coursesLmsApi.getCourses({ page: p, limit: EXPORT_PAGE_SIZE });
      const batch = res.courses ?? [];
      out.push(...batch.map((c) => ({ id: c.id, title: c.title })));
      if (out.length >= (res.total ?? out.length) || batch.length < EXPORT_PAGE_SIZE) break;
    }
    return out;
  }, []);

  // Graphical Excel report: KPIs + insights + charts + a data sheet, over the
  // full filtered cohort. Mirrors the learners report on the Users page.
  const buildReport = useCallback(async () => {
    const rows = await fetchAllProgress();
    const n = rows.length;
    const avg = (nums: number[]) =>
      nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : 0;

    const progressVals = rows.map((r) => r.overallProgressPct);
    const quizVals = rows.filter((r) => r.quizAvg != null).map((r) => r.quizAvg as number);
    const totalWatchHrs = Math.round(rows.reduce((s, r) => s + r.totalWatchSeconds, 0) / 3600);
    const completedCount = rows.filter((r) => r.overallProgressPct >= 100).length;
    const assignSubmitted = rows.reduce((s, r) => s + r.assignmentsSubmitted, 0);
    const assignTotal = rows.reduce((s, r) => s + r.assignmentsTotal, 0);
    const assignRate = assignTotal ? Math.round((assignSubmitted / assignTotal) * 100) : 0;
    const notStarted = rows.filter((r) => r.overallProgressPct <= 0).length;

    // Progress distribution buckets for a donut.
    const buckets = [
      { label: "Not started (0%)", test: (p: number) => p <= 0 },
      { label: "1–39%", test: (p: number) => p > 0 && p < 40 },
      { label: "40–79%", test: (p: number) => p >= 40 && p < 80 },
      { label: "80–99%", test: (p: number) => p >= 80 && p < 100 },
      { label: "Completed (100%)", test: (p: number) => p >= 100 },
    ];
    const distribution = buckets
      .map((b, i) => ({
        label: b.label,
        value: progressVals.filter(b.test).length,
        color: [REPORT_COLORS.red, REPORT_COLORS.amber, REPORT_COLORS.blue, REPORT_COLORS.teal, REPORT_COLORS.emerald][i],
      }))
      .filter((s) => s.value > 0);

    const topByProgress = [...rows]
      .sort((a, b) => b.overallProgressPct - a.overallProgressPct)
      .slice(0, 10);
    const topByWatch = [...rows]
      .sort((a, b) => b.totalWatchSeconds - a.totalWatchSeconds)
      .slice(0, 10);

    const charts: ChartSpec[] = [];
    if (distribution.length)
      charts.push({ kind: "donut", title: "Progress distribution", segments: distribution });
    if (topByProgress.length)
      charts.push({
        kind: "bar",
        title: "Top learners by progress",
        bars: topByProgress.map((u) => ({ label: u.name, value: Math.round(u.overallProgressPct) })),
        valueFormat: (v) => `${v}%`,
      });
    if (topByWatch.some((u) => u.totalWatchSeconds > 0))
      charts.push({
        kind: "bar",
        title: "Top learners by watch time (hrs)",
        bars: topByWatch.map((u) => ({ label: u.name, value: Math.round((u.totalWatchSeconds / 3600) * 10) / 10 })),
        valueFormat: (v) => `${v}h`,
      });

    const kpis: Kpi[] = [
      { label: "Learners", value: String(n) },
      { label: "Avg progress", value: `${avg(progressVals)}%` },
      { label: "Completed course", value: String(completedCount), note: `${n ? Math.round((completedCount / n) * 100) : 0}% of learners` },
      { label: "Avg quiz score", value: quizVals.length ? `${avg(quizVals)}%` : "-", note: `${quizVals.length} took a quiz` },
      { label: "Assignment submission", value: `${assignRate}%`, note: `${assignSubmitted}/${assignTotal} submitted` },
      { label: "Total watch time", value: `${totalWatchHrs.toLocaleString()} hrs` },
    ];

    const top = topByProgress[0];
    const insights = [
      `${n} learners in the current view (${courseLabel}).`,
      top ? `Furthest along: ${top.name} (${Math.round(top.overallProgressPct)}% complete).` : "",
      notStarted > 0 ? `${notStarted} learner${notStarted === 1 ? " has" : "s have"} not started yet, a good re-engagement target.` : "",
      quizVals.length ? `Average quiz score is ${avg(quizVals)}% across ${quizVals.length} learners who attempted one.` : "",
    ].filter(Boolean);

    // Per-course detail sheets, one tab per course, each listing that course's
    // enrolled learners with their IN-THAT-COURSE progress (course-scoped
    // metrics from the dedicated endpoint, NOT the all-courses rollup above).
    // When a course is filtered in the table, only that course gets a sheet;
    // otherwise every course does. Empty courses are skipped (no blank tabs).
    const coursesForSheets = courseId
      ? [{ id: courseId, title: courseLabel }]
      : await fetchAllCourses();

    const courseSheets = (
      await mapWithConcurrency(coursesForSheets, 5, async (c) => {
        try {
          const res = await analyticsApi.getCourseLearnerProgress(c.id);
          const learners = res.learners ?? [];
          if (!learners.length) return null;
          return { title: c.title, learners };
        } catch {
          // A single course failing shouldn't sink the whole export.
          return null;
        }
      })
    ).filter((s): s is { title: string; learners: CourseLearnerProgressRow[] } => s !== null);

    const usedNames = new Set<string>(["learners"]);
    const perCourseSheets = courseSheets.map((s, i) => ({
      // Titles are stored HTML-encoded (&amp;), decode for a clean tab name.
      name: makeSheetName(decodeHtmlEntities(s.title), i + 1, usedNames),
      columns: COURSE_SHEET_COLUMNS,
      rows: s.learners.map(toCourseRow),
      dataBarColumn: "Progress %",
    }));

    await buildAnalyticsReport({
      fileName: "student-performance",
      title: "Student Performance",
      subtitle: courseLabel,
      kpis,
      insights,
      charts,
      sheets: [
        {
          name: "Learners",
          columns: PERFORMANCE_SHEET_COLUMNS,
          rows: rows.map(toExportRow),
          dataBarColumn: "Progress %",
        },
        ...perCourseSheets,
      ],
    });
  }, [fetchAllProgress, fetchAllCourses, courseId, courseLabel]);

  return (
    <div className="space-y-3">
      {/* Header row: Export the full filtered cohort as a graphical Excel
          report, top-right so it reads as the section's primary action. */}
      <div className="flex items-center justify-end">
        <ExportMenu
          data={users as unknown as Record<string, unknown>[]}
          buildReport={{ run: buildReport }}
          fileName="student-performance"
          sheetName="Learners"
          size="sm"
          variant="outline"
          hideCsv
          disabled={total === 0}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
              className="pl-9 h-9"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={applySearch}>Search</Button>
          {search && (
            <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
              Clear
            </Button>
          )}

          {/* Course filter, show only learners enrolled in the picked course. */}
          <select
            value={courseId}
            onChange={(e) => changeCourse(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by course"
          >
            <option value="">All courses</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {decodeHtmlEntities(c.title)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Sort</span>
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.key;
            return (
              <Button
                key={opt.key}
                size="sm"
                variant={active ? "secondary" : "ghost"}
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => changeSort(opt.key)}
              >
                {opt.label}
                {active && (sortOrder === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className={cn("overflow-x-auto rounded-md border transition-opacity", isFetching && "opacity-60")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground">
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 text-left">Learner</th>
              <th className="px-3 py-2 text-center">Courses</th>
              <th className="px-3 py-2 text-left min-w-[140px]">Progress</th>
              <th className="px-3 py-2 text-center">Quiz Avg</th>
              <th className="px-3 py-2 text-center">Assignments</th>
              <th className="px-3 py-2 text-right">Watch</th>
              <th className="px-3 py-2 text-right">Last Active</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={9} className="px-3 py-2">
                    <div className="h-8 animate-pulse rounded bg-muted/60" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-muted-foreground">No learners found</td>
              </tr>
            ) : (
              users.map((u: MasterUserProgressRow) => {
                const isOpen = expanded === u.id;
                return (
                  <Fragment key={u.id}>
                    <tr
                      className={cn(
                        "border-b transition-colors hover:bg-muted/30 cursor-pointer",
                        isOpen && "bg-muted/40",
                      )}
                      onClick={() => toggleRow(u.id)}
                    >
                      <td className="px-2 py-2 text-muted-foreground">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{u.name}</div>
                        {u.email && <div className="text-xs text-muted-foreground">{u.email}</div>}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {u.coursesCompleted}
                        <span className="text-muted-foreground">/{u.coursesEnrolled}</span>
                      </td>
                      <td className="px-3 py-2">
                        <ProgressBar pct={u.overallProgressPct} />
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {u.quizAvg == null ? <span className="text-muted-foreground">-</span> : `${u.quizAvg}%`}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {u.assignmentsTotal === 0 ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <>
                            {u.assignmentsSubmitted}
                            <span className="text-muted-foreground">/{u.assignmentsTotal}</span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtWatch(u.totalWatchSeconds)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{fmtDate(u.lastActive)}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          title="Open full profile"
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/users/${u.id}`); }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b bg-muted/10">
                        <td colSpan={9} className="p-0">
                          <CourseBreakdown userId={u.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1}
              onClick={() => { setPage((p) => p - 1); setExpanded(null); }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages}
              onClick={() => { setPage((p) => p + 1); setExpanded(null); }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
