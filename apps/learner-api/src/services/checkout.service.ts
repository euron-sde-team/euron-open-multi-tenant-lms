import { ulid } from "ulid";
import { db } from "../db/connection";
import { order_type, order_status, enrollment_source, enrollment_status, cart_item_type } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict.error";
import { NotFoundError } from "../errors/not-found.error";
import { resolveConnection, resolveConnectionById, getAdapter } from "./payment/gateway.factory";
import { resolveGatewayCurrency, type GatewayCurrencyNotice } from "./payment/gateway-currency";
import { buildHostedCheckoutExtras, needsHostedCheckoutExtras } from "./payment/hosted-checkout";
import { getDefaultCurrency, getEnabledCurrencyCodes } from "./currency-context.service";
import * as cartRepo from "../repositories/cart.repository";
import * as ordersRepo from "../repositories/orders.repository";
import { NO_GATEWAY_PROVIDER } from "../repositories/orders.repository";
import { queuePurchaseNotifications } from "../queues/notification.queue";
import logger from "../utils/logger";
import { fetchTenantTaxConfig } from "../utils/tax.util";
import { gatewaySupportsCurrency, toSmallestUnit } from "../utils/currency-registry";
import { assertChargeMatchesOrder, storedGatewayOrderId } from "./payment/order-match";
import { getRate } from "../utils/exchange-rate";
import {
  normalizeCurrencyForTenant,
  resolveContentPrice,
  type PriceSource,
} from "../utils/price-resolver";
import { assertSelfServeAllowed } from "../utils/assert-self-serve";
import { couponItemColumn } from "../utils/coupon-applicability.util";
import type { CreateOrderParams, ResolvedConnection } from "./payment/payment-gateway.types";

const ORDER_NUMBER_PREFIX = "ORD-";

/**
 * Stand-in for `gateway_payment_id` on orders that were settled without a
 * gateway (a coupon took the payable amount to zero). Makes those rows obvious
 * in reports and refund tooling instead of leaving a NULL payment reference.
 */
export const FREE_ORDER_PAYMENT_REF = "FREE_NO_PAYMENT";

export interface CreateOrderBody {
  order_type: order_type;
  item_id: string;
  currency: string;
  coupon_code?: string;
}

export interface CreateOrderResult {
  order_id: string;
  order_number: string;
  gateway_order_id: string;
  amount: number;
  currency: string;
  client_config: Record<string, unknown>;
  /**
   * True when the payable amount came to zero (typically a 100% coupon) and the
   * order was fulfilled server-side. The client must NOT open a payment sheet
   * for these, access has already been granted.
   */
  free?: boolean;
  /**
   * Set ONLY on an Idempotency-Key replay: the item the ORIGINAL payment order
   * references, so a retried request answers with the original's identifiers
   * instead of mixing two orders.
   */
  item_id?: string;
}

export interface VerifyPaymentBody {
  order_id?: string;
  idempotency_key?: string;
  gateway_order_id: string;
  gateway_payment_id: string;
  signature: string;
}


interface ItemPrice {
  baseAmount: number;
  currency: string;
  orderType: order_type;
  /** Where the price came from (PRICE_BOOK / DEFAULT_FALLBACK / LEGACY_COLUMNS); absent for free items. */
  priceSource?: PriceSource;
}

/**
 * Fetches item list price and percentage discount from catalog; returns base amount after discount.
 * Coupon discount is applied later in createOrder. Razorpay order is created with final total.
 */
