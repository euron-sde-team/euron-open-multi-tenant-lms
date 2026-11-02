/**
 * App-wide constants. Use env vars for environment-specific values.
 */

import { ROOT_DOMAIN } from "./brand";

/** Public base URL for uploaded thumbnails (NEXT_PUBLIC_THUMBNAILS_BASE_URL). */
export { THUMBNAILS_BASE_URL } from "./config/env";

/**
 * Base URL for the web (tenant) app.
 * Set via NEXT_PUBLIC_WEB_APP_URL or NEXT_PUBLIC_WEB_BASE_URL.
 * Falls back to http://<NEXT_PUBLIC_ROOT_DOMAIN>:3620 unless NEXT_PUBLIC_NODE_ENV is "production".
 */
const isDev = process.env.NEXT_PUBLIC_NODE_ENV !== "production";
const webBaseRaw =
  process.env.NEXT_PUBLIC_WEB_APP_URL ??
  process.env.NEXT_PUBLIC_WEB_BASE_URL ??
  (isDev ? `http://${ROOT_DOMAIN}:3620` : "");
export const WEB_BASE_URL = webBaseRaw ? webBaseRaw.replace(/\/$/, "") : "";

/**
 * Build the full URL for a tenant's web app (subdomain-based).
 * @param tenantSlug - Tenant slug (e.g. "northwind"). When undefined, uses base URL (no subdomain).
 * @param path - Path to append (e.g. "/self-paced"). Omit for base URL only.
 */
export function getTenantWebUrl(tenantSlug: string | undefined, path = ""): string {
  if (!WEB_BASE_URL) {
    if (isDev) {
      const base = tenantSlug ? `http://${tenantSlug}.${ROOT_DOMAIN}:3620` : `http://${ROOT_DOMAIN}:3620`;
      const pathPart = path ? (path.startsWith("/") ? path : `/${path}`) : "";
      return `${base}${pathPart}`;
    }
    return "";
  }
  try {
    const url = new URL(WEB_BASE_URL);
    if (tenantSlug) {
      url.hostname = `${tenantSlug}.${url.hostname}`;
    }
    const pathPart = path ? (path.startsWith("/") ? path : `/${path}`) : "";
    return `${url.origin}${pathPart}`;
  } catch {
    return "";
  }
}

/** Host only (e.g. "northwind.example.com") for API X-Tenant-Host header. */
export function getTenantWebHost(tenantSlug: string | undefined): string {
  const url = getTenantWebUrl(tenantSlug, "");
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * Resolve a page URL for iframe/preview display.
 * When the URL targets localhost (e.g. from PostHog dev data), rewrites to the tenant's
 * actual domain so the iframe loads the real site. Supports n tenants via domains API.
 *
 * @param pageUrl - Raw URL (e.g. from PostHog: http://northwind.lvh.me:3620/books/react)
 * @param tenantBaseUrl - Tenant's base URL from domains API (primary/active domain). Preferred.
 * @param tenantSlug - Fallback: tenant slug when tenantBaseUrl not available (uses env-based URL).
 * @returns Resolved URL for preview
 */
export function resolvePageUrlForPreview(
  pageUrl: string,
  tenantBaseUrl?: string,
  tenantSlug?: string
): string {
  if (!pageUrl?.trim()) return pageUrl;
  try {
    const u = new URL(pageUrl);
    const isLocalhost = u.hostname.includes("localhost");
    if (!isLocalhost) return pageUrl;

    const path = u.pathname + u.search + u.hash;
    const base = (tenantBaseUrl ?? "").replace(/\/$/, "");

    if (base) {
      return `${base}${path.startsWith("/") ? path : `/${path}`}`;
    }

    // Fallback: env-based when domains API unavailable
    let subdomain: string | undefined;
    if (u.hostname.includes(".")) {
      const parts = u.hostname.split(".");
      if (parts[1]?.startsWith("localhost")) subdomain = parts[0];
    }
    const slug = tenantSlug ?? subdomain;
    const resolved = getTenantWebUrl(slug, path);
    return resolved || pageUrl;
  } catch {
    return pageUrl;
  }
}
