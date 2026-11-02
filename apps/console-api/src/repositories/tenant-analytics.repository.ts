import { db } from "../db/connection";

const num = (v: unknown): number =>
  typeof v === "string" ? parseInt(v, 10) || 0 : Number(v ?? 0);

export interface TenantBaseRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: Date | string;
  custom_domain: string | null;
  owner_user_id: string | null;
}

const TENANT_COLS = [
  "id",
  "name",
  "slug",
  "status",
  "created_at",
  "custom_domain",
  "owner_user_id",
] as const;

class TenantAnalyticsRepository {
  async listTenants(): Promise<TenantBaseRow[]> {
    const rows = await db.selectFrom("tenants").select(TENANT_COLS).execute();
    return rows as unknown as TenantBaseRow[];
  }

  /** owner_user_id -> { email, phone } for a batch of tenants. */
  async ownerContacts(
    ownerIds: string[]
  ): Promise<Map<string, { email: string | null; phone: string | null }>> {
    const ids = [...new Set(ownerIds.filter(Boolean))];
    if (!ids.length) return new Map();
    const rows = await db
      .selectFrom("tenant_users")
      .select(["id", "email", "phone"])
      .where("id", "in", ids)
      .execute();
    return new Map(
      rows.map((r) => [r.id, { email: r.email ?? null, phone: r.phone ?? null }])
    );
  }

  /** tenant_id -> { count, lastLogin, recentLogins } */
  async memberRollup(sinceIso: string) {
    const counts = await db
      .selectFrom("tenant_members")
      .select(["tenant_id"])
      .select((eb) => eb.fn.countAll().as("count"))
      .select((eb) => eb.fn.max("last_login_at").as("last_login"))
      .groupBy("tenant_id")
      .execute();
    const recent = await db
      .selectFrom("tenant_members")
      .select(["tenant_id"])
      .select((eb) => eb.fn.countAll().as("count"))
      .where("last_login_at", ">=", new Date(sinceIso))
      .groupBy("tenant_id")
      .execute();
    const recentMap = new Map(recent.map((r) => [r.tenant_id, num(r.count)]));
    return new Map(
      counts.map((r) => [
        r.tenant_id,
        {
          count: num(r.count),
          lastLogin: r.last_login ? new Date(r.last_login as unknown as string) : null,
          recentLogins: recentMap.get(r.tenant_id) ?? 0,
        },
      ])
    );
  }

  /** tenant_id -> active app count */
  async activeAppRollup() {
    const rows = await db
      .selectFrom("tenant_applications")
      .select(["tenant_id"])
      .select((eb) => eb.fn.countAll().as("count"))
      .where("status", "=", "ACTIVE")
      .groupBy("tenant_id")
      .execute();
    return new Map(rows.map((r) => [r.tenant_id, num(r.count)]));
  }

  /** tenant_id -> course count */
  async courseRollup() {
    const rows = await db
      .selectFrom("courses")
      .select(["tenant_id"])
      .select((eb) => eb.fn.countAll().as("count"))
      .groupBy("tenant_id")
      .execute();
    return new Map(rows.map((r) => [r.tenant_id, num(r.count)]));
  }

  /** tenant_id -> last usage-counter update */
  async usageRecency() {
    const rows = await db
      .selectFrom("tenant_usage_counters")
      .select(["tenant_id"])
      .select((eb) => eb.fn.max("updated_at").as("last"))
      .groupBy("tenant_id")
      .execute();
    return new Map(
      rows.map((r) => [
        r.tenant_id,
        r.last ? new Date(r.last as unknown as string) : null,
      ])
    );
  }

  /** tenant_id -> active subscription (plan + status) */
  async activeSubscriptions() {
    const rows = await db
      .selectFrom("subscriptions")
      .select([
        "tenant_id",
        "plan_name_snapshot",
        "plan_code_snapshot",
        "status",
        "current_period_end",
        "grace_period_ends_at",
        "cancel_effective_at",
        "started_at",
      ])
      .where("status", "=", "ACTIVE")
      .execute();
    const map = new Map<
      string,
      {
        plan: string;
        planCode: string;
        status: string;
        currentPeriodEnd: string | null;
        validUntil: string | null;
      }
    >();
    for (const r of rows) {
      const validUntil =
        r.grace_period_ends_at ?? r.current_period_end ?? null;
      map.set(r.tenant_id, {
        plan: r.plan_name_snapshot,
        planCode: r.plan_code_snapshot,
        status: r.status as string,
        currentPeriodEnd: r.current_period_end
          ? new Date(r.current_period_end as unknown as string).toISOString()
          : null,
        validUntil: validUntil
          ? new Date(validUntil as unknown as string).toISOString()
          : null,
      });
    }
    return map;
  }

