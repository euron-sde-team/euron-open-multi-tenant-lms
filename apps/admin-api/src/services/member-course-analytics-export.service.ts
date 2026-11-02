import ExcelJS from "exceljs";

import { BadRequestError } from "../errors/bad-request.error";
import memberCourseAnalyticsRepository, {
  type CourseAnalyticsSummaryRow,
  type ExportLectureRow,
  type MemberDailyActivityRow,
  type SectionAnalyticsRow,
} from "../repositories/member-course-analytics.repository";
import membersRepository from "../repositories/members.repository";
import { decodeHtmlEntities } from "../utils/html-entities.util";

import memberCourseAnalyticsService, {
  type AssignmentAnalyticsItem,
  type QuizAnalyticsItem,
} from "./member-course-analytics.service";
import { BRAND } from "../lib/brand";

/**
 * Builds a feature-rich .xlsx workbook for one learner's course analytics.
 *
 * Seven sheets:
 *   1. Profile & KPIs       - student identity + headline numbers
 *   2. Course Summary       - one row per enrolled course
 *   3. Section Analytics    - one row per (course, section)
 *   4. Lecture Detail       - one row per lecture
 *   5. Quiz Results         - one row per PUBLISHED quiz (best attempt)
 *   6. Assignment Results   - one row per PUBLISHED assignment (latest submission)
 *   7. Daily Activity (90d) - one row per day from lecture_watch_sessions
 *
 * Visual treatment: native Excel data bars on percentage and time columns,
 * three-stop color scales on engagement metrics, frozen headers + autofilters
 * on data sheets, branded header rows and KPI tiles on the cover sheet.
 *
 * Total DB calls: 7 (member detail, summary, section analytics, lecture
 * detail, quiz analytics, assignment analytics, daily activity). All scoped by
 * tenant_id + member_id; no N+1.
 */

// ────────────────────────────────────────────────────────────────────
// Color palette
// ────────────────────────────────────────────────────────────────────
const BRAND_PRIMARY = "FF1E40AF"; // indigo-800
const BRAND_PRIMARY_LIGHT = "FFDBEAFE"; // indigo-100
const BRAND_ACCENT = "FF6366F1"; // indigo-500
const COLOR_HEADER_FILL = "FF111827"; // gray-900
const COLOR_HEADER_TEXT = "FFFFFFFF";
const COLOR_BAND_FILL = "FFF3F4F6"; // gray-100
const COLOR_GOOD = "FF10B981"; // emerald-500
const COLOR_WARN = "FFFBBF24"; // amber-400
const COLOR_BAD = "FFEF4444"; // red-500
const COLOR_MUTED = "FF6B7280"; // gray-500

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
const toInt = (val: unknown): number => {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") {
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number(val) || 0;
};

const pct = (num: number, den: number): number => {
  if (!den || den <= 0) return 0;
  const v = Math.round((num / den) * 100);
  return Math.min(100, Math.max(0, v));
};

const formatHms = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "0m 0s";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
};

const daysSince = (d: Date | null | undefined): number | null => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
};

const sanitizeFile = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "learner";

/**
 * Last 5 characters of an ID, uppercased: a short unique suffix that keeps
 * file names readable while preventing collisions between learners with
 * identical names. ULIDs randomise the trailing chars so this is effectively
 * unique without being noisy.
 */
const shortIdSuffix = (id: string): string =>
  id.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase() || "00000";

// ────────────────────────────────────────────────────────────────────
// Sheet styling primitives
// ────────────────────────────────────────────────────────────────────
function setHeaderRow(
  ws: ExcelJS.Worksheet,
  row: number,
  columns: number
): void {
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
        cfvo: [
          { type: "min" },
          { type: "max" },
        ],
        color: { argb: color },
        showValue,
        gradient: true,
      } as ExcelJS.DataBarRuleType,
    ],
  });
}

/**
 * Colours a status column with solid "pill" fills, one containsText rule per
 * status. Rules are ordered so the more-specific/severe status wins ties
 * (e.g. "Resubmission requested" is listed before "Submitted" so the substring
 * "Submitted" in "Resubmission requested" doesn't steal its colour).
 */
