import { ulid } from "ulid";
import type { Selectable, Transaction } from "kysely";
import { sql } from "kysely";
import { db } from "../db/connection";
import type { DB, coupons, coupon_applicable_items } from "../db/types";

export type CouponRow = Selectable<coupons>;
export type CouponApplicableItemRow = Selectable<coupon_applicable_items>;

export interface CouponListParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

export interface CouponListResult {
  coupons: CouponRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCouponApplicableItem {
  item_type: string;
  course_id?: string | null;
  book_id?: string | null;
  bundle_id?: string | null;
  batch_id?: string | null;
  test_series_id?: string | null;
}

export interface CreateCouponInput {
  code: string;
  discount_type: string;
  discount_value: number;
  valid_from: Date;
  valid_to?: Date | null;
  max_uses?: number | null;
  max_uses_per_user?: number | null;
  is_public?: boolean;
  /** ISO 4217 code a FIXED amount is denominated in; null for PERCENTAGE. */
  currency?: string | null;
  applicable_items?: CreateCouponApplicableItem[];
}

export interface DetailedAnalyticsResult {
  total_redemptions: number;
  unique_users: number;
  total_discount_by_currency: Array<{ currency: string; total: number }>;
  avg_discount_by_currency: Array<{ currency: string; avg: number }>;
  usage_rate: number | null;
  revenue_impact: Array<{
    currency: string;
    total_original_amount: number;
    total_discounted_amount: number;
    total_discount: number;
  }>;
  daily_redemptions: Array<{ date: string; count: number }>;
  item_breakdown: Array<{
    order_type: string;
    item_id: string;
    item_name: string;
    redemption_count: number;
    total_discount: number;
  }>;
  top_users: Array<{
    member_id: string;
    name: string;
    email: string;
    redemption_count: number;
    total_discount: number;
  }>;
  applicable_items: Array<{
    item_type: string;
    item_id: string;
    item_name: string;
  }>;
}

class CouponsRepository {
  async findAll(tenantId: string, params: CouponListParams, trx?: Transaction<DB>): Promise<CouponListResult> {
    const conn = trx || db;
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = conn.selectFrom("coupons").selectAll().where("tenant_id", "=", tenantId);
    let countQuery = conn
      .selectFrom("coupons")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);

    if (params.isActive !== undefined) {
      query = query.where("is_active", "=", params.isActive);
      countQuery = countQuery.where("is_active", "=", params.isActive);
    }
    if (params.search) {
      query = query.where("code", "like", `%${params.search.toUpperCase()}%`);
      countQuery = countQuery.where("code", "like", `%${params.search.toUpperCase()}%`);
    }

    const [couponsList, countResult] = await Promise.all([
      query.orderBy("created_at", "desc").limit(limit).offset(offset).execute(),
      countQuery.executeTakeFirst(),
    ]);

    const total =
      typeof countResult?.count === "string"
        ? parseInt(countResult.count, 10)
        : Number(countResult?.count ?? 0);

    return { coupons: couponsList, total, page, limit };
  }

