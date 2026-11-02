import { db } from "../db/connection";
import { order_type } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import {
  normalizeCurrencyForTenant,
  resolveContentPrice,
} from "../utils/price-resolver";
import { assertSelfServeAllowed } from "../utils/assert-self-serve";
import {
  CART_ITEM_TYPE_TO_ORDER_TYPE,
  COUPON_ITEM_COLUMN,
  couponItemColumn,
  type CouponItemColumn,
} from "../utils/coupon-applicability.util";

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  original_amount: number;
  net_amount: number;
  currency: string;
}

export interface CartCouponValidationResult {
  valid: boolean;
  code: string;
  discount_type: string;
  discount_value: number;
  total_discount: number;
  items: Array<{
    item_id: string;
    item_type: string;
    applicable: boolean;
    discount_amount: number;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseBigint = (val: unknown): number =>
  typeof val === "string" ? parseInt(val, 10) : Number(val ?? 0);

// ---------------------------------------------------------------------------
// Core coupon lookup & validation (shared by single-item and cart flows)
// ---------------------------------------------------------------------------

async function lookupAndValidateCoupon(
  tenantId: string,
  memberId: string | null,
  couponCode: string,
) {
  const coupon = await db
    .selectFrom("coupons")
    .select([
      "id",
      "code",
      "discount_type",
      "discount_value",
      "currency",
      "is_active",
      "valid_from",
      "valid_to",
      "max_uses",
      "max_uses_per_user",
      "used_count",
    ])
    .where("tenant_id", "=", tenantId)
    .where("code", "=", couponCode.trim().toUpperCase())
    .executeTakeFirst();

  if (!coupon || !coupon.is_active) {
    throw new BadRequestError("Invalid or inactive coupon");
  }

  const now = new Date();

  if (coupon.valid_from && new Date(String(coupon.valid_from)) > now) {
    throw new BadRequestError("Coupon not yet valid");
  }
  if (coupon.valid_to && new Date(String(coupon.valid_to)) < now) {
    throw new BadRequestError("Coupon has expired");
  }

  if (
    coupon.max_uses != null &&
    parseBigint(coupon.used_count) >= coupon.max_uses
  ) {
    throw new BadRequestError("Coupon is no longer valid");
  }

  // Skip the per-user limit when there is no member yet (logged-out Easy Checkout
  // preview). A not-yet-created member has zero redemptions; the per-user cap is
  // re-enforced at purchase time in checkout.service.createOrder against the real
  // member. The global max_uses check above still applies to anonymous previews.
  if (memberId && coupon.max_uses_per_user != null) {
    const userUsage = await db
      .selectFrom("coupon_redemptions")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("coupon_id", "=", coupon.id)
      .where("member_id", "=", memberId)
      .executeTakeFirst();

    const used = parseBigint(userUsage?.count);
    if (used >= coupon.max_uses_per_user) {
      throw new BadRequestError(
        "You have reached the maximum uses for this coupon",
      );
    }
  }

  return coupon;
}

// ---------------------------------------------------------------------------
// Item applicability check
// ---------------------------------------------------------------------------

async function checkApplicability(
  tenantId: string,
  couponId: string,
  orderType: order_type,
  itemId: string,
) {
  const hasApplicableItems = await db
    .selectFrom("coupon_applicable_items")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("coupon_id", "=", couponId)
    .executeTakeFirst();

  if (!hasApplicableItems) return; // no restrictions, coupon applies globally

  const applicable = await db
    .selectFrom("coupon_applicable_items")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("coupon_id", "=", couponId)
    .where(couponItemColumn(orderType), "=", itemId)
    .executeTakeFirst();

  if (!applicable) {
    throw new BadRequestError("Coupon not applicable to this item");
  }
}

// ---------------------------------------------------------------------------
// Item price resolution (mirrors checkout.service.ts getItemPrice logic)
// ---------------------------------------------------------------------------

async function getItemBaseAmount(
  tenantId: string,
  orderType: order_type,
  itemId: string,
  currency: string,
): Promise<{ baseAmount: number; currency: string }> {
  const tableByOrderType: Partial<
    Record<order_type, { table: "courses" | "books" | "bundles" | "test_series"; entityType: "COURSE" | "BOOK" | "BUNDLE" | "TEST_SERIES" }>
  > = {
    [order_type.COURSE]: { table: "courses", entityType: "COURSE" },
    [order_type.BOOK]: { table: "books", entityType: "BOOK" },
    [order_type.BUNDLE]: { table: "bundles", entityType: "BUNDLE" },
    [order_type.TEST_SERIES]: { table: "test_series", entityType: "TEST_SERIES" },
  };

  const target = tableByOrderType[orderType];
  if (!target) throw new BadRequestError("Invalid order type");

  const row = await db
    .selectFrom(target.table)
    .select(["price_inr", "price_usd", "discount_inr", "discount_usd"])
    .where("tenant_id", "=", tenantId)
    .where("id", "=", itemId)
    .executeTakeFirst();
  if (!row) throw new BadRequestError("Item not found");

  const resolved = await resolveContentPrice({
    tenantId,
    entityType: target.entityType,
    entityId: itemId,
    requestedCurrency: currency,
    legacyRow: row,
    discountMode: "percent",
  });
  return { baseAmount: resolved.baseAmount, currency: resolved.currency };
}

// ---------------------------------------------------------------------------
// Safe coupon lookup (returns null instead of throwing)
// ---------------------------------------------------------------------------

export async function lookupAndValidateCouponSafe(
  tenantId: string,
  memberId: string | null,
  couponCode: string,
): Promise<{ id: string; code: string } | null> {
  try {
    const coupon = await lookupAndValidateCoupon(tenantId, memberId, couponCode);
    return { id: coupon.id, code: coupon.code };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Coupon discount calculation
// ---------------------------------------------------------------------------

export function calculateCouponDiscount(
  discountType: string,
  discountValue: number,
  baseAmount: number,
): number {
  // FIXED coupons subtract a flat amount in their own currency (callers verify
  // the currency scope first); everything else is percentage-based.
  const discountAmount =
    discountType === "FIXED"
      ? Math.min(discountValue, baseAmount)
      : Math.min((baseAmount * discountValue) / 100, baseAmount);
  return +discountAmount.toFixed(2);
}

// ---------------------------------------------------------------------------
// Public API, single-item coupon validation
// ---------------------------------------------------------------------------

export async function validateCoupon(
  tenantId: string,
  memberId: string | null,
  couponCode: string,
  orderType: order_type,
  itemId: string,
  currency: string,
): Promise<CouponValidationResult> {
  await assertSelfServeAllowed(tenantId);

  const coupon = await lookupAndValidateCoupon(tenantId, memberId, couponCode);

  await checkApplicability(tenantId, coupon.id, orderType, itemId);

  const resolved = await getItemBaseAmount(tenantId, orderType, itemId, currency);
  const baseAmount = resolved.baseAmount;

  // FIXED coupons are currency-scoped (NULL on legacy rows means INR)
  if (coupon.discount_type === "FIXED") {
    const couponCurrency = (coupon.currency ?? "INR").toUpperCase();
    if (couponCurrency !== resolved.currency) {
      throw new BadRequestError(`This coupon is only valid for ${couponCurrency} orders`);
    }
  }

  const discountVal = parseFloat(String(coupon.discount_value));
  const discountAmount = calculateCouponDiscount(
    coupon.discount_type,
    discountVal,
    baseAmount,
  );

  return {
    valid: true,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: discountVal,
    discount_amount: discountAmount,
    original_amount: +baseAmount.toFixed(2),
    net_amount: +Math.max(0, baseAmount - discountAmount).toFixed(2),
    currency: resolved.currency,
  };
}

// ---------------------------------------------------------------------------
// Public API, cart coupon validation
// ---------------------------------------------------------------------------

export async function validateCartCoupon(
  tenantId: string,
  memberId: string,
  couponCode: string,
  currency: string,
): Promise<CartCouponValidationResult> {
  await assertSelfServeAllowed(tenantId);

  const coupon = await lookupAndValidateCoupon(tenantId, memberId, couponCode);

  // Fetch cart items
  const rawCartItems = await db
    .selectFrom("cart_items")
    .select(["item_type", "course_id", "book_id", "bundle_id", "batch_id"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .execute();

  if (rawCartItems.length === 0) {
    throw new BadRequestError("Cart is empty");
  }

  // Normalize cart items to item_type + item_id
  const cartItems = rawCartItems.map((ci) => ({
    item_type: ci.item_type,
    item_id:
      ci.course_id ||
      ci.book_id ||
      ci.bundle_id ||
      ci.batch_id ||
      "",
  })).filter((ci) => ci.item_id);

  // Build applicability lookup sets
  const applicableRows = await db
    .selectFrom("coupon_applicable_items")
    .select([
      "course_id",
      "book_id",
      "bundle_id",
      "batch_id",
    ])
    .where("tenant_id", "=", tenantId)
    .where("coupon_id", "=", coupon.id)
    .execute();

  const hasRestrictions = applicableRows.length > 0;
  const applicableSets = {
    COURSE: new Set(
      applicableRows.filter((a) => a.course_id).map((a) => a.course_id!),
    ),
    BOOK: new Set(
      applicableRows.filter((a) => a.book_id).map((a) => a.book_id!),
    ),
    BUNDLE: new Set(
      applicableRows.filter((a) => a.bundle_id).map((a) => a.bundle_id!),
    ),
    BATCH: new Set(
      applicableRows.filter((a) => a.batch_id).map((a) => a.batch_id!),
    ),
  };

  const effectiveCurrency = await normalizeCurrencyForTenant(tenantId, currency);

  // FIXED coupons are currency-scoped (NULL on legacy rows means INR)
  if (coupon.discount_type === "FIXED") {
    const couponCurrency = (coupon.currency ?? "INR").toUpperCase();
    if (couponCurrency !== effectiveCurrency) {
      throw new BadRequestError(`This coupon is only valid for ${couponCurrency} orders`);
    }
  }

  const discountVal = parseFloat(String(coupon.discount_value));

  let totalDiscount = 0;
  const items: CartCouponValidationResult["items"] = [];

  for (const ci of cartItems) {
    const itemType = ci.item_type as keyof typeof applicableSets;
    const isApplicable =
      !hasRestrictions || (applicableSets[itemType]?.has(ci.item_id) ?? false);

    let discountAmount = 0;

    if (isApplicable) {
      // Map cart item_type to the corresponding order_type for price lookup
      const mappedOrderType = CART_ITEM_TYPE_TO_ORDER_TYPE[ci.item_type];
      if (mappedOrderType) {
        try {
          const resolved = await getItemBaseAmount(
            tenantId,
            mappedOrderType,
            ci.item_id,
            effectiveCurrency,
          );
          discountAmount = calculateCouponDiscount(
            coupon.discount_type,
            discountVal,
            resolved.baseAmount,
          );
        } catch {
          // Item not found or not priceable, skip discount for this item
          discountAmount = 0;
        }
      }

      totalDiscount += discountAmount;
    }

    items.push({
      item_id: ci.item_id,
      item_type: ci.item_type,
      applicable: isApplicable,
      discount_amount: discountAmount,
    });
  }

  return {
    valid: true,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: discountVal,
    total_discount: +totalDiscount.toFixed(2),
    items,
  };
}

// ---------------------------------------------------------------------------
// Available coupons for an item
// ---------------------------------------------------------------------------

export interface AvailableCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
  /** Currency the amounts below are expressed in (the resolved order currency). */
  currency: string;
  original_amount: number;
  /** What this buyer actually saves on this item, drives the "Save X" label. */
  discount_amount: number;
  net_amount: number;
  valid_to: string | null;
}

/**
 * Coupons the buyer could actually redeem on this item right now: public,
 * active, inside their validity window, with global (and per-user) uses left,
 * either unrestricted or explicitly scoped to this item, and, for FIXED
 * coupons, priced in a currency this order can be charged in.
 *
 * Each entry carries the discount already computed against this item's price,
 * so the storefront can show "Save ₹499 → ₹1,996" and apply in one click
 * without a second round trip.
 *
 * Private coupons (`is_public = false`) are excluded here and here only: they
 * stay fully redeemable by typing the code, they are just never advertised.
 *
 * Returns an empty list rather than throwing when the item can't be priced.
 * checkout uses the length of this list to decide whether to pause for a coupon
 * step at all, so "nothing to offer" must not look like a failure.
 */
export async function listAvailableCoupons(
  tenantId: string,
  memberId: string | null,
  orderType: order_type,
  itemId: string,
  currency: string,
): Promise<AvailableCoupon[]> {
  // Access-managed storefronts don't sell self-serve, so they must not publish
  // their coupon codes either. validateCoupon/validateCartCoupon both gate on
  // this; the listing previously did not.
  await assertSelfServeAllowed(tenantId);

  const column = (COUPON_ITEM_COLUMN as Record<string, CouponItemColumn | undefined>)[
    orderType
  ];
  if (!column) return [];

  const now = new Date();

  const candidates = await db
    .selectFrom("coupons")
    .select([
      "id",
      "code",
      "discount_type",
      "discount_value",
      "currency",
      "max_uses",
      "max_uses_per_user",
      "used_count",
      "valid_to",
    ])
    .where("tenant_id", "=", tenantId)
    .where("is_active", "=", true)
    .where("is_public", "=", true)
    .where((eb) => eb.or([eb("valid_from", "is", null), eb("valid_from", "<=", now)]))
    .where((eb) => eb.or([eb("valid_to", "is", null), eb("valid_to", ">=", now)]))
    .execute();

  const usable = candidates.filter(
    (c) => c.max_uses == null || parseBigint(c.used_count) < c.max_uses,
  );
  if (usable.length === 0) return [];

  const couponIds = usable.map((c) => c.id);

  // One query for every restriction row across all candidates, rather than two
  // per candidate. A coupon with no rows here has no restrictions at all, which
  // is how "applies to all products" is represented.
  const restrictionRows = await db
    .selectFrom("coupon_applicable_items")
    .select(["coupon_id", column])
    .where("tenant_id", "=", tenantId)
    .where("coupon_id", "in", couponIds)
    .execute();

  const restricted = new Set(restrictionRows.map((r) => r.coupon_id));
  const matched = new Set(
    restrictionRows
      .filter((r) => (r as Record<string, unknown>)[column] === itemId)
      .map((r) => r.coupon_id),
  );

  // One grouped query for this member's redemptions across all candidates.
  const perUserUsed = new Map<string, number>();
  if (memberId) {
    const rows = await db
      .selectFrom("coupon_redemptions")
      .select(["coupon_id", db.fn.count<number>("id").as("count")])
      .where("tenant_id", "=", tenantId)
      .where("coupon_id", "in", couponIds)
      .where("member_id", "=", memberId)
      .groupBy("coupon_id")
      .execute();
    for (const r of rows) perUserUsed.set(r.coupon_id, parseBigint(r.count));
  }

  // Price the item once, every coupon's saving is computed against it.
  let resolved: { baseAmount: number; currency: string };
  try {
    resolved = await getItemBaseAmount(tenantId, orderType, itemId, currency);
  } catch {
    return [];
  }

  const out: AvailableCoupon[] = [];
  for (const c of usable) {
    if (restricted.has(c.id) && !matched.has(c.id)) continue;

    if (
      memberId &&
      c.max_uses_per_user != null &&
      (perUserUsed.get(c.id) ?? 0) >= c.max_uses_per_user
    ) {
      continue;
    }

    // FIXED coupons are currency-scoped (NULL on legacy rows means INR).
    // Advertising one the buyer can't use only produces a confusing error when
    // they click it.
    if (
      c.discount_type === "FIXED" &&
      (c.currency ?? "INR").toUpperCase() !== resolved.currency
    ) {
      continue;
    }

    const discountValue = parseFloat(String(c.discount_value));
    const discountAmount = calculateCouponDiscount(
      c.discount_type,
      discountValue,
      resolved.baseAmount,
    );
    if (discountAmount <= 0) continue;

    out.push({
      code: c.code,
      discount_type: String(c.discount_type),
      discount_value: discountValue,
      currency: resolved.currency,
      original_amount: +resolved.baseAmount.toFixed(2),
      discount_amount: discountAmount,
      net_amount: +Math.max(0, resolved.baseAmount - discountAmount).toFixed(2),
      valid_to: c.valid_to ? new Date(String(c.valid_to)).toISOString() : null,
    });
  }

  // Best offer first, so the storefront can badge the leading one "Best value".
  out.sort((a, b) => b.discount_amount - a.discount_amount);
  return out;
}
