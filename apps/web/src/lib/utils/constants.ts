/**
 * App-wide constants. Use env vars for environment-specific values.
 * Mirrors tenant admin lib/constants pattern.
 */

/**
 * Public base URL of the thumbnails bucket / CDN (no trailing slash). Set
 * NEXT_PUBLIC_THUMBNAILS_BASE_URL; falls back to NEXT_PUBLIC_ASSET_BASE_URL,
 * then to same-origin relative paths.
 */
const raw =
  process.env.NEXT_PUBLIC_THUMBNAILS_BASE_URL ?? process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "";
export const THUMBNAILS_BASE_URL = raw.replace(/\/$/, "");
