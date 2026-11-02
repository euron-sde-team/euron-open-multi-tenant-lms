import type { gateway_connection_status, gateway_mode } from "../db/enums";

export interface CreateGatewayConnectionRequest {
  provider_id: string;
  mode: gateway_mode;
  label?: string | null;
  /** For SELF_MANAGED: { key_id, key_secret, webhook_secret } (Razorpay) or equivalent */
  credentials?: Record<string, string> | null;
  platform_commission_pct?: number | null;
  platform_commission_flat?: number | null;
  is_active?: boolean;
}

export interface UpdateGatewayConnectionRequest {
  mode?: gateway_mode;
  label?: string | null;
  credentials?: Record<string, string> | null;
  platform_commission_pct?: number | null;
  platform_commission_flat?: number | null;
  is_active?: boolean;
}

export interface GatewayConnectionResponse {
  id: string;
  tenant_id: string;
  provider_id: string;
  provider_name: string;
  mode: gateway_mode;
  label: string | null;
  /** Never include raw credentials; at most "configured": true */
  credentials_configured: boolean;
  platform_commission_pct: number | null;
  platform_commission_flat: number | null;
  is_active: boolean;
  is_verified: boolean;
  connected_at: string | null;
  status: gateway_connection_status;
  created_at: string;
  updated_at: string;
}

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
