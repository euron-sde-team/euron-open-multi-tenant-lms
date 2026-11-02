/**
 * Service URLs, read once from NEXT_PUBLIC_* env vars with local defaults.
 */

const trimSlash = (v: string) => v.replace(/\/+$/, "");

/** Tenant admin API (admin-api). Browser calls go through the /api/proxy rewrite. */
export const API_BASE_URL = trimSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5086/api/v1"
);

/** Learner API (learner-api), used for the published catalog in editor previews. */
export const LEARNER_API_BASE_URL = trimSlash(
  process.env.NEXT_PUBLIC_LEARNER_API_BASE_URL || "http://localhost:5096/api/v1"
);

/** Public base URL that uploaded thumbnail keys are served from. */
export const THUMBNAILS_BASE_URL = trimSlash(process.env.NEXT_PUBLIC_THUMBNAILS_BASE_URL || "");
