import config from "../config";
import { db } from "../db/connection";
import { domain_status } from "../db/enums";
import logger from "./logger";

/**
 * Resolves a tenant's public base URL (e.g. for password-reset / certificate
 * email CTA links). Always returns the tenant's REAL domain, never a request
 * Origin, mobile clients send no Origin, so relying on it produced localhost
 * links.
 *
 * Custom domains (`tenant_domains`) are live only in PRODUCTION. In dev/staging
 * their DNS still points at the production site, so a link built from one would
 * send a dev user to prod (e.g. https://academy.example.org/...). Off-prod we
 * therefore skip custom domains entirely and use the tenant's
 * `{slug}.{MAIN_DOMAIN}` subdomain (locally northwind.lvh.me:3620).
 *
 * Priority (prod): primary + ACTIVE → latest ACTIVE → any non-failed/removing →
 * slug-based subdomain → FRONTEND_APP_URL. Off-prod: slug-based subdomain →
 * FRONTEND_APP_URL.
 */
/**
 * `{slug}.{MAIN_DOMAIN}` with the scheme and port of FRONTEND_APP_URL, so
 * local links come out as http://northwind.lvh.me:3620 and production ones
 * as https://northwind.lms.example.com.
 */
export function tenantSubdomainUrl(slug: string): string {
  let protocol = "https:";
  let port = "";
  try {
    const u = new URL(config.FRONTEND_APP_URL);
    protocol = u.protocol;
    port = u.port ? `:${u.port}` : "";
  } catch {
    // Malformed FRONTEND_APP_URL: fall back to https without a port.
  }
  return `${protocol}//${slug}.${config.MAIN_DOMAIN}${port}`;
}

export async function getTenantBaseUrl(tenantId: string): Promise<string> {
  try {
    if (config.NODE_ENV === "production") {
      const primary = await db
        .selectFrom("tenant_domains")
        .select(["domain_name"])
        .where("tenant_id", "=", tenantId)
        .where("is_primary", "=", true)
        .where("status", "=", domain_status.ACTIVE)
        .executeTakeFirst();
      if (primary) return `https://${primary.domain_name}`;

      const latestActive = await db
        .selectFrom("tenant_domains")
        .select(["domain_name"])
        .where("tenant_id", "=", tenantId)
        .where("status", "=", domain_status.ACTIVE)
        .orderBy("created_at", "desc")
        .executeTakeFirst();
      if (latestActive) return `https://${latestActive.domain_name}`;

      const anyDomain = await db
        .selectFrom("tenant_domains")
        .select(["domain_name"])
        .where("tenant_id", "=", tenantId)
        .where("status", "not in", [domain_status.FAILED, domain_status.REMOVING])
        .orderBy("created_at", "desc")
        .executeTakeFirst();
      if (anyDomain) return `https://${anyDomain.domain_name}`;
    }

    const tenant = await db
      .selectFrom("tenants")
      .select(["slug"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (tenant?.slug) return tenantSubdomainUrl(tenant.slug);

    return config.FRONTEND_APP_URL;
  } catch (err) {
    logger.error(
      `[tenant-domain] Failed to resolve base URL for tenant ${tenantId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return config.FRONTEND_APP_URL;
  }
}