async function getItemPrice(
  tenantId: string,
  orderType: order_type,
  itemId: string,
  currency: string
): Promise<ItemPrice> {
  if (orderType === order_type.COURSE) {
    const row = await db
      .selectFrom("courses")
      .select(["price_inr", "price_usd", "discount_inr", "discount_usd", "status", "purchase_mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Course not found");
    if (row.status !== "PUBLISHED") throw new BadRequestError("Course is not available for purchase");
    if (String(row.purchase_mode) === "FREE") {
      return { baseAmount: 0, currency: await normalizeCurrencyForTenant(tenantId, currency), orderType: order_type.COURSE };
    }
    const resolved = await resolveContentPrice({
      tenantId, entityType: "COURSE", entityId: itemId, requestedCurrency: currency, legacyRow: row,
    });
    return { baseAmount: resolved.baseAmount, currency: resolved.currency, orderType: order_type.COURSE, priceSource: resolved.priceSource };
  }

  if (orderType === order_type.BOOK) {
    const row = await db
      .selectFrom("books")
      .select(["price_inr", "price_usd", "discount_inr", "discount_usd", "status", "purchase_mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Book not found");
    if (row.status !== "PUBLISHED") throw new BadRequestError("Book is not available for purchase");
    if (String(row.purchase_mode) === "FREE") {
      return { baseAmount: 0, currency: await normalizeCurrencyForTenant(tenantId, currency), orderType: order_type.BOOK };
    }
    const resolved = await resolveContentPrice({
      tenantId, entityType: "BOOK", entityId: itemId, requestedCurrency: currency, legacyRow: row,
    });
    return { baseAmount: resolved.baseAmount, currency: resolved.currency, orderType: order_type.BOOK, priceSource: resolved.priceSource };
  }

  if (orderType === order_type.BUNDLE) {
    const row = await db
      .selectFrom("bundles")
      .select(["price_inr", "price_usd", "discount_inr", "discount_usd", "status", "purchase_mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Bundle not found");
    if (row.status !== "PUBLISHED") throw new BadRequestError("Bundle is not available for purchase");
    if (String(row.purchase_mode) === "FREE") {
      return { baseAmount: 0, currency: await normalizeCurrencyForTenant(tenantId, currency), orderType: order_type.BUNDLE };
    }
    const resolved = await resolveContentPrice({
      tenantId, entityType: "BUNDLE", entityId: itemId, requestedCurrency: currency, legacyRow: row,
    });
    return { baseAmount: resolved.baseAmount, currency: resolved.currency, orderType: order_type.BUNDLE, priceSource: resolved.priceSource };
  }

  if (orderType === order_type.BATCH) {
    const row = await db
      .selectFrom("batches")
      .select([
        "price_inr",
        "price_usd",
        "discount_inr",
        "discount_usd",
        "status",
        "purchase_mode",
        "enrollment_close_date",
      ])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Batch not found");
    if (row.status !== "PUBLISHED")
      throw new BadRequestError("Batch is not available for purchase");
    if (
      row.enrollment_close_date &&
      new Date(row.enrollment_close_date) < new Date()
    ) {
      throw new BadRequestError("Enrollment for this batch has closed");
    }
    if (String(row.purchase_mode) === "FREE") {
      return { baseAmount: 0, currency: await normalizeCurrencyForTenant(tenantId, currency), orderType: order_type.BATCH };
    }
    const resolved = await resolveContentPrice({
      tenantId, entityType: "BATCH", entityId: itemId, requestedCurrency: currency, legacyRow: row,
    });
    return { baseAmount: resolved.baseAmount, currency: resolved.currency, orderType: order_type.BATCH, priceSource: resolved.priceSource };
  }

  if (orderType === order_type.TEST_SERIES) {
    const row = await db
      .selectFrom("test_series")
      .select([
        "price_inr",
        "price_usd",
        "discount_inr",
        "discount_usd",
        "status",
        "pricing_type",
      ])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Test series not found");
    if (row.status !== "PUBLISHED")
      throw new BadRequestError("Test series is not available for purchase");
    if (row.pricing_type === "FREE") {
      return { baseAmount: 0, currency: await normalizeCurrencyForTenant(tenantId, currency), orderType: order_type.TEST_SERIES };
    }
    const resolved = await resolveContentPrice({
      tenantId, entityType: "TEST_SERIES", entityId: itemId, requestedCurrency: currency, legacyRow: row,
    });
    return { baseAmount: resolved.baseAmount, currency: resolved.currency, orderType: order_type.TEST_SERIES, priceSource: resolved.priceSource };
  }

  throw new BadRequestError("Invalid order_type");
}

function toDecimal(v: number): string {
  return String(Number(v.toFixed(2)));
}

/**
 * Bump a coupon's usage, retire it when it hits its cap, and write the
 * redemption row, exactly once per order, guarded by the `coupon_incremented`
 * flag in order metadata so webhook fulfillment, verify-payment fallback and
 * zero-amount fulfillment can each call it safely.
 *
 * No-ops when the order carried no coupon.
 */
async function recordCouponRedemption(
  tenantId: string,
  orderId: string,
  tenantMemberId: string,
  couponId: string | null,
  discountAmount: number | string | null | undefined,
  currency: string | null | undefined
): Promise<void> {
  if (!couponId) return;

  const meta = await ordersRepo.getOrderMetadata(tenantId, orderId);
  if (meta?.coupon_incremented) return;

  await db
    .updateTable("coupons")
    .set((eb) => ({ used_count: eb("used_count", "+", 1) }))
    .where("id", "=", couponId)
    .where("tenant_id", "=", tenantId)
    .execute();
  await ordersRepo.updateOrderMetadata(tenantId, orderId, { ...(meta ?? {}), coupon_incremented: true });

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

  await db
    .insertInto("coupon_redemptions")
    .values({
      id: ulid(),
      tenant_id: tenantId,
      coupon_id: couponId,
      member_id: tenantMemberId,
      order_id: orderId,
      discount_amount: parseFloat(String(discountAmount ?? 0)) as never,
      currency: currency ?? "INR",
      created_at: new Date(),
    } as never)
    .onConflict((oc) => oc.columns(["tenant_id", "coupon_id", "order_id"]).doNothing())
    .execute();
}

/** Drop the purchased item from the buyer's cart once the order is settled. */
async function removeOrderItemFromCart(
  tenantId: string,
  tenantMemberId: string,
  orderType: order_type | string,
  itemId: string
): Promise<void> {
  const itemType =
    orderType === "COURSE" ? cart_item_type.COURSE :
    orderType === "BOOK" ? cart_item_type.BOOK :
    orderType === "BATCH" ? cart_item_type.BATCH :
    cart_item_type.BUNDLE;
  await cartRepo.removeItem(tenantId, tenantMemberId, itemType, itemId);
}

/**
 * Throw a structured ConflictError if the member already has active access to the
 * item being checked out. Covers the "user already paid for this course / book /
 * bundle and shouldn't be charged again" guard. The thrown error carries the slug
 * + title so the controller (and ultimately the frontend) can render a "Start
 * learning" CTA pointing at the right content.
 *
 * Kept narrow on purpose: BATCH has its own enrollment semantics and needs its
 * own check if the same UX is wanted there.
 */
async function assertNoExistingAccess(
  tenantId: string,
  tenantMemberId: string,
  orderType: order_type,
  itemId: string,
): Promise<void> {
  // Validity guard: an enrollment / book_access row only "counts" as access if the
  // status is ACTIVE AND (valid_till is NULL [permanent] OR valid_till is in the
  // future). Expired rows are treated as no access so the buyer can re-purchase.
  const now = new Date();

  if (orderType === order_type.COURSE) {
    const row = await db
      .selectFrom("enrollments")
      .innerJoin("courses", "courses.id", "enrollments.course_id")
      .select(["enrollments.id", "courses.slug", "courses.title"])
      .where("enrollments.tenant_id", "=", tenantId)
      .where("enrollments.tenant_member_id", "=", tenantMemberId)
      .where("enrollments.course_id", "=", itemId)
      .where("enrollments.status", "=", enrollment_status.ACTIVE)
      .where((eb) =>
        eb.or([
          eb("enrollments.valid_till", "is", null),
          eb("enrollments.valid_till", ">", now),
        ]),
      )
      .executeTakeFirst();
    if (row) {
      throw new ConflictError(
        JSON.stringify({
          kind: "ALREADY_HAS_ACCESS",
          orderType: "COURSE",
          itemId,
          slug: row.slug,
          title: row.title,
        }),
      );
    }
    return;
  }

  if (orderType === order_type.BOOK) {
    const row = await db
      .selectFrom("book_access")
      .innerJoin("books", "books.id", "book_access.book_id")
      .select(["book_access.id", "books.slug", "books.title"])
      .where("book_access.tenant_id", "=", tenantId)
      .where("book_access.tenant_member_id", "=", tenantMemberId)
      .where("book_access.book_id", "=", itemId)
      .where("book_access.status", "=", enrollment_status.ACTIVE)
      .where((eb) =>
        eb.or([
          eb("book_access.valid_till", "is", null),
          eb("book_access.valid_till", ">", now),
        ]),
      )
      .executeTakeFirst();
    if (row) {
      throw new ConflictError(
        JSON.stringify({
          kind: "ALREADY_HAS_ACCESS",
          orderType: "BOOK",
          itemId,
          slug: row.slug,
          title: row.title,
        }),
      );
    }
    return;
  }

  if (orderType === order_type.BUNDLE) {
    const bundle = await db
      .selectFrom("bundles")
      .select(["id", "slug", "title"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!bundle) return;

    const items = await db
      .selectFrom("bundle_items")
      .select(["course_id", "book_id"])
      .where("tenant_id", "=", tenantId)
      .where("bundle_id", "=", itemId)
      .execute();
    const courseIds = items.map((i) => i.course_id).filter((id): id is string => !!id);
    const bookIds = items.map((i) => i.book_id).filter((id): id is string => !!id);

    let ownedCourses = 0;
    if (courseIds.length > 0) {
      const enrolled = await db
        .selectFrom("enrollments")
        .select("course_id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", tenantMemberId)
        .where("course_id", "in", courseIds)
        .where("status", "=", enrollment_status.ACTIVE)
        .where((eb) =>
          eb.or([
            eb("valid_till", "is", null),
            eb("valid_till", ">", now),
          ]),
        )
        .execute();
      ownedCourses = enrolled.length;
    }
    let ownedBooks = 0;
    if (bookIds.length > 0) {
      const access = await db
        .selectFrom("book_access")
        .select("book_id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", tenantMemberId)
        .where("book_id", "in", bookIds)
        .where("status", "=", enrollment_status.ACTIVE)
        .where((eb) =>
          eb.or([
            eb("valid_till", "is", null),
            eb("valid_till", ">", now),
          ]),
        )
        .execute();
      ownedBooks = access.length;
    }
    // Block only when the buyer already owns the entire bundle with non-expired
    // validity for every item. Partial / expired overlap is allowed through.
    // buyer might want to renew or consolidate via the bundle.
    if (
      courseIds.length + bookIds.length > 0 &&
      ownedCourses === courseIds.length &&
      ownedBooks === bookIds.length
    ) {
      throw new ConflictError(
        JSON.stringify({
          kind: "ALREADY_HAS_ACCESS",
          orderType: "BUNDLE",
          itemId,
          slug: bundle.slug,
          title: bundle.title,
        }),
      );
    }
  }
}

function amountToSmallestUnit(amount: number, currency: string): number {
  return toSmallestUnit(amount, currency);
}

export async function createOrder(
  tenantId: string,
  tenantMemberId: string,
  body: CreateOrderBody,
  idempotencyKey: string | null,
  requestContext?: { country?: string | null }
): Promise<CreateOrderResult> {
  await assertSelfServeAllowed(tenantId);

  // Resolved here, but NOT required yet. A coupon can take the payable amount
  // to zero, and there is nothing for a gateway to collect on a zero-payable
  // order. Demanding a connection up front (as this used to) made a 100%-off
  // coupon impossible on any tenant that has not attached a gateway. The
  // requirement is deferred until `isFreeOrder` is known, see `requireGateway`
  // below.
  const connection = await resolveConnection(tenantId);

  const orderType = body.order_type;

  // Block re-purchase if the buyer already owns this content. Throws a structured
  // ConflictError that the controller translates to a 409 with kind=ALREADY_HAS_ACCESS;
  // the frontend renders a "You already have access, start learning" view instead
  // of charging the buyer again.
  await assertNoExistingAccess(tenantId, tenantMemberId, orderType, body.item_id);

  // Requested currency must be enabled for the tenant; anything else (including
  // the historical default of treating non-USD as INR) resolves to the tenant
  // default currency.
  const enabledCurrencies = await getEnabledCurrencyCodes(tenantId);
  const requestedRaw = String(body.currency ?? "").toUpperCase();
  const requestedCurrency = enabledCurrencies.includes(requestedRaw)
    ? requestedRaw
    : await getDefaultCurrency(tenantId);

  // Price first (may fall back to the tenant default currency when the item has
  // no price in the requested one), then validate the FINAL currency against the
  // gateway capability matrix;
  // unsupported currencies fail loudly instead of charging the wrong amount.
  let itemPrice = await getItemPrice(tenantId, orderType, body.item_id, requestedCurrency);
  let currencyNotice: GatewayCurrencyNotice | null = null;
  // Gateway currency limitations are collected rather than thrown: they only
  // matter for an order that actually reaches the gateway. A zero-payable order
  // never does, so it must not be blocked by one. Re-thrown by `requireGateway`
  // below once the payable amount is known.
  let gatewayCurrencyError: Error | null = null;
  if (connection) {
    let gatewayResolution: { currency: string; notice: GatewayCurrencyNotice | null } | null = null;
    try {
      gatewayResolution = resolveGatewayCurrency(
        itemPrice.currency,
        connection.provider_name,
        enabledCurrencies,
      );
    } catch (err) {
      gatewayResolution = null;
      gatewayCurrencyError = err instanceof Error ? err : new Error(String(err));
    }
    if (gatewayResolution) {
      currencyNotice = gatewayResolution.notice;
      if (gatewayResolution.currency !== itemPrice.currency) {
        logger.info(
          `[checkout] ${connection.provider_name} active for tenant=${tenantId}: forcing currency ${itemPrice.currency}→${gatewayResolution.currency} for order_type=${orderType} item=${body.item_id}`,
        );
        itemPrice = await getItemPrice(tenantId, orderType, body.item_id, gatewayResolution.currency);
        if (!gatewaySupportsCurrency(connection.provider_name, itemPrice.currency)) {
          gatewayCurrencyError = new BadRequestError(
            `This store's payment gateway (${connection.provider_name}) cannot charge ${itemPrice.currency}`,
          );
        }
      }
    }
  }
  const currency = itemPrice.currency;

  const baseAmountFromItem = itemPrice.baseAmount;
  let discountAmount = 0;
  let couponId: string | null = null;
  let couponCodeSnapshot: string | null = null;

  if (body.coupon_code?.trim()) {
    const couponCode = body.coupon_code.trim().toUpperCase();
    const coupon = await db
      .selectFrom("coupons")
      .select(["id", "code", "discount_type", "discount_value", "currency", "is_active", "valid_from", "valid_to", "max_uses", "max_uses_per_user", "used_count"])
      .where("tenant_id", "=", tenantId)
      .where("code", "=", couponCode)
      .executeTakeFirst();
    if (!coupon || !coupon.is_active) throw new BadRequestError("Invalid or inactive coupon");
    // FIXED coupons are currency-scoped (a NULL currency on legacy rows means INR);
    // PERCENTAGE coupons apply in any currency.
    if (coupon.discount_type === "FIXED") {
      const couponCurrency = (coupon.currency ?? "INR").toUpperCase();
      if (couponCurrency !== currency) {
        throw new BadRequestError(`This coupon is only valid for ${couponCurrency} orders`);
      }
    }
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) throw new BadRequestError("Coupon not yet valid");
    if (coupon.valid_to && new Date(coupon.valid_to) < now) throw new BadRequestError("Coupon expired");
    if (coupon.max_uses != null && Number(coupon.used_count) >= coupon.max_uses) throw new BadRequestError("Coupon is no longer valid");

    // Per-user limit check
    if (coupon.max_uses_per_user != null) {
      const userUsage = await db
        .selectFrom("coupon_redemptions")
        .select(db.fn.count<number>("id").as("count"))
        .where("tenant_id", "=", tenantId)
        .where("coupon_id", "=", coupon.id)
        .where("member_id", "=", tenantMemberId)
        .executeTakeFirst();
      const used = typeof userUsage?.count === "string" ? parseInt(userUsage.count, 10) : Number(userUsage?.count ?? 0);
      if (used >= coupon.max_uses_per_user) throw new BadRequestError("You have reached the maximum uses for this coupon");
    }

    const itemId = body.item_id;
    const applicable = await db
      .selectFrom("coupon_applicable_items")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("coupon_id", "=", coupon.id)
      .where(couponItemColumn(orderType), "=", itemId)
      .executeTakeFirst();
    const hasApplicableItems = await db
      .selectFrom("coupon_applicable_items")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("coupon_id", "=", coupon.id)
      .executeTakeFirst();
    if (hasApplicableItems && !applicable) throw new BadRequestError("Coupon not applicable to this item");

    const discountVal = parseFloat(String(coupon.discount_value));
    if (coupon.discount_type === "PERCENTAGE") {
      discountAmount = (baseAmountFromItem * discountVal) / 100;
    } else {
      discountAmount = Math.min(discountVal, baseAmountFromItem);
    }
    discountAmount = Math.min(discountAmount, baseAmountFromItem);
    couponId = coupon.id;
    couponCodeSnapshot = coupon.code;
  }

  const netAmount = Math.max(0, baseAmountFromItem - discountAmount);

  // Tax calculation
  const taxConfig = await fetchTenantTaxConfig(tenantId);
  let taxAmount = 0;
  let totalAmount = netAmount;

  if (
    netAmount > 0 &&
    taxConfig.taxPercentage > 0 &&
    taxConfig.taxMode === "EXCLUSIVE"
  ) {
    taxAmount = +(netAmount * taxConfig.taxPercentage / 100).toFixed(2);
    totalAmount = +(netAmount + taxAmount).toFixed(2);
  }
  // INCLUSIVE: totalAmount = netAmount (tax already embedded in price)

  // A coupon (or an item discount) can take the payable amount to zero. There is
  // nothing for a gateway to collect, so the order is settled in-process below
  // instead of being handed to the gateway: same order row, same fulfillment,
  // same coupon accounting, just no payment step. See the `isFreeOrder` branch
  // after the order is created.
  const isFreeOrder = totalAmount <= 0;

  // The deferred gateway requirement. Everything a gateway is needed for.
  // having a connection at all, and that connection being able to charge this
  // currency, is enforced here, and only for an order that actually has to be
  // paid. A zero-payable order is a FREE enrollment: it is settled in-process
  // below and never touches a gateway, so a tenant that has none is fine.
  if (!isFreeOrder) {
    if (!connection) throw new BadRequestError("No active payment gateway configured");
    if (gatewayCurrencyError) throw gatewayCurrencyError;
  }

  // Tenants collect through their own gateway account, so the platform takes
  // no cut and the full amount is the tenant's payout.
  const platformFee = 0;
  const tenantPayoutAmount: number | null = totalAmount;

  const orderNumber = `${ORDER_NUMBER_PREFIX}${ulid().toLowerCase().slice(-8)}`;

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
      amount: amountToSmallestUnit(parseFloat(existingByKey.total_amount), existingByKey.currency),
      currency: existingByKey.currency,
      client_config: (existingByKey.client_config as Record<string, unknown>) ?? {},
      item_id: existingByKey.item_id,
    };
  }

  // FX snapshot to the tenant default currency, captured at order time for
  // reporting and payout math. Best-effort: never blocks checkout.
  const tenantDefaultCurrency = await getDefaultCurrency(tenantId);
  let fxRateToDefault: number | null = null;
  let fxSource: string | null = null;
  let fxFetchedAt: string | null = null;
  try {
    const fx = await getRate(currency, tenantDefaultCurrency);
    fxRateToDefault = fx.rate;
    fxSource = fx.source;
    fxFetchedAt = fx.fetchedAt.toISOString();
  } catch {
    // Rate unavailable for this pair; columns stay NULL.
  }

  const createMetadata: Record<string, unknown> = {};
  if (itemPrice.priceSource) createMetadata.price_source = itemPrice.priceSource;
  if (fxSource) {
    createMetadata.fx_source = fxSource;
    createMetadata.fx_fetched_at = fxFetchedAt;
  }

  const orderId = await ordersRepo.createOrder({
    tenant_id: tenantId,
    tenant_member_id: tenantMemberId,
    // NULL only ever reaches here for a zero-payable order: the requireGateway
    // gate above threw for anything payable. assertGatewayInvariant in the
    // repository re-checks that at the write itself.
    gateway_connection_id: connection?.connection_id ?? null,
    order_number: orderNumber,
    order_type: orderType,
    item_id: body.item_id,
    currency,
    base_amount: toDecimal(baseAmountFromItem),
    discount_amount: toDecimal(discountAmount),
    coupon_id: couponId,
    coupon_code_snapshot: couponCodeSnapshot,
    net_amount: toDecimal(netAmount),
    tax_amount: toDecimal(taxAmount),
    total_amount: toDecimal(totalAmount),
    platform_fee: toDecimal(platformFee),
    tenant_payout_amount: tenantPayoutAmount != null ? toDecimal(tenantPayoutAmount) : null,
    gateway_provider_name: connection?.provider_name ?? NO_GATEWAY_PROVIDER,
    idempotency_key: idempotencyKey,
    metadata: Object.keys(createMetadata).length > 0 ? createMetadata : null,
    resolved_country: requestContext?.country ?? null,
    tenant_default_currency: tenantDefaultCurrency,
    fx_rate_to_tenant_default: fxRateToDefault !== null ? String(fxRateToDefault) : null,
  });

  // Zero payable: settle the order here and grant access. The gateway is never
  // called (gateways reject zero-amount orders), but everything
  // else, order row, coupon redemption, fulfillment, cart cleanup, runs
  // exactly as it does after a real payment.
  if (isFreeOrder) {
    const freeMetadata: Record<string, unknown> = {
      ...createMetadata,
      free_order: true,
      tax_config: {
        mode: taxConfig.taxMode,
        percentage: taxConfig.taxPercentage,
        isIndian: taxConfig.isIndian,
      },
    };
    await ordersRepo.updateOrderMetadata(tenantId, orderId, freeMetadata);
    await ordersRepo.updateOrderToPaid(tenantId, orderId, FREE_ORDER_PAYMENT_REF, null);

    await grantAccessForSingleItem(
      tenantId, tenantMemberId,
      orderType, body.item_id,
      couponId, connection, orderId
    );
    await recordCouponRedemption(tenantId, orderId, tenantMemberId, couponId, discountAmount, currency);
    await ordersRepo.markOrderFulfilled(tenantId, orderId);
    await removeOrderItemFromCart(tenantId, tenantMemberId, orderType, body.item_id);

    // A fully-discounted order is still a purchase: the buyer gets their
    // confirmation and the tenant owner gets their alert.
    queuePurchaseNotifications({
      tenantId,
      orderId,
      memberId: tenantMemberId,
      orderType,
    });

    logger.info("[checkout] Zero-amount order fulfilled without gateway", {
      tenantId, orderId, orderType, couponCode: couponCodeSnapshot,
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

  // Payable from here on, and requireGateway above proved a payable order has a
  // connection. This re-check is what narrows the type for the adapter call.
  if (!connection) throw new BadRequestError("No active payment gateway configured");

  const adapter = getAdapter(connection);
  const amountPaise = amountToSmallestUnit(totalAmount, currency);
  const adapterParams: CreateOrderParams = {
    amount: amountPaise,
    currency,
    receipt: orderNumber,
    notes: { order_id: orderId, order_type: orderType, item_id: body.item_id },
  };
  // Hosted-checkout gateways (Stripe) need to know who is paying and where to
  // send them afterwards. Razorpay's checkout collects buyer details itself.
  if (needsHostedCheckoutExtras(connection.provider_name)) {
    const productInfoMap: Record<string, string> = {
      COURSE: "Course Purchase",
      BOOK: "Book Purchase",
      BUNDLE: "Bundle Purchase",
      BATCH: "Batch Enrollment",
      TEST_SERIES: "Test Series Purchase",
      CART: "Cart Purchase",
    };
    Object.assign(
      adapterParams,
      await buildHostedCheckoutExtras({
        tenantId,
        tenantMemberId,
        orderId,
        productInfo: productInfoMap[orderType] ?? "Order",
      })
    );
  }
  const result = await adapter.createOrder(adapterParams);

  const orderMetadata: Record<string, unknown> = { client_config: result.client_config };
  orderMetadata.tax_config = {
    mode: taxConfig.taxMode,
    percentage: taxConfig.taxPercentage,
    isIndian: taxConfig.isIndian,
  };
  if (currency !== requestedCurrency) {
    orderMetadata.requested_currency = requestedCurrency;
    orderMetadata.currency_overridden_reason =
      currencyNotice?.reason ??
      (itemPrice.priceSource === "DEFAULT_FALLBACK"
        ? "DEFAULT_CURRENCY_FALLBACK"
        : "GATEWAY_LIMITATION");
  }
  await ordersRepo.updateOrderToPaymentPending(
    tenantId,
    orderId,
    result.gateway_order_id,
    orderMetadata
  );

  return {
    order_id: orderId,
    order_number: orderNumber,
    gateway_order_id: result.gateway_order_id,
    amount: amountPaise,
    currency,
    // Surface (not silence) gateway-forced currency switches so the frontend
    // can tell the buyer what they will actually be charged in.
    client_config: currencyNotice
      ? { ...result.client_config, currency_notice: currencyNotice }
      : result.client_config,
  };
}

export interface FreeEnrollBody {
  order_type: "COURSE" | "BOOK" | "BUNDLE" | "BATCH" | "TEST_SERIES";
  item_id: string;
}

/**
 * Grant access for a FREE course or book (no payment).
 * Uses enrollment_source.FREE. Same compliance as post-payment flow.
 */
async function grantAccessForFreeItem(
  tenantId: string,
  tenantMemberId: string,
  orderType: "COURSE" | "BOOK",
  itemId: string
): Promise<void> {
  const now = new Date();

  if (orderType === "COURSE") {
    const courseValidity = await db
      .selectFrom("courses")
      .select("validity_days")
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const validTill =
      courseValidity?.validity_days != null
        ? new Date(now.getTime() + courseValidity.validity_days * 24 * 60 * 60 * 1000)
        : null;

    await db
      .insertInto("enrollments")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        tenant_member_id: tenantMemberId,
        course_id: itemId,
        status: enrollment_status.ACTIVE,
        source: enrollment_source.FREE,
        enrolled_at: now,
        valid_till: validTill ?? undefined,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "course_id"]).doUpdateSet({
        status: enrollment_status.ACTIVE,
        source: enrollment_source.FREE,
        valid_till: validTill ?? undefined,
        updated_at: now,
      }))
      .execute();
    return;
  }

  if (orderType === "BOOK") {
    const bookValidity = await db
      .selectFrom("books")
      .select("validity_days")
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const validTill =
      bookValidity?.validity_days != null
        ? new Date(now.getTime() + bookValidity.validity_days * 24 * 60 * 60 * 1000)
        : null;

    await db
      .insertInto("book_access")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        tenant_member_id: tenantMemberId,
        book_id: itemId,
        status: enrollment_status.ACTIVE,
        source: enrollment_source.FREE,
        valid_till: validTill ?? undefined,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "book_id"]).doUpdateSet({
        status: enrollment_status.ACTIVE,
        source: enrollment_source.FREE,
        valid_till: validTill ?? undefined,
        updated_at: now,
      }))
      .execute();
  }
}

