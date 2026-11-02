import sharp from "sharp";

/**
 * Server-side chart renderer. We hand-build an SVG string and rasterize it to a
 * PNG with `sharp` (already a dependency), no native canvas / headless browser.
 * Used to embed real, colourful charts into the test-analytics .xlsx export.
 *
 * Everything is drawn in "logical" coordinates and rendered at SCALE× pixels so
 * the embedded image stays crisp when Excel downscales it to its display size.
 */

const SCALE = 2;

const PALETTE = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const C = {
  panel: "#ffffff",
  border: "#e5e7eb",
  title: "#0f172a",
  sub: "#64748b",
  grid: "#eef2f7",
  axis: "#94a3b8",
  text: "#334155",
  good: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
  track: "#f1f5f9",
};

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Wrap chart inner-SVG in a bordered white card with a titled header. */
function panel(opts: {
  W: number;
  H: number;
  title: string;
  subtitle?: string;
  accent: string;
  inner: string;
}): string {
  const { W, H, title, subtitle, accent, inner } = opts;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}" viewBox="0 0 ${W} ${H}">
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${C.panel}" stroke="${C.border}"/>
    <rect x="16" y="18" width="4" height="16" rx="2" fill="${accent}"/>
    <text x="28" y="31" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="${C.title}">${esc(title)}</text>
    ${subtitle ? `<text x="28" y="46" font-family="Arial, sans-serif" font-size="10.5" fill="${C.sub}">${esc(subtitle)}</text>` : ""}
    ${inner}
  </svg>`;
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const ticks: number[] = [];
  for (let i = 0; i <= count; i += 1) ticks.push(Math.round((max / count) * i));
  return [...new Set(ticks)];
}

/** Filled area chart with gridlines, axis ticks and value labels. */
export async function areaChartPng(opts: {
  title: string;
  subtitle?: string;
  labels: string[];
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}): Promise<Buffer> {
  const W = opts.width ?? 640;
  const H = opts.height ?? 300;
  const color = opts.color ?? PALETTE[0];
  const padL = 40;
  const padR = 22;
  const padT = 62;
  const padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...opts.values);
  const n = opts.values.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const grid = niceTicks(max, 4)
    .map((t) => {
      const gy = y(t);
      return (
        `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${(padL + plotW).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>` +
        `<text x="${(padL - 6).toFixed(1)}" y="${(gy + 3).toFixed(1)}" font-family="Arial" font-size="9" fill="${C.axis}" text-anchor="end">${t}</text>`
      );
    })
    .join("");

  const linePts = opts.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPts = `${padL.toFixed(1)},${(padT + plotH).toFixed(1)} ${linePts} ${(padL + plotW).toFixed(1)},${(padT + plotH).toFixed(1)}`;
  const dots = opts.values
    .map((v, i) => {
      const px = x(i);
      const py = y(v);
      return (
        `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="#ffffff" stroke="${color}" stroke-width="2"/>` +
        (v > 0
          ? `<text x="${px.toFixed(1)}" y="${(py - 9).toFixed(1)}" font-family="Arial" font-size="9.5" font-weight="700" fill="${C.text}" text-anchor="middle">${v}</text>`
          : "")
      );
    })
    .join("");
  const xlabels = opts.labels
    .map(
      (l, i) =>
        `<text x="${x(i).toFixed(1)}" y="${(padT + plotH + 16).toFixed(1)}" font-family="Arial" font-size="9" fill="${C.sub}" text-anchor="middle">${esc(l)}</text>`
    )
    .join("");

  const inner = `
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.04"/>
    </linearGradient></defs>
    ${grid}
    <polygon points="${areaPts}" fill="url(#ag)"/>
    <polyline points="${linePts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${xlabels}`;
  return svgToPng(
    panel({ W, H, title: opts.title, subtitle: opts.subtitle, accent: color, inner })
  );
}

