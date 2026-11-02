/**
 * Subscriptions API, create checkout, get current subscription, cancel, reactivate.
 */

import { apiClient } from "./axios";

const BASE = "/tenant/subscriptions";

export interface CreateCheckoutBody {
  plan_version_id: string;
  billing_cycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
  currency: "INR" | "USD";
  trial_days?: number;
  provider?: "RAZORPAY" | "STRIPE";
}

export interface CreateCheckoutResult {
  subscription_id: string;
  short_url: string;
  key_id: string;
}

export interface CurrentSubscription {
  id: string;
  tenant_id: string;
  plan_version_id: string;
  plan_code_snapshot: string;
  plan_name_snapshot: string;
  plan_version_snapshot: number;
  billing_cycle: string;
  currency: string;
  original_price: number;
  discount_applied: number;
  price_snapshot: number;
  external_subscription_id: string | null;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  cancel_effective_at: string | null;
  grace_period_ends_at: string | null;
  dunning_started_at: string | null;
  last_payment_attempt_at: string | null;
  payment_failure_count: number;
  billing_provider_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReactivateBody {
  plan_version_id: string;
  billing_cycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
  currency: "INR" | "USD";
  provider?: "RAZORPAY" | "STRIPE";
}

/**
 * A payment due on the current plan (backend: renewal-quote.ts). Null from the
 * API when nothing is due.
 *   DUE_SOON  expiry coming up, set up autopay, first charge ON the expiry date
 *   OVERDUE   expired, ≤7 days, pay now, dashboard still open
 *   LOCKED    expired >7 days, dashboard locked until paid
 */
export interface RenewalStatus {
  state: "DUE_SOON" | "OVERDUE" | "LOCKED";
  subscription_id: string;
  plan_name: string;
  billing_cycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
  currency: "INR" | "USD";
  days_left: number;
  period_end: string;
  /** When autopay takes its first regular charge. */
  charge_on: string;
  cycle_base: number;
  cycle_gst: number;
  cycle_total: number;
  back_due_cycles: number;
  back_due_total: number;
  back_due_from: string | null;
  back_due_to: string | null;
  /** Charged the moment they approve (0 when only autopay is being set up). */
  first_charge_total: number;
  /** Whether THIS user may pay (billing.manage). */
  can_pay: boolean;
}

export interface RenewalCheckoutResult extends CreateCheckoutResult {
  first_charge_total: number;
  charge_on: string;
  currency: "INR" | "USD";
}

export interface InvoiceUrlResult {
  invoice_url: string | null;
}

export const subscriptionsApi = {
  createCheckout: (body: CreateCheckoutBody) =>
    apiClient
      .post<{ data: CreateCheckoutResult }>(`${BASE}/create-checkout`, body)
      .then((r) => r.data.data),

  getCurrent: () =>
    apiClient
      .get<{ data: CurrentSubscription | null }>(`${BASE}/current`)
      .then((r) => r.data.data),

  cancel: (id: string) =>
    apiClient.post<{ data: null }>(`${BASE}/${id}/cancel`).then((r) => r.data),

  reactivate: (body: ReactivateBody) =>
    apiClient
      .post<{ data: CreateCheckoutResult }>(`${BASE}/reactivate`, body)
      .then((r) => r.data.data),

  getRenewal: () =>
    apiClient
      .get<{ data: RenewalStatus | null }>(`${BASE}/renewal`)
      .then((r) => r.data.data),

  renew: () =>
    apiClient
      .post<{ data: RenewalCheckoutResult }>(`${BASE}/renew`)
      .then((r) => r.data.data),

  getInvoiceUrl: () =>
    apiClient
      .get<{ data: InvoiceUrlResult }>(`${BASE}/current/invoice-url`)
      .then((r) => r.data.data),
};
