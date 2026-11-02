import { NextFunction, Request, Response } from "express";
import config from "../config";
import tenantRepository from "../repositories/tenant.repository";
import logger from "../utils/logger";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  isActive: boolean;
  status: string;
  /** Access-managed storefront: no pricing, no self-serve purchase; admin-assigned access only. */
  accessManaged: boolean;
  /** Whether learners can access certificates (Certificates profile tab). Default true. */
  certificateTabEnabled: boolean;
  /** Jobs portal shows only org/admin-posted opportunities (hides external search). Default false. */
  /**
   * When true, learners only see the courses they are enrolled in, the public
   * catalog / explore surfaces are hidden across web and mobile, and enrolled-only
   * course listing is forced for everyone (including subscribers). Default false.
   */
  enrolledCoursesOnly: boolean;
  /**
   * When true, catalog listings follow the order tenant admins arranged by hand
   * (courses/books/bundles/batches/test series), instead of newest-first or
   * by-start-date. Default false, and OFF never discards a saved arrangement,
   * it just stops applying it, so this can be toggled freely.
   */
  orderedProducts: boolean;
}

// Extend Express Request to include tenant
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantInfo;
    }
  }
}

// In-memory cache for tenant lookups
const tenantCache = new Map<string, { data: TenantInfo | null; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

const MAIN_DOMAIN = config.MAIN_DOMAIN;
/** Subdomains that never resolve to a tenant (RESERVED_SUBDOMAINS). */
const RESERVED_SUBDOMAINS = new Set(config.RESERVED_SUBDOMAINS);
const IS_LOCAL_ENV = config.NODE_ENV === "local" || config.NODE_ENV === "development";

/**
 * Extract subdomain from hostname.
 * northwind.lms.example.com → "northwind"
 * acme.localhost → "acme"
 */
function extractSubdomain(hostname: string, baseDomain: string): string | null {
  if (hostname.includes("localhost")) {
    const parts = hostname.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0];
    }
    return null;
  }

  // For production: extract subdomain from hostname
  // e.g., northwind.lms.example.com → "northwind"
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    // Check if this is actually a subdomain of our base domain
    const expectedBaseDomain = baseDomain.split(".");
    const hostBaseDomain = parts.slice(-expectedBaseDomain.length).join(".");

    if (hostBaseDomain === baseDomain) {
      // Return everything before the base domain as the subdomain
      const subdomainParts = parts.slice(0, -expectedBaseDomain.length);
      return subdomainParts.join(".");
    }
    return parts[0];
  }

  return null;
}

/**
 * Check if hostname is the main domain (no subdomain or www)
 */
function isMainDomain(hostname: string): boolean {
  if (hostname.includes("localhost")) {
    const parts = hostname.split(".");
    return parts.length <= 1 || parts[0] === "localhost";
  }

  const parts = hostname.split(".");
  return parts.length <= 2 || parts[0] === "www";
}

/**
 * Check if subdomain should be ignored for tenant resolution
 */
function isIgnoredSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.has(subdomain.toLowerCase());
}

function getCachedTenant(cacheKey: string): TenantInfo | null | undefined {
  const cached = tenantCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return undefined;
}

function setCachedTenant(cacheKey: string, data: TenantInfo | null): void {
  tenantCache.set(cacheKey, { data, timestamp: Date.now() });
}

/**
 * Drop cached TenantInfo for a tenant across ALL hostnames it's cached under
 * (a tenant can resolve from a subdomain, a custom domain, etc.). Called when
 * tenant-admin publishes a `tenant-config` cache-bust so storefront/certificate
 * toggles take effect within seconds instead of waiting out CACHE_TTL.
 */
export function invalidateTenantConfig(tenantId: string): void {
  for (const [key, entry] of tenantCache.entries()) {
    if (entry.data?.id === tenantId) {
      tenantCache.delete(key);
    }
  }
}

function mapToTenantInfo(tenant: { id: string; name: string; slug: string; custom_domain: string | null; status: string; access_managed_enabled: boolean; certificate_tab_enabled?: boolean | null; enrolled_courses_only_enabled?: boolean | null; ordered_products_enabled?: boolean | null }): TenantInfo {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    customDomain: tenant.custom_domain,
    isActive: tenant.status === "ACTIVE",
    status: tenant.status,
    accessManaged: tenant.access_managed_enabled,
    // Default ON: only an explicit false disables the certificates tab.
    certificateTabEnabled: tenant.certificate_tab_enabled !== false,
    // Default OFF: only an explicit true restricts the jobs portal to org posts.
    // Default OFF: only an explicit true restricts learners to enrolled courses.
    enrolledCoursesOnly: tenant.enrolled_courses_only_enabled === true,
    // Default OFF: only an explicit true applies the admin-arranged catalog order.
    orderedProducts: tenant.ordered_products_enabled === true,
  };
}

