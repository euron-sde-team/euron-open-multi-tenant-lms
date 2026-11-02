import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import {
  razorpayPaymentSignature,
  razorpaySubscriptionSignature,
  razorpayWebhookSignature,
  safeEqualHex,
  stripeSignatureHeader,
  verifyRazorpayWebhookSignature,
  verifyStripeSignature,
} from "../src/signatures.ts";

const hmac = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");

// The real Stripe SDK, when the learner API's dependencies are installed: proves the stub's
// header passes stripe.webhooks.constructEvent, the exact check learner-api runs.
const stripeSdk = (() => {
  try {
    const require = createRequire(new URL("../../learner-api/package.json", import.meta.url));
    const Stripe = require("stripe");
    return new (Stripe.default ?? Stripe)("sk_test_stub_tenant");
  } catch {
    return null;
  }
})();

describe("Stripe webhook signature", () => {
  const secret = "whsec_test_only_value";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_test_1" } } });

  it("is t=<ts>,v1=HMAC(secret, ts.body)", () => {
    expect(stripeSignatureHeader(body, secret, 1_700_000_000)).toBe(`t=1700000000,v1=${hmac(secret, `1700000000.${body}`)}`);
  });

  it("verifies its own header and rejects tampering, a wrong secret and a stale timestamp", () => {
    const now = 1_700_000_000;
    const header = stripeSignatureHeader(body, secret, now);
    expect(verifyStripeSignature(body, header, secret, 300, now)).toBe(true);
    expect(verifyStripeSignature(`${body} `, header, secret, 300, now)).toBe(false);
    expect(verifyStripeSignature(body, header, "whsec_other", 300, now)).toBe(false);
    expect(verifyStripeSignature(body, header, secret, 300, now + 301)).toBe(false);
  });

  it("accepts any matching v1 entry (Stripe rolls secrets that way)", () => {
    const now = 1_700_000_000;
    const good = stripeSignatureHeader(body, secret, now).split(",")[1];
    expect(verifyStripeSignature(body, `t=${now},v1=${"0".repeat(64)},${good}`, secret, 300, now)).toBe(true);
  });

  it.skipIf(!stripeSdk)("passes the Stripe SDK's constructEvent", () => {
    const event = stripeSdk!.webhooks.constructEvent(body, stripeSignatureHeader(body, secret), secret);
    expect(event.id).toBe("evt_1");
  });
});

describe("Razorpay signatures", () => {
  const keySecret = "test-only-key-secret";

  it("checkout: HMAC(key_secret, order_id|payment_id), as RazorpayAdapter.verifyPayment recomputes it", () => {
    expect(razorpayPaymentSignature("order_ABC", "pay_XYZ", keySecret)).toBe(hmac(keySecret, "order_ABC|pay_XYZ"));
  });

  it("subscription: HMAC(key_secret, payment_id|subscription_id)", () => {
    expect(razorpaySubscriptionSignature("pay_XYZ", "sub_123", keySecret)).toBe(hmac(keySecret, "pay_XYZ|sub_123"));
  });

  it("webhook: HMAC(webhook_secret, raw body), verified in constant time", () => {
    const body = '{"event":"payment.captured"}';
    const sig = razorpayWebhookSignature(body, "test-only-webhook");
    expect(sig).toBe(hmac("test-only-webhook", body));
    expect(verifyRazorpayWebhookSignature(body, sig, "test-only-webhook")).toBe(true);
    expect(verifyRazorpayWebhookSignature(body, sig, "test-only-other")).toBe(false);
    expect(verifyRazorpayWebhookSignature(`${body}\n`, sig, "test-only-webhook")).toBe(false);
  });
});

describe("safeEqualHex", () => {
  it("compares hex digests and refuses non-hex or different lengths", () => {
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
    expect(safeEqualHex("abcd", "abce")).toBe(false);
    expect(safeEqualHex("abcd", "abc")).toBe(false);
    expect(safeEqualHex("zz", "zz")).toBe(false);
  });
});
