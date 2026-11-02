import { sql } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";
import {
  cart_item_type,
  enrollment_status,
  order_status,
  order_type
} from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import bundlesRepository from "../repositories/bundles.repository";
import * as cartOrderItemsRepo from "../repositories/cart-order-items.repository";
import * as cartRepo from "../repositories/cart.repository";
import * as ordersRepo from "../repositories/orders.repository";
import {
  assertGatewayInvariant,
  NO_GATEWAY_PROVIDER,
} from "../repositories/orders.repository";
import { FREE_ORDER_PAYMENT_REF, grantAccessForSingleItem, resolveOrderConnection } from "./checkout.service";
import { getAdapter, resolveConnection } from "./payment/gateway.factory";
import { resolveGatewayCurrency, type GatewayCurrencyNotice } from "./payment/gateway-currency";
import { buildHostedCheckoutExtras, needsHostedCheckoutExtras } from "./payment/hosted-checkout";
import { getDefaultCurrency, getEnabledCurrencyCodes } from "./currency-context.service";
import {
  getPriceMapsForEntities,
  resolveContentPrice,
  type PriceMapEntry,
  type ResolvedContentPrice,
} from "../utils/price-resolver";
import { assertSelfServeAllowed } from "../utils/assert-self-serve";
import { getRate } from "../utils/exchange-rate";
import type { price_entity_type } from "../db/enums";
import type { CreateOrderParams, ResolvedConnection } from "./payment/payment-gateway.types";
import { queuePurchaseNotifications } from "../queues/notification.queue";
import { queueWebhookFulfillment } from "../queues/webhook-fulfillment.queue";
import { fetchTenantTaxConfig } from "../utils/tax.util";
import { lookupAndValidateCouponSafe, calculateCouponDiscount } from "./coupon-validation.service";
import { toSmallestUnit } from "../utils/currency-registry";
import { assertChargeMatchesOrder, storedGatewayOrderId } from "./payment/order-match";
import logger from "../utils/logger";

const MAX_CART_SIZE = 50;
const ORDER_NUMBER_PREFIX = "ORD-";

function toDecimal(v: number): string {
  return String(Number(v.toFixed(2)));
}

function amountToSmallestUnit(amount: number, currency: string): number {
  return toSmallestUnit(amount, currency);
}

function applyPercentageDiscount(price: number, discountPct: number): number {
  const pct = Math.min(100, Math.max(0, discountPct));
  return Math.max(0, price * (1 - pct / 100));
}

export interface AddToCartBody {
  item_type: cart_item_type;
  item_id: string;
  coupon_code?: string;
}

