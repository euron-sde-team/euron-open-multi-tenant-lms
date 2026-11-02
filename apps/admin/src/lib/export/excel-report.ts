/**
 * Generic ExcelJS report helpers, styled multi-sheet workbooks with a KPI/
 * insights summary, embedded chart images and data-bar tables. Reusable across
 * analytics exports; payments-report.ts is the first consumer.
 */
import { Workbook } from "exceljs";
import type { Anchor, ConditionalFormattingRule, Worksheet } from "exceljs";

import type { ChartImage } from "./chart-canvas";
import { PLATFORM_NAME } from "@/lib/brand";

const INK = "FF0F172A";
const MUTED = "FF64748B";
const HEADER_FILL = "FF1E293B";
const STRIPE_FILL = "FFF1F5F9";
const ACCENT = "FF3B82F6";

export interface Kpi {
  label: string;
  value: string;
  note?: string;
}

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
}

export function createWorkbook(): Workbook {
  const wb = new Workbook();
  wb.creator = PLATFORM_NAME;
  return wb;
}

export interface SummaryOptions {
  name: string;
  title: string;
  subtitle?: string;
  kpis: Kpi[];
  insights?: string[];
  charts?: ChartImage[];
}

/** A branded summary sheet: title, KPI table, insight bullets, chart images. */
export function addSummarySheet(wb: Workbook, opts: SummaryOptions): Worksheet {
  const ws = wb.addWorksheet(opts.name, { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 4 }, { width: 30 }, { width: 22 }, { width: 30 }, { width: 4 }, { width: 14 }, { width: 14 }];

  ws.mergeCells("B2:F2");
  const titleCell = ws.getCell("B2");
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 18, color: { argb: INK } };

  if (opts.subtitle) {
    ws.mergeCells("B3:F3");
    const sub = ws.getCell("B3");
    sub.value = opts.subtitle;
    sub.font = { size: 11, color: { argb: MUTED } };
  }

  // KPI table (Metric | Value | Note)
  let row = 5;
  const head = ws.getRow(row);
  ["", "Metric", "Value", "Note"].forEach((h, i) => {
    if (i === 0) return;
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
  });
  row++;

  opts.kpis.forEach((k, idx) => {
    const r = ws.getRow(row);
    const label = r.getCell(2);
    label.value = k.label;
    label.font = { color: { argb: MUTED } };
    const value = r.getCell(3);
    value.value = k.value;
    value.font = { bold: true, color: { argb: INK } };
    const note = r.getCell(4);
    note.value = k.note ?? "";
    note.font = { size: 10, color: { argb: MUTED } };
    if (idx % 2 === 1) {
      [2, 3, 4].forEach((c) => {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE_FILL } };
      });
    }
    row++;
  });

  // Insights
  if (opts.insights?.length) {
    row++;
    const ih = ws.getCell(`B${row}`);
    ih.value = "Insights";
    ih.font = { bold: true, size: 13, color: { argb: INK } };
    row++;
    opts.insights.forEach((line) => {
      const cell = ws.getCell(`B${row}`);
      ws.mergeCells(`B${row}:F${row}`);
      cell.value = `•  ${line}`;
      cell.font = { color: { argb: INK } };
      cell.alignment = { wrapText: true };
      row++;
    });
  }

  // Charts, two per row
  if (opts.charts?.length) {
    row++;
    let chartRow = row;
    opts.charts.filter((c) => c.dataUrl).forEach((chart, i) => {
      const imageId = wb.addImage({ base64: chart.dataUrl, extension: "png" });
      const colOffset = i % 2 === 0 ? 1 : 4; // column B or E-ish
      ws.addImage(imageId, {
        tl: { col: colOffset, row: chartRow } as Anchor,
        ext: { width: chart.width, height: chart.height },
      });
      if (i % 2 === 1) chartRow += Math.ceil(chart.height / 20) + 1;
    });
  }

  return ws;
}

export interface TableOptions {
  name: string;
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  /** Column key to render an in-cell data bar on (a numeric "mini chart"). */
  dataBarColumn?: string;
}

/** A styled data sheet: bold header, frozen row, autofilter, zebra, data bars. */
export function addTableSheet(wb: Workbook, opts: TableOptions): Worksheet {
  const ws = wb.addWorksheet(opts.name);
  ws.columns = opts.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));

  const header = ws.getRow(1);
  header.height = 20;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
  });

  opts.rows.forEach((r) => ws.addRow(r));

  // number formats + zebra striping
  opts.columns.forEach((c) => {
    if (c.numFmt) ws.getColumn(c.key).numFmt = c.numFmt;
  });
  ws.eachRow((r, n) => {
    if (n === 1) return;
    if (n % 2 === 0) {
      r.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE_FILL } };
      });
    }
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
  const lastCol = String.fromCharCode(64 + opts.columns.length);
  ws.autoFilter = `A1:${lastCol}1`;

  if (opts.dataBarColumn && opts.rows.length) {
    const colLetter = String.fromCharCode(65 + opts.columns.findIndex((c) => c.key === opts.dataBarColumn));
    const ref = `${colLetter}2:${colLetter}${opts.rows.length + 1}`;
    // `color` is honored by ExcelJS at runtime but missing from its dataBar
    // type, so cast through unknown to keep the accent without a type error.
    const dataBarRule = {
      type: "dataBar",
      priority: 1,
      gradient: false,
      cfvo: [{ type: "min" }, { type: "max" }],
      color: { argb: ACCENT },
    } as unknown as ConditionalFormattingRule;
    ws.addConditionalFormatting({ ref, rules: [dataBarRule] });
  }

  return ws;
}

/** Serialize the workbook and trigger a browser download. */
export async function downloadWorkbook(wb: Workbook, fileName: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
