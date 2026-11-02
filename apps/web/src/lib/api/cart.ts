/**
 * Cart API functions for end-user cart management.
 * Calls the learner-api at /api/v1/cart/*.
 * Uses api-client: on 401 (JWT expired), auth is cleared and navbar shows login.
 */

import { apiGet, apiPost, apiDelete } from "./api-client";

// ------- Types -------

export type CartItemType = "COURSE" | "BOOK" | "BUNDLE" | "BATCH";

export interface CartItemResponse {
  id: string;
  item_type: CartItemType;
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
}

export interface CartSummary {
  total_items: number;
  purchasable_items: number;
  total_inr: string;
  total_usd: string;
  tax_mode?: string;
  tax_percentage?: number;
  is_indian?: boolean;
  tax_amount_inr?: string;
  tax_amount_usd?: string;
  grand_total_inr?: string;
  grand_total_usd?: string;
}

export interface CartResponse {
  items: CartItemResponse[];
  summary: CartSummary;
}

export interface AddToCartBody {
  item_type: CartItemType;
  item_id: string;
  coupon_code?: string;
}

export interface CartCheckoutBody {
  currency: string;
}

import type { ClientConfig } from "./checkout";

export interface CartCheckoutResult {
  order_id: string;
  order_number: string;
  gateway_order_id: string;
  amount: number;
  currency: string;
  client_config: ClientConfig;
  /**
   * Set when coupons covered the whole cart. Access is already granted, so the
   * client must skip the payment sheet.
   */
  free?: boolean;
}

export interface CartVerifyPaymentBody {
  order_id: string;
  gateway_order_id: string;
  gateway_payment_id: string;
  signature: string;
  /** Provider-specific extras (Razorpay ignores this field). */
  extra?: Record<string, string>;
}

export interface CartVerifyPaymentResult {
  success: boolean;
  order_id: string;
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

// ------- API Functions -------

export const cartApi = {
  getCart: (): Promise<CartResponse> => apiGet("/cart"),

  addItem: (body: AddToCartBody): Promise<null> => apiPost("/cart/items", body),

  removeItem: (body: AddToCartBody): Promise<null> =>
    apiDelete("/cart/items", { data: body }),

  clearCart: (): Promise<null> => apiDelete("/cart"),

  checkout: (body: CartCheckoutBody): Promise<CartCheckoutResult> =>
    apiPost("/cart/checkout", body),

  verifyPayment: (body: CartVerifyPaymentBody): Promise<CartVerifyPaymentResult> =>
    apiPost("/cart/checkout/verify", body, { timeout: 10000 }),

  /** Validate a coupon code for the current cart. */
  validateCoupon: (body: {
    coupon_code: string;
    currency: string;
  }): Promise<CartCouponValidationResult> =>
    apiPost("/cart/validate-coupon", body),

  /** Remove coupon from a specific cart item. */
  removeItemCoupon: (itemId: string): Promise<null> =>
    apiDelete(`/cart/items/${itemId}/coupon`),
};
