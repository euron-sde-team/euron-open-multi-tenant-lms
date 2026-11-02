/**
 * Per-entity order attribution, the ONE place that knows a purchase reaches
 * `payment_orders` in two different shapes.
 *
 *   - direct, `order_type = 'COURSE' | 'BOOK' | 'BUNDLE' | 'BATCH'`
 *     and `item_id` = the purchased entity's id.
 *   - cart, `order_type = 'CART'` with the literal string `'cart'` in `item_id`;
 *     the real per-entity rows live in `cart_order_items` (one per line).
 *
 * Matching `item_id` alone therefore reports ZERO for anything bought through
 * the cart, a course shows enrollments with no revenue, a hub product shows
 * sales with no earnings. Any query that attributes an order to a specific
 * course / book / bundle / hub product must go through the builders here rather
 * than hand-rolling the `item_id` match.
 *
 * Aggregates that stay at the order level (tenant revenue totals, per-member
 * spend, payouts) are unaffected, they already count the CART order itself,
 * and must NOT also count its lines or they will double.
 */
import { sql, type RawBuilder } from "kysely";

/** Cart line columns that point at a purchasable entity. */
export type CartEntityColumn =
  | "course_id"
  | "book_id"
  | "bundle_id"
  | "batch_id";

/** Order types whose `item_id` is the entity id (i.e. everything but CART). */
export type DirectOrderType =
  | "COURSE"
  | "BOOK"
  | "BUNDLE"
  | "BATCH";

/**
 * A cart line's share of its order, as a fraction of the order's net amount.
 *
 * Cart orders set `net_amount` to exactly the sum of their line net amounts
 * (see `cart.service.ts`), so these shares sum back to 1 across the order.
 * A zero-net order (fully discounted) has nothing to apportion and yields 0
 * rather than 1, so a hypothetical net=0/total>0 row can never inflate totals
 * by handing every line the full order amount.
 *
 * Assumes the cart line is aliased `coi` and its order `po`.
 */
const CART_LINE_RATIO = sql`coalesce(coi.net_amount / nullif(po.net_amount, 0), 0)`;

/**
 * One cart line's share of an order-level money column.
 *
 * Needed because cart lines only carry pre-tax `net_amount`, while direct
 * orders are reported on `total_amount` (net + tax), and, for the Hub, on
 * `platform_fee` / `tenant_payout_amount`, which exist only on the order.
 * Rounded to 2dp: the ratio is high-scale numeric and would otherwise surface
 * as 9745.55009526229 in the UI.
 */
export function cartLineShare(
  orderColumn: "total_amount" | "platform_fee" | "tenant_payout_amount",
): RawBuilder<string> {
  return sql<string>`round(coalesce(${sql.ref(`po.${orderColumn}`)}, 0) * ${CART_LINE_RATIO}, 2)`;
}

/** A cart line's share of its order's `total_amount`. */
export const CART_LINE_AMOUNT = cartLineShare("total_amount");

/** PAID revenue in `currency` for ONE entity: direct orders + cart lines. */
export function entityRevenueSql(
  tenantId: string,
  orderType: DirectOrderType,
  cartColumn: CartEntityColumn,
  entityId: RawBuilder<string> | string,
  currency: "INR" | "USD",
): RawBuilder<string> {
  const cartCol = sql.ref(`coi.${cartColumn}`);
  return sql<string>`(
    coalesce((
      select sum(po.total_amount) from payment_orders po
       where po.tenant_id = ${tenantId} and po.status = 'PAID'
         and po.order_type = ${sql.lit(orderType)} and po.item_id = ${entityId}
         and po.currency = ${sql.lit(currency)}
    ), 0)
    + coalesce((
      select sum(${CART_LINE_AMOUNT}) from cart_order_items coi
        join payment_orders po on po.id = coi.order_id
       where coi.tenant_id = ${tenantId} and ${cartCol} = ${entityId}
         and po.status = 'PAID' and po.currency = ${sql.lit(currency)}
    ), 0)
  )`;
}

