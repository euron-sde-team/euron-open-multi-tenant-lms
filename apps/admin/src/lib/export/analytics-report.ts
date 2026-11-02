/**
 * Generic graphical analytics report. Any analytics page can hand it a config
 * (KPIs, chart specs, table sheets) and get the same styled Excel workbook the
 * Payments report produces: a Summary sheet with KPIs + insights + embedded
 * charts, followed by detail sheets with in-cell data bars.
 */
import {
  renderBarChart,
  renderDonutChart,
  renderLineChart,
  type ChartImage,
} from "./chart-canvas";
import {
  addSummarySheet,
  addTableSheet,
  createWorkbook,
  downloadWorkbook,
  type Kpi,
  type TableColumn,
} from "./excel-report";

export type ChartSpec =
  | {
      kind: "donut";
      title: string;
      segments: Array<{ label: string; value: number; color?: string }>;
    }
  | {
      kind: "line";
      title: string;
      labels: string[];
      series: Array<{ name: string; color: string; values: number[] }>;
    }
  | {
      kind: "bar";
      title: string;
      bars: Array<{ label: string; value: number; color?: string }>;
      valueFormat?: (n: number) => string;
    };

export interface ReportSheet {
  name: string;
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  /** Numeric column key to draw an in-cell data bar on. */
  dataBarColumn?: string;
}

export interface AnalyticsReportConfig {
  fileName: string;
  title: string;
  subtitle?: string;
  kpis: Kpi[];
  insights?: string[];
  charts?: ChartSpec[];
  sheets: ReportSheet[];
}

/** Standard chart colours so every report looks consistent. */
export const REPORT_COLORS = {
  blue: "#3b82f6",
  emerald: "#10b981",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  red: "#ef4444",
  teal: "#14b8a6",
};

function renderSpec(spec: ChartSpec): ChartImage {
  if (spec.kind === "donut") return renderDonutChart(spec.title, spec.segments);
  if (spec.kind === "line") return renderLineChart(spec.title, spec.labels, spec.series);
  return renderBarChart(spec.title, spec.bars, 560, 320, spec.valueFormat);
}

export async function buildAnalyticsReport(cfg: AnalyticsReportConfig): Promise<void> {
  const wb = createWorkbook();
  addSummarySheet(wb, {
    name: "Summary",
    title: cfg.title,
    subtitle: cfg.subtitle,
    kpis: cfg.kpis,
    insights: cfg.insights,
    charts: (cfg.charts ?? []).map(renderSpec).filter((c) => c.dataUrl),
  });
  for (const sheet of cfg.sheets) {
    if (!sheet.rows.length) continue;
    addTableSheet(wb, {
      name: sheet.name,
      columns: sheet.columns,
      rows: sheet.rows,
      dataBarColumn: sheet.dataBarColumn,
    });
  }
  await downloadWorkbook(wb, cfg.fileName);
}
