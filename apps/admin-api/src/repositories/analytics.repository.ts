import { db } from "../db/connection";
import { sql, type RawBuilder } from "kysely";
import config from "../config";
import {
  USD_TO_INR_RATE,
  makeRevenueBreakdown,
} from "../utils/currency.util";
import { pLimit } from "../utils/concurrency";
import {
  CART_LINE_AMOUNT,
  entityOrderLines,
  entityRevenueSql,
  entitySalesCountSql,
  purchasedItemLines,
  type CartEntityColumn,
  type DirectOrderType,
} from "../utils/order-lines.util";
import { decodeHtmlEntities } from "../utils/decode-html";

// Per-request DB concurrency cap. Without this, a single analytics endpoint
// firing a 20-arm Promise.all eats 20 PG pool slots and quickly exhausts RDS'
// global max_connections under burst load.
const ANALYTICS_DB_LIMIT = Number(config.ANALYTICS_DB_CONCURRENCY) || 4;

// Analytics repository for BI dashboard queries
//
// Multi-currency revenue note:
// `payment_orders.total_amount` is stored in the original payment currency.
// Every revenue aggregate must be split by `currency` (INR/USD) and combined
// into an INR-normalized "combined" value for display. Use makeRevenueBreakdown()
// to produce the standard {inr, usd, combined_inr, conversion_rate} shape.
//
// Cart attribution note:
// Per-entity revenue must cover BOTH order shapes (direct `item_id` match and
// CART lines in `cart_order_items`) or anything bought through the cart reports
// as zero. That rule lives in `utils/order-lines.util.ts`, use those builders
// rather than hand-rolling an `item_id` match. Tenant-wide totals are
// unaffected: they already sum whole orders regardless of type.

/**
 * Tenant-wide revenue + sale count for one entity type, covering direct orders
 * and cart lines. `entityFilters` are extra predicates on the entity table,
 * which is aliased `e` (e.g. sql`lower(e.title) like ${term}`).
 */
async function entityRevenueTotals(
  tenantId: string,
  orderType: DirectOrderType,
  cartColumn: CartEntityColumn,
  entityTable: "courses" | "books" | "bundles",
  entityFilters: RawBuilder<unknown>[],
): Promise<{ sum_revenue_inr: string; sum_revenue_usd: string; sum_sales: number } | undefined> {
  const extraWhere = entityFilters.length
    ? sql` where ${sql.join(entityFilters, sql` and `)}`
    : sql``;
  const result = await sql<{ sum_revenue_inr: string; sum_revenue_usd: string; sum_sales: number }>`
    select coalesce(sum(case when ol.currency = 'INR' then ol.amount else 0 end), 0) as sum_revenue_inr,
           coalesce(sum(case when ol.currency = 'USD' then ol.amount else 0 end), 0) as sum_revenue_usd,
           count(*)::int as sum_sales
      from ${entityOrderLines(tenantId, orderType, cartColumn)} ol
      join ${sql.table(entityTable)} e
        on e.id = ol.entity_id and e.tenant_id = ${tenantId}${extraWhere}
  `.execute(db);
  return result.rows[0];
}

/** Row shape returned by every date-bucketed revenue query below. */
interface DailyRevenueRow {
  date: string;
  amount_inr: string;
  amount_usd: string;
  count: number;
}

/**
 * Date-bucketed revenue for one entity type, optionally narrowed to a single
 * entity. Buckets monthly for lifetime ranges, daily otherwise.
 */
async function dailyEntityRevenue(
  tenantId: string,
  orderType: DirectOrderType,
  cartColumn: CartEntityColumn,
  sd: string,
  ed: string,
  useMonthly: boolean,
  entityId?: string,
): Promise<DailyRevenueRow[]> {
  const bucket = useMonthly ? sql`date_trunc('month', ol.paid_at)` : sql`date(ol.paid_at)`;
  const entityFilter = entityId ? sql` and ol.entity_id = ${entityId}` : sql``;
  const result = await sql<DailyRevenueRow>`
    select to_char(${bucket}, 'YYYY-MM-DD') as date,
           coalesce(sum(case when ol.currency = 'INR' then ol.amount else 0 end), 0) as amount_inr,
           coalesce(sum(case when ol.currency = 'USD' then ol.amount else 0 end), 0) as amount_usd,
           count(*)::int as count
      from ${entityOrderLines(tenantId, orderType, cartColumn)} ol
     where ol.paid_at >= ${sd}::date
       and ol.paid_at < (${ed}::date + interval '1 day')${entityFilter}
     group by ${bucket}
     order by ${bucket}
  `.execute(db);
  return result.rows;
}

/**
 * Optional learner-export filters for the Users analytics list. Every filter is
 * AND-combined and applied to the member LIST only (charts stay date-scoped).
 */
export interface UserAnalyticsFilters {
  /** Members with an enrollment in any of these courses. */
  courseIds?: string[];
  /** Members with a BUNDLE-sourced enrollment for any of these bundles. */
  bundleIds?: string[];
  /** Min/max total spend (combined INR). */
  minAmount?: number;
  maxAmount?: number;
  /** "total" = all paid orders; "selected" = only the selected courses/bundles. */
  amountScope?: "total" | "selected";
  /** Restrict the course/bundle/enrollment match to these enrollment statuses. */
  enrollmentStatus?: string[];
  /** Members who joined within this (inclusive) date range. */
  signupFrom?: string;
  signupTo?: string;
}

/**
 * Optional filters for the Payments analytics orders list (+ export). Applied to
 * the orders drill-down only, the summary/daily/by-type/failure aggregates stay
 * date-range scoped so a status filter never zeroes out the overview.
 */
export interface PaymentAnalyticsFilters {
  /** order_status values, e.g. PAID / FAILED / PAYMENT_PENDING / REFUNDED. */
  statuses?: string[];
  /** order_type values, e.g. COURSE / BOOK / BUNDLE. */
  orderTypes?: string[];
  /** Min/max order amount (in the order's own currency). */
  minAmount?: number;
  maxAmount?: number;
}

/** Sort keys accepted by the master user-progress (cohort) table. */
export type UsersProgressSortBy =
  | "name"
  | "overall_progress_pct"
  | "quiz_avg"
  | "assignment_pct"
  | "total_watch_seconds"
  | "last_active"
  | "courses_enrolled";

export interface UsersProgressOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: UsersProgressSortBy;
  sortOrder?: "asc" | "desc";
  /** Filter to only members enrolled in this course (non-cancelled). */
  courseId?: string;
}

class AnalyticsRepository {
  async getOverview(tenantId: string, startDate?: string, endDate?: string) {
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    // ONE round-trip for ~22 scalar aggregates that previously cost 22 separate
    // pool checkouts. Postgres parallelizes the subselects internally; we hold
    // a single connection. Massive reduction in RDS pressure.
    const scalarsRow = await sql<{
      total_users: number; active_users: number; new_users_in_range: number; active_period_users: number;
      total_enrollments: number; active_enrollments: number; completed_enrollments: number; enrollments_in_range: number;
      total_revenue_inr: string; total_revenue_usd: string;
      revenue_in_range_inr: string; revenue_in_range_usd: string;
      paid_orders: number; total_orders: number; orders_in_range: number;
      published_courses: number; total_courses: number;
      published_books: number; total_books: number;
      course_sales: number; book_sales: number; certificates: number;
      community_posts_in_range: number; community_comments_in_range: number;
      active_coupons: number; coupon_redemptions: number;
      quiz_attempts_in_range: number; quiz_passed_in_range: number;
      total_watch_time_seconds: number; lectures_completed: number;
      books_in_progress: number; books_completed: number;
      total_cart_items: number; total_bookmarks: number;
      total_qna_questions: number; total_qna_replies: number; total_highlights: number;
    }>`
      SELECT
        (SELECT count(*)::int FROM tenant_members WHERE tenant_id = ${tenantId})                                                                                                       AS total_users,
        (SELECT count(*)::int FROM tenant_members WHERE tenant_id = ${tenantId} AND status = 'ACTIVE')                                                                                  AS active_users,
        (SELECT count(*)::int FROM tenant_members WHERE tenant_id = ${tenantId} AND joined_at >= ${sd}::date AND joined_at < (${ed}::date + interval '1 day'))                          AS new_users_in_range,
        (SELECT count(*)::int FROM tenant_members WHERE tenant_id = ${tenantId} AND status = 'ACTIVE' AND last_login_at >= ${sd}::date)                                                  AS active_period_users,

        (SELECT count(*)::int FROM enrollments WHERE tenant_id = ${tenantId})                                                                                                          AS total_enrollments,
        (SELECT count(*)::int FROM enrollments WHERE tenant_id = ${tenantId} AND status = 'ACTIVE')                                                                                     AS active_enrollments,
        (SELECT count(*)::int FROM enrollments WHERE tenant_id = ${tenantId} AND status = 'COMPLETED')                                                                                  AS completed_enrollments,
        (SELECT count(*)::int FROM enrollments WHERE tenant_id = ${tenantId} AND enrolled_at >= ${sd}::date AND enrolled_at < (${ed}::date + interval '1 day'))                         AS enrollments_in_range,

        (SELECT coalesce(sum(case when status='PAID' AND currency='INR' then total_amount else 0 end), 0)::text FROM payment_orders WHERE tenant_id=${tenantId})      AS total_revenue_inr,
        (SELECT coalesce(sum(case when status='PAID' AND currency='USD' then total_amount else 0 end), 0)::text FROM payment_orders WHERE tenant_id=${tenantId})      AS total_revenue_usd,
        (SELECT coalesce(sum(case when status='PAID' AND currency='INR' AND paid_at >= ${sd}::date AND paid_at < (${ed}::date + interval '1 day') then total_amount else 0 end), 0)::text FROM payment_orders WHERE tenant_id=${tenantId}) AS revenue_in_range_inr,
        (SELECT coalesce(sum(case when status='PAID' AND currency='USD' AND paid_at >= ${sd}::date AND paid_at < (${ed}::date + interval '1 day') then total_amount else 0 end), 0)::text FROM payment_orders WHERE tenant_id=${tenantId}) AS revenue_in_range_usd,
        (SELECT count(*)::int FROM payment_orders WHERE tenant_id=${tenantId} AND status='PAID')                                                       AS paid_orders,
        (SELECT count(*)::int FROM payment_orders WHERE tenant_id=${tenantId})                                                                         AS total_orders,
        (SELECT count(*)::int FROM payment_orders WHERE tenant_id=${tenantId} AND status='PAID' AND paid_at >= ${sd}::date AND paid_at < (${ed}::date + interval '1 day')) AS orders_in_range,
        (SELECT count(*)::int FROM ${entityOrderLines(tenantId, "COURSE", "course_id")} ol)                                                                                             AS course_sales,
        (SELECT count(*)::int FROM ${entityOrderLines(tenantId, "BOOK", "book_id")} ol)                                                                                                 AS book_sales,

        (SELECT count(*) filter (where status='PUBLISHED')::int FROM courses WHERE tenant_id=${tenantId})                                                                               AS published_courses,
        (SELECT count(*)::int FROM courses WHERE tenant_id=${tenantId})                                                                                                                AS total_courses,
        (SELECT count(*) filter (where status='PUBLISHED')::int FROM books WHERE tenant_id=${tenantId})                                                                                 AS published_books,
        (SELECT count(*)::int FROM books WHERE tenant_id=${tenantId})                                                                                                                  AS total_books,

        (SELECT count(*)::int FROM certificates WHERE tenant_id=${tenantId})                                                                                                           AS certificates,

        0 AS community_posts_in_range,
        0 AS community_comments_in_range,

        (SELECT count(*) filter (where is_active = true)::int FROM coupons WHERE tenant_id=${tenantId})                                                                                 AS active_coupons,
        (SELECT coalesce(sum(used_count), 0)::int FROM coupons WHERE tenant_id=${tenantId})                                                                                            AS coupon_redemptions,

        (SELECT count(*)::int                            FROM quiz_attempts WHERE tenant_id=${tenantId} AND created_at >= ${sd}::date AND created_at < (${ed}::date + interval '1 day')) AS quiz_attempts_in_range,
        (SELECT count(*) filter (where status='PASSED')::int FROM quiz_attempts WHERE tenant_id=${tenantId} AND created_at >= ${sd}::date AND created_at < (${ed}::date + interval '1 day')) AS quiz_passed_in_range,

        (SELECT coalesce(sum(watched_duration), 0)::int        FROM member_lecture_progress WHERE tenant_id=${tenantId} AND last_watched_at >= ${sd}::date AND last_watched_at < (${ed}::date + interval '1 day')) AS total_watch_time_seconds,
        (SELECT count(*) filter (where completed = true)::int   FROM member_lecture_progress WHERE tenant_id=${tenantId} AND last_watched_at >= ${sd}::date AND last_watched_at < (${ed}::date + interval '1 day')) AS lectures_completed,

        (SELECT count(*) filter (where completed = false)::int  FROM member_book_progress WHERE tenant_id=${tenantId} AND updated_at >= ${sd}::date AND updated_at < (${ed}::date + interval '1 day')) AS books_in_progress,
        (SELECT count(*) filter (where completed = true)::int   FROM member_book_progress WHERE tenant_id=${tenantId} AND updated_at >= ${sd}::date AND updated_at < (${ed}::date + interval '1 day')) AS books_completed,

        (SELECT count(*)::int FROM cart_items              WHERE tenant_id=${tenantId} AND created_at >= ${sd}::date AND created_at < (${ed}::date + interval '1 day')) AS total_cart_items,
        (SELECT count(*)::int FROM member_bookmarks        WHERE tenant_id=${tenantId} AND created_at >= ${sd}::date AND created_at < (${ed}::date + interval '1 day')) AS total_bookmarks,
        0 AS total_qna_questions,
        0 AS total_qna_replies,
        (SELECT count(*)::int FROM member_book_highlights  WHERE tenant_id=${tenantId} AND created_at >= ${sd}::date AND created_at < (${ed}::date + interval '1 day')) AS total_highlights
    `.execute(db);

    const s = scalarsRow.rows[0];

    // Series & top-list queries, five total. Bound by the per-request semaphore
    // so we never check out more than ANALYTICS_DB_LIMIT pool slots at once.
    const limit = pLimit(ANALYTICS_DB_LIMIT);
    const [
      dailyUsers,
      dailyRevenue,
      enrollmentDist,
      topCourses,
      topBooks,
      revenueByType,
      monthlyGrowth,
    ] = await Promise.all([
      limit(() => db.selectFrom("tenant_members")
        .select([sql<string>`to_char(date(joined_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where(sql<boolean>`joined_at >= ${sd}::date`)
        .where(sql<boolean>`joined_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(joined_at)`)
        .orderBy(sql`date(joined_at)`)
        .execute()),

      limit(() => db.selectFrom("payment_orders")
        .select([
          sql<string>`to_char(date(paid_at), 'YYYY-MM-DD')`.as("date"),
          sql<string>`coalesce(sum(case when currency = 'INR' then total_amount else 0 end), 0)`.as("amount_inr"),
          sql<string>`coalesce(sum(case when currency = 'USD' then total_amount else 0 end), 0)`.as("amount_usd"),
          sql<number>`count(*)::int`.as("count"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("status", "=", "PAID")
        .where(sql<boolean>`paid_at >= ${sd}::date`)
        .where(sql<boolean>`paid_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(paid_at)`)
        .orderBy(sql`date(paid_at)`)
        .execute()),

      limit(() => db.selectFrom("enrollments")
        .select(["status", sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .groupBy("status")
        .execute()),

      limit(() => db.selectFrom("courses as c")
        .leftJoin("enrollments as e", (join) => join.onRef("e.course_id", "=", "c.id").on("e.tenant_id", "=", tenantId))
        .select(["c.title", sql<number>`count(distinct e.id)::int`.as("enrollment_count")])
        .where("c.tenant_id", "=", tenantId)
        .where("c.status", "=", "PUBLISHED")
        .groupBy(["c.id", "c.title"])
        .orderBy("enrollment_count", "desc")
        .limit(5)
        .execute()),

      limit(() => db.selectFrom("books as b")
        .leftJoin("book_access as ba", (join) => join.onRef("ba.book_id", "=", "b.id").on("ba.tenant_id", "=", tenantId))
        .select(["b.title", sql<number>`count(distinct ba.id)::int`.as("access_count")])
        .where("b.tenant_id", "=", tenantId)
        .where("b.status", "=", "PUBLISHED")
        .groupBy(["b.id", "b.title"])
        .orderBy("access_count", "desc")
        .limit(5)
        .execute()),

      limit(() => db.selectFrom("payment_orders")
        .select([
          "order_type",
          sql<number>`count(*) filter (where status = 'PAID')::int`.as("count"),
          sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'INR' then total_amount else 0 end), 0)`.as("revenue_inr"),
          sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'USD' then total_amount else 0 end), 0)`.as("revenue_usd"),
        ])
        .where("tenant_id", "=", tenantId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy("order_type")
        .execute()),

      limit(() => db.selectFrom("tenant_members")
        .select([sql<string>`to_char(joined_at, 'YYYY-MM')`.as("month"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where(sql<boolean>`joined_at >= now() - interval '12 months'`)
        .groupBy(sql`to_char(joined_at, 'YYYY-MM')`)
        .orderBy(sql`to_char(joined_at, 'YYYY-MM')`)
        .execute()),
    ]);

    const enrollmentToCompletion = s.total_enrollments > 0 ? Math.round((s.completed_enrollments / s.total_enrollments) * 100) : 0;
    const signupToEnrollment = s.total_users > 0 ? Math.round((s.total_enrollments / s.total_users) * 100) : 0;

    return {
      total_users: s.total_users,
      active_users: s.active_users,
      new_users_in_range: s.new_users_in_range,
      total_enrollments: s.total_enrollments,
      active_enrollments: s.active_enrollments,
      completed_enrollments: s.completed_enrollments,
      enrollments_in_range: s.enrollments_in_range,
      total_revenue: makeRevenueBreakdown(
        parseFloat(String(s.total_revenue_inr)),
        parseFloat(String(s.total_revenue_usd)),
      ),
      revenue_in_range: makeRevenueBreakdown(
        parseFloat(String(s.revenue_in_range_inr)),
        parseFloat(String(s.revenue_in_range_usd)),
      ),
      paid_orders: s.paid_orders,
      total_orders: s.total_orders,
      orders_in_range: s.orders_in_range,
      conversion_rate: USD_TO_INR_RATE,
      published_courses: s.published_courses,
      total_courses: s.total_courses,
      published_books: s.published_books,
      total_books: s.total_books,
      course_sales: s.course_sales,
      book_sales: s.book_sales,
      certificates: s.certificates,
      active_period_users: s.active_period_users,
      daily_new_users: dailyUsers.map(r => ({ date: String(r.date), count: r.count })),
      daily_revenue: dailyRevenue.map(r => ({
        date: String(r.date),
        amount: makeRevenueBreakdown(
          parseFloat(String(r.amount_inr)),
          parseFloat(String(r.amount_usd)),
        ),
        count: r.count,
      })),
      enrollment_distribution: enrollmentDist.map(r => ({ status: r.status, count: r.count })),
      top_courses: topCourses.map(r => ({ title: r.title, enrollment_count: r.enrollment_count })),
      top_books: topBooks.map(r => ({ title: r.title, access_count: r.access_count })),
      revenue_by_type: revenueByType.map(r => ({
        type: r.order_type,
        count: r.count,
        revenue: makeRevenueBreakdown(
          parseFloat(String(r.revenue_inr)),
          parseFloat(String(r.revenue_usd)),
        ),
      })),
      monthly_growth: monthlyGrowth.map(r => ({ month: String(r.month), count: r.count })),
      community_posts_in_range: s.community_posts_in_range,
      community_comments_in_range: s.community_comments_in_range,
      active_coupons: s.active_coupons,
      coupon_redemptions: s.coupon_redemptions,
      quiz_attempts_in_range: s.quiz_attempts_in_range,
      quiz_pass_rate: s.quiz_attempts_in_range > 0 ? Math.round((s.quiz_passed_in_range / s.quiz_attempts_in_range) * 100) : 0,
      signup_to_enrollment_rate: signupToEnrollment,
      enrollment_to_completion_rate: enrollmentToCompletion,
      total_watch_time_seconds: s.total_watch_time_seconds,
      lectures_completed: s.lectures_completed,
      books_in_progress: s.books_in_progress,
      books_completed: s.books_completed,
      total_cart_items: s.total_cart_items,
      total_bookmarks: s.total_bookmarks,
      total_qna_questions: s.total_qna_questions,
      total_qna_replies: s.total_qna_replies,
      total_highlights: s.total_highlights,
    };
  }

  async getRecentSignups(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 10, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    let query = db.selectFrom("tenant_members as m")
      .leftJoin("enrollments as e", (join) => join.onRef("e.tenant_member_id", "=", "m.id").on("e.tenant_id", "=", tenantId))
      .select([
        "m.id", "m.name", "m.email", "m.status", "m.joined_at",
        sql<number>`count(distinct e.id)::int`.as("enrollments_count"),
        sql<string>`coalesce((select sum(po.total_amount) from payment_orders po where po.tenant_member_id = m.id and po.tenant_id = ${tenantId} and po.status = 'PAID' and po.currency = 'INR'), 0)`.as("spent_inr"),
        sql<string>`coalesce((select sum(po.total_amount) from payment_orders po where po.tenant_member_id = m.id and po.tenant_id = ${tenantId} and po.status = 'PAID' and po.currency = 'USD'), 0)`.as("spent_usd"),
      ])
      .where("m.tenant_id", "=", tenantId)
      .where(sql<boolean>`m.joined_at >= ${sd}::date`)
      .where(sql<boolean>`m.joined_at < (${ed}::date + interval '1 day')`);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term})`);
    }

    const rows = await query
      .groupBy(["m.id", "m.name", "m.email", "m.status", "m.joined_at"])
      .orderBy("m.joined_at", "desc")
      .limit(limit).offset(offset)
      .execute();

    let countQuery = db.selectFrom("tenant_members")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("tenant_id", "=", tenantId)
      .where(sql<boolean>`joined_at >= ${sd}::date`)
      .where(sql<boolean>`joined_at < (${ed}::date + interval '1 day')`);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`(lower(name) like ${term} or lower(coalesce(email, '')) like ${term})`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    return {
      members: rows.map(({ spent_inr, spent_usd, ...rest }) => ({
        ...rest,
        total_spent: makeRevenueBreakdown(
          parseFloat(String(spent_inr)),
          parseFloat(String(spent_usd)),
        ),
        joined_at: rest.joined_at ? new Date(rest.joined_at).toISOString() : null,
      })),
      total,
    };
  }

  async getRecentOrders(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 10, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    let query = db.selectFrom("payment_orders as o")
      .innerJoin("tenant_members as m", "m.id", "o.tenant_member_id")
      .select([
        "o.id", "o.order_number", "m.name as member_name", "m.email as member_email",
        "o.total_amount", "o.currency", "o.status", "o.order_type", "o.paid_at", "o.created_at",
      ])
      .where("o.tenant_id", "=", tenantId)
      .where(sql<boolean>`o.created_at >= ${sd}::date`)
      .where(sql<boolean>`o.created_at < (${ed}::date + interval '1 day')`);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(o.order_number) like ${term})`);
    }

    const rows = await query.orderBy("o.created_at", "desc").limit(limit).offset(offset).execute();

    let countQuery = db.selectFrom("payment_orders as o")
      .innerJoin("tenant_members as m", "m.id", "o.tenant_member_id")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("o.tenant_id", "=", tenantId)
      .where(sql<boolean>`o.created_at >= ${sd}::date`)
      .where(sql<boolean>`o.created_at < (${ed}::date + interval '1 day')`);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(o.order_number) like ${term})`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    return {
      orders: rows.map(r => ({
        ...r,
        total_amount: String(r.total_amount),
        paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
        created_at: new Date(r.created_at).toISOString(),
      })),
      total,
    };
  }