  async findById(tenantId: string, id: string, trx?: Transaction<DB>): Promise<CouponRow | undefined> {
    return (trx || db)
      .selectFrom("coupons")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async findByCode(tenantId: string, code: string, trx?: Transaction<DB>): Promise<CouponRow | undefined> {
    return (trx || db)
      .selectFrom("coupons")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("code", "=", code)
      .executeTakeFirst();
  }

  async findApplicableItems(
    tenantId: string,
    couponId: string,
    trx?: Transaction<DB>,
  ): Promise<CouponApplicableItemRow[]> {
    return (trx || db)
      .selectFrom("coupon_applicable_items")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("coupon_id", "=", couponId)
      .execute();
  }

  async create(tenantId: string, input: CreateCouponInput, trx?: Transaction<DB>): Promise<CouponRow> {
    const conn = trx || db;
    const id = ulid();
    const now = new Date();

    const coupon = await conn
      .insertInto("coupons")
      .values({
        id,
        tenant_id: tenantId,
        code: input.code.toUpperCase(),
        discount_type: input.discount_type as never,
        discount_value: input.discount_value as never,
        valid_from: input.valid_from,
        valid_to: input.valid_to ?? null,
        max_uses: input.max_uses ?? null,
        max_uses_per_user: input.max_uses_per_user ?? null,
        used_count: 0,
        is_active: true,
        is_public: input.is_public ?? true,
        currency: input.currency ?? null,
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (input.applicable_items && input.applicable_items.length > 0) {
      await conn
        .insertInto("coupon_applicable_items")
        .values(
          input.applicable_items.map((item) => ({
            id: ulid(),
            tenant_id: tenantId,
            coupon_id: id,
            item_type: item.item_type as never,
            course_id: item.course_id ?? null,
            book_id: item.book_id ?? null,
            bundle_id: item.bundle_id ?? null,
            batch_id: item.batch_id ?? null,
            test_series_id: item.test_series_id ?? null,
            created_at: now,
            updated_at: now,
          } as never)),
        )
        .execute();
    }

    return coupon;
  }

  async update(
    tenantId: string,
    id: string,
    input: Partial<Omit<CreateCouponInput, "applicable_items">>,
    trx?: Transaction<DB>,
  ): Promise<CouponRow | undefined> {
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (input.code !== undefined) updateData.code = input.code.toUpperCase();
    if (input.discount_type !== undefined) updateData.discount_type = input.discount_type;
    if (input.discount_value !== undefined) updateData.discount_value = input.discount_value;
    if (input.valid_from !== undefined) updateData.valid_from = input.valid_from;
    if ("valid_to" in input) updateData.valid_to = input.valid_to ?? null;
    if ("max_uses" in input) updateData.max_uses = input.max_uses ?? null;
    if ("max_uses_per_user" in input) updateData.max_uses_per_user = input.max_uses_per_user ?? null;
    if (input.is_public !== undefined) updateData.is_public = input.is_public;
    if (input.currency !== undefined) updateData.currency = input.currency;

    return (trx || db)
      .updateTable("coupons")
      .set(updateData as never)
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }

  async syncApplicableItems(
    tenantId: string,
    couponId: string,
    items: CreateCouponApplicableItem[],
    trx?: Transaction<DB>,
  ): Promise<void> {
    const conn = trx || db;
    await conn
      .deleteFrom("coupon_applicable_items")
      .where("tenant_id", "=", tenantId)
      .where("coupon_id", "=", couponId)
      .execute();

    if (items.length > 0) {
      const now = new Date();
      await conn
        .insertInto("coupon_applicable_items")
        .values(
          items.map((item) => ({
            id: ulid(),
            tenant_id: tenantId,
            coupon_id: couponId,
            item_type: item.item_type as never,
            course_id: item.course_id ?? null,
            book_id: item.book_id ?? null,
            bundle_id: item.bundle_id ?? null,
            batch_id: item.batch_id ?? null,
            test_series_id: item.test_series_id ?? null,
            created_at: now,
            updated_at: now,
          } as never)),
        )
        .execute();
    }
  }

  async toggleActive(tenantId: string, id: string, trx?: Transaction<DB>): Promise<CouponRow | undefined> {
    const coupon = await this.findById(tenantId, id, trx);
    if (!coupon) return undefined;
    return (trx || db)
      .updateTable("coupons")
      .set({ is_active: !coupon.is_active, updated_at: new Date() } as never)
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }

  async delete(tenantId: string, id: string, trx?: Transaction<DB>): Promise<void> {
    await (trx || db)
      .deleteFrom("coupons")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .execute();
  }

  async getAnalytics(
    tenantId: string,
    couponId: string,
    trx?: Transaction<DB>,
  ): Promise<{
    total_redemptions: number;
    unique_users: number;
    total_discount_by_currency: Array<{ currency: string; total: number }>;
  }> {
    const conn = trx || db;

    const [statsResult, discountResult] = await Promise.all([
      conn
        .selectFrom("coupon_redemptions")
        .select([
          sql<string>`count(*)`.as("total_redemptions"),
          sql<string>`count(distinct member_id)`.as("unique_users"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("coupon_id", "=", couponId)
        .executeTakeFirst(),
      conn
        .selectFrom("coupon_redemptions")
        .select([
          "currency",
          sql<string>`sum(discount_amount::numeric)`.as("total"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("coupon_id", "=", couponId)
        .groupBy("currency")
        .execute(),
    ]);

    return {
      total_redemptions:
        typeof statsResult?.total_redemptions === "string"
          ? parseInt(statsResult.total_redemptions, 10)
          : Number(statsResult?.total_redemptions ?? 0),
      unique_users:
        typeof statsResult?.unique_users === "string"
          ? parseInt(statsResult.unique_users, 10)
          : Number(statsResult?.unique_users ?? 0),
      total_discount_by_currency: discountResult.map((row) => ({
        currency: row.currency,
        total:
          typeof row.total === "string"
            ? parseFloat(row.total)
            : Number(row.total ?? 0),
      })),
    };
  }

  async getRedemptions(
    tenantId: string,
    couponId: string,
    page: number,
    limit: number,
    trx?: Transaction<DB>,
  ): Promise<{
    redemptions: Array<{
      id: string;
      member_name: string;
      member_email: string;
      discount_amount: string;
      currency: string;
      order_id: string;
      created_at: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const conn = trx || db;
    const offset = (page - 1) * limit;

    const [redemptionsList, countResult] = await Promise.all([
      conn
        .selectFrom("coupon_redemptions")
        .innerJoin(
          "tenant_members",
          "tenant_members.id",
          "coupon_redemptions.member_id",
        )
        .select([
          "coupon_redemptions.id",
          "tenant_members.name as member_name",
          "tenant_members.email as member_email",
          "coupon_redemptions.discount_amount",
          "coupon_redemptions.currency",
          "coupon_redemptions.order_id",
          "coupon_redemptions.created_at",
        ])
        .where("coupon_redemptions.tenant_id", "=", tenantId)
        .where("coupon_redemptions.coupon_id", "=", couponId)
        .orderBy("coupon_redemptions.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      conn
        .selectFrom("coupon_redemptions")
        .select(sql<string>`count(*)`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("coupon_id", "=", couponId)
        .executeTakeFirst(),
    ]);

    const total =
      typeof countResult?.count === "string"
        ? parseInt(countResult.count, 10)
        : Number(countResult?.count ?? 0);

    return {
      redemptions: redemptionsList.map((r) => ({
        id: r.id,
        member_name: r.member_name,
        member_email: r.member_email ?? "",
        discount_amount: r.discount_amount,
        currency: r.currency,
        order_id: r.order_id,
        created_at: r.created_at as Date,
      })),
      total,
      page,
      limit,
    };
  }
  async getDetailedAnalytics(
    tenantId: string,
    couponId: string,
    maxUses: number | null,
    usedCount: number,
    trx?: Transaction<DB>,
  ): Promise<DetailedAnalyticsResult> {
    const conn = trx || db;

    const [statsResult, discountResult, avgResult, revenueImpact, dailyRedemptions, itemBreakdown, topUsers, applicableItemsRaw] =
      await Promise.all([
        // 1. Basic stats
        conn
          .selectFrom("coupon_redemptions")
          .select([
            sql<string>`count(*)`.as("total_redemptions"),
            sql<string>`count(distinct member_id)`.as("unique_users"),
          ])
          .where("tenant_id", "=", tenantId)
          .where("coupon_id", "=", couponId)
          .executeTakeFirst(),

        // 2. Total discount by currency
        conn
          .selectFrom("coupon_redemptions")
          .select([
            "currency",
            sql<string>`sum(discount_amount::numeric)`.as("total"),
          ])
          .where("tenant_id", "=", tenantId)
          .where("coupon_id", "=", couponId)
          .groupBy("currency")
          .execute(),

        // 3. Avg discount by currency
        conn
          .selectFrom("coupon_redemptions")
          .select([
            "currency",
            sql<string>`avg(discount_amount::numeric)`.as("avg"),
          ])
          .where("tenant_id", "=", tenantId)
          .where("coupon_id", "=", couponId)
          .groupBy("currency")
          .execute(),

        // 4. Revenue impact (join with payment_orders)
        conn
          .selectFrom("coupon_redemptions as cr")
          .innerJoin("payment_orders as po", (join) =>
            join.onRef("po.id", "=", "cr.order_id").onRef("po.tenant_id", "=", "cr.tenant_id"),
          )
          .select([
            "po.currency",
            sql<string>`coalesce(sum(po.base_amount::numeric), 0)`.as("total_original_amount"),
            sql<string>`coalesce(sum(po.net_amount::numeric), 0)`.as("total_discounted_amount"),
            sql<string>`coalesce(sum(po.discount_amount::numeric), 0)`.as("total_discount"),
          ])
          .where("cr.tenant_id", "=", tenantId)
          .where("cr.coupon_id", "=", couponId)
          .where("po.status", "=", "PAID")
          .groupBy("po.currency")
          .execute(),

        // 5. Daily redemptions timeline
        conn
          .selectFrom("coupon_redemptions")
          .select([
            sql<string>`to_char(date(created_at), 'YYYY-MM-DD')`.as("date"),
            sql<number>`count(*)::int`.as("count"),
          ])
          .where("tenant_id", "=", tenantId)
          .where("coupon_id", "=", couponId)
          .groupBy(sql`date(created_at)`)
          .orderBy(sql`date(created_at)`)
          .execute(),

        // 6. Item breakdown (which items were purchased with this coupon).
        //
        // A CART redemption carries `item_id = 'cart'`, so matching order_type +
        // item_id alone collapses every cart redemption into a single "Unknown"
        // row. Resolve the item from `cart_order_items` for those, and attribute
        // the coupon's discount to the line that actually carried it, cart
        // coupons are per-line (`cart_order_items.coupon_id`).
        sql<{
          order_type: string;
          item_id: string;
          item_name: string;
          redemption_count: number;
          total_discount: string;
        }>`
          with redeemed as (
            select po.order_type::text as order_type, po.item_id,
                   cr.discount_amount
              from coupon_redemptions cr
              join payment_orders po
                on po.id = cr.order_id and po.tenant_id = cr.tenant_id
             where cr.tenant_id = ${tenantId} and cr.coupon_id = ${couponId}
               and po.status = 'PAID' and po.order_type <> 'CART'
            union all
            select coi.item_type::text,
                   coalesce(coi.course_id, coi.book_id, coi.bundle_id, coi.batch_id),
                   coi.discount_amount
              from coupon_redemptions cr
              join payment_orders po
                on po.id = cr.order_id and po.tenant_id = cr.tenant_id
              join cart_order_items coi
                on coi.order_id = po.id and coi.coupon_id = cr.coupon_id
             where cr.tenant_id = ${tenantId} and cr.coupon_id = ${couponId}
               and po.status = 'PAID' and po.order_type = 'CART'
          )
          select r.order_type, r.item_id,
                 coalesce(c.title, b.title, bun.title, bat.title, ts.title, 'Unknown') as item_name,
                 count(*)::int as redemption_count,
                 coalesce(sum(r.discount_amount::numeric), 0) as total_discount
            from redeemed r
            left join courses c on c.id = r.item_id and r.order_type = 'COURSE'
            left join books b on b.id = r.item_id and r.order_type = 'BOOK'
            left join bundles bun on bun.id = r.item_id and r.order_type = 'BUNDLE'
            left join batches bat on bat.id = r.item_id and r.order_type = 'BATCH'
            left join test_series ts on ts.id = r.item_id and r.order_type = 'TEST_SERIES'
           group by r.order_type, r.item_id, 3
           order by redemption_count desc
           limit 20
        `.execute(conn).then((res) => res.rows),

        // 7. Top users
        conn
          .selectFrom("coupon_redemptions as cr")
          .innerJoin("tenant_members as tm", "tm.id", "cr.member_id")
          .select([
            "tm.id as member_id",
            "tm.name",
            "tm.email",
            sql<number>`count(*)::int`.as("redemption_count"),
            sql<string>`coalesce(sum(cr.discount_amount::numeric), 0)`.as("total_discount"),
          ])
          .where("cr.tenant_id", "=", tenantId)
          .where("cr.coupon_id", "=", couponId)
          .groupBy(["tm.id", "tm.name", "tm.email"])
          .orderBy("redemption_count", "desc")
          .limit(10)
          .execute(),

        // 8. Applicable items with names (use FK presence for joins since item_type enum doesn't include every target)
        conn
          .selectFrom("coupon_applicable_items as cai")
          .leftJoin("courses as c", (join) =>
            join.on(sql<boolean>`cai.course_id is not null`).onRef("c.id", "=", "cai.course_id"),
          )
          .leftJoin("books as b", (join) =>
            join.on(sql<boolean>`cai.book_id is not null`).onRef("b.id", "=", "cai.book_id"),
          )
          .leftJoin("bundles as bun", (join) =>
            join.on(sql<boolean>`cai.bundle_id is not null`).onRef("bun.id", "=", "cai.bundle_id"),
          )
          .leftJoin("batches as bat", (join) =>
            join.on(sql<boolean>`cai.batch_id is not null`).onRef("bat.id", "=", "cai.batch_id"),
          )
          .leftJoin("test_series as ts", (join) =>
            join.on(sql<boolean>`cai.test_series_id is not null`).onRef("ts.id", "=", "cai.test_series_id"),
          )
          .select([
            sql<string>`case
              when cai.course_id is not null then 'COURSE'
              when cai.book_id is not null then 'BOOK'
              when cai.bundle_id is not null then 'BUNDLE'
              when cai.batch_id is not null then 'BATCH'
              when cai.test_series_id is not null then 'TEST_SERIES'
              else cai.item_type::text
            end`.as("item_type"),
            sql<string>`coalesce(cai.course_id, cai.book_id, cai.bundle_id, cai.batch_id, cai.test_series_id)`.as("item_id"),
            sql<string>`coalesce(c.title, b.title, bun.title, bat.title, ts.title, 'Unknown')`.as("item_name"),
          ])
          .where("cai.tenant_id", "=", tenantId)
          .where("cai.coupon_id", "=", couponId)
          .execute(),
      ]);

    const parseBigint = (val: unknown): number =>
      typeof val === "string" ? parseInt(val, 10) : Number(val ?? 0);
    const parseDecimal = (val: unknown): number =>
      typeof val === "string" ? parseFloat(val) : Number(val ?? 0);

    return {
      total_redemptions: parseBigint(statsResult?.total_redemptions),
      unique_users: parseBigint(statsResult?.unique_users),
      total_discount_by_currency: discountResult.map((r) => ({
        currency: r.currency,
        total: parseDecimal(r.total),
      })),
      avg_discount_by_currency: avgResult.map((r) => ({
        currency: r.currency,
        avg: Math.round(parseDecimal(r.avg) * 100) / 100,
      })),
      usage_rate: maxUses ? Math.round((usedCount / maxUses) * 10000) / 100 : null,
      revenue_impact: revenueImpact.map((r) => ({
        currency: r.currency,
        total_original_amount: parseDecimal(r.total_original_amount),
        total_discounted_amount: parseDecimal(r.total_discounted_amount),
        total_discount: parseDecimal(r.total_discount),
      })),
      daily_redemptions: dailyRedemptions.map((r) => ({
        date: String(r.date).slice(0, 10),
        count: r.count,
      })),
      item_breakdown: itemBreakdown.map((r) => ({
        order_type: r.order_type,
        item_id: r.item_id,
        item_name: String(r.item_name),
        redemption_count: r.redemption_count,
        total_discount: parseDecimal(r.total_discount),
      })),
      top_users: topUsers.map((r) => ({
        member_id: r.member_id,
        name: r.name,
        email: r.email ?? "",
        redemption_count: r.redemption_count,
        total_discount: parseDecimal(r.total_discount),
      })),
      applicable_items: applicableItemsRaw.map((r) => ({
        item_type: String(r.item_type),
        item_id: String(r.item_id ?? ""),
        item_name: String(r.item_name),
      })),
    };
  }
}

export default new CouponsRepository();
