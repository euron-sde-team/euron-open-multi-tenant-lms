/**
 * User subscription API functions.
 * Calls the learner-api at /api/v1/subscriptions/*.
 */

import { apiGet, apiPost } from "./api-client";

// ------- Types -------

export interface UserSubscriptionPlan {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  billing_cycle: "MONTHLY" | "YEARLY";
  currency: string;
  amount: string;
  amount_in_smallest: number;
  gateway_plan_id: string | null;
  gateway_provider: string;
  is_active: boolean;
  trial_days: number;
  features_summary: string | null;
  metadata: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface SubscribeResult {
  subscription_id: string;
  gateway_subscription_id: string;
  short_url?: string;
  status: string;
  client_config: {
    key_id: string;
    subscription_id: string;
  };
}

export interface VerifyAuthBody {
  razorpay_subscription_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

export interface VerifyAuthResult {
  subscription_id: string;
  status: string;
  message: string;
}

export interface MySubscription {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_description: string | null;
  billing_cycle: "MONTHLY" | "YEARLY";
  amount: string;
  currency: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  next_charge_at: string | null;
  last_payment_at: string | null;
  last_payment_amount: string | null;
  short_url: string | null;
  created_at: string;
}

export interface SubscriptionAccessStatus {
  hasAccess: boolean;
  subscription: MySubscription | null;
  isGracePeriod: boolean;
  gracePeriodEndsAt?: string;
  subscriptionsEnabled: boolean;
  subscriptionName: string | null;
}

export interface SubscriptionInfo {
  subscription_name: string | null;
  plans: UserSubscriptionPlan[];
  is_enabled: boolean;
  page_config?: unknown[] | null;
}

// ------- API Functions -------

const BASE = "/subscriptions";

export const userSubscriptionsApi = {
  listPlans: (): Promise<SubscriptionInfo> =>
    apiGet(`${BASE}/plans`),

  subscribe: (planId: string): Promise<SubscribeResult> =>
    apiPost(`${BASE}/subscribe`, { plan_id: planId }),

  verifyAuth: (body: VerifyAuthBody): Promise<VerifyAuthResult> =>
    apiPost(`${BASE}/verify-auth`, body),

  getMySubscription: (): Promise<MySubscription | null> =>
    apiGet(`${BASE}/my`),

  cancelSubscription: (cancelAtPeriodEnd = true): Promise<null> =>
    apiPost(`${BASE}/my/cancel`, { cancel_at_period_end: cancelAtPeriodEnd }),

  getPaymentUpdateLink: (): Promise<{ short_url: string | null }> =>
    apiGet(`${BASE}/my/update-payment`),

  checkAccess: (): Promise<SubscriptionAccessStatus> =>
    apiGet(`${BASE}/my/access`),
};
