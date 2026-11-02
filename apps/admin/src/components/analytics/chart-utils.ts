/**
 * Shared chart utilities and color palette for analytics.
 * Uses HSL values compatible with light/dark mode via CSS variables.
 */

export const CHART_COLORS = [
  "hsl(210 75% 55%)", // blue
  "hsl(150 60% 45%)", // emerald
  "hsl(280 65% 55%)", // violet
  "hsl(45 95% 50%)",  // amber
  "hsl(350 70% 55%)", // rose
  "hsl(170 60% 45%)", // teal
  "hsl(240 65% 55%)", // indigo
  "hsl(200 75% 55%)", // cyan
] as const;

export const CHART_COLORS_ALT = [
  "hsl(200 75% 55%)",
  "hsl(150 60% 45%)",
  "hsl(280 65% 55%)",
  "hsl(45 95% 50%)",
  "hsl(350 70% 55%)",
] as const;

/** Format date for chart labels: YYYY-MM-DD -> short format (d/m). Handles non-ISO input defensively. */
export function formatChartDate(dateStr: string): string {
  const s = String(dateStr ?? "").trim();
  const part = s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
  if (part.length < 10) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${d}/${m}`;
    }
    return part || "";
  }
  const parts = part.split("-");
  const m = parts[1];
  const d = parts[2];
  if (m && d) return `${d}/${m}`;
  const parsed = new Date(part);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }
  return part;
}

/** Format date for monthly labels: YYYY-MM or YYYY-MM-DD -> "Jan YYYY" */
export function formatChartMonth(dateStr: string): string {
  const s = String(dateStr ?? "").trim();
  const part = s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
  if (part.length < 7) return part || "";
  const parts = part.split("-");
  const y = parts[0];
  const m = parts[1];
  if (y && m) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1] ?? m} ${y}`;
  }
  return part;
}