/**
 * valid_till for a test-series enrollment: an absolute `end_date` (hard expiry)
 * wins; otherwise `validity_days` counted from enrolment; otherwise null
 * (lifetime). Mirrors the batch precedence.
 */
function computeSeriesValidTill(
  now: Date,
  validityDays: number | null | undefined,
  endDate: Date | string | null | undefined
): Date | null {
  if (endDate) {
    return endDate instanceof Date ? endDate : new Date(endDate as string);
  }
  if (validityDays != null) {
    return new Date(now.getTime() + Number(validityDays) * 24 * 60 * 60 * 1000);
  }
  return null;
}

/**
 * Grant access for a FREE bundle (no payment).
 * Creates enrollments and book_access for all bundle items with enrollment_source.FREE and source_bundle_id.
 */
async function grantAccessForFreeBundle(
  tenantId: string,
  tenantMemberId: string,
  bundleId: string,
  validityDays: number | null
): Promise<void> {
  const now = new Date();
  const validTill =
    validityDays != null
      ? new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000)
      : null;

  const items = await db
    .selectFrom("bundle_items")
    .select(["course_id", "book_id", "test_series_id"])
    .where("tenant_id", "=", tenantId)
    .where("bundle_id", "=", bundleId)
    .execute();

  for (const item of items) {
    if (item.course_id) {
      await db
        .insertInto("enrollments")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          tenant_member_id: tenantMemberId,
          course_id: item.course_id,
          status: enrollment_status.ACTIVE,
          source: enrollment_source.FREE,
          source_bundle_id: bundleId,
          enrolled_at: now,
          valid_till: validTill ?? undefined,
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "course_id"]).doUpdateSet({
          status: enrollment_status.ACTIVE,
          source: enrollment_source.FREE,
          source_bundle_id: bundleId,
          valid_till: validTill ?? undefined,
          updated_at: now,
        }))
        .execute();
    }
    if (item.book_id) {
      await db
        .insertInto("book_access")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          tenant_member_id: tenantMemberId,
          book_id: item.book_id,
          status: enrollment_status.ACTIVE,
          source: enrollment_source.FREE,
          source_bundle_id: bundleId,
          valid_till: validTill ?? undefined,
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "book_id"]).doUpdateSet({
          status: enrollment_status.ACTIVE,
          source: enrollment_source.FREE,
          source_bundle_id: bundleId,
          valid_till: validTill ?? undefined,
          updated_at: now,
        }))
        .execute();
    }
    if (item.test_series_id) {
      await db
        .insertInto("test_series_enrollments")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          tenant_member_id: tenantMemberId,
          test_series_id: item.test_series_id,
          status: "ACTIVE",
          source: "BUNDLE",
          enrolled_at: now,
          valid_till: validTill ?? undefined,
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "test_series_id"]).doUpdateSet({
          status: "ACTIVE",
          source: "BUNDLE",
          valid_till: validTill ?? undefined,
          updated_at: now,
        }))
        .execute();
    }
  }
}

