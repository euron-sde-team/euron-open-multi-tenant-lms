import { sql } from "kysely";
import { db } from "../db/connection";
import {
  RevenueByOrderType,
  RevenueCurrencyBlock,
  RevenueQueryParams,
  SalesOrderListItem,
  SalesOrdersQueryParams,
  TenantRevenueSummary,
} from "../types/tenant-offerings.type";

const num = (v: unknown): number =>
  typeof v === "string" ? parseFloat(v) || 0 : Number(v ?? 0);
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : num(v);

const REFUND_STATUSES: ("REFUNDED" | "PARTIALLY_REFUNDED" | "REFUND_INITIATED")[] =
  ["REFUNDED", "PARTIALLY_REFUNDED", "REFUND_INITIATED"];

class TenantSalesRepository {
  // ============================================
  // ORDERS LIST
  // ============================================

  async listOrders(
    tenantId: string,
    params: SalesOrdersQueryParams
  ): Promise<{ items: SalesOrderListItem[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("payment_orders")
      .innerJoin(
        "tenant_members",
        "payment_orders.tenant_member_id",
        "tenant_members.id"
      )
      .select([
        "payment_orders.id",
        "payment_orders.order_number",
        "payment_orders.order_type",
        "payment_orders.item_id",
        "payment_orders.currency",
        "payment_orders.base_amount",
        "payment_orders.discount_amount",
        "payment_orders.net_amount",
        "payment_orders.tax_amount",
        "payment_orders.total_amount",
        "payment_orders.platform_fee",
        "payment_orders.tenant_payout_amount",
        "payment_orders.gateway_provider_name",
        "payment_orders.status",
        "payment_orders.created_at",
        "payment_orders.paid_at",
        "payment_orders.refunded_at",
        "tenant_members.name as buyer_name",
        "tenant_members.email as buyer_email",
      ])
      .where("payment_orders.tenant_id", "=", tenantId);
    let countQuery = db
      .selectFrom("payment_orders")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId);

    if (params.order_type) {
      query = query.where("payment_orders.order_type", "=", params.order_type as never);
      countQuery = countQuery.where("order_type", "=", params.order_type as never);
    }
    if (params.status) {
      query = query.where("payment_orders.status", "=", params.status as never);
      countQuery = countQuery.where("status", "=", params.status as never);
    }
    if (params.currency) {
      query = query.where("payment_orders.currency", "=", params.currency);
      countQuery = countQuery.where("currency", "=", params.currency);
    }
    if (params.start_date) {
      const d = new Date(params.start_date);
      query = query.where("payment_orders.created_at", ">=", d);
      countQuery = countQuery.where("created_at", ">=", d);
    }
    if (params.end_date) {
      const d = new Date(params.end_date);
      query = query.where("payment_orders.created_at", "<=", d);
      countQuery = countQuery.where("created_at", "<=", d);
    }
    if (params.search) {
      const pattern = `%${params.search}%`;
      query = query.where("payment_orders.order_number", "ilike", pattern);
      countQuery = countQuery.where("order_number", "ilike", pattern);
    }

    const [rows, countResult] = await Promise.all([
      query
        .orderBy("payment_orders.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    const titleMap = await this.resolveItemTitles(tenantId, rows);

    return {
      items: rows.map((r) => ({
        id: r.id,
        order_number: r.order_number,
        order_type: r.order_type as string,
        item_id: r.item_id,
        item_title: titleMap.get(`${r.order_type}:${r.item_id}`) ?? null,
        buyer_name: r.buyer_name,
        buyer_email: r.buyer_email,
        currency: r.currency,
        base_amount: num(r.base_amount),
        discount_amount: num(r.discount_amount),
        net_amount: num(r.net_amount),
        tax_amount: num(r.tax_amount),
        total_amount: num(r.total_amount),
        platform_fee: num(r.platform_fee),
        tenant_payout_amount: numOrNull(r.tenant_payout_amount),
        gateway_provider_name: r.gateway_provider_name,
        status: r.status as string,
        created_at: r.created_at as Date,
        paid_at: r.paid_at as Date | null,
        refunded_at: r.refunded_at as Date | null,
      })),
      total: num(countResult?.count),
    };
  }

  /**
   * Resolve payment_orders.item_id -> human-readable title, partitioned by
   * order_type so each content table is hit at most once (no N+1).
   * Key format: `${order_type}:${item_id}`.
   */
  private async resolveItemTitles(
    tenantId: string,
    rows: { order_type: unknown; item_id: string }[]
  ): Promise<Map<string, string>> {
    const idsByType = new Map<string, Set<string>>();
    for (const r of rows) {
      const t = String(r.order_type);
      if (!idsByType.has(t)) idsByType.set(t, new Set());
      idsByType.get(t)!.add(r.item_id);
    }

    const result = new Map<string, string>();
    const lookups: Promise<void>[] = [];

    const addLookup = (
      orderType: string,
      table: "courses" | "books" | "bundles" | "batches" | "test_series",
      ids: string[]
    ) => {
      lookups.push(
        db
          .selectFrom(table)
          .select(["id", "title"])
          .where("tenant_id", "=", tenantId)
          .where("id", "in", ids)
          .execute()
          .then((found) => {
            for (const f of found) {
              result.set(`${orderType}:${f.id}`, f.title);
            }
          })
      );
    };

    for (const [orderType, idSet] of idsByType) {
      const ids = [...idSet];
      if (ids.length === 0) continue;
      switch (orderType) {
        case "COURSE":
          addLookup(orderType, "courses", ids);
          break;
        case "BOOK":
          addLookup(orderType, "books", ids);
          break;
        case "BUNDLE":
          addLookup(orderType, "bundles", ids);
          break;
        case "BATCH":
          addLookup(orderType, "batches", ids);
          break;
        case "TEST_SERIES":
          addLookup(orderType, "test_series", ids);
          break;
        case "CART":
          for (const id of ids) result.set(`${orderType}:${id}`, "Cart order");
          break;
        default:
          break;
      }
    }

    await Promise.all(lookups);
    return result;
  }

  // ============================================
  // REVENUE SUMMARY
  // ============================================

  async getRevenueSummary(
    tenantId: string,
    params: RevenueQueryParams
  ): Promise<TenantRevenueSummary> {
    const startDate = params.start_date ? new Date(params.start_date) : null;
    const endDate = params.end_date ? new Date(params.end_date) : null;

    // Paid revenue grouped by currency
    let paidQuery = db
      .selectFrom("payment_orders")
      .select([
        "currency",
        sql<string>`COALESCE(SUM(base_amount), 0)`.as("gross_total"),
        sql<string>`COALESCE(SUM(discount_amount), 0)`.as("discount_total"),
        sql<string>`COALESCE(SUM(net_amount), 0)`.as("net_total"),
        sql<string>`COALESCE(SUM(tax_amount), 0)`.as("tax_total"),
        sql<string>`COALESCE(SUM(platform_fee), 0)`.as("platform_fee_total"),
        sql<string>`COALESCE(SUM(COALESCE(tenant_payout_amount, 0)), 0)`.as(
          "tenant_payout_total"
        ),
        db.fn.countAll().as("paid_order_count"),
      ])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PAID")
      .groupBy("currency");

    // Refunds grouped by currency
    let refundQuery = db
      .selectFrom("payment_orders")
      .select([
        "currency",
        sql<string>`COALESCE(SUM(total_amount), 0)`.as("refunded_amount"),
        db.fn.countAll().as("refunded_order_count"),
      ])
      .where("tenant_id", "=", tenantId)
      .where("status", "in", REFUND_STATUSES)
      .groupBy("currency");

    // Net revenue grouped by currency + order_type
    let byTypeQuery = db
      .selectFrom("payment_orders")
      .select([
        "currency",
        "order_type",
        sql<string>`COALESCE(SUM(net_amount), 0)`.as("net_total"),
        sql<string>`COALESCE(SUM(total_amount), 0)`.as("total_amount"),
        db.fn.countAll().as("order_count"),
      ])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PAID")
      .groupBy(["currency", "order_type"]);

    if (startDate) {
      paidQuery = paidQuery.where("created_at", ">=", startDate);
      refundQuery = refundQuery.where("created_at", ">=", startDate);
      byTypeQuery = byTypeQuery.where("created_at", ">=", startDate);
    }
    if (endDate) {
      paidQuery = paidQuery.where("created_at", "<=", endDate);
      refundQuery = refundQuery.where("created_at", "<=", endDate);
      byTypeQuery = byTypeQuery.where("created_at", "<=", endDate);
    }

    const [paidRows, refundRows, byTypeRows] = await Promise.all([
      paidQuery.execute(),
      refundQuery.execute(),
      byTypeQuery.execute(),
    ]);

    const refundByCurrency = new Map(
      refundRows.map((r) => [
        r.currency,
        {
          refunded_amount: num(r.refunded_amount),
          refunded_order_count: num(r.refunded_order_count),
        },
      ])
    );

    const byCurrency: RevenueCurrencyBlock[] = paidRows.map((r) => {
      const refund = refundByCurrency.get(r.currency);
      return {
        currency: r.currency,
        gross_total: num(r.gross_total),
        discount_total: num(r.discount_total),
        net_total: num(r.net_total),
        tax_total: num(r.tax_total),
        platform_fee_total: num(r.platform_fee_total),
        tenant_payout_total: num(r.tenant_payout_total),
        paid_order_count: num(r.paid_order_count),
        refunded_order_count: refund?.refunded_order_count ?? 0,
        refunded_amount: refund?.refunded_amount ?? 0,
      };
    });

    // Include currencies that only have refunds (no paid orders)
    for (const [currency, refund] of refundByCurrency) {
      if (!byCurrency.some((b) => b.currency === currency)) {
        byCurrency.push({
          currency,
          gross_total: 0,
          discount_total: 0,
          net_total: 0,
          tax_total: 0,
          platform_fee_total: 0,
          tenant_payout_total: 0,
          paid_order_count: 0,
          refunded_order_count: refund.refunded_order_count,
          refunded_amount: refund.refunded_amount,
        });
      }
    }

    const byOrderType: RevenueByOrderType[] = byTypeRows.map((r) => ({
      currency: r.currency,
      order_type: r.order_type as string,
      net_total: num(r.net_total),
      total_amount: num(r.total_amount),
      order_count: num(r.order_count),
    }));

    return {
      by_currency: byCurrency,
      by_order_type: byOrderType,
    };
  }
}

export default new TenantSalesRepository();
