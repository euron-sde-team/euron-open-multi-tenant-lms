import { db } from "../db/connection";
import { domain_status } from "../db/enums";

// Define proper types for repository use
interface Tenant {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  owner_user_id: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface TenantInsert {
  id: string;
  name: string;
  slug: string;
  custom_domain?: string | null;
  owner_user_id: string;
  status?: string;
  created_at?: Date;
  updated_at: Date;
}

class TenantRepository {
  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<Tenant | undefined> {
    const result = await db
      .selectFrom("tenants")
      .selectAll()
      .where("id", "=", id)
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
   * Find tenant by slug
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
   * Find tenant by custom domain (legacy - from tenants.custom_domain)
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
   * Supports both platform subdomains (e.g., x-academy.example.com) and custom domains (e.g., learn.abc.com).
   * Only returns if the domain status is ACTIVE.
   */
  async findByDomainName(domainName: string): Promise<Tenant | undefined> {
    const result = await db
      .selectFrom("tenant_domains")
      .innerJoin("tenants", "tenants.id", "tenant_domains.tenant_id")
      .select([
        "tenants.id",
        "tenants.name",
        "tenants.slug",
        "tenants.custom_domain",
        "tenants.owner_user_id",
        "tenants.status",
        "tenants.created_at",
        "tenants.updated_at",
      ])
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
   * Create a new tenant
   */
  async create(data: TenantInsert): Promise<Tenant> {
    const result = await db
      .insertInto("tenants")
      .values({
        id: data.id,
        name: data.name,
        slug: data.slug,
        custom_domain: data.custom_domain ?? null,
        owner_user_id: data.owner_user_id,
        status: (data.status ?? "ACTIVE") as "PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED",
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      status: result.status as string,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("tenants")
      .select("id")
      .where("slug", "=", slug);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Find tenants by owner user ID
   */
  async findByOwnerUserId(ownerUserId: string): Promise<Tenant[]> {
    const results = await db
      .selectFrom("tenants")
      .selectAll()
      .where("owner_user_id", "=", ownerUserId)
      .execute();

    return results.map((result) => ({
      ...result,
      status: result.status as string,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    }));
  }

  /**
   * Update tenant
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      custom_domain: string | null;
      status: string;
    }>
  ): Promise<Tenant | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.custom_domain !== undefined) updateData.custom_domain = data.custom_domain;
    if (data.status !== undefined) {
      updateData.status = data.status as "PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
    }

    const result = await db
      .updateTable("tenants")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
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
   * Get tenant layout JSON
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
   * Update tenant layout JSON
   */
  async updateLayout(tenantId: string, layout: unknown): Promise<void> {
    await db
      .updateTable("tenants")
      .set({
        layout: JSON.stringify(layout),
        updated_at: new Date(),
      })
      .where("id", "=", tenantId)
      .execute();
  }
}

export default new TenantRepository();
