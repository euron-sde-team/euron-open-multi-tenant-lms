/**
 * Format a number using Indian notation (Cr/L/K).
 */
export function formatNumber(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(2)} L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format a currency amount using Indian notation with symbol.
 */
export function formatCurrency(amount: number, symbol = "₹"): string {
  if (amount >= 10_000_000) return `${symbol}${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `${symbol}${(amount / 100_000).toFixed(2)} L`;
  return `${symbol}${amount.toLocaleString()}`;
}

/**
 * Format a percentage value.
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format seconds into human-readable duration (e.g., "2h 15m", "45m", "30s").
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/**
 * Format a date string to compact display (DD/MM).
 */
export function formatCompactDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Format a date string to month display (Jan 2026).
 */
export function formatMonthDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Calculate percentage change between current and previous values.
 * Returns null if previous is 0 (avoid division by zero).
 */
export function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}
