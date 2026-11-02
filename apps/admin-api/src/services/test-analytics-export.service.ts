import ExcelJS from "exceljs";

import {
  areaChartPng,
  donutChartPng,
  hBarChartPng,
} from "../utils/chart-image.util";
import testAnalyticsRepository, {
  type RawAnswerRow,
  type RawAttemptRow,
} from "../repositories/test-analytics.repository";
import testAnalyticsService, {
  type TestAnalytics,
} from "./test-analytics.service";
import { BRAND } from "../lib/brand";

// Palette / style primitives (mirrors course-analytics-export look).
const COLOR_HEADER_FILL = "FF111827";
const COLOR_HEADER_TEXT = "FFFFFFFF";
const BRAND_PRIMARY = "FF2563EB";
const COLOR_BAND = "FFF3F4F6";
const COLOR_GOOD = "FF10B981";
const COLOR_WARN = "FFF59E0B";
const COLOR_BAD = "FFEF4444";
const COLOR_KPI_FILL = "FFEFF6FF";

const sanitizeFile = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
  "test";

const fmtHms = (sec: number | null): string => {
  if (sec == null || sec <= 0) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
};

function setHeaderRow(ws: ExcelJS.Worksheet, row: number, cols: number): void {
  const header = ws.getRow(row);
  header.font = { bold: true, color: { argb: COLOR_HEADER_TEXT }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_FILL } };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 22;
  for (let c = 1; c <= cols; c += 1)
    header.getCell(c).border = { bottom: { style: "thin", color: { argb: BRAND_PRIMARY } } };
}

function accuracyColor(pct: number): string {
  return pct >= 75 ? COLOR_GOOD : pct >= 50 ? COLOR_WARN : COLOR_BAD;
}

function kpiCard(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  label: string,
  value: string
): void {
  const labelCell = ws.getCell(row, col);
  labelCell.value = label;
  labelCell.font = { size: 9, color: { argb: "FF6B7280" }, bold: true };
  labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_KPI_FILL } };
  labelCell.alignment = { horizontal: "left", vertical: "middle" };
  const valueCell = ws.getCell(row + 1, col);
  valueCell.value = value;
  valueCell.font = { size: 16, bold: true, color: { argb: "FF111827" } };
  valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_KPI_FILL } };
  valueCell.alignment = { horizontal: "left", vertical: "middle" };
}

class TestAnalyticsExportService {
  async buildWorkbook(
    tenantId: string,
    testId: string
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const a = await testAnalyticsService.getTestAnalytics(tenantId, testId);
    const [rawAttempts, raw] = await Promise.all([
      testAnalyticsRepository.getRawAttempts(tenantId, [testId]),
      testAnalyticsRepository.getRawAnswerRows(tenantId, [testId]),
    ]);
    return this.buildFromAnalytics(a, "test-analytics", raw, rawAttempts);
  }

  /** Same detailed workbook, aggregated across every test in a series. */
  async buildSeriesWorkbook(
    tenantId: string,
    seriesId: string
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const a = await testAnalyticsService.getSeriesAnalytics(tenantId, seriesId);
    const testIds = await testAnalyticsRepository.getSeriesTestIds(tenantId, seriesId);
    const [rawAttempts, raw] = await Promise.all([
      testAnalyticsRepository.getRawAttempts(tenantId, testIds),
      testAnalyticsRepository.getRawAnswerRows(tenantId, testIds),
    ]);
    return this.buildFromAnalytics(a, "series-analytics", raw, rawAttempts);
  }

  private async buildFromAnalytics(
    a: TestAnalytics,
    filePrefix: string,
    raw: RawAnswerRow[],
    rawAttempts: RawAttemptRow[]
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const wb = new ExcelJS.Workbook();
    wb.creator = BRAND.name;
    wb.created = new Date();

    await this.buildOverview(wb, a);
    this.buildQuestions(wb, a);
    this.buildTopicsAndDifficulty(wb, a);
    this.buildLeaderboard(wb, a);
    // Raw sheets last: the analysis reads first, the underlying rows sit behind
    // it for anyone who wants to cut the data a different way.
    this.buildAttemptsRaw(wb, rawAttempts);
    this.buildAnswersRaw(wb, raw);

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const fileName = `${filePrefix}-${sanitizeFile(a.test.title)}.xlsx`;
    return { buffer, fileName };
  }

