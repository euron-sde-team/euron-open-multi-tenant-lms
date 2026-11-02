import config from "../config";
import { db } from "../db/connection";
import { domain_status } from "../db/enums";
import logger from "./logger";

/**
 * Resolves the primary tenant base URL for use in email CTA links.
 * Priority: primary+ACTIVE → latest ACTIVE → any non-failed → slug-based fallback.
 */
export async function getTenantBaseUrl(tenantId: string): Promise<string> {
  try {
    // 1. Primary + ACTIVE domain
    const primary = await db
      .selectFrom("tenant_domains")
      .select(["domain_name"])
      .where("tenant_id", "=", tenantId)
      .where("is_primary", "=", true)
      .where("status", "=", domain_status.ACTIVE)
      .executeTakeFirst();

    if (primary) return `https://${primary.domain_name}`;

    // 2. Fallback: latest ACTIVE domain
    const fallback = await db
      .selectFrom("tenant_domains")
      .select(["domain_name"])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", domain_status.ACTIVE)
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    if (fallback) return `https://${fallback.domain_name}`;

    // 3. Fallback: any non-failed/removing domain
    const anyDomain = await db
      .selectFrom("tenant_domains")
      .select(["domain_name"])
      .where("tenant_id", "=", tenantId)
      .where("status", "not in", [domain_status.FAILED, domain_status.REMOVING])
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    if (anyDomain) return `https://${anyDomain.domain_name}`;

    // 4. Fallback: slug-based subdomain
    const tenant = await db
      .selectFrom("tenants")
      .select(["slug"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (tenant?.slug) return storefrontUrlForSlug(tenant.slug);

    return storefrontUrlForSlug();
  } catch (err) {
    logger.error(
      `[tenant-domain] Failed to resolve base URL for tenant ${tenantId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return storefrontUrlForSlug();
  }
}

/**
 * Storefront URL on the platform root domain: https://<slug>.<ROOT_DOMAIN> in
 * production, http://<slug>.lvh.me:3620 locally. Pass no slug for the root.
 */
export function storefrontUrlForSlug(slug?: string | null): string {
  const host = slug ? `${slug}.${config.BASE_DOMAIN}` : config.BASE_DOMAIN;
  const port = config.STOREFRONT_PORT ? `:${config.STOREFRONT_PORT}` : "";
  return `${config.STOREFRONT_SCHEME}://${host}${port}`;
}