/**
 * Grant access for a FREE batch (no payment).
 * Mirrors the BATCH branch of grantAccessForSingleItem: writes a batch_enrollments
 * row plus per-child enrollments/book_access stamped source=BATCH so /learn flows
 * keep working unchanged. Differs only in source/order/coupon on the parent row.
 */
async function grantAccessForFreeBatch(
  tenantId: string,
  tenantMemberId: string,
  batchId: string
): Promise<void> {
  const now = new Date();

  const batch = await db
    .selectFrom("batches")
    .select(["validity_days", "duration_days", "end_date"])
    .where("id", "=", batchId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  if (!batch) {
    throw new NotFoundError("Batch not found");
  }

  const items = await db
    .selectFrom("batch_items")
    .select(["course_id", "book_id"])
    .where("tenant_id", "=", tenantId)
    .where("batch_id", "=", batchId)
    .execute();

  // valid_till precedence (matches paid batch grant):
  //   1. batch.end_date (cohort hard expiry)
  //   2. now + duration_days
  //   3. now + validity_days
  //   4. null (lifetime)
  let validTill: Date | null = null;
  if (batch.end_date) {
    validTill =
      batch.end_date instanceof Date
        ? batch.end_date
        : new Date(batch.end_date as unknown as string);
  } else if (batch.duration_days != null) {
    validTill = new Date(
      now.getTime() + Number(batch.duration_days) * 24 * 60 * 60 * 1000
    );
  } else if (batch.validity_days != null) {
    validTill = new Date(
      now.getTime() + Number(batch.validity_days) * 24 * 60 * 60 * 1000
    );
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("batch_enrollments")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        batch_id: batchId,
        tenant_member_id: tenantMemberId,
        joined_at: now,
        valid_till: validTill ?? undefined,
        status: enrollment_status.ACTIVE,
        source: enrollment_source.FREE,
        source_order_id: null,
        source_coupon_id: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc
          .columns(["tenant_id", "batch_id", "tenant_member_id"])
          .doUpdateSet({
            status: enrollment_status.ACTIVE,
            source: enrollment_source.FREE,
            source_order_id: null,
            source_coupon_id: null,
            valid_till: validTill ?? undefined,
            updated_at: now,
          })
      )
      .execute();

    for (const item of items) {
      if (item.course_id) {
        await trx
          .insertInto("enrollments")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            tenant_member_id: tenantMemberId,
            course_id: item.course_id,
            status: enrollment_status.ACTIVE,
            source: enrollment_source.BATCH,
            source_batch_id: batchId,
            enrolled_at: now,
            valid_till: validTill ?? undefined,
            created_at: now,
            updated_at: now,
          })
          .onConflict((oc) =>
            oc
              .columns(["tenant_id", "tenant_member_id", "course_id"])
              .doUpdateSet({
                status: enrollment_status.ACTIVE,
                source: enrollment_source.BATCH,
                source_batch_id: batchId,
                valid_till: validTill ?? undefined,
                updated_at: now,
              })
          )
          .execute();
      }
      if (item.book_id) {
        await trx
          .insertInto("book_access")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            tenant_member_id: tenantMemberId,
            book_id: item.book_id,
            status: enrollment_status.ACTIVE,
            source: enrollment_source.BATCH,
            source_batch_id: batchId,
            valid_till: validTill ?? undefined,
            created_at: now,
            updated_at: now,
          })
          .onConflict((oc) =>
            oc
              .columns(["tenant_id", "tenant_member_id", "book_id"])
              .doUpdateSet({
                status: enrollment_status.ACTIVE,
                source: enrollment_source.BATCH,
                source_batch_id: batchId,
                valid_till: validTill ?? undefined,
                updated_at: now,
              })
          )
          .execute();
      }
    }

    await trx
      .updateTable("batches")
      .set({
        total_enrollments: (eb) => eb("total_enrollments", "+", 1),
        updated_at: now,
      })
      .where("id", "=", batchId)
      .where("tenant_id", "=", tenantId)
      .execute();
  });
}

