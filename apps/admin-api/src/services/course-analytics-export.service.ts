import ExcelJS from "exceljs";

import { BadRequestError } from "../errors/bad-request.error";
import courseAnalyticsExportRepository, {
  type CourseTopLearnerRow,
  type DailyEngagementRow,
} from "../repositories/course-analytics-export.repository";
import coursesRepository from "../repositories/courses.repository";
import watchTimeAnalyticsRepository from "../repositories/watch-time-analytics.repository";
import { getCourseAssignmentAnalytics } from "./assignment-analytics.service";
import { getCourseQuizAnalytics } from "./quiz-analytics.service";
import { decodeHtmlEntities } from "../utils/html-entities.util";
import { BRAND } from "../lib/brand";

/**
 * Builds a feature-rich .xlsx workbook with course-aggregated analytics for
 * the business owner.
 *
 * Six sheets:
 *   1. Course Profile & KPIs       - identity + cross-perspective headline numbers
 *   2. Video Performance           - per-lecture aggregates (rollup-backed)
 *   3. Quiz Performance            - per-quiz aggregates
 *   4. Assignment Performance      - per-assignment aggregates
 *   5. Daily Engagement (90d)      - per-day watch hours / quiz attempts / submissions
 *   6. Top Learners (Top 25)       - leaderboard across watch + quiz + assignments
 *
 * Performance characteristics:
 *   - 6 backend queries fired in parallel (Promise.all). Wall time = slowest.
 *   - Video query reads from `tenant_watch_time_daily` (pre-aggregated by an
 *     hourly learner-api job).
 *   - Quiz + Assignment queries reuse the production analytics services that
 *     already power the live UI; no new aggregates introduced for those.
 *   - Two new queries (daily engagement, top learners) are each single-pass
 *     and index-aligned. Top learners has a hard LIMIT 25 cap.
 *   - Workbook composition is synchronous and streams a single binary back.
 */

// ────────────────────────────────────────────────────────────────────
// Color palette + style primitives (kept inline; small enough not to warrant a shared module)
// ────────────────────────────────────────────────────────────────────
const BRAND_PRIMARY = "FF1E40AF";
const BRAND_PRIMARY_LIGHT = "FFDBEAFE";
const BRAND_ACCENT = "FF6366F1";
const COLOR_HEADER_FILL = "FF111827";
const COLOR_HEADER_TEXT = "FFFFFFFF";
const COLOR_BAND_FILL = "FFF3F4F6";
const COLOR_GOOD = "FF10B981";
const COLOR_WARN = "FFFBBF24";
const COLOR_BAD = "FFEF4444";
const COLOR_MUTED = "FF6B7280";

const toInt = (val: unknown): number => {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number(val) || 0;
};

const formatHms = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "0m 0s";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
};

const sanitizeFile = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "course";

/**
 * Last 5 characters of an ID, uppercased, used as a short disambiguation
 * suffix so two courses named "Python 101" don't collide in the user's
 * downloads folder. ULIDs are random in the trailing characters, so this
 * is effectively unique without being unreadable.
 */
const shortIdSuffix = (id: string): string =>
  id.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase() || "00000";

function setHeaderRow(ws: ExcelJS.Worksheet, row: number, columns: number): void {
  const header = ws.getRow(row);
  header.font = { bold: true, color: { argb: COLOR_HEADER_TEXT }, size: 11 };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR_HEADER_FILL },
  };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 22;
  for (let c = 1; c <= columns; c += 1) {
    header.getCell(c).border = {
      bottom: { style: "thin", color: { argb: BRAND_PRIMARY } },
    };
  }
}

function bandRows(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  columns: number
): void {
  for (let r = startRow; r <= endRow; r += 1) {
    if ((r - startRow) % 2 === 1) {
      for (let c = 1; c <= columns; c += 1) {
        ws.getCell(r, c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR_BAND_FILL },
        };
      }
    }
  }
}

