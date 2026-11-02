/**
 * Billing Provider Types
 * Request/Response DTOs for billing provider CRUD and analytics APIs
 */

/** Field descriptor for the credential form that tenants see when connecting this provider */
export interface CredentialFieldSchema {
  key: string;
  label: string;
  type: "text" | "secret" | "select";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
}

export interface CreateBillingProviderRequest {
  name: string;
  is_active?: boolean;
  is_visible_to_tenant?: boolean;
  credential_schema?: CredentialFieldSchema[] | null;
}

export interface UpdateBillingProviderRequest {
  name?: string;
  is_active?: boolean;
  is_visible_to_tenant?: boolean;
  credential_schema?: CredentialFieldSchema[] | null;
}

export interface BillingProviderResponse {
  id: string;
  name: string;
  credential_schema: CredentialFieldSchema[] | null;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
  is_visible_to_tenant: boolean;
}

export interface BillingProviderListResponse {
  data: BillingProviderResponse[];
  total: number;
}

export interface ProviderAnalyticsOverview {
  total_providers: number;
  active_providers: number;
  webhooks_this_month: number;
  platform_earning_this_month: number;
  tenant_earning_this_month: number;
  success_rate: number | null;
}

export interface ProviderAnalyticsItem {
  provider_id: string;
  provider_name: string;
  subscription_count: number;
  platform_earning_total: number;
  platform_earning_this_month: number;
  tenant_earning_total: number;
  tenant_earning_this_month: number;
  webhooks_this_month: number;
  success_rate: number | null;
}

export interface BillingProviderAnalyticsResponse {
  overview: ProviderAnalyticsOverview;
  providers: ProviderAnalyticsItem[];
}

export interface BillingProviderQueryParams {
  is_active?: boolean;
  page?: number;
  limit?: number;
}
