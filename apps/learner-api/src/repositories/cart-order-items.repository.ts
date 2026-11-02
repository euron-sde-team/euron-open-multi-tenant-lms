import { db } from "../db/connection";

export interface CartOrderItemRow {
  id: string;
  tenant_id: string;
  order_id: string;
  item_type: string;
  course_id: string | null;
  book_id: string | null;
  bundle_id: string | null;
  batch_id: string | null;
  base_amount: string;
  discount_amount: string;
  net_amount: string;
  coupon_id: string | null;
  coupon_code_snapshot: string | null;
}

export async function findByOrderId(
  tenantId: string,
  orderId: string
): Promise<CartOrderItemRow[]> {
  const rows = await db
    .selectFrom("cart_order_items")
    .select([
      "id",
      "tenant_id",
      "order_id",
      "item_type",
      "course_id",
      "book_id",
      "bundle_id",
      "batch_id",
      "base_amount",
      "discount_amount",
      "net_amount",
      "coupon_id",
      "coupon_code_snapshot",
    ])
    .where("tenant_id", "=", tenantId)
    .where("order_id", "=", orderId)
    .execute();

  return rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    order_id: r.order_id,
    item_type: r.item_type,
    course_id: r.course_id,
    book_id: r.book_id,
    bundle_id: r.bundle_id,
    batch_id: r.batch_id,
    base_amount: String(r.base_amount),
    discount_amount: String(r.discount_amount),
    net_amount: String(r.net_amount),
    coupon_id: r.coupon_id,
    coupon_code_snapshot: r.coupon_code_snapshot,
  }));
}