function addDataBar(
  ws: ExcelJS.Worksheet,
  ref: string,
  color: string,
  showValue = true
): void {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: color },
        showValue,
        gradient: true,
      } as ExcelJS.DataBarRuleType,
    ],
  });
}

function addColorScale(
  ws: ExcelJS.Worksheet,
  ref: string,
  reverse = false
): void {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "colorScale",
        priority: 1,
        cfvo: [
          { type: "min" },
          { type: "percentile", value: 50 },
          { type: "max" },
        ],
        color: reverse
          ? [
              { argb: COLOR_GOOD },
              { argb: COLOR_WARN },
              { argb: COLOR_BAD },
            ]
          : [
              { argb: COLOR_BAD },
              { argb: COLOR_WARN },
              { argb: COLOR_GOOD },
            ],
      } as ExcelJS.ColorScaleRuleType,
    ],
  });
}

// ────────────────────────────────────────────────────────────────────
// Public service
// ────────────────────────────────────────────────────────────────────
export interface CourseXlsxExportResult {
  buffer: Buffer;
  fileName: string;
}

class CourseAnalyticsExportService {
  async buildWorkbook(
    tenantId: string,
    courseId: string
  ): Promise<CourseXlsxExportResult> {
    if (!tenantId) throw new BadRequestError("Tenant context required");
    if (!courseId) throw new BadRequestError("Course id is required");

    // All 6 reads in parallel. Wall time = slowest. Each is index-aligned.
    const [course, watchTime, quizAnalytics, assignmentAnalytics, dailyEngagement, topLearners] =
      await Promise.all([
        coursesRepository.findById(courseId, tenantId),
        watchTimeAnalyticsRepository.getCourseWatchTime(tenantId, courseId, undefined, undefined, 50),
        getCourseQuizAnalytics(tenantId, courseId),
        getCourseAssignmentAnalytics(tenantId, courseId),
        courseAnalyticsExportRepository.getCourseDailyEngagement(tenantId, courseId, 90),
        courseAnalyticsExportRepository.getCourseTopLearners(tenantId, courseId, 25),
      ]);

    if (!course) {
      throw new BadRequestError("Course not found");
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = BRAND.name;
    wb.created = new Date();

    this.buildProfileSheet(wb, {
      course,
      watchTime,
      quizAnalytics,
      assignmentAnalytics,
      generatedAt: new Date(),
    });
    this.buildVideoSheet(wb, watchTime);
    this.buildQuizSheet(wb, quizAnalytics);
    this.buildAssignmentSheet(wb, assignmentAnalytics);
    this.buildDailyEngagementSheet(wb, dailyEngagement);
    this.buildTopLearnersSheet(wb, topLearners);

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `course-analytics-${sanitizeFile(
      decodeHtmlEntities(course.title ?? "course")
    )}-${shortIdSuffix(course.id)}-${stamp}.xlsx`;

    return { buffer, fileName };
  }

  // ────────────────────────────────────────────────────────────────
  // Sheet builders
  // ────────────────────────────────────────────────────────────────

  private buildProfileSheet(
    wb: ExcelJS.Workbook,
    args: {
      course: NonNullable<
        Awaited<ReturnType<typeof coursesRepository.findById>>
      >;
      watchTime: Awaited<ReturnType<typeof watchTimeAnalyticsRepository.getCourseWatchTime>>;
      quizAnalytics: Awaited<ReturnType<typeof getCourseQuizAnalytics>>;
      assignmentAnalytics: Awaited<ReturnType<typeof getCourseAssignmentAnalytics>>;
      generatedAt: Date;
    }
  ): void {
    const ws = wb.addWorksheet("Course Profile & KPIs", {
      properties: { tabColor: { argb: BRAND_PRIMARY } },
      views: [{ state: "normal", showGridLines: false }],
    });
    ws.columns = [
      { width: 28 },
      { width: 32 },
      { width: 4 },
      { width: 28 },
      { width: 32 },
    ];

    ws.mergeCells("A1:E2");
    const banner = ws.getCell("A1");
    banner.value = "Course Analytics Report";
    banner.font = { size: 22, bold: true, color: { argb: "FFFFFFFF" } };
    banner.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
    banner.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_PRIMARY },
    };
    ws.getRow(1).height = 28;
    ws.getRow(2).height = 28;