/**
 * Enroll in a FREE course or book without payment.
 * Validates item is published, purchase_mode is FREE, and user does not already have access.
 * Grants access with enrollment_source.FREE (same compliance as post-payment flow).
 */
export async function freeEnroll(
  tenantId: string,
  tenantMemberId: string,
  body: FreeEnrollBody
): Promise<{ success: boolean; order_type: string; item_id: string }> {
  await assertSelfServeAllowed(tenantId);

  const { order_type: orderType, item_id: itemId } = body;

  // An item is "free to enroll" when it's marked FREE OR its effective price
  // (after the item's own discount) resolves to 0, e.g. a 100%-off paid item.
  // This keeps the free-enroll path and checkout from deadlocking ("amount is
  // zero, use free enrollment" vs "not free, use checkout").
  let isEffectivelyFree = false;
  try {
    const priced = await getItemPrice(tenantId, orderType, itemId, "INR");
    isEffectivelyFree = Number(priced.baseAmount) <= 0;
  } catch {
    // Fall through to the per-type guards below if pricing can't be resolved.
  }

  // Same validity guard as assertNotAlreadyOwned: a row only counts as access
  // while status is ACTIVE AND (valid_till IS NULL [lifetime] OR still future).
  // Without the valid_till clause an expired grant would short-circuit the
  // re-grant below, leaving the member owning a dead row with no way back in.
  const now = new Date();

  if (orderType === order_type.COURSE) {
    const row = await db
      .selectFrom("courses")
      .select(["id", "status", "purchase_mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Course not found");
    if (row.status !== "PUBLISHED") throw new BadRequestError("Course is not available for enrollment");
    if (String(row.purchase_mode) !== "FREE" && !isEffectivelyFree) {
      throw new BadRequestError("This course is not free. Use checkout to purchase.");
    }

    const existing = await db
      .selectFrom("enrollments")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", tenantMemberId)
      .where("course_id", "=", itemId)
      .where("status", "=", enrollment_status.ACTIVE)
      .where((eb) =>
        eb.or([eb("valid_till", "is", null), eb("valid_till", ">", now)]),
      )
      .executeTakeFirst();
    if (existing) {
      return { success: true, order_type: "COURSE", item_id: itemId };
    }

    await grantAccessForFreeItem(tenantId, tenantMemberId, "COURSE", itemId);
    return { success: true, order_type: "COURSE", item_id: itemId };
  }

  if (orderType === order_type.BOOK) {
    const row = await db
      .selectFrom("books")
      .select(["id", "status", "purchase_mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Book not found");
    if (row.status !== "PUBLISHED") throw new BadRequestError("Book is not available for enrollment");
    if (String(row.purchase_mode) !== "FREE" && !isEffectivelyFree) {
      throw new BadRequestError("This book is not free. Use checkout to purchase.");
    }

    const existing = await db
      .selectFrom("book_access")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", tenantMemberId)
      .where("book_id", "=", itemId)
      .where("status", "=", enrollment_status.ACTIVE)
      .where((eb) =>
        eb.or([eb("valid_till", "is", null), eb("valid_till", ">", now)]),
      )
      .executeTakeFirst();
    if (existing) {
      return { success: true, order_type: "BOOK", item_id: itemId };
    }

    await grantAccessForFreeItem(tenantId, tenantMemberId, "BOOK", itemId);
    return { success: true, order_type: "BOOK", item_id: itemId };
  }

  if (orderType === order_type.BUNDLE) {
    const row = await db
      .selectFrom("bundles")
      .select(["id", "status", "purchase_mode", "validity_days"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Bundle not found");
    if (row.status !== "PUBLISHED") throw new BadRequestError("Bundle is not available for enrollment");
    if (String(row.purchase_mode) !== "FREE" && !isEffectivelyFree) {
      throw new BadRequestError("This bundle is not free. Use checkout to purchase.");
    }

    const items = await db
      .selectFrom("bundle_items")
      .select(["course_id", "book_id"])
      .where("tenant_id", "=", tenantId)
      .where("bundle_id", "=", itemId)
      .execute();
    const courseIds = items.filter((i) => i.course_id).map((i) => i.course_id!);
    const bookIds = items.filter((i) => i.book_id).map((i) => i.book_id!);

    let ownedCourses = 0;
    let ownedBooks = 0;
    if (courseIds.length > 0) {
      const enrolled = await db
        .selectFrom("enrollments")
        .select("course_id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", tenantMemberId)
        .where("course_id", "in", courseIds)
        .where("status", "=", enrollment_status.ACTIVE)
        .where((eb) =>
          eb.or([eb("valid_till", "is", null), eb("valid_till", ">", now)]),
        )
        .execute();
      ownedCourses = enrolled.length;
    }
    if (bookIds.length > 0) {
      const access = await db
        .selectFrom("book_access")
        .select("book_id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", tenantMemberId)
        .where("book_id", "in", bookIds)
        .where("status", "=", enrollment_status.ACTIVE)
        .where((eb) =>
          eb.or([eb("valid_till", "is", null), eb("valid_till", ">", now)]),
        )
        .execute();
      ownedBooks = access.length;
    }
    const hasAccess = ownedCourses === courseIds.length && ownedBooks === bookIds.length;
    if (hasAccess) {
      return { success: true, order_type: "BUNDLE", item_id: itemId };
    }

    await grantAccessForFreeBundle(tenantId, tenantMemberId, itemId, row.validity_days);
    return { success: true, order_type: "BUNDLE", item_id: itemId };
  }

  if (orderType === order_type.BATCH) {
    const row = await db
      .selectFrom("batches")
      .select([
        "id",
        "status",
        "purchase_mode",
        "enrollment_open_date",
        "enrollment_close_date",
      ])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Batch not found");
    if (row.status !== "PUBLISHED") throw new BadRequestError("Batch is not available for enrollment");
    if (String(row.purchase_mode) !== "FREE" && !isEffectivelyFree) {
      throw new BadRequestError("This batch is not free. Use checkout to purchase.");
    }

    const now = new Date();
    if (row.enrollment_open_date) {
      const opens =
        row.enrollment_open_date instanceof Date
          ? row.enrollment_open_date
          : new Date(row.enrollment_open_date as unknown as string);
      if (opens.getTime() > now.getTime()) {
        throw new BadRequestError("Enrollment has not started yet");
      }
    }
    if (row.enrollment_close_date) {
      const closes =
        row.enrollment_close_date instanceof Date
          ? row.enrollment_close_date
          : new Date(row.enrollment_close_date as unknown as string);
      if (closes.getTime() < now.getTime()) {
        throw new BadRequestError("Enrollment has closed");
      }
    }

    const existing = await db
      .selectFrom("batch_enrollments")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", tenantMemberId)
      .where("batch_id", "=", itemId)
      .where("status", "=", enrollment_status.ACTIVE)
      .executeTakeFirst();
    if (existing) {
      return { success: true, order_type: "BATCH", item_id: itemId };
    }

    await grantAccessForFreeBatch(tenantId, tenantMemberId, itemId);
    return { success: true, order_type: "BATCH", item_id: itemId };
  }

  if (orderType === order_type.TEST_SERIES) {
    const row = await db
      .selectFrom("test_series")
      .select(["id", "status", "pricing_type", "validity_days", "end_date"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Test series not found");
    if (row.status !== "PUBLISHED") {
      throw new BadRequestError("Test series is not available for enrollment");
    }
    if (String(row.pricing_type) !== "FREE" && !isEffectivelyFree) {
      throw new BadRequestError(
        "This test series is not free. Use checkout to purchase."
      );
    }

    const now = new Date();
    const validTill = computeSeriesValidTill(now, row.validity_days, row.end_date);

    await db
      .insertInto("test_series_enrollments")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        tenant_member_id: tenantMemberId,
        test_series_id: itemId,
        status: "ACTIVE",
        source: "FREE",
        enrolled_at: now,
        valid_till: validTill,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc
          .columns(["tenant_id", "tenant_member_id", "test_series_id"])
          .doUpdateSet({
            status: "ACTIVE",
            valid_till: validTill,
            updated_at: now,
          })
      )
      .execute();
    return { success: true, order_type: "TEST_SERIES", item_id: itemId };
  }

  throw new BadRequestError("Invalid order_type. Use COURSE, BOOK, BUNDLE, BATCH, or TEST_SERIES.");
}

/**
 * Grant access for a single item (course, book, or bundle).
 * Extracted so cart checkout can reuse for each item in a multi-item order.
 */
export async function grantAccessForSingleItem(
  tenantId: string,
  tenantMemberId: string,
  orderType: order_type,
  itemId: string,
  couponId: string | null,
  // Unused. Nullable because a zero-payable order settled without a gateway has
  // no connection to pass.
  _connection: ResolvedConnection | null,
  orderId?: string
): Promise<void> {
  logger.info("[access-grant] Granting access", {
    tenantId, tenantMemberId, orderType, itemId, orderId,
  });
  const now = new Date();

  if (orderType === order_type.COURSE) {
    const courseValidity = await db
      .selectFrom("courses")
      .select("validity_days")
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const validTill =
      courseValidity?.validity_days != null
        ? new Date(now.getTime() + courseValidity.validity_days * 24 * 60 * 60 * 1000)
        : null;

    await db
      .insertInto("enrollments")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        tenant_member_id: tenantMemberId,
        course_id: itemId,
        status: enrollment_status.ACTIVE,
        source: enrollment_source.PURCHASED,
        source_coupon_id: couponId,
        enrolled_at: now,
        valid_till: validTill ?? undefined,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "course_id"]).doUpdateSet({
        status: enrollment_status.ACTIVE,
        source: enrollment_source.PURCHASED,
        source_coupon_id: couponId,
        valid_till: validTill ?? undefined,
        updated_at: now,
      }))
      .execute();
    return;
  }

  if (orderType === order_type.BOOK) {
    const bookValidity = await db
      .selectFrom("books")
      .select("validity_days")
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const validTill =
      bookValidity?.validity_days != null
        ? new Date(now.getTime() + bookValidity.validity_days * 24 * 60 * 60 * 1000)
        : null;

    await db
      .insertInto("book_access")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        tenant_member_id: tenantMemberId,
        book_id: itemId,
        status: enrollment_status.ACTIVE,
        source: enrollment_source.PURCHASED,
        source_coupon_id: couponId,
        valid_till: validTill ?? undefined,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "book_id"]).doUpdateSet({
        status: enrollment_status.ACTIVE,
        source: enrollment_source.PURCHASED,
        source_coupon_id: couponId,
        valid_till: validTill ?? undefined,
        updated_at: now,
      }))
      .execute();
    return;
  }

  if (orderType === order_type.BUNDLE) {
    const items = await db
      .selectFrom("bundle_items")
      .select(["course_id", "book_id", "test_series_id", "item_type"])
      .where("tenant_id", "=", tenantId)
      .where("bundle_id", "=", itemId)
      .execute();

    const validityDays = await db
      .selectFrom("bundles")
      .select("validity_days")
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const validTill =
      validityDays?.validity_days != null
        ? new Date(now.getTime() + validityDays.validity_days * 24 * 60 * 60 * 1000)
        : null;

    for (const item of items) {
      if (item.course_id) {
        await db
          .insertInto("enrollments")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            tenant_member_id: tenantMemberId,
            course_id: item.course_id,
            status: enrollment_status.ACTIVE,
            source: enrollment_source.BUNDLE,
            source_bundle_id: itemId,
            enrolled_at: now,
            valid_till: validTill ?? undefined,
            created_at: now,
            updated_at: now,
          })
          .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "course_id"]).doUpdateSet({
            status: enrollment_status.ACTIVE,
            source: enrollment_source.BUNDLE,
            source_bundle_id: itemId,
            valid_till: validTill ?? undefined,
            updated_at: now,
          }))
          .execute();
      }
      if (item.book_id) {
        await db
          .insertInto("book_access")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            tenant_member_id: tenantMemberId,
            book_id: item.book_id,
            status: enrollment_status.ACTIVE,
            source: enrollment_source.BUNDLE,
            source_bundle_id: itemId,
            valid_till: validTill ?? undefined,
            created_at: now,
            updated_at: now,
          })
          .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "book_id"]).doUpdateSet({
            status: enrollment_status.ACTIVE,
            source: enrollment_source.BUNDLE,
            source_bundle_id: itemId,
            valid_till: validTill ?? undefined,
            updated_at: now,
          }))
          .execute();
      }
      if (item.test_series_id) {
        await db
          .insertInto("test_series_enrollments")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            tenant_member_id: tenantMemberId,
            test_series_id: item.test_series_id,
            status: "ACTIVE",
            source: "BUNDLE",
            enrolled_at: now,
            valid_till: validTill ?? undefined,
            created_at: now,
            updated_at: now,
          })
          .onConflict((oc) => oc.columns(["tenant_id", "tenant_member_id", "test_series_id"]).doUpdateSet({
            status: "ACTIVE",
            source: "BUNDLE",
            valid_till: validTill ?? undefined,
            updated_at: now,
          }))
          .execute();
      }
    }
    return;
  }

  if (orderType === order_type.BATCH) {
    const batch = await db
      .selectFrom("batches")
      .select([
        "id",
        "validity_days",
        "duration_days",
        "end_date",
      ])
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!batch) {
      throw new NotFoundError("Batch not found");
    }

    const items = await db
      .selectFrom("batch_items")
      .select(["course_id", "book_id", "item_type"])
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", itemId)
      .execute();

    // valid_till precedence:
    //   1. batch.end_date if set (cohort hard expiry)
    //   2. now + duration_days
    //   3. now + validity_days
    //   4. null (lifetime)
    let validTill: Date | null = null;
    if (batch.end_date) {
      validTill =
        batch.end_date instanceof Date
          ? batch.end_date
          : new Date(batch.end_date as unknown as string);
    } else if (batch.duration_days != null) {
      validTill = new Date(
        now.getTime() + Number(batch.duration_days) * 24 * 60 * 60 * 1000
      );
    } else if (batch.validity_days != null) {
      validTill = new Date(
        now.getTime() + Number(batch.validity_days) * 24 * 60 * 60 * 1000
      );
    }

    await db.transaction().execute(async (trx) => {
      // 1. Batch-level membership row (source of truth for "is in batch X").
      await trx
        .insertInto("batch_enrollments")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          batch_id: itemId,
          tenant_member_id: tenantMemberId,
          joined_at: now,
          valid_till: validTill ?? undefined,
          status: enrollment_status.ACTIVE,
          source: enrollment_source.PURCHASED,
          source_order_id: orderId ?? null,
          source_coupon_id: couponId,
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc
            .columns(["tenant_id", "batch_id", "tenant_member_id"])
            .doUpdateSet({
              status: enrollment_status.ACTIVE,
              source: enrollment_source.PURCHASED,
              source_order_id: orderId ?? null,
              source_coupon_id: couponId,
              valid_till: validTill ?? undefined,
              updated_at: now,
            })
        )
        .execute();

      // 2. Per-child enrollments stamped source=BATCH so existing /learn flows
      //    keep working unchanged.
      for (const item of items) {
        if (item.course_id) {
          await trx
            .insertInto("enrollments")
            .values({
              id: ulid(),
              tenant_id: tenantId,
              tenant_member_id: tenantMemberId,
              course_id: item.course_id,
              status: enrollment_status.ACTIVE,
              source: enrollment_source.BATCH,
              source_batch_id: itemId,
              enrolled_at: now,
              valid_till: validTill ?? undefined,
              created_at: now,
              updated_at: now,
            })
            .onConflict((oc) =>
              oc
                .columns(["tenant_id", "tenant_member_id", "course_id"])
                .doUpdateSet({
                  status: enrollment_status.ACTIVE,
                  source: enrollment_source.BATCH,
                  source_batch_id: itemId,
                  valid_till: validTill ?? undefined,
                  updated_at: now,
                })
            )
            .execute();
        }
        if (item.book_id) {
          await trx
            .insertInto("book_access")
            .values({
              id: ulid(),
              tenant_id: tenantId,
              tenant_member_id: tenantMemberId,
              book_id: item.book_id,
              status: enrollment_status.ACTIVE,
              source: enrollment_source.BATCH,
              source_batch_id: itemId,
              valid_till: validTill ?? undefined,
              created_at: now,
              updated_at: now,
            })
            .onConflict((oc) =>
              oc
                .columns(["tenant_id", "tenant_member_id", "book_id"])
                .doUpdateSet({
                  status: enrollment_status.ACTIVE,
                  source: enrollment_source.BATCH,
                  source_batch_id: itemId,
                  valid_till: validTill ?? undefined,
                  updated_at: now,
                })
            )
            .execute();
        }
      }

      // 3. Atomic counter bump.
      await trx
        .updateTable("batches")
        .set({
          total_enrollments: (eb) => eb("total_enrollments", "+", 1),
          updated_at: now,
        })
        .where("id", "=", itemId)
        .where("tenant_id", "=", tenantId)
        .execute();
    });
    return;
  }

  if (orderType === order_type.TEST_SERIES) {
    const seriesRow = await db
      .selectFrom("test_series")
      .select(["validity_days", "end_date"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", itemId)
      .executeTakeFirst();
    const validTill = computeSeriesValidTill(
      now,
      seriesRow?.validity_days,
      seriesRow?.end_date
    );

    await db
      .insertInto("test_series_enrollments")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        tenant_member_id: tenantMemberId,
        test_series_id: itemId,
        status: "ACTIVE",
        source: "PURCHASED",
        source_coupon_id: couponId,
        enrolled_at: now,
        valid_till: validTill,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc
          .columns(["tenant_id", "tenant_member_id", "test_series_id"])
          .doUpdateSet({
            status: "ACTIVE",
            source: "PURCHASED",
            source_coupon_id: couponId,
            valid_till: validTill,
            updated_at: now,
          })
      )
      .execute();
    return;
  }

}

