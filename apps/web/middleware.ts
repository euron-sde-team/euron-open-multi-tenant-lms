import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { RESERVED_SUBDOMAINS, ROOT_DOMAIN } from "./src/lib/brand";

/**
 * Tenant resolution for the learner storefront.
 *
 * A tenant is served either as a subdomain of ROOT_DOMAIN
 * (`northwind.lvh.me:3620` locally) or on a verified custom domain. The
 * learner API owns the actual lookup (it resolves the X-Tenant-Host header
 * against tenant slugs and verified custom domains), so this middleware only
 * classifies the host, asks `GET /tenant/info`, and forwards the host to the
 * server components via the `x-tenant-host` request header.
 */

interface TenantInfo {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}

// In-memory cache for tenant lookups (per server instance).
const tenantCache = new Map<string, { data: TenantInfo | null; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

const API_URL = (
  process.env.API_INTERNAL_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5096/api/v1"
).replace(/\/$/, "");

/** Strip the port and lowercase. */
function bareHost(host: string): string {
  return host.split(":")[0].toLowerCase();
}

/**
 * "root" = the platform's own domain (no tenant), "subdomain" = a tenant slug
 * under ROOT_DOMAIN, "custom" = any other host (a tenant's custom domain).
 */
function classifyHost(host: string): { kind: "root" } | { kind: "subdomain"; slug: string } | { kind: "custom" } {
  const h = bareHost(host);
  if (!h || h === "localhost" || h === "127.0.0.1" || h === ROOT_DOMAIN) return { kind: "root" };
  for (const root of [ROOT_DOMAIN, "localhost"]) {
    if (h.endsWith(`.${root}`)) {
      const sub = h.slice(0, -(root.length + 1));
      // Only a single label counts as a tenant slug (a.b.lvh.me is not one).
      if (!sub || sub.includes(".")) return { kind: "root" };
      if (RESERVED_SUBDOMAINS.includes(sub)) return { kind: "root" };
      return { kind: "subdomain", slug: sub };
    }
  }
  return { kind: "custom" };
}

/** undefined = lookup failed (network), null = no such tenant. */
async function lookupTenant(host: string): Promise<TenantInfo | null | undefined> {
  const key = bareHost(host);
  const cached = tenantCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  try {
    const response = await fetch(`${API_URL}/tenant/info`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-Tenant-Host": host },
    });
    if (!response.ok) {
      // 400/404: the learner API could not resolve a tenant for this host.
      const data = response.status < 500 ? null : undefined;
      if (data === null) tenantCache.set(key, { data, timestamp: Date.now() });
      return data;
    }
    const json = (await response.json()) as { data?: { id: string; slug: string; name?: string } };
    if (!json.data?.id) {
      tenantCache.set(key, { data: null, timestamp: Date.now() });
      return null;
    }
    const tenant: TenantInfo = {
      tenantId: json.data.id,
      tenantSlug: json.data.slug,
      tenantName: json.data.name ?? json.data.slug,
    };
    tenantCache.set(key, { data: tenant, timestamp: Date.now() });
    return tenant;
  } catch (error) {
    console.error("Tenant lookup failed:", error);
    return undefined;
  }
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Redirect /signup to /login (signup is handled on login page)
  if (pathname === "/signup" || pathname.startsWith("/signup/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect /home to / so home is only served at root (avoids duplicate analytics routes)
  if (pathname === "/home" || pathname === "/home/") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Skip static files, API routes, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // files with extensions
  ) {
    return NextResponse.next();
  }

  const hostKind = classifyHost(hostname);
  let tenant: TenantInfo | null | undefined = null;
  if (hostKind.kind !== "root") {
    tenant = await lookupTenant(hostname);
  }

  // A subdomain / custom domain that resolves to no tenant gets the 404 page.
  // (A failed lookup, `undefined`, falls through so an API blip does not 404
  // every page; the page itself then shows its own error state.)
  if (hostKind.kind !== "root" && tenant === null) {
    const notFoundHeaders = new Headers(request.headers);
    notFoundHeaders.set("x-tenant-host", hostname);
    return NextResponse.rewrite(new URL("/404", request.url), {
      request: { headers: notFoundHeaders },
    });
  }

  // Create request headers with tenant context
  const requestHeaders = new Headers(request.headers);
  // Always set x-tenant-host for the template API to use
  requestHeaders.set("x-tenant-host", hostname);
  if (tenant) {
    requestHeaders.set("x-tenant-id", tenant.tenantId);
    requestHeaders.set("x-tenant-slug", tenant.tenantSlug);
    if (hostKind.kind === "custom") requestHeaders.set("x-tenant-domain", bareHost(hostname));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
  ],
};
