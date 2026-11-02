/**
 * Tenant User Subscriptions API, plans, settings, subscribers.
 * All routes are tenant-scoped (X-Tenant-Id from store).
 */

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

const BASE = "/tenant/user-subscriptions";

// ─── Types ───────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
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
  metadata: unknown;
  created_at: string;
  updated_at: string;
  subscriber_count?: number;
}

export interface SubscriptionSettings {
  is_enabled: boolean;
  grace_period_days: number;
  reminder_days_before: number[] | null;
  dunning_email_interval_hours: number;
  subscription_name?: string | null;
}

export interface Subscriber {
  id: string;
  member_id: string;
  plan_id: string;
  plan_name_snapshot: string;
  billing_cycle_snapshot: string;
  amount_snapshot: string;
  currency_snapshot: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  next_charge_at: string | null;
  cancel_at_period_end: boolean;
  payment_failure_count: number;
  created_at: string;
  member_name: string;
  member_email: string;
}

export interface SubscriberDetail extends Subscriber {
  gateway_subscription_id: string | null;
  gateway_customer_id: string | null;
  gateway_provider: string;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  cancelled_at: string | null;
  ended_at: string | null;
  paused_at: string | null;
  last_payment_at: string | null;
  last_payment_amount: string | null;
  short_url: string | null;
  updated_at: string;
  member_avatar_url: string | null;
  events: SubscriptionEvent[];
}

export interface SubscriptionEvent {
  id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string;
  gateway_payment_id: string | null;
  amount: string | null;
  created_at: string;
}

export interface SubscriberListResult {
  subscribers: Subscriber[];
  total: number;
  page: number;
  limit: number;
}

export interface SubscriptionAnalytics {
  summary: {
    total: number;
    active: number;
    cancelled: number;
    paused: number;
    halted: number;
    expired: number;
    on_trial: number;
    with_payment_failures: number;
  };
  mrr: Array<{ currency: string; amount: number }>;
  growth_timeline: Array<{ date: string; count: number }>;
  status_distribution: Array<{ name: string; value: number }>;
  revenue_by_plan: Array<{
    plan_id: string;
    plan_name: string;
    currency: string;
    subscriber_count: number;
    total_revenue: number;
  }>;
  churn_timeline: Array<{ date: string; count: number }>;
}

// ─── API Functions ───────────────────────────────────────────────────────

async function createPlan(body: {
  name: string;
  description?: string;
  billing_cycle: "MONTHLY" | "YEARLY";
  currency: string;
  amount: number;
  trial_days?: number;
  features_summary?: string;
  deactivate_conflicting?: boolean;
}): Promise<SubscriptionPlan> {
  const res = await apiClient.post<ApiResponse<SubscriptionPlan>>(`${BASE}/plans`, body);
  return res.data.data;
}

async function listPlans(includeInactive = false): Promise<SubscriptionPlan[]> {
  const res = await apiClient.get<ApiResponse<SubscriptionPlan[]>>(`${BASE}/plans`, {
    params: { include_inactive: includeInactive },
  });
  return res.data.data;
}

async function getPlan(id: string): Promise<SubscriptionPlan> {
  const res = await apiClient.get<ApiResponse<SubscriptionPlan>>(`${BASE}/plans/${id}`);
  return res.data.data;
}

async function updatePlan(
  id: string,
  body: {
    name?: string;
    description?: string;
    is_active?: boolean;
    features_summary?: string;
  }
): Promise<SubscriptionPlan> {
  const res = await apiClient.patch<ApiResponse<SubscriptionPlan>>(`${BASE}/plans/${id}`, body);
  return res.data.data;
}

async function deactivatePlan(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/plans/${id}`);
}

async function getSettings(): Promise<SubscriptionSettings> {
  const res = await apiClient.get<ApiResponse<SubscriptionSettings>>(`${BASE}/settings`);
  return res.data.data;
}

async function updateSettings(body: Partial<SubscriptionSettings>): Promise<SubscriptionSettings> {
  const res = await apiClient.put<ApiResponse<SubscriptionSettings>>(`${BASE}/settings`, body);
  return res.data.data;
}

async function getWebhookConfig(): Promise<{ webhook_url: string; required_events: string[] }> {
  const res = await apiClient.get<ApiResponse<{ webhook_url: string; required_events: string[] }>>(`${BASE}/webhook-config`);
  return res.data.data;
}

async function listSubscribers(params?: {
  page?: number;
  limit?: number;
  status?: string;
  plan_id?: string;
  search?: string;
}): Promise<SubscriberListResult> {
  const res = await apiClient.get<ApiResponse<SubscriberListResult>>(`${BASE}/subscribers`, {
    params,
  });
  return res.data.data;
}

async function getSubscriber(id: string): Promise<SubscriberDetail> {
  const res = await apiClient.get<ApiResponse<SubscriberDetail>>(`${BASE}/subscribers/${id}`);
  return res.data.data;
}

async function cancelSubscription(id: string): Promise<void> {
  await apiClient.post(`${BASE}/subscribers/${id}/cancel`);
}

async function pauseSubscription(id: string): Promise<void> {
  await apiClient.post(`${BASE}/subscribers/${id}/pause`);
}

async function resumeSubscription(id: string): Promise<void> {
  await apiClient.post(`${BASE}/subscribers/${id}/resume`);
}

async function getAnalytics(): Promise<SubscriptionAnalytics> {
  const res = await apiClient.get<ApiResponse<SubscriptionAnalytics>>(`${BASE}/analytics`);
  return res.data.data;
}

async function getPageConfig(): Promise<unknown> {
  const res = await apiClient.get<ApiResponse<unknown>>(`${BASE}/settings/page-config`);
  return res.data.data;
}

async function updatePageConfig(sections: unknown[]): Promise<unknown> {
  const res = await apiClient.put<ApiResponse<unknown>>(`${BASE}/settings/page-config`, { sections });
  return res.data.data;
}

export const tenantSubscriptionsApi = {
  createPlan,
  listPlans,
  getPlan,
  updatePlan,
  deactivatePlan,
  getSettings,
  updateSettings,
  getWebhookConfig,
  getAnalytics,
  listSubscribers,
  getSubscriber,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getPageConfig,
  updatePageConfig,
};