/** PAID sale count for ONE entity: direct orders + cart lines. */
export function entitySalesCountSql(
  tenantId: string,
  orderType: DirectOrderType,
  cartColumn: CartEntityColumn,
  entityId: RawBuilder<string> | string,
): RawBuilder<number> {
  const cartCol = sql.ref(`coi.${cartColumn}`);
  return sql<number>`(
    (select count(*) from payment_orders po
      where po.tenant_id = ${tenantId} and po.status = 'PAID'
        and po.order_type = ${sql.lit(orderType)} and po.item_id = ${entityId})
    + (select count(*) from cart_order_items coi
        join payment_orders po on po.id = coi.order_id
       where coi.tenant_id = ${tenantId} and ${cartCol} = ${entityId}
         and po.status = 'PAID')
  )::int`;
}

/**
 * PAID orders for one content entity type, flattened to one row per purchased
 * entity so direct orders and cart lines aggregate together. Use as a derived
 * table, exposes `order_id`, `paid_at`, `currency`, `amount`, `entity_id`:
 *
 *   sql`select ... from ${entityOrderLines(tenantId, "BOOK", "book_id")} ol`
 */
export function entityOrderLines(
  tenantId: string,
  orderType: DirectOrderType,
  cartColumn: CartEntityColumn,
): RawBuilder<unknown> {
  const cartCol = sql.ref(`coi.${cartColumn}`);
  return sql`(
    select po.id as order_id, po.paid_at, po.currency,
           po.total_amount as amount, po.item_id as entity_id
      from payment_orders po
     where po.tenant_id = ${tenantId} and po.status = 'PAID'
       and po.order_type = ${sql.lit(orderType)}
    union all
    select po.id, po.paid_at, po.currency,
           ${CART_LINE_AMOUNT}, ${cartCol}
      from cart_order_items coi
      join payment_orders po on po.id = coi.order_id
     where coi.tenant_id = ${tenantId} and po.status = 'PAID'
       and ${cartCol} is not null
  )`;
}

/**
 * EVERY paid purchase flattened to one row per purchased item, across all
 * entity types at once, the type-agnostic sibling of `entityOrderLines`
 * (which answers "how did ONE book sell?").
 *
 * Use when reporting a feed of purchases rather than aggregating one entity:
 * a 3-item cart yields 3 rows, each with its own entity id and its apportioned
 * share of the order total, so every row can name and link the thing that was
 * actually bought.
 *
 * Exposes `order_id`, `order_number`, `tenant_member_id`, `item_type`,
 * `item_id`, `amount`, `currency`, `paid_at`. `item_type` is a text column
 * (not an enum) because it unions `order_type` with `cart_item_type`.
 *
 * WALLET_TOPUP is excluded, a wallet top-up buys no item, so it has no name
 * or route to show. TEST_SERIES has no `cart_item_type` member and therefore
 * appears only via the direct branch; that is correct, not a gap.
 */
export function purchasedItemLines(tenantId: string): RawBuilder<unknown> {
  return sql`(
    select po.id as order_id, po.order_number, po.tenant_member_id,
           po.order_type::text as item_type, po.item_id as item_id,
           po.total_amount as amount, po.currency, po.paid_at
      from payment_orders po
     where po.tenant_id = ${tenantId} and po.status = 'PAID'
       and po.order_type != 'CART'
    union all
    select po.id, po.order_number, po.tenant_member_id,
           coi.item_type::text,
           coalesce(coi.course_id, coi.book_id, coi.bundle_id,
                    coi.batch_id),
           ${CART_LINE_AMOUNT}, po.currency, po.paid_at
      from cart_order_items coi
      join payment_orders po on po.id = coi.order_id
     where coi.tenant_id = ${tenantId} and po.status = 'PAID'
  )`;
}
