import { sql } from "kysely";
import { db } from "../db/connection";
import { DashboardStatsResponse } from "../types/dashboard.type";

class DashboardService {
  /**
   * Get aggregated dashboard statistics.
   * All queries run in parallel for maximum performance.
   */
  async getStats(): Promise<DashboardStatsResponse> {
    const [
      tenantCounts,
      subscriptionCounts,
      mrrResult,
      planDistribution,
      appTotal,
      appAssignments,
      recentTenants,
      recentSubscriptions,
    ] = await Promise.all([
      // 1. Tenant counts by status
      db
        .selectFrom("tenants")
        .select(["status", db.fn.countAll().as("count")])
        .groupBy("status")
        .execute(),

      // 2. Subscription counts by status
      db
        .selectFrom("subscriptions")
        .select(["status", db.fn.countAll().as("count")])
        .groupBy("status")
        .execute(),

      // 3. MRR: sum of active subscription prices (normalized to monthly)
      db
        .selectFrom("subscriptions")
        .select(
          sql<string>`COALESCE(SUM(
            CASE
              WHEN billing_cycle = 'MONTHLY' THEN price_snapshot
              WHEN billing_cycle = 'YEARLY' THEN price_snapshot / 12
              ELSE 0
            END
          ), 0)`.as("mrr")
        )
        .where("status", "in", ["ACTIVE", "TRIALING"])
        .executeTakeFirst(),

      // 4. Plan distribution (all subscriptions grouped by plan name + status,
      //    so the dashboard can filter by status client-side)
      db
        .selectFrom("subscriptions")
        .select([
          "plan_name_snapshot",
          "status",
          db.fn.countAll().as("count"),
        ])
        .groupBy(["plan_name_snapshot", "status"])
        .orderBy(db.fn.countAll(), "desc")
        .execute(),

      // 5. Total active applications
      db
        .selectFrom("applications")
        .select(db.fn.countAll().as("count"))
        .where("is_active", "=", true)
        .executeTakeFirst(),

      // 6. Active tenant-application assignments
      db
        .selectFrom("tenant_applications")
        .select(db.fn.countAll().as("count"))
        .where("status", "in", ["ACTIVE", "TRIALING"])
        .executeTakeFirst(),

      // 7. Recent tenants (last 5)
      db
        .selectFrom("tenants")
        .select(["id", "name", "slug", "status", "created_at"])
        .orderBy("created_at", "desc")
        .limit(5)
        .execute(),

      // 8. Recent subscriptions (last 5, with tenant name)
      db
        .selectFrom("subscriptions")
        .innerJoin("tenants", "subscriptions.tenant_id", "tenants.id")
        .select([
          "subscriptions.id",
          "subscriptions.tenant_id",
          "tenants.name as tenant_name",
          "subscriptions.plan_name_snapshot",
          "subscriptions.status",
          "subscriptions.price_snapshot",
          "subscriptions.currency",
          "subscriptions.billing_cycle",
          "subscriptions.created_at",
        ])
        .orderBy("subscriptions.created_at", "desc")
        .limit(5)
        .execute(),
    ]);

    // Map tenant counts
    const tenantCountMap: Record<string, number> = {};
    let tenantTotal = 0;
    for (const row of tenantCounts) {
      const count = Number(row.count);
      tenantCountMap[row.status as string] = count;
      tenantTotal += count;
    }

    // Map subscription counts
    const subCountMap: Record<string, number> = {};
    let subTotal = 0;
    for (const row of subscriptionCounts) {
      const count = Number(row.count);
      subCountMap[row.status as string] = count;
      subTotal += count;
    }

    return {
      tenants: {
        total: tenantTotal,
        active: tenantCountMap["ACTIVE"] ?? 0,
        pending: tenantCountMap["PENDING"] ?? 0,
        suspended: tenantCountMap["SUSPENDED"] ?? 0,
        cancelled: tenantCountMap["CANCELLED"] ?? 0,
      },
      subscriptions: {
        total: subTotal,
        active: subCountMap["ACTIVE"] ?? 0,
        trialing: subCountMap["TRIALING"] ?? 0,
        cancelled: subCountMap["CANCELLED"] ?? 0,
        expired: subCountMap["EXPIRED"] ?? 0,
        past_due: subCountMap["PAST_DUE"] ?? 0,
      },
      mrr: Number(mrrResult?.mrr ?? 0),
      applications: {
        total: Number(appTotal?.count ?? 0),
        active_assignments: Number(appAssignments?.count ?? 0),
      },
      plan_distribution: planDistribution.map((row) => ({
        plan_name: row.plan_name_snapshot,
        status: row.status as string,
        count: Number(row.count),
      })),
      recent_tenants: recentTenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status as string,
        created_at: t.created_at as Date,
      })),
      recent_subscriptions: recentSubscriptions.map((s) => ({
        id: s.id,
        tenant_id: s.tenant_id,
        tenant_name: s.tenant_name as string,
        plan_name: s.plan_name_snapshot,
        status: s.status as string,
        price: Number(s.price_snapshot),
        currency: s.currency,
        billing_cycle: s.billing_cycle,
        created_at: s.created_at as Date,
      })),
    };
  }
}

export default new DashboardService();
