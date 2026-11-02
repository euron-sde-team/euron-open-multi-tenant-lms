/** Params to create a subscription plan at the gateway (Razorpay Plan) */
export interface CreateGatewayPlanParams {
  period: "monthly" | "yearly";
  interval: number; // 1 for monthly, 1 for yearly
  name: string;
  description?: string;
  amount: number; // in smallest unit (paise/cents)
  currency: string;
  notes?: Record<string, string>;
}

/** Result from gateway after creating a plan */
export interface GatewayPlanResult {
  gateway_plan_id: string;
}

/** Params to create a subscription at the gateway */
export interface CreateGatewaySubscriptionParams {
  gateway_plan_id: string;
  total_count?: number; // number of billing cycles (0 = infinite for Razorpay)
  customer_notify?: boolean;
  notes?: Record<string, string>;
  /** Razorpay customer ID, if provided, attaches subscription to existing customer */
  customer_id?: string;
  /** For new customers: email + contact for Razorpay customer creation */
  customer_email?: string;
  customer_contact?: string;
  /** Offer ID for discounted subscriptions */
  offer_id?: string;
  /** Expire the subscription auth link after this timestamp (Unix epoch) */
  expire_by?: number;
}

/** Result from gateway after creating a subscription */
export interface GatewaySubscriptionResult {
  gateway_subscription_id: string;
  gateway_customer_id?: string;
  short_url?: string;
  status: string;
  client_config: Record<string, unknown>;
}

/** Subscription details fetched from gateway */
export interface GatewaySubscriptionDetails {
  id: string;
  plan_id: string;
  customer_id?: string;
  status: string;
  current_start?: number;
  current_end?: number;
  charge_at?: number;
  short_url?: string;
  total_count?: number;
  paid_count?: number;
  remaining_count?: number;
}
