import { order_type } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";

/**
 * Which `coupon_applicable_items` FK column holds the id for a given order type.
 *
 * `coupon_applicable_items` is polymorphic-by-nullable-FK: one column per
 * sellable entity, exactly one of them populated per row. This map is the single
 * place that association lives.
 *
 * Match on these columns, never on `coupon_applicable_items.item_type`: that
 * column is typed `bundle_item_type`, which has no BUNDLE member even
 * though the admin write path stores those strings. Every read path already
 * derives the type from FK presence for that reason.
 */
export const COUPON_ITEM_COLUMN = {
  [order_type.COURSE]: "course_id",
  [order_type.BOOK]: "book_id",
  [order_type.BUNDLE]: "bundle_id",
  [order_type.BATCH]: "batch_id",
  [order_type.TEST_SERIES]: "test_series_id",
} as const satisfies Partial<Record<order_type, string>>;

export type CouponItemColumn =
  (typeof COUPON_ITEM_COLUMN)[keyof typeof COUPON_ITEM_COLUMN];

/**
 * The FK column for an order type, or a 400 when the type can't carry a coupon
 * (CART is priced per line).
 *
 * Fails loudly on purpose. The previous nested-ternary version fell through to
 * `bundle_id` for anything unrecognised, so a BATCH order was silently matched
 * against bundle ids and every batch-scoped coupon was rejected.
 */
export function couponItemColumn(orderType: order_type): CouponItemColumn {
  const column = (COUPON_ITEM_COLUMN as Record<string, CouponItemColumn>)[orderType];
  if (!column) {
    throw new BadRequestError(`Coupons are not supported for ${orderType} orders`);
  }
  return column;
}

/** Cart line item types map onto the same columns via their order-type twin. */
export const CART_ITEM_TYPE_TO_ORDER_TYPE: Record<string, order_type> = {
  COURSE: order_type.COURSE,
  BOOK: order_type.BOOK,
  BUNDLE: order_type.BUNDLE,
  BATCH: order_type.BATCH,
};
