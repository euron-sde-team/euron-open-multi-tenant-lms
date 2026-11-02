import { db } from "../db/connection";
import { sql } from "kysely";
import {
  USD_TO_INR_RATE,
  makeRevenueBreakdown,
  type RevenueBreakdown,
} from "../utils/currency.util";

export interface ContentOverview {
  total_courses: number;
  published_courses: number;
  draft_courses: number;
  self_paced_courses: number;
  total_books: number;
  published_books: number;
  draft_books: number;
  total_bundles: number;
  published_bundles: number;
  total_categories: number;
  total_instructors: number;
  total_pages: number;
  published_pages: number;
}

export interface MemberOverview {
  total_members: number;
  active_members: number;
  members_joined_last_30_days: number;
}

export interface EnrollmentOverview {
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  free_enrollments: number;
  paid_enrollments: number;
}

export interface RevenueOverview {
  /** Gross revenue from PAID orders, split by original payment currency. */
  total_revenue: RevenueBreakdown;
  /** Revenue from PAID orders in the last 30 days, split by currency. */
  revenue_last_30_days: RevenueBreakdown;
  /** Total number of non-WALLET_TOPUP orders (all currencies, all statuses). */
  total_orders: number;
  /** Paid order counts per currency so AOV is interpretable. */
  paid_orders_inr: number;
  paid_orders_usd: number;
  /** Average order value per currency (undefined if no paid orders that currency). */
  average_order_value_inr: number | null;
  average_order_value_usd: number | null;
  /** Refunds on REFUNDED / PARTIALLY_REFUNDED orders, split by currency. */
  total_refunds: RevenueBreakdown;
  /** USD→INR rate used for `combined_inr`. Echoed for the UI subnote. */
  conversion_rate: number;
}

export interface RecentEnrollment {
  id: string;
  member_name: string | null;
  member_email: string | null;
  course_title: string;
  source: string;
  enrolled_at: string;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  member_name: string | null;
  member_email: string | null;
  total_amount: string;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface TopCourse {
  id: string;
  title: string;
  enrollment_count: number;
  status: string;
  mode: string;
}

class DashboardRepository {
  async getContentOverview(tenantId: string): Promise<ContentOverview> {
    const [courses, books, bundles, categories, instructors, pages] =
      await Promise.all([
        db
          .selectFrom("courses")
          .select([
            sql<number>`count(*)::int`.as("total"),
            sql<number>`count(*) filter (where status = 'PUBLISHED')::int`.as(
              "published"
            ),
            sql<number>`count(*) filter (where status = 'DRAFT')::int`.as(
              "draft"
            ),
            sql<number>`count(*) filter (where mode = 'SELF_PACED')::int`.as(
              "self_paced"
            ),
          ])
          .where("tenant_id", "=", tenantId)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom("books")
          .select([
            sql<number>`count(*)::int`.as("total"),
            sql<number>`count(*) filter (where status = 'PUBLISHED')::int`.as(
              "published"
            ),
            sql<number>`count(*) filter (where status = 'DRAFT')::int`.as(
              "draft"
            ),
          ])
          .where("tenant_id", "=", tenantId)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom("bundles")
          .select([
            sql<number>`count(*)::int`.as("total"),
            sql<number>`count(*) filter (where status = 'PUBLISHED')::int`.as(
              "published"
            ),
          ])
          .where("tenant_id", "=", tenantId)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom("categories")
          .select(sql<number>`count(*)::int`.as("total"))
          .where("tenant_id", "=", tenantId)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom("instructors")
          .select(sql<number>`count(*)::int`.as("total"))
          .where("tenant_id", "=", tenantId)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom("tenant_pages")
          .select([
            sql<number>`count(*)::int`.as("total"),
            sql<number>`count(*) filter (where is_published = true)::int`.as(
              "published"
            ),
          ])
          .where("tenant_id", "=", tenantId)
          .executeTakeFirstOrThrow(),
      ]);

    return {
      total_courses: courses.total,
      published_courses: courses.published,
      draft_courses: courses.draft,
      self_paced_courses: courses.self_paced,
      total_books: books.total,
      published_books: books.published,
      draft_books: books.draft,
      total_bundles: bundles.total,
      published_bundles: bundles.published,
      total_categories: categories.total,
      total_instructors: instructors.total,
      total_pages: pages.total,
      published_pages: pages.published,
    };
  }