  /**
   * Feed of successful (PAID) purchases, one row per purchased ITEM rather than
   * per order, a 3-item cart yields 3 rows so each can name and link the thing
   * actually bought. Amounts for cart rows are that line's apportioned share of
   * the order total, so the rows still sum back to the order.
   *
   * Titles and member names are decoded here: the xss-sanitizer stores `&` as
   * `&amp;`, and these strings render as plain text in the dashboard table.
   */
  async getRecentSuccessfulPayments(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 10, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    // One LEFT JOIN per entity type resolves the item's display title in a
    // single pass. Each join is tenant-scoped as well as id-matched: the union
    // is already tenant-filtered, but a cross-tenant id collision must never be
    // able to leak another tenant's title.
    const term = search?.trim() ? `%${search.trim().toLowerCase()}%` : null;
    const source = sql`
        from ${purchasedItemLines(tenantId)} l
        join tenant_members m on m.id = l.tenant_member_id and m.tenant_id = ${tenantId}
        left join courses c      on c.id  = l.item_id and c.tenant_id  = ${tenantId} and l.item_type = 'COURSE'
        left join books b        on b.id  = l.item_id and b.tenant_id  = ${tenantId} and l.item_type = 'BOOK'
        left join bundles bu     on bu.id = l.item_id and bu.tenant_id = ${tenantId} and l.item_type = 'BUNDLE'
        left join batches ba     on ba.id = l.item_id and ba.tenant_id = ${tenantId} and l.item_type = 'BATCH'
        left join test_series ts on ts.id = l.item_id and ts.tenant_id = ${tenantId} and l.item_type = 'TEST_SERIES'
       where l.paid_at >= ${sd}::date
         and l.paid_at < (${ed}::date + interval '1 day')
         ${
           term
             ? sql`and (
                 lower(m.name) like ${term}
                 or lower(coalesce(m.email, '')) like ${term}
                 or lower(l.order_number) like ${term}
                 or lower(coalesce(c.title, b.title, bu.title, ba.title, ts.title, '')) like ${term}
               )`
             : sql``
         }`;

    const [rows, countRow] = await Promise.all([
      sql<{
        order_id: string;
        order_number: string;
        item_type: string;
        item_id: string | null;
        amount: string;
        currency: string;
        paid_at: Date | null;
        member_id: string;
        member_name: string | null;
        member_email: string | null;
        item_name: string | null;
      }>`
        select l.order_id, l.order_number, l.item_type, l.item_id, l.amount,
               l.currency, l.paid_at,
               m.id as member_id, m.name as member_name, m.email as member_email,
               coalesce(c.title, b.title, bu.title, ba.title, ts.title) as item_name
        ${source}
        order by l.paid_at desc
        limit ${limit} offset ${offset}
      `.execute(db),
      sql<{ total: number }>`select count(*)::int as total ${source}`.execute(db),
    ]);

    return {
      payments: rows.rows.map((r) => ({
        order_id: r.order_id,
        order_number: r.order_number,
        member_id: r.member_id,
        member_name: decodeHtmlEntities(r.member_name ?? ""),
        member_email: r.member_email,
        item_id: r.item_id,
        item_name: r.item_name ? decodeHtmlEntities(r.item_name) : null,
        item_type: r.item_type,
        hub_product_type: null,
        amount: String(r.amount),
        currency: r.currency,
        paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
      })),
      total: countRow.rows[0]?.total ?? 0,
      page,
      limit,
    };
  }