/**
 * Resolve tenant from hostname using multiple lookup strategies.
 *
 * Resolution order:
 * 1. For localhost (local dev): extract subdomain and lookup by slug directly
 * 2. If hostname is a custom domain (not our main domain), lookup by full domain name
 * 3. If hostname is a subdomain of our main domain (e.g., northwind.lms.example.com):
 *    a. First try to find by full domain name in tenant_domains table
 *    b. Then try to find by subdomain prefix in tenant_domains table
 *    c. Finally fallback to finding by slug in tenants table
 */
export async function resolveTenantFromHostname(hostname: string): Promise<TenantInfo | null> {
  const normalizedHost = hostname.split(":")[0].toLowerCase(); // Remove port and lowercase

  logger.debug(`Resolving tenant for hostname: ${normalizedHost} (env: ${config.NODE_ENV})`);

  // LOCAL DEVELOPMENT: Handle localhost-based subdomains
  // e.g., northwind.localhost:3620 → subdomain "northwind"
  const isLocalhostSubdomain = normalizedHost.includes("localhost") && normalizedHost !== "localhost";

  if (isLocalhostSubdomain && IS_LOCAL_ENV) {
    const subdomain = extractSubdomain(normalizedHost, MAIN_DOMAIN);

    if (subdomain && !isIgnoredSubdomain(subdomain)) {
      logger.debug(`[LOCAL] Extracted subdomain from localhost: ${subdomain}`);

      const cacheKey = `local:${subdomain}`;
      const cached = getCachedTenant(cacheKey);
      if (cached !== undefined) {
        logger.debug(`[LOCAL] Cache hit for subdomain: ${subdomain}`);
        return cached;
      }

      // In local env, prioritize slug lookup for faster development
      let tenant = await tenantRepository.findBySlug(subdomain);

      if (tenant) {
        logger.debug(`[LOCAL] Found tenant by slug: ${subdomain}`);
        const result = mapToTenantInfo(tenant);
        setCachedTenant(cacheKey, result);
        return result;
      }

      // Also try subdomain_prefix in tenant_domains (any status for local dev)
      tenant = await tenantRepository.findBySubdomainPrefixAnyStatus(subdomain);

      if (tenant) {
        logger.debug(`[LOCAL] Found tenant by subdomain prefix: ${subdomain}`);
        const result = mapToTenantInfo(tenant);
        setCachedTenant(cacheKey, result);
        return result;
      }

      logger.debug(`[LOCAL] No tenant found for subdomain: ${subdomain}`);
      setCachedTenant(cacheKey, null);
      return null;
    }

    // No valid subdomain on localhost
    logger.debug(`[LOCAL] No valid subdomain found on localhost`);
    return null;
  }

  // PRODUCTION: Custom domain (not our main domain and not localhost)
  const isCustomDomain = !normalizedHost.includes(MAIN_DOMAIN) && !normalizedHost.includes("localhost");

  if (isCustomDomain) {
    // Cache by root domain so www.example.com and example.com share cache
    const rootDomain = normalizedHost.startsWith("www.")
      ? normalizedHost.slice(4)
      : normalizedHost;
    const cacheKey = `domain:${rootDomain}`;
    const cached = getCachedTenant(cacheKey);
    if (cached !== undefined) {
      logger.debug(`Cache hit for custom domain: ${normalizedHost}`);
      return cached;
    }

    // Try tenant_domains table first (for verified custom domains)
    let tenant = await tenantRepository.findByDomainName(normalizedHost);

    // If not found and hostname has www. prefix, try root domain (Amplify associates both)
    if (!tenant && normalizedHost.startsWith("www.")) {
      tenant = await tenantRepository.findByDomainName(rootDomain);
    }

    // Fallback to legacy custom_domain field in tenants table
    if (!tenant) {
      tenant = await tenantRepository.findByCustomDomain(normalizedHost);
    }
    if (!tenant && normalizedHost.startsWith("www.")) {
      tenant = await tenantRepository.findByCustomDomain(rootDomain);
    }

    // In local env, also try any status for custom domains
    if (!tenant && IS_LOCAL_ENV) {
      tenant = await tenantRepository.findByDomainNameAnyStatus(normalizedHost);
    }
    if (!tenant && IS_LOCAL_ENV && normalizedHost.startsWith("www.")) {
      tenant = await tenantRepository.findByDomainNameAnyStatus(rootDomain);
    }

    const result = tenant ? mapToTenantInfo(tenant) : null;
    setCachedTenant(cacheKey, result);
    return result;
  }

  // PRODUCTION: Subdomain of our main domain (e.g., northwind.lms.example.com)
  const subdomain = extractSubdomain(normalizedHost, MAIN_DOMAIN);

  if (!subdomain || isIgnoredSubdomain(subdomain)) {
    logger.debug(`No valid subdomain found or subdomain ignored: ${subdomain}`);
    return null;
  }

  logger.debug(`Extracted subdomain: ${subdomain}`);

  const cacheKey = `subdomain:${subdomain}`;
  const cached = getCachedTenant(cacheKey);
  if (cached !== undefined) {
    logger.debug(`Cache hit for subdomain: ${subdomain}`);
    return cached;
  }

  // For subdomains, try multiple lookup strategies:
  const fullDomainName = `${subdomain}.${MAIN_DOMAIN}`;

  // 1. Try to find by full domain name in tenant_domains with ACTIVE status
  let tenant = await tenantRepository.findByDomainName(fullDomainName);

  if (tenant) {
    logger.debug(`Found tenant by domain name (ACTIVE): ${fullDomainName}`);
    const result = mapToTenantInfo(tenant);
    setCachedTenant(cacheKey, result);
    return result;
  }

  // 2. Try to find by subdomain_prefix in tenant_domains with ACTIVE status
  tenant = await tenantRepository.findBySubdomainPrefix(subdomain);

  if (tenant) {
    logger.debug(`Found tenant by subdomain prefix (ACTIVE): ${subdomain}`);
    const result = mapToTenantInfo(tenant);
    setCachedTenant(cacheKey, result);
    return result;
  }

  // 3. Fallback: try to find by slug in tenants table (for backwards compatibility)
  tenant = await tenantRepository.findBySlug(subdomain);

  if (tenant) {
    logger.debug(`Found tenant by slug (fallback): ${subdomain}`);
    const result = mapToTenantInfo(tenant);
    setCachedTenant(cacheKey, result);
    return result;
  }

  // 4. Try domain name with any status (except FAILED) - for domains still being verified
  tenant = await tenantRepository.findByDomainNameAnyStatus(fullDomainName);

  if (tenant) {
    logger.debug(`Found tenant by domain name (any status): ${fullDomainName}`);
    const result = mapToTenantInfo(tenant);
    setCachedTenant(cacheKey, result);
    return result;
  }

  // 5. Try subdomain prefix with any status (except FAILED)
  tenant = await tenantRepository.findBySubdomainPrefixAnyStatus(subdomain);

  if (tenant) {
    logger.debug(`Found tenant by subdomain prefix (any status): ${subdomain}`);
    const result = mapToTenantInfo(tenant);
    setCachedTenant(cacheKey, result);
    return result;
  }

  logger.debug(`No tenant found for subdomain: ${subdomain}`);
  setCachedTenant(cacheKey, null);
  return null;
}