  private async buildOverview(
    wb: ExcelJS.Workbook,
    a: TestAnalytics
  ): Promise<void> {
    const ws = wb.addWorksheet("Overview", {
      properties: { defaultColWidth: 16 },
    });
    ws.getColumn(1).width = 22;

    ws.mergeCells("A1:F1");
    const title = ws.getCell("A1");
    title.value = `${a.test.mode === "SERIES" ? "Series" : "Test"} Analytics, ${a.test.title}`;
    title.font = { size: 18, bold: true, color: { argb: "FF111827" } };
    ws.getRow(1).height = 28;

    ws.mergeCells("A2:F2");
    const sub = ws.getCell("A2");
    sub.value = `Mode: ${a.test.mode}  ·  Questions: ${a.test.questionCount}  ·  Total marks: ${a.test.totalMarks ?? "-"}  ·  Pass: ${a.test.passCriteriaPct != null ? a.test.passCriteriaPct + "%" : "-"}`;
    sub.font = { size: 10, color: { argb: "FF6B7280" } };

    // KPI cards (row 4 label / row 5 value), 3 per row band.
    const k = a.kpis;
    const cards: Array<[string, string]> = [
      ["Total attempts", String(k.totalAttempts)],
      ["Submitted", String(k.submitted)],
      ["In progress", String(k.inProgress)],
      ["Avg %", `${k.avgPercentage}%`],
      ["Pass rate", `${k.passRate}%`],
      ["Avg percentile", String(k.avgPercentile)],
      ["Avg score", String(k.avgScore)],
      ["Median score", String(k.medianScore)],
      ["High / Low", `${k.highScore} / ${k.lowScore}`],
      ["Avg duration", fmtHms(k.avgDurationSec)],
      ["Avg tab switches", String(k.avgTabSwitches)],
      ["-", "-"],
    ];
    let r = 4;
    let c = 1;
    for (const [label, value] of cards) {
      kpiCard(ws, r, c, label, value);
      c += 2;
      if (c > 5) {
        c = 1;
        r += 3;
      }
    }

    // Charts (embedded PNGs). Place starting around row 16.
    let imageRow = 15;
    if (a.kpis.submitted > 0) {
      const distW = 560;
      const distH = 280;
      const distPng = await areaChartPng({
        title: "Score distribution",
        subtitle: "Learners per score % band",
        labels: a.scoreDistribution.map((b) => b.bucket),
        values: a.scoreDistribution.map((b) => b.count),
        color: "#2563eb",
        width: distW,
        height: distH,
      });
      const distId = wb.addImage({
        buffer: distPng as unknown as ExcelJS.Buffer,
        extension: "png",
      });
      ws.addImage(distId, {
        tl: { col: 0, row: imageRow },
        ext: { width: distW, height: distH },
      });

      if (a.difficulty.length > 0) {
        const donutW = 380;
        const donutH = 280;
        const donutPng = await donutChartPng({
          title: "Answers by difficulty",
          subtitle: "Share of answered questions",
          centerLabel: "answered",
          segments: a.difficulty.map((d) => ({
            label: d.difficulty,
            value: d.answered,
          })),
          width: donutW,
          height: donutH,
        });
        const donutId = wb.addImage({
          buffer: donutPng as unknown as ExcelJS.Buffer,
          extension: "png",
        });
        ws.addImage(donutId, {
          tl: { col: 6, row: imageRow },
          ext: { width: donutW, height: donutH },
        });
      }
      imageRow += 15;

      if (a.topics.length > 0) {
        const topicRows = Math.min(a.topics.length, 10);
        const topicW = 620;
        const topicH = 82 + topicRows * 30;
        const topicPng = await hBarChartPng({
          title: "Topic accuracy",
          subtitle: "Weakest first, focus areas for revision",
          rows: a.topics.map((t) => ({ label: t.topic, value: t.accuracyPct })),
          width: topicW,
          height: topicH,
        });
        const topicId = wb.addImage({
          buffer: topicPng as unknown as ExcelJS.Buffer,
          extension: "png",
        });
        ws.addImage(topicId, {
          tl: { col: 0, row: imageRow },
          ext: { width: topicW, height: topicH },
        });
        imageRow += Math.ceil(topicH / 18) + 1;
      }

      if (a.percentileBands.some((p) => p.count > 0)) {
        const pctW = 560;
        const pctH = 260;
        const pctPng = await areaChartPng({
          title: "Percentile distribution",
          subtitle: "Learners per percentile band",
          labels: a.percentileBands.map((p) => p.band),
          values: a.percentileBands.map((p) => p.count),
          color: "#8b5cf6",
          width: pctW,
          height: pctH,
        });
        const pctId = wb.addImage({
          buffer: pctPng as unknown as ExcelJS.Buffer,
          extension: "png",
        });
        ws.addImage(pctId, {
          tl: { col: 0, row: imageRow },
          ext: { width: pctW, height: pctH },
        });
        imageRow += 15;
      }
    }

    // Insights block.
    const insStart = imageRow + 1;
    ws.mergeCells(insStart, 1, insStart, 6);
    const insHead = ws.getCell(insStart, 1);
    insHead.value = "Insights";
    insHead.font = { size: 13, bold: true, color: { argb: "FF111827" } };
    a.insights.forEach((line, i) => {
      const rr = insStart + 1 + i;
      ws.mergeCells(rr, 1, rr, 6);
      const cell = ws.getCell(rr, 1);
      cell.value = `•  ${line}`;
      cell.font = { size: 10, color: { argb: "FF374151" } };
      cell.alignment = { wrapText: true, vertical: "top" };
    });
  }

