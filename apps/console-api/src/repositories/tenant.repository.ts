import { db } from "../db/connection";
import { TenantStatus, TenantQueryParams } from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

interface Tenant {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  owner_user_id: string;
  status: TenantStatus;
  created_at: Date;
  updated_at: Date;
}

interface TenantInsert {
  id: string;
  name: string;
  slug: string;
  custom_domain?: string | null;
  owner_user_id: string;
  status?: TenantStatus;
  created_at?: Date;
  updated_at: Date;
}

interface TenantUpdate {
  name?: string;
  custom_domain?: string | null;
  status?: TenantStatus;
  updated_at?: Date;
}

/** Tenant row with optional list-only fields (owner, active plan, primary domain) */
export interface TenantListRow extends Tenant {
  owner_email?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  active_plan_name?: string | null;
  active_plan_code?: string | null;
  active_plan_status?: string | null;
  active_billing_cycle?: string | null;
  active_period_start?: Date | null;
  active_period_end?: Date | null;
  primary_domain?: string | null;
}

/** Owner fields from the tenant_users JOIN in findByIdWithOwner */
export interface TenantOwnerFields {
  owner_email: string;
  owner_name: string;
  owner_avatar_url: string | null;
  owner_status: string;
  owner_email_verified: boolean;
  owner_last_login_at: Date | null;
  owner_phone: string | null;
  owner_phone_verified: boolean;
  owner_signup_country: string | null;
  owner_signup_city: string | null;
  owner_signup_ip: string | null;
  owner_signup_referrer: string | null;
  owner_timezone: string | null;
  owner_designation: string | null;
  owner_login_count: number;
  owner_last_login_ip: string | null;
  owner_profile_completed_at: Date | null;
  owner_created_at: Date;
  owner_updated_at: Date;
}

// ============================================
// REPOSITORY
// ============================================

