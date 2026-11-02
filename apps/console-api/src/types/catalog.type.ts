/**
 * Catalog Management Types
 * Request/Response DTOs for applications, features, products, plans, and versioning APIs
 */

// ============================================
// APPLICATION TYPES
// ============================================

export interface CreateApplicationRequest {
  code: string;
  name: string;
  description?: string;
  icon_url?: string;
  config?: Record<string, unknown> | null;
  is_public?: boolean;
  sort_order?: number;
}

export interface UpdateApplicationRequest {
  name?: string;
  description?: string;
  icon_url?: string;
  config?: Record<string, unknown> | null;
  is_active?: boolean;
  is_public?: boolean;
  sort_order?: number;
}

export interface ApplicationResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  config: Record<string, unknown> | null;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  feature_count?: number;
}

export interface ApplicationListResponse {
  applications: ApplicationResponse[];
  total: number;
}

export interface ApplicationQueryParams {
  is_active?: boolean;
  is_public?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// FEATURE TYPES
// ============================================

export interface CreateFeatureRequest {
  application_id: string;
  key: string;
  name?: string;
  description?: string;
  category?: string;
  sort_order?: number;
  is_navigable?: boolean;
  nav_route?: string;
  nav_label?: string;
  nav_icon?: string;
  nav_sort_order?: number;
}

export interface UpdateFeatureRequest {
  name?: string;
  description?: string;
  category?: string;
  sort_order?: number;
  is_navigable?: boolean;
  nav_route?: string;
  nav_label?: string;
  nav_icon?: string;
  nav_sort_order?: number;
}

export interface FeatureResponse {
  id: string;
  application_id: string;
  application_code?: string;
  application_name?: string;
  key: string;
  name: string | null;
  description: string | null;
  category: string | null;
  is_deprecated: boolean;
  sort_order: number;
  is_navigable: boolean;
  nav_route: string | null;
  nav_label: string | null;
  nav_icon: string | null;
  nav_sort_order: number;
  created_at: Date;
  product_count?: number;
}

export interface FeatureListResponse {
  features: FeatureResponse[];
  total: number;
}

export interface FeatureQueryParams {
  application_id?: string;
  category?: string;
  is_deprecated?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// PRODUCT TYPES
// ============================================

export type ConstraintType = "BOOLEAN" | "COUNT" | "LIMIT";
export type UsageScopeType = "TENANT" | "USER";
export type UsageWindowType = "LIFETIME" | "MONTHLY" | "YEARLY" | "DAILY";

export interface CreateProductRequest {
  feature_id: string;
  code: string;
  title?: string;
  constraint_type: ConstraintType;
  unit?: string;
  is_hard_limit?: boolean;
  usage_scope?: UsageScopeType;
  usage_window?: UsageWindowType;
}

export interface UpdateProductRequest {
  title?: string;
  unit?: string;
  is_hard_limit?: boolean;
  usage_scope?: UsageScopeType;
  usage_window?: UsageWindowType;
}

export interface ProductResponse {
  id: string;
  feature_id: string;
  feature_key?: string;
  feature_name?: string | null;
  application_code?: string;
  code: string;
  title: string | null;
  constraint_type: ConstraintType;
  unit: string | null;
  is_hard_limit: boolean;
  usage_scope: UsageScopeType;
  usage_window: UsageWindowType;
  created_at: Date;
  plan_version_count?: number;
}

export interface ProductListResponse {
  products: ProductResponse[];
  total: number;
}

export interface ProductQueryParams {
  feature_id?: string;
  application_id?: string;
  constraint_type?: ConstraintType;
  is_hard_limit?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// PLAN TYPES
// ============================================

export type PlanType = "SINGLE_APP" | "BUNDLE" | "ENTERPRISE";
export type DiscountType = "NONE" | "PERCENTAGE" | "FIXED";
export type PricingFrequency = "MONTHLY" | "YEARLY" | "TWO_YEARLY" | "BOTH" | "ALL";
export type PurchaseMode = "FREE" | "PAID";

export interface CreatePlanRequest {
  code: string;
  name: string;
  description?: string;
  plan_type?: PlanType;
  sort_order?: number;
  is_public?: boolean;
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  is_public?: boolean;
}

export interface PlanResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  plan_type: PlanType;
  sort_order: number;
  is_active: boolean;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
  active_version?: PlanVersionSummary | null;
  latest_version?: PlanVersionSummary | null;
  version_count?: number;
  applications?: ApplicationSummary[];
}

export interface PlanSummary {
  id: string;
  code: string;
  name: string;
  plan_type: PlanType;
}

export interface PlanListResponse {
  plans: PlanResponse[];
  total: number;
}

export interface PlanQueryParams {
  plan_type?: PlanType;
  is_active?: boolean;
  is_public?: boolean;
  has_active_version?: boolean; // true = only plans with an active version, false = only without
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// CREATE PLAN WITH VERSION (TRANSACTION)
// ============================================

export interface CreatePlanWithVersionRequest {
  // Plan fields
  code: string;
  name: string;
  description?: string;
  plan_type?: PlanType;
  sort_order?: number;
  is_public?: boolean;
  // Applications to link to the plan
  application_ids?: string[];
  // Pricing frequency - determines which fields are required
  pricing_frequency?: PricingFrequency;
  // First version pricing (defaults to 0 if not provided)
  price_monthly_inr?: number;
  price_yearly_inr?: number;
  price_monthly_usd?: number;
  price_yearly_usd?: number;
}

export interface CreatePlanWithVersionResponse {
  plan: PlanResponse;
  version: PlanVersionResponse;
}

// ============================================
// PLAN VERSION TYPES
// ============================================

export interface PlanVersionPricing {
  // Pricing frequency - determines which fields are required
  pricing_frequency?: PricingFrequency;
  purchase_mode?: PurchaseMode;
  // INR Pricing (conditionally required based on pricing_frequency)
  price_monthly_inr?: number;
  price_yearly_inr?: number;
  discount_monthly_inr_type?: DiscountType;
  discount_monthly_inr_value?: number;
  discount_yearly_inr_type?: DiscountType;
  discount_yearly_inr_value?: number;
  // USD Pricing (conditionally required based on pricing_frequency)
  price_monthly_usd?: number;
  price_yearly_usd?: number;
  discount_monthly_usd_type?: DiscountType;
  discount_monthly_usd_value?: number;
  discount_yearly_usd_type?: DiscountType;
  discount_yearly_usd_value?: number;
  // Two-yearly pricing
  price_two_yearly_inr?: number;
  price_two_yearly_usd?: number;
  discount_two_yearly_inr_type?: DiscountType;
  discount_two_yearly_inr_value?: number;
  discount_two_yearly_usd_type?: DiscountType;
  discount_two_yearly_usd_value?: number;
}

export interface OfferFields {
  is_offer?: boolean;
  offer_name?: string | null;
  offer_description?: string | null;
  offer_valid_from?: Date | string | null;
  offer_valid_to?: Date | string | null;
}

export interface CreatePlanVersionRequest extends PlanVersionPricing, OfferFields {
  products?: PlanVersionProductInput[];
}

export type UpdatePlanVersionRequest = Partial<PlanVersionPricing> & OfferFields;

export interface PlanVersionProductInput {
  product_id: string;
  limit_value: number;
  is_unlimited?: boolean;
}

export interface PlanVersionResponse {
  id: string;
  plan_id: string;
  version: number;
  // Pricing frequency
  pricing_frequency: PricingFrequency;
  purchase_mode: PurchaseMode;
  // INR Pricing
  price_monthly_inr: number;
  price_yearly_inr: number;
  discount_monthly_inr_type: DiscountType;
  discount_monthly_inr_value: number;
  discount_yearly_inr_type: DiscountType;
  discount_yearly_inr_value: number;
  // USD Pricing
  price_monthly_usd: number;
  price_yearly_usd: number;
  discount_monthly_usd_type: DiscountType;
  discount_monthly_usd_value: number;
  discount_yearly_usd_type: DiscountType;
  discount_yearly_usd_value: number;
  // Two-yearly Pricing
  price_two_yearly_inr: number;
  price_two_yearly_usd: number;
  discount_two_yearly_inr_type: DiscountType;
  discount_two_yearly_inr_value: number;
  discount_two_yearly_usd_type: DiscountType;
  discount_two_yearly_usd_value: number;
  // Status
  is_active: boolean;
  published_at: Date | null;
  retired_at: Date | null;
  created_at: Date;
  // Offer metadata
  is_offer: boolean;
  offer_name: string | null;
  offer_description: string | null;
  offer_valid_from: Date | null;
  offer_valid_to: Date | null;
  // Products
  products?: PlanVersionProductResponse[];
}

export interface PlanVersionSummary {
  id: string;
  version: number;
  is_active: boolean;
  pricing_frequency: PricingFrequency;
  purchase_mode: PurchaseMode;
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  price_two_yearly_inr: number;
  price_two_yearly_usd: number;
  published_at: Date | null;
  // Offer metadata
  is_offer: boolean;
  offer_name: string | null;
  offer_valid_from: Date | null;
  offer_valid_to: Date | null;
}

export interface PlanVersionListResponse {
  versions: PlanVersionResponse[];
  total: number;
}

// ============================================
// PLAN VERSION PRODUCT TYPES
// ============================================

export interface AddPlanVersionProductRequest {
  product_id: string;
  limit_value: number;
  is_unlimited?: boolean;
}

export interface PlanVersionProductResponse {
  id: string;
  plan_version_id: string;
  product_id: string;
  product_code?: string;
  feature_key?: string;
  constraint_type?: ConstraintType;
  unit?: string | null;
  limit_value: number;
  is_unlimited: boolean;
  created_at: Date;
}

// ============================================
// PLAN APPLICATION TYPES
// ============================================

export interface LinkPlanApplicationRequest {
  application_id: string;
}

export interface PlanApplicationResponse {
  id: string;
  plan_id: string;
  application_id: string;
  application_code?: string;
  application_name?: string;
  created_at: Date;
}

export interface PlanApplicationListResponse {
  applications: PlanApplicationResponse[];
  total: number;
}

// ============================================
// COMMON TYPES
// ============================================

export interface ApplicationSummary {
  id: string;
  code: string;
  name: string;
}