  async getMemberOverview(tenantId: string): Promise<MemberOverview> {
    const result = await db
      .selectFrom("tenant_members")
      .select([
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(*) filter (where status = 'ACTIVE')::int`.as(
          "active"
        ),
        sql<number>`count(*) filter (where joined_at >= now() - interval '30 days')::int`.as(
          "last_30"
        ),
      ])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();

    return {
      total_members: result.total,
      active_members: result.active,
      members_joined_last_30_days: result.last_30,
    };
  }

  async getEnrollmentOverview(tenantId: string): Promise<EnrollmentOverview> {
    const result = await db
      .selectFrom("enrollments")
      .select([
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(*) filter (where status = 'ACTIVE')::int`.as(
          "active"
        ),
        sql<number>`count(*) filter (where status = 'COMPLETED')::int`.as(
          "completed"
        ),
        sql<number>`count(*) filter (where source = 'FREE' or source = 'ADMIN_GRANT')::int`.as(
          "free"
        ),
        sql<number>`count(*) filter (where source = 'PURCHASED' or source = 'BUNDLE' or source = 'COUPON')::int`.as(
          "paid"
        ),
      ])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();

    return {
      total_enrollments: result.total,
      active_enrollments: result.active,
      completed_enrollments: result.completed,
      free_enrollments: result.free,
      paid_enrollments: result.paid,
    };
  }