function addStatusPills(
  ws: ExcelJS.Worksheet,
  ref: string,
  pills: Array<{ text: string; fill: string; textLight: boolean }>
): void {
  ws.addConditionalFormatting({
    ref,
    rules: pills.map((p, i) => ({
      type: "containsText",
      operator: "containsText",
      text: p.text,
      priority: i + 1,
      style: {
        font: {
          bold: p.textLight,
          color: { argb: p.textLight ? "FFFFFFFF" : COLOR_MUTED },
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          bgColor: { argb: p.fill },
        },
      },
    })) as ExcelJS.ContainsTextRuleType[],
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
// Sheet builders
// ────────────────────────────────────────────────────────────────────
function buildProfileSheet(
  wb: ExcelJS.Workbook,
  args: {
    student: {
      name: string;
      email: string | null;
      phone: string | null;
      status: string;
      joined_at: Date;
      last_login_at: Date | null;
    };
    courses: ReturnType<typeof normalizeCourseSummaries>;
    generatedAt: Date;
  }
): void {
  const ws = wb.addWorksheet("Profile & KPIs", {
    properties: { tabColor: { argb: BRAND_PRIMARY } },
    views: [{ state: "normal", showGridLines: false }],
  });
  ws.columns = [
    { width: 24 },
    { width: 28 },
    { width: 4 },
    { width: 24 },
    { width: 28 },
  ];

  // Banner
  ws.mergeCells("A1:E2");
  const banner = ws.getCell("A1");
  banner.value = "Course Analytics Report";
  banner.font = {
    name: "Calibri",
    size: 22,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
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

  // Student section header
  ws.mergeCells("A5:E5");
  const studentHdr = ws.getCell("A5");
  studentHdr.value = "Learner";
  studentHdr.font = {
    bold: true,
    size: 12,
    color: { argb: COLOR_HEADER_TEXT },
  };
  studentHdr.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR_HEADER_FILL },
  };
  studentHdr.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(5).height = 20;

  const studentRows: Array<[string, string]> = [
    ["Name", decodeHtmlEntities(args.student.name) || "-"],
    ["Email", decodeHtmlEntities(args.student.email) || "-"],
    ["Phone", decodeHtmlEntities(args.student.phone) || "-"],
    ["Status", args.student.status],
    [
      "Member since",
      args.student.joined_at
        ? new Date(args.student.joined_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "-",
    ],
    [
      "Last login",
      args.student.last_login_at
        ? new Date(args.student.last_login_at).toLocaleString("en-US")
        : "-",
    ],
  ];
  studentRows.forEach(([k, v], i) => {
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

  // KPI section
  const kpiStart = 13;
  ws.mergeCells(`A${kpiStart}:E${kpiStart}`);
  const kpiHdr = ws.getCell(`A${kpiStart}`);
  kpiHdr.value = "Headline Metrics";
  kpiHdr.font = {
    bold: true,
    size: 12,
    color: { argb: COLOR_HEADER_TEXT },
  };
  kpiHdr.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR_HEADER_FILL },
  };
  kpiHdr.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(kpiStart).height = 20;

  const totalCourses = args.courses.length;
  const totalLectures = args.courses.reduce(
    (a, c) => a + c.total_lectures,
    0
  );
  const completedLectures = args.courses.reduce(
    (a, c) => a + c.completed_lectures,
    0
  );
  const watchedSeconds = args.courses.reduce(
    (a, c) => a + c.watched_seconds,
    0
  );
  const totalDurationSeconds = args.courses.reduce(
    (a, c) => a + c.total_duration_seconds,
    0
  );
  const timeSpentSeconds = args.courses.reduce(
    (a, c) => a + c.total_watch_seconds,
    0
  );
  const coursesCompleted = args.courses.filter(
    (c) =>
      c.total_lectures > 0 && c.completed_lectures === c.total_lectures
  ).length;
  const lastActivity = args.courses
    .map((c) => (c.last_activity_at ? new Date(c.last_activity_at) : null))
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const kpis: Array<{ label: string; value: string; sub: string; color: string }> = [
    {
      label: "Courses enrolled",
      value: String(totalCourses),
      sub: `${coursesCompleted} fully completed`,
      color: BRAND_PRIMARY,
    },
    {
      label: "Videos watched",
      value: `${completedLectures} / ${totalLectures}`,
      sub: `${pct(completedLectures, totalLectures)}% complete`,
      color: BRAND_ACCENT,
    },
    {
      label: "Watched",
      value: formatHms(watchedSeconds),
      sub:
        totalDurationSeconds > 0
          ? `of ${formatHms(totalDurationSeconds)}`
          : "total duration unknown",
      color: COLOR_GOOD,
    },
    {
      label: "Time spent",
      value: formatHms(timeSpentSeconds),
      sub: "includes rewatches",
      color: COLOR_WARN,
    },
    {
      label: "Last activity",
      value: lastActivity
        ? `${daysSince(lastActivity)}d ago`
        : "Never",
      sub: lastActivity
        ? lastActivity.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "",
      color: COLOR_MUTED,
    },
  ];

  // Render KPI tiles as merged 3-row blocks per metric
  let kpiRow = kpiStart + 2;
  kpis.forEach((k) => {
    const r1 = kpiRow;
    const r2 = kpiRow + 1;
    const r3 = kpiRow + 2;
    // Label
    ws.mergeCells(`A${r1}:B${r1}`);
    const lc = ws.getCell(`A${r1}`);
    lc.value = k.label.toUpperCase();
    lc.font = {
      size: 9,
      bold: true,
      color: { argb: COLOR_MUTED },
    };
    lc.alignment = { vertical: "middle", indent: 1 };
    lc.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_PRIMARY_LIGHT },
    };
    // Value
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
    // Subtext
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

interface NormalizedCourseSummary {
  course_id: string;
  course_title: string;
  course_slug: string;
  course_mode: string;
  enrollment_status: string;
  enrollment_source: string;
  enrolled_at: Date;
  completed_at: Date | null;
  total_lectures: number;
  completed_lectures: number;
  touched_lectures: number;
  not_started_lectures: number;
  completion_percent: number;
  total_duration_seconds: number;
  watched_seconds: number;
  total_watch_seconds: number;
  last_activity_at: Date | null;
}

function normalizeCourseSummaries(
  rows: CourseAnalyticsSummaryRow[]
): NormalizedCourseSummary[] {
  return rows.map((r) => {
    const totalLectures = toInt(r.total_lectures);
    const completedLectures = toInt(r.completed_lectures);
    const touchedLectures = toInt(r.touched_lectures);
    return {
      course_id: r.course_id,
      course_title: r.course_title,
      course_slug: r.course_slug,
      course_mode: r.course_mode,
      enrollment_status: r.enrollment_status,
      enrollment_source: r.enrollment_source,
      enrolled_at: r.enrolled_at,
      completed_at: r.completed_at,
      total_lectures: totalLectures,
      completed_lectures: completedLectures,
      touched_lectures: touchedLectures,
      not_started_lectures: Math.max(0, totalLectures - touchedLectures),
      completion_percent: pct(completedLectures, totalLectures),
      total_duration_seconds: toInt(r.total_duration_seconds),
      watched_seconds: toInt(r.watched_seconds),
      total_watch_seconds: toInt(r.total_watch_seconds),
      last_activity_at: r.last_activity_at,
    };
  });
}

function buildCourseSummarySheet(
  wb: ExcelJS.Workbook,
  courses: NormalizedCourseSummary[]
): void {
  const ws = wb.addWorksheet("Course Summary", {
    properties: { tabColor: { argb: BRAND_ACCENT } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Course", key: "course", width: 36 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Source", key: "source", width: 14 },
    { header: "Enrolled", key: "enrolled", width: 14 },
    { header: "Completed on", key: "completed_on", width: 14 },
    { header: "Total videos", key: "total", width: 12 },
    { header: "Completed", key: "completed", width: 11 },
    { header: "In progress", key: "in_progress", width: 12 },
    { header: "Not started", key: "not_started", width: 12 },
    { header: "Completion %", key: "completion_pct", width: 14 },
    { header: "Watched", key: "watched", width: 14 },
    { header: "Total duration", key: "total_duration", width: 16 },
    { header: "Watched %", key: "watched_pct", width: 12 },
    { header: "Time spent (incl. rewatches)", key: "time_spent", width: 26 },
    { header: "Rewatch ratio", key: "rewatch_ratio", width: 14 },
    { header: "Last activity", key: "last_activity", width: 16 },
    { header: "Days since", key: "days_since", width: 12 },
  ];

  setHeaderRow(ws, 1, ws.columns.length);

  courses.forEach((c) => {
    const watchedPct = pct(c.watched_seconds, c.total_duration_seconds);
    const rewatchRatio =
      c.watched_seconds > 0
        ? Math.round((c.total_watch_seconds / c.watched_seconds) * 100) / 100
        : 0;
    ws.addRow({
      course: decodeHtmlEntities(c.course_title),
      mode: c.course_mode.replace("_", " "),
      status: c.enrollment_status,
      source: c.enrollment_source,
      enrolled: c.enrolled_at
        ? new Date(c.enrolled_at)
        : null,
      completed_on: c.completed_at ? new Date(c.completed_at) : null,
      total: c.total_lectures,
      completed: c.completed_lectures,
      in_progress: Math.max(0, c.touched_lectures - c.completed_lectures),
      not_started: c.not_started_lectures,
      completion_pct: c.completion_percent / 100,
      watched: formatHms(c.watched_seconds),
      total_duration:
        c.total_duration_seconds > 0
          ? formatHms(c.total_duration_seconds)
          : "-",
      watched_pct: watchedPct / 100,
      time_spent: formatHms(c.total_watch_seconds),
      rewatch_ratio: rewatchRatio,
      last_activity: c.last_activity_at
        ? new Date(c.last_activity_at)
        : null,
      days_since: daysSince(c.last_activity_at),
    });
  });

  // Number formats
  ws.getColumn("completion_pct").numFmt = "0%";
  ws.getColumn("watched_pct").numFmt = "0%";
  ws.getColumn("rewatch_ratio").numFmt = "0.00\"x\"";
  ws.getColumn("enrolled").numFmt = "yyyy-mm-dd";
  ws.getColumn("completed_on").numFmt = "yyyy-mm-dd";
  ws.getColumn("last_activity").numFmt = "yyyy-mm-dd hh:mm";

  const lastRow = courses.length + 1;
  if (lastRow > 1) {
    bandRows(ws, 2, lastRow, ws.columns.length);
    addDataBar(ws, `K2:K${lastRow}`, BRAND_PRIMARY);
    addDataBar(ws, `N2:N${lastRow}`, BRAND_ACCENT);
    addColorScale(ws, `P2:P${lastRow}`);
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };
  }
}

interface NormalizedSection {
  course_title: string;
  section_title: string;
  section_sort: number;
  total_lectures: number;
  completed_lectures: number;
  touched_lectures: number;
  not_started_lectures: number;
  completion_percent: number;
  total_duration_seconds: number;
  watched_seconds: number;
  last_activity_at: Date | null;
}

function buildSectionAnalyticsSheet(
  wb: ExcelJS.Workbook,
  rows: SectionAnalyticsRow[]
): void {
  const ws = wb.addWorksheet("Section Analytics", {
    properties: { tabColor: { argb: COLOR_GOOD } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Course", key: "course", width: 32 },
    { header: "Section", key: "section", width: 36 },
    { header: "Order", key: "order", width: 8 },
    { header: "Total lectures", key: "total", width: 14 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "In progress", key: "in_progress", width: 12 },
    { header: "Not started", key: "not_started", width: 12 },
    { header: "Completion %", key: "completion_pct", width: 14 },
    { header: "Total duration", key: "total_duration", width: 16 },
    { header: "Watched", key: "watched", width: 16 },
    { header: "Last activity", key: "last_activity", width: 16 },
  ];

  setHeaderRow(ws, 1, ws.columns.length);

  const normalized: NormalizedSection[] = rows.map((r) => {
    const total = toInt(r.total_lectures);
    const completed = toInt(r.completed_lectures);
    const touched = toInt(r.touched_lectures);
    return {
      course_title: r.course_title,
      section_title: r.section_title,
      section_sort: r.section_sort,
      total_lectures: total,
      completed_lectures: completed,
      touched_lectures: touched,
      not_started_lectures: Math.max(0, total - touched),
      completion_percent: pct(completed, total),
      total_duration_seconds: toInt(r.total_duration_seconds),
      watched_seconds: toInt(r.watched_seconds),
      last_activity_at: r.last_activity_at,
    };
  });

  normalized.forEach((s) => {
    ws.addRow({
      course: decodeHtmlEntities(s.course_title),
      section: decodeHtmlEntities(s.section_title),
      order: s.section_sort,
      total: s.total_lectures,
      completed: s.completed_lectures,
      in_progress: Math.max(0, s.touched_lectures - s.completed_lectures),
      not_started: s.not_started_lectures,
      completion_pct: s.completion_percent / 100,
      total_duration:
        s.total_duration_seconds > 0
          ? formatHms(s.total_duration_seconds)
          : "-",
      watched: formatHms(s.watched_seconds),
      last_activity: s.last_activity_at
        ? new Date(s.last_activity_at)
        : null,
    });
  });

  ws.getColumn("completion_pct").numFmt = "0%";
  ws.getColumn("last_activity").numFmt = "yyyy-mm-dd hh:mm";

  const lastRow = normalized.length + 1;
  if (lastRow > 1) {
    bandRows(ws, 2, lastRow, ws.columns.length);
    addDataBar(ws, `H2:H${lastRow}`, COLOR_GOOD);
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };
  }
}

function buildLectureDetailSheet(
  wb: ExcelJS.Workbook,
  lectures: ExportLectureRow[]
): void {
  const ws = wb.addWorksheet("Lecture Detail", {
    properties: { tabColor: { argb: COLOR_WARN } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Course", key: "course", width: 28 },
    { header: "Section", key: "section", width: 28 },
    { header: "Lesson", key: "lesson", width: 28 },
    { header: "Lecture", key: "lecture", width: 32 },
    { header: "Status", key: "status", width: 14 },
    { header: "Watched %", key: "watched_pct", width: 12 },
    { header: "Watched", key: "watched", width: 14 },
    { header: "Duration", key: "duration", width: 14 },
    { header: "Time spent (incl. rewatches)", key: "time_spent", width: 26 },
    { header: "Rewatch ratio", key: "rewatch_ratio", width: 14 },
    { header: "Resume at", key: "resume", width: 12 },
    { header: "Last watched", key: "last_watched", width: 16 },
    { header: "Days since", key: "days_since", width: 12 },
    { header: "Lecture ID", key: "lecture_id", width: 28 },
  ];

  setHeaderRow(ws, 1, ws.columns.length);

  lectures.forEach((l) => {
    const duration = toInt(l.duration_seconds);
    const watched = toInt(l.watched_seconds);
    const totalWatch = toInt(l.total_watch_seconds);
    const status = l.completed
      ? "Completed"
      : watched > 0 || totalWatch > 0
        ? "In progress"
        : "Not started";
    const rewatchRatio =
      watched > 0
        ? Math.round((totalWatch / watched) * 100) / 100
        : 0;
    ws.addRow({
      course: decodeHtmlEntities(l.course_title),
      section: decodeHtmlEntities(l.section_title),
      lesson: decodeHtmlEntities(l.lesson_title),
      lecture: decodeHtmlEntities(l.lecture_title),
      status,
      watched_pct: pct(watched, duration) / 100,
      watched: formatHms(watched),
      duration: duration > 0 ? formatHms(duration) : "-",
      time_spent: formatHms(totalWatch),
      rewatch_ratio: rewatchRatio,
      resume: formatHms(toInt(l.last_position_seconds)),
      last_watched: l.last_watched_at ? new Date(l.last_watched_at) : null,
      days_since: daysSince(l.last_watched_at),
      lecture_id: l.lecture_id,
    });
  });

  ws.getColumn("watched_pct").numFmt = "0%";
  ws.getColumn("rewatch_ratio").numFmt = "0.00\"x\"";
  ws.getColumn("last_watched").numFmt = "yyyy-mm-dd hh:mm";

  const lastRow = lectures.length + 1;
  if (lastRow > 1) {
    bandRows(ws, 2, lastRow, ws.columns.length);
    addDataBar(ws, `F2:F${lastRow}`, BRAND_PRIMARY);
    addColorScale(ws, `J2:J${lastRow}`);

    // Status pill coloring
    ws.addConditionalFormatting({
      ref: `E2:E${lastRow}`,
      rules: [
        {
          type: "containsText",
          operator: "containsText",
          text: "Completed",
          priority: 1,
          style: {
            font: { bold: true, color: { argb: "FFFFFFFF" } },
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: COLOR_GOOD },
            },
          },
        } as ExcelJS.ContainsTextRuleType,
        {
          type: "containsText",
          operator: "containsText",
          text: "In progress",
          priority: 2,
          style: {
            font: { bold: true, color: { argb: "FF111827" } },
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: COLOR_WARN },
            },
          },
        } as ExcelJS.ContainsTextRuleType,
        {
          type: "containsText",
          operator: "containsText",
          text: "Not started",
          priority: 3,
          style: {
            font: { color: { argb: COLOR_MUTED } },
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: COLOR_BAND_FILL },
            },
          },
        } as ExcelJS.ContainsTextRuleType,
      ],
    });

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };
  }
}