  // ─── Detail ─────────────────────────────────────────────────

  async getTenant(tenantId: string): Promise<TenantBaseRow | undefined> {
    const row = await db
      .selectFrom("tenants")
      .select(TENANT_COLS)
      .where("id", "=", tenantId)
      .executeTakeFirst();
    return row as unknown as TenantBaseRow | undefined;
  }

  async getOwnerEmail(ownerUserId: string): Promise<string | null> {
    const row = await db
      .selectFrom("tenant_users")
      .select(["email"])
      .where("id", "=", ownerUserId)
      .executeTakeFirst();
    return row?.email ?? null;
  }

  async getOwnerContact(
    ownerUserId: string
  ): Promise<{ email: string | null; phone: string | null }> {
    const row = await db
      .selectFrom("tenant_users")
      .select(["email", "phone"])
      .where("id", "=", ownerUserId)
      .executeTakeFirst();
    return { email: row?.email ?? null, phone: row?.phone ?? null };
  }

  async tenantEntitlements(tenantId: string) {
    return db
      .selectFrom("entitlements")
      .select([
        "feature_key",
        "product_code",
        "application_code",
        "is_unlimited",
        "limit_value",
        "used_value",
      ])
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", true)
      .execute();
  }

  /** most recent usage-counter update for a single tenant */
  async tenantUsageRecency(tenantId: string): Promise<Date | null> {
    const row = await db
      .selectFrom("tenant_usage_counters")
      .select((eb) => eb.fn.max("updated_at").as("last"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return row?.last ? new Date(row.last as unknown as string) : null;
  }

  /** product_code -> current usage value for a tenant */
  async tenantUsageCounters(tenantId: string) {
    const rows = await db
      .selectFrom("tenant_usage_counters")
      .select(["product_code", "current_value"])
      .where("tenant_id", "=", tenantId)
      .execute();
    return new Map(rows.map((r) => [r.product_code, num(r.current_value)]));
  }

  async tenantMemberStats(tenantId: string, sinceIso: string) {
    const total = await db
      .selectFrom("tenant_members")
      .select((eb) => eb.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const recent = await db
      .selectFrom("tenant_members")
      .select((eb) => eb.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId)
      .where("last_login_at", ">=", new Date(sinceIso))
      .executeTakeFirst();
    const lastLogin = await db
      .selectFrom("tenant_members")
      .select((eb) => eb.fn.max("last_login_at").as("last"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return {
      total: num(total?.count),
      recentLogins: num(recent?.count),
      lastLogin: lastLogin?.last
        ? new Date(lastLogin.last as unknown as string)
        : null,
    };
  }

  /** headline offering counts for a single tenant */
  async offeringCounts(tenantId: string) {
    const count = async (
      table: "courses" | "books" | "bundles" | "batches" | "test_series"
    ) => {
      const r = await db
        .selectFrom(table)
        .select((eb) => eb.fn.countAll().as("count"))
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst();
      return num(r?.count);
    };
    const [courses, books, bundles, batches, testSeries] = await Promise.all([
      count("courses"),
      count("books"),
      count("bundles"),
      count("batches"),
      count("test_series"),
    ]);
    return { courses, books, bundles, batches, testSeries };
  }

  /** Recent activity for a single tenant (product access + admin actions). */
  async tenantActivity(tenantId: string, limit: number) {
    const [usage, usageAdmin, appEvents] = await Promise.all([
      db
        .selectFrom("usage_events")
        .select(["product_code", "feature_key", "event_type", "created_at"])
        .where("tenant_id", "=", tenantId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute(),
      db
        .selectFrom("tenant_usage_events")
        .select(["product_code", "event_type", "actor_type", "actor_id", "reason", "created_at"])
        .where("tenant_id", "=", tenantId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute(),
      db
        .selectFrom("tenant_application_events")
        .select(["event_type", "old_status", "new_status", "admin_user_id", "is_system", "created_at"])
        .where("tenant_id", "=", tenantId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute(),
    ]);
    return { usage, usageAdmin, appEvents };
  }

  // ─── Overview helpers ───────────────────────────────────────

  async recentTenants(limit: number) {
    return db
      .selectFrom("tenants")
      .select(["id", "name", "created_at"])
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute();
  }

  async recentSubscriptions(limit: number) {
    return db
      .selectFrom("subscriptions as s")
      .innerJoin("tenants as t", "t.id", "s.tenant_id")
      .select([
        "s.tenant_id",
        "t.name as tenant_name",
        "s.plan_name_snapshot",
        "s.status",
        "s.started_at",
      ])
      .orderBy("s.started_at", "desc")
      .limit(limit)
      .execute();
  }
}

export default new TenantAnalyticsRepository();
