/**
 * Zero-dependency chart renderers that draw onto an offscreen <canvas> and
 * return a PNG data URL. Used to embed real charts inside Excel exports
 * (ExcelJS can embed images but not native charts). Browser-only, guarded so
 * an accidental SSR import is a no-op rather than a crash.
 */

const PALETTE = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // red
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#06b6d4", // cyan
];

export const STATUS_COLORS: Record<string, string> = {
  PAID: "#10b981",
  FAILED: "#ef4444",
  PENDING: "#f59e0b",
  REFUNDED: "#8b5cf6",
};

export interface ChartImage {
  /** PNG data URL (empty string when rendering is unavailable). */
  dataUrl: string;
  width: number;
  height: number;
}

const RATIO = 2;

function newCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width * RATIO;
  canvas.height = height * RATIO;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "middle";
  return { canvas, ctx };
}

function title(ctx: CanvasRenderingContext2D, text: string, w: number) {
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 15px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(text, 16, 20);
  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(16, 34);
  ctx.lineTo(w - 16, 34);
  ctx.stroke();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

export interface Segment {
  label: string;
  value: number;
  color?: string;
}

/** Donut chart with a legend (counts + percentages). */
export function renderDonutChart(titleText: string, segments: Segment[], width = 560, height = 320): ChartImage {
  const c = newCanvas(width, height);
  if (!c) return { dataUrl: "", width, height };
  const { canvas, ctx } = c;
  title(ctx, titleText, width);

  const data = segments.filter((s) => s.value > 0);
  const total = data.reduce((a, s) => a + s.value, 0);
  const cx = 130;
  const cy = 60 + (height - 70) / 2;
  const outer = Math.min(90, (height - 90) / 2);
  const inner = outer * 0.6;

  if (total === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data", cx, cy);
  } else {
    let angle = -Math.PI / 2;
    data.forEach((s, i) => {
      const slice = (s.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outer, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = s.color ?? PALETTE[i % PALETTE.length];
      ctx.fill();
      angle += slice;
    });
    // punch the hole
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 18px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(total), cx, cy - 6);
    ctx.fillStyle = "#64748b";
    ctx.font = "11px Arial, sans-serif";
    ctx.fillText("total", cx, cy + 12);
  }

  // legend
  const lx = 250;
  let ly = 60;
  ctx.textAlign = "left";
  data.forEach((s, i) => {
    ctx.fillStyle = s.color ?? PALETTE[i % PALETTE.length];
    ctx.fillRect(lx, ly - 6, 12, 12);
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial, sans-serif";
    const pct = total ? Math.round((s.value / total) * 100) : 0;
    const label = truncate(ctx, s.label, width - lx - 90);
    ctx.fillText(label, lx + 20, ly);
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText(`${s.value} · ${pct}%`, width - 16, ly);
    ctx.textAlign = "left";
    ly += 24;
  });

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

/** Multi-series line chart over shared x labels. */
export function renderLineChart(titleText: string, labels: string[], series: LineSeries[], width = 760, height = 340): ChartImage {
  const c = newCanvas(width, height);
  if (!c) return { dataUrl: "", width, height };
  const { canvas, ctx } = c;
  title(ctx, titleText, width);

  const left = 56;
  const right = width - 20;
  const top = 56;
  const bottom = height - 46;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length;

  // y gridlines + labels
  ctx.strokeStyle = "#eef2f7";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Arial, sans-serif";
  ctx.textAlign = "right";
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = bottom - ((bottom - top) * i) / steps;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillText(String(Math.round((maxVal * i) / steps)), left - 6, y);
  }

  const xAt = (i: number) => (n <= 1 ? (left + right) / 2 : left + ((right - left) * i) / (n - 1));
  const yAt = (v: number) => bottom - (bottom - top) * (v / maxVal);

  series.forEach((s) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  ctx.lineWidth = 1;

  // x labels (sampled to ~8)
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "center";
  ctx.font = "10px Arial, sans-serif";
  const stepX = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += stepX) {
    ctx.fillText(labels[i], xAt(i), bottom + 14);
  }

  // legend
  let lx = left;
  const lyLeg = height - 16;
  ctx.textAlign = "left";
  ctx.font = "11px Arial, sans-serif";
  series.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, lyLeg - 5, 12, 4);
    ctx.fillStyle = "#475569";
    ctx.fillText(s.name, lx + 16, lyLeg);
    lx += 22 + ctx.measureText(s.name).width + 18;
  });

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export interface Bar {
  label: string;
  value: number;
  color?: string;
}

/** Horizontal bar chart (good for "by type" and "failure reasons"). */
export function renderBarChart(titleText: string, bars: Bar[], width = 560, height = 320, valueFormat?: (n: number) => string): ChartImage {
  const c = newCanvas(width, height);
  if (!c) return { dataUrl: "", width, height };
  const { canvas, ctx } = c;
  title(ctx, titleText, width);

  const data = bars.slice(0, 8);
  const maxVal = Math.max(1, ...data.map((b) => b.value));
  const labelW = 130;
  const left = 16 + labelW;
  const right = width - 70;
  const top = 52;
  const rowH = data.length ? Math.min(30, (height - top - 16) / data.length) : 0;

  if (!data.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data", width / 2, height / 2);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  }

  ctx.font = "12px Arial, sans-serif";
  data.forEach((b, i) => {
    const y = top + i * rowH + rowH / 2;
    const barW = ((right - left) * b.value) / maxVal;
    ctx.fillStyle = "#475569";
    ctx.textAlign = "right";
    ctx.fillText(truncate(ctx, b.label, labelW - 8), left - 8, y);
    ctx.fillStyle = b.color ?? PALETTE[i % PALETTE.length];
    const h = Math.max(8, rowH - 10);
    ctx.fillRect(left, y - h / 2, Math.max(2, barW), h);
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.fillText(valueFormat ? valueFormat(b.value) : String(b.value), left + Math.max(2, barW) + 6, y);
  });

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}
