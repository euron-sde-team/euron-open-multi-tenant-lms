import { createHmac, timingSafeEqual } from "node:crypto";
import type Razorpay from "razorpay";
import { createRazorpayClient } from "../gateway-hosts";
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

export interface RazorpayBillingCredentials {
  key_id: string;
  key_secret: string;
  webhook_secret: string;
}

export class RazorpayBillingAdapter implements BillingGatewayAdapter {
  private instance: Razorpay;
  private webhookSecret: string;

  constructor(credentials: RazorpayBillingCredentials) {
    this.instance = createRazorpayClient(credentials.key_id, credentials.key_secret);
    this.webhookSecret = credentials.webhook_secret;
  }

  async createPlan(params: CreatePlanParams): Promise<CreatePlanResult> {
    const plan = await this.instance.plans.create({
      period: params.period,
      interval: params.interval,
      item: {
        name: params.item.name,
        amount: params.item.amount,
        currency: params.item.currency,
        description: params.item.description ?? undefined,
      },
    });
    return { id: plan.id };
  }

  async fetchPlan(externalPlanId: string): Promise<PlanDetails> {
    const plan = await this.instance.plans.fetch(externalPlanId);
    return {
      id: plan.id,
      period: String(plan.period),
      interval: Number(plan.interval),
      amount: Number(plan.item.amount),
      currency: String(plan.item.currency),
    };
  }

  async createSubscription(
    params: CreateSubscriptionParams
  ): Promise<CreateSubscriptionResult> {
    const subscription = await this.instance.subscriptions.create({
      plan_id: params.plan_id,
      total_count: params.total_count,
      quantity: params.quantity ?? 1,
      start_at: params.start_at,
      expire_by: params.expire_by,
      notes: params.notes,
      ...(params.addons?.length ? { addons: params.addons } : {}),
    });
    return {
      id: subscription.id,
      short_url: subscription.short_url,
      status: subscription.status,
    };
  }

  async cancelSubscription(externalSubscriptionId: string, cancelAtCycleEnd = false): Promise<void> {
    await this.instance.subscriptions.cancel(externalSubscriptionId, cancelAtCycleEnd);
  }

  async fetchSubscription(
    externalSubscriptionId: string
  ): Promise<SubscriptionStatus> {
    const sub = await this.instance.subscriptions.fetch(externalSubscriptionId);
    return {
      id: sub.id,
      status: sub.status,
      current_start: sub.current_start ?? undefined,
      current_end: sub.current_end ?? undefined,
      notes: (sub.notes as Record<string, string> | undefined) ?? undefined,
    };
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    const expected = createHmac("sha256", this.webhookSecret)
      .update(body)
      .digest("hex");
    // Constant-time comparison (a plain === leaks the matching prefix length).
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhookPayload(body: string): ParsedWebhookPayload {
    const raw = JSON.parse(body) as {
      event?: string;
      id?: string;
      payload?: {
        subscription?: { entity?: { id?: string } };
      };
    };
    const event = raw.event ?? "unknown";
    const eventId = raw.id ?? `${event}-${Date.now()}`;
    const subscriptionId = raw.payload?.subscription?.entity?.id;
    // Razorpay sends { event, payload: { subscription: { entity: {...} } } }
    // Pass inner payload so service receives { subscription: { entity: {...} } }
    const innerPayload = (raw.payload ?? {}) as Record<string, unknown>;
    return {
      event,
      event_id: eventId,
      subscription_id: subscriptionId,
      payload: innerPayload,
    };
  }
}
