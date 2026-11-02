/**
 * Plans API, list plans, check eligibility for subscription purchase.
 */

import { apiClient } from "./axios";

const BASE = "/tenant/plans";

export interface PlanListItem {
  id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  plan_description: string | null;
  sort_order: number;
  version: number;
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  pricing_frequency: string;
  purchase_mode: string;
  price_two_yearly_inr: number;
  price_two_yearly_usd: number;
  is_active: boolean;
}

export interface PlanProductItem {
  product_code: string;
  product_title: string | null;
  feature_key: string;
  feature_name: string;
  feature_category: string;
  feature_sort_order: number;
  constraint_type: "BOOLEAN" | "COUNT" | "LIMIT";
  unit: string | null;
  limit_value: number;
  is_unlimited: boolean;
}

export interface PlanWithProducts extends PlanListItem {
  products: PlanProductItem[];
}

export interface EligibilityConflict {
  product_code: string;
  feature_name: string;
  current_used: number;
  new_limit: number;
  unit: string | null;
}

export interface EligibilityResult {
  can_subscribe: boolean;
  is_upgrade: boolean;
  is_downgrade: boolean;
  conflicts?: EligibilityConflict[];
  current_subscription?: {
    id: string;
    plan_version_id: string;
    plan_name: string;
    status: string;
  };
  trial_available?: boolean;
}

export const plansApi = {
  listPlans: () =>
    apiClient
      .get<{ data: { plans: PlanListItem[] } }>(BASE)
      .then((r) => r.data.data.plans),

  listPlansWithProducts: () =>
    apiClient
      .get<{ data: { plans: PlanWithProducts[] } }>(`${BASE}/with-products`)
      .then((r) => r.data.data.plans),

  getEligibility: (planVersionId: string, currency?: "INR" | "USD") =>
    apiClient
      .get<{ data: EligibilityResult }>(`${BASE}/${planVersionId}/eligibility`, {
        params: currency ? { currency } : undefined,
      })
      .then((r) => r.data.data),

  activateFreePlan: (planVersionId: string) =>
    apiClient
      .post<{ data: { subscription_id: string } }>(`${BASE}/${planVersionId}/activate-free`)
      .then((r) => r.data.data),
};