class TenantRepository {
  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    const tenant = await db
      .selectFrom("tenants")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return tenant ? this.mapToTenant(tenant) : null;
  }

  /**
   * Find tenant by slug
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    const tenant = await db
      .selectFrom("tenants")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();

    return tenant ? this.mapToTenant(tenant) : null;
  }

  /**
   * Minimal public app info by slug (org name + configured contact emails).
   * Left-joins tenant_contact_settings so tenants without contact settings still resolve.
   * Used by the public whitelabel pages (e.g. mobile account-deletion guide).
   */
  async findPublicAppInfoBySlug(
    slug: string
  ): Promise<{ name: string; recipient_emails: unknown } | null> {
    const row = await db
      .selectFrom("tenants")
      .select(["tenants.name as name"])
      .where("tenants.slug", "=", slug)
      .executeTakeFirst();

    if (!row) return null;
    return { name: row.name as string, recipient_emails: null };
  }

  /**
   * Find tenant by custom domain
   */
  async findByCustomDomain(domain: string): Promise<Tenant | null> {
    const tenant = await db
      .selectFrom("tenants")
      .selectAll()
      .where("custom_domain", "=", domain)
      .executeTakeFirst();

    return tenant ? this.mapToTenant(tenant) : null;
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
   * Check if custom domain exists
   */
  async customDomainExists(domain: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("tenants")
      .select("id")
      .where("custom_domain", "=", domain);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * List tenants with pagination and filters; includes owner email/name and active plan name via joins
   */
  async findAll(params: TenantQueryParams): Promise<{ tenants: TenantListRow[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    // Subquery: current subscription per tenant (latest ACTIVE or TRIALING by created_at).
    // Must include TRIALING, plans assigned from Core Admin as a trial are TRIALING,
    // and were previously invisible in the list because this only matched ACTIVE.
    const activeSubSubquery = db
      .selectFrom("subscriptions")
      .select([
        "tenant_id",
        "plan_name_snapshot",
        "plan_code_snapshot",
        "status",
        "billing_cycle",
        "current_period_start",
        "current_period_end",
      ])
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .orderBy("tenant_id")
      .orderBy("created_at", "desc")
      .distinctOn("tenant_id")
      .as("active_sub");

    // Subquery: primary domain for each tenant
    const primaryDomainSubquery = db
      .selectFrom("tenant_domains")
      .select(["tenant_id", "domain_name as primary_domain_name"])
      .where("is_primary", "=", true)
      .as("primary_domain");

    let query = db
      .selectFrom("tenants")
      .leftJoin("tenant_users", "tenants.owner_user_id", "tenant_users.id")
      .leftJoin(activeSubSubquery, "tenants.id", "active_sub.tenant_id")
      .leftJoin(primaryDomainSubquery, "tenants.id", "primary_domain.tenant_id")
      .select([
        "tenants.id",
        "tenants.name",
        "tenants.slug",
        "tenants.custom_domain",
        "tenants.owner_user_id",
        "tenants.status",
        "tenants.created_at",
        "tenants.updated_at",
        "tenant_users.email as owner_email",
        "tenant_users.name as owner_name",
        "tenant_users.phone as owner_phone",
        "active_sub.plan_name_snapshot as active_plan_name",
        "active_sub.plan_code_snapshot as active_plan_code",
        "active_sub.status as active_plan_status",
        "active_sub.billing_cycle as active_billing_cycle",
        "active_sub.current_period_start as active_period_start",
        "active_sub.current_period_end as active_period_end",
        "primary_domain.primary_domain_name as primary_domain",
      ]);

    // Active subscription join kept on the count query too so the plan filter
    // can be applied consistently with the main query.
    let countQuery = db
      .selectFrom("tenants")
      .leftJoin("tenant_users", "tenants.owner_user_id", "tenant_users.id")
      .leftJoin(activeSubSubquery, "tenants.id", "active_sub.tenant_id")
      .select(db.fn.countAll().as("count"));

    // Apply filters
    if (params.status) {
      query = query.where("tenants.status", "=", params.status);
      countQuery = countQuery.where("tenants.status", "=", params.status);
    }

    if (params.plan) {
      query = query.where("active_sub.plan_code_snapshot", "=", params.plan);
      countQuery = countQuery.where(
        "active_sub.plan_code_snapshot",
        "=",
        params.plan
      );
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("tenants.name", "ilike", searchPattern),
          eb("tenants.slug", "ilike", searchPattern),
          eb("tenants.custom_domain", "ilike", searchPattern),
          eb("tenant_users.name", "ilike", searchPattern),
          eb("tenant_users.email", "ilike", searchPattern),
          eb("tenant_users.phone", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("tenants.name", "ilike", searchPattern),
          eb("tenants.slug", "ilike", searchPattern),
          eb("tenants.custom_domain", "ilike", searchPattern),
          eb("tenant_users.name", "ilike", searchPattern),
          eb("tenant_users.email", "ilike", searchPattern),
          eb("tenant_users.phone", "ilike", searchPattern),
        ])
      );
    }

    // Sort by signup date, latest (default) or oldest
    const sortDirection = params.sort === "oldest" ? "asc" : "desc";

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query
        .orderBy("tenants.created_at", sortDirection)
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      tenants: rows.map((r) => this.mapToListRow(r)),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * Create a new tenant
   */
  async create(data: TenantInsert): Promise<Tenant> {
    const tenant = await db
      .insertInto("tenants")
      .values({
        id: data.id,
        name: data.name,
        slug: data.slug,
        custom_domain: data.custom_domain || null,
        owner_user_id: data.owner_user_id,
        status: data.status || "ACTIVE",
        created_at: data.created_at || new Date(),
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToTenant(tenant);
  }

  /**
   * Update a tenant
   */
  async update(id: string, data: TenantUpdate): Promise<Tenant | null> {
    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at || new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.custom_domain !== undefined) updateData.custom_domain = data.custom_domain;
    if (data.status !== undefined) updateData.status = data.status;

    const tenant = await db
      .updateTable("tenants")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return tenant ? this.mapToTenant(tenant) : null;
  }

  /**
   * Get tenant with owner details
   */
  async findByIdWithOwner(id: string): Promise<(Tenant & TenantOwnerFields) | null> {
    const result = await db
      .selectFrom("tenants")
      .innerJoin("tenant_users", "tenants.owner_user_id", "tenant_users.id")
      .select([
        "tenants.id",
        "tenants.name",
        "tenants.slug",
        "tenants.custom_domain",
        "tenants.owner_user_id",
        "tenants.status",
        "tenants.created_at",
        "tenants.updated_at",
        "tenant_users.email as owner_email",
        "tenant_users.name as owner_name",
        "tenant_users.avatar_url as owner_avatar_url",
        "tenant_users.status as owner_status",
        "tenant_users.email_verified as owner_email_verified",
        "tenant_users.last_login_at as owner_last_login_at",
        "tenant_users.phone as owner_phone",
        "tenant_users.phone_verified as owner_phone_verified",
        "tenant_users.signup_country as owner_signup_country",
        "tenant_users.signup_city as owner_signup_city",
        "tenant_users.signup_ip as owner_signup_ip",
        "tenant_users.signup_referrer as owner_signup_referrer",
        "tenant_users.timezone as owner_timezone",
        "tenant_users.designation as owner_designation",
        "tenant_users.login_count as owner_login_count",
        "tenant_users.last_login_ip as owner_last_login_ip",
        "tenant_users.profile_completed_at as owner_profile_completed_at",
        "tenant_users.created_at as owner_created_at",
        "tenant_users.updated_at as owner_updated_at",
      ])
      .where("tenants.id", "=", id)
      .executeTakeFirst();

    if (!result) return null;

    return {
      ...this.mapToTenant(result),
      owner_email: result.owner_email,
      owner_name: result.owner_name,
      owner_avatar_url: result.owner_avatar_url,
      owner_status: result.owner_status as string,
      owner_email_verified: result.owner_email_verified as boolean,
      owner_last_login_at: result.owner_last_login_at ? new Date(result.owner_last_login_at) : null,
      owner_phone: result.owner_phone,
      owner_phone_verified: result.owner_phone_verified as boolean,
      owner_signup_country: result.owner_signup_country,
      owner_signup_city: result.owner_signup_city,
      owner_signup_ip: result.owner_signup_ip,
      owner_signup_referrer: result.owner_signup_referrer,
      owner_timezone: result.owner_timezone,
      owner_designation: result.owner_designation,
      owner_login_count: typeof result.owner_login_count === "string"
        ? parseInt(result.owner_login_count, 10) : Number(result.owner_login_count ?? 0),
      owner_last_login_ip: result.owner_last_login_ip,
      owner_profile_completed_at: result.owner_profile_completed_at
        ? new Date(result.owner_profile_completed_at) : null,
      owner_created_at: new Date(result.owner_created_at),
      owner_updated_at: new Date(result.owner_updated_at),
    };
  }

  /**
   * Get subscription count for tenant
   */
  async getSubscriptionCount(tenantId: string): Promise<number> {
    const result = await db
      .selectFrom("subscriptions")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  /**
   * Get current subscription for tenant (ACTIVE or TRIALING) with full row for API response
   */
  async getActiveSubscription(tenantId: string): Promise<{
    id: string;
    tenant_id: string;
    plan_version_id: string;
    plan_code_snapshot: string;
    plan_name_snapshot: string;
    plan_version_snapshot: number;
    billing_cycle: string;
    currency: string;
    original_price: string | number;
    discount_applied: string | number;
    price_snapshot: string | number;
    external_subscription_id: string | null;
    external_customer_id: string | null;
    started_at: Date;
    current_period_start: Date;
    current_period_end: Date;
    cancelled_at: Date | null;
    cancel_effective_at: Date | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  } | null> {
    const result = await db
      .selectFrom("subscriptions")
      .select([
        "id",
        "tenant_id",
        "plan_version_id",
        "plan_code_snapshot",
        "plan_name_snapshot",
        "plan_version_snapshot",
        "billing_cycle",
        "currency",
        "original_price",
        "discount_applied",
        "price_snapshot",
        "external_subscription_id",
        "external_customer_id",
        "started_at",
        "current_period_start",
        "current_period_end",
        "cancelled_at",
        "cancel_effective_at",
        "status",
        "created_at",
        "updated_at",
      ])
      .where("tenant_id", "=", tenantId)
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    return result || null;
  }

  /**
   * Delete tenant by ID (cascades to all related tables via FK constraints)
   */
  async deleteById(id: string, trx?: any): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("tenants")
      .where("id", "=", id)
      .executeTakeFirst();
    return BigInt(result.numDeletedRows) > 0n;
  }

  /**
   * Count total tenants
   */
  async count(status?: TenantStatus): Promise<number> {
    let query = db.selectFrom("tenants").select(db.fn.countAll().as("count"));

    if (status) {
      query = query.where("status", "=", status);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToTenant(row: Record<string, unknown>): Tenant {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      custom_domain: row.custom_domain as string | null,
      owner_user_id: row.owner_user_id as string,
      status: row.status as TenantStatus,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }

  private mapToListRow(row: Record<string, unknown>): TenantListRow {
    return {
      ...this.mapToTenant(row),
      owner_email: row.owner_email as string | null | undefined,
      owner_name: row.owner_name as string | null | undefined,
      owner_phone: row.owner_phone as string | null | undefined,
      active_plan_name: row.active_plan_name as string | null | undefined,
      active_plan_code: row.active_plan_code as string | null | undefined,
      active_plan_status: row.active_plan_status as string | null | undefined,
      active_billing_cycle: row.active_billing_cycle as string | null | undefined,
      active_period_start: row.active_period_start
        ? new Date(row.active_period_start as string)
        : null,
      active_period_end: row.active_period_end
        ? new Date(row.active_period_end as string)
        : null,
      primary_domain: row.primary_domain as string | null | undefined,
    };
  }

  /**
   * Export tenants with owner info, filtered by signup date range.
   * Returns all matching rows (no pagination) for export use.
   */
  async exportTenants(startDate?: Date, endDate?: Date): Promise<{
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: Date;
    owner_name: string | null;
    owner_email: string | null;
    owner_phone: string | null;
    owner_signup_country: string | null;
    owner_signup_city: string | null;
    owner_last_login_at: Date | null;
    owner_login_count: number;
    active_plan_name: string | null;
  }[]> {
    const activeSubSubquery = db
      .selectFrom("subscriptions")
      .select(["tenant_id", "plan_name_snapshot"])
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .orderBy("tenant_id")
      .orderBy("created_at", "desc")
      .distinctOn("tenant_id")
      .as("active_sub");

    let query = db
      .selectFrom("tenants")
      .leftJoin("tenant_users", "tenants.owner_user_id", "tenant_users.id")
      .leftJoin(activeSubSubquery, "tenants.id", "active_sub.tenant_id")
      .select([
        "tenants.id",
        "tenants.name",
        "tenants.slug",
        "tenants.status",
        "tenants.created_at",
        "tenant_users.name as owner_name",
        "tenant_users.email as owner_email",
        "tenant_users.phone as owner_phone",
        "tenant_users.signup_country as owner_signup_country",
        "tenant_users.signup_city as owner_signup_city",
        "tenant_users.last_login_at as owner_last_login_at",
        "tenant_users.login_count as owner_login_count",
        "active_sub.plan_name_snapshot as active_plan_name",
      ]);

    if (startDate) {
      query = query.where("tenants.created_at", ">=", startDate);
    }
    if (endDate) {
      query = query.where("tenants.created_at", "<=", endDate);
    }

    const rows = await query.orderBy("tenants.created_at", "desc").execute();

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      status: r.status as string,
      created_at: r.created_at as Date,
      owner_name: r.owner_name as string | null,
      owner_email: r.owner_email as string | null,
      owner_phone: r.owner_phone as string | null,
      owner_signup_country: r.owner_signup_country as string | null,
      owner_signup_city: r.owner_signup_city as string | null,
      owner_last_login_at: r.owner_last_login_at ? new Date(r.owner_last_login_at as unknown as string) : null,
      owner_login_count: typeof r.owner_login_count === "string"
        ? parseInt(r.owner_login_count, 10)
        : Number(r.owner_login_count ?? 0),
      active_plan_name: r.active_plan_name as string | null,
    }));
  }

  /**
   * Find all domains for a tenant, ordered by primary first
   */
  async findDomainsByTenantId(tenantId: string) {
    return db
      .selectFrom("tenant_domains")
      .select([
        "id",
        "domain_type",
        "domain_name",
        "subdomain_prefix",
        "status",
        "is_primary",
        "ssl_active",
        "ssl_status",
        "ownership_verified",
        "verified_at",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId)
      .orderBy("is_primary", "desc")
      .orderBy("created_at", "asc")
      .execute();
  }
}

export default new TenantRepository();
