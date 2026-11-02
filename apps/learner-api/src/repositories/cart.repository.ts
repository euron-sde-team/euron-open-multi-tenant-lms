import { ulid } from "ulid";
import { db } from "../db/connection";
import type { cart_item_type } from "../db/enums";
import type { Transaction } from "kysely";
import type { DB } from "../db/types";

function getItemColumn(
  itemType: cart_item_type
): "course_id" | "book_id" | "bundle_id" | "batch_id" {
  if (itemType === "COURSE") return "course_id";
  if (itemType === "BOOK") return "book_id";
  if (itemType === "BATCH") return "batch_id";
  return "bundle_id";
}

export async function addItem(
  tenantId: string,
  memberId: string,
  itemType: cart_item_type,
  itemId: string,
  couponCode?: string | null
): Promise<void> {
  const col = getItemColumn(itemType);
  const now = new Date();
  await db
    .insertInto("cart_items")
    .values({
      id: ulid(),
      tenant_id: tenantId,
      tenant_member_id: memberId,
      item_type: itemType,
      [col]: itemId,
      coupon_code: couponCode ?? null,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.columns(["tenant_id", "tenant_member_id", "item_type", col]).doUpdateSet({
        coupon_code: couponCode ?? null,
        updated_at: now,
      })
    )
    .execute();
}

export async function removeItem(
  tenantId: string,
  memberId: string,
  itemType: cart_item_type,
  itemId: string
): Promise<void> {
  const col = getItemColumn(itemType);
  await db
    .deleteFrom("cart_items")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("item_type", "=", itemType)
    .where(col, "=", itemId)
    .execute();
}

export async function removeCoupon(
  tenantId: string,
  memberId: string,
  itemId: string
): Promise<void> {
  await db
    .updateTable("cart_items")
    .set({ coupon_code: null, updated_at: new Date() })
    .where("id", "=", itemId)
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .execute();
}

export interface CartItemRow {
  id: string;
  item_type: cart_item_type;
  item_id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  price_inr: string | null;
  price_usd: string | null;
  discount_inr: string | null;
  discount_usd: string | null;
  purchase_mode: string;
  status: string;
  coupon_code: string | null;
  created_at: Date;
}

export async function listItems(
  tenantId: string,
  memberId: string
): Promise<CartItemRow[]> {
  // Query courses
  const courseItems = await db
    .selectFrom("cart_items")
    .innerJoin("courses", "courses.id", "cart_items.course_id")
    .select([
      "cart_items.id",
      "cart_items.item_type",
      "cart_items.course_id as item_id",
      "courses.title",
      "courses.slug",
      "courses.thumbnail_key as thumbnail_url",
      "courses.price_inr",
      "courses.price_usd",
      "courses.discount_inr",
      "courses.discount_usd",
      "courses.purchase_mode",
      "courses.status",
      "cart_items.coupon_code",
      "cart_items.created_at",
    ])
    .where("cart_items.tenant_id", "=", tenantId)
    .where("cart_items.tenant_member_id", "=", memberId)
    .where("cart_items.item_type", "=", "COURSE")
    .execute();

  // Query books
  const bookItems = await db
    .selectFrom("cart_items")
    .innerJoin("books", "books.id", "cart_items.book_id")
    .select([
      "cart_items.id",
      "cart_items.item_type",
      "cart_items.book_id as item_id",
      "books.title",
      "books.slug",
      "books.thumbnail_url",
      "books.price_inr",
      "books.price_usd",
      "books.discount_inr",
      "books.discount_usd",
      "books.purchase_mode",
      "books.status",
      "cart_items.coupon_code",
      "cart_items.created_at",
    ])
    .where("cart_items.tenant_id", "=", tenantId)
    .where("cart_items.tenant_member_id", "=", memberId)
    .where("cart_items.item_type", "=", "BOOK")
    .execute();

  // Query bundles
  const bundleItems = await db
    .selectFrom("cart_items")
    .innerJoin("bundles", "bundles.id", "cart_items.bundle_id")
    .select([
      "cart_items.id",
      "cart_items.item_type",
      "cart_items.bundle_id as item_id",
      "bundles.title",
      "bundles.slug",
      "bundles.thumbnail_url",
      "bundles.price_inr",
      "bundles.price_usd",
      "bundles.discount_inr",
      "bundles.discount_usd",
      "bundles.purchase_mode",
      "bundles.status",
      "cart_items.coupon_code",
      "cart_items.created_at",
    ])
    .where("cart_items.tenant_id", "=", tenantId)
    .where("cart_items.tenant_member_id", "=", memberId)
    .where("cart_items.item_type", "=", "BUNDLE")
    .execute();

  // Query batches
  const batchItems = await db
    .selectFrom("cart_items")
    .innerJoin("batches", "batches.id", "cart_items.batch_id")
    .select([
      "cart_items.id",
      "cart_items.item_type",
      "cart_items.batch_id as item_id",
      "batches.title",
      "batches.slug",
      "batches.thumbnail_url",
      "batches.price_inr",
      "batches.price_usd",
      "batches.discount_inr",
      "batches.discount_usd",
      "batches.purchase_mode",
      "batches.status",
      "cart_items.coupon_code",
      "cart_items.created_at",
    ])
    .where("cart_items.tenant_id", "=", tenantId)
    .where("cart_items.tenant_member_id", "=", memberId)
    .where("cart_items.item_type", "=", "BATCH")
    .execute();

  const mapRow = (r: { id: string; item_type: cart_item_type; item_id: string | null; title: string; slug: string; thumbnail_url: string | null; price_inr: unknown; price_usd: unknown; discount_inr: unknown; discount_usd: unknown; purchase_mode: unknown; status: unknown; coupon_code: string | null; created_at: Date }): CartItemRow => ({
    id: r.id,
    item_type: r.item_type,
    item_id: r.item_id!,
    title: r.title,
    slug: r.slug,
    thumbnail_url: r.thumbnail_url,
    price_inr: r.price_inr != null ? String(r.price_inr) : null,
    price_usd: r.price_usd != null ? String(r.price_usd) : null,
    discount_inr: r.discount_inr != null ? String(r.discount_inr) : null,
    discount_usd: r.discount_usd != null ? String(r.discount_usd) : null,
    purchase_mode: String(r.purchase_mode ?? "PAID"),
    status: String(r.status),
    coupon_code: r.coupon_code,
    created_at: r.created_at,
  });

  const all: CartItemRow[] = [
    ...courseItems.map(mapRow),
    ...bookItems.map(mapRow),
    ...bundleItems.map(mapRow),
    ...batchItems.map(mapRow),
  ];

  // Sort by created_at ascending
  all.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  return all;
}

export async function clearCart(
  tenantId: string,
  memberId: string,
  trx?: Transaction<DB>
): Promise<void> {
  await (trx || db)
    .deleteFrom("cart_items")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .execute();
}

export async function countItems(
  tenantId: string,
  memberId: string
): Promise<number> {
  const result = await db
    .selectFrom("cart_items")
    .select(db.fn.countAll<string>().as("count"))
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .executeTakeFirst();
  return parseInt(result?.count ?? "0", 10);
}
