/**
 * Dashboard Statistics Types
 * Aggregated metrics for the admin dashboard
 */

export interface DashboardStatsResponse {
  tenants: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    cancelled: number;
  };
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    cancelled: number;
    expired: number;
    past_due: number;
  };
  mrr: number; // Monthly recurring revenue (normalized to monthly)
  applications: {
    total: number;
    active_assignments: number;
  };
  plan_distribution: Array<{
    plan_name: string;
    status: string;
    count: number;
  }>;
  recent_tenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: Date;
  }>;
  recent_subscriptions: Array<{
    id: string;
    tenant_id: string;
    tenant_name: string;
    plan_name: string;
    status: string;
    price: number;
    currency: string;
    billing_cycle: string;
    created_at: Date;
  }>;
}