/**
 * Middleware: Resolve tenant from request hostname and attach to req.tenant.
 * When API is called from frontend at subdomain (e.g. pk-enterprize.localhost:3000),
 * the request hits backend at localhost:4006. Use X-Tenant-Host header to resolve tenant.
 *
 * Header priority:
 * 1. x-tenant-host (custom header for explicit tenant context)
 * 2. host header (standard HTTP header)
 * 3. req.hostname (Express parsed hostname)
 */
export const tenantResolverMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // HTTP headers are case-insensitive, Express lowercases them
  const tenantHostHeader = req.headers["x-tenant-host"] as string | undefined;
  const hostname = tenantHostHeader || req.headers.host || req.hostname || "";
  const normalizedHost = hostname.split(":")[0];

  logger.debug(`Tenant resolver - Header: ${tenantHostHeader}, Host: ${req.headers.host}, Using: ${normalizedHost}`);

  try {
    const tenant = await resolveTenantFromHostname(normalizedHost);
    req.tenant = tenant ?? undefined;

    if (tenant) {
      logger.info(`Tenant resolved: ${tenant.slug} (${tenant.id}) for host ${normalizedHost}`);
    } else {
      logger.warn(`No tenant found for host: ${normalizedHost}`);
    }
  } catch (error) {
    logger.error("Tenant resolution failed:", error);
    req.tenant = undefined;
  }

  next();
};

/**
 * Check if request is for main domain (no tenant context)
 */
export function isMainDomainRequest(hostname: string): boolean {
  const normalizedHost = hostname.split(":")[0];
  return isMainDomain(normalizedHost);
}
