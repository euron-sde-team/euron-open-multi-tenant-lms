"use client";

import type { ClientConfig, StripeClientConfig } from "@/lib/api/checkout";

/**
 * Checkout for the gateways whose result the browser cannot prove.
 *
 * Razorpay hands the client a signature over the payment, so its call sites
 * can verify-and-fulfil in one step. Stripe does not: a redirect return is just
 * a claim. For Stripe the server has to ask the gateway directly
 * (checkout.service -> adapter.confirmPayment), so everything this module
 * returns is "the buyer finished interacting" - never "the payment succeeded".
 *
 * It exists so the checkout entry points in this app (cart checkout, direct
 * checkout) share one implementation instead of growing copies of the same
 * branch.
 */

export type DeferredClientConfig = StripeClientConfig;

/**
 * Narrows to the gateways this module handles.
 *
 * Call sites use it as an early return, which also narrows the union back down
 * so the existing Razorpay code below keeps type-checking untouched.
 */
export function isDeferredGateway(config: ClientConfig): config is DeferredClientConfig {
  return config.provider === "stripe";
}

export type CheckoutOutcome =
  /** The page is navigating to a hosted checkout. Stop all work; nothing more runs. */
  | { kind: "redirecting" }
  /** The buyer finished with the gateway UI. Ask the server what actually happened. */
  | { kind: "confirm" }
  /** Could not start checkout at all. Nothing was charged. */
  | { kind: "failed"; message: string };

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function openGatewayCheckout(
  config: DeferredClientConfig
): Promise<CheckoutOutcome> {
  if (!config.checkout_url) {
    return { kind: "failed", message: "Payment could not be started. Please try again." };
  }
  // Full navigation, not a new tab: popup blockers eat window.open on an async
  // callback, and Stripe's hosted page owns the whole viewport. Nothing after
  // this line runs - the caller must stop on "redirecting".
  window.location.href = config.checkout_url;
  return { kind: "redirecting" };
}
