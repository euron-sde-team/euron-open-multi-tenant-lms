import type Razorpay from "razorpay";
import { createRazorpayClient } from "../gateway-hosts";
import type {
  CreateGatewayPlanParams,
  CreateGatewaySubscriptionParams,
  GatewayPlanResult,
  GatewaySubscriptionDetails,
  GatewaySubscriptionResult,
} from "../subscription-gateway.types";
import type { SubscriptionGatewayAdapter } from "./subscription-gateway.interface";

export interface RazorpaySubscriptionCredentials {
  key_id: string;
  key_secret: string;
}

export class RazorpaySubscriptionAdapter implements SubscriptionGatewayAdapter {
  private instance: Razorpay;
  private keyId: string;

  constructor(credentials: RazorpaySubscriptionCredentials) {
    this.keyId = credentials.key_id;
    this.instance = createRazorpayClient(credentials.key_id, credentials.key_secret);
  }

  async createPlan(params: CreateGatewayPlanParams): Promise<GatewayPlanResult> {
    const plan = await (this.instance as any).plans.create({
      period: params.period,
      interval: params.interval,
      item: {
        name: params.name,
        description: params.description,
        amount: params.amount,
        currency: params.currency,
      },
      notes: params.notes,
    });
    return { gateway_plan_id: plan.id };
  }

  async createSubscription(params: CreateGatewaySubscriptionParams): Promise<GatewaySubscriptionResult> {
    const payload: Record<string, unknown> = {
      plan_id: params.gateway_plan_id,
      total_count: params.total_count,
      customer_notify: params.customer_notify ?? 0,
      notes: params.notes,
    };

    if (params.customer_id) {
      payload.customer_id = params.customer_id;
    }

    if (params.offer_id) {
      payload.offer_id = params.offer_id;
    }

    if (params.expire_by) {
      payload.expire_by = params.expire_by;
    }

    const sub = await (this.instance as any).subscriptions.create(payload);

    return {
      gateway_subscription_id: sub.id,
      gateway_customer_id: sub.customer_id ?? undefined,
      short_url: sub.short_url ?? undefined,
      status: sub.status,
      client_config: {
        key_id: this.keyId,
        subscription_id: sub.id,
      },
    };
  }

  async fetchSubscription(gatewaySubscriptionId: string): Promise<GatewaySubscriptionDetails> {
    const sub = await (this.instance as any).subscriptions.fetch(gatewaySubscriptionId);
    return {
      id: sub.id,
      plan_id: sub.plan_id,
      customer_id: sub.customer_id ?? undefined,
      status: sub.status,
      current_start: sub.current_start ?? undefined,
      current_end: sub.current_end ?? undefined,
      charge_at: sub.charge_at ?? undefined,
      short_url: sub.short_url ?? undefined,
      total_count: sub.total_count ?? undefined,
      paid_count: sub.paid_count ?? undefined,
      remaining_count: sub.remaining_count ?? undefined,
    };
  }

  async cancelSubscription(gatewaySubscriptionId: string, cancelAtCycleEnd: boolean): Promise<void> {
    await (this.instance as any).subscriptions.cancel(gatewaySubscriptionId, cancelAtCycleEnd);
  }

  async pauseSubscription(gatewaySubscriptionId: string): Promise<void> {
    await (this.instance as any).subscriptions.pause(gatewaySubscriptionId);
  }

  async resumeSubscription(gatewaySubscriptionId: string): Promise<void> {
    await (this.instance as any).subscriptions.resume(gatewaySubscriptionId);
  }
}