  async getRevenueOverview(tenantId: string): Promise<RevenueOverview> {
    // Exclude WALLET_TOPUP orders, those are end-user wallet recharges,
    // not tenant revenue. They should only be visible to core admin.
    //
    // Revenue is aggregated per-currency (INR, USD) because `payment_orders.total_amount`
    // is stored in the original charge currency. Summing across currencies without
    // separating them produces a meaningless number (see: original bug that treated
    // USD payments as INR). The UI renders INR / USD / Combined (INR-normalized).
    const result = await db
      .selectFrom("payment_orders")
      .select([
        sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'INR' then total_amount else 0 end), 0)`.as(
          "revenue_inr"
        ),
        sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'USD' then total_amount else 0 end), 0)`.as(
          "revenue_usd"
        ),
        sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'INR' and paid_at >= now() - interval '30 days' then total_amount else 0 end), 0)`.as(
          "revenue_30d_inr"
        ),
        sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'USD' and paid_at >= now() - interval '30 days' then total_amount else 0 end), 0)`.as(
          "revenue_30d_usd"
        ),
        sql<number>`count(*)::int`.as("total_orders"),
        sql<number>`count(*) filter (where status = 'PAID' and currency = 'INR')::int`.as(
          "paid_orders_inr"
        ),
        sql<number>`count(*) filter (where status = 'PAID' and currency = 'USD')::int`.as(
          "paid_orders_usd"
        ),
        sql<string>`coalesce(avg(case when status = 'PAID' and currency = 'INR' then total_amount end), 0)`.as(
          "avg_order_inr"
        ),
        sql<string>`coalesce(avg(case when status = 'PAID' and currency = 'USD' then total_amount end), 0)`.as(
          "avg_order_usd"
        ),
        sql<string>`coalesce(sum(case when status in ('REFUNDED', 'PARTIALLY_REFUNDED') and currency = 'INR' then total_amount else 0 end), 0)`.as(
          "refunds_inr"
        ),
        sql<string>`coalesce(sum(case when status in ('REFUNDED', 'PARTIALLY_REFUNDED') and currency = 'USD' then total_amount else 0 end), 0)`.as(
          "refunds_usd"
        ),
      ])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();

    const revenueInr = parseFloat(String(result.revenue_inr));
    const revenueUsd = parseFloat(String(result.revenue_usd));
    const revenue30dInr = parseFloat(String(result.revenue_30d_inr));
    const revenue30dUsd = parseFloat(String(result.revenue_30d_usd));
    const refundsInr = parseFloat(String(result.refunds_inr));
    const refundsUsd = parseFloat(String(result.refunds_usd));

    const avgInrRaw = parseFloat(String(result.avg_order_inr));
    const avgUsdRaw = parseFloat(String(result.avg_order_usd));

    return {
      total_revenue: makeRevenueBreakdown(revenueInr, revenueUsd),
      revenue_last_30_days: makeRevenueBreakdown(revenue30dInr, revenue30dUsd),
      total_orders: result.total_orders,
      paid_orders_inr: result.paid_orders_inr,
      paid_orders_usd: result.paid_orders_usd,
      average_order_value_inr:
        result.paid_orders_inr > 0 ? parseFloat(avgInrRaw.toFixed(2)) : null,
      average_order_value_usd:
        result.paid_orders_usd > 0 ? parseFloat(avgUsdRaw.toFixed(2)) : null,
      total_refunds: makeRevenueBreakdown(refundsInr, refundsUsd),
      conversion_rate: USD_TO_INR_RATE,
    };
  }

  async getRecentEnrollments(
    tenantId: string,
    limit = 5
  ): Promise<RecentEnrollment[]> {
    const rows = await db
      .selectFrom("enrollments as e")
      .innerJoin("tenant_members as m", "m.id", "e.tenant_member_id")
      .innerJoin("courses as c", "c.id", "e.course_id")
      .select([
        "e.id",
        "m.name as member_name",
        "m.email as member_email",
        "c.title as course_title",
        "e.source",
        "e.enrolled_at",
      ])
      .where("e.tenant_id", "=", tenantId)
      .orderBy("e.enrolled_at", "desc")
      .limit(limit)
      .execute();

    return rows.map((r) => ({
      id: r.id,
      member_name: r.member_name,
      member_email: r.member_email,
      course_title: r.course_title,
      source: r.source,
      enrolled_at: r.enrolled_at
        ? new Date(r.enrolled_at).toISOString()
        : new Date().toISOString(),
    }));
  }

  async getRecentOrders(tenantId: string, limit = 5): Promise<RecentOrder[]> {
    // Exclude WALLET_TOPUP orders, those are end-user wallet recharges,
    // not tenant-facing orders. They should only be visible to core admin.
    const rows = await db
      .selectFrom("payment_orders as o")
      .innerJoin("tenant_members as m", "m.id", "o.tenant_member_id")
      .select([
        "o.id",
        "o.order_number",
        "m.name as member_name",
        "m.email as member_email",
        "o.total_amount",
        "o.currency",
        "o.status",
        "o.paid_at",
        "o.created_at",
      ])
      .where("o.tenant_id", "=", tenantId)
      .orderBy("o.created_at", "desc")
      .limit(limit)
      .execute();

    return rows.map((r) => ({
      id: r.id,
      order_number: r.order_number,
      member_name: r.member_name,
      member_email: r.member_email,
      total_amount: String(r.total_amount),
      currency: r.currency,
      status: r.status,
      paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  async getTopCourses(tenantId: string, limit = 5): Promise<TopCourse[]> {
    const rows = await db
      .selectFrom("courses as c")
      .leftJoin("enrollments as e", (join) =>
        join.onRef("e.course_id", "=", "c.id").on("e.tenant_id", "=", tenantId)
      )
      .select([
        "c.id",
        "c.title",
        "c.status",
        "c.mode",
        sql<number>`count(e.id)::int`.as("enrollment_count"),
      ])
      .where("c.tenant_id", "=", tenantId)
      .where("c.status", "=", "PUBLISHED")
      .groupBy(["c.id", "c.title", "c.status", "c.mode"])
      .orderBy("enrollment_count", "desc")
      .limit(limit)
      .execute();

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      enrollment_count: r.enrollment_count,
      status: r.status,
      mode: r.mode,
    }));
  }

  async getCourseStatsByMode(tenantId: string): Promise<{
    self_paced: number;
  }> {
    const result = await db
      .selectFrom("courses")
      .select([
        sql<number>`count(*) filter (where mode = 'SELF_PACED')::int`.as(
          "self_paced"
        ),
      ])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();

    return {
      self_paced: result.self_paced,
    };
  }

  async getBookStatsWithAccess(tenantId: string): Promise<{
    total: number;
    published: number;
    draft: number;
    total_access: number;
  }> {
    const [bookStats, accessCount] = await Promise.all([
      db
        .selectFrom("books")
        .select([
          sql<number>`count(*)::int`.as("total"),
          sql<number>`count(*) filter (where status = 'PUBLISHED')::int`.as(
            "published"
          ),
          sql<number>`count(*) filter (where status = 'DRAFT')::int`.as("draft"),
        ])
        .where("tenant_id", "=", tenantId)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("book_access")
        .select(sql<number>`count(*)::int`.as("total"))
        .where("tenant_id", "=", tenantId)
        .where("status", "=", "ACTIVE")
        .executeTakeFirstOrThrow(),
    ]);

    return {
      total: bookStats.total,
      published: bookStats.published,
      draft: bookStats.draft,
      total_access: accessCount.total,
    };
  }

  async getEnrollmentBreakdownByCourse(
    tenantId: string,
    limit = 20,
    search?: string
  ): Promise<
    Array<{
      course_id: string;
      course_title: string;
      course_slug: string;
      mode: string;
      enrollment_count: number;
    }>
  > {
    let query = db
      .selectFrom("courses as c")
      .leftJoin("enrollments as e", (join) =>
        join.onRef("e.course_id", "=", "c.id").on("e.tenant_id", "=", tenantId)
      )
      .select([
        "c.id as course_id",
        "c.title as course_title",
        "c.slug as course_slug",
        "c.mode",
        sql<number>`count(e.id)::int`.as("enrollment_count"),
      ])
      .where("c.tenant_id", "=", tenantId);

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(
        sql<boolean>`(lower(c.title) like ${term} or lower(c.slug) like ${term})`
      );
    }

    const rows = await query
      .groupBy(["c.id", "c.title", "c.slug", "c.mode"])
      .orderBy("enrollment_count", "desc")
      .limit(limit)
      .execute();

    return rows.map((r) => ({
      course_id: r.course_id,
      course_title: r.course_title,
      course_slug: r.course_slug,
      mode: r.mode,
      enrollment_count: r.enrollment_count,
    }));
  }

  async getBookAccessBreakdown(
    tenantId: string,
    limit = 20,
    search?: string
  ): Promise<
    Array<{
      book_id: string;
      book_title: string;
      book_slug: string;
      access_count: number;
    }>
  > {
    let query = db
      .selectFrom("books as b")
      .leftJoin("book_access as ba", (join) =>
        join
          .onRef("ba.book_id", "=", "b.id")
          .on("ba.tenant_id", "=", tenantId)
          .on("ba.status", "=", "ACTIVE")
      )
      .select([
        "b.id as book_id",
        "b.title as book_title",
        "b.slug as book_slug",
        sql<number>`count(ba.id)::int`.as("access_count"),
      ])
      .where("b.tenant_id", "=", tenantId);

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(
        sql<boolean>`(lower(b.title) like ${term} or lower(b.slug) like ${term})`
      );
    }

    const rows = await query
      .groupBy(["b.id", "b.title", "b.slug"])
      .orderBy("access_count", "desc")
      .limit(limit)
      .execute();

    return rows.map((r) => ({
      book_id: r.book_id,
      book_title: r.book_title,
      book_slug: r.book_slug,
      access_count: r.access_count,
    }));
  }

  async getUserStats(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string
  ): Promise<{
    members: Array<{
      id: string;
      name: string;
      email: string | null;
      enrollments_count: number;
      book_access_count: number;
      completed_enrollments: number;
      joined_at: string;
    }>;
    total: number;
  }> {
    const offset = (page - 1) * limit;

    let membersQuery = db
      .selectFrom("tenant_members as m")
      .leftJoin("enrollments as e", (join) =>
        join
          .onRef("e.tenant_member_id", "=", "m.id")
          .on("e.tenant_id", "=", tenantId)
      )
      .leftJoin("book_access as ba", (join) =>
        join
          .onRef("ba.tenant_member_id", "=", "m.id")
          .on("ba.tenant_id", "=", tenantId)
          .on("ba.status", "=", "ACTIVE")
      )
      .select([
        "m.id",
        "m.name",
        "m.email",
        "m.joined_at",
        sql<number>`count(distinct e.id)::int`.as("enrollments_count"),
        sql<number>`count(distinct ba.id)::int`.as("book_access_count"),
        sql<number>`count(distinct case when e.status = 'COMPLETED' then e.id end)::int`.as(
          "completed_enrollments"
        ),
      ])
      .where("m.tenant_id", "=", tenantId);

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      membersQuery = membersQuery.where(
        sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term})`
      );
    }

    const members = await membersQuery
      .groupBy(["m.id", "m.name", "m.email", "m.joined_at"])
      .orderBy("m.joined_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = db
      .selectFrom("tenant_members")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("tenant_id", "=", tenantId);

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(
        sql<boolean>`(lower(name) like ${term} or lower(coalesce(email, '')) like ${term})`
      );
    }

    const countResult = await countQuery.executeTakeFirstOrThrow();

    return {
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        enrollments_count: m.enrollments_count,
        book_access_count: m.book_access_count,
        completed_enrollments: m.completed_enrollments,
        joined_at: m.joined_at
          ? new Date(m.joined_at).toISOString()
          : new Date().toISOString(),
      })),
      total: countResult.total,
    };
  }

}

export default new DashboardRepository();
