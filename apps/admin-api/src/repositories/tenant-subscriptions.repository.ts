import { ulid } from "ulid";
import { sql } from "kysely";
import { db } from "../db/connection";
import type { tenant_subscription_status } from "../db/enums";

// ─── Subscription Plans ───────────────────────────────────────────────────────

export interface CreatePlanInput {
  tenant_id: string;
  name: string;
  description?: string;
  billing_cycle: "MONTHLY" | "YEARLY";
  currency: string;
  amount: string; // Decimal as string for Kysely
  amount_in_smallest: number;
  gateway_plan_id?: string;
  gateway_provider: string;
  trial_days?: number;
  features_summary?: string;
  metadata?: unknown;
}

export interface UpdatePlanInput {
  name?: string;
  description?: string;
  is_active?: boolean;
  features_summary?: string;
}

class TenantSubscriptionsRepository {
  // ─── Plans ────────────────────────────────────────────────────────────────

  async createPlan(data: CreatePlanInput) {
    const id = ulid();
    const now = new Date();
    return db
      .insertInto("tenant_subscription_plans")
      .values({
        id,
        tenant_id: data.tenant_id,
        name: data.name,
        description: data.description ?? null,
        billing_cycle: data.billing_cycle,
        currency: data.currency,
        amount: data.amount,
        amount_in_smallest: data.amount_in_smallest,
        gateway_plan_id: data.gateway_plan_id ?? null,
        gateway_provider: data.gateway_provider,
        is_active: true,
        trial_days: data.trial_days ?? 0,
        features_summary: data.features_summary ?? null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findActiveByBillingCycleAndCurrency(
    tenantId: string,
    billingCycle: "MONTHLY" | "YEARLY",
    currency: string
  ) {
    return db
      .selectFrom("tenant_subscription_plans")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("billing_cycle", "=", billingCycle)
      .where("currency", "=", currency)
      .where("is_active", "=", true)
      .executeTakeFirst();
  }

  async findPlanById(tenantId: string, planId: string) {
    return db
      .selectFrom("tenant_subscription_plans")
      .selectAll()
      .where("id", "=", planId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  async listPlans(tenantId: string, includeInactive = false) {
    let query = db
      .selectFrom("tenant_subscription_plans")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (!includeInactive) {
      query = query.where("is_active", "=", true);
    }

    return query.orderBy("created_at", "desc").execute();
  }

  async updatePlan(tenantId: string, planId: string, data: UpdatePlanInput) {
    return db
      .updateTable("tenant_subscription_plans")
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        ...(data.features_summary !== undefined && { features_summary: data.features_summary }),
        updated_at: new Date(),
      })
      .where("id", "=", planId)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
  }

  async countSubscribersByPlan(tenantId: string, planId: string) {
    const result = await db
      .selectFrom("tenant_user_subscriptions")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("plan_id", "=", planId)
      .where("status", "in", ["ACTIVE", "PENDING", "AUTHENTICATED", "PAUSED"] as tenant_subscription_status[])
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(tenantId: string) {
    return db
      .selectFrom("tenant_subscription_settings")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  async upsertSettings(
    tenantId: string,
    data: {
      is_enabled?: boolean;
      grace_period_days?: number;
      reminder_days_before?: unknown;
      dunning_email_interval_hours?: number;
      subscription_name?: string | null;
    }
  ) {
    const now = new Date();
    const existing = await this.getSettings(tenantId);

    if (existing) {
      return db
        .updateTable("tenant_subscription_settings")
        .set({
          ...(data.is_enabled !== undefined && { is_enabled: data.is_enabled }),
          ...(data.grace_period_days !== undefined && { grace_period_days: data.grace_period_days }),
          ...(data.reminder_days_before !== undefined && {
            reminder_days_before: JSON.stringify(data.reminder_days_before),
          }),
          ...(data.dunning_email_interval_hours !== undefined && {
            dunning_email_interval_hours: data.dunning_email_interval_hours,
          }),
          ...(data.subscription_name !== undefined && {
            subscription_name: data.subscription_name,
          }),
          updated_at: now,
        })
        .where("tenant_id", "=", tenantId)
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return db
      .insertInto("tenant_subscription_settings")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        is_enabled: data.is_enabled ?? false,
        grace_period_days: data.grace_period_days ?? 0,
        reminder_days_before: data.reminder_days_before
          ? JSON.stringify(data.reminder_days_before)
          : null,
        dunning_email_interval_hours: data.dunning_email_interval_hours ?? 48,
        subscription_name: data.subscription_name ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // ─── Page Config ──────────────────────────────────────────────────────────

  async getPageConfig(tenantId: string) {
    return db
      .selectFrom("tenant_subscription_settings")
      .select(["page_config"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  async updatePageConfig(tenantId: string, pageConfig: unknown) {
    const now = new Date();
    const existing = await this.getSettings(tenantId);

    if (existing) {
      return db
        .updateTable("tenant_subscription_settings")
        .set({
          page_config: JSON.stringify(pageConfig),
          updated_at: now,
        })
        .where("tenant_id", "=", tenantId)
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    // Create settings row if it doesn't exist
    return db
      .insertInto("tenant_subscription_settings")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        is_enabled: false,
        grace_period_days: 0,
        dunning_email_interval_hours: 48,
        page_config: JSON.stringify(pageConfig),
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // ─── Subscribers (read-only from tenant admin) ────────────────────────────

  async listSubscribers(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      planId?: string;
      search?: string;
    } = {}
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("tenant_user_subscriptions")
      .innerJoin("tenant_members", "tenant_members.id", "tenant_user_subscriptions.member_id")
      .select(db.fn.count<number>("tenant_user_subscriptions.id").as("count"))
      .where("tenant_user_subscriptions.tenant_id", "=", tenantId);

    let listQuery = db
      .selectFrom("tenant_user_subscriptions")
      .innerJoin("tenant_members", "tenant_members.id", "tenant_user_subscriptions.member_id")
      .select([
        "tenant_user_subscriptions.id",
        "tenant_user_subscriptions.member_id",
        "tenant_user_subscriptions.plan_id",
        "tenant_user_subscriptions.plan_name_snapshot",
        "tenant_user_subscriptions.billing_cycle_snapshot",
        "tenant_user_subscriptions.amount_snapshot",
        "tenant_user_subscriptions.currency_snapshot",
        "tenant_user_subscriptions.status",
        "tenant_user_subscriptions.current_period_start",
        "tenant_user_subscriptions.current_period_end",
        "tenant_user_subscriptions.next_charge_at",
        "tenant_user_subscriptions.cancel_at_period_end",
        "tenant_user_subscriptions.payment_failure_count",
        "tenant_user_subscriptions.created_at",
        "tenant_members.name as member_name",
        "tenant_members.email as member_email",
      ])
      .where("tenant_user_subscriptions.tenant_id", "=", tenantId);

    if (params.status) {
      const status = params.status as tenant_subscription_status;
      countQuery = countQuery.where("tenant_user_subscriptions.status", "=", status);
      listQuery = listQuery.where("tenant_user_subscriptions.status", "=", status);
    }

    if (params.planId) {
      countQuery = countQuery.where("tenant_user_subscriptions.plan_id", "=", params.planId);
      listQuery = listQuery.where("tenant_user_subscriptions.plan_id", "=", params.planId);
    }

    if (params.search) {
      const search = `%${params.search}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("tenant_members.name", "ilike", search),
          eb("tenant_members.email", "ilike", search),
        ])
      );
      listQuery = listQuery.where((eb) =>
        eb.or([
          eb("tenant_members.name", "ilike", search),
          eb("tenant_members.email", "ilike", search),
        ])
      );
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      .orderBy("tenant_user_subscriptions.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return { subscribers: rows, total, page, limit };
  }

  async findSubscriberById(tenantId: string, subscriptionId: string) {
    return db
      .selectFrom("tenant_user_subscriptions")
      .innerJoin("tenant_members", "tenant_members.id", "tenant_user_subscriptions.member_id")
      .select([
        "tenant_user_subscriptions.id",
        "tenant_user_subscriptions.member_id",
        "tenant_user_subscriptions.plan_id",
        "tenant_user_subscriptions.gateway_subscription_id",
        "tenant_user_subscriptions.gateway_customer_id",
        "tenant_user_subscriptions.gateway_provider",
        "tenant_user_subscriptions.plan_name_snapshot",
        "tenant_user_subscriptions.billing_cycle_snapshot",
        "tenant_user_subscriptions.amount_snapshot",
        "tenant_user_subscriptions.currency_snapshot",
        "tenant_user_subscriptions.status",
        "tenant_user_subscriptions.current_period_start",
        "tenant_user_subscriptions.current_period_end",
        "tenant_user_subscriptions.trial_ends_at",
        "tenant_user_subscriptions.grace_period_ends_at",
        "tenant_user_subscriptions.cancelled_at",
        "tenant_user_subscriptions.cancel_at_period_end",
        "tenant_user_subscriptions.ended_at",
        "tenant_user_subscriptions.paused_at",
        "tenant_user_subscriptions.last_payment_at",
        "tenant_user_subscriptions.last_payment_amount",
        "tenant_user_subscriptions.next_charge_at",
        "tenant_user_subscriptions.payment_failure_count",
        "tenant_user_subscriptions.short_url",
        "tenant_user_subscriptions.created_at",
        "tenant_user_subscriptions.updated_at",
        "tenant_members.name as member_name",
        "tenant_members.email as member_email",
        "tenant_members.avatar_url as member_avatar_url",
      ])
      .where("tenant_user_subscriptions.id", "=", subscriptionId)
      .where("tenant_user_subscriptions.tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  // ─── Analytics ───────────────────────────────────────────────────────────

  async getAnalytics(tenantId: string) {
    const parseDecimal = (val: unknown): number =>
      typeof val === "string" ? parseFloat(val) : Number(val ?? 0);

    const [summary, mrr, growth, churn, revenueByPlan] = await Promise.all([
      // 1. Status summary
      db
        .selectFrom("tenant_user_subscriptions")
        .select([
          sql<number>`count(*)::int`.as("total"),
          sql<number>`count(*) filter (where status = 'ACTIVE')::int`.as("active"),
          sql<number>`count(*) filter (where status = 'CANCELLED')::int`.as("cancelled"),
          sql<number>`count(*) filter (where status = 'PAUSED')::int`.as("paused"),
          sql<number>`count(*) filter (where status = 'HALTED')::int`.as("halted"),
          sql<number>`count(*) filter (where status = 'EXPIRED')::int`.as("expired"),
          sql<number>`count(*) filter (where trial_ends_at is not null and trial_ends_at > now() and status in ('ACTIVE', 'AUTHENTICATED'))::int`.as("on_trial"),
          sql<number>`count(*) filter (where payment_failure_count > 0 and status = 'ACTIVE')::int`.as("with_payment_failures"),
        ])
        .where("tenant_id", "=", tenantId)
        .executeTakeFirstOrThrow(),

      // 2. MRR (Monthly Recurring Revenue) from active subscriptions
      db
        .selectFrom("tenant_user_subscriptions")
        .select([
          "currency_snapshot as currency",
          sql<string>`sum(
            case
              when billing_cycle_snapshot = 'MONTHLY' then amount_snapshot::numeric
              when billing_cycle_snapshot = 'YEARLY' then amount_snapshot::numeric / 12
              else 0
            end
          )`.as("mrr"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("status", "=", "ACTIVE" as tenant_subscription_status)
        .groupBy("currency_snapshot")
        .execute(),

      // 3. Growth timeline (new subscriptions by date)
      db
        .selectFrom("tenant_user_subscriptions")
        .select([
          sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"),
          sql<number>`count(*)::int`.as("count"),
        ])
        .where("tenant_id", "=", tenantId)
        .groupBy(sql`date(created_at)`)
        .orderBy(sql`date(created_at)`)
        .execute(),

      // 4. Churn timeline (cancellations by date)
      db
        .selectFrom("tenant_user_subscriptions")
        .select([
          sql<string>`to_char(date(cancelled_at), 'YYYY-MM-DD')`.as("date"),
          sql<number>`count(*)::int`.as("count"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("cancelled_at", "is not", null)
        .groupBy(sql`date(cancelled_at)`)
        .orderBy(sql`date(cancelled_at)`)
        .execute(),

      // 5. Revenue by plan (active subscribers)
      db
        .selectFrom("tenant_user_subscriptions")
        .select([
          "plan_id",
          "plan_name_snapshot",
          "currency_snapshot",
          sql<number>`count(*)::int`.as("subscriber_count"),
          sql<string>`sum(amount_snapshot::numeric)`.as("total_revenue"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("status", "=", "ACTIVE" as tenant_subscription_status)
        .groupBy(["plan_id", "plan_name_snapshot", "currency_snapshot"])
        .orderBy("subscriber_count", "desc")
        .execute(),
    ]);

    // Build status distribution from summary
    const statusDistribution: Array<{ name: string; value: number }> = [];
    if (summary.active > 0) statusDistribution.push({ name: "Active", value: summary.active });
    if (summary.cancelled > 0) statusDistribution.push({ name: "Cancelled", value: summary.cancelled });
    if (summary.paused > 0) statusDistribution.push({ name: "Paused", value: summary.paused });
    if (summary.halted > 0) statusDistribution.push({ name: "Halted", value: summary.halted });
    if (summary.expired > 0) statusDistribution.push({ name: "Expired", value: summary.expired });
    const otherCount = summary.total - summary.active - summary.cancelled - summary.paused - summary.halted - summary.expired;
    if (otherCount > 0) statusDistribution.push({ name: "Other", value: otherCount });

    return {
      summary: {
        total: summary.total,
        active: summary.active,
        cancelled: summary.cancelled,
        paused: summary.paused,
        halted: summary.halted,
        expired: summary.expired,
        on_trial: summary.on_trial,
        with_payment_failures: summary.with_payment_failures,
      },
      mrr: mrr.map((r) => ({
        currency: String(r.currency),
        amount: Math.round(parseDecimal(r.mrr) * 100) / 100,
      })),
      growth_timeline: growth.map((r) => ({
        date: String(r.date).slice(0, 10),
        count: r.count,
      })),
      status_distribution: statusDistribution,
      revenue_by_plan: revenueByPlan.map((r) => ({
        plan_id: r.plan_id,
        plan_name: String(r.plan_name_snapshot),
        currency: String(r.currency_snapshot),
        subscriber_count: r.subscriber_count,
        total_revenue: parseDecimal(r.total_revenue),
      })),
      churn_timeline: churn.map((r) => ({
        date: String(r.date).slice(0, 10),
        count: r.count,
      })),
    };
  }

  async listSubscriptionEvents(tenantId: string, subscriptionId: string) {
    return db
      .selectFrom("tenant_subscription_events")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("subscription_id", "=", subscriptionId)
      .orderBy("created_at", "desc")
      .execute();
  }
}

export default new TenantSubscriptionsRepository();
