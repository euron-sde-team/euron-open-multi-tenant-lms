/**
 * Resolve thumbnail keys/URLs for display in admin.
 * Central place for all thumbnail resolution - courses, books, bundles use S3 keys
 * that must be converted to public URLs via THUMBNAILS_BASE_URL.
 *
 * No fallback images - show empty until original loads to avoid confusion.
 */

import { THUMBNAILS_BASE_URL } from "@/lib/constants";

/**
 * Resolve course thumbnail_key to a public URL using THUMBNAILS_BASE_URL (from NEXT_PUBLIC_THUMBNAILS_BASE_URL).
 */
export function getCourseThumbnailUrl(thumbnailKey: string | null | undefined): string | null {
  if (!thumbnailKey?.trim()) return null;
  // Already a full URL (an external image or a CDN link): use it as is.
  if (/^(https?:|data:)/.test(thumbnailKey)) return thumbnailKey;
  if (!THUMBNAILS_BASE_URL) return null;
  const key = thumbnailKey.startsWith("/") ? thumbnailKey.slice(1) : thumbnailKey;
  return `${THUMBNAILS_BASE_URL}/${key}`;
}

/**
 * Resolve book thumbnail (S3 key) to a public URL. Same bucket as course thumbnails.
 */
export function getBookThumbnailUrl(thumbnailKey: string | null | undefined): string | null {
  return getCourseThumbnailUrl(thumbnailKey);
}

/**
 * Resolve any thumbnail (S3 key or full URL) to a display URL.
 * Returns null when no thumbnail - components should show empty state (no fallback image).
 *
 * @param thumbnailKeyOrUrl - S3 key (e.g. "tenants/xxx/courses/yyy/thumbnails/web_zzz.jpg") or full URL
 * @returns Display URL or null when no thumbnail
 */
export function resolveThumbnailForDisplay(
  thumbnailKeyOrUrl: string | null | undefined
): string | null {
  if (!thumbnailKeyOrUrl?.trim()) return null;
  const val = thumbnailKeyOrUrl.trim();
  // Already a full URL
  if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:")) {
    return val;
  }
  // S3 key - resolve to public URL
  return getCourseThumbnailUrl(val);
}
