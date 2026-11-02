import Stripe from "stripe";
import { stripeHostOptions } from "../gateway-hosts";

import logger from "../../../utils/logger";
import type {
  ConfirmPaymentParams,
  ConfirmPaymentResult,
  CreateOrderParams,
  GatewayOrderResult,
  GatewayRefundResult,
  ParsedWebhookEvent,
  RefundParams,
  VerifyPaymentParams,
} from "../payment-gateway.types";
import type { PaymentGatewayAdapter } from "./gateway.interface";

export interface StripeCredentials {
  secret_key: string;
  webhook_secret: string;
  /** Unused by the hosted-checkout flow. Captured so a later switch to Elements needs no migration. */
  publishable_key?: string;
}

/**
 * Currencies Stripe accepts with 3 minor-unit digits but insists are a multiple
 * of 10, because the underlying card networks only settle 2 digits for them.
 * Sending 1234 fils gets a 400 from Stripe with a message no buyer should see.
 */
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

/** Stripe events that mean "this session is now paid". */
const PAID_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

/**
 * Stripe, via hosted Checkout Sessions.
 *
 * Deliberately NOT Elements: the buyer is redirected to a Stripe-hosted page, so
 * no card data ever touches our DOM. That keeps the platform at PCI SAQ-A and
 * means there is no card UI to build or keep current, at the cost of leaving the
 * site for the payment step.
 *
 * The consequence for this class is that Stripe never hands the browser anything
 * we can verify offline. Where Razorpay signs a payload the client
 * relays back, Stripe gives us only a session id in a redirect. So `verifyPayment`
 * is inert here and `confirmPayment` - a server-to-server lookup - is the real
 * check. See gateway.interface.ts for why that method is optional.
 */
export class StripeAdapter implements PaymentGatewayAdapter {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(credentials: StripeCredentials) {
    // No apiVersion pinned on purpose: the SDK defaults to the version it was
    // built and typed against, so the types and the wire format cannot drift
    // apart. Pinning a string here is how that breaks on the next SDK bump.
    this.stripe = new Stripe(credentials.secret_key, stripeHostOptions());
    this.webhookSecret = credentials.webhook_secret;
  }

  async createOrder(params: CreateOrderParams): Promise<GatewayOrderResult> {
    if (!params.return_url) {
      // Not defensive padding: with hosted checkout the return URL is the only
      // way the buyer gets back to us, so there is no sane default to invent.
      logger.error("[stripe] createOrder called without return_url");
      throw new Error("Stripe checkout is not configured correctly for this store.");
    }

    const upperCurrency = params.currency.toUpperCase();
    if (THREE_DECIMAL_CURRENCIES.has(upperCurrency) && params.amount % 10 !== 0) {
      logger.error(
        `[stripe] ${upperCurrency} amount ${params.amount} is not a multiple of 10, which Stripe rejects`
      );
      throw new Error(`Stripe cannot charge this amount in ${upperCurrency}.`);
    }

    // Built by hand rather than with URLSearchParams: Stripe substitutes the
    // literal {CHECKOUT_SESSION_ID} token, and percent-encoding the braces stops
    // that substitution happening at all.
    const separator = params.return_url.includes("?") ? "&" : "?";
    const successUrl = `${params.return_url}${separator}provider=stripe&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${params.return_url}${separator}provider=stripe&status=cancelled`;

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: params.currency.toLowerCase(),
            unit_amount: params.amount,
            product_data: { name: params.product_info?.trim() || "Order" },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: params.notes?.order_id ?? params.receipt,
      customer_email: params.customer?.email || undefined,
      // Echoed back on every webhook for this session, so the handler can find
      // the order without trusting anything the client said.
      metadata: params.notes ?? {},
    });

    if (!session.url) {
      logger.error(`[stripe] session ${session.id} created without a checkout URL`);
      throw new Error("Stripe did not return a checkout page. Please try again.");
    }

    return {
      gateway_order_id: session.id,
      client_config: {
        provider: "stripe",
        checkout_url: session.url,
        session_id: session.id,
        amount: params.amount,
        currency: params.currency,
      },
    };
  }

  /**
   * Always false. Stripe issues no client-side signature to check, and returning
   * anything else here would mean trusting an unauthenticated browser claim that
   * a payment succeeded. Callers reach `confirmPayment` instead.
   */
  verifyPayment(_params: VerifyPaymentParams): Promise<boolean> {
    logger.warn("[stripe] verifyPayment called; Stripe payments confirm server-side");
    return Promise.resolve(false);
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResult> {
    const session = await this.stripe.checkout.sessions.retrieve(params.gateway_order_id);

    // Stripe's own guidance is to test for "not unpaid" rather than "is paid":
    // a zero-value or fully-discounted session settles as `no_payment_required`,
    // which is a completed checkout even though nothing was charged.
    if (session.payment_status === "unpaid") {
      return {
        paid: false,
        gateway_payment_id: null,
        failure_reason: `session status=${session.status ?? "unknown"} payment_status=unpaid`,
      };
    }

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    return {
      paid: true,
      gateway_payment_id: paymentIntent,
      amount: session.amount_total ?? null,
      currency: session.currency ?? null,
    };
  }

  async initiateRefund(params: RefundParams): Promise<GatewayRefundResult> {
    // confirmPayment stores a PaymentIntent id, but an order paid before that
    // path existed (or reconciled by hand) can carry a charge id instead.
    const isCharge = params.gateway_payment_id.startsWith("ch_");
    const refund = await this.stripe.refunds.create({
      ...(isCharge
        ? { charge: params.gateway_payment_id }
        : { payment_intent: params.gateway_payment_id }),
      amount: params.amount,
      ...(params.notes ? { metadata: { reason: params.notes } } : {}),
    });
    return { gateway_refund_id: refund.id };
  }

  async parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: string
  ): Promise<ParsedWebhookEvent> {
    const raw = headers["stripe-signature"];
    const signature = Array.isArray(raw) ? raw[0] : raw;
    if (!signature) {
      throw new Error("Missing Stripe-Signature header");
    }

    // constructEvent does the whole job: parses the t=/v1= header, recomputes the
    // HMAC over `timestamp.body`, compares in constant time, AND enforces a
    // timestamp tolerance so a captured request cannot be replayed later.
    const event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);

    return {
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    };
  }
}

/** True when this event type means the session is paid and should be fulfilled. */
export function isStripePaidEvent(eventType: string): boolean {
  return PAID_EVENTS.has(eventType);
}