  private buildQuestions(wb: ExcelJS.Workbook, a: TestAnalytics): void {
    const ws = wb.addWorksheet("Questions");
    ws.columns = [
      { header: "#", key: "n", width: 5 },
      { header: "Question", key: "stem", width: 60 },
      { header: "Type", key: "type", width: 14 },
      { header: "Difficulty", key: "difficulty", width: 12 },
      { header: "Topic", key: "topic", width: 22 },
      { header: "Answered", key: "answered", width: 11 },
      { header: "Correct", key: "correct", width: 10 },
      { header: "Accuracy %", key: "accuracy", width: 12 },
      { header: "Avg time", key: "time", width: 12 },
    ];
    setHeaderRow(ws, 1, 9);
    a.questions.forEach((q, i) => {
      const row = ws.addRow({
        n: i + 1,
        stem: q.stem,
        type: q.type,
        difficulty: q.difficulty,
        topic: q.topic,
        answered: q.answered,
        correct: q.correct,
        accuracy: q.accuracyPct,
        time: fmtHms(q.avgTimeSec),
      });
      const accCell = row.getCell(8);
      accCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: accuracyColor(q.accuracyPct) },
      };
      accCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      accCell.numFmt = "0.0\"%\"";
      if (i % 2 === 1)
        for (let c = 1; c <= 7; c += 1)
          if (c !== 8)
            row.getCell(c).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: COLOR_BAND },
            };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  private buildTopicsAndDifficulty(
    wb: ExcelJS.Workbook,
    a: TestAnalytics
  ): void {
    const ws = wb.addWorksheet("Topics & Difficulty");

    ws.getCell("A1").value = "Topic / Subject accuracy";
    ws.getCell("A1").font = { size: 13, bold: true };
    ws.getRow(2).values = ["Topic", "Answered", "Correct", "Accuracy %", "Avg time"];
    setHeaderRow(ws, 2, 5);
    a.topics.forEach((t) => {
      const row = ws.addRow([
        t.topic,
        t.answered,
        t.correct,
        t.accuracyPct,
        fmtHms(t.avgTimeSec),
      ]);
      const acc = row.getCell(4);
      acc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accuracyColor(t.accuracyPct) } };
      acc.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });
    ws.getColumn(1).width = 30;
    for (let c = 2; c <= 5; c += 1) ws.getColumn(c).width = 13;

    const dStart = ws.lastRow ? ws.lastRow.number + 3 : 10;
    ws.getCell(dStart, 1).value = "Difficulty breakdown";
    ws.getCell(dStart, 1).font = { size: 13, bold: true };
    ws.getRow(dStart + 1).values = ["Difficulty", "Answered", "Correct", "Accuracy %"];
    setHeaderRow(ws, dStart + 1, 4);
    a.difficulty.forEach((d, i) => {
      const row = ws.getRow(dStart + 2 + i);
      row.values = [d.difficulty, d.answered, d.correct, d.accuracyPct];
      const acc = row.getCell(4);
      acc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accuracyColor(d.accuracyPct) } };
      acc.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });

    const tStart = dStart + 3 + a.difficulty.length + 1;
    ws.getCell(tStart, 1).value = "Question type breakdown";
    ws.getCell(tStart, 1).font = { size: 13, bold: true };
    ws.getRow(tStart + 1).values = ["Type", "Answered", "Correct", "Accuracy %"];
    setHeaderRow(ws, tStart + 1, 4);
    a.typeBreakdown.forEach((t, i) => {
      const row = ws.getRow(tStart + 2 + i);
      row.values = [t.type, t.answered, t.correct, t.accuracyPct];
      const acc = row.getCell(4);
      acc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accuracyColor(t.accuracyPct) } };
      acc.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });
  }

  private buildLeaderboard(wb: ExcelJS.Workbook, a: TestAnalytics): void {
    const ws = wb.addWorksheet("Leaderboard");
    ws.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Learner", key: "name", width: 28 },
      { header: "Email", key: "email", width: 30 },
      { header: "Score", key: "score", width: 10 },
      { header: "%", key: "pct", width: 9 },
      { header: "Percentile", key: "percentile", width: 12 },
      { header: "Attempts", key: "attempts", width: 10 },
      { header: "Duration", key: "duration", width: 12 },
    ];
    setHeaderRow(ws, 1, 8);
    a.leaderboard.forEach((l, i) => {
      const row = ws.addRow({
        rank: l.rank ?? i + 1,
        name: l.learnerName,
        email: l.learnerEmail,
        score: l.score,
        pct: l.percentage,
        percentile: l.percentile ?? "-",
        attempts: l.attempts,
        duration: fmtHms(l.durationSec),
      });
      if (i % 2 === 1)
        for (let c = 1; c <= 8; c += 1)
          row.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLOR_BAND },
          };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }


  /** Flatten whatever shape a stem/option/answer was stored in into plain text. */
  private static plain(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map((v) => TestAnalyticsExportService.plain(v)).join(", ");
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      for (const k of ["text", "label", "value", "id"]) {
        if (typeof o[k] === "string" || typeof o[k] === "number") return String(o[k]);
      }
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * An answer as the option TEXT it points at ("0.33"), not the option id.
   *
   * Option ids are the authored letters, but a test that shuffles options shows
   * each learner its own A/B/C/D order, so a bare "B" here named a different
   * option than the "B" on the learner's screen. Text means the same thing to
   * both. Non-option answers (numbers, blanks) fall through to plain().
   */
  private static answerText(options: unknown, value: unknown): string {
    const P = TestAnalyticsExportService.plain;
    let opts = options;
    if (typeof opts === "string") {
      try {
        opts = JSON.parse(opts);
      } catch {
        return P(value);
      }
    }
    if (!Array.isArray(opts) || opts.length === 0) return P(value);
    const labelById = new Map<string, string>();
    for (const o of opts) {
      if (!o || typeof o !== "object") continue;
      const r = o as Record<string, unknown>;
      if (r.id == null) continue;
      const label = r.label ?? r.text;
      labelById.set(String(r.id).toUpperCase(), typeof label === "string" ? label : P(label));
    }
    const ids: string[] = [];
    const collect = (v: unknown): void => {
      if (v == null) return;
      if (Array.isArray(v)) return v.forEach(collect);
      if (typeof v === "object") {
        const r = v as Record<string, unknown>;
        return collect(r.optionId ?? r.id ?? r.value ?? null);
      }
      ids.push(String(v).toUpperCase());
    };
    collect(value);
    const labels = ids.map((id) => labelById.get(id));
    if (labels.length === 0 || labels.some((l) => l === undefined)) return P(value);
    return labels.join(" | ");
  }

  /**
   * EVERY attempt, one row each.
   *
   * Deliberately not the analytics `learners` array: that keeps only a
   * learner's best attempt, so re-attempts vanished from the sheet. A tenant
   * re-cutting the data needs all of them, in-progress ones included.
   */
  private buildAttemptsRaw(wb: ExcelJS.Workbook, rows: RawAttemptRow[]): void {
    const ws = wb.addWorksheet("Attempts (raw)");
    ws.columns = [
      { header: "Learner", key: "name", width: 24 },
      { header: "Email", key: "email", width: 28 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Test", key: "test", width: 26 },
      { header: "Attempt #", key: "attemptNo", width: 10 },
      { header: "Status", key: "status", width: 16 },
      { header: "Grading", key: "grading", width: 16 },
      { header: "Score", key: "score", width: 10 },
      { header: "Out of", key: "outOf", width: 10 },
      { header: "%", key: "pct", width: 9 },
      { header: "Scaled score", key: "scaled", width: 13 },
      { header: "Scaled max", key: "scaledMax", width: 12 },
      { header: "Percentile", key: "percentile", width: 11 },
      { header: "Rank", key: "rank", width: 8 },
      { header: "Duration (sec)", key: "duration", width: 14 },
      { header: "Tab switches", key: "tabs", width: 13 },
      { header: "Started at", key: "started", width: 21 },
      { header: "Submitted at", key: "submitted", width: 21 },
    ];
    setHeaderRow(ws, 1, 18);

    const iso = (v: Date | string | null) =>
      v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
    const num = (v: string | number | null) =>
      v == null || v === "" ? "" : Number(v);

    // Rows arrive ordered by learner then start time, so a running counter per
    // learner numbers their attempts in the order they sat them.
    const seen = new Map<string, number>();

    for (const r of rows) {
      const attemptNo = (seen.get(r.learner_id) ?? 0) + 1;
      seen.set(r.learner_id, attemptNo);

      const started = iso(r.started_at);
      const submitted = iso(r.submitted_at);
      const durationSec =
        started && submitted
          ? Math.max(
              0,
              Math.round((Date.parse(submitted) - Date.parse(started)) / 1000)
            )
          : "";

      ws.addRow({
        name: r.learner_name ?? "",
        email: r.learner_email ?? "",
        phone: r.learner_phone ?? "",
        test: r.test_name ?? "",
        attemptNo,
        status: String(r.status).replace(/_/g, " "),
        grading: String(r.grading_status).replace(/_/g, " "),
        score: num(r.score),
        outOf: num(r.attempt_total_marks),
        pct: num(r.percentage),
        scaled: num(r.scaled_score),
        scaledMax: num(r.scaled_score_max),
        percentile: num(r.percentile),
        rank: r.rank ?? "",
        duration: durationSec,
        tabs: r.tab_switch_count,
        started,
        submitted,
      });
    }

    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: { row: 1, column: 18 } };
  }

  /**
   * One row per learner per question. This is the table every chart in the
   * workbook is derived from, so a tenant can pivot it their own way.
   */
  private buildAnswersRaw(wb: ExcelJS.Workbook, raw: RawAnswerRow[]): void {
    const ws = wb.addWorksheet("Answers (raw)");
    ws.columns = [
      { header: "Learner", key: "name", width: 24 },
      { header: "Email", key: "email", width: 28 },
      { header: "Test", key: "test", width: 26 },
      { header: "Status", key: "status", width: 15 },
      { header: "Question", key: "stem", width: 60 },
      { header: "Type", key: "type", width: 14 },
      { header: "Difficulty", key: "difficulty", width: 11 },
      { header: "Subject", key: "subject", width: 18 },
      { header: "Chapter", key: "chapter", width: 18 },
      { header: "Topic", key: "topic", width: 18 },
      { header: "Learner answer", key: "given", width: 30 },
      { header: "Correct answer", key: "correct", width: 30 },
      { header: "Outcome", key: "outcome", width: 12 },
      { header: "Marks awarded", key: "awarded", width: 14 },
      { header: "Max marks", key: "max", width: 11 },
      { header: "Negative marks", key: "negative", width: 14 },
      { header: "Time (sec)", key: "time", width: 11 },
      { header: "Marked for review", key: "flagged", width: 17 },
      { header: "Submitted at", key: "submitted", width: 21 },
    ];
    setHeaderRow(ws, 1, 19);

    const P = TestAnalyticsExportService.plain;
    const A = TestAnalyticsExportService.answerText;
    for (const r of raw) {
      const answered = r.learner_answer !== null && r.learner_answer !== undefined;
      const outcome =
        String(r.grading_status) === "PENDING_REVIEW"
          ? "Pending"
          : !answered
            ? "Skipped"
            : r.is_correct === true
              ? "Correct"
              : "Wrong";
      const row = ws.addRow({
        name: r.learner_name ?? "",
        email: r.learner_email ?? "",
        test: r.test_name ?? "",
        status: String(r.status).replace(/_/g, " "),
        stem: P(r.q_stem),
        type: String(r.q_type).replace(/_/g, " "),
        difficulty: r.q_difficulty ?? "",
        subject: r.q_subject ?? "",
        chapter: r.q_chapter ?? "",
        topic: r.q_topic ?? "",
        given: answered ? A(r.q_options, r.learner_answer) : "",
        correct: A(r.q_options, r.q_correct_answer),
        outcome,
        awarded: r.marks_awarded != null ? Number(r.marks_awarded) : "",
        max: r.q_marks != null ? Number(r.q_marks) : "",
        negative: r.q_negative_marks != null ? Number(r.q_negative_marks) : "",
        time: r.time_spent_sec,
        flagged: r.marked_for_review ? "Yes" : "",
        submitted:
          r.submitted_at instanceof Date
            ? r.submitted_at.toISOString()
            : (r.submitted_at ?? ""),
      });
      const colour =
        outcome === "Correct" ? COLOR_GOOD : outcome === "Wrong" ? COLOR_BAD : COLOR_WARN;
      row.getCell(13).font = { color: { argb: colour }, bold: true };
    }

    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: { row: 1, column: 19 } };
  }
}

export const testAnalyticsExportService = new TestAnalyticsExportService();
export default testAnalyticsExportService;
