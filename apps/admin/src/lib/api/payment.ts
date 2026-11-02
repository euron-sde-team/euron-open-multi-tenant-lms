/**
 * Payment API: gateway connections (Stripe and Razorpay).
 * All routes are tenant-scoped (X-Tenant-Id from store).
 */

import { apiClient } from "./axios";

const BASE = "/tenant/payment";

// ─── Payment config ─────────────────────────────────────────────────────

export interface PaymentConfig {
  /** Backwards-compat field; prefer `webhooks.razorpay.url`. */
  razorpay_webhook_url: string;
  // Every entry stays optional so the frontend can deploy ahead of the backend
  // that supplies it, a missing key just hides that provider's setup card.
  webhooks?: {
    razorpay?: { url: string };
    stripe?: { url: string; events?: string[] };
  };
}

export const paymentConfigApi = {
  getConfig: () =>
    apiClient.get<{ data: PaymentConfig }>(`${BASE}/config`).then((r) => r.data.data),
};

// ─── Providers & Gateway connections ─────────────────────────────────────

/** Field descriptor for provider credential form rendering */
export interface CredentialFieldSchema {
  key: string;
  label: string;
  type: "text" | "secret" | "select";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
}

export interface BillingProviderOption {
  id: string;
  name: string;
  credential_schema: CredentialFieldSchema[] | null;
}

export interface GatewayConnectionResponse {
  id: string;
  tenant_id: string;
  provider_id: string;
  provider_name: string;
  mode: "SELF_MANAGED" | "PLATFORM_MANAGED";
  label: string | null;
  credentials_configured: boolean;
  platform_commission_pct: number | null;
  platform_commission_flat: number | null;
  is_active: boolean;
  is_verified: boolean;
  status: string;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGatewayConnectionBody {
  provider_id: string;
  mode: "SELF_MANAGED" | "PLATFORM_MANAGED";
  label?: string | null;
  credentials?: Record<string, string> | null;
  platform_commission_pct?: number | null;
  platform_commission_flat?: string | null;
}

export interface UpdateGatewayConnectionBody {
  label?: string | null;
  is_active?: boolean;
  credentials?: Record<string, string> | null;
  platform_commission_pct?: number | null;
  platform_commission_flat?: string | null;
}

export const paymentApi = {
  listProviders: () =>
    apiClient.get<{ data: BillingProviderOption[] }>(`${BASE}/providers`).then((r) => r.data.data),

  listConnections: () =>
    apiClient.get<{ data: GatewayConnectionResponse[] }>(`${BASE}/gateway-connections`).then((r) => r.data.data),

  getConnection: (id: string) =>
    apiClient.get<{ data: GatewayConnectionResponse }>(`${BASE}/gateway-connections/${id}`).then((r) => r.data.data),

  createConnection: (body: CreateGatewayConnectionBody) =>
    apiClient.post<{ data: GatewayConnectionResponse }>(`${BASE}/gateway-connections`, body).then((r) => r.data.data),

  updateConnection: (id: string, body: UpdateGatewayConnectionBody) =>
    apiClient.patch<{ data: GatewayConnectionResponse }>(`${BASE}/gateway-connections/${id}`, body).then((r) => r.data.data),

  deleteConnection: (id: string) =>
    apiClient.delete(`${BASE}/gateway-connections/${id}`).then((r) => r.data),
};