  async getUsersAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 50, search?: string, filters?: UserAnalyticsFilters) {
    const offset = (page - 1) * limit;

    // The Users tab lists every member of the tenant. The startDate/endDate
    // filter applies to *analytics* (daily_signups chart, sumEnrollments etc.)
    //: NOT to the user list itself. Previously the filter was applied to the
    // list too, which made the dashboard show "1 user" when the only joinee in
    // the last 30 days was a single person. Users expect to be able to browse
    // the full member roster and have charts re-scope to the period.
    let query = db.selectFrom("tenant_members as m")
      .leftJoin("enrollments as e", join => join.onRef("e.tenant_member_id", "=", "m.id").on("e.tenant_id", "=", tenantId))
      .leftJoin("book_access as ba", join => join.onRef("ba.tenant_member_id", "=", "m.id").on("ba.tenant_id", "=", tenantId))
      .leftJoin("certificates as cert", join => join.onRef("cert.tenant_member_id", "=", "m.id").on("cert.tenant_id", "=", tenantId))
      .select([
        "m.id", "m.name", "m.email", "m.phone", "m.status", "m.joined_at", "m.last_login_at",
        sql<number>`count(distinct e.id)::int`.as("enrollments_count"),
        sql<number>`count(distinct ba.id)::int`.as("book_access_count"),
        sql<number>`count(distinct case when e.status = 'COMPLETED' then e.id end)::int`.as("completed_enrollments"),
        sql<string>`coalesce((select sum(po.total_amount) from payment_orders po where po.tenant_member_id = m.id and po.tenant_id = ${tenantId} and po.status = 'PAID' and po.currency = 'INR'), 0)`.as("spent_inr"),
        sql<string>`coalesce((select sum(po.total_amount) from payment_orders po where po.tenant_member_id = m.id and po.tenant_id = ${tenantId} and po.status = 'PAID' and po.currency = 'USD'), 0)`.as("spent_usd"),
        sql<number>`count(distinct cert.id)::int`.as("certificates_count"),
        // Total in the same query via window function, saves a round-trip.
        sql<number>`count(*) over ()::int`.as("total_count"),
      ])
      .where("m.tenant_id", "=", tenantId);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term})`);
    }

    // ── Learner-export filters (applied to the member LIST only; charts below
    //    stay date-scoped). All AND-combined; the window total_count reflects
    //    the filtered set so pagination + "export all" stay correct. ──────────
    if (filters) {
      const { courseIds, bundleIds, minAmount, maxAmount, enrollmentStatus, signupFrom, signupTo } = filters;
      const amountScope = filters.amountScope ?? "total";
      const idList = (ids: string[]) => sql.join(ids.map((id) => sql`${id}`));
      const statusClause =
        enrollmentStatus && enrollmentStatus.length > 0
          ? sql` and e2.status in (${idList(enrollmentStatus)})`
          : sql``;

      if (courseIds && courseIds.length > 0) {
        query = query.where(sql<boolean>`exists (select 1 from enrollments e2 where e2.tenant_member_id = m.id and e2.tenant_id = ${tenantId} and e2.course_id in (${idList(courseIds)})${statusClause})`);
      }
      if (bundleIds && bundleIds.length > 0) {
        query = query.where(sql<boolean>`exists (select 1 from enrollments e2 where e2.tenant_member_id = m.id and e2.tenant_id = ${tenantId} and e2.source = 'BUNDLE' and e2.source_bundle_id in (${idList(bundleIds)})${statusClause})`);
      }
      // Status on its own (no course/bundle picked) → members with any enrollment
      // in that status.
      if (
        enrollmentStatus && enrollmentStatus.length > 0 &&
        !(courseIds && courseIds.length) &&
        !(bundleIds && bundleIds.length)
      ) {
        query = query.where(sql<boolean>`exists (select 1 from enrollments e2 where e2.tenant_member_id = m.id and e2.tenant_id = ${tenantId} and e2.status in (${idList(enrollmentStatus)}))`);
      }

      if (signupFrom) {
        query = query.where(sql<boolean>`m.joined_at >= ${signupFrom}::date`);
      }
      if (signupTo) {
        query = query.where(sql<boolean>`m.joined_at < (${signupTo}::date + interval '1 day')`);
      }

      if (minAmount != null || maxAmount != null) {
        // Per-member spend (combined INR). "selected" scopes it to orders for the
        // chosen courses/bundles; otherwise it's total non-wallet spend.
        const useSelected =
          amountScope === "selected" &&
          ((courseIds && courseIds.length) || (bundleIds && bundleIds.length));

        // Total spend stays an ORDER-level sum: the CART order itself is already
        // counted by `order_type != 'WALLET_TOPUP'`, so adding its lines would
        // double. "Selected" spend is the opposite, it attributes to specific
        // courses/bundles, so it must also pick up cart lines or a learner who
        // bought the selected course through the cart looks like they spent 0.
        const selectedLines: RawBuilder<unknown>[] = [];
        if (useSelected) {
          if (courseIds && courseIds.length) {
            selectedLines.push(
              sql`select po.currency, po.total_amount as amount from payment_orders po
                   where po.tenant_member_id = m.id and po.tenant_id = ${tenantId}
                     and po.status = 'PAID' and po.order_type = 'COURSE'
                     and po.item_id in (${idList(courseIds)})`,
              sql`select po.currency, ${CART_LINE_AMOUNT} as amount
                    from cart_order_items coi join payment_orders po on po.id = coi.order_id
                   where po.tenant_member_id = m.id and coi.tenant_id = ${tenantId}
                     and po.status = 'PAID' and coi.course_id in (${idList(courseIds)})`,
            );
          }
          if (bundleIds && bundleIds.length) {
            selectedLines.push(
              sql`select po.currency, po.total_amount as amount from payment_orders po
                   where po.tenant_member_id = m.id and po.tenant_id = ${tenantId}
                     and po.status = 'PAID' and po.order_type = 'BUNDLE'
                     and po.item_id in (${idList(bundleIds)})`,
              sql`select po.currency, ${CART_LINE_AMOUNT} as amount
                    from cart_order_items coi join payment_orders po on po.id = coi.order_id
                   where po.tenant_member_id = m.id and coi.tenant_id = ${tenantId}
                     and po.status = 'PAID' and coi.bundle_id in (${idList(bundleIds)})`,
            );
          }
        }

        const spend = selectedLines.length
          ? sql<number>`(select coalesce(sum(case when sl.currency = 'USD' then sl.amount * ${USD_TO_INR_RATE} else sl.amount end), 0) from (${sql.join(selectedLines, sql` union all `)}) sl)`
          : sql<number>`(coalesce((select sum(po.total_amount) from payment_orders po where po.tenant_member_id = m.id and po.tenant_id = ${tenantId} and po.status = 'PAID' and po.currency = 'INR'), 0) + coalesce((select sum(po.total_amount) from payment_orders po where po.tenant_member_id = m.id and po.tenant_id = ${tenantId} and po.status = 'PAID' and po.currency = 'USD'), 0) * ${USD_TO_INR_RATE})`;
        if (minAmount != null) {
          query = query.where(sql<boolean>`${spend} >= ${minAmount}`);
        }
        if (maxAmount != null) {
          query = query.where(sql<boolean>`${spend} <= ${maxAmount}`);
        }
      }
    }

    const members = await query
      .groupBy(["m.id", "m.name", "m.email", "m.phone", "m.status", "m.joined_at", "m.last_login_at"])
      .orderBy("m.joined_at", "desc")
      .limit(limit).offset(offset)
      .execute();

    const total = members[0]?.total_count ?? 0;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";
    const useMonthly = this.isLifetimeRange(sd, ed);
    const searchTerm = search?.trim() ? `%${search.trim().toLowerCase()}%` : null;

    // Daily signups + activity rollups are date-scoped (the whole point of
    // the period filter). sumX queries filter by activity date (enrolled_at,
    // ba.created_at, cert.issued_at) so "Avg Enrollments" reads as
    // "enrollments per user during this period", meaningful KPI.
    const reqLimit = pLimit(ANALYTICS_DB_LIMIT);
    const [dailySignups, statusDistribution, sumEnrollments, sumBooks, sumCertificates] = await Promise.all([
      reqLimit(() => useMonthly
        ? db.selectFrom("tenant_members")
            .select([sql<string>`to_char(date_trunc('month', joined_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
            .where("tenant_id", "=", tenantId)
            .where(sql<boolean>`joined_at >= ${sd}::date`)
            .where(sql<boolean>`joined_at < (${ed}::date + interval '1 day')`)
            .groupBy(sql`date_trunc('month', joined_at)`)
            .orderBy(sql`date_trunc('month', joined_at)`)
            .execute()
        : db.selectFrom("tenant_members")
            .select([sql<string>`to_char(date(joined_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
            .where("tenant_id", "=", tenantId)
            .where(sql<boolean>`joined_at >= ${sd}::date`)
            .where(sql<boolean>`joined_at < (${ed}::date + interval '1 day')`)
            .groupBy(sql`date(joined_at)`)
            .orderBy(sql`date(joined_at)`)
            .execute()),
      reqLimit(() => db.selectFrom("tenant_members")
        .select(["status", sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .$if(!!searchTerm, (q) => q.where(sql<boolean>`(lower(name) like ${searchTerm} or lower(coalesce(email, '')) like ${searchTerm})`))
        .groupBy("status")
        .execute()),
      reqLimit(() => db.selectFrom("enrollments")
        .where("tenant_id", "=", tenantId)
        .$if(!!startDate, (q) => q.where(sql<boolean>`enrolled_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`enrolled_at < (${endDate}::date + interval '1 day')`))
        .select(sql<number>`coalesce(count(*), 0)::int`.as("sum"))
        .executeTakeFirstOrThrow()),
      reqLimit(() => db.selectFrom("book_access")
        .where("tenant_id", "=", tenantId)
        .$if(!!startDate, (q) => q.where(sql<boolean>`created_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`created_at < (${endDate}::date + interval '1 day')`))
        .select(sql<number>`coalesce(count(*), 0)::int`.as("sum"))
        .executeTakeFirstOrThrow()),
      reqLimit(() => db.selectFrom("certificates")
        .where("tenant_id", "=", tenantId)
        .$if(!!startDate, (q) => q.where(sql<boolean>`issued_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`issued_at < (${endDate}::date + interval '1 day')`))
        .select(sql<number>`coalesce(count(*), 0)::int`.as("sum"))
        .executeTakeFirstOrThrow()),
    ]);

    return {
      // Strip `total_count` (window-function helper, not for the client) and
      // `spent_inr`/`spent_usd` (folded into `total_spent` breakdown).
      members: members.map(({ spent_inr, spent_usd, total_count: _tc, ...rest }) => ({
        ...rest,
        total_spent: makeRevenueBreakdown(
          parseFloat(String(spent_inr)),
          parseFloat(String(spent_usd)),
        ),
        joined_at: rest.joined_at ? new Date(rest.joined_at).toISOString() : null,
        last_login_at: rest.last_login_at ? new Date(rest.last_login_at).toISOString() : null,
      })),
      total,
      daily_signups: dailySignups.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      status_distribution: statusDistribution.map(r => ({ status: String(r.status), count: r.count })),
      sum_enrollments: sumEnrollments.sum,
      sum_books: sumBooks.sum,
      sum_certificates: sumCertificates.sum,
    };
  }

  async getUserDetailAnalytics(tenantId: string, memberId: string, startDate?: string, endDate?: string) {
    const member = await db.selectFrom("tenant_members")
      .select(["id", "name", "email", "phone", "status", "joined_at", "last_login_at"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", memberId)
      .executeTakeFirst();

    if (!member) return null;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    // Single-row scalar rollup: enrollments/book_access/certificates/spend/cart/bookmark
    // counts all in one round-trip. Replaces 7 of the 10 prior parallel queries.
    const summaryRow = await sql<{
      enrollments_count: number; book_access_count: number; completed_enrollments: number;
      spent_inr: string; spent_usd: string; certificates_count: number;
      cart_count: number; bookmark_count: number;
    }>`
      SELECT
        (SELECT count(*)::int FROM enrollments      WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId})                                AS enrollments_count,
        (SELECT count(*)::int FROM book_access      WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId})                                AS book_access_count,
        (SELECT count(*)::int FROM enrollments      WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId} AND status = 'COMPLETED')        AS completed_enrollments,
        (SELECT coalesce(sum(total_amount), 0)::text FROM payment_orders WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId} AND status = 'PAID' AND currency = 'INR') AS spent_inr,
        (SELECT coalesce(sum(total_amount), 0)::text FROM payment_orders WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId} AND status = 'PAID' AND currency = 'USD') AS spent_usd,
        (SELECT count(*)::int FROM certificates     WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId})                                AS certificates_count,
        (SELECT count(*)::int FROM cart_items       WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId})                                AS cart_count,
        (SELECT count(*)::int FROM member_bookmarks WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId})                                AS bookmark_count
    `.execute(db);
    const summary = summaryRow.rows[0];

    const limit = pLimit(ANALYTICS_DB_LIMIT);
    const [
      enrollments,
      bookAccess,
      orders,
      certificates,
      dailyEnrollments,
      dailyOrders,
      assignmentRows,
    ] = await Promise.all([
      limit(() => db.selectFrom("enrollments as e")
        .innerJoin("courses as c", "c.id", "e.course_id")
        .select(["e.id", "e.course_id", "c.title as course_title", "e.status", "e.enrolled_at"])
        .where("e.tenant_id", "=", tenantId)
        .where("e.tenant_member_id", "=", memberId)
        .$if(!!startDate, (q) => q.where(sql<boolean>`e.enrolled_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`e.enrolled_at < (${endDate}::date + interval '1 day')`))
        .orderBy("e.enrolled_at", "desc")
        .limit(50)
        .execute()),

      limit(() => db.selectFrom("book_access as ba")
        .innerJoin("books as b", "b.id", "ba.book_id")
        .select(["ba.id", "ba.book_id", "b.title as book_title", "ba.status", "ba.created_at"])
        .where("ba.tenant_id", "=", tenantId)
        .where("ba.tenant_member_id", "=", memberId)
        .$if(!!startDate, (q) => q.where(sql<boolean>`ba.created_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`ba.created_at < (${endDate}::date + interval '1 day')`))
        .orderBy("ba.created_at", "desc")
        .limit(50)
        .execute()),

      limit(() => db.selectFrom("payment_orders")
        .select(["id", "order_number", "total_amount", "currency", "status", "order_type", "created_at"])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .orderBy("created_at", "desc")
        .limit(50)
        .execute()),

      limit(() => db.selectFrom("certificates as cert")
        .innerJoin("courses as c", "c.id", "cert.course_id")
        .select(["cert.id", "c.title as course_title", "cert.status", "cert.issued_at"])
        .where("cert.tenant_id", "=", tenantId)
        .where("cert.tenant_member_id", "=", memberId)
        .$if(!!startDate, (q) => q.where(sql<boolean>`cert.issued_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`cert.issued_at < (${endDate}::date + interval '1 day')`))
        .orderBy("cert.issued_at", "desc")
        .limit(50)
        .execute()),

      limit(() => db.selectFrom("enrollments")
        .select([sql<string>`to_char(date(enrolled_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where(sql<boolean>`enrolled_at >= ${sd}::date`)
        .where(sql<boolean>`enrolled_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(enrolled_at)`)
        .orderBy(sql`date(enrolled_at)`)
        .execute()),

      limit(() => db.selectFrom("payment_orders")
        .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(created_at)`)
        .orderBy(sql`date(created_at)`)
        .execute()),

      limit(() => db.selectFrom("assignments as a")
        .innerJoin("enrollments as e", (join) =>
          join
            .onRef("e.course_id", "=", "a.course_id")
            .on("e.tenant_id", "=", tenantId)
            .on("e.tenant_member_id", "=", memberId)
            .on("e.status", "=", "ACTIVE")
        )
        .leftJoin("assignment_submissions as sub", (join) =>
          join
            .onRef("sub.assignment_id", "=", "a.id")
            .on("sub.tenant_member_id", "=", memberId)
            .on("sub.tenant_id", "=", tenantId)
        )
        .leftJoin("assignment_evaluations as ev", "ev.submission_id", "sub.id")
        .leftJoin("member_assignment_progress as map", (join) =>
          join
            .onRef("map.assignment_id", "=", "a.id")
            .on("map.tenant_member_id", "=", memberId)
            .on("map.tenant_id", "=", tenantId)
        )
        .select([
          "a.id as assignment_id",
          "a.title",
          "a.scope",
          "a.max_score",
          "a.due_date",
          "a.course_id",
          sql<boolean>`(sub.id is not null)`.as("submitted"),
          "sub.status as submission_status",
          "sub.submitted_at",
          "ev.score",
          "ev.max_score as eval_max_score",
          "ev.feedback",
          sql<boolean>`coalesce(map.completed, false)`.as("completed"),
        ])
        .where("a.tenant_id", "=", tenantId)
        .where("a.status", "=", "PUBLISHED")
        .$if(!!startDate, (q) => q.where(sql<boolean>`a.created_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`a.created_at < (${endDate}::date + interval '1 day')`))
        .orderBy("a.sort_order", "asc")
        .orderBy("a.created_at", "asc")
        .execute()),
    ]);

    const totalAssignments = assignmentRows.length;
    const submittedAssignments = assignmentRows.filter((r) => r.submitted).length;
    const evaluatedAssignments = assignmentRows.filter(
      (r) => r.submitted && r.score != null
    ).length;
    const completedAssignments = assignmentRows.filter((r) => r.completed).length;
    const scoreRows = assignmentRows.filter(
      (r) => r.submitted && r.score != null && r.eval_max_score != null
    );
    const totalScoreEarned = scoreRows.reduce((sum, r) => sum + Number(r.score), 0);
    const totalMaxScore = scoreRows.reduce(
      (sum, r) => sum + Number(r.eval_max_score),
      0
    );
    const averageScore =
      scoreRows.length > 0 ? totalScoreEarned / scoreRows.length : 0;

    const assignmentAnalytics = {
      total_assignments: totalAssignments,
      submitted_assignments: submittedAssignments,
      evaluated_assignments: evaluatedAssignments,
      completed_assignments: completedAssignments,
      average_score: Math.round(averageScore * 100) / 100,
      total_score_earned: totalScoreEarned,
      total_max_score: totalMaxScore,
      assignments: assignmentRows.map((r) => ({
        assignment_id: r.assignment_id,
        title: r.title,
        scope: r.scope,
        max_score: r.max_score,
        due_date: r.due_date ? new Date(r.due_date).toISOString() : null,
        submitted: r.submitted,
        submission_status: r.submission_status,
        score: r.score != null ? Number(r.score) : null,
        score_percentage:
          r.score != null && r.eval_max_score != null && r.eval_max_score > 0
            ? Math.round((Number(r.score) / Number(r.eval_max_score)) * 100)
            : null,
        feedback: r.feedback,
        completed: r.completed,
        submitted_at: r.submitted_at
          ? new Date(r.submitted_at).toISOString()
          : null,
      })),
    };

    return {
      profile: {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        joined_at: member.joined_at ? new Date(member.joined_at).toISOString() : null,
        last_login_at: member.last_login_at ? new Date(member.last_login_at).toISOString() : null,
      },
      summary: {
        enrollments_count: summary.enrollments_count,
        book_access_count: summary.book_access_count,
        completed_enrollments: summary.completed_enrollments,
        total_spent: makeRevenueBreakdown(
          parseFloat(String(summary.spent_inr)),
          parseFloat(String(summary.spent_usd)),
        ),
        certificates_count: summary.certificates_count,
        cart_count: summary.cart_count,
        bookmark_count: summary.bookmark_count,
      },
      enrollments: enrollments.map(e => ({
        id: e.id,
        course_id: e.course_id,
        course_title: e.course_title,
        status: e.status,
        enrolled_at: e.enrolled_at ? new Date(e.enrolled_at).toISOString() : null,
      })),
      book_access: bookAccess.map(ba => ({
        id: ba.id,
        book_id: ba.book_id,
        book_title: ba.book_title,
        status: ba.status,
        created_at: ba.created_at ? new Date(ba.created_at).toISOString() : null,
      })),
      orders: orders.map(o => ({
        id: o.id,
        order_number: o.order_number,
        total_amount: String(o.total_amount),
        currency: o.currency,
        status: o.status,
        order_type: o.order_type,
        created_at: new Date(o.created_at).toISOString(),
      })),
      certificates: certificates.map(c => ({
        id: c.id,
        course_title: c.course_title,
        status: c.status,
        issued_at: c.issued_at ? new Date(c.issued_at).toISOString() : null,
      })),
      daily_enrollments: dailyEnrollments.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      daily_orders: dailyOrders.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      assignment_analytics: assignmentAnalytics,
    };
  }

  private isLifetimeRange(startDate: string, endDate: string): boolean {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return days > 365;
  }

  async getCoursesAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;

    // Revenue is split by currency via per-course subselects to avoid
    // cartesian-product inflation from the multi-join SUMs and to preserve
    // the original charge currency for each order. Each subselect covers both
    // direct COURSE orders and CART lines, see the cart attribution note above.
    const courseId = sql.ref<string>("c.id");
    let query = db.selectFrom("courses as c")
      .leftJoin("enrollments as e", join => join.onRef("e.course_id", "=", "c.id").on("e.tenant_id", "=", tenantId))
      .leftJoin("course_reviews as cr", join => join.onRef("cr.course_id", "=", "c.id").on("cr.tenant_id", "=", tenantId))
      .select([
        "c.id", "c.title", "c.slug", "c.status", "c.mode", "c.purchase_mode",
        "c.price_inr", "c.price_usd", "c.created_at",
        sql<number>`count(distinct e.id)::int`.as("enrollment_count"),
        sql<number>`count(distinct case when e.status = 'COMPLETED' then e.id end)::int`.as("completed_count"),
        sql<number>`count(distinct case when e.status = 'ACTIVE' then e.id end)::int`.as("active_count"),
        sql<string>`coalesce(avg(cr.rating), 0)`.as("avg_rating"),
        sql<number>`count(distinct cr.id)::int`.as("review_count"),
        entityRevenueSql(tenantId, "COURSE", "course_id", courseId, "INR").as("revenue_inr"),
        entityRevenueSql(tenantId, "COURSE", "course_id", courseId, "USD").as("revenue_usd"),
        entitySalesCountSql(tenantId, "COURSE", "course_id", courseId).as("sales_count"),
      ])
      .where("c.tenant_id", "=", tenantId);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`lower(c.title) like ${term}`);
    }

    const rows = await query
      .groupBy(["c.id", "c.title", "c.slug", "c.status", "c.mode", "c.purchase_mode", "c.price_inr", "c.price_usd", "c.created_at"])
      .orderBy("enrollment_count", "desc")
      .limit(limit).offset(offset)
      .execute();

    let countQuery = db.selectFrom("courses").select(sql<number>`count(*)::int`.as("total")).where("tenant_id", "=", tenantId);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`lower(title) like ${term}`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";
    const useMonthly = this.isLifetimeRange(sd, ed);
    const dailyEnrollments = useMonthly
      ? await db.selectFrom("enrollments")
          .select([sql<string>`to_char(date_trunc('month', enrolled_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`enrolled_at >= ${sd}::date`)
          .where(sql<boolean>`enrolled_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date_trunc('month', enrolled_at)`)
          .orderBy(sql`date_trunc('month', enrolled_at)`)
          .execute()
      : await db.selectFrom("enrollments")
          .select([sql<string>`to_char(date(enrolled_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`enrolled_at >= ${sd}::date`)
          .where(sql<boolean>`enrolled_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date(enrolled_at)`)
          .orderBy(sql`date(enrolled_at)`)
          .execute();

    return {
      items: rows.map(r => ({
        id: r.id, title: r.title, slug: r.slug, status: r.status, mode: r.mode,
        purchase_mode: r.purchase_mode,
        price_inr: r.price_inr ? parseFloat(String(r.price_inr)) : null,
        price_usd: r.price_usd ? parseFloat(String(r.price_usd)) : null,
        enrollment_count: r.enrollment_count, completed_count: r.completed_count,
        active_count: r.active_count,
        completion_rate: r.enrollment_count > 0 ? Math.round((r.completed_count / r.enrollment_count) * 100) : 0,
        avg_rating: parseFloat(parseFloat(String(r.avg_rating)).toFixed(1)),
        review_count: r.review_count,
        revenue: makeRevenueBreakdown(
          parseFloat(String(r.revenue_inr)),
          parseFloat(String(r.revenue_usd)),
        ),
        sales_count: r.sales_count,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
      total,
      daily_enrollments: dailyEnrollments.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getCourseDetailAnalytics(tenantId: string, courseId: string, startDate?: string, endDate?: string) {
    const course = await db.selectFrom("courses")
      .select(["id", "title", "slug", "status", "mode", "purchase_mode", "price_inr", "price_usd"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!course) return null;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    // Fold bookmark + cart total counts into the summary rollup so we go from
    // 9 queries (7 parallel + 2 sequential) down to 7, bounded by the semaphore.
    const reqLimit = pLimit(ANALYTICS_DB_LIMIT);
    const [
      summary,
      dailyEnrollments,
      dailyRevenue,
      dailyBookmarks,
      dailyCartAdds,
      dailyCompletions,
      enrollmentStatusDist,
    ] = await Promise.all([
      reqLimit(() => db.selectFrom("courses as c")
        .leftJoin("enrollments as e", join => join.onRef("e.course_id", "=", "c.id").on("e.tenant_id", "=", tenantId))
        .leftJoin("course_reviews as cr", join => join.onRef("cr.course_id", "=", "c.id").on("cr.tenant_id", "=", tenantId))
        .select([
          sql<number>`count(distinct e.id)::int`.as("enrollment_count"),
          sql<number>`count(distinct case when e.status = 'COMPLETED' then e.id end)::int`.as("completed_count"),
          sql<number>`count(distinct case when e.status = 'ACTIVE' then e.id end)::int`.as("active_count"),
          sql<string>`coalesce(avg(cr.rating), 0)`.as("avg_rating"),
          sql<number>`count(distinct cr.id)::int`.as("review_count"),
          entityRevenueSql(tenantId, "COURSE", "course_id", courseId, "INR").as("revenue_inr"),
          entityRevenueSql(tenantId, "COURSE", "course_id", courseId, "USD").as("revenue_usd"),
          entitySalesCountSql(tenantId, "COURSE", "course_id", courseId).as("sales_count"),
          sql<number>`coalesce((select count(*) from member_bookmarks mb where mb.tenant_id = ${tenantId} and mb.course_id = ${courseId}), 0)::int`.as("bookmark_count"),
          sql<number>`coalesce((select count(*) from cart_items ci where ci.tenant_id = ${tenantId} and ci.course_id = ${courseId}), 0)::int`.as("cart_count"),
        ])
        .where("c.tenant_id", "=", tenantId)
        .where("c.id", "=", courseId)
        .executeTakeFirstOrThrow()),

      reqLimit(() => db.selectFrom("enrollments")
        .select([sql<string>`to_char(date(enrolled_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .where(sql<boolean>`enrolled_at >= ${sd}::date`)
        .where(sql<boolean>`enrolled_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(enrolled_at)`)
        .orderBy(sql`date(enrolled_at)`)
        .execute()),

      reqLimit(() => dailyEntityRevenue(tenantId, "COURSE", "course_id", sd, ed, false, courseId)),

      reqLimit(() => db.selectFrom("member_bookmarks")
        .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(created_at)`)
        .orderBy(sql`date(created_at)`)
        .execute()),

      reqLimit(() => db.selectFrom("cart_items")
        .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(created_at)`)
        .orderBy(sql`date(created_at)`)
        .execute()),

      reqLimit(() => db.selectFrom("enrollments")
        .select([sql<string>`to_char(date(updated_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*) filter (where status = 'COMPLETED')::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .where(sql<boolean>`updated_at >= ${sd}::date`)
        .where(sql<boolean>`updated_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(updated_at)`)
        .orderBy(sql`date(updated_at)`)
        .execute()),

      reqLimit(() => db.selectFrom("enrollments")
        .select(["status", sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .groupBy("status")
        .execute()),
    ]);

    return {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        mode: course.mode,
        purchase_mode: course.purchase_mode,
        price_inr: course.price_inr ? parseFloat(String(course.price_inr)) : null,
        price_usd: course.price_usd ? parseFloat(String(course.price_usd)) : null,
      },
      summary: {
        enrollment_count: summary.enrollment_count,
        completed_count: summary.completed_count,
        active_count: summary.active_count,
        completion_rate: summary.enrollment_count > 0 ? Math.round((summary.completed_count / summary.enrollment_count) * 100) : 0,
        avg_rating: parseFloat(parseFloat(String(summary.avg_rating)).toFixed(1)),
        review_count: summary.review_count,
        revenue: makeRevenueBreakdown(
          parseFloat(String(summary.revenue_inr)),
          parseFloat(String(summary.revenue_usd)),
        ),
        sales_count: summary.sales_count,
        bookmark_count: summary.bookmark_count,
        cart_count: summary.cart_count,
      },
      daily_enrollments: dailyEnrollments.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      daily_revenue: dailyRevenue.map(r => ({
        date: String(r.date).slice(0, 10),
        amount: makeRevenueBreakdown(
          parseFloat(String(r.amount_inr)),
          parseFloat(String(r.amount_usd)),
        ),
        count: r.count,
      })),
      daily_bookmarks: dailyBookmarks.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      daily_cart_adds: dailyCartAdds.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      daily_completions: dailyCompletions.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      enrollment_status_distribution: enrollmentStatusDist.map(r => ({ status: String(r.status), count: r.count })),
    };
  }

  async getBooksAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;

    // Revenue via per-book currency-split subselects (avoids cartesian product),
    // each covering direct BOOK orders and CART lines alike.
    const bookId = sql.ref<string>("b.id");
    let query = db.selectFrom("books as b")
      .leftJoin("book_access as ba", join => join.onRef("ba.book_id", "=", "b.id").on("ba.tenant_id", "=", tenantId))
      .select([
        "b.id", "b.title", "b.slug", "b.status", "b.purchase_mode",
        "b.price_inr", "b.price_usd", "b.created_at",
        sql<number>`count(distinct ba.id)::int`.as("access_count"),
        sql<number>`count(distinct case when ba.status = 'ACTIVE' then ba.id end)::int`.as("active_access"),
        entityRevenueSql(tenantId, "BOOK", "book_id", bookId, "INR").as("revenue_inr"),
        entityRevenueSql(tenantId, "BOOK", "book_id", bookId, "USD").as("revenue_usd"),
        entitySalesCountSql(tenantId, "BOOK", "book_id", bookId).as("sales_count"),
      ])
      .where("b.tenant_id", "=", tenantId);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`lower(b.title) like ${term}`);
    }

    const rows = await query
      .groupBy(["b.id", "b.title", "b.slug", "b.status", "b.purchase_mode", "b.price_inr", "b.price_usd", "b.created_at"])
      .orderBy("access_count", "desc")
      .limit(limit).offset(offset)
      .execute();

    let countQuery = db.selectFrom("books").select(sql<number>`count(*)::int`.as("total")).where("tenant_id", "=", tenantId);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`lower(title) like ${term}`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";
    const useMonthly = this.isLifetimeRange(sd, ed);
    const searchTerm = search?.trim() ? `%${search.trim().toLowerCase()}%` : null;

    const reqLimit = pLimit(ANALYTICS_DB_LIMIT);
    const [statusDistribution, sumAggregates, dailyRevenue, sumAccessResult] = await Promise.all([
      reqLimit(() => db.selectFrom("books")
        .select(["status", sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .$if(!!searchTerm, (q) => q.where(sql<boolean>`lower(title) like ${searchTerm}`))
        .groupBy("status")
        .execute()),
      reqLimit(() => entityRevenueTotals(tenantId, "BOOK", "book_id", "books",
        searchTerm ? [sql`lower(e.title) like ${searchTerm}`] : [])),
      reqLimit(() => dailyEntityRevenue(tenantId, "BOOK", "book_id", sd, ed, useMonthly)),
      reqLimit(() => db
        .selectFrom("book_access as ba")
        .innerJoin("books as b", (join) =>
          join.onRef("b.id", "=", "ba.book_id").on("b.tenant_id", "=", tenantId)
        )
        .where("ba.tenant_id", "=", tenantId)
        .$if(!!searchTerm, (q) => q.where(sql<boolean>`lower(b.title) like ${searchTerm}`))
        .select(sql<number>`coalesce(count(*), 0)::int`.as("sum"))
        .executeTakeFirst()),
    ]);

    return {
      items: rows.map(r => ({
        id: r.id, title: r.title, slug: r.slug, status: r.status,
        purchase_mode: r.purchase_mode,
        price_inr: r.price_inr ? parseFloat(String(r.price_inr)) : null,
        price_usd: r.price_usd ? parseFloat(String(r.price_usd)) : null,
        access_count: r.access_count, active_access: r.active_access,
        revenue: makeRevenueBreakdown(
          parseFloat(String(r.revenue_inr)),
          parseFloat(String(r.revenue_usd)),
        ),
        sales_count: r.sales_count,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
      total,
      // Same order-line series as daily_revenue, kept as a separate key for the
      // books page's "sales over time" chart.
      daily_access: dailyRevenue.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      status_distribution: statusDistribution.map(r => ({ status: String(r.status), count: r.count })),
      sum_access: sumAccessResult?.sum ?? 0,
      sum_revenue: makeRevenueBreakdown(
        parseFloat(String(sumAggregates?.sum_revenue_inr ?? 0)),
        parseFloat(String(sumAggregates?.sum_revenue_usd ?? 0)),
      ),
      sum_sales: sumAggregates?.sum_sales ?? 0,
      daily_revenue: dailyRevenue.map(r => ({
        date: String(r.date).slice(0, 10),
        amount: makeRevenueBreakdown(
          parseFloat(String(r.amount_inr)),
          parseFloat(String(r.amount_usd)),
        ),
        count: r.count,
      })),
    };
  }

  async getBookDetailAnalytics(tenantId: string, bookId: string, startDate?: string, endDate?: string) {
    const book = await db.selectFrom("books")
      .select(["id", "title", "slug", "status", "purchase_mode", "price_inr", "price_usd"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", bookId)
      .executeTakeFirst();

    if (!book) return null;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    // Fold the three trailing scalar counts (bookmark, cart, completed) into
    // the summary rollup. 9 queries → 6, all bounded by the semaphore.
    const reqLimit = pLimit(ANALYTICS_DB_LIMIT);
    const [
      summary,
      dailyAccess,
      dailyRevenue,
      dailyBookmarks,
      dailyCartAdds,
      dailyCompletions,
    ] = await Promise.all([
      reqLimit(() => db.selectFrom("books as b")
        .leftJoin("book_access as ba", join => join.onRef("ba.book_id", "=", "b.id").on("ba.tenant_id", "=", tenantId))
        .select([
          sql<number>`count(distinct ba.id)::int`.as("access_count"),
          sql<number>`count(distinct case when ba.status = 'ACTIVE' then ba.id end)::int`.as("active_access"),
          entityRevenueSql(tenantId, "BOOK", "book_id", bookId, "INR").as("revenue_inr"),
          entityRevenueSql(tenantId, "BOOK", "book_id", bookId, "USD").as("revenue_usd"),
          entitySalesCountSql(tenantId, "BOOK", "book_id", bookId).as("sales_count"),
          sql<number>`coalesce((select count(*) from member_bookmarks mb where mb.tenant_id = ${tenantId} and mb.book_id = ${bookId}), 0)::int`.as("bookmark_count"),
          sql<number>`coalesce((select count(*) from cart_items ci where ci.tenant_id = ${tenantId} and ci.book_id = ${bookId}), 0)::int`.as("cart_count"),
          sql<number>`coalesce((select count(*) filter (where completed = true) from member_book_progress mbp where mbp.tenant_id = ${tenantId} and mbp.book_id = ${bookId}), 0)::int`.as("completed_count"),
        ])
        .where("b.tenant_id", "=", tenantId)
        .where("b.id", "=", bookId)
        .executeTakeFirstOrThrow()),

      reqLimit(() => db.selectFrom("book_access")
        .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("book_id", "=", bookId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(created_at)`)
        .orderBy(sql`date(created_at)`)
        .execute()),

      reqLimit(() => dailyEntityRevenue(tenantId, "BOOK", "book_id", sd, ed, false, bookId)),

      reqLimit(() => db.selectFrom("member_bookmarks")
        .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("book_id", "=", bookId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(created_at)`)
        .orderBy(sql`date(created_at)`)
        .execute()),

      reqLimit(() => db.selectFrom("cart_items")
        .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("book_id", "=", bookId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(created_at)`)
        .orderBy(sql`date(created_at)`)
        .execute()),

      reqLimit(() => db.selectFrom("member_book_progress")
        .select([sql<string>`to_char(date(updated_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*) filter (where completed = true)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("book_id", "=", bookId)
        .where(sql<boolean>`updated_at >= ${sd}::date`)
        .where(sql<boolean>`updated_at < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(updated_at)`)
        .orderBy(sql`date(updated_at)`)
        .execute()),
    ]);

    return {
      book: {
        id: book.id,
        title: book.title,
        slug: book.slug,
        status: book.status,
        purchase_mode: book.purchase_mode,
        price_inr: book.price_inr ? parseFloat(String(book.price_inr)) : null,
        price_usd: book.price_usd ? parseFloat(String(book.price_usd)) : null,
      },
      summary: {
        access_count: summary.access_count,
        active_access: summary.active_access,
        completed_count: summary.completed_count,
        completion_rate: summary.access_count > 0 ? Math.round((summary.completed_count / summary.access_count) * 100) : 0,
        revenue: makeRevenueBreakdown(
          parseFloat(String(summary.revenue_inr)),
          parseFloat(String(summary.revenue_usd)),
        ),
        sales_count: summary.sales_count,
        bookmark_count: summary.bookmark_count,
        cart_count: summary.cart_count,
      },
      daily_access: dailyAccess.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      daily_revenue: dailyRevenue.map(r => ({
        date: String(r.date).slice(0, 10),
        amount: makeRevenueBreakdown(
          parseFloat(String(r.amount_inr)),
          parseFloat(String(r.amount_usd)),
        ),
        count: r.count,
      })),
      daily_bookmarks: dailyBookmarks.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      daily_cart_adds: dailyCartAdds.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      daily_completions: dailyCompletions.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getBundlesAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;

    const bundleId = sql.ref<string>("b.id");
    let query = db.selectFrom("bundles as b")
      .leftJoin("bundle_items as bi", join => join.onRef("bi.bundle_id", "=", "b.id").on("bi.tenant_id", "=", tenantId))
      .select([
        "b.id", "b.title", "b.slug", "b.status", "b.purchase_mode",
        "b.price_inr", "b.price_usd", "b.created_at",
        sql<number>`count(distinct bi.id)::int`.as("item_count"),
        entityRevenueSql(tenantId, "BUNDLE", "bundle_id", bundleId, "INR").as("revenue_inr"),
        entityRevenueSql(tenantId, "BUNDLE", "bundle_id", bundleId, "USD").as("revenue_usd"),
        entitySalesCountSql(tenantId, "BUNDLE", "bundle_id", bundleId).as("sales_count"),
      ])
      .where("b.tenant_id", "=", tenantId);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`lower(b.title) like ${term}`);
    }
    if (startDate) query = query.where(sql<boolean>`b.created_at >= ${startDate}::date`);
    if (endDate) query = query.where(sql<boolean>`b.created_at < (${endDate}::date + interval '1 day')`);

    const rows = await query
      .groupBy(["b.id", "b.title", "b.slug", "b.status", "b.purchase_mode", "b.price_inr", "b.price_usd", "b.created_at"])
      .orderBy("sales_count", "desc")
      .limit(limit).offset(offset)
      .execute();

    let countQuery = db.selectFrom("bundles").select(sql<number>`count(*)::int`.as("total")).where("tenant_id", "=", tenantId);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`lower(title) like ${term}`);
    }
    if (startDate) countQuery = countQuery.where(sql<boolean>`created_at >= ${startDate}::date`);
    if (endDate) countQuery = countQuery.where(sql<boolean>`created_at < (${endDate}::date + interval '1 day')`);
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";
    const useMonthly = this.isLifetimeRange(sd, ed);
    const searchTerm = search?.trim() ? `%${search.trim().toLowerCase()}%` : null;

    const reqLimit = pLimit(ANALYTICS_DB_LIMIT);
    const [statusDistribution, sumAggregates, dailyRevenue, sumItemsResult] = await Promise.all([
      reqLimit(() => db.selectFrom("bundles")
        .select(["status", sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .$if(!!searchTerm, (q) => q.where(sql<boolean>`lower(title) like ${searchTerm}`))
        .$if(!!startDate, (q) => q.where(sql<boolean>`created_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`created_at < (${endDate}::date + interval '1 day')`))
        .groupBy("status")
        .execute()),
      reqLimit(() => entityRevenueTotals(tenantId, "BUNDLE", "bundle_id", "bundles", [
        ...(searchTerm ? [sql`lower(e.title) like ${searchTerm}`] : []),
        ...(startDate ? [sql`e.created_at >= ${startDate}::date`] : []),
        ...(endDate ? [sql`e.created_at < (${endDate}::date + interval '1 day')`] : []),
      ])),
      reqLimit(() => dailyEntityRevenue(tenantId, "BUNDLE", "bundle_id", sd, ed, useMonthly)),
      reqLimit(() => db.selectFrom("bundle_items as bi")
        .innerJoin("bundles as b", (join) =>
          join.onRef("b.id", "=", "bi.bundle_id").on("b.tenant_id", "=", tenantId)
        )
        .where("bi.tenant_id", "=", tenantId)
        .$if(!!searchTerm, (q) => q.where(sql<boolean>`lower(b.title) like ${searchTerm}`))
        .$if(!!startDate, (q) => q.where(sql<boolean>`b.created_at >= ${startDate}::date`))
        .$if(!!endDate, (q) => q.where(sql<boolean>`b.created_at < (${endDate}::date + interval '1 day')`))
        .select(sql<number>`coalesce(count(*), 0)::int`.as("sum"))
        .executeTakeFirst()),
    ]);

    return {
      items: rows.map(r => ({
        id: r.id, title: r.title, slug: r.slug, status: r.status,
        purchase_mode: r.purchase_mode,
        price_inr: r.price_inr ? parseFloat(String(r.price_inr)) : null,
        price_usd: r.price_usd ? parseFloat(String(r.price_usd)) : null,
        item_count: r.item_count,
        revenue: makeRevenueBreakdown(
          parseFloat(String(r.revenue_inr)),
          parseFloat(String(r.revenue_usd)),
        ),
        sales_count: r.sales_count,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
      total,
      // Same order-line series as daily_revenue, kept as a separate key for the
      // bundles page's "sales over time" chart.
      daily_sales: dailyRevenue.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
      status_distribution: statusDistribution.map(r => ({ status: String(r.status), count: r.count })),
      sum_items: sumItemsResult?.sum ?? 0,
      sum_revenue: makeRevenueBreakdown(
        parseFloat(String(sumAggregates?.sum_revenue_inr ?? 0)),
        parseFloat(String(sumAggregates?.sum_revenue_usd ?? 0)),
      ),
      sum_sales: sumAggregates?.sum_sales ?? 0,
      daily_revenue: dailyRevenue.map(r => ({
        date: String(r.date).slice(0, 10),
        amount: makeRevenueBreakdown(
          parseFloat(String(r.amount_inr)),
          parseFloat(String(r.amount_usd)),
        ),
        count: r.count,
      })),
    };
  }

  async getPaymentsAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string, filters?: PaymentAnalyticsFilters) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    // Exclude WALLET_TOPUP orders, those are end-user AI wallet recharges,
    // not tenant revenue. They should only be visible to core admin.
    //
    // Revenue split by currency (INR/USD) since `total_amount` is stored
    // in the original charge currency. AOV is tracked per-currency because
    // averaging across currencies is meaningless.
    const summary = await db.selectFrom("payment_orders")
      .select([
        sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'INR' then total_amount else 0 end), 0)`.as("revenue_inr"),
        sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'USD' then total_amount else 0 end), 0)`.as("revenue_usd"),
        sql<number>`count(*)::int`.as("total_orders"),
        sql<number>`count(*) filter (where status = 'PAID')::int`.as("paid"),
        sql<number>`count(*) filter (where status = 'PAID' and currency = 'INR')::int`.as("paid_inr"),
        sql<number>`count(*) filter (where status = 'PAID' and currency = 'USD')::int`.as("paid_usd"),
        sql<number>`count(*) filter (where status = 'FAILED')::int`.as("failed"),
        sql<number>`count(*) filter (where status = 'CREATED' or status = 'PAYMENT_PENDING')::int`.as("pending"),
        sql<number>`count(*) filter (where status in ('REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_INITIATED'))::int`.as("refunded"),
        sql<string>`coalesce(sum(case when status = 'FAILED' and currency = 'INR' then total_amount else 0 end), 0)`.as("failed_amount_inr"),
        sql<string>`coalesce(sum(case when status = 'FAILED' and currency = 'USD' then total_amount else 0 end), 0)`.as("failed_amount_usd"),
        sql<string>`coalesce(sum(case when (status = 'CREATED' or status = 'PAYMENT_PENDING') and currency = 'INR' then total_amount else 0 end), 0)`.as("pending_amount_inr"),
        sql<string>`coalesce(sum(case when (status = 'CREATED' or status = 'PAYMENT_PENDING') and currency = 'USD' then total_amount else 0 end), 0)`.as("pending_amount_usd"),
        sql<string>`coalesce(sum(case when status in ('REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_INITIATED') and currency = 'INR' then total_amount else 0 end), 0)`.as("refunded_amount_inr"),
        sql<string>`coalesce(sum(case when status in ('REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_INITIATED') and currency = 'USD' then total_amount else 0 end), 0)`.as("refunded_amount_usd"),
        sql<string>`coalesce(avg(case when status = 'PAID' and currency = 'INR' then total_amount end), 0)`.as("avg_order_value_inr"),
        sql<string>`coalesce(avg(case when status = 'PAID' and currency = 'USD' then total_amount end), 0)`.as("avg_order_value_usd"),
      ])
      .where("tenant_id", "=", tenantId)
      .where(sql<boolean>`created_at >= ${sd}::date`)
      .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
      .executeTakeFirstOrThrow();

    const dailyRevenue = await db.selectFrom("payment_orders")
      .select([
        sql<string>`to_char(date(paid_at), 'YYYY-MM-DD')`.as("date"),
        sql<string>`coalesce(sum(case when currency = 'INR' then total_amount else 0 end), 0)`.as("amount_inr"),
        sql<string>`coalesce(sum(case when currency = 'USD' then total_amount else 0 end), 0)`.as("amount_usd"),
        sql<number>`count(*)::int`.as("count"),
      ])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PAID")
      .where(sql<boolean>`paid_at >= ${sd}::date`)
      .where(sql<boolean>`paid_at < (${ed}::date + interval '1 day')`)
      .groupBy(sql`date(paid_at)`)
      .orderBy(sql`date(paid_at)`)
      .execute();

    const byType = await db.selectFrom("payment_orders")
      .select([
        "order_type",
        sql<number>`count(*) filter (where status = 'PAID')::int`.as("count"),
        sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'INR' then total_amount else 0 end), 0)`.as("revenue_inr"),
        sql<string>`coalesce(sum(case when status = 'PAID' and currency = 'USD' then total_amount else 0 end), 0)`.as("revenue_usd"),
      ])
      .where("tenant_id", "=", tenantId)
      .where(sql<boolean>`created_at >= ${sd}::date`)
      .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
      .groupBy("order_type")
      .execute();

    // Failure report, why payments fail, most common first.
    const failureReasons = await db.selectFrom("payment_orders")
      .select([
        sql<string>`coalesce(nullif(trim(failure_reason), ''), 'Unknown')`.as("reason"),
        sql<number>`count(*)::int`.as("count"),
      ])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "FAILED")
      .where(sql<boolean>`created_at >= ${sd}::date`)
      .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
      .groupBy(sql`coalesce(nullif(trim(failure_reason), ''), 'Unknown')`)
      .orderBy(sql`count(*)`, "desc")
      .limit(15)
      .execute();

    // Daily status trend, paid vs failed vs pending counts over time so the
    // page/report can chart failure spikes, not just paid revenue.
    const dailyOrders = await db.selectFrom("payment_orders")
      .select([
        sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"),
        sql<number>`count(*) filter (where status = 'PAID')::int`.as("paid"),
        sql<number>`count(*) filter (where status = 'FAILED')::int`.as("failed"),
        sql<number>`count(*) filter (where status = 'CREATED' or status = 'PAYMENT_PENDING')::int`.as("pending"),
      ])
      .where("tenant_id", "=", tenantId)
      .where(sql<boolean>`created_at >= ${sd}::date`)
      .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`)
      .execute();

    // Drill-down filters, applied to the orders list + count + export only.
    const idList = (ids: string[]) => sql.join(ids.map((id) => sql`${id}`));
    const orderFilterClauses = [
      filters?.statuses?.length ? sql<boolean>`o.status in (${idList(filters.statuses)})` : null,
      filters?.orderTypes?.length ? sql<boolean>`o.order_type in (${idList(filters.orderTypes)})` : null,
      filters?.minAmount != null ? sql<boolean>`o.total_amount >= ${filters.minAmount}` : null,
      filters?.maxAmount != null ? sql<boolean>`o.total_amount <= ${filters.maxAmount}` : null,
    ].filter((c): c is Exclude<typeof c, null> => c !== null);

    let ordersQuery = db.selectFrom("payment_orders as o")
      .innerJoin("tenant_members as m", "m.id", "o.tenant_member_id")
      .select(["o.id", "o.order_number", "m.name as member_name", "m.email as member_email",
        "o.total_amount", "o.currency", "o.status", "o.order_type", "o.failure_reason", "o.paid_at", "o.created_at"])
      .where("o.tenant_id", "=", tenantId)
      .where(sql<boolean>`o.created_at >= ${sd}::date`)
      .where(sql<boolean>`o.created_at < (${ed}::date + interval '1 day')`);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      ordersQuery = ordersQuery.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(o.order_number) like ${term})`);
    }
    for (const c of orderFilterClauses) ordersQuery = ordersQuery.where(c);

    const recentOrders = await ordersQuery.orderBy("o.created_at", "desc").limit(limit).offset(offset).execute();

    let ordersCountQuery = db.selectFrom("payment_orders as o")
      .innerJoin("tenant_members as m", "m.id", "o.tenant_member_id")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("o.tenant_id", "=", tenantId)
      .where(sql<boolean>`o.created_at >= ${sd}::date`)
      .where(sql<boolean>`o.created_at < (${ed}::date + interval '1 day')`);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      ordersCountQuery = ordersCountQuery.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(o.order_number) like ${term})`);
    }
    for (const c of orderFilterClauses) ordersCountQuery = ordersCountQuery.where(c);
    const recent_orders_total = (await ordersCountQuery.executeTakeFirstOrThrow()).total;

    const avgInr = parseFloat(String(summary.avg_order_value_inr));
    const avgUsd = parseFloat(String(summary.avg_order_value_usd));

    return {
      total_revenue: makeRevenueBreakdown(
        parseFloat(String(summary.revenue_inr)),
        parseFloat(String(summary.revenue_usd)),
      ),
      total_orders: summary.total_orders,
      paid: summary.paid,
      paid_inr: summary.paid_inr,
      paid_usd: summary.paid_usd,
      failed: summary.failed,
      pending: summary.pending,
      refunded: summary.refunded,
      failed_amount: makeRevenueBreakdown(
        parseFloat(String(summary.failed_amount_inr)),
        parseFloat(String(summary.failed_amount_usd)),
      ),
      pending_amount: makeRevenueBreakdown(
        parseFloat(String(summary.pending_amount_inr)),
        parseFloat(String(summary.pending_amount_usd)),
      ),
      refunded_amount: makeRevenueBreakdown(
        parseFloat(String(summary.refunded_amount_inr)),
        parseFloat(String(summary.refunded_amount_usd)),
      ),
      avg_order_value_inr: summary.paid_inr > 0 ? parseFloat(avgInr.toFixed(2)) : null,
      avg_order_value_usd: summary.paid_usd > 0 ? parseFloat(avgUsd.toFixed(2)) : null,
      conversion_rate: USD_TO_INR_RATE,
      failure_reasons: failureReasons.map(r => ({ reason: String(r.reason), count: r.count })),
      daily_orders: dailyOrders.map(r => ({
        date: String(r.date),
        paid: r.paid,
        failed: r.failed,
        pending: r.pending,
      })),
      daily_revenue: dailyRevenue.map(r => ({
        date: String(r.date),
        amount: makeRevenueBreakdown(
          parseFloat(String(r.amount_inr)),
          parseFloat(String(r.amount_usd)),
        ),
        count: r.count,
      })),
      by_type: byType.map(r => ({
        type: r.order_type,
        count: r.count,
        revenue: makeRevenueBreakdown(
          parseFloat(String(r.revenue_inr)),
          parseFloat(String(r.revenue_usd)),
        ),
      })),
      recent_orders: recentOrders.map(r => ({
        ...r, total_amount: String(r.total_amount),
        paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
        created_at: new Date(r.created_at).toISOString(),
      })),
      recent_orders_total,
      // Tenant wallets are not part of this platform; kept null for response shape.
      wallet: null,
    };
  }

  async getCertificatesAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    const summary = await db.selectFrom("certificates")
      .select([
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(*) filter (where status = 'ISSUED')::int`.as("issued"),
        sql<number>`count(*) filter (where status = 'REVOKED')::int`.as("revoked"),
      ])
      .where("tenant_id", "=", tenantId)
      .where(sql<boolean>`issued_at >= ${sd}::date`)
      .where(sql<boolean>`issued_at < (${ed}::date + interval '1 day')`)
      .executeTakeFirstOrThrow();

    let byCourseQuery = db.selectFrom("certificates as cert")
      .innerJoin("courses as c", "c.id", "cert.course_id")
      .select(["c.id", "c.title", sql<number>`count(cert.id)::int`.as("count")])
      .where("cert.tenant_id", "=", tenantId);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      byCourseQuery = byCourseQuery.where(sql<boolean>`lower(c.title) like ${term}`);
    }

    const byCourse = await byCourseQuery
      .groupBy(["c.id", "c.title"])
      .orderBy("count", "desc")
      .limit(limit).offset(offset)
      .execute();

    let countQuery = db.selectFrom("certificates as cert")
      .innerJoin("courses as c", "c.id", "cert.course_id")
      .select(sql<number>`count(distinct c.id)::int`.as("total"))
      .where("cert.tenant_id", "=", tenantId);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`lower(c.title) like ${term}`);
    }
    const by_course_total = (await countQuery.executeTakeFirstOrThrow()).total;

    const useMonthly = this.isLifetimeRange(sd, ed);
    const dailyIssued = useMonthly
      ? await db.selectFrom("certificates")
          .select([sql<string>`to_char(date_trunc('month', issued_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where("status", "=", "ISSUED")
          .where(sql<boolean>`issued_at >= ${sd}::date`)
          .where(sql<boolean>`issued_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date_trunc('month', issued_at)`)
          .orderBy(sql`date_trunc('month', issued_at)`)
          .execute()
      : await db.selectFrom("certificates")
          .select([sql<string>`to_char(date(issued_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where("status", "=", "ISSUED")
          .where(sql<boolean>`issued_at >= ${sd}::date`)
          .where(sql<boolean>`issued_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date(issued_at)`)
          .orderBy(sql`date(issued_at)`)
          .execute();

    return {
      ...summary,
      by_course: byCourse,
      by_course_total,
      daily_issued: dailyIssued.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getCertificateDetails(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    let query = db.selectFrom("certificates as cert")
      .innerJoin("tenant_members as m", "m.id", "cert.tenant_member_id")
      .innerJoin("courses as c", "c.id", "cert.course_id")
      .select([
        "cert.id", "cert.status", "cert.issued_at", "cert.revoked_at",
        "m.name as member_name", "m.email as member_email",
        "c.title as course_title",
      ])
      .where("cert.tenant_id", "=", tenantId)
      .where(sql<boolean>`cert.issued_at >= ${sd}::date`)
      .where(sql<boolean>`cert.issued_at < (${ed}::date + interval '1 day')`);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(c.title) like ${term})`);
    }

    const rows = await query.orderBy("cert.issued_at", "desc").limit(limit).offset(offset).execute();

    let countQuery = db.selectFrom("certificates as cert")
      .innerJoin("tenant_members as m", "m.id", "cert.tenant_member_id")
      .innerJoin("courses as c", "c.id", "cert.course_id")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("cert.tenant_id", "=", tenantId)
      .where(sql<boolean>`cert.issued_at >= ${sd}::date`)
      .where(sql<boolean>`cert.issued_at < (${ed}::date + interval '1 day')`);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(c.title) like ${term})`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    return {
      items: rows.map(r => ({
        id: r.id,
        member_name: r.member_name,
        member_email: r.member_email,
        course_title: r.course_title,
        status: r.status,
        issued_at: r.issued_at ? new Date(r.issued_at).toISOString() : null,
        revoked_at: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
      })),
      total,
    };
  }

  async getCouponsAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;

    const summaryQuery = db.selectFrom("coupons")
      .select([
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(*) filter (where is_active = true)::int`.as("active"),
        sql<number>`coalesce(sum(used_count), 0)::int`.as("total_usage"),
      ])
      .where("tenant_id", "=", tenantId);

    const summaryResult = await summaryQuery.executeTakeFirstOrThrow();

    let query = db.selectFrom("coupons")
      .select([
        "id", "code", "discount_type", "discount_value", "is_active",
        "max_uses", "used_count", "valid_from", "valid_to", "created_at",
      ])
      .where("tenant_id", "=", tenantId);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`lower(code) like ${term}`);
    }
    if (startDate) query = query.where(sql<boolean>`created_at >= ${startDate}::date`);
    if (endDate) query = query.where(sql<boolean>`created_at < (${endDate}::date + interval '1 day')`);

    const rows = await query.orderBy("used_count", "desc").limit(limit).offset(offset).execute();

    let countQuery = db.selectFrom("coupons").select(sql<number>`count(*)::int`.as("total")).where("tenant_id", "=", tenantId);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`lower(code) like ${term}`);
    }
    if (startDate) countQuery = countQuery.where(sql<boolean>`created_at >= ${startDate}::date`);
    if (endDate) countQuery = countQuery.where(sql<boolean>`created_at < (${endDate}::date + interval '1 day')`);
    const coupons_total = (await countQuery.executeTakeFirstOrThrow()).total;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";
    const useMonthly = this.isLifetimeRange(sd, ed);
    const dailyRedemptions = useMonthly
      ? await db.selectFrom("payment_orders")
          .select([sql<string>`to_char(date_trunc('month', paid_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where("status", "=", "PAID")
          .where(sql<boolean>`paid_at >= ${sd}::date`)
          .where(sql<boolean>`paid_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date_trunc('month', paid_at)`)
          .orderBy(sql`date_trunc('month', paid_at)`)
          .execute()
      : await db.selectFrom("payment_orders")
          .select([sql<string>`to_char(date(paid_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where("status", "=", "PAID")
          .where(sql<boolean>`paid_at >= ${sd}::date`)
          .where(sql<boolean>`paid_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date(paid_at)`)
          .orderBy(sql`date(paid_at)`)
          .execute();

    return {
      total: summaryResult.total, active: summaryResult.active, total_usage: summaryResult.total_usage,
      coupons: rows.map(r => ({
        ...r,
        discount_value: parseFloat(String(r.discount_value)),
        valid_from: r.valid_from ? new Date(r.valid_from).toISOString() : null,
        valid_to: r.valid_to ? new Date(r.valid_to).toISOString() : null,
        created_at: new Date(r.created_at).toISOString(),
      })),
      coupons_total,
      daily_redemptions: dailyRedemptions.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getQuizzesAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;

    let query = db.selectFrom("quizzes as q")
      .innerJoin("courses as c", "c.id", "q.course_id")
      .leftJoin("quiz_attempts as qa", join => join.onRef("qa.quiz_id", "=", "q.id").on("qa.tenant_id", "=", tenantId))
      .select([
        "q.id", "q.title", "c.title as course_title",
        sql<number>`count(distinct qa.id)::int`.as("attempt_count"),
        sql<string>`coalesce(avg(qa.score), 0)`.as("avg_score"),
        sql<number>`count(distinct case when qa.status = 'PASSED' then qa.id end)::int`.as("passed"),
        sql<number>`count(distinct case when qa.status = 'FAILED' then qa.id end)::int`.as("failed"),
      ])
      .where("q.tenant_id", "=", tenantId);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`(lower(q.title) like ${term} or lower(c.title) like ${term})`);
    }
    // Quizzes list/count: show all quizzes (no date filter). Date range applies to daily_attempts chart only.
    // Users expect "Total Quizzes" to reflect all quizzes in the system.

    const quizzes = await query
      .groupBy(["q.id", "q.title", "c.title"])
      .orderBy("attempt_count", "desc")
      .limit(limit).offset(offset)
      .execute();

    let countQuery = db.selectFrom("quizzes as q")
      .innerJoin("courses as c", "c.id", "q.course_id")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("q.tenant_id", "=", tenantId);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`(lower(q.title) like ${term} or lower(c.title) like ${term})`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";
    const useMonthly = this.isLifetimeRange(sd, ed);
    const dailyAttempts = useMonthly
      ? await db.selectFrom("quiz_attempts")
          .select([sql<string>`to_char(date_trunc('month', created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`created_at >= ${sd}::date`)
          .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date_trunc('month', created_at)`)
          .orderBy(sql`date_trunc('month', created_at)`)
          .execute()
      : await db.selectFrom("quiz_attempts")
          .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`created_at >= ${sd}::date`)
          .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date(created_at)`)
          .orderBy(sql`date(created_at)`)
          .execute();

    return {
      items: quizzes.map(q => ({
        ...q,
        avg_score: parseFloat(parseFloat(String(q.avg_score)).toFixed(1)),
        pass_rate: q.attempt_count > 0 ? Math.round((q.passed / q.attempt_count) * 100) : 0,
      })),
      total,
      daily_attempts: dailyAttempts.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getEngagementAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    const [summary, rowsResult] = await Promise.all([
      db.selectFrom("member_lecture_progress as mlp")
        .select([
          sql<number>`coalesce(sum(mlp.watched_duration), 0)::int`.as("total_seconds"),
          sql<number>`count(*) filter (where mlp.completed = true)::int`.as("lectures_completed"),
          sql<number>`count(distinct mlp.tenant_member_id)::int`.as("active_learners"),
        ])
        .where("mlp.tenant_id", "=", tenantId)
        .where(sql<boolean>`mlp.last_watched_at >= ${sd}::date`)
        .where(sql<boolean>`mlp.last_watched_at < (${ed}::date + interval '1 day')`)
        .executeTakeFirstOrThrow(),

      (async () => {
        let query = db.selectFrom("member_lecture_progress as mlp")
          .innerJoin("courses as c", "c.id", "mlp.course_id")
          .select([
            "c.id", "c.title",
            sql<number>`coalesce(sum(mlp.watched_duration), 0)::int`.as("total_seconds"),
            sql<number>`count(*) filter (where mlp.completed = true)::int`.as("completed_lectures"),
            sql<number>`count(distinct mlp.tenant_member_id)::int`.as("active_learners"),
          ])
          .where("mlp.tenant_id", "=", tenantId)
          .where(sql<boolean>`mlp.last_watched_at >= ${sd}::date`)
          .where(sql<boolean>`mlp.last_watched_at < (${ed}::date + interval '1 day')`);

        if (search?.trim()) {
          const term = `%${search.trim().toLowerCase()}%`;
          query = query.where(sql<boolean>`lower(c.title) like ${term}`);
        }

        return query.groupBy(["c.id", "c.title"])
          .orderBy("total_seconds", "desc")
          .limit(limit).offset(offset)
          .execute();
      })(),
    ]);

    let countQuery = db.selectFrom("member_lecture_progress as mlp")
      .innerJoin("courses as c", "c.id", "mlp.course_id")
      .select(sql<number>`count(distinct c.id)::int`.as("total"))
      .where("mlp.tenant_id", "=", tenantId)
      .where(sql<boolean>`mlp.last_watched_at >= ${sd}::date`)
      .where(sql<boolean>`mlp.last_watched_at < (${ed}::date + interval '1 day')`);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`lower(c.title) like ${term}`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    const avgSecondsPerUser = summary.active_learners > 0 ? Math.round(summary.total_seconds / summary.active_learners) : 0;

    const useMonthly = this.isLifetimeRange(sd, ed);
    const [dailyWatchTime, dailyLectures] = await Promise.all([
      useMonthly
        ? db.selectFrom("member_lecture_progress")
            .select([sql<string>`to_char(date_trunc('month', last_watched_at), 'YYYY-MM-DD')`.as("date"), sql<number>`coalesce(sum(watched_duration), 0)::int`.as("seconds")])
            .where("tenant_id", "=", tenantId)
            .where(sql<boolean>`last_watched_at >= ${sd}::date`)
            .where(sql<boolean>`last_watched_at < (${ed}::date + interval '1 day')`)
            .groupBy(sql`date_trunc('month', last_watched_at)`)
            .orderBy(sql`date_trunc('month', last_watched_at)`)
            .execute()
        : db.selectFrom("member_lecture_progress")
            .select([sql<string>`to_char(date(last_watched_at), 'YYYY-MM-DD')`.as("date"), sql<number>`coalesce(sum(watched_duration), 0)::int`.as("seconds")])
            .where("tenant_id", "=", tenantId)
            .where(sql<boolean>`last_watched_at >= ${sd}::date`)
            .where(sql<boolean>`last_watched_at < (${ed}::date + interval '1 day')`)
            .groupBy(sql`date(last_watched_at)`)
            .orderBy(sql`date(last_watched_at)`)
            .execute(),
      useMonthly
        ? db.selectFrom("member_lecture_progress")
            .select([sql<string>`to_char(date_trunc('month', last_watched_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*) filter (where completed = true)::int`.as("count")])
            .where("tenant_id", "=", tenantId)
            .where(sql<boolean>`last_watched_at >= ${sd}::date`)
            .where(sql<boolean>`last_watched_at < (${ed}::date + interval '1 day')`)
            .groupBy(sql`date_trunc('month', last_watched_at)`)
            .orderBy(sql`date_trunc('month', last_watched_at)`)
            .execute()
        : db.selectFrom("member_lecture_progress")
            .select([sql<string>`to_char(date(last_watched_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*) filter (where completed = true)::int`.as("count")])
            .where("tenant_id", "=", tenantId)
            .where(sql<boolean>`last_watched_at >= ${sd}::date`)
            .where(sql<boolean>`last_watched_at < (${ed}::date + interval '1 day')`)
            .groupBy(sql`date(last_watched_at)`)
            .orderBy(sql`date(last_watched_at)`)
            .execute(),
    ]);

    return {
      total_watch_time_seconds: summary.total_seconds,
      lectures_completed: summary.lectures_completed,
      active_learners: summary.active_learners,
      avg_watch_time_per_user_seconds: avgSecondsPerUser,
      items: rowsResult.map(r => ({
        id: r.id,
        title: r.title,
        total_seconds: r.total_seconds,
        total_watch_time_hours: Math.round((r.total_seconds / 3600) * 100) / 100,
        completed_lectures: r.completed_lectures,
        active_learners: r.active_learners,
        avg_time_per_learner_seconds: r.active_learners > 0 ? Math.round(r.total_seconds / r.active_learners) : 0,
      })),
      total,
      daily_watch_time: dailyWatchTime.map(r => ({ date: String(r.date).slice(0, 10), seconds: r.seconds })),
      daily_lectures: dailyLectures.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getBookReadingAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;

    // Fold the three separate scalar summaries (book progress + highlights +
    // page_bookmarks totals) into one round-trip.
    const summaryRow = await sql<{
      books_in_progress: number; books_completed: number;
      total_highlights: number; total_page_bookmarks: number;
    }>`
      SELECT
        (SELECT count(*) filter (where completed = false)::int FROM member_book_progress WHERE tenant_id = ${tenantId}) AS books_in_progress,
        (SELECT count(*) filter (where completed = true)::int  FROM member_book_progress WHERE tenant_id = ${tenantId}) AS books_completed,
        (SELECT count(*)::int FROM member_book_highlights      WHERE tenant_id = ${tenantId}) AS total_highlights,
        (SELECT count(*)::int FROM member_book_page_bookmarks  WHERE tenant_id = ${tenantId}) AS total_page_bookmarks
    `.execute(db);
    const summary = summaryRow.rows[0];

    // Per-book progress + highlights + page_bookmark counts in ONE query via
    // grouped subqueries. Replaces the prior N+1 (was 2 extra queries per book).
    // Window function returns the un-paginated total in the same query.
    const bpSub = db.selectFrom("member_book_progress as mbp")
      .select(["mbp.book_id", sql<number>`count(distinct mbp.tenant_member_id)::int`.as("readers"), sql<number>`count(*) filter (where mbp.completed = true)::int`.as("completed"), sql<number>`count(*) filter (where mbp.completed = false)::int`.as("in_progress")])
      .where("mbp.tenant_id", "=", tenantId)
      .groupBy("mbp.book_id")
      .as("bp");

    const hlSub = db.selectFrom("member_book_highlights as mbh")
      .select(["mbh.book_id", sql<number>`count(*)::int`.as("c")])
      .where("mbh.tenant_id", "=", tenantId)
      .groupBy("mbh.book_id")
      .as("hl");

    const pbSub = db.selectFrom("member_book_page_bookmarks as mpb")
      .select(["mpb.book_id", sql<number>`count(*)::int`.as("c")])
      .where("mpb.tenant_id", "=", tenantId)
      .groupBy("mpb.book_id")
      .as("pb");

    let query = db.selectFrom("books as b")
      .leftJoin(bpSub, "bp.book_id", "b.id")
      .leftJoin(hlSub, "hl.book_id", "b.id")
      .leftJoin(pbSub, "pb.book_id", "b.id")
      .select([
        "b.id", "b.title",
        sql<number>`coalesce(bp.readers, 0)::int`.as("readers"),
        sql<number>`coalesce(bp.completed, 0)::int`.as("completed"),
        sql<number>`coalesce(bp.in_progress, 0)::int`.as("in_progress"),
        sql<number>`coalesce(hl.c, 0)::int`.as("highlights"),
        sql<number>`coalesce(pb.c, 0)::int`.as("page_bookmarks"),
        sql<number>`count(*) over ()::int`.as("total_count"),
      ])
      .where("b.tenant_id", "=", tenantId);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`lower(b.title) like ${term}`);
    }
    if (startDate) query = query.where(sql<boolean>`b.created_at >= ${startDate}::date`);
    if (endDate) query = query.where(sql<boolean>`b.created_at < (${endDate}::date + interval '1 day')`);

    const bookRows = await query
      .orderBy("readers", "desc")
      .limit(limit).offset(offset)
      .execute();

    const total = bookRows[0]?.total_count ?? 0;

    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";
    const useMonthly = this.isLifetimeRange(sd, ed);
    const dailyCompletions = useMonthly
      ? await db.selectFrom("member_book_progress")
          .select([sql<string>`to_char(date_trunc('month', updated_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*) filter (where completed = true)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`updated_at >= ${sd}::date`)
          .where(sql<boolean>`updated_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date_trunc('month', updated_at)`)
          .orderBy(sql`date_trunc('month', updated_at)`)
          .execute()
      : await db.selectFrom("member_book_progress")
          .select([sql<string>`to_char(date(updated_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*) filter (where completed = true)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`updated_at >= ${sd}::date`)
          .where(sql<boolean>`updated_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date(updated_at)`)
          .orderBy(sql`date(updated_at)`)
          .execute();

    return {
      books_in_progress: summary.books_in_progress,
      books_completed: summary.books_completed,
      total_highlights: summary.total_highlights,
      total_page_bookmarks: summary.total_page_bookmarks,
      items: bookRows.map(r => ({ id: r.id, title: r.title, readers: r.readers, completed: r.completed, in_progress: r.in_progress, highlights: r.highlights, page_bookmarks: r.page_bookmarks })),
      total,
      daily_completions: dailyCompletions.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getCartAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    const [summary, byType] = await Promise.all([
      db.selectFrom("cart_items")
        .select([
          sql<number>`count(*)::int`.as("total_items"),
          sql<number>`count(distinct tenant_member_id)::int`.as("unique_users"),
        ])
        .where("tenant_id", "=", tenantId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .executeTakeFirstOrThrow(),

      db.selectFrom("cart_items")
        .select(["item_type", sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy("item_type")
        .execute(),
    ]);

    let query = db.selectFrom("cart_items as ci")
      .innerJoin("tenant_members as m", "m.id", "ci.tenant_member_id")
      .leftJoin("courses as c", "c.id", "ci.course_id")
      .leftJoin("books as bk", "bk.id", "ci.book_id")
      .leftJoin("bundles as bu", "bu.id", "ci.bundle_id")
      .select([
        "ci.id", "ci.item_type", "ci.created_at",
        "m.name as member_name", "m.email as member_email",
        sql<string>`coalesce(c.title, bk.title, bu.title, 'Unknown')`.as("item_title"),
      ])
      .where("ci.tenant_id", "=", tenantId)
      .where(sql<boolean>`ci.created_at >= ${sd}::date`)
      .where(sql<boolean>`ci.created_at < (${ed}::date + interval '1 day')`);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(coalesce(c.title, '')) like ${term} or lower(coalesce(bk.title, '')) like ${term} or lower(coalesce(bu.title, '')) like ${term})`);
    }

    const rows = await query.orderBy("ci.created_at", "desc").limit(limit).offset(offset).execute();

    let countQuery = db.selectFrom("cart_items as ci")
      .innerJoin("tenant_members as m", "m.id", "ci.tenant_member_id")
      .leftJoin("courses as c", "c.id", "ci.course_id")
      .leftJoin("books as bk", "bk.id", "ci.book_id")
      .leftJoin("bundles as bu", "bu.id", "ci.bundle_id")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("ci.tenant_id", "=", tenantId)
      .where(sql<boolean>`ci.created_at >= ${sd}::date`)
      .where(sql<boolean>`ci.created_at < (${ed}::date + interval '1 day')`);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(coalesce(c.title, '')) like ${term} or lower(coalesce(bk.title, '')) like ${term} or lower(coalesce(bu.title, '')) like ${term})`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    const coursesInCart = byType.find(t => t.item_type === "COURSE")?.count ?? 0;
    const booksInCart = byType.find(t => t.item_type === "BOOK")?.count ?? 0;
    const bundlesInCart = byType.find(t => t.item_type === "BUNDLE")?.count ?? 0;

    const useMonthly = this.isLifetimeRange(sd, ed);
    const dailyItemsAdded = useMonthly
      ? await db.selectFrom("cart_items")
          .select([sql<string>`to_char(date_trunc('month', created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`created_at >= ${sd}::date`)
          .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date_trunc('month', created_at)`)
          .orderBy(sql`date_trunc('month', created_at)`)
          .execute()
      : await db.selectFrom("cart_items")
          .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`created_at >= ${sd}::date`)
          .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date(created_at)`)
          .orderBy(sql`date(created_at)`)
          .execute();

    return {
      total_items: summary.total_items,
      unique_users: summary.unique_users,
      courses_in_cart: coursesInCart,
      books_in_cart: booksInCart,
      bundles_in_cart: bundlesInCart,
      items: rows.map(r => ({
        id: r.id,
        item_type: r.item_type,
        item_title: r.item_title,
        member_name: r.member_name,
        member_email: r.member_email,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
      total,
      daily_items_added: dailyItemsAdded.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getBookmarksAnalytics(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    const [summary, byType] = await Promise.all([
      db.selectFrom("member_bookmarks")
        .select(sql<number>`count(*)::int`.as("total"))
        .where("tenant_id", "=", tenantId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .executeTakeFirstOrThrow(),

      db.selectFrom("member_bookmarks")
        .select(["bookmark_type", sql<number>`count(*)::int`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where(sql<boolean>`created_at >= ${sd}::date`)
        .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
        .groupBy("bookmark_type")
        .execute(),
    ]);

    const courseRows = await (() => {
      let q = db.selectFrom("member_bookmarks as mb")
        .innerJoin("courses as c", "c.id", "mb.course_id")
        .select(["c.id", "c.title", sql<number>`count(mb.id)::int`.as("bookmark_count")])
        .where("mb.tenant_id", "=", tenantId)
        .where(sql<boolean>`mb.created_at >= ${sd}::date`)
        .where(sql<boolean>`mb.created_at < (${ed}::date + interval '1 day')`)
        .groupBy(["c.id", "c.title"]);
      if (search?.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        q = q.where(sql<boolean>`lower(c.title) like ${term}`);
      }
      return q.orderBy("bookmark_count", "desc").execute();
    })();

    const bookRows = await (() => {
      let q = db.selectFrom("member_bookmarks as mb")
        .innerJoin("books as b", "b.id", "mb.book_id")
        .select(["b.id", "b.title", sql<number>`count(mb.id)::int`.as("bookmark_count")])
        .where("mb.tenant_id", "=", tenantId)
        .where(sql<boolean>`mb.created_at >= ${sd}::date`)
        .where(sql<boolean>`mb.created_at < (${ed}::date + interval '1 day')`)
        .groupBy(["b.id", "b.title"]);
      if (search?.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        q = q.where(sql<boolean>`lower(b.title) like ${term}`);
      }
      return q.orderBy("bookmark_count", "desc").execute();
    })();

    const bundleRows = await (() => {
      let q = db.selectFrom("member_bookmarks as mb")
        .innerJoin("bundles as bu", "bu.id", "mb.bundle_id")
        .select(["bu.id", "bu.title", sql<number>`count(mb.id)::int`.as("bookmark_count")])
        .where("mb.tenant_id", "=", tenantId)
        .where(sql<boolean>`mb.created_at >= ${sd}::date`)
        .where(sql<boolean>`mb.created_at < (${ed}::date + interval '1 day')`)
        .groupBy(["bu.id", "bu.title"]);
      if (search?.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        q = q.where(sql<boolean>`lower(bu.title) like ${term}`);
      }
      return q.orderBy("bookmark_count", "desc").execute();
    })();

    const allItems = [
      ...courseRows.map(r => ({ id: r.id, title: r.title, type: "COURSE" as const, bookmark_count: r.bookmark_count })),
      ...bookRows.map(r => ({ id: r.id, title: r.title, type: "BOOK" as const, bookmark_count: r.bookmark_count })),
      ...bundleRows.map(r => ({ id: r.id, title: r.title, type: "BUNDLE" as const, bookmark_count: r.bookmark_count })),
    ].sort((a, b) => b.bookmark_count - a.bookmark_count).slice(offset, offset + limit);

    const courseCount = byType.find(t => t.bookmark_type === "COURSE")?.count ?? 0;
    const bookCount = byType.find(t => t.bookmark_type === "BOOK")?.count ?? 0;
    const bundleCount = byType.find(t => t.bookmark_type === "BUNDLE")?.count ?? 0;

    const totalItems = courseRows.length + bookRows.length + bundleRows.length;

    const useMonthly = this.isLifetimeRange(sd, ed);
    const dailyBookmarks = useMonthly
      ? await db.selectFrom("member_bookmarks")
          .select([sql<string>`to_char(date_trunc('month', created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`created_at >= ${sd}::date`)
          .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date_trunc('month', created_at)`)
          .orderBy(sql`date_trunc('month', created_at)`)
          .execute()
      : await db.selectFrom("member_bookmarks")
          .select([sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"), sql<number>`count(*)::int`.as("count")])
          .where("tenant_id", "=", tenantId)
          .where(sql<boolean>`created_at >= ${sd}::date`)
          .where(sql<boolean>`created_at < (${ed}::date + interval '1 day')`)
          .groupBy(sql`date(created_at)`)
          .orderBy(sql`date(created_at)`)
          .execute();

    return {
      total_bookmarks: summary.total,
      course_bookmarks: courseCount,
      book_bookmarks: bookCount,
      bundle_bookmarks: bundleCount,
      items: allItems,
      total: totalItems,
      daily_bookmarks: dailyBookmarks.map(r => ({ date: String(r.date).slice(0, 10), count: r.count })),
    };
  }

  async getBookmarkDetails(tenantId: string, startDate?: string, endDate?: string, page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;
    const sd = startDate || "1970-01-01";
    const ed = endDate || "2099-12-31";

    let query = db.selectFrom("member_bookmarks as mb")
      .innerJoin("tenant_members as m", "m.id", "mb.tenant_member_id")
      .leftJoin("courses as c", "c.id", "mb.course_id")
      .leftJoin("books as b", "b.id", "mb.book_id")
      .leftJoin("bundles as bu", "bu.id", "mb.bundle_id")
      .select([
        "mb.id", "mb.bookmark_type", "mb.created_at",
        "m.name as member_name", "m.email as member_email",
        sql<string>`coalesce(c.title, b.title, bu.title, 'Unknown')`.as("item_title"),
      ])
      .where("mb.tenant_id", "=", tenantId)
      .where(sql<boolean>`mb.created_at >= ${sd}::date`)
      .where(sql<boolean>`mb.created_at < (${ed}::date + interval '1 day')`);

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(coalesce(c.title, '')) like ${term} or lower(coalesce(b.title, '')) like ${term} or lower(coalesce(bu.title, '')) like ${term})`);
    }

    const rows = await query.orderBy("mb.created_at", "desc").limit(limit).offset(offset).execute();

    let countQuery = db.selectFrom("member_bookmarks as mb")
      .innerJoin("tenant_members as m", "m.id", "mb.tenant_member_id")
      .leftJoin("courses as c", "c.id", "mb.course_id")
      .leftJoin("books as b", "b.id", "mb.book_id")
      .leftJoin("bundles as bu", "bu.id", "mb.bundle_id")
      .select(sql<number>`count(*)::int`.as("total"))
      .where("mb.tenant_id", "=", tenantId)
      .where(sql<boolean>`mb.created_at >= ${sd}::date`)
      .where(sql<boolean>`mb.created_at < (${ed}::date + interval '1 day')`);
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      countQuery = countQuery.where(sql<boolean>`(lower(m.name) like ${term} or lower(coalesce(m.email, '')) like ${term} or lower(coalesce(c.title, '')) like ${term} or lower(coalesce(b.title, '')) like ${term} or lower(coalesce(bu.title, '')) like ${term})`);
    }
    const total = (await countQuery.executeTakeFirstOrThrow()).total;

    return {
      items: rows.map(r => ({
        id: r.id,
        bookmark_type: r.bookmark_type,
        member_name: r.member_name,
        member_email: r.member_email,
        item_title: r.item_title,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
      total,
    };
  }
  /**
   * Master per-user progress table (cohort analytics). ONE row per member with
   * course-wise progress + quiz avg + assignment completion + watch time + last
   * active, so an admin can see how the whole cohort is performing on one screen.
   *
   * Page-bounded to avoid an N+1: we first pick the member PAGE (window-count +
   * ILIKE search, mirroring getUsersAnalytics), then aggregate progress/quiz/
   * assignment ONLY for those members via LEFT JOIN subqueries. Every aggregate
   * hits an existing index:
   *   member_lecture_progress(tenant_id, tenant_member_id, course_id),
   *   enrollments(tenant_id, tenant_member_id, status),
   *   quiz_attempts(tenant_id, tenant_member_id, quiz_id),
   *   assignment_submissions(tenant_id, tenant_member_id).
   *
   * Progress % is lecture-completion based (completed_lectures / total_lectures),
   * matching what the per-member Course Analytics drill-down already shows.
   * Counts come back as strings (::int / bigint), the service parses them.
   */
  async getUsersProgressAnalytics(
    tenantId: string,
    opts: UsersProgressOptions = {}
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
    const offset = (page - 1) * limit;
    const searchTerm = opts.search?.trim()
      ? `%${opts.search.trim().toLowerCase()}%`
      : null;
    const courseId = opts.courseId?.trim() || null;

    // Sort whitelist → concrete ORDER BY expression. Anything unknown falls back
    // to overall progress desc (the headline metric for a cohort view).
    const dir = opts.sortOrder === "asc" ? sql`asc` : sql`desc`;
    const sortExpr = (() => {
      switch (opts.sortBy) {
        case "name":
          return sql`lower(coalesce(m.name, m.email, '')) ${dir}`;
        case "quiz_avg":
          return sql`quiz_avg ${dir} nulls last`;
        case "assignment_pct":
          return sql`assignment_pct ${dir} nulls last`;
        case "total_watch_seconds":
          return sql`total_watch_seconds ${dir}`;
        case "last_active":
          return sql`last_active ${dir} nulls last`;
        case "courses_enrolled":
          return sql`courses_enrolled ${dir}`;
        case "overall_progress_pct":
        default:
          return sql`overall_progress_pct ${dir} nulls last`;
      }
    })();

    // Per-course lecture totals for THIS tenant (used to compute completion %).
    // course_id → total_lectures. Reuses the lectures→sections chain implicitly
    // via lectures.course_id (a lecture is always scoped to a course).
    const rows = await sql<{
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      status: string;
      joined_at: Date | null;
      last_login_at: Date | null;
      courses_enrolled: string;
      courses_completed: string;
      total_lectures: string;
      completed_lectures: string;
      overall_progress_pct: string | null;
      total_watch_seconds: string;
      quiz_avg: string | null;
      quizzes_taken: string;
      assignments_total: string;
      assignments_submitted: string;
      assignment_pct: string | null;
      last_active: Date | null;
      total_count: string;
    }>`
      WITH member_page AS (
        SELECT
          m.id, m.name, m.email, m.phone, m.status::text AS status,
          m.joined_at, m.last_login_at,
          count(*) OVER () AS total_count
        FROM tenant_members m
        WHERE m.tenant_id = ${tenantId}
        ${
          searchTerm
            ? sql`AND (lower(m.name) LIKE ${searchTerm} OR lower(coalesce(m.email, '')) LIKE ${searchTerm})`
            : sql``
        }
        ${
          courseId
            ? sql`AND EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.tenant_member_id = m.id
                  AND e.tenant_id = ${tenantId}
                  AND e.course_id = ${courseId}
                  AND e.status <> 'CANCELLED'
              )`
            : sql``
        }
        ORDER BY m.joined_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ),
      -- Non-cancelled enrollments for the page's members, with per-course lecture totals.
      enr AS (
        SELECT
          e.tenant_member_id,
          e.course_id,
          coalesce(clt.total_lectures, 0) AS total_lectures
        FROM enrollments e
        JOIN member_page mp ON mp.id = e.tenant_member_id
        LEFT JOIN (
          SELECT l.course_id, count(l.id) AS total_lectures
          FROM lectures l
          WHERE l.tenant_id = ${tenantId}
          GROUP BY l.course_id
        ) clt ON clt.course_id = e.course_id
        WHERE e.tenant_id = ${tenantId} AND e.status <> 'CANCELLED'
      ),
      -- Per-(member,course) lecture progress for the page's members.
      prog AS (
        SELECT
          mlp.tenant_member_id,
          mlp.course_id,
          count(*) FILTER (WHERE mlp.completed = true) AS completed_lectures,
          coalesce(sum(mlp.total_watch_seconds), 0) AS total_watch_seconds,
          max(mlp.last_watched_at) AS last_watched_at
        FROM member_lecture_progress mlp
        JOIN member_page mp ON mp.id = mlp.tenant_member_id
        WHERE mlp.tenant_id = ${tenantId}
        GROUP BY mlp.tenant_member_id, mlp.course_id
      ),
      -- Roll enrollment + progress up to ONE row per member.
      course_rollup AS (
        SELECT
          enr.tenant_member_id,
          count(*) AS courses_enrolled,
          count(*) FILTER (
            WHERE enr.total_lectures > 0
              AND coalesce(pr.completed_lectures, 0) >= enr.total_lectures
          ) AS courses_completed,
          sum(enr.total_lectures) AS total_lectures,
          sum(least(coalesce(pr.completed_lectures, 0), enr.total_lectures)) AS completed_lectures,
          coalesce(sum(pr.total_watch_seconds), 0) AS total_watch_seconds,
          max(pr.last_watched_at) AS last_watched_at
        FROM enr
        LEFT JOIN prog pr
          ON pr.tenant_member_id = enr.tenant_member_id
         AND pr.course_id = enr.course_id
        GROUP BY enr.tenant_member_id
      ),
      -- Quiz average: best % per (member,quiz) over PUBLISHED quizzes in enrolled
      -- courses, then averaged per member.
      quiz_rollup AS (
        SELECT
          bq.tenant_member_id,
          round(avg(bq.best_pct)) AS quiz_avg,
          count(*) AS quizzes_taken
        FROM (
          SELECT
            qa.tenant_member_id,
            qa.quiz_id,
            max(CASE WHEN qa.total_marks > 0
              THEN round(qa.score::numeric / qa.total_marks * 100) ELSE 0 END) AS best_pct
          FROM quiz_attempts qa
          JOIN member_page mp ON mp.id = qa.tenant_member_id
          JOIN quizzes q ON q.id = qa.quiz_id AND q.tenant_id = ${tenantId} AND q.status = 'PUBLISHED'
          WHERE qa.tenant_id = ${tenantId}
          GROUP BY qa.tenant_member_id, qa.quiz_id
        ) bq
        GROUP BY bq.tenant_member_id
      ),
      -- Assignment completion: submitted vs total PUBLISHED assignments in the
      -- member's enrolled (non-cancelled) courses.
      assign_total AS (
        SELECT enr.tenant_member_id, count(*) AS assignments_total
        FROM enr
        JOIN assignments a
          ON a.course_id = enr.course_id AND a.tenant_id = ${tenantId} AND a.status = 'PUBLISHED'
        GROUP BY enr.tenant_member_id
      ),
      assign_done AS (
        SELECT s.tenant_member_id, count(DISTINCT s.assignment_id) AS assignments_submitted
        FROM assignment_submissions s
        JOIN member_page mp ON mp.id = s.tenant_member_id
        JOIN assignments a
          ON a.id = s.assignment_id AND a.tenant_id = ${tenantId} AND a.status = 'PUBLISHED'
        WHERE s.tenant_id = ${tenantId}
        GROUP BY s.tenant_member_id
      )
      SELECT
        m.id, m.name, m.email, m.phone, m.status, m.joined_at, m.last_login_at,
        coalesce(cr.courses_enrolled, 0) AS courses_enrolled,
        coalesce(cr.courses_completed, 0) AS courses_completed,
        coalesce(cr.total_lectures, 0) AS total_lectures,
        coalesce(cr.completed_lectures, 0) AS completed_lectures,
        CASE WHEN coalesce(cr.total_lectures, 0) > 0
          THEN round(cr.completed_lectures::numeric / cr.total_lectures * 100)
          ELSE 0 END AS overall_progress_pct,
        coalesce(cr.total_watch_seconds, 0) AS total_watch_seconds,
        qr.quiz_avg AS quiz_avg,
        coalesce(qr.quizzes_taken, 0) AS quizzes_taken,
        coalesce(at.assignments_total, 0) AS assignments_total,
        coalesce(ad.assignments_submitted, 0) AS assignments_submitted,
        CASE WHEN coalesce(at.assignments_total, 0) > 0
          THEN round(coalesce(ad.assignments_submitted, 0)::numeric / at.assignments_total * 100)
          ELSE NULL END AS assignment_pct,
        coalesce(cr.last_watched_at, m.last_login_at) AS last_active,
        m.total_count
      FROM member_page m
      LEFT JOIN course_rollup cr ON cr.tenant_member_id = m.id
      LEFT JOIN quiz_rollup qr ON qr.tenant_member_id = m.id
      LEFT JOIN assign_total at ON at.tenant_member_id = m.id
      LEFT JOIN assign_done ad ON ad.tenant_member_id = m.id
      ORDER BY ${sortExpr}
    `.execute(db);

    const total = rows.rows[0]?.total_count
      ? parseInt(rows.rows[0].total_count, 10)
      : 0;

    return { rows: rows.rows, total, page, limit };
  }

  /**
   * Per-course progress breakdown for a SINGLE member, powers the inline
   * "expand a row" on the cohort table. One row per enrolled (non-cancelled)
   * course with lesson-completion, quiz (avg %, taken/total), and assignment
   * (submitted/total) progress. Single query, member-scoped, tenant-scoped.
   */
  async getMemberCourseProgressBreakdown(tenantId: string, memberId: string) {
    const rows = await sql<{
      course_id: string;
      course_title: string;
      course_slug: string;
      enrollment_status: string;
      enrolled_at: Date | null;
      total_lectures: string;
      completed_lectures: string;
      progress_pct: string;
      total_watch_seconds: string;
      last_active: Date | null;
      quizzes_total: string;
      quizzes_taken: string;
      quiz_avg: string | null;
      assignments_total: string;
      assignments_submitted: string;
    }>`
      WITH enr AS (
        SELECT e.course_id
        FROM enrollments e
        WHERE e.tenant_id = ${tenantId}
          AND e.tenant_member_id = ${memberId}
          AND e.status <> 'CANCELLED'
      ),
      lect AS (
        SELECT l.course_id, count(l.id) AS total_lectures
        FROM lectures l
        JOIN enr ON enr.course_id = l.course_id
        WHERE l.tenant_id = ${tenantId}
        GROUP BY l.course_id
      ),
      prog AS (
        SELECT
          mlp.course_id,
          count(*) FILTER (WHERE mlp.completed = true) AS completed_lectures,
          coalesce(sum(mlp.total_watch_seconds), 0) AS total_watch_seconds,
          max(mlp.last_watched_at) AS last_active
        FROM member_lecture_progress mlp
        JOIN enr ON enr.course_id = mlp.course_id
        WHERE mlp.tenant_id = ${tenantId} AND mlp.tenant_member_id = ${memberId}
        GROUP BY mlp.course_id
      ),
      -- Total PUBLISHED quizzes per enrolled course.
      quiz_tot AS (
        SELECT q.course_id, count(*) AS quizzes_total
        FROM quizzes q
        JOIN enr ON enr.course_id = q.course_id
        WHERE q.tenant_id = ${tenantId} AND q.status = 'PUBLISHED'
        GROUP BY q.course_id
      ),
      -- Best % per taken quiz, then per-course avg + count.
      quiz_taken AS (
        SELECT
          bq.course_id,
          count(*) AS quizzes_taken,
          round(avg(bq.best_pct)) AS quiz_avg
        FROM (
          SELECT
            qa.course_id,
            qa.quiz_id,
            max(CASE WHEN qa.total_marks > 0
              THEN round(qa.score::numeric / qa.total_marks * 100) ELSE 0 END) AS best_pct
          FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id AND q.tenant_id = ${tenantId} AND q.status = 'PUBLISHED'
          JOIN enr ON enr.course_id = qa.course_id
          WHERE qa.tenant_id = ${tenantId} AND qa.tenant_member_id = ${memberId}
          GROUP BY qa.course_id, qa.quiz_id
        ) bq
        GROUP BY bq.course_id
      ),
      assign_tot AS (
        SELECT a.course_id, count(*) AS assignments_total
        FROM assignments a
        JOIN enr ON enr.course_id = a.course_id
        WHERE a.tenant_id = ${tenantId} AND a.status = 'PUBLISHED'
        GROUP BY a.course_id
      ),
      assign_done AS (
        SELECT a.course_id, count(DISTINCT s.assignment_id) AS assignments_submitted
        FROM assignment_submissions s
        JOIN assignments a ON a.id = s.assignment_id AND a.tenant_id = ${tenantId} AND a.status = 'PUBLISHED'
        JOIN enr ON enr.course_id = a.course_id
        WHERE s.tenant_id = ${tenantId} AND s.tenant_member_id = ${memberId}
        GROUP BY a.course_id
      )
      SELECT
        c.id AS course_id,
        c.title AS course_title,
        c.slug AS course_slug,
        e.status::text AS enrollment_status,
        e.enrolled_at,
        coalesce(lt.total_lectures, 0) AS total_lectures,
        coalesce(pr.completed_lectures, 0) AS completed_lectures,
        CASE WHEN coalesce(lt.total_lectures, 0) > 0
          THEN round(least(coalesce(pr.completed_lectures, 0), lt.total_lectures)::numeric / lt.total_lectures * 100)
          ELSE 0 END AS progress_pct,
        coalesce(pr.total_watch_seconds, 0) AS total_watch_seconds,
        pr.last_active,
        coalesce(qt.quizzes_total, 0) AS quizzes_total,
        coalesce(qk.quizzes_taken, 0) AS quizzes_taken,
        qk.quiz_avg AS quiz_avg,
        coalesce(at.assignments_total, 0) AS assignments_total,
        coalesce(ad.assignments_submitted, 0) AS assignments_submitted
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id AND c.tenant_id = ${tenantId}
      LEFT JOIN lect lt ON lt.course_id = c.id
      LEFT JOIN prog pr ON pr.course_id = c.id
      LEFT JOIN quiz_tot qt ON qt.course_id = c.id
      LEFT JOIN quiz_taken qk ON qk.course_id = c.id
      LEFT JOIN assign_tot at ON at.course_id = c.id
      LEFT JOIN assign_done ad ON ad.course_id = c.id
      WHERE e.tenant_id = ${tenantId}
        AND e.tenant_member_id = ${memberId}
        AND e.status <> 'CANCELLED'
      ORDER BY pr.last_active DESC NULLS LAST, e.enrolled_at DESC
    `.execute(db);

    return rows.rows;
  }

  /**
   * The inverse of getMemberCourseProgressBreakdown: for ONE course, every
   * enrolled (non-cancelled) member with their IN-THAT-COURSE progress. This is
   * what the per-course export sheets need, metrics scoped to the single
   * course, NOT a member's across-all-courses rollup.
   *
   * The course's lecture/quiz/assignment totals are computed once (they're the
   * same for every learner); per-member progress joins are all scoped to this
   * course_id.
   */
  async getCourseLearnerProgress(tenantId: string, courseId: string) {
    const rows = await sql<{
      member_id: string;
      name: string;
      email: string | null;
      status: string;
      enrollment_status: string;
      enrolled_at: Date | null;
      total_lectures: string;
      completed_lectures: string;
      progress_pct: string;
      total_watch_seconds: string;
      last_active: Date | null;
      quizzes_total: string;
      quizzes_taken: string;
      quiz_avg: string | null;
      assignments_total: string;
      assignments_submitted: string;
    }>`
      WITH members AS (
        SELECT e.tenant_member_id AS member_id, e.status::text AS enrollment_status, e.enrolled_at
        FROM enrollments e
        WHERE e.tenant_id = ${tenantId}
          AND e.course_id = ${courseId}
          AND e.status <> 'CANCELLED'
      ),
      -- Course-wide totals (identical for every learner on this course).
      course_lectures AS (
        SELECT count(*) AS total_lectures
        FROM lectures l
        WHERE l.tenant_id = ${tenantId} AND l.course_id = ${courseId}
      ),
      course_quizzes AS (
        SELECT count(*) AS quizzes_total
        FROM quizzes q
        WHERE q.tenant_id = ${tenantId} AND q.course_id = ${courseId} AND q.status = 'PUBLISHED'
      ),
      course_assignments AS (
        SELECT count(*) AS assignments_total
        FROM assignments a
        WHERE a.tenant_id = ${tenantId} AND a.course_id = ${courseId} AND a.status = 'PUBLISHED'
      ),
      -- Per-member progress on this course only.
      prog AS (
        SELECT
          mlp.tenant_member_id AS member_id,
          count(*) FILTER (WHERE mlp.completed = true) AS completed_lectures,
          coalesce(sum(mlp.total_watch_seconds), 0) AS total_watch_seconds,
          max(mlp.last_watched_at) AS last_active
        FROM member_lecture_progress mlp
        JOIN members m ON m.member_id = mlp.tenant_member_id
        WHERE mlp.tenant_id = ${tenantId} AND mlp.course_id = ${courseId}
        GROUP BY mlp.tenant_member_id
      ),
      -- Best % per taken quiz, then per-member avg + count (this course only).
      quiz_taken AS (
        SELECT
          bq.member_id,
          count(*) AS quizzes_taken,
          round(avg(bq.best_pct)) AS quiz_avg
        FROM (
          SELECT
            qa.tenant_member_id AS member_id,
            qa.quiz_id,
            max(CASE WHEN qa.total_marks > 0
              THEN round(qa.score::numeric / qa.total_marks * 100) ELSE 0 END) AS best_pct
          FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id AND q.tenant_id = ${tenantId} AND q.status = 'PUBLISHED'
          JOIN members m ON m.member_id = qa.tenant_member_id
          WHERE qa.tenant_id = ${tenantId} AND qa.course_id = ${courseId}
          GROUP BY qa.tenant_member_id, qa.quiz_id
        ) bq
        GROUP BY bq.member_id
      ),
      assign_done AS (
        SELECT s.tenant_member_id AS member_id, count(DISTINCT s.assignment_id) AS assignments_submitted
        FROM assignment_submissions s
        JOIN assignments a ON a.id = s.assignment_id AND a.tenant_id = ${tenantId}
          AND a.course_id = ${courseId} AND a.status = 'PUBLISHED'
        JOIN members m ON m.member_id = s.tenant_member_id
        WHERE s.tenant_id = ${tenantId}
        GROUP BY s.tenant_member_id
      )
      SELECT
        m.member_id,
        tm.name,
        tm.email,
        tm.status::text AS status,
        m.enrollment_status,
        m.enrolled_at,
        (SELECT total_lectures FROM course_lectures) AS total_lectures,
        coalesce(pr.completed_lectures, 0) AS completed_lectures,
        CASE WHEN (SELECT total_lectures FROM course_lectures) > 0
          THEN round(least(coalesce(pr.completed_lectures, 0), (SELECT total_lectures FROM course_lectures))::numeric
            / (SELECT total_lectures FROM course_lectures) * 100)
          ELSE 0 END AS progress_pct,
        coalesce(pr.total_watch_seconds, 0) AS total_watch_seconds,
        pr.last_active,
        (SELECT quizzes_total FROM course_quizzes) AS quizzes_total,
        coalesce(qk.quizzes_taken, 0) AS quizzes_taken,
        qk.quiz_avg AS quiz_avg,
        (SELECT assignments_total FROM course_assignments) AS assignments_total,
        coalesce(ad.assignments_submitted, 0) AS assignments_submitted
      FROM members m
      JOIN tenant_members tm ON tm.id = m.member_id AND tm.tenant_id = ${tenantId}
      LEFT JOIN prog pr ON pr.member_id = m.member_id
      LEFT JOIN quiz_taken qk ON qk.member_id = m.member_id
      LEFT JOIN assign_done ad ON ad.member_id = m.member_id
      ORDER BY progress_pct DESC, pr.last_active DESC NULLS LAST, tm.name ASC
    `.execute(db);

    return rows.rows;
  }

  /**
   * One row per (learner x course), for the admin's roster export.
   *
   * WHY THIS EXISTS SEPARATELY FROM getUsersAnalytics
   * -------------------------------------------------
   * The "Enrollments" export used to call getUsersAnalytics and label its
   * columns member_name / course_title / enrolled_at. Those keys do not exist
   * on a member row, it carries name / email / phone, so the file came out
   * with four headers and every cell blank, and `status` silently meant the
   * MEMBER's status rather than the enrolment's. A member list also cannot
   * answer "who is on which course", because one member collapses to one row
   * however many courses they hold.
   *
   * This returns the grain the question actually needs: the enrolment. A
   * learner on three courses is three rows, so the sheet can be filtered or
   * pivoted by course, and counting rows per course gives the headcount.
   *
   * `valid_till` is the access expiry the admin asked for. NULL means access
   * does not expire, which the export renders as "Lifetime" rather than as an
   * empty cell, because blank reads as missing data.
   */
  async getEnrolmentRosterForExport(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    limit = 10000,
    search?: string
  ) {
    let query = db
      .selectFrom("enrollments as e")
      .innerJoin("tenant_members as m", (join) =>
        join.onRef("m.id", "=", "e.tenant_member_id").on("m.tenant_id", "=", tenantId)
      )
      .innerJoin("courses as c", (join) =>
        join.onRef("c.id", "=", "e.course_id").on("c.tenant_id", "=", tenantId)
      )
      .select([
        "c.title as course_title",
        "c.mode as course_mode",
        "m.name as member_name",
        "m.email as member_email",
        "m.phone as member_phone",
        "e.status as enrollment_status",
        "e.source as enrollment_source",
        "e.enrolled_at as enrolled_at",
        "e.valid_till as valid_till",
        "e.completed_at as completed_at",
        "m.status as member_status",
        "m.joined_at as joined_at",
      ])
      // Tenant scoping on the driving table too, not only on the joins: the
      // joins narrow the members and courses, and this narrows the enrolments.
      .where("e.tenant_id", "=", tenantId);

    // The date window filters the ENROLMENT, which is what an admin means by
    // "who joined this course last month", not when the member signed up.
    if (startDate) query = query.where("e.enrolled_at", ">=", new Date(startDate));
    if (endDate) query = query.where("e.enrolled_at", "<=", new Date(endDate));

    if (search?.trim()) {
      const needle = `%${search.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("m.name", "ilike", needle),
          eb("m.email", "ilike", needle),
          eb("c.title", "ilike", needle),
        ])
      );
    }

    // Grouped by course so the sheet reads as a roster per course rather than
    // an interleaved list, then by learner name within each course.
    return query
      .orderBy("c.title", "asc")
      .orderBy("m.name", "asc")
      .limit(limit)
      .execute();
  }

}

export default new AnalyticsRepository();
