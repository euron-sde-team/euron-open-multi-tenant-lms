/**
 * Checkout API functions for end-user purchases.
 * Calls the learner-api at /api/v1/checkout/*.
 * Uses api-client: on 401 (JWT expired), auth is cleared and navbar shows login.
 */

import { ApiError, apiGet, apiPost } from "./api-client";

/**
 * Thrown by `createOrder` when the backend reports the buyer already has active,
 * non-expired access to the requested course / book / bundle. Carries enough info
 * (orderType, slug, title) for the UI to render a "Start learning now" CTA.
 */
export class AlreadyHasAccessError extends Error {
  readonly orderType: "COURSE" | "BOOK" | "BUNDLE";
  readonly itemId: string;
  readonly slug: string | null;
  readonly title: string | null;
  constructor(payload: {
    orderType: "COURSE" | "BOOK" | "BUNDLE";
    itemId: string;
    slug: string | null;
    title: string | null;
    message: string;
  }) {
    super(payload.message);
    this.name = "AlreadyHasAccessError";
    this.orderType = payload.orderType;
    this.itemId = payload.itemId;
    this.slug = payload.slug;
    this.title = payload.title;
  }
}

// ------- Types -------

export type OrderType = "COURSE" | "BOOK" | "BUNDLE" | "BATCH" | "TEST_SERIES";

export interface CreateOrderBody {
  order_type: OrderType;
  item_id: string;
  currency: string;
  coupon_code?: string;
}

/** Present when the gateway forced a currency switch (the gateway cannot charge the requested currency). */
export interface CurrencyNotice {
  requested: string;
  charged: string;
  reason: string;
}

export interface RazorpayClientConfig {
  /** "razorpay" (undefined is accepted for older orders). */
  provider?: "razorpay";
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  currency_notice?: CurrencyNotice | null;
}

export interface StripeClientConfig {
  provider: "stripe";
  /**
   * Stripe-hosted Checkout page. The buyer LEAVES the site for this one, unlike
   * Razorpay, and comes back via /payment-callback.
   */
  checkout_url: string;
  session_id: string;
  amount: number;
  currency: string;
  currency_notice?: CurrencyNotice | null;
}

export type ClientConfig = RazorpayClientConfig | StripeClientConfig;

export interface AvailableCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
  /** Currency the amounts below are in, the resolved order currency. */
  currency: string;
  original_amount: number;
  /** What this buyer saves on this item, already computed server-side. */
  discount_amount: number;
  net_amount: number;
  valid_to: string | null;
}

export interface CreateOrderResult {
  order_id: string;
  order_number: string;
  gateway_order_id: string;
  amount: number;
  currency: string;
  client_config: ClientConfig;
  /**
   * Set when a coupon brought the payable amount to zero. The backend has
   * already granted access, so the client must skip the payment sheet entirely.
   */
  free?: boolean;
}

export interface VerifyPaymentBody {
  order_id: string;
  gateway_order_id: string;
  gateway_payment_id: string;
  signature: string;
  /** Provider-specific extras (Razorpay ignores this field). */
  extra?: Record<string, string>;
}

export interface VerifyPaymentResult {
  success: boolean;
  order_id: string;
}

export interface FreeEnrollBody {
  order_type: "COURSE" | "BOOK" | "BUNDLE" | "BATCH" | "TEST_SERIES";
  item_id: string;
}

export interface FreeEnrollResult {
  success: boolean;
  order_type: string;
  item_id: string;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  discount_amount: number;
  original_amount: number;
  net_amount: number;
  currency: string;
}

// ------- API Functions -------

export const checkoutApi = {
  createOrder: async (body: CreateOrderBody): Promise<CreateOrderResult> => {
    try {
      return await apiPost<CreateOrderResult>("/checkout/create-order", body);
    } catch (err) {
      // Translate the backend's structured 409 (kind=ALREADY_HAS_ACCESS) into a
      // typed error the UI can branch on instead of showing a generic message.
      // The shared response interceptor wraps Axios errors as ApiError and stashes
      // the raw response.data on the `data` field, so we read from there rather
      // than `axios.isAxiosError` (which won't match, interceptor swallowed it).
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as
          | {
              kind?: string;
              orderType?: "COURSE" | "BOOK" | "BUNDLE";
              itemId?: string;
              slug?: string | null;
              title?: string | null;
              message?: string;
            }
          | undefined;
        if (data?.kind === "ALREADY_HAS_ACCESS" && data.orderType && data.itemId) {
          throw new AlreadyHasAccessError({
            orderType: data.orderType,
            itemId: data.itemId,
            slug: data.slug ?? null,
            title: data.title ?? null,
            message: data.message ?? "You already have access to this item.",
          });
        }
      }
      throw err;
    }
  },

  verifyPayment: (body: VerifyPaymentBody): Promise<VerifyPaymentResult> =>
    apiPost("/checkout/verify-payment", body, { timeout: 10000 }),

  /** Check order status, used as fallback when verify-payment times out. */
  getOrderStatus: (orderId: string): Promise<{ order_id: string; status: string }> =>
    apiPost("/checkout/order-status", { order_id: orderId }),

  /** Enroll in a FREE course or book without payment. No gateway involved. */
  freeEnroll: (body: FreeEnrollBody): Promise<FreeEnrollResult> =>
    apiPost("/checkout/free-enroll", body),

  /** Validate a coupon code for a direct checkout item. */
  validateCoupon: (body: {
    coupon_code: string;
    order_type: string;
    item_id: string;
    currency: string;
  }): Promise<CouponValidationResult> =>
    apiPost("/checkout/validate-coupon", body),

  /**
   * Public coupons the buyer could redeem on this item right now, best offer
   * first, each with its saving already priced in `currency`. Private coupons
   * are deliberately absent, they still work when typed in.
   *
   * Checkout also uses the length of this list to decide whether to pause for a
   * coupon step or go straight to payment.
   */
  availableCoupons: (params: {
    order_type: string;
    item_id: string;
    currency?: string;
  }): Promise<{ coupons: AvailableCoupon[] }> =>
    apiGet("/checkout/available-coupons", { params }),
};
