import { db } from "../db/connection";
import { domain_status } from "../db/enums";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  owner_user_id: string;
  status: string;
  access_managed_enabled: boolean;
  certificate_tab_enabled: boolean;
  enrolled_courses_only_enabled: boolean;
  ordered_products_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

class TenantRepository {
  /**
   * Find tenant by slug (for subdomain lookup)
   * e.g., acme.lms.example.com → slug: "acme"
   */
  async findBySlug(slug: string): Promise<Tenant | undefined> {
    const result = await db
      .selectFrom("tenants")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find tenant by custom domain (legacy - from tenants table)
   * e.g., www.acme.com → domain: "www.acme.com"
   */
  async findByCustomDomain(domain: string): Promise<Tenant | undefined> {
    const result = await db
      .selectFrom("tenants")
      .selectAll()
      .where("custom_domain", "=", domain)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find tenant by domain name from tenant_domains table.
   * Supports both subdomains (e.g., northwind.lms.example.com) and custom domains.
   * Only returns if the domain status is ACTIVE (verified and active).
   */
  async findByDomainName(domainName: string): Promise<Tenant | undefined> {
    const result = await db
      .selectFrom("tenant_domains")
      .innerJoin("tenants", "tenants.id", "tenant_domains.tenant_id")
      // selectAll("tenants") keeps this query tolerant of not-yet-migrated
      // columns (access_managed_enabled), same shape the slug lookups use.
      .selectAll("tenants")
      .where("tenant_domains.domain_name", "=", domainName.toLowerCase())
      .where("tenant_domains.status", "=", domain_status.ACTIVE)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find tenant by subdomain prefix from tenant_domains table.
   * e.g., subdomain_prefix: "northwind" for northwind.lms.example.com
   * Only returns if the domain status is ACTIVE.
   */
  async findBySubdomainPrefix(prefix: string): Promise<Tenant | undefined> {
    const result = await db
      .selectFrom("tenant_domains")
      .innerJoin("tenants", "tenants.id", "tenant_domains.tenant_id")
      // selectAll("tenants") keeps this query tolerant of not-yet-migrated
      // columns (access_managed_enabled), same shape the slug lookups use.
      .selectAll("tenants")
      .where("tenant_domains.subdomain_prefix", "=", prefix.toLowerCase())
      .where("tenant_domains.status", "=", domain_status.ACTIVE)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find tenant by domain name from tenant_domains table (any status).
   * This is useful for finding tenants even when domain is still being verified.
   * Used as a fallback when ACTIVE-only lookup fails.
   */
  async findByDomainNameAnyStatus(domainName: string): Promise<Tenant | undefined> {
    const result = await db
      .selectFrom("tenant_domains")
      .innerJoin("tenants", "tenants.id", "tenant_domains.tenant_id")
      // selectAll("tenants") keeps this query tolerant of not-yet-migrated
      // columns (access_managed_enabled), same shape the slug lookups use.
      .selectAll("tenants")
      .where("tenant_domains.domain_name", "=", domainName.toLowerCase())
      .where("tenant_domains.status", "not in", [domain_status.FAILED, domain_status.REMOVING])
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Get tenant layout JSON by tenant ID
   */
  async getLayout(tenantId: string): Promise<unknown | null> {
    const result = await db
      .selectFrom("tenants")
      .select("layout")
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (!result) return null;

    const raw = result.layout;
    if (raw == null) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  /**
   * Find tenant by subdomain prefix from tenant_domains table (any status except FAILED/REMOVING).
   * Used as a fallback when ACTIVE-only lookup fails.
   */
  async findBySubdomainPrefixAnyStatus(prefix: string): Promise<Tenant | undefined> {
    const result = await db
      .selectFrom("tenant_domains")
      .innerJoin("tenants", "tenants.id", "tenant_domains.tenant_id")
      // selectAll("tenants") keeps this query tolerant of not-yet-migrated
      // columns (access_managed_enabled), same shape the slug lookups use.
      .selectAll("tenants")
      .where("tenant_domains.subdomain_prefix", "=", prefix.toLowerCase())
      .where("tenant_domains.status", "not in", [domain_status.FAILED, domain_status.REMOVING])
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }
}

export default new TenantRepository();