export async function verifyPayment(
  tenantId: string,
  tenantMemberId: string,
  body: VerifyPaymentBody
): Promise<{ success: boolean; order_id: string }> {
  let order = body.order_id
    ? await ordersRepo.findOrderById(tenantId, body.order_id)
    : body.gateway_order_id
      ? await ordersRepo.findOrderByGatewayOrderId(tenantId, body.gateway_order_id)
      : null;

  if (body.idempotency_key && !order) {
    const existing = await ordersRepo.findOrderByIdempotencyKey(tenantId, body.idempotency_key);
    if (existing) order = await ordersRepo.findOrderById(tenantId, existing.id);
  }

  if (!order) throw new NotFoundError("Order not found");
  if (order.tenant_member_id !== tenantMemberId) throw new BadRequestError("Order does not belong to this user");
  if (order.status === order_status.PAID) {
    return { success: true, order_id: order.id };
  }
  if (order.status !== order_status.PAYMENT_PENDING) {
    throw new BadRequestError("Order is not in payment pending state");
  }

  const connection = await resolveOrderConnection(tenantId, order.gateway_connection_id);
  if (!connection) throw new BadRequestError("No active payment gateway");
  const adapter = getAdapter(connection);

  // Two families of gateway, two ways to establish that money moved.
  //
  //   Razorpay hands the browser a signature over the order+payment ids. We
  //   recompute it with the merchant secret, so the client's claim is
  //   self-proving and no network call is needed.
  //
  //   Stripe hands back nothing we can verify (a redirect return). For it the
  //   adapter exposes confirmPayment() and we ask
  //   the gateway directly, ignoring the client entirely. That also means the
  //   payment id comes from the gateway rather than from the request body.
  let paymentId = body.gateway_payment_id;
  let signature: string | null = body.signature;

  // The stored id, not body.gateway_order_id: the browser does not get to
  // nominate which order at the gateway we go and inspect, and proof for one
  // order must never settle another.
  const gatewayOrderId = storedGatewayOrderId(order, body.gateway_order_id);

  if (adapter.confirmPayment) {
    const confirmation = await adapter.confirmPayment({ gateway_order_id: gatewayOrderId });
    if (!confirmation.paid) {
      logger.warn(
        `[verify-payment] ${connection.provider_name} reports order ${order.id} not paid: ${confirmation.failure_reason ?? "no reason given"}`
      );
      throw new BadRequestError("Payment has not been completed");
    }
    assertChargeMatchesOrder(order, confirmation.amount, confirmation.currency, "verify-payment");
    paymentId = confirmation.gateway_payment_id ?? body.gateway_payment_id;
    // These gateways sign webhooks, not client returns. Nothing to store.
    signature = null;
  } else {
    // The Razorpay order was created for exactly the order total, so a valid
    // signature over the STORED order id also pins the amount.
    const valid = await adapter.verifyPayment({
      gateway_order_id: gatewayOrderId,
      gateway_payment_id: body.gateway_payment_id,
      signature: body.signature,
    });
    if (!valid) throw new BadRequestError("Payment signature verification failed");
  }

  await ordersRepo.updateOrderToPaid(
    tenantId,
    order.id,
    paymentId,
    signature
  );

  // Fulfillment fallback, webhook is primary, but if it hasn't fulfilled yet, do it here.
  // Verification above already confirms payment is legitimate.
  const orderMeta = await ordersRepo.getOrderMetadata(tenantId, order.id);
  const needsFulfillment = !orderMeta?.fulfilled;
  if (needsFulfillment) {
    try {
      await grantAccessForSingleItem(
        tenantId, tenantMemberId,
        order.order_type as order_type, order.item_id,
        order.coupon_id, connection, order.id
      );
      // Coupon increment + redemption for fallback fulfillment
      await recordCouponRedemption(
        tenantId, order.id, tenantMemberId,
        order.coupon_id, order.discount_amount, order.currency
      );

      await ordersRepo.markOrderFulfilled(tenantId, order.id);

      // The webhook worker emits these on its own path; this fallback owns them
      // when it is the path that actually fulfilled. Without this a single-item
      // purchase settled here would send the buyer nothing at all.
      queuePurchaseNotifications({
        tenantId,
        orderId: order.id,
        memberId: tenantMemberId,
        orderType: order.order_type,
      });

      logger.info(`[verify-payment] Fallback fulfillment succeeded for order ${order.id}`);
    } catch (err) {
      // Don't fail verify, webhook worker will retry
      logger.error("[verify-payment] Fallback fulfillment failed, webhook will retry", {
        orderId: order.id, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Remove item from cart after successful payment.
  await removeOrderItemFromCart(tenantId, tenantMemberId, order.order_type, order.item_id);

  return { success: true, order_id: order.id };
}

/**
 * Lightweight order status check, used as fallback when verify-payment times out.
 * The webhook may have already processed the payment.
 */
export async function getOrderStatus(
  tenantId: string,
  tenantMemberId: string,
  orderId: string
): Promise<{ order_id: string; status: string }> {
  const order = await ordersRepo.findOrderById(tenantId, orderId);
  if (!order) throw new NotFoundError("Order not found");
  if (order.tenant_member_id !== tenantMemberId) throw new BadRequestError("Order does not belong to this user");
  return { order_id: order.id, status: order.status };
}

/**
 * Resolve the gateway connection that actually created an order, not whichever
 * one happens to be active right now.
 *
 * These are the same thing almost always, and were the same thing by definition
 * back when a tenant only ever had Razorpay. They diverge the moment a tenant
 * switches gateway: orders created on the old connection are still out there
 * awaiting payment or refund, and verifying them against the NEW provider's
 * credentials fails - or worse, silently checks the wrong account.
 *
 * Falls back to the active connection if the stored one cannot be resolved, so
 * this can only ever be more correct than the previous behaviour, never less.
 */
export async function resolveOrderConnection(
  tenantId: string,
  gatewayConnectionId: string | null | undefined
): ReturnType<typeof resolveConnection> {
  if (gatewayConnectionId) {
    const stored = await resolveConnectionById(gatewayConnectionId);
    if (stored) return stored;
    logger.warn(
      `[checkout] order references gateway_connection_id=${gatewayConnectionId} which no longer resolves; falling back to the tenant's active connection`
    );
  }
  return resolveConnection(tenantId);
}

/** Called from webhook when payment.captured: update order PAID and grant access. */
export async function processOrderPaidInWebhook(
  tenantId: string,
  order: {
    id: string;
    tenant_member_id: string;
    order_type: string;
    item_id: string;
    coupon_id: string | null;
    tenant_payout_amount?: string | null;
    net_amount?: string | null;
    discount_amount?: string | null;
    currency?: string;
  },
  gatewayPaymentId: string,
  connection: ResolvedConnection
): Promise<void> {
  await ordersRepo.updateOrderToPaid(tenantId, order.id, gatewayPaymentId, null);
  await grantAccessForSingleItem(
    tenantId,
    order.tenant_member_id,
    order.order_type as order_type,
    order.item_id,
    order.coupon_id,
    connection,
    order.id
  );
  // Idempotent coupon increment, guard via order metadata
  await recordCouponRedemption(
    tenantId, order.id, order.tenant_member_id,
    order.coupon_id, order.discount_amount, order.currency
  );
}
