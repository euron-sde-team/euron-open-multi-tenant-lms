/**
 * Tests for the two things that silently corrupt money.
 *
 *   1. Amounts: gateways take the smallest currency unit, and the number of
 *      decimals differs by currency. Getting it wrong charges 10x or 100x and
 *      nothing complains.
 *   2. Signatures decide whether a "you were paid" message is believed. A
 *      verifier that is wrong in the permissive direction hands out free
 *      product to anyone who can POST.
 *
 * Uses the Node built-in test runner. Run with:  pnpm test
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  RazorpayAdapter,
  verifyRazorpayWebhookSignature,
} from "../src/services/payment/adapters/razorpay.adapter";
import { StripeAdapter } from "../src/services/payment/adapters/stripe.adapter";
import { gatewaySupportsCurrency, toSmallestUnit } from "../src/utils/currency-registry";

const WEBHOOK_SECRET = "test_webhook_secret";
const KEY_SECRET = "test_key_secret";

const hmacHex = (body: string, secret: string): string =>
  createHmac("sha256", secret).update(body).digest("hex");

// ---------------------------------------------------------------------------

describe("Razorpay webhook signature", () => {
  const body =
    '{"id":"evt_test_1","event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1","order_id":"order_1","amount":100000}}}}';

  it("accepts a correctly signed payload", () => {
    assert.equal(verifyRazorpayWebhookSignature(body, hmacHex(body, WEBHOOK_SECRET), WEBHOOK_SECRET), true);
  });

  it("rejects a tampered body", () => {
    const tampered = body.replace("100000", "1");
    assert.equal(
      verifyRazorpayWebhookSignature(tampered, hmacHex(body, WEBHOOK_SECRET), WEBHOOK_SECRET),
      false
    );
  });

  it("rejects a signature made with a different secret", () => {
    assert.equal(
      verifyRazorpayWebhookSignature(body, hmacHex(body, "someone_elses_secret"), WEBHOOK_SECRET),
      false
    );
  });

  it("rejects a missing signature header", () => {
    assert.equal(verifyRazorpayWebhookSignature(body, "", WEBHOOK_SECRET), false);
  });

  it("rejects when no webhook secret is configured", () => {
    assert.equal(verifyRazorpayWebhookSignature(body, hmacHex(body, ""), ""), false);
  });

  it("rejects a truncated signature", () => {
    assert.equal(
      verifyRazorpayWebhookSignature(body, hmacHex(body, WEBHOOK_SECRET).slice(0, 32), WEBHOOK_SECRET),
      false
    );
  });
});

describe("Razorpay checkout signature (verify-payment)", () => {
  const adapter = new RazorpayAdapter({ key_id: "rzp_test_key", key_secret: KEY_SECRET });
  const orderId = "order_test_1";
  const paymentId = "pay_test_1";
  const good = hmacHex(`${orderId}|${paymentId}`, KEY_SECRET);

  it("accepts the signature Razorpay Checkout returns", async () => {
    assert.equal(
      await adapter.verifyPayment({ gateway_order_id: orderId, gateway_payment_id: paymentId, signature: good }),
      true
    );
  });

  it("rejects a signature for a different payment", async () => {
    assert.equal(
      await adapter.verifyPayment({ gateway_order_id: orderId, gateway_payment_id: "pay_other", signature: good }),
      false
    );
  });

  it("rejects an empty signature", async () => {
    assert.equal(
      await adapter.verifyPayment({ gateway_order_id: orderId, gateway_payment_id: paymentId, signature: "" }),
      false
    );
  });
});

// ---------------------------------------------------------------------------

describe("Smallest-unit conversion", () => {
  it("uses 2 decimals for INR and USD", () => {
    assert.equal(toSmallestUnit(999, "INR"), 99900);
    assert.equal(toSmallestUnit(10.34, "USD"), 1034);
  });

  it("uses 0 decimals for JPY", () => {
    assert.equal(toSmallestUnit(1000, "JPY"), 1000);
  });

  it("uses 3 decimals for KWD", () => {
    assert.equal(toSmallestUnit(1.5, "KWD"), 1500);
  });
});

describe("Gateway currency support", () => {
  it("supports registry currencies on Razorpay and Stripe", () => {
    assert.equal(gatewaySupportsCurrency("RAZORPAY", "INR"), true);
    assert.equal(gatewaySupportsCurrency("STRIPE", "USD"), true);
  });

  it("refuses removed gateways and unknown currencies", () => {
    assert.equal(gatewaySupportsCurrency("RAZORPAY", "XXX"), false);
  });
});

// ---------------------------------------------------------------------------

describe("Stripe amount guards", () => {
  const stripe = new StripeAdapter({
    secret_key: "sk_test_not_a_real_key",
    webhook_secret: "whsec_not_a_real_secret",
  });

  it("refuses a 3-decimal currency amount that is not a multiple of 10", async () => {
    // Stripe accepts KWD with 3 decimals but settles only 2, so 1234 fils is a
    // 400 from their API. Caught before any network call.
    await assert.rejects(
      stripe.createOrder({
        amount: 1234,
        currency: "KWD",
        return_url: "https://example.com/payment-callback?order_id=x",
      }),
      /Stripe cannot charge this amount in KWD/
    );
  });

  it("refuses to start checkout without a return URL", async () => {
    await assert.rejects(
      stripe.createOrder({ amount: 1000, currency: "INR" }),
      /Stripe checkout is not configured correctly/
    );
  });

  it("never claims a payment succeeded from client data alone", async () => {
    const verified = await stripe.verifyPayment({
      gateway_order_id: "cs_test_x",
      gateway_payment_id: "pi_x",
      signature: "anything",
    });
    assert.equal(verified, false);
  });
});