export async function addToCart(
  tenantId: string,
  memberId: string,
  body: AddToCartBody,
): Promise<void> {
  await assertSelfServeAllowed(tenantId);

  const { item_type, item_id } = body;
  if (!item_type || !item_id) throw new BadRequestError("item_type and item_id are required");
  if (!["COURSE", "BOOK", "BUNDLE", "BATCH"].includes(item_type)) {
    throw new BadRequestError("Invalid item_type");
  }

  // Validate item exists and is PUBLISHED and PAID
  if (item_type === "COURSE") {
    const row = await db
      .selectFrom("courses")
      .select(["status", "purchase_mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", item_id)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Course not found");
    if (row.status !== "PUBLISHED")
      throw new BadRequestError("Course is not available");
    if (row.purchase_mode === "FREE")
      throw new BadRequestError("Free items cannot be added to cart");
  } else if (item_type === "BOOK") {
    const row = await db
      .selectFrom("books")
      .select(["status", "purchase_mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", item_id)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Book not found");
    if (row.status !== "PUBLISHED")
      throw new BadRequestError("Book is not available");
    if (row.purchase_mode === "FREE")
      throw new BadRequestError("Free items cannot be added to cart");
  } else if (item_type === "BATCH") {
    const row = await db
      .selectFrom("batches")
      .select(["status", "purchase_mode", "enrollment_close_date"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", item_id)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Batch not found");
    if (row.status !== "PUBLISHED")
      throw new BadRequestError("Batch is not available");
    if (String(row.purchase_mode) === "FREE")
      throw new BadRequestError("Free batches cannot be added to cart");
    if (row.enrollment_close_date && new Date(row.enrollment_close_date) < new Date()) {
      throw new BadRequestError("Enrollment for this batch has closed");
    }
  } else {
    const row = await db
      .selectFrom("bundles")
      .select(["status", "purchase_mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", item_id)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Bundle not found");
    if (row.status !== "PUBLISHED")
      throw new BadRequestError("Bundle is not available");
    if (String(row.purchase_mode) === "FREE") {
      throw new BadRequestError("Free bundles cannot be added to cart");
    }
  }

  // Check ownership
  if (item_type === "COURSE") {
    const enrolled = await db
      .selectFrom("enrollments")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("course_id", "=", item_id)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .executeTakeFirst();
    if (enrolled) throw new BadRequestError("You already own this course");
  } else if (item_type === "BOOK") {
    const access = await db
      .selectFrom("book_access")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("book_id", "=", item_id)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .executeTakeFirst();
    if (access) throw new BadRequestError("You already own this book");
  } else if (item_type === "BATCH") {
    // A learner already enrolled in this batch should not re-buy it.
    const enrolled = await db
      .selectFrom("batch_enrollments")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("batch_id", "=", item_id)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .executeTakeFirst();
    if (enrolled) throw new BadRequestError("You are already enrolled in this batch");
  } else if (item_type === "BUNDLE") {
    const items =
      await bundlesRepository.findItemsWithDetailsByBundleId(item_id, tenantId);
    const courseIds = items
      .filter((i) => i.itemType === "COURSE" && i.courseId)
      .map((i) => i.courseId!);
    const bookIds = items
      .filter((i) => i.itemType === "BOOK" && i.bookId)
      .map((i) => i.bookId!);
    if (courseIds.length > 0 || bookIds.length > 0) {
      let ownedCourses = 0;
      let ownedBooks = 0;
      if (courseIds.length > 0) {
        const enrolled = await db
          .selectFrom("enrollments")
          .select("course_id")
          .where("tenant_id", "=", tenantId)
          .where("tenant_member_id", "=", memberId)
          .where("course_id", "in", courseIds)
          .where("status", "=", enrollment_status.ACTIVE)
          .where(
            sql<boolean>`(valid_till is null or valid_till > ${new Date()})`,
          )
          .execute();
        ownedCourses = enrolled.length;
      }
      if (bookIds.length > 0) {
        const access = await db
          .selectFrom("book_access")
          .select("book_id")
          .where("tenant_id", "=", tenantId)
          .where("tenant_member_id", "=", memberId)
          .where("book_id", "in", bookIds)
          .where("status", "=", enrollment_status.ACTIVE)
          .where(
            sql<boolean>`(valid_till is null or valid_till > ${new Date()})`,
          )
          .execute();
        ownedBooks = access.length;
      }
      if (ownedCourses === courseIds.length && ownedBooks === bookIds.length) {
        throw new BadRequestError("You already own this bundle");
      }
    }
  }

  // Check cart size
  const count = await cartRepo.countItems(tenantId, memberId);
  if (count >= MAX_CART_SIZE) {
    throw new BadRequestError(
      `Cart cannot have more than ${MAX_CART_SIZE} items`,
    );
  }

  // Validate coupon if provided, silently ignore invalid coupons
  let validatedCouponCode: string | null = null;
  if (body.coupon_code?.trim()) {
    const couponResult = await lookupAndValidateCouponSafe(tenantId, memberId, body.coupon_code);
    if (couponResult) {
      validatedCouponCode = couponResult.code;
    }
  }

  await cartRepo.addItem(tenantId, memberId, item_type, item_id, validatedCouponCode);
}

export async function removeFromCart(
  tenantId: string,
  memberId: string,
  body: AddToCartBody,
): Promise<void> {
  const { item_type, item_id } = body;
  if (!item_type || !item_id)
    throw new BadRequestError("item_type and item_id are required");
  await cartRepo.removeItem(tenantId, memberId, item_type, item_id);
}

export interface CartResponse {
  items: Array<{
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
    is_owned: boolean;
    added_at: string;
    coupon_code: string | null;
    coupon_discount_inr: number;
    coupon_discount_usd: number;
    coupon_valid: boolean;
    /**
     * Merged per-currency price view (price book + legacy INR/USD), each entry
     * typed by its `discount_type`. Lets clients resolve the display price the
     * same way checkout charges it, instead of guessing semantics from the raw
     * legacy columns above (which are kept for backwards compatibility).
     */
    prices: Record<string, PriceMapEntry>;
  }>;
  summary: {
    total_items: number;
    purchasable_items: number;
    total_inr: string;
    total_usd: string;
    tax_mode: string;
    tax_percentage: number;
    is_indian: boolean;
    tax_amount_inr: string;
    tax_amount_usd: string;
    grand_total_inr: string;
    grand_total_usd: string;
  };
}

export async function getCart(
  tenantId: string,
  memberId: string,
): Promise<CartResponse> {
  const rows = await cartRepo.listItems(tenantId, memberId);

  // Filter out unpublished items
  const published = rows.filter((r) => r.status === "PUBLISHED");

  // Batch check ownership
  const courseIds = published.filter((r) => r.item_type === "COURSE").map((r) => r.item_id);
  const bookIds = published.filter((r) => r.item_type === "BOOK").map((r) => r.item_id);
  const bundleIds = published.filter((r) => r.item_type === "BUNDLE").map((r) => r.item_id);
  const batchIds = published.filter((r) => r.item_type === "BATCH").map((r) => r.item_id);

  // Collect course/book ids from bundle items for ownership checks
  let allCourseIds = [...courseIds];
  let allBookIds = [...bookIds];
  const bundleToCourses = new Map<string, Set<string>>();
  const bundleToBooks = new Map<string, Set<string>>();
  if (bundleIds.length > 0) {
    const bundleItemsRows = await db
      .selectFrom("bundle_items")
      .select(["bundle_id", "item_type", "course_id", "book_id"])
      .where("bundle_id", "in", bundleIds)
      .execute();
    for (const r of bundleItemsRows) {
      if (r.item_type === "COURSE" && r.course_id) {
        const set = bundleToCourses.get(r.bundle_id) ?? new Set();
        set.add(r.course_id);
        bundleToCourses.set(r.bundle_id, set);
        allCourseIds.push(r.course_id);
      } else if (r.item_type === "BOOK" && r.book_id) {
        const set = bundleToBooks.get(r.bundle_id) ?? new Set();
        set.add(r.book_id);
        bundleToBooks.set(r.bundle_id, set);
        allBookIds.push(r.book_id);
      }
    }
    allCourseIds = [...new Set(allCourseIds)];
    allBookIds = [...new Set(allBookIds)];
  }


  const ownedCourseIds = new Set<string>();
  const ownedBookIds = new Set<string>();
  const ownedBundleIds = new Set<string>();
  const ownedBatchIds = new Set<string>();

  if (allCourseIds.length > 0) {
    const enrollments = await db
      .selectFrom("enrollments")
      .select("course_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("course_id", "in", allCourseIds)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .execute();
    enrollments.forEach((e) => ownedCourseIds.add(e.course_id));
  }

  if (allBookIds.length > 0) {
    const access = await db
      .selectFrom("book_access")
      .select("book_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("book_id", "in", allBookIds)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .execute();
    access.forEach((a) => ownedBookIds.add(a.book_id));
  }

  for (const bid of bundleIds) {
    const cIds = Array.from(bundleToCourses.get(bid) ?? []);
    const bIds = Array.from(bundleToBooks.get(bid) ?? []);
    const ownedC =
      cIds.length === 0 || cIds.every((id) => ownedCourseIds.has(id));
    const ownedB =
      bIds.length === 0 || bIds.every((id) => ownedBookIds.has(id));
    if (ownedC && ownedB) ownedBundleIds.add(bid);
  }

  // Batch ownership: a single batch_enrollments row is the source of truth.
  if (batchIds.length > 0) {
    const enrollments = await db
      .selectFrom("batch_enrollments")
      .select("batch_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("batch_id", "in", batchIds)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .execute();
    enrollments.forEach((e) => ownedBatchIds.add(e.batch_id));
  }

  let totalInr = 0;
  let totalUsd = 0;
  let purchasableCount = 0;

  // Batch lookup all unique coupon codes used by cart items
  const uniqueCouponCodes = [...new Set(
    published.map((r) => r.coupon_code).filter((c): c is string => !!c)
  )];
  const couponMap = new Map<string, {
    id: string; code: string; discount_type: string; discount_value: unknown;
    is_active: boolean; valid_from: unknown; valid_to: unknown;
    max_uses: number | null; max_uses_per_user: number | null; used_count: unknown;
  }>();
  const couponApplicabilityMap = new Map<string, {
    courseIds: Set<string>; bookIds: Set<string>; bundleIds: Set<string>;
    batchIds: Set<string>; hasRestrictions: boolean;
  }>();

  if (uniqueCouponCodes.length > 0) {
    const coupons = await db
      .selectFrom("coupons")
      .select(["id", "code", "discount_type", "discount_value", "is_active",
        "valid_from", "valid_to", "max_uses", "max_uses_per_user", "used_count"])
      .where("tenant_id", "=", tenantId)
      .where("code", "in", uniqueCouponCodes.map((c) => c.toUpperCase()))
      .execute();
    for (const c of coupons) {
      couponMap.set(c.code.toUpperCase(), c);
    }

    // Fetch applicability for all coupons
    const couponIds = coupons.map((c) => c.id);
    if (couponIds.length > 0) {
      const applicableRows = await db
        .selectFrom("coupon_applicable_items")
        .select(["coupon_id", "course_id", "book_id", "bundle_id", "batch_id"])
        .where("coupon_id", "in", couponIds)
        .execute();
      for (const c of coupons) {
        const rows = applicableRows.filter((r) => r.coupon_id === c.id);
        couponApplicabilityMap.set(c.id, {
          courseIds: new Set(rows.filter((r) => r.course_id).map((r) => r.course_id!)),
          bookIds: new Set(rows.filter((r) => r.book_id).map((r) => r.book_id!)),
          bundleIds: new Set(rows.filter((r) => r.bundle_id).map((r) => r.bundle_id!)),
          batchIds: new Set(rows.filter((r) => r.batch_id).map((r) => r.batch_id!)),
          hasRestrictions: rows.length > 0,
        });
      }
    }

    // Check per-user limits for all coupons
    if (uniqueCouponCodes.length > 0) {
      const couponIdsWithPerUserLimit = coupons
        .filter((c) => c.max_uses_per_user != null)
        .map((c) => c.id);
      if (couponIdsWithPerUserLimit.length > 0) {
        const redemptions = await db
          .selectFrom("coupon_redemptions")
          .select(["coupon_id", db.fn.count<number>("id").as("count")])
          .where("tenant_id", "=", tenantId)
          .where("coupon_id", "in", couponIdsWithPerUserLimit)
          .where("member_id", "=", memberId)
          .groupBy("coupon_id")
          .execute();
        for (const r of redemptions) {
          const coupon = coupons.find((c) => c.id === r.coupon_id);
          if (coupon && coupon.max_uses_per_user != null) {
            const used = typeof r.count === "string" ? parseInt(r.count, 10) : Number(r.count ?? 0);
            if (used >= coupon.max_uses_per_user) {
              // Mark as invalid by removing from couponMap
              couponMap.delete(coupon.code.toUpperCase());
            }
          }
        }
      }
    }
  }

  // Helper: validate coupon for a specific item and return discount amounts
  const computeItemCouponDiscount = (
    couponCode: string | null,
    itemType: cart_item_type,
    itemId: string,
    baseInr: number,
    baseUsd: number,
  ): { discountInr: number; discountUsd: number; valid: boolean } => {
    if (!couponCode) return { discountInr: 0, discountUsd: 0, valid: false };
    const coupon = couponMap.get(couponCode.toUpperCase());
    if (!coupon) return { discountInr: 0, discountUsd: 0, valid: false };

    // Basic validity checks
    const now = new Date();
    if (!coupon.is_active) return { discountInr: 0, discountUsd: 0, valid: false };
    if (coupon.valid_from && new Date(String(coupon.valid_from)) > now)
      return { discountInr: 0, discountUsd: 0, valid: false };
    if (coupon.valid_to && new Date(String(coupon.valid_to)) < now)
      return { discountInr: 0, discountUsd: 0, valid: false };
    if (coupon.max_uses != null) {
      const usedCount = typeof coupon.used_count === "string"
        ? parseInt(coupon.used_count, 10) : Number(coupon.used_count ?? 0);
      if (usedCount >= coupon.max_uses) return { discountInr: 0, discountUsd: 0, valid: false };
    }

    // Check applicability
    const applicability = couponApplicabilityMap.get(coupon.id);
    if (applicability?.hasRestrictions) {
      const isApplicable =
        (itemType === "COURSE" && applicability.courseIds.has(itemId)) ||
        (itemType === "BOOK" && applicability.bookIds.has(itemId)) ||
        (itemType === "BUNDLE" && applicability.bundleIds.has(itemId)) ||
        (itemType === "BATCH" && applicability.batchIds.has(itemId));
      if (!isApplicable) return { discountInr: 0, discountUsd: 0, valid: true }; // coupon valid but not applicable to this item
    }

    const discountVal = parseFloat(String(coupon.discount_value));
    const discountInr = calculateCouponDiscount(coupon.discount_type, discountVal, baseInr);
    const discountUsd = calculateCouponDiscount(coupon.discount_type, discountVal, baseUsd);
    return { discountInr, discountUsd, valid: true };
  };

  // Merged per-currency pricing (price book + legacy columns), the same view
  // createCartOrder charges from. The legacy columns alone cannot price the
  // cart any more: an item's discount semantics live on its price-book row
  // (`discount_type`).
  const priceMapByItem = new Map<string, Record<string, PriceMapEntry>>();
  {
    const rowsByEntityType = new Map<price_entity_type, typeof published>();
    for (const row of published) {
      const entityType = PRICE_ENTITY_BY_CART_ITEM[String(row.item_type)];
      if (!entityType) continue;
      const list = rowsByEntityType.get(entityType) ?? [];
      list.push(row);
      rowsByEntityType.set(entityType, list);
    }
    for (const [entityType, typeRows] of rowsByEntityType) {
      const maps = await getPriceMapsForEntities(
        tenantId,
        entityType,
        typeRows.map((r) => ({
          id: r.item_id,
          price_inr: r.price_inr,
          price_usd: r.price_usd,
          discount_inr: r.discount_inr,
          discount_usd: r.discount_usd,
        })),
      );
      for (const r of typeRows) {
        priceMapByItem.set(`${r.item_type}:${r.item_id}`, maps.get(r.item_id) ?? {});
      }
    }
  }

  const items = published.map((row) => {
    const isOwned =
      (row.item_type === "COURSE" && ownedCourseIds.has(row.item_id)) ||
      (row.item_type === "BOOK" && ownedBookIds.has(row.item_id)) ||
      (row.item_type === "BUNDLE" && ownedBundleIds.has(row.item_id)) ||
      (row.item_type === "BATCH" && ownedBatchIds.has(row.item_id));

    const priceMap = priceMapByItem.get(`${row.item_type}:${row.item_id}`) ?? {};

    let couponDiscountInr = 0;
    let couponDiscountUsd = 0;
    let couponValid = false;

    if (!isOwned && row.purchase_mode !== "FREE") {
      purchasableCount++;

      // Effective price per currency, discount applied per the row's own type.
      // When the merged view has no entry for a currency (currency disabled
      // for the tenant, or an access-managed storefront where price maps come
      // back empty), fall back to the previous legacy-column math verbatim so
      // those cases keep behaving exactly as before.
      const baseFor = (
        code: "INR" | "USD",
        legacyPrice: string | null,
        legacyDiscount: string | null,
      ): number => {
        const entry = priceMap[code];
        if (entry) {
          const discount = Math.max(0, entry.discount);
          return entry.discount_type === "FLAT"
            ? Math.max(0, entry.amount - discount)
            : applyPercentageDiscount(entry.amount, discount);
        }
        const price = parseFloat(legacyPrice ?? "0");
        const discount = parseFloat(legacyDiscount ?? "0");
        return applyPercentageDiscount(price, discount);
      };

      const baseInr = baseFor("INR", row.price_inr, row.discount_inr);
      const baseUsd = baseFor("USD", row.price_usd, row.discount_usd);

      // Calculate per-item coupon discount
      if (row.coupon_code) {
        const couponResult = computeItemCouponDiscount(
          row.coupon_code, row.item_type, row.item_id, baseInr, baseUsd
        );
        couponDiscountInr = couponResult.discountInr;
        couponDiscountUsd = couponResult.discountUsd;
        couponValid = couponResult.valid;
      }

      totalInr += baseInr - couponDiscountInr;
      totalUsd += baseUsd - couponDiscountUsd;
    }

    return {
      id: row.id,
      item_type: row.item_type,
      item_id: row.item_id,
      title: row.title,
      slug: row.slug,
      thumbnail_url: row.thumbnail_url,
      price_inr: row.price_inr,
      price_usd: row.price_usd,
      discount_inr: row.discount_inr,
      discount_usd: row.discount_usd,
      purchase_mode: row.purchase_mode,
      is_owned: isOwned,
      added_at: row.created_at.toISOString(),
      coupon_code: row.coupon_code,
      coupon_discount_inr: couponDiscountInr,
      coupon_discount_usd: couponDiscountUsd,
      coupon_valid: row.coupon_code ? couponValid : false,
      prices: priceMap,
    };
  });

  // Fetch tax config for summary
  const taxConfig = await fetchTenantTaxConfig(tenantId);
  let taxAmountInr = 0;
  let taxAmountUsd = 0;
  let grandTotalInr = totalInr;
  let grandTotalUsd = totalUsd;

  if (taxConfig.taxPercentage > 0 && taxConfig.taxMode === "EXCLUSIVE") {
    taxAmountInr = +(totalInr * taxConfig.taxPercentage / 100).toFixed(2);
    taxAmountUsd = +(totalUsd * taxConfig.taxPercentage / 100).toFixed(2);
    grandTotalInr = +(totalInr + taxAmountInr).toFixed(2);
    grandTotalUsd = +(totalUsd + taxAmountUsd).toFixed(2);
  }

  return {
    items,
    summary: {
      total_items: items.length,
      purchasable_items: purchasableCount,
      total_inr: toDecimal(totalInr),
      total_usd: toDecimal(totalUsd),
      tax_mode: taxConfig.taxMode,
      tax_percentage: taxConfig.taxPercentage,
      is_indian: taxConfig.isIndian,
      tax_amount_inr: toDecimal(taxAmountInr),
      tax_amount_usd: toDecimal(taxAmountUsd),
      grand_total_inr: toDecimal(grandTotalInr),
      grand_total_usd: toDecimal(grandTotalUsd),
    },
  };
}

export async function clearCartAction(
  tenantId: string,
  memberId: string,
): Promise<void> {
  await cartRepo.clearCart(tenantId, memberId);
}

export async function removeItemCoupon(
  tenantId: string,
  memberId: string,
  itemId: string,
): Promise<void> {
  await cartRepo.removeCoupon(tenantId, memberId, itemId);
}

// ---------------------------------------------------------------------------
// Cart Checkout
// ---------------------------------------------------------------------------

export interface CreateCartOrderBody {
  currency: string;
}

export interface CreateCartOrderResult {
  order_id: string;
  order_number: string;
  gateway_order_id: string;
  amount: number;
  currency: string;
  client_config: Record<string, unknown>;
  /**
   * True when coupons covered the whole cart. The order is already settled and
   * fulfilled server-side, so the client must not open a payment sheet.
   */
  free?: boolean;
}

const PRICE_ENTITY_BY_CART_ITEM: Record<string, price_entity_type> = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  BUNDLE: "BUNDLE",
  BATCH: "BATCH",
  TEST_SERIES: "TEST_SERIES",
};

interface PricedCartItem<T> {
  item: T;
  resolved: ResolvedContentPrice;
}

/** Merged-view pricing per cart item; throws a buyer-friendly error for unpriceable items. */
async function priceCartItems<
  T extends {
    item_type: string;
    item_id: string;
    title?: string | null;
    price_inr?: unknown;
    price_usd?: unknown;
    discount_inr?: unknown;
    discount_usd?: unknown;
  },
>(tenantId: string, items: T[], currency: string): Promise<Array<PricedCartItem<T>>> {
  const out: Array<PricedCartItem<T>> = [];
  for (const item of items) {
    const entityType = PRICE_ENTITY_BY_CART_ITEM[String(item.item_type)];
    if (!entityType) {
      throw new BadRequestError(`Unsupported cart item type: ${String(item.item_type)}`);
    }
    try {
      const resolved = await resolveContentPrice({
        tenantId,
        entityType,
        entityId: item.item_id,
        requestedCurrency: currency,
        legacyRow: item,
        discountMode: "percent",
      });
      out.push({ item, resolved });
    } catch (err) {
      if (err instanceof BadRequestError) {
        throw new BadRequestError(
          `"${item.title ?? item.item_id}" is not available for purchase in the store's enabled currencies. Remove it from the cart to continue.`,
        );
      }
      throw err;
    }
  }
  return out;
}

export async function createCartOrder(
  tenantId: string,
  memberId: string,
  body: CreateCartOrderBody,
  idempotencyKey: string | null,
): Promise<CreateCartOrderResult> {
  await assertSelfServeAllowed(tenantId);

  // Resolved, not required yet, coupons can cover the whole cart, and a
  // zero-payable cart has nothing for a gateway to collect. The requirement is
  // enforced further down, once the payable total is known. Demanding it here
  // (as this used to) made a fully-discounted cart impossible on a tenant with
  // no gateway attached.
  const connection = await resolveConnection(tenantId);

  const cart = await getCart(tenantId, memberId);
  const purchasable = cart.items.filter(
    (i) => !i.is_owned && i.purchase_mode !== "FREE",
  );
  if (purchasable.length === 0) {
    throw new BadRequestError("No purchasable items in cart");
  }

  const enabledCurrencies = await getEnabledCurrencyCodes(tenantId);
  const requestedRaw = String(body.currency ?? "").toUpperCase();
  const requestedCurrency = enabledCurrencies.includes(requestedRaw)
    ? requestedRaw
    : await getDefaultCurrency(tenantId);

  // Single-currency cart invariant with the full fallback chain: charge in
  // the FIRST currency (requested > tenant default > remaining enabled in
  // tenant sort order) in which EVERY purchasable item has a price. The
  // gateway capability check then runs on the final currency.
  const cartDefaultCurrency = await getDefaultCurrency(tenantId);
  const candidates = [
    ...new Set([requestedCurrency, cartDefaultCurrency, ...enabledCurrencies]),
  ];
  let currency = candidates[0];
  let pricedItems = await priceCartItems(tenantId, purchasable, currency);
  const downgradedItemIds = pricedItems
    .filter((p) => p.resolved.currency !== currency)
    .map((p) => p.item.item_id);
  if (downgradedItemIds.length > 0) {
    let settled = false;
    for (const candidate of candidates.slice(1)) {
      const priced = await priceCartItems(tenantId, purchasable, candidate);
      if (priced.every((p) => p.resolved.currency === candidate)) {
        logger.info(
          `[cart-checkout] tenant=${tenantId}: ${downgradedItemIds.length} item(s) not priced in ${requestedCurrency}; repricing cart in ${candidate}`,
        );
        currency = candidate;
        pricedItems = priced;
        settled = true;
        break;
      }
    }
    if (!settled) {
      throw new BadRequestError(
        "Cart items are not all priced in a single enabled currency. Remove some items to continue.",
      );
    }
  }
  let currencyNotice: GatewayCurrencyNotice | null = null;
  // Collected rather than thrown: a gateway currency limitation only matters
  // for a cart that actually reaches the gateway. Re-thrown below if payable.
  let gatewayCurrencyError: Error | null = null;
  if (connection) {
    let gatewayResolution: { currency: string; notice: GatewayCurrencyNotice | null } | null = null;
    try {
      gatewayResolution = resolveGatewayCurrency(
        currency,
        connection.provider_name,
        enabledCurrencies,
      );
    } catch (err) {
      gatewayResolution = null;
      gatewayCurrencyError = err instanceof Error ? err : new Error(String(err));
    }
    if (gatewayResolution) {
      currencyNotice = gatewayResolution.notice;
      if (gatewayResolution.currency !== currency) {
        logger.info(
          `[cart-checkout] ${connection.provider_name} active for tenant=${tenantId}: forcing currency ${currency}→${gatewayResolution.currency} for cart of ${purchasable.length} item${purchasable.length > 1 ? "s" : ""}`,
        );
        currency = gatewayResolution.currency;
        pricedItems = await priceCartItems(tenantId, purchasable, currency);
        if (pricedItems.some((p) => p.resolved.currency !== currency)) {
          gatewayCurrencyError = new BadRequestError(
            `This store's payment gateway (${connection.provider_name}) can only charge ${currency}, and some cart items are not priced in it`,
          );
        }
      }
    }
  }

  // Calculate per-item amounts with per-item coupon handling
  const itemAmounts: Array<{
    item: typeof purchasable[0];
    baseAmount: number;
    discountAmount: number;
    netAmount: number;
    couponId: string | null;
    couponCodeSnapshot: string | null;
  }> = [];

  // Collect unique coupon codes from purchasable items
  const itemCouponCodes = [...new Set(
    purchasable.map((i) => i.coupon_code).filter((c): c is string => !!c)
  )];

  // Batch lookup coupons
  const couponLookup = new Map<string, {
    id: string; code: string; discount_type: string; discount_value: unknown;
    currency: string | null;
    is_active: boolean; valid_from: unknown; valid_to: unknown;
    max_uses: number | null; max_uses_per_user: number | null; used_count: unknown;
  }>();
  const couponApplicability = new Map<string, {
    courseIds: Set<string>; bookIds: Set<string>; bundleIds: Set<string>;
    batchIds: Set<string>; hasRestrictions: boolean;
  }>();

  if (itemCouponCodes.length > 0) {
    const coupons = await db
      .selectFrom("coupons")
      .select(["id", "code", "discount_type", "discount_value", "currency", "is_active",
        "valid_from", "valid_to", "max_uses", "max_uses_per_user", "used_count"])
      .where("tenant_id", "=", tenantId)
      .where("code", "in", itemCouponCodes.map((c) => c.toUpperCase()))
      .execute();
    for (const c of coupons) couponLookup.set(c.code.toUpperCase(), c);

    const couponIds = coupons.map((c) => c.id);
    if (couponIds.length > 0) {
      const applicableRows = await db
        .selectFrom("coupon_applicable_items")
        .select(["coupon_id", "course_id", "book_id", "bundle_id", "batch_id"])
        .where("coupon_id", "in", couponIds)
        .execute();
      for (const c of coupons) {
        const rows = applicableRows.filter((r) => r.coupon_id === c.id);
        couponApplicability.set(c.id, {
          courseIds: new Set(rows.filter((r) => r.course_id).map((r) => r.course_id!)),
          bookIds: new Set(rows.filter((r) => r.book_id).map((r) => r.book_id!)),
          bundleIds: new Set(rows.filter((r) => r.bundle_id).map((r) => r.bundle_id!)),
          batchIds: new Set(rows.filter((r) => r.batch_id).map((r) => r.batch_id!)),
          hasRestrictions: rows.length > 0,
        });
      }
    }

    // Check per-user limits
    const couponIdsWithPerUserLimit = [...couponLookup.values()]
      .filter((c) => c.max_uses_per_user != null).map((c) => c.id);
    if (couponIdsWithPerUserLimit.length > 0) {
      const redemptions = await db
        .selectFrom("coupon_redemptions")
        .select(["coupon_id", db.fn.count<number>("id").as("count")])
        .where("tenant_id", "=", tenantId)
        .where("coupon_id", "in", couponIdsWithPerUserLimit)
        .where("member_id", "=", memberId)
        .groupBy("coupon_id")
        .execute();
      for (const r of redemptions) {
        const coupon = [...couponLookup.values()].find((c) => c.id === r.coupon_id);
        if (coupon && coupon.max_uses_per_user != null) {
          const used = typeof r.count === "string" ? parseInt(r.count, 10) : Number(r.count ?? 0);
          if (used >= coupon.max_uses_per_user) couponLookup.delete(coupon.code.toUpperCase());
        }
      }
    }
  }

  let totalCouponDiscount = 0;
  // Track unique coupons actually used for redemption
  const usedCoupons = new Map<string, { id: string; code: string; discount: number }>();

  for (const { item, resolved } of pricedItems) {
    const baseAmount = resolved.baseAmount;

    let itemCouponDiscount = 0;
    let itemCouponId: string | null = null;
    let itemCouponCode: string | null = null;

    if (item.coupon_code) {
      const coupon = couponLookup.get(item.coupon_code.toUpperCase());
      if (coupon) {
        const now = new Date();
        let valid = coupon.is_active;
        if (valid && coupon.valid_from && new Date(String(coupon.valid_from)) > now) valid = false;
        if (valid && coupon.valid_to && new Date(String(coupon.valid_to)) < now) valid = false;
        if (valid && coupon.max_uses != null) {
          const usedCount = typeof coupon.used_count === "string"
            ? parseInt(coupon.used_count, 10) : Number(coupon.used_count ?? 0);
          if (usedCount >= coupon.max_uses) valid = false;
        }
        // FIXED coupons are currency-scoped (NULL on legacy rows means INR)
        if (valid && coupon.discount_type === "FIXED") {
          const couponCurrency = (coupon.currency ?? "INR").toUpperCase();
          if (couponCurrency !== currency) valid = false;
        }

        if (valid) {
          // Check applicability
          const app = couponApplicability.get(coupon.id);
          let applicable = true;
          if (app?.hasRestrictions) {
            applicable =
              (item.item_type === "COURSE" && app.courseIds.has(item.item_id)) ||
              (item.item_type === "BOOK" && app.bookIds.has(item.item_id)) ||
              (item.item_type === "BUNDLE" && app.bundleIds.has(item.item_id)) ||
              (item.item_type === "BATCH" && app.batchIds.has(item.item_id));
          }

          if (applicable) {
            const discountVal = parseFloat(String(coupon.discount_value));
            itemCouponDiscount = calculateCouponDiscount(coupon.discount_type, discountVal, baseAmount);
            itemCouponId = coupon.id;
            itemCouponCode = coupon.code;
            totalCouponDiscount += itemCouponDiscount;

            const existing = usedCoupons.get(coupon.id);
            usedCoupons.set(coupon.id, {
              id: coupon.id,
              code: coupon.code,
              discount: (existing?.discount ?? 0) + itemCouponDiscount,
            });
          }
        }
      }
    }

    itemAmounts.push({
      item,
      baseAmount,
      discountAmount: itemCouponDiscount,
      netAmount: Math.max(0, baseAmount - itemCouponDiscount),
      couponId: itemCouponId,
      couponCodeSnapshot: itemCouponCode,
    });
  }

  const cartBaseTotal = itemAmounts.reduce((sum, ia) => sum + ia.baseAmount, 0);
  const totalNet = itemAmounts.reduce((sum, ia) => sum + ia.netAmount, 0);

  // Tax calculation
  const taxConfig = await fetchTenantTaxConfig(tenantId);
  let taxAmount = 0;
  let totalAmount = totalNet;

  if (totalNet > 0 && taxConfig.taxPercentage > 0 && taxConfig.taxMode === "EXCLUSIVE") {
    taxAmount = +(totalNet * taxConfig.taxPercentage / 100).toFixed(2);
    totalAmount = +(totalNet + taxAmount).toFixed(2);
  }

  const isFreeCart = totalAmount <= 0;

  // The deferred gateway requirement, see createOrder in checkout.service.ts
  // for the full rationale. A cart whose coupons cover everything is a FREE
  // enrollment and never reaches a gateway, so it must not be blocked by the
  // tenant having none (or by that gateway's currency limits).
  if (!isFreeCart) {
    if (!connection) throw new BadRequestError("No active payment gateway configured");
    if (gatewayCurrencyError) throw gatewayCurrencyError;
  }

  // Tenants collect through their own gateway account: no platform cut.
  const platformFee = 0;
  const tenantPayoutAmount: number | null = totalAmount;

  // FX snapshot to the tenant default currency (best-effort, never blocks checkout)
  const tenantDefaultCurrency = await getDefaultCurrency(tenantId);
  let fxRateToDefault: number | null = null;
  let fxSource: string | null = null;
  try {
    const fx = await getRate(currency, tenantDefaultCurrency);
    fxRateToDefault = fx.rate;
    fxSource = fx.source;
  } catch {
    // Rate unavailable for this pair; columns stay NULL.
  }

  const orderNumber = `${ORDER_NUMBER_PREFIX}${ulid().toLowerCase().slice(-8)}`;

  // Idempotency check
  const existingByKey = idempotencyKey
    ? await ordersRepo.findOrderByIdempotencyKey(tenantId, idempotencyKey)
    : null;
  if (existingByKey) {
    if (existingByKey.status === order_status.PAID) {
      throw new BadRequestError("Order already paid");
    }
    return {
      order_id: existingByKey.id,
      order_number: existingByKey.order_number,
      gateway_order_id: existingByKey.gateway_order_id ?? "",
      amount: amountToSmallestUnit(
        parseFloat(existingByKey.total_amount),
        existingByKey.currency,
      ),
      currency: existingByKey.currency,
      client_config:
        (existingByKey.client_config as Record<string, unknown>) ?? {},
    };
  }

  // Create order + cart_order_items in transaction
  const orderId = ulid();
  const now = new Date();

  // cart.service inserts into payment_orders directly rather than through
  // ordersRepo.createOrder, so it must assert the invariant itself. Done before
  // the transaction opens so a violation never leaves a half-built order.
  assertGatewayInvariant({
    gateway_connection_id: connection?.connection_id ?? null,
    gateway_provider_name: connection?.provider_name ?? NO_GATEWAY_PROVIDER,
    total_amount: toDecimal(totalAmount),
    order_number: orderNumber,
  });

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("payment_orders")
      .values({
        id: orderId,
        tenant_id: tenantId,
        tenant_member_id: memberId,
        // NULL only ever reaches here for a zero-payable cart; the gate above
        // threw for anything payable, and assertGatewayInvariant re-checks it.
        gateway_connection_id: connection?.connection_id ?? null,
        order_number: orderNumber,
        order_type: order_type.CART,
        item_id: "cart",
        currency,
        base_amount: toDecimal(cartBaseTotal),
        discount_amount: toDecimal(totalCouponDiscount),
        coupon_id: null, // per-item coupons, tracked on cart_order_items
        coupon_code_snapshot: null,
        net_amount: toDecimal(totalNet),
        tax_amount: toDecimal(taxAmount),
        total_amount: toDecimal(totalAmount),
        platform_fee: toDecimal(platformFee),
        tenant_payout_amount:
          tenantPayoutAmount != null ? toDecimal(tenantPayoutAmount) : null,
        gateway_provider_name: connection?.provider_name ?? NO_GATEWAY_PROVIDER,
        status: order_status.CREATED,
        idempotency_key: idempotencyKey,
        metadata: (() => {
          const meta: Record<string, unknown> = {};
          if (fxSource) meta.fx_source = fxSource;
          return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
        })(),
        tenant_default_currency: tenantDefaultCurrency,
        fx_rate_to_tenant_default: fxRateToDefault !== null ? String(fxRateToDefault) : null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Create cart_order_items with per-item coupon tracking
    for (const ia of itemAmounts) {
      const col =
        ia.item.item_type === "COURSE" ? "course_id" :
        ia.item.item_type === "BOOK" ? "book_id" :
        ia.item.item_type === "BATCH" ? "batch_id" : "bundle_id";
      await trx
        .insertInto("cart_order_items")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          order_id: orderId,
          item_type: ia.item.item_type as cart_item_type,
          [col]: ia.item.item_id,
          base_amount: toDecimal(ia.baseAmount),
          discount_amount: toDecimal(ia.discountAmount),
          net_amount: toDecimal(ia.netAmount),
          coupon_id: ia.couponId,
          coupon_code_snapshot: ia.couponCodeSnapshot,
          created_at: now,
        })
        .execute();
    }
  });

  // Coupons covered the entire cart: nothing to charge, so skip the gateway
  // (both providers reject zero-amount orders) and settle + fulfil in-process,
  // reusing the exact webhook fulfillment path.
  if (totalAmount <= 0) {
    await ordersRepo.updateOrderMetadata(tenantId, orderId, {
      free_order: true,
      tax_config: {
        mode: taxConfig.taxMode,
        percentage: taxConfig.taxPercentage,
        isIndian: taxConfig.isIndian,
      },
    });
    await ordersRepo.updateOrderToPaid(tenantId, orderId, FREE_ORDER_PAYMENT_REF, null);
    await processCartOrderPaidInWebhook(
      tenantId,
      {
        id: orderId,
        tenant_member_id: memberId,
        coupon_id: null,
        tenant_payout_amount: toDecimal(tenantPayoutAmount ?? 0),
        net_amount: toDecimal(totalNet),
        discount_amount: toDecimal(totalCouponDiscount),
        currency,
      },
      connection,
    );
    await ordersRepo.markOrderFulfilled(tenantId, orderId);

    // A fully-discounted cart is still a purchase: the buyer gets their
    // confirmation and the tenant owner gets their alert.
    queuePurchaseNotifications({
      tenantId,
      orderId,
      memberId,
      orderType: "CART",
    });

    logger.info("[cart-checkout] Zero-amount cart order fulfilled without gateway", {
      tenantId, memberId, orderId, orderNumber, itemCount: purchasable.length,
    });

    return {
      order_id: orderId,
      order_number: orderNumber,
      gateway_order_id: "",
      amount: 0,
      currency,
      free: true,
      client_config: {},
    };
  }

  // Payable from here on, and the gate above proved a payable cart has a
  // connection. This re-check is what narrows the type for the adapter call.
  if (!connection) throw new BadRequestError("No active payment gateway configured");

  // Create gateway order
  const adapter = getAdapter(connection);
  const amountPaise = amountToSmallestUnit(totalAmount, currency);
  const adapterParams: CreateOrderParams = {
    amount: amountPaise,
    currency,
    receipt: orderNumber,
    notes: {
      order_id: orderId,
      order_type: "CART",
      item_count: String(purchasable.length),
    },
  };
  // Must stay in step with the identical branch in checkout.service.createOrder.
  if (needsHostedCheckoutExtras(connection.provider_name)) {
    Object.assign(
      adapterParams,
      await buildHostedCheckoutExtras({
        tenantId,
        tenantMemberId: memberId,
        orderId,
        productInfo: `Cart Purchase ${purchasable.length} item${purchasable.length > 1 ? "s" : ""}`,
      })
    );
  }
  const result = await adapter.createOrder(adapterParams);

  const cartOrderMetadata: Record<string, unknown> = {
    client_config: result.client_config,
    tax_config: {
      mode: taxConfig.taxMode,
      percentage: taxConfig.taxPercentage,
      isIndian: taxConfig.isIndian,
    },
  };
  if (currency !== requestedCurrency) {
    cartOrderMetadata.requested_currency = requestedCurrency;
    cartOrderMetadata.currency_overridden_reason =
      currencyNotice?.reason ?? "DEFAULT_CURRENCY_FALLBACK";
  }
  if (downgradedItemIds.length > 0) {
    cartOrderMetadata.currency_downgraded_items = downgradedItemIds;
  }
  await ordersRepo.updateOrderToPaymentPending(
    tenantId,
    orderId,
    result.gateway_order_id,
    cartOrderMetadata,
  );

  logger.info("[cart-checkout] Cart order created", {
    tenantId, memberId, orderId, orderNumber,
    itemCount: purchasable.length,
    currency, totalAmount, taxAmount,
    couponsUsed: usedCoupons.size,
  });

  return {
    order_id: orderId,
    order_number: orderNumber,
    gateway_order_id: result.gateway_order_id,
    amount: amountPaise,
    currency,
    client_config: currencyNotice
      ? { ...result.client_config, currency_notice: currencyNotice }
      : result.client_config,
  };
}

export interface VerifyCartPaymentBody {
  order_id?: string;
  gateway_order_id: string;
  gateway_payment_id: string;
  signature: string;
}

export async function verifyCartPayment(
  tenantId: string,
  memberId: string,
  body: VerifyCartPaymentBody,
): Promise<{ success: boolean; order_id: string }> {
  const order = body.order_id
    ? await ordersRepo.findOrderById(tenantId, body.order_id)
    : await ordersRepo.findOrderByGatewayOrderId(
        tenantId,
        body.gateway_order_id,
      );

  if (!order) throw new NotFoundError("Order not found");
  if (order.tenant_member_id !== memberId)
    throw new BadRequestError("Order does not belong to this user");
  if (order.status === order_status.PAID) {
    return { success: true, order_id: order.id };
  }
  if (order.status !== order_status.PAYMENT_PENDING) {
    throw new BadRequestError("Order is not in payment pending state");
  }

  // The connection the order was created on, not whatever is active now.
  const connection = await resolveOrderConnection(tenantId, order.gateway_connection_id);
  if (!connection) throw new BadRequestError("No active payment gateway");
  const adapter = getAdapter(connection);

  // Same two families as single-item checkout: Razorpay signs the browser
  // return, Stripe does not, so for Stripe the server asks the gateway.
  let paymentId = body.gateway_payment_id;
  let signature: string | null = body.signature;
  // Verify against the STORED gateway order id: proof for one order must never
  // settle another.
  const gatewayOrderId = storedGatewayOrderId(order, body.gateway_order_id);
  if (adapter.confirmPayment) {
    const confirmation = await adapter.confirmPayment({ gateway_order_id: gatewayOrderId });
    if (!confirmation.paid) {
      throw new BadRequestError("Payment has not been completed");
    }
    assertChargeMatchesOrder(order, confirmation.amount, confirmation.currency, "cart-checkout");
    paymentId = confirmation.gateway_payment_id ?? body.gateway_payment_id;
    signature = null;
  } else {
    const valid = await adapter.verifyPayment({
      gateway_order_id: gatewayOrderId,
      gateway_payment_id: body.gateway_payment_id,
      signature: body.signature,
    });
    if (!valid)
      throw new BadRequestError("Payment signature verification failed");
  }

  await ordersRepo.updateOrderToPaid(tenantId, order.id, paymentId, signature);

  logger.info("[cart-checkout] Cart payment verified", {
    tenantId, memberId, orderId: order.id,
    gatewayPaymentId: paymentId,
  });

  // Fallback fulfillment, if webhook hasn't fulfilled yet, queue it
  const orderMeta = await ordersRepo.getOrderMetadata(tenantId, order.id);
  if (!orderMeta?.fulfilled) {
    queueWebhookFulfillment({
      tenantId,
      orderId: order.id,
      eventId: `verify-fallback-${order.id}`,
      paymentId,
      eventType: "payment.captured",
      orderType: "CART",
      source: "VERIFICATION_FALLBACK",
    }).catch((err) => logger.error("[cart-checkout] Failed to queue fallback fulfillment", {
      orderId: order.id, error: err instanceof Error ? err.message : String(err),
    }));
  }

  // Clear user's cart (fast, important for UX).
  await cartRepo.clearCart(tenantId, memberId);

  return { success: true, order_id: order.id };
}

/** Called from webhook when a CART order payment is captured. */
export async function processCartOrderPaidInWebhook(
  tenantId: string,
  order: {
    id: string;
    tenant_member_id: string;
    coupon_id: string | null;
    tenant_payout_amount?: string | null;
    net_amount?: string | null;
    discount_amount?: string | null;
    currency?: string | null;
  },
  connection: ResolvedConnection | null,
): Promise<void> {
  const orderItems = await cartOrderItemsRepo.findByOrderId(tenantId, order.id);

  logger.info("[cart-fulfillment] Starting cart fulfillment", {
    tenantId, orderId: order.id, itemCount: orderItems.length,
  });

  for (const item of orderItems) {
    const itemId =
      item.course_id ||
      item.book_id ||
      item.bundle_id ||
      item.batch_id;
    if (!itemId) continue;
    const itemOrderType =
      item.item_type === "COURSE" ? order_type.COURSE :
      item.item_type === "BOOK" ? order_type.BOOK :
      item.item_type === "BATCH" ? order_type.BATCH : order_type.BUNDLE;
    await grantAccessForSingleItem(tenantId, order.tenant_member_id, itemOrderType, itemId, item.coupon_id ?? order.coupon_id, connection, order.id);
    logger.info("[cart-fulfillment] Access granted for cart item", {
      tenantId, orderId: order.id, itemType: item.item_type, itemId,
    });
  }

  logger.info("[cart-fulfillment] Cart fulfillment complete", {
    tenantId, orderId: order.id, itemCount: orderItems.length,
  });

  // Idempotent per-item coupon increment, guard via order metadata
  const meta = await ordersRepo.getOrderMetadata(tenantId, order.id);
  if (!meta?.coupon_incremented) {
    // Collect unique coupons from order items
    const uniqueCoupons = new Map<string, { discount: number }>();
    for (const item of orderItems) {
      if (item.coupon_id) {
        const existing = uniqueCoupons.get(item.coupon_id);
        uniqueCoupons.set(item.coupon_id, {
          discount: (existing?.discount ?? 0) + parseFloat(item.discount_amount),
        });
      }
    }
    // Fallback: legacy order-level coupon_id
    if (uniqueCoupons.size === 0 && order.coupon_id) {
      uniqueCoupons.set(order.coupon_id, {
        discount: parseFloat(String(order.discount_amount ?? 0)),
      });
    }

    for (const [couponId, data] of uniqueCoupons) {
      await db
        .updateTable("coupons")
        .set((eb) => ({ used_count: eb("used_count", "+", 1) }))
        .where("id", "=", couponId)
        .where("tenant_id", "=", tenantId)
        .execute();

      // Auto-deactivate if global max_uses reached
      const updatedCoupon = await db
        .selectFrom("coupons")
        .select(["used_count", "max_uses"])
        .where("id", "=", couponId)
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst();
      if (updatedCoupon && updatedCoupon.max_uses != null && Number(updatedCoupon.used_count) >= updatedCoupon.max_uses) {
        await db
          .updateTable("coupons")
          .set({ is_active: false, updated_at: new Date() } as never)
          .where("id", "=", couponId)
          .where("tenant_id", "=", tenantId)
          .execute();
      }

      // Record redemption
      await db
        .insertInto("coupon_redemptions")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          coupon_id: couponId,
          member_id: order.tenant_member_id,
          order_id: order.id,
          discount_amount: data.discount as never,
          currency: order.currency ?? "INR",
          created_at: new Date(),
        } as never)
        .onConflict((oc) => oc.columns(["tenant_id", "coupon_id", "order_id"]).doNothing())
        .execute();
    }

    if (uniqueCoupons.size > 0) {
      const existing = meta ?? {};
      await ordersRepo.updateOrderMetadata(tenantId, order.id, { ...existing, coupon_incremented: true });
    }
  }

  // Clear user's cart
  await cartRepo.clearCart(tenantId, order.tenant_member_id);
}
