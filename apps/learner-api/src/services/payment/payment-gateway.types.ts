/** Params to create an order at the gateway (Razorpay order / Stripe PaymentIntent) */
export interface CreateOrderParams {
  amount: number; // in smallest unit (paise for INR, cents for USD)
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
  /** Buyer info (Stripe prefills the hosted checkout email from it). */
  customer?: { firstname: string; email: string; phone: string };
  /** Short product description shown on the hosted checkout page. */
  product_info?: string;
  /** Where a hosted checkout (Stripe) sends the buyer back to. Required by Stripe. */
  return_url?: string;
}

/** Result from gateway after creating order */
export interface GatewayOrderResult {
  gateway_order_id: string;
  /** Client-side config (e.g. key_id for Razorpay Checkout, client_secret for Stripe) */
  client_config: Record<string, unknown>;
}

/** Params to verify payment (signature + ids from client) */
export interface VerifyPaymentParams {
  gateway_order_id: string;
  gateway_payment_id: string;
  signature: string;
}

/**
 * Params for the server-side "was this actually paid?" check.
 *
 * Only the gateway's own order handle is passed, deliberately: nothing the
 * browser sent is trusted or needed. For Stripe this is the Checkout Session id,
 * for Razorpay the order id.
 */
export interface ConfirmPaymentParams {
  gateway_order_id: string;
}

/** Result of the server-side confirmation. */
export interface ConfirmPaymentResult {
  paid: boolean;
  /**
   * The gateway's payment handle, discovered server-side. Null when the order is
   * not paid, or when the gateway reports payment without exposing an id yet.
   * This is what gets stored on payment_orders.gateway_payment_id, so refunds
   * later depend on it.
   */
  gateway_payment_id: string | null;
  /** Human-readable reason when `paid` is false. Logged, never shown raw to buyers. */
  failure_reason?: string;
  /** What the gateway charged, in the currency's smallest unit, checked against the order total. */
  amount?: number | null;
  /** ISO currency of `amount` (any case). */
  currency?: string | null;
}

/** Params to initiate refund */
export interface RefundParams {
  gateway_payment_id: string;
  amount: number; // in smallest unit
  notes?: string;
}

/** Result from gateway after initiating refund */
export interface GatewayRefundResult {
  gateway_refund_id: string;
}

/** Parsed webhook event (after signature verification) */
export interface ParsedWebhookEvent {
  event_id: string;
  event_type: string;
  /** e.g. payment_id, order_id for Razorpay */
  payload: Record<string, unknown>;
}

/** Resolved tenant connection with credentials opened from the sealed column. */
export interface ResolvedConnection {
  connection_id: string;
  tenant_id: string;
  provider_name: string; // RAZORPAY | STRIPE (from billing_providers.name)
  mode: "SELF_MANAGED";
  /**
   * Decrypted credentials object.
   *   Razorpay: { key_id, key_secret, webhook_secret }
   *   Stripe: { secret_key, webhook_secret, publishable_key? }
   */
  credentials: Record<string, string>;
}
