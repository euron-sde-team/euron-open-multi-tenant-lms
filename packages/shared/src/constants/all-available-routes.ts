/**
 * All Available Routes (Frontend-Only)
 *
 * Single source of truth for admin and web apps. No backend dependency.
 * CMS routes derived from PAGE_CATEGORY_ROUTES (add new pages there).
 * System routes = platform routes (learn, search, courses, etc.)
 */

import type { AvailableRoute, AvailableRoutesResponse } from "../types/link";
import { PAGE_CATEGORY_ROUTES_AS_AVAILABLE } from "./page-category-routes";
import { SYSTEM_ROUTES } from "./system-routes";

/** All routes flattened (internal + system, deduplicated by path) */
export const ALL_AVAILABLE_ROUTES: AvailableRoute[] = (() => {
  const seen = new Set<string>();
  const result: AvailableRoute[] = [];
  for (const r of [...PAGE_CATEGORY_ROUTES_AS_AVAILABLE, ...SYSTEM_ROUTES]) {
    if (!seen.has(r.path)) {
      seen.add(r.path);
      result.push(r);
    }
  }
  return result;
})();

/**
 * Stable default routes response. Must be a constant reference to avoid
 * infinite re-renders when passed to AvailableRoutesProvider (useEffect
 * depends on initialRoutes; new object each render = loop).
 */
const DEFAULT_AVAILABLE_ROUTES_RESPONSE: AvailableRoutesResponse = {
  internal: PAGE_CATEGORY_ROUTES_AS_AVAILABLE,
  system: SYSTEM_ROUTES,
};

/**
 * Returns AvailableRoutesResponse for AvailableRoutesProvider.
 * Admin and web use this instead of fetching from backend.
 * Returns stable reference to avoid infinite render loops.
 */
export function getAvailableRoutesResponse(): AvailableRoutesResponse {
  return DEFAULT_AVAILABLE_ROUTES_RESPONSE;
}