/** Donut chart with a centre total and a value/percentage legend. */
export async function donutChartPng(opts: {
  title: string;
  subtitle?: string;
  centerLabel?: string;
  segments: Array<{ label: string; value: number }>;
  width?: number;
  height?: number;
}): Promise<Buffer> {
  const W = opts.width ?? 420;
  const H = opts.height ?? 300;
  const cx = 132;
  const cy = 56 + (H - 56) / 2;
  const rO = 84;
  const rI = 50;
  const total = opts.segments.reduce((s, x) => s + x.value, 0) || 1;

  let angle = -Math.PI / 2;
  const arcs = opts.segments
    .map((seg, i) => {
      const frac = seg.value / total;
      const a0 = angle;
      const a1 = angle + frac * Math.PI * 2;
      angle = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0o = cx + rO * Math.cos(a0);
      const y0o = cy + rO * Math.sin(a0);
      const x1o = cx + rO * Math.cos(a1);
      const y1o = cy + rO * Math.sin(a1);
      const x0i = cx + rI * Math.cos(a1);
      const y0i = cy + rI * Math.sin(a1);
      const x1i = cx + rI * Math.cos(a0);
      const y1i = cy + rI * Math.sin(a0);
      const color = PALETTE[i % PALETTE.length];
      return `<path d="M ${x0o.toFixed(1)} ${y0o.toFixed(1)} A ${rO} ${rO} 0 ${large} 1 ${x1o.toFixed(1)} ${y1o.toFixed(1)} L ${x0i.toFixed(1)} ${y0i.toFixed(1)} A ${rI} ${rI} 0 ${large} 0 ${x1i.toFixed(1)} ${y1i.toFixed(1)} Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>`;
    })
    .join("");

  const center = `
    <text x="${cx}" y="${(cy - 1).toFixed(1)}" font-family="Arial" font-size="22" font-weight="800" fill="${C.title}" text-anchor="middle">${total}</text>
    <text x="${cx}" y="${(cy + 15).toFixed(1)}" font-family="Arial" font-size="9.5" fill="${C.sub}" text-anchor="middle">${esc(opts.centerLabel ?? "total")}</text>`;

  const lx = 252;
  const legend = opts.segments
    .map((seg, i) => {
      const ly = cy - opts.segments.length * 13 + i * 26;
      const color = PALETTE[i % PALETTE.length];
      const pct = Math.round((seg.value / total) * 100);
      return `
        <rect x="${lx}" y="${ly.toFixed(1)}" width="12" height="12" rx="3" fill="${color}"/>
        <text x="${lx + 18}" y="${(ly + 10).toFixed(1)}" font-family="Arial" font-size="11" font-weight="600" fill="${C.text}">${esc(seg.label.slice(0, 14))}</text>
        <text x="${lx + 18}" y="${(ly + 23).toFixed(1)}" font-family="Arial" font-size="9.5" fill="${C.sub}">${seg.value} · ${pct}%</text>`;
    })
    .join("");

  const inner = `${arcs}${center}${legend}`;
  return svgToPng(
    panel({ W, H, title: opts.title, subtitle: opts.subtitle, accent: PALETTE[0], inner })
  );
}

/** Horizontal progress bars (e.g. topic accuracy %) with a track behind each. */
export async function hBarChartPng(opts: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: number }>;
  unit?: string;
  width?: number;
  height?: number;
}): Promise<Buffer> {
  const rows = opts.rows.slice(0, 10);
  const W = opts.width ?? 640;
  const rowH = 30;
  const padT = 64;
  const padB = 18;
  const H = opts.height ?? padT + padB + rows.length * rowH;
  const labelW = 150;
  const padR = 54;
  const plotX = labelW;
  const plotW = W - labelW - padR;
  const unit = opts.unit ?? "%";
  const scaleMax = unit === "%" ? 100 : Math.max(1, ...rows.map((r) => r.value));

  const bars = rows
    .map((r, i) => {
      const yTop = padT + i * rowH;
      const barH = rowH - 14;
      const by = yTop + 4;
      const w = (r.value / scaleMax) * plotW;
      const color = r.value >= 75 ? C.good : r.value >= 50 ? C.warn : C.bad;
      return `
        <text x="${(labelW - 10).toFixed(1)}" y="${(by + barH / 2 + 4).toFixed(1)}" font-family="Arial" font-size="11" fill="${C.text}" text-anchor="end">${esc(r.label.slice(0, 22))}</text>
        <rect x="${plotX}" y="${by.toFixed(1)}" width="${plotW.toFixed(1)}" height="${barH}" rx="5" fill="${C.track}"/>
        <rect x="${plotX}" y="${by.toFixed(1)}" width="${Math.max(3, w).toFixed(1)}" height="${barH}" rx="5" fill="${color}"/>
        <text x="${(plotX + plotW + 8).toFixed(1)}" y="${(by + barH / 2 + 4).toFixed(1)}" font-family="Arial" font-size="11" font-weight="700" fill="${color}">${r.value}${unit}</text>`;
    })
    .join("");

  return svgToPng(
    panel({ W, H, title: opts.title, subtitle: opts.subtitle, accent: PALETTE[0], inner: bars })
  );
}