function buildDailyActivitySheet(
  wb: ExcelJS.Workbook,
  rows: MemberDailyActivityRow[]
): void {
  const ws = wb.addWorksheet("Daily Activity (90d)", {
    properties: { tabColor: { argb: COLOR_BAD } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Day", key: "day", width: 12 },
    { header: "Sessions", key: "sessions", width: 12 },
    { header: "Courses touched", key: "courses", width: 16 },
    { header: "Lectures touched", key: "lectures", width: 18 },
    { header: "Watch time (s)", key: "seconds", width: 16 },
    { header: "Watch time", key: "human", width: 16 },
  ];

  setHeaderRow(ws, 1, ws.columns.length);

  rows.forEach((r) => {
    const d = r.activity_date instanceof Date
      ? r.activity_date
      : new Date(r.activity_date);
    const seconds = toInt(r.total_seconds);
    ws.addRow({
      date: d,
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      sessions: toInt(r.sessions_count),
      courses: toInt(r.courses_touched),
      lectures: toInt(r.lectures_touched),
      seconds,
      human: formatHms(seconds),
    });
  });

  ws.getColumn("date").numFmt = "yyyy-mm-dd";

  const lastRow = rows.length + 1;
  if (lastRow > 1) {
    bandRows(ws, 2, lastRow, ws.columns.length);
    // The seconds column gets a wide data bar (chart-like for 90 days)
    addDataBar(ws, `F2:F${lastRow}`, COLOR_BAD);
    addDataBar(ws, `C2:C${lastRow}`, BRAND_PRIMARY, false);
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };
  } else {
    ws.mergeCells("A3:G3");
    const empty = ws.getCell("A3");
    empty.value = "No watch sessions recorded in the last 90 days.";
    empty.font = { italic: true, color: { argb: COLOR_MUTED } };
    empty.alignment = { horizontal: "center" };
  }
}

function titleize(raw: string): string {
  // "NOT_ATTEMPTED" -> "Not attempted"
  const lower = raw.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function buildQuizResultsSheet(
  wb: ExcelJS.Workbook,
  quizzes: QuizAnalyticsItem[]
): void {
  const ws = wb.addWorksheet("Quiz Results", {
    properties: { tabColor: { argb: BRAND_ACCENT } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Course", key: "course", width: 30 },
    { header: "Quiz", key: "quiz", width: 34 },
    { header: "Status", key: "status", width: 16 },
    { header: "Attempts", key: "attempts", width: 11 },
    { header: "Best score", key: "best_score", width: 12 },
    { header: "Out of", key: "out_of", width: 10 },
    { header: "Best %", key: "best_pct", width: 12 },
    { header: "Pass mark %", key: "pass_pct", width: 14 },
    { header: "Last attempt", key: "last_attempt", width: 16 },
  ];

  setHeaderRow(ws, 1, ws.columns.length);

  quizzes.forEach((q) => {
    ws.addRow({
      course: decodeHtmlEntities(q.course_title),
      quiz: decodeHtmlEntities(q.quiz_title),
      status: titleize(q.status),
      attempts: q.attempt_count,
      best_score: q.attempt_count > 0 ? q.best_score : "-",
      out_of: q.best_total_marks > 0 ? q.best_total_marks : q.max_score,
      best_pct: q.attempt_count > 0 ? q.best_percentage / 100 : null,
      pass_pct: q.pass_percentage / 100,
      last_attempt: q.last_attempt_at ? new Date(q.last_attempt_at) : null,
    });
  });

  ws.getColumn("best_pct").numFmt = "0%";
  ws.getColumn("pass_pct").numFmt = "0%";
  ws.getColumn("last_attempt").numFmt = "yyyy-mm-dd hh:mm";

  const lastRow = quizzes.length + 1;
  if (lastRow > 1) {
    bandRows(ws, 2, lastRow, ws.columns.length);
    addDataBar(ws, `G2:G${lastRow}`, BRAND_ACCENT);
    addStatusPills(ws, `C2:C${lastRow}`, [
      { text: "Passed", fill: COLOR_GOOD, textLight: true },
      { text: "Failed", fill: COLOR_BAD, textLight: true },
      { text: "In progress", fill: COLOR_WARN, textLight: false },
      { text: "Not attempted", fill: COLOR_BAND_FILL, textLight: false },
    ]);
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };
  } else {
    ws.mergeCells("A3:I3");
    const empty = ws.getCell("A3");
    empty.value = "No quizzes in this learner's enrolled courses.";
    empty.font = { italic: true, color: { argb: COLOR_MUTED } };
    empty.alignment = { horizontal: "center" };
  }
}

function buildAssignmentResultsSheet(
  wb: ExcelJS.Workbook,
  assignments: AssignmentAnalyticsItem[]
): void {
  const ws = wb.addWorksheet("Assignment Results", {
    properties: { tabColor: { argb: COLOR_GOOD } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Course", key: "course", width: 30 },
    { header: "Assignment", key: "assignment", width: 34 },
    { header: "Status", key: "status", width: 18 },
    { header: "Submitted", key: "submitted", width: 16 },
    { header: "On time", key: "on_time", width: 12 },
    { header: "Score", key: "score", width: 10 },
    { header: "Out of", key: "out_of", width: 10 },
    { header: "Score %", key: "score_pct", width: 12 },
    { header: "Due date", key: "due", width: 16 },
    { header: "Evaluated", key: "evaluated", width: 16 },
    { header: "Feedback", key: "feedback", width: 40 },
  ];

  setHeaderRow(ws, 1, ws.columns.length);

  assignments.forEach((a) => {
    const onTime =
      a.is_late == null ? "-" : a.is_late ? "Late" : "On time";
    ws.addRow({
      course: decodeHtmlEntities(a.course_title),
      assignment: decodeHtmlEntities(a.assignment_title),
      status: titleize(a.submission_status),
      submitted: a.submitted_at ? new Date(a.submitted_at) : null,
      on_time: onTime,
      score: a.is_evaluated && a.score != null ? a.score : "-",
      out_of: a.max_score > 0 ? a.max_score : "-",
      score_pct: a.score_percentage != null ? a.score_percentage / 100 : null,
      due: a.due_date ? new Date(a.due_date) : null,
      evaluated: a.evaluated_at ? new Date(a.evaluated_at) : null,
      feedback: a.feedback ? decodeHtmlEntities(a.feedback) : "",
    });
  });

  ws.getColumn("score_pct").numFmt = "0%";
  ws.getColumn("submitted").numFmt = "yyyy-mm-dd hh:mm";
  ws.getColumn("due").numFmt = "yyyy-mm-dd hh:mm";
  ws.getColumn("evaluated").numFmt = "yyyy-mm-dd hh:mm";

  const lastRow = assignments.length + 1;
  if (lastRow > 1) {
    bandRows(ws, 2, lastRow, ws.columns.length);
    addDataBar(ws, `H2:H${lastRow}`, COLOR_GOOD);
    addStatusPills(ws, `C2:C${lastRow}`, [
      { text: "Evaluated", fill: COLOR_GOOD, textLight: true },
      { text: "Under review", fill: BRAND_ACCENT, textLight: true },
      { text: "Resubmission requested", fill: COLOR_BAD, textLight: true },
      { text: "Submitted", fill: COLOR_WARN, textLight: false },
      { text: "Not submitted", fill: COLOR_BAND_FILL, textLight: false },
    ]);
    // "Late" flag in red, "On time" in green.
    ws.addConditionalFormatting({
      ref: `E2:E${lastRow}`,
      rules: [
        {
          type: "containsText",
          operator: "containsText",
          text: "Late",
          priority: 1,
          style: { font: { bold: true, color: { argb: COLOR_BAD } } },
        } as ExcelJS.ContainsTextRuleType,
        {
          type: "containsText",
          operator: "containsText",
          text: "On time",
          priority: 2,
          style: { font: { color: { argb: COLOR_GOOD } } },
        } as ExcelJS.ContainsTextRuleType,
      ],
    });
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };
  } else {
    ws.mergeCells("A3:K3");
    const empty = ws.getCell("A3");
    empty.value = "No assignments in this learner's enrolled courses.";
    empty.font = { italic: true, color: { argb: COLOR_MUTED } };
    empty.alignment = { horizontal: "center" };
  }
}

// ────────────────────────────────────────────────────────────────────
// Public service
// ────────────────────────────────────────────────────────────────────
export interface XlsxExportResult {
  buffer: Buffer;
  fileName: string;
}

class MemberCourseAnalyticsExportService {
  async buildWorkbook(
    tenantId: string,
    memberId: string
  ): Promise<XlsxExportResult> {
    if (!tenantId) throw new BadRequestError("Tenant context required");
    if (!memberId) throw new BadRequestError("Member id is required");

    // 7 parallel queries; one round trip each. Quiz/assignment analytics go
    // through the service so the normalisation (status derivation, %, late
    // flags) matches the API responses exactly.
    const [
      member,
      summaryRows,
      sectionRows,
      lectureRows,
      quizAnalytics,
      assignmentAnalytics,
      dailyRows,
    ] = await Promise.all([
      membersRepository.findById(tenantId, memberId),
      memberCourseAnalyticsRepository.getCourseSummary(tenantId, memberId),
      memberCourseAnalyticsRepository.getMemberSectionAnalytics(
        tenantId,
        memberId
      ),
      memberCourseAnalyticsRepository.getAllLecturesForExport(
        tenantId,
        memberId
      ),
      memberCourseAnalyticsService.getQuizAnalytics(tenantId, memberId),
      memberCourseAnalyticsService.getAssignmentAnalytics(tenantId, memberId),
      memberCourseAnalyticsRepository.getMemberDailyActivity(
        tenantId,
        memberId,
        90
      ),
    ]);

    if (!member) {
      throw new BadRequestError("Member not found");
    }

    const courses = normalizeCourseSummaries(summaryRows);
    const wb = new ExcelJS.Workbook();
    wb.creator = BRAND.name;
    wb.created = new Date();

    buildProfileSheet(wb, {
      student: {
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        joined_at: member.joined_at,
        last_login_at: member.last_login_at,
      },
      courses,
      generatedAt: new Date(),
    });
    buildCourseSummarySheet(wb, courses);
    buildSectionAnalyticsSheet(wb, sectionRows);
    buildLectureDetailSheet(wb, lectureRows);
    buildQuizResultsSheet(wb, quizAnalytics.quizzes);
    buildAssignmentResultsSheet(wb, assignmentAnalytics.assignments);
    buildDailyActivitySheet(wb, dailyRows);

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `course-analytics-${sanitizeFile(
      decodeHtmlEntities(member.name)
    )}-${shortIdSuffix(member.id)}-${stamp}.xlsx`;

    return { buffer, fileName };
  }
}

export default new MemberCourseAnalyticsExportService();