    ws.mergeCells("A3:E3");
    const sub = ws.getCell("A3");
    sub.value = `Generated ${args.generatedAt.toUTCString()}`;
    sub.font = { color: { argb: COLOR_MUTED }, italic: true, size: 10 };
    sub.alignment = { vertical: "middle", indent: 2 };

    // Course section
    ws.mergeCells("A5:E5");
    const courseHdr = ws.getCell("A5");
    courseHdr.value = "Course";
    courseHdr.font = { bold: true, size: 12, color: { argb: COLOR_HEADER_TEXT } };
    courseHdr.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_HEADER_FILL },
    };
    courseHdr.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(5).height = 20;

    const meta: Array<[string, string]> = [
      ["Title", decodeHtmlEntities(args.course.title) || "Untitled"],
      ["Mode", String(args.course.mode ?? "-").replace("_", " ")],
      ["Status", String(args.course.status ?? "-")],
      ["Course ID", args.course.id],
    ];
    meta.forEach(([k, v], i) => {
      const r = 6 + i;
      const keyCell = ws.getCell(`A${r}`);
      keyCell.value = k;
      keyCell.font = { color: { argb: COLOR_MUTED }, bold: true, size: 10 };
      keyCell.alignment = { vertical: "middle", indent: 1 };
      const valCell = ws.getCell(`B${r}`);
      valCell.value = v;
      valCell.font = { bold: true, size: 11 };
      valCell.alignment = { vertical: "middle" };
      ws.getRow(r).height = 18;
    });

    // KPIs
    const kpiStart = 12;
    ws.mergeCells(`A${kpiStart}:E${kpiStart}`);
    const kpiHdr = ws.getCell(`A${kpiStart}`);
    kpiHdr.value = "Headline Metrics";
    kpiHdr.font = { bold: true, size: 12, color: { argb: COLOR_HEADER_TEXT } };
    kpiHdr.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_HEADER_FILL },
    };
    kpiHdr.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(kpiStart).height = 20;

    let totalWatchSeconds = 0;
    let totalSessions = 0;
    let totalUniquePeak = 0;
    let avgCompletionSum = 0;
    for (const l of args.watchTime.perLecture) {
      totalWatchSeconds += toInt(l.total_seconds);
      totalSessions += toInt(l.sessions_count);
      if (toInt(l.max_daily_members) > totalUniquePeak)
        totalUniquePeak = toInt(l.max_daily_members);
      avgCompletionSum += toInt(l.avg_completion_pct);
    }
    const avgCompletion =
      args.watchTime.perLecture.length > 0
        ? Math.round(avgCompletionSum / args.watchTime.perLecture.length)
        : 0;

    let quizAttempts = 0;
    let quizScoreSum = 0;
    let quizScored = 0;
    let quizPassSum = 0;
    let quizRated = 0;
    for (const q of args.quizAnalytics.quizzes) {
      quizAttempts += q.attempt_count;
      if (q.average_score != null) {
        quizScoreSum += q.average_score;
        quizScored += 1;
      }
      if (q.pass_rate != null) {
        quizPassSum += q.pass_rate;
        quizRated += 1;
      }
    }
    const avgQuizScore = quizScored > 0 ? Math.round(quizScoreSum / quizScored) : 0;
    const avgQuizPass = quizRated > 0 ? Math.round(quizPassSum / quizRated) : 0;

    let assignmentSubs = 0;
    let assignmentRateSum = 0;
    let assignmentCount = 0;
    let pendingEval = 0;
    for (const a of args.assignmentAnalytics.assignments) {
      assignmentSubs += a.submission_count;
      assignmentRateSum += a.submission_rate;
      assignmentCount += 1;
      pendingEval += a.pending_evaluation;
    }
    const avgSubmissionRate =
      assignmentCount > 0
        ? Math.round(assignmentRateSum / assignmentCount)
        : 0;

    const kpis: Array<{ label: string; value: string; sub: string; color: string }> = [
      {
        label: "Total watch time",
        value: formatHms(totalWatchSeconds),
        sub: `${totalSessions} sessions, peak ${totalUniquePeak} learners / day`,
        color: BRAND_PRIMARY,
      },
      {
        label: "Avg video completion",
        value: `${avgCompletion}%`,
        sub: `across ${args.watchTime.perLecture.length} lectures touched`,
        color: BRAND_ACCENT,
      },
      {
        label: "Quiz attempts",
        value: String(quizAttempts),
        sub: `${avgQuizScore}% avg score, ${avgQuizPass}% pass rate`,
        color: COLOR_GOOD,
      },
      {
        label: "Assignment submissions",
        value: String(assignmentSubs),
        sub: `${avgSubmissionRate}% submission rate, ${pendingEval} pending review`,
        color: COLOR_WARN,
      },
      {
        label: "Enrolled learners",
        value: String(args.quizAnalytics.enrolled_count),
        sub:
          args.assignmentAnalytics.enrolled_count !==
          args.quizAnalytics.enrolled_count
            ? `${args.assignmentAnalytics.enrolled_count} on assignment side`
            : "across all assessments",
        color: COLOR_MUTED,
      },
    ];

    let kpiRow = kpiStart + 2;
    kpis.forEach((k) => {
      const r1 = kpiRow;
      const r2 = kpiRow + 1;
      const r3 = kpiRow + 2;
      ws.mergeCells(`A${r1}:B${r1}`);
      const lc = ws.getCell(`A${r1}`);
      lc.value = k.label.toUpperCase();
      lc.font = { size: 9, bold: true, color: { argb: COLOR_MUTED } };
      lc.alignment = { vertical: "middle", indent: 1 };
      lc.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_PRIMARY_LIGHT },
      };
      ws.mergeCells(`A${r2}:B${r2}`);
      const vc = ws.getCell(`A${r2}`);
      vc.value = k.value;
      vc.font = { size: 20, bold: true, color: { argb: k.color } };
      vc.alignment = { vertical: "middle", indent: 1 };
      vc.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_PRIMARY_LIGHT },
      };
      ws.mergeCells(`A${r3}:B${r3}`);
      const sc = ws.getCell(`A${r3}`);
      sc.value = k.sub;
      sc.font = { size: 10, color: { argb: COLOR_MUTED }, italic: true };
      sc.alignment = { vertical: "middle", indent: 1 };
      sc.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_PRIMARY_LIGHT },
      };
      ws.getRow(r1).height = 16;
      ws.getRow(r2).height = 32;
      ws.getRow(r3).height = 18;
      kpiRow += 4;
    });
  }

  private buildVideoSheet(
    wb: ExcelJS.Workbook,
    watchTime: Awaited<ReturnType<typeof watchTimeAnalyticsRepository.getCourseWatchTime>>
  ): void {
    const ws = wb.addWorksheet("Video Performance", {
      properties: { tabColor: { argb: BRAND_ACCENT } },
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = [
      { header: "Lecture", key: "lecture", width: 44 },
      { header: "Watch time", key: "watch_human", width: 18 },
      { header: "Watch seconds", key: "watch_seconds", width: 14 },
      { header: "Sessions", key: "sessions", width: 12 },
      { header: "Peak daily learners", key: "peak", width: 20 },
      { header: "Avg completion %", key: "completion", width: 18 },
    ];
    setHeaderRow(ws, 1, ws.columns.length);

    const sorted = [...watchTime.perLecture].sort(
      (a, b) => toInt(b.total_seconds) - toInt(a.total_seconds)
    );
    sorted.forEach((l) => {
      const seconds = toInt(l.total_seconds);
      ws.addRow({
        lecture: decodeHtmlEntities(l.title) || "Untitled",
        watch_human: formatHms(seconds),
        watch_seconds: seconds,
        sessions: toInt(l.sessions_count),
        peak: toInt(l.max_daily_members),
        completion: toInt(l.avg_completion_pct) / 100,
      });
    });

    ws.getColumn("completion").numFmt = "0%";

    const lastRow = sorted.length + 1;
    if (lastRow > 1) {
      bandRows(ws, 2, lastRow, ws.columns.length);
      addDataBar(ws, `C2:C${lastRow}`, BRAND_PRIMARY);
      addDataBar(ws, `D2:D${lastRow}`, BRAND_ACCENT);
      addDataBar(ws, `E2:E${lastRow}`, COLOR_GOOD);
      addColorScale(ws, `F2:F${lastRow}`, true);
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columns.length },
      };
    } else {
      ws.mergeCells("A3:F3");
      const empty = ws.getCell("A3");
      empty.value = "No watch data recorded for this course yet.";
      empty.font = { italic: true, color: { argb: COLOR_MUTED } };
      empty.alignment = { horizontal: "center" };
    }
  }

  private buildQuizSheet(
    wb: ExcelJS.Workbook,
    quizAnalytics: Awaited<ReturnType<typeof getCourseQuizAnalytics>>
  ): void {
    const ws = wb.addWorksheet("Quiz Performance", {
      properties: { tabColor: { argb: COLOR_GOOD } },
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = [
      { header: "Quiz", key: "quiz", width: 36 },
      { header: "Scope", key: "scope", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Max score", key: "max_score", width: 12 },
      { header: "Pass %", key: "pass_threshold", width: 10 },
      { header: "Attempts", key: "attempts", width: 12 },
      { header: "Attempt rate", key: "attempt_rate", width: 14 },
      { header: "Passed", key: "passed", width: 10 },
      { header: "Failed", key: "failed", width: 10 },
      { header: "Avg score %", key: "avg_score", width: 14 },
      { header: "Pass rate", key: "pass_rate", width: 12 },
    ];
    setHeaderRow(ws, 1, ws.columns.length);

    const sorted = [...quizAnalytics.quizzes].sort(
      (a, b) => b.attempt_count - a.attempt_count
    );
    sorted.forEach((q) => {
      ws.addRow({
        quiz: decodeHtmlEntities(q.title),
        scope: q.scope,
        status: q.status,
        max_score: q.max_score,
        pass_threshold: q.pass_percentage / 100,
        attempts: q.attempt_count,
        attempt_rate: q.attempt_rate / 100,
        passed: q.passed_count,
        failed: q.failed_count,
        avg_score: q.average_score != null ? q.average_score / 100 : null,
        pass_rate: q.pass_rate != null ? q.pass_rate / 100 : null,
      });
    });

    ws.getColumn("pass_threshold").numFmt = "0%";
    ws.getColumn("attempt_rate").numFmt = "0%";
    ws.getColumn("avg_score").numFmt = "0%";
    ws.getColumn("pass_rate").numFmt = "0%";

    const lastRow = sorted.length + 1;
    if (lastRow > 1) {
      bandRows(ws, 2, lastRow, ws.columns.length);
      addDataBar(ws, `F2:F${lastRow}`, BRAND_PRIMARY);
      addDataBar(ws, `G2:G${lastRow}`, BRAND_ACCENT);
      addColorScale(ws, `J2:J${lastRow}`);
      addColorScale(ws, `K2:K${lastRow}`);
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columns.length },
      };
    } else {
      ws.mergeCells("A3:K3");
      const empty = ws.getCell("A3");
      empty.value = "No quizzes published in this course yet.";
      empty.font = { italic: true, color: { argb: COLOR_MUTED } };
      empty.alignment = { horizontal: "center" };
    }
  }

  private buildAssignmentSheet(
    wb: ExcelJS.Workbook,
    assignmentAnalytics: Awaited<ReturnType<typeof getCourseAssignmentAnalytics>>
  ): void {
    const ws = wb.addWorksheet("Assignment Performance", {
      properties: { tabColor: { argb: COLOR_WARN } },
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = [
      { header: "Assignment", key: "assignment", width: 36 },
      { header: "Scope", key: "scope", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Max score", key: "max_score", width: 12 },
      { header: "Submissions", key: "submissions", width: 14 },
      { header: "Submission rate", key: "submission_rate", width: 16 },
      { header: "Evaluated", key: "evaluated", width: 12 },
      { header: "Pending eval", key: "pending", width: 14 },
      { header: "Avg score %", key: "avg_score", width: 14 },
      { header: "Pass rate", key: "pass_rate", width: 12 },
    ];
    setHeaderRow(ws, 1, ws.columns.length);

    const sorted = [...assignmentAnalytics.assignments].sort(
      (a, b) => b.submission_count - a.submission_count
    );
    sorted.forEach((a) => {
      ws.addRow({
        assignment: decodeHtmlEntities(a.title),
        scope: a.scope,
        status: a.status,
        max_score: a.max_score,
        submissions: a.submission_count,
        submission_rate: a.submission_rate / 100,
        evaluated: a.evaluated_count,
        pending: a.pending_evaluation,
        avg_score: a.average_score != null ? a.average_score / 100 : null,
        pass_rate: a.pass_rate != null ? a.pass_rate / 100 : null,
      });
    });

    ws.getColumn("submission_rate").numFmt = "0%";
    ws.getColumn("avg_score").numFmt = "0%";
    ws.getColumn("pass_rate").numFmt = "0%";

    const lastRow = sorted.length + 1;
    if (lastRow > 1) {
      bandRows(ws, 2, lastRow, ws.columns.length);
      addDataBar(ws, `E2:E${lastRow}`, BRAND_PRIMARY);
      addDataBar(ws, `F2:F${lastRow}`, BRAND_ACCENT);
      addColorScale(ws, `I2:I${lastRow}`);
      addColorScale(ws, `J2:J${lastRow}`);

      // Pending eval > 0 highlight (color scale, more pending = redder)
      addColorScale(ws, `H2:H${lastRow}`, true);

      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columns.length },
      };
    } else {
      ws.mergeCells("A3:J3");
      const empty = ws.getCell("A3");
      empty.value = "No assignments published in this course yet.";
      empty.font = { italic: true, color: { argb: COLOR_MUTED } };
      empty.alignment = { horizontal: "center" };
    }
  }

  private buildDailyEngagementSheet(
    wb: ExcelJS.Workbook,
    rows: DailyEngagementRow[]
  ): void {
    const ws = wb.addWorksheet("Daily Engagement (90d)", {
      properties: { tabColor: { argb: COLOR_BAD } },
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Day", key: "day", width: 12 },
      { header: "Watch time", key: "human", width: 16 },
      { header: "Watch seconds", key: "seconds", width: 16 },
      { header: "Quiz attempts", key: "quiz", width: 14 },
      { header: "Assignment submissions", key: "submissions", width: 22 },
    ];
    setHeaderRow(ws, 1, ws.columns.length);

    rows.forEach((r) => {
      const d = r.activity_date instanceof Date ? r.activity_date : new Date(r.activity_date);
      ws.addRow({
        date: d,
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        human: formatHms(r.watch_seconds),
        seconds: r.watch_seconds,
        quiz: r.quiz_attempts,
        submissions: r.assignment_submissions,
      });
    });

    ws.getColumn("date").numFmt = "yyyy-mm-dd";

    const lastRow = rows.length + 1;
    if (lastRow > 1) {
      bandRows(ws, 2, lastRow, ws.columns.length);
      // Wide data bars on each metric so the sheet reads like three stacked
      // 90-day mini bar charts. Watch is the heaviest; quiz/assignment are
      // categorical counts.
      addDataBar(ws, `D2:D${lastRow}`, COLOR_BAD);
      addDataBar(ws, `E2:E${lastRow}`, BRAND_PRIMARY);
      addDataBar(ws, `F2:F${lastRow}`, COLOR_WARN);
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columns.length },
      };
    } else {
      ws.mergeCells("A3:F3");
      const empty = ws.getCell("A3");
      empty.value = "No engagement recorded in the last 90 days.";
      empty.font = { italic: true, color: { argb: COLOR_MUTED } };
      empty.alignment = { horizontal: "center" };
    }
  }

  private buildTopLearnersSheet(
    wb: ExcelJS.Workbook,
    rows: CourseTopLearnerRow[]
  ): void {
    const ws = wb.addWorksheet("Top Learners (25)", {
      properties: { tabColor: { argb: BRAND_PRIMARY } },
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Learner", key: "name", width: 28 },
      { header: "Email", key: "email", width: 32 },
      { header: "Status", key: "status", width: 12 },
      { header: "Enrolled", key: "enrolled", width: 14 },
      { header: "Lectures completed", key: "completed", width: 18 },
      { header: "Watch time", key: "watch_human", width: 16 },
      { header: "Watch seconds", key: "watch_seconds", width: 16 },
      { header: "Time spent incl. rewatches", key: "time_spent", width: 26 },
      { header: "Quiz attempts", key: "quiz", width: 14 },
      { header: "Quiz avg %", key: "quiz_avg", width: 12 },
      { header: "Assignment submissions", key: "assignments", width: 22 },
      { header: "Last activity", key: "last_activity", width: 16 },
    ];
    setHeaderRow(ws, 1, ws.columns.length);

    rows.forEach((r, i) => {
      const watchedSeconds = toInt(r.watched_seconds);
      const totalWatch = toInt(r.total_watch_seconds);
      ws.addRow({
        rank: i + 1,
        name: decodeHtmlEntities(r.member_name) || "Unknown",
        email: decodeHtmlEntities(r.member_email) || "-",
        status: r.enrollment_status,
        enrolled: r.enrolled_at ? new Date(r.enrolled_at) : null,
        completed: toInt(r.completed_lectures),
        watch_human: formatHms(watchedSeconds),
        watch_seconds: watchedSeconds,
        time_spent: formatHms(totalWatch),
        quiz: toInt(r.quiz_attempts),
        quiz_avg: toInt(r.quiz_avg_score) / 100,
        assignments: toInt(r.assignment_submissions),
        last_activity: r.last_activity_at ? new Date(r.last_activity_at) : null,
      });
    });

    ws.getColumn("enrolled").numFmt = "yyyy-mm-dd";
    ws.getColumn("last_activity").numFmt = "yyyy-mm-dd hh:mm";
    ws.getColumn("quiz_avg").numFmt = "0%";

    const lastRow = rows.length + 1;
    if (lastRow > 1) {
      bandRows(ws, 2, lastRow, ws.columns.length);
      addDataBar(ws, `F2:F${lastRow}`, COLOR_GOOD);
      addDataBar(ws, `H2:H${lastRow}`, BRAND_PRIMARY);
      addDataBar(ws, `J2:J${lastRow}`, BRAND_ACCENT);
      addDataBar(ws, `L2:L${lastRow}`, COLOR_WARN);
      addColorScale(ws, `K2:K${lastRow}`);
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columns.length },
      };
    } else {
      ws.mergeCells("A3:M3");
      const empty = ws.getCell("A3");
      empty.value = "No enrolled learners for this course yet.";
      empty.font = { italic: true, color: { argb: COLOR_MUTED } };
      empty.alignment = { horizontal: "center" };
    }
  }
}

export default new CourseAnalyticsExportService();
