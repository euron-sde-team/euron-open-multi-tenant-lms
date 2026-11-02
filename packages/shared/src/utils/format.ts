/**
 * Format numbers with a fixed locale to avoid hydration mismatch between
 * server (Node default locale) and client (browser locale).
 * Use "en-IN" for INR (₹) and "en-US" for USD ($).
 */
export function formatNumber(value: number, locale: "en-IN" | "en-US" = "en-IN"): string {
  return value.toLocaleString(locale);
}

/**
 * Decode HTML entities (e.g. &amp; → &, &lt; → <) so they display correctly.
 *
 * The express-xss-sanitizer encodes special characters in request bodies.
 * When React renders these as text children, entities show literally (e.g. "&amp;" instead of "&").
 * Call this on any user-authored text before rendering.
 */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (str == null || typeof str !== "string") return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Seconds behind a lecture duration, whatever shape it arrives in.
 *
 * Lecture durations reach the web app as a string. Normally that is a whole
 * number of seconds ("930"), because the uploader records what the video
 * actually measured, but records written by hand can already carry a clock
 * ("15:30"). Reading both keeps one formatter safe to point at any of it.
 *
 * Returns null, not 0, for anything that is not a duration, so a caller can
 * tell "no time at all" apart from free text and leave the latter alone. That
 * matters: a course's own length is often typed by a human ("6 weeks",
 * "40 hours"), and turning that into a clock would be worse than leaving it.
 */
export function parseDurationSeconds(
  value: string | number | null | undefined
): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }

  const trimmed = value.trim();
  if (trimmed === "") return null;

  // A bare count of seconds, which is what the video pipeline stores.
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);

  // Already a clock: "15:30" or "1:05:30".
  if (/^\d{1,3}(:[0-5]\d){1,2}$/.test(trimmed)) {
    return trimmed
      .split(":")
      .reduce((acc, part) => acc * 60 + parseInt(part, 10), 0);
  }

  return null;
}

/**
 * A lecture duration as a clock: "15:30" under an hour, "1:05:30" over it.
 *
 * Minutes are padded only once there are hours to separate them from, which is
 * how every video player writes a running time.
 *
 * Text that is not a duration comes back untouched rather than blank, so a
 * hand-written course length still reads as itself.
 */
export function formatClockDuration(
  value: string | number | null | undefined
): string {
  const total = parseDurationSeconds(value);
  if (total === null) return typeof value === "string" ? value.trim() : "";
  if (total <= 0) return "";

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
