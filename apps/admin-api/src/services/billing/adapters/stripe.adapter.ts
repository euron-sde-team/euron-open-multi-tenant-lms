import { createHmac, timingSafeEqual } from "node:crypto";
import config from "../../../config";
import type {
  BillingGatewayAdapter,
  CreatePlanParams,
  CreatePlanResult,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  ParsedWebhookPayload,
  PlanDetails,
  SubscriptionStatus,
} from "./billing-gateway.interface";

export interface StripeBillingCredentials {
  secret_key: string;
  webhook_secret: string;
  publishable_key: string;
}

type StripeObject = Record<string, unknown>;

/** Stripe's form encoding: nested keys as a[b][0][c]=v. */
function formEncode(data: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") formEncode(item as Record<string, unknown>, `${key}[${i}]`, out);
        else out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === "object") {
      formEncode(v as Record<string, unknown>, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

/** Stripe subscription status in the vocabulary the billing service speaks (Razorpay's). */
function toRazorpayStatus(status: string): string {
  switch (status) {
    case "trialing":
      return "authenticated";
    case "active":
      return "active";
    case "past_due":
      return "pending";
    case "unpaid":
      return "halted";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return status;
  }
}

/** Period bounds live on the subscription items in current API versions. */
/** Stripe's default tolerance for the Stripe-Signature timestamp. */
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

function periodOf(sub: StripeObject): { start?: number; end?: number } {
  const items = (sub.items as { data?: StripeObject[] } | undefined)?.data ?? [];
  const first = items[0] ?? {};
  const start = (sub.current_period_start ?? first.current_period_start) as number | undefined;
  const end = (sub.current_period_end ?? first.current_period_end) as number | undefined;
  return { start, end };
}

/**
 * Platform subscription billing on Stripe, over the REST API (base URL from
 * STRIPE_API_BASE so the local stub can stand in).
 *
 * Mapping onto the billing service's provider-neutral flow:
 *   plan          a recurring Price (id price_...)
 *   subscription  a Subscription created `default_incomplete`; the first
 *                 invoice's hosted page is the checkout link (short_url)
 *   webhooks      customer.subscription.* and invoice.paid are translated
 *                 into the subscription.* events the service handles
 */
export class StripeBillingAdapter implements BillingGatewayAdapter {
  private secretKey: string;

  private webhookSecret: string;

  constructor(credentials: StripeBillingCredentials) {
    this.secretKey = credentials.secret_key;
    this.webhookSecret = credentials.webhook_secret;
  }

  private async call(method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>): Promise<StripeObject> {
    const res = await fetch(`${config.STRIPE_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: body ? formEncode(body).toString() : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as StripeObject & { error?: { message?: string } };
    if (!res.ok) {
      throw new Error(`Stripe ${method} ${path} failed (${res.status}): ${json.error?.message ?? "unknown error"}`);
    }
    return json;
  }

  async createPlan(params: CreatePlanParams): Promise<CreatePlanResult> {
    const price = await this.call("POST", "/v1/prices", {
      currency: params.item.currency.toLowerCase(),
      unit_amount: params.item.amount,
      recurring: {
        interval: params.period === "yearly" ? "year" : "month",
        interval_count: params.interval,
      },
      product_data: { name: params.item.name },
    });
    return { id: String(price.id) };
  }

  async fetchPlan(externalPlanId: string): Promise<PlanDetails> {
    const price = await this.call("GET", `/v1/prices/${encodeURIComponent(externalPlanId)}`);
    const recurring = (price.recurring ?? {}) as { interval?: string; interval_count?: number };
    return {
      id: String(price.id),
      period: recurring.interval === "year" ? "yearly" : "monthly",
      interval: Number(recurring.interval_count ?? 1),
      amount: Number(price.unit_amount ?? 0),
      currency: String(price.currency ?? "").toUpperCase(),
    };
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    const notes = params.notes ?? {};
    const customer = await this.call("POST", "/v1/customers", {
      metadata: { tenant_id: notes.tenant_id ?? "" },
    });
    const sub = await this.call("POST", "/v1/subscriptions", {
      customer: customer.id,
      items: [{ price: params.plan_id, quantity: params.quantity ?? 1 }],
      payment_behavior: "default_incomplete",
      metadata: notes,
      ...(params.start_at ? { trial_end: params.start_at } : {}),
      ...(params.addons?.length
        ? {
            add_invoice_items: params.addons.map((a) => ({
              price_data: {
                currency: a.item.currency.toLowerCase(),
                unit_amount: a.item.amount,
                product_data: { name: a.item.name },
              },
            })),
          }
        : {}),
      expand: ["latest_invoice"],
    });
    let invoice = sub.latest_invoice as StripeObject | undefined;
    if (invoice && !invoice.hosted_invoice_url && invoice.id && invoice.status === "draft") {
      invoice = await this.call("POST", `/v1/invoices/${encodeURIComponent(String(invoice.id))}/finalize`, {});
    }
    return {
      id: String(sub.id),
      short_url: (invoice?.hosted_invoice_url as string | undefined) ?? undefined,
      status: toRazorpayStatus(String(sub.status ?? "incomplete")),
    };
  }

  async cancelSubscription(externalSubscriptionId: string, cancelAtCycleEnd = false): Promise<void> {
    const id = encodeURIComponent(externalSubscriptionId);
    if (cancelAtCycleEnd) {
      await this.call("POST", `/v1/subscriptions/${id}`, { cancel_at_period_end: true });
    } else {
      await this.call("DELETE", `/v1/subscriptions/${id}`);
    }
  }

  async fetchSubscription(externalSubscriptionId: string): Promise<SubscriptionStatus> {
    const sub = await this.call("GET", `/v1/subscriptions/${encodeURIComponent(externalSubscriptionId)}`);
    const { start, end } = periodOf(sub);
    return {
      id: String(sub.id),
      status: toRazorpayStatus(String(sub.status ?? "")),
      current_start: start,
      current_end: end,
      notes: (sub.metadata as Record<string, string> | undefined) ?? undefined,
    };
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    // Stripe-Signature: t=<timestamp>,v1=<HMAC-SHA256(secret, "<t>.<body>")>
    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const sigPart = parts.find((p) => p.startsWith("v1="));
    if (!timestampPart || !sigPart) return false;

    const timestamp = timestampPart.slice(2);
    // Replay window, as stripe.webhooks.constructEvent enforces: a captured
    // delivery cannot be re-sent days later.
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false;
    const expectedSig = sigPart.slice(3);
    const computedSig = createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    try {
      return timingSafeEqual(Buffer.from(computedSig, "hex"), Buffer.from(expectedSig, "hex"));
    } catch {
      return false;
    }
  }

  /**
   * Translates Stripe events into the Razorpay-shaped events and payload
   * ({ subscription: { entity }, payment: { entity } }) the billing service
   * processes. Unhandled Stripe events pass through under their own name.
   */
  parseWebhookPayload(body: string): ParsedWebhookPayload {
    const raw = JSON.parse(body) as { id?: string; type?: string; data?: { object?: StripeObject } };
    const type = raw.type ?? "unknown";
    const eventId = raw.id ?? `${type}-${Date.now()}`;
    const obj = raw.data?.object ?? {};

    if (type.startsWith("customer.subscription.")) {
      const { start, end } = periodOf(obj);
      const status = toRazorpayStatus(String(obj.status ?? ""));
      const event =
        type === "customer.subscription.deleted"
          ? "subscription.cancelled"
          : `subscription.${status === "active" ? "activated" : status}`;
      return {
        event,
        event_id: eventId,
        subscription_id: String(obj.id ?? ""),
        payload: {
          subscription: {
            entity: {
              id: obj.id,
              status,
              current_start: start,
              current_end: end,
              notes: obj.metadata ?? {},
            },
          },
        },
      };
    }

    if (type === "invoice.paid") {
      const parent = (obj.parent as StripeObject | undefined)?.subscription_details as StripeObject | undefined;
      const subscriptionId = (obj.subscription as string | undefined) ?? (parent?.subscription as string | undefined);
      const line = ((obj.lines as { data?: StripeObject[] } | undefined)?.data ?? [])[0];
      const period = (line?.period ?? {}) as { start?: number; end?: number };
      const metadata =
        ((obj.subscription_details as StripeObject | undefined)?.metadata as Record<string, string> | undefined) ??
        (parent?.metadata as Record<string, string> | undefined) ??
        {};
      return {
        event: "subscription.charged",
        event_id: eventId,
        subscription_id: subscriptionId,
        payload: {
          subscription: {
            entity: {
              id: subscriptionId,
              status: "active",
              current_start: period.start,
              current_end: period.end,
              notes: metadata,
            },
          },
          payment: { entity: { id: obj.payment_intent ?? obj.id } },
        },
      };
    }

    return { event: type, event_id: eventId, subscription_id: undefined, payload: (raw.data ?? {}) as StripeObject };
  }
}
