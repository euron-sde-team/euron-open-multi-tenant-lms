/**
 * Billing gateway adapter for platform subscription billing.
 * Supports Razorpay (plan_id) and future Stripe (price_id) via external_plan_id.
 */

export interface CreatePlanParams {
  period: "monthly" | "yearly";
  interval: number;
  item: {
    name: string;
    amount: number; // in smallest unit (paise for INR, cents for USD)
    currency: "INR" | "USD";
    description?: string;
  };
}

export interface CreatePlanResult {
  id: string;
}

export interface CreateSubscriptionParams {
  plan_id: string;
  total_count: number;
  quantity?: number;
  start_at?: number; // Unix timestamp for trial end
  expire_by?: number; // Unix timestamp till when customer can complete first payment (link validity)
  notes?: Record<string, string>;
  /** One-time amounts charged upfront with the first payment (overdue renewal months). */
  addons?: Array<{
    item: { name: string; amount: number; currency: "INR" | "USD" };
  }>;
}

export interface PlanDetails {
  id: string;
  period: string;
  interval: number;
  amount: number; // smallest unit
  currency: string;
}

export interface CreateSubscriptionResult {
  id: string;
  short_url?: string;
  status: string;
}

export interface SubscriptionStatus {
  id: string;
  status: string;
  current_start?: number;
  current_end?: number;
  notes?: Record<string, string>;
}

export interface ParsedWebhookPayload {
  event: string;
  event_id: string;
  subscription_id?: string;
  payload: Record<string, unknown>;
}

export interface BillingGatewayAdapter {
  createPlan(params: CreatePlanParams): Promise<CreatePlanResult>;
  fetchPlan(externalPlanId: string): Promise<PlanDetails>;
  createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult>;
  cancelSubscription(externalSubscriptionId: string, cancelAtCycleEnd?: boolean): Promise<void>;
  fetchSubscription(externalSubscriptionId: string): Promise<SubscriptionStatus>;
  verifyWebhookSignature(body: string, signature: string): boolean;
  parseWebhookPayload(body: string): ParsedWebhookPayload;
}
