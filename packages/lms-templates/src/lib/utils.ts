import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decode HTML entities (e.g. &amp; → &) so user-authored titles render correctly.
 * The tenant-admin backend's express-xss-sanitizer escapes special characters in
 * request bodies, so data persisted via the editor arrives here pre-encoded.
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
 * Coerce a lecture/lesson duration value into integer seconds.
 *
 * The DB column `lectures.duration` is a free-form `String?` historically.
 * Newer rows are raw seconds like "551".
 * Legacy rows may be "MM:SS" or "HH:MM:SS". This helper accepts all three
 * plus plain numbers, and returns 0 for anything unparseable.
 */
export function parseSeconds(
  value: string | number | null | undefined
): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  if (/^\d+:[0-5]?\d$/.test(trimmed)) {
    const [m, s] = trimmed.split(":").map((x) => parseInt(x, 10));
    return m * 60 + s;
  }
  if (/^\d+:[0-5]?\d:[0-5]?\d$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(":").map((x) => parseInt(x, 10));
    return h * 3600 + m * 60 + s;
  }
  return 0;
}

/**
 * Format a duration as `Xs`, `Xm Ys`, or `Xh Ym Zs` based on size.
 *
 * Accepts the same input shapes as `parseSeconds` so callers can pass
 * `lecture.duration` straight from the DB without manual coercion.
 *
 * Returns an empty string when the value is missing or unparseable so callers
 * can conditionally render (`{formatted && <span>{formatted}</span>}`).
 */
export function formatDuration(
  value: string | number | null | undefined
): string {
  const seconds = parseSeconds(value);
  if (seconds <= 0) return "";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

/**
 * Format file size in bytes to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  if (diffMonths < 1) {
    return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
  }
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  }
  return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If URL doesn't match patterns, assume it's already a video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  return null;
}

/**
 * Generate YouTube embed URL
 */
export function getYouTubeEmbedUrl(
  videoId: string,
  options?: {
    autoplay?: boolean;
    startTime?: number;
    controls?: boolean;
    modestbranding?: boolean;
  }
): string {
  const params = new URLSearchParams();

  if (options?.autoplay) {
    params.set("autoplay", "1");
  }
  if (options?.startTime) {
    params.set("start", String(options.startTime));
  }
  if (options?.controls !== undefined) {
    params.set("controls", options.controls ? "1" : "0");
  }
  if (options?.modestbranding) {
    params.set("modestbranding", "1");
  }

  params.set("rel", "0"); // Don't show related videos
  params.set("enablejsapi", "1"); // Enable JS API

  const queryString = params.toString();
  return `https://www.youtube.com/embed/${videoId}${queryString ? `?${queryString}` : ""}`;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Get resource icon name based on type
 */
export function getResourceIconName(type: string): string {
  const iconMap: Record<string, string> = {
    pdf: "FileText",
    link: "ExternalLink",
    article: "FileText",
    text: "AlignLeft",
    github: "Github",
  };
  return iconMap[type] || "File";
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

