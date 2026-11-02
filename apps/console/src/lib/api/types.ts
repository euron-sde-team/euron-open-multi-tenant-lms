// ============================================
// Common Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

// ============================================
// Auth Types
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
}

// ============================================
// Admin User Types
// ============================================

export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: AdminUserStatus;
  email_verified: boolean;
  last_login_at: string | null;
  roles: Role[];
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateAdminUserRequest {
  email: string;
  password: string;
  name: string;
  avatar_url?: string;
  roleIds?: string[];
}

export interface UpdateAdminUserRequest {
  name?: string;
  avatar_url?: string;
  email_verified?: boolean;
}

export interface AdminUsersListResponse {
  users: AdminUser[];
  total: number;
}

// ============================================
// Role Types
// ============================================

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: Permission[];
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
}

export interface RolesListResponse {
  roles: Role[];
  total: number;
}

// ============================================
// Permission Types
// ============================================

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: string;
}

export interface CreatePermissionRequest {
  code: string;
  name: string;
  description?: string;
  category?: string;
}

export interface UpdatePermissionRequest {
  name?: string;
  description?: string;
  category?: string;
}

export interface PermissionsListResponse {
  permissions: Permission[];
  total: number;
}

export interface PermissionCategoriesResponse {
  categories: string[];
}

// ============================================
// Application Types
// ============================================

export interface Application {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  feature_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateApplicationRequest {
  code: string;
  name: string;
  description?: string;
  icon_url?: string;
  is_public?: boolean;
  sort_order?: number;
}

export interface UpdateApplicationRequest {
  name?: string;
  description?: string;
  icon_url?: string;
  is_active?: boolean;
  is_public?: boolean;
  sort_order?: number;
}

export interface ApplicationsListResponse {
  applications: Application[];
  total: number;
}

// ============================================
// Feature Types
// ============================================

export interface Feature {
  id: string;
  application_id: string;
  application_code: string;
  application_name: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  is_deprecated: boolean;
  sort_order: number;
  is_navigable: boolean;
  nav_route: string | null;
  nav_label: string | null;
  nav_icon: string | null;
  nav_sort_order: number;
  product_count: number;
  created_at: string;
  updated_at: string;
}

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

export interface FeaturesListResponse {
  features: Feature[];
  total: number;
}

export interface FeatureCategoriesResponse {
  categories: string[];
}

// ============================================
// Product Types
// ============================================

export type ConstraintType = 'BOOLEAN' | 'COUNT' | 'LIMIT';
export type UsageScopeType = 'TENANT' | 'USER';
export type UsageWindowType = 'LIFETIME' | 'MONTHLY' | 'YEARLY' | 'DAILY';

export interface Product {
  id: string;
  feature_id: string;
  feature_key: string;
  feature_name: string;
  application_code: string;
  code: string;
  title: string | null;
  constraint_type: ConstraintType;
  unit: string | null;
  is_hard_limit: boolean;
  usage_scope: UsageScopeType;
  usage_window: UsageWindowType;
  created_at: string;
  plan_version_count?: number;
}

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

export interface ProductsListResponse {
  products: Product[];
  total: number;
}

// ============================================
// Plan Types
// ============================================

export type PlanType = 'SINGLE_APP' | 'BUNDLE' | 'ENTERPRISE';
export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED';
export type PricingFrequency =
  | 'MONTHLY'
  | 'YEARLY'
  | 'TWO_YEARLY'
  | 'BOTH'
  | 'ALL';
export type PurchaseMode = 'FREE' | 'PAID';

export interface PlanVersion {
  id: string;
  plan_id: string;
  version: number;
  pricing_frequency: PricingFrequency;
  price_monthly_inr: number;
  price_yearly_inr: number;
  discount_monthly_inr_type: DiscountType;
  discount_monthly_inr_value: number;
  discount_yearly_inr_type: DiscountType;
  discount_yearly_inr_value: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  discount_monthly_usd_type: DiscountType;
  discount_monthly_usd_value: number;
  discount_yearly_usd_type: DiscountType;
  discount_yearly_usd_value: number;
  purchase_mode: PurchaseMode;
  price_two_yearly_inr: number;
  price_two_yearly_usd: number;
  discount_two_yearly_inr_type: DiscountType;
  discount_two_yearly_inr_value: number;
  discount_two_yearly_usd_type: DiscountType;
  discount_two_yearly_usd_value: number;
  is_active: boolean;
  published_at: string | null;
  retired_at: string | null;
  // Offer metadata
  is_offer: boolean;
  offer_name: string | null;
  offer_description: string | null;
  offer_valid_from: string | null;
  offer_valid_to: string | null;
  products: PlanVersionProduct[];
  created_at: string;
  updated_at: string;
}

export interface PlanVersionProduct {
  id: string;
  product_id: string;
  product_code: string;
  feature_key: string;
  constraint_type: ConstraintType;
  unit: string | null;
  limit_value: number | null;
  is_unlimited: boolean;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  plan_type: PlanType;
  sort_order: number;
  is_active: boolean;
  is_public: boolean;
  active_version: PlanVersion | null;
  latest_version: PlanVersion | null;
  version_count: number;
  applications: Application[];
  created_at: string;
  updated_at: string;
}

export interface CreatePlanRequest {
  code: string;
  name: string;
  description?: string;
  plan_type: PlanType;
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

export interface CreatePlanVersionRequest {
  // Pricing frequency determines which fields are required
  pricing_frequency?: PricingFrequency;
  // Pricing fields (conditionally required based on pricing_frequency)
  price_monthly_inr?: number;
  price_yearly_inr?: number;
  discount_monthly_inr_type?: DiscountType;
  discount_monthly_inr_value?: number;
  discount_yearly_inr_type?: DiscountType;
  discount_yearly_inr_value?: number;
  price_monthly_usd?: number;
  price_yearly_usd?: number;
  discount_monthly_usd_type?: DiscountType;
  discount_monthly_usd_value?: number;
  discount_yearly_usd_type?: DiscountType;
  discount_yearly_usd_value?: number;
  purchase_mode?: PurchaseMode;
  price_two_yearly_inr?: number;
  price_two_yearly_usd?: number;
  discount_two_yearly_inr_type?: DiscountType;
  discount_two_yearly_inr_value?: number;
  discount_two_yearly_usd_type?: DiscountType;
  discount_two_yearly_usd_value?: number;
  // Offer metadata
  is_offer?: boolean;
  offer_name?: string | null;
  offer_description?: string | null;
  offer_valid_from?: string | null;
  offer_valid_to?: string | null;
  products?: {
    product_id: string;
    limit_value?: number;
    is_unlimited?: boolean;
  }[];
}

export interface UpdatePlanVersionRequest {
  pricing_frequency?: PricingFrequency;
  price_monthly_inr?: number;
  price_yearly_inr?: number;
  discount_monthly_inr_type?: DiscountType;
  discount_monthly_inr_value?: number;
  discount_yearly_inr_type?: DiscountType;
  discount_yearly_inr_value?: number;
  price_monthly_usd?: number;
  price_yearly_usd?: number;
  discount_monthly_usd_type?: DiscountType;
  discount_monthly_usd_value?: number;
  discount_yearly_usd_type?: DiscountType;
  discount_yearly_usd_value?: number;
  purchase_mode?: PurchaseMode;
  price_two_yearly_inr?: number;
  price_two_yearly_usd?: number;
  discount_two_yearly_inr_type?: DiscountType;
  discount_two_yearly_inr_value?: number;
  discount_two_yearly_usd_type?: DiscountType;
  discount_two_yearly_usd_value?: number;
  // Offer metadata
  is_offer?: boolean;
  offer_name?: string | null;
  offer_description?: string | null;
  offer_valid_from?: string | null;
  offer_valid_to?: string | null;
}

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
  // Pricing frequency
  pricing_frequency?: PricingFrequency;
  // First version pricing (defaults to 0 if not provided)
  price_monthly_inr?: number;
  price_yearly_inr?: number;
  price_monthly_usd?: number;
  price_yearly_usd?: number;
}

export interface CreatePlanWithVersionResponse {
  plan: Plan;
  version: PlanVersion;
}

export interface PlansListResponse {
  plans: Plan[];
  total: number;
}

export interface PlanVersionsListResponse {
  versions: PlanVersion[];
  total: number;
}

export interface PlanApplicationsResponse {
  applications: {
    id: string;
    plan_id: string;
    application_id: string;
    application_code: string;
    application_name: string;
    created_at: string;
  }[];
  total: number;
}

// ============================================
// Tenant Types
// ============================================

export type TenantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export interface TenantSubscription {
  id: string;
  plan?: {
    name: string;
    code?: string;
    base_price_monthly?: number;
  };
  plan_version?: {
    version_number?: string;
  };
  status: string;
  billing_cycle?: string;
  currency?: string;
  price?: number;
  starts_at?: string;
  ends_at?: string | null;
  current_period_start?: string;
  current_period_end?: string;
}

export interface TenantOwner {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  name?: string;
  avatar_url?: string | null;
  status?: string;
  email_verified?: boolean;
  last_login_at?: string | null;
  created_at?: string;
  // Phone verification
  phone?: string | null;
  phone_verified?: boolean;
  // Geo/metadata
  signup_country?: string | null;
  signup_city?: string | null;
  signup_ip?: string | null;
  signup_referrer?: string | null;
  timezone?: string | null;
  // Login tracking
  last_login_ip?: string | null;
  login_count?: number;
  // Profile enrichment
  designation?: string | null;
  profile_completed_at?: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  status: TenantStatus;
  /** @deprecated use owner_user_id */
  owner_id?: string;
  owner_user_id: string;
  owner?: TenantOwner;
  suspended_at?: string | null;
  suspension_reason?: string | null;
  created_at: string;
  updated_at: string;
  subscriptions?: TenantSubscription[];
  applications_count?: number;
  users_count?: number;
  // List response: from joins (owner_email, owner_name, active_plan_name)
  owner_email?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  active_plan_name?: string | null;
  active_plan_code?: string | null;
  active_plan_status?: string | null;
  active_billing_cycle?: string | null;
  active_period_start?: string | null;
  active_period_end?: string | null;
  primary_domain?: string | null;
  // Detail response
  subscription_count?: number;
  active_subscription?: {
    id: string;
    plan_name_snapshot: string;
    plan_code_snapshot?: string;
    status: string;
    billing_cycle?: string;
    currency?: string;
    price_snapshot?: number;
    current_period_start?: string;
    current_period_end?: string;
  } | null;
  domains?: TenantDomain[];
}

export interface TenantDomain {
  id: string;
  domain_type: 'SUBDOMAIN' | 'CUSTOM';
  domain_name: string;
  subdomain_prefix?: string | null;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'FAILED' | 'EXPIRED';
  is_primary: boolean;
  ssl_active: boolean;
  ssl_status?: string | null;
  ownership_verified: boolean;
  verified_at?: string | null;
  created_at: string;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  custom_domain?: string;
  owner_user_id: string;
}

export interface UpdateTenantRequest {
  name?: string;
  custom_domain?: string;
}

export interface TenantsListResponse {
  data: Tenant[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type TenantAppStatus = 'ACTIVE' | 'TRIALING' | 'SUSPENDED' | 'CANCELLED';
export type TenantAppSource =
  | 'SUBSCRIPTION'
  | 'ADMIN_TRIAL'
  | 'ADMIN_GRANT'
  | 'PROMO';

export interface TenantApplication {
  id: string;
  tenant_id: string;
  application_id: string;
  application_code: string;
  application_name: string;
  status: TenantAppStatus;
  source: TenantAppSource;
  source_subscription_id: string | null;
  granted_by: string | null;
  grant_reason: string | null;
  activated_at: string;
  suspended_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantApplicationsListResponse {
  data: TenantApplication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TenantApplicationsFilters extends PaginationParams {
  search?: string;
  status?: TenantAppStatus;
  source?: TenantAppSource;
}

export interface GrantApplicationRequest {
  application_id: string;
  source: 'ADMIN_GRANT' | 'ADMIN_TRIAL' | 'PROMO';
  reason?: string;
  trial_ends_at?: string;
}

export interface UpdateTenantApplicationRequest {
  status?: TenantAppStatus;
  reason?: string;
}

// ============================================
// Tenant User Types
// ============================================

export interface TenantRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface TenantPermission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: string;
}

export interface TenantRoleWithPermissions extends TenantRole {
  permission_count: number;
  permissions: TenantPermission[];
}

export interface CreateTenantPermissionRequest {
  code: string;
  name: string;
  category: string;
  description?: string;
}

export interface UpdateTenantPermissionRequest {
  name?: string;
  description?: string;
  category?: string;
}

export interface CreateTenantRoleRequest {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateTenantRoleRequest {
  code?: string;
  name?: string;
  description?: string;
}

export type TenantUserStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED'
  | 'INVITED';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED';

/** Minimal user item for global search (e.g. owner picker) */
export interface GlobalTenantUserSearchItem {
  id: string;
  email: string;
  name: string;
  status: TenantUserStatus;
}

export interface GlobalTenantUserSearchListResponse {
  data: GlobalTenantUserSearchItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Role assigned to a tenant user (from tenant_roles), for list display */
export interface TenantUserRoleSummary {
  id: string;
  code: string;
  name: string;
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: TenantUserStatus;
  membership_id: string;
  tenant_id: string;
  membership_status: MembershipStatus;
  joined_at: string | null;
  is_owner: boolean;
  roles?: TenantUserRoleSummary[];
  // Phone verification
  phone?: string | null;
  phone_verified?: boolean;
  // Geo/metadata
  signup_country?: string | null;
  signup_city?: string | null;
  timezone?: string | null;
  // Login tracking
  last_login_ip?: string | null;
  login_count?: number;
  last_login_at?: string | null;
  // Profile enrichment
  designation?: string | null;
}

export interface CreateTenantUserRequest {
  email: string;
  name?: string;
  password?: string;
  role_ids?: string[];
}

export interface InviteTenantUserRequest {
  email: string;
  role_ids?: string[];
  message?: string;
}

export interface UpdateTenantUserRequest {
  name?: string;
  avatar_url?: string;
  email?: string;
  // null explicitly clears the stored phone; undefined leaves it unchanged
  phone?: string | null;
}

export interface UpdateMembershipRequest {
  status: MembershipStatus;
}

export interface TenantUsersListResponse {
  data: TenantUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Global Staff Members (For /members page)
// ============================================

export interface GlobalStaffMembersFilters extends PaginationParams {
  search?: string;
  status?: TenantUserStatus;
  tenant_id?: string;
}

export interface GlobalStaffMember {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: TenantUserStatus;
  last_login_at: string | null;
  created_at: string;
  tenant_count: number;
  primary_role: string | null;
  primary_tenant_name: string | null;
}

export interface GlobalStaffMembersListResponse {
  data: GlobalStaffMember[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GlobalStaffMemberDetailsResponse extends GlobalStaffMember {
  phone: string | null;
  memberships: {
    id: string; // membership_id
    tenant_id: string;
    tenant_name: string;
    tenant_slug: string | null;
    status: TenantMemberStatus;
    joined_at: string | null;
    roles: {
      id: string;
      name: string;
      code: string;
    }[];
  }[];
}

// ============================================
// Tenant Members (End-users in tenant)
// Data stored only in tenant_members (no separate members table)
// ============================================

export type TenantMemberStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface TenantMember {
  id: string;
  tenant_id: string;
  status: TenantMemberStatus;
  joined_at: string;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  email_verified: boolean;
  last_login_at: string | null;
  phone: string | null;
}

export interface TenantMembersListResponse {
  data: TenantMember[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TenantMembersFilters extends PaginationParams {
  search?: string;
  status?: TenantMemberStatus;
}

export interface GlobalMembersFilters extends PaginationParams {
  search?: string;
  status?: TenantMemberStatus;
  tenant_id?: string;
}

export interface GlobalMember extends TenantMember {
  tenant_name: string;
  tenant_slug: string;
}

export interface GlobalMembersListResponse {
  data: GlobalMember[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Tenant Audit Log
// ============================================

export interface TenantAuditLogEntry {
  id: string;
  kind: 'application' | 'addon';
  ref_id: string;
  event_type: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  admin_id: string | null;
  is_system: boolean;
  created_at: string;
  description: string;
}

export interface TenantAuditLogListResponse {
  data: TenantAuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type TenantAuditLogFilters = PaginationParams;

export interface GlobalUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: TenantUserStatus;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  tenant_count: number;
}

export interface UserTenantsResponse {
  data: {
    id: string;
    tenant_id: string;
    user_id: string;
    status: MembershipStatus;
    invited_at: string | null;
    joined_at: string | null;
    tenant: {
      id: string;
      name: string;
      slug: string;
      status: TenantStatus;
    };
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Subscription Types
// ============================================

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type Currency = 'INR' | 'USD';
export type SubscriptionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TRIALING';

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_version_id: string;
  plan_code_snapshot: string;
  plan_name_snapshot: string;
  plan_version_snapshot?: number;
  /** @deprecated use plan_name_snapshot */
  plan_name?: string;
  billing_cycle: BillingCycle;
  currency: Currency;
  original_price?: number;
  discount_applied?: number;
  price_snapshot: number;
  /** @deprecated use price_snapshot */
  price?: number;
  status: SubscriptionStatus;
  is_trial?: boolean;
  trial_ends_at?: string | null;
  started_at: string;
  /** @deprecated use started_at */
  starts_at?: string;
  current_period_start: string;
  current_period_end: string;
  ends_at?: string | null;
  cancelled_at: string | null;
  cancel_effective_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionRequest {
  plan_version_id: string;
  billing_cycle: BillingCycle;
  currency: Currency;
  is_trial?: boolean;
  trial_ends_at?: string;
  /** Custom validity range, overrides the billing-cycle-derived period */
  valid_from?: string;
  valid_to?: string;
  /** Cancel existing ACTIVE/TRIALING subscription and create new one */
  replace_existing?: boolean;
  /** Force: proceed even when existing usage exceeds new plan limits */
  force?: boolean;
}

export interface CancelSubscriptionRequest {
  reason?: string;
  cancel_immediately?: boolean;
}

export interface UpgradeSubscriptionRequest {
  new_plan_version_id: string;
  prorate?: boolean;
  /** Force: proceed even when existing usage exceeds new plan limits */
  force?: boolean;
}

/** Conflict detail when entitlement usage exceeds new plan limits */
export interface EntitlementConflict {
  feature_key: string;
  product_code: string;
  application_code: string;
  current_used: number;
  new_limit: number;
  /** true when the new plan doesn't include this feature at all */
  dropped: boolean;
}

/** Matches backend PaginatedResponse - use .data for the array */
export interface SubscriptionsListResponse {
  data: Subscription[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Global subscription with tenant info (cross-tenant list) */
export interface GlobalSubscription extends Subscription {
  tenant_name: string;
  tenant_slug: string;
}

export interface GlobalSubscriptionsListResponse {
  data: GlobalSubscription[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GlobalSubscriptionsFilters extends PaginationParams {
  status?: SubscriptionStatus;
  billing_cycle?: BillingCycle;
  currency?: Currency;
  search?: string;
}

// ============================================
// Entitlement Types
// ============================================

export type EntitlementSource = 'PLAN' | 'ADMIN' | 'ADDON' | 'PROMO';

export interface Entitlement {
  id: string;
  tenant_id: string;
  product_id: string;
  product_code: string;
  feature_key: string;
  application_code?: string;
  constraint_type?: ConstraintType;
  unit: string | null;
  limit_value: number | null;
  is_unlimited: boolean;
  /** Backend field name */
  used_value: number;
  /** Alias for used_value for display */
  current_usage?: number;
  source: EntitlementSource | 'SUBSCRIPTION' | 'ADDON' | 'OVERRIDE';
  source_subscription_id?: string | null;
  source_addon_id?: string | null;
  subscription_id?: string | null;
  addon_id?: string | null;
  override_reason?: string | null;
  available_value?: number;
  usage_percentage?: number;
  is_active?: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OverrideEntitlementRequest {
  new_limit_value: number;
  reason: string;
}

export interface ResetUsageRequest {
  reason: string;
}

export interface UpdateUsageRequest {
  new_used_value: number;
  reason: string;
}

export interface CheckEntitlementRequest {
  tenant_id: string;
  feature_key: string;
  amount?: number;
}

export interface CheckEntitlementResponse {
  can_consume: boolean;
  current_usage: number;
  limit_value: number | null;
  is_unlimited: boolean;
  remaining: number | null;
}

export interface ConsumeEntitlementRequest {
  tenant_id: string;
  feature_key: string;
  amount: number;
  resource_type?: string;
  resource_id?: string;
  idempotency_key?: string;
}

/** Matches backend PaginatedResponse - use .data for the array */
export interface EntitlementsListResponse {
  data: Entitlement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OverrideHistoryResponse {
  overrides: {
    id: string;
    entitlement_id: string;
    previous_value: number | null;
    new_value: number;
    reason: string;
    admin_id: string;
    admin_name: string;
    created_at: string;
  }[];
  total: number;
}

// ============================================
// Addon Types
// ============================================

export type AddonSource = 'PURCHASED' | 'ADMIN_PAID' | 'ADMIN_FREE';
export type TenantAddonStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
export type AddonDiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED';

export interface Addon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  application_id: string;
  application_code: string;
  application_name: string;
  product_id: string;
  product_code: string;
  product_constraint_type: string;
  feature_key: string;
  grant_value: number;
  is_unlimited: boolean;
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
}

export interface CreateAddonRequest {
  application_id: string;
  code: string;
  name: string;
  description?: string | null;
  product_id: string;
  grant_value: number;
  is_unlimited: boolean;
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  discount_monthly_inr_type?: AddonDiscountType;
  discount_monthly_inr_value?: number;
  discount_yearly_inr_type?: AddonDiscountType;
  discount_yearly_inr_value?: number;
  discount_monthly_usd_type?: AddonDiscountType;
  discount_monthly_usd_value?: number;
  discount_yearly_usd_type?: AddonDiscountType;
  discount_yearly_usd_value?: number;
  is_active?: boolean;
  is_public?: boolean;
  sort_order?: number;
}

export type UpdateAddonRequest = Partial<
  Omit<CreateAddonRequest, 'application_id' | 'code' | 'product_id'>
>;

export interface TenantAddon {
  id: string;
  tenant_id: string;
  addon_id: string;
  addon_name: string;
  product_code: string;
  feature_key: string;
  source: AddonSource;
  grant_value: number;
  price_paid: number | null;
  currency: Currency | null;
  status: TenantAddonStatus;
  reason: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrantAddonRequest {
  addon_id: string;
  source: AddonSource;
  custom_grant_value?: number;
  reason?: string;
  expires_at?: string;
}

export interface CancelAddonRequest {
  reason: string;
}

export interface AddonsListResponse {
  addons: Addon[];
  total: number;
}

/** Matches backend PaginatedResponse - use .data for the array */
export interface TenantAddonsListResponse {
  data: TenantAddon[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

// ============================================
// Billing Provider Types
// ============================================

/** Field descriptor for the credential form that tenants see when connecting this provider */
export interface CredentialFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'select';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
}

export interface BillingProvider {
  id: string;
  name: string;
  credential_schema: CredentialFieldSchema[] | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_visible_to_tenant: boolean;
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

export interface BillingProviderListResponse {
  data: BillingProvider[];
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

export interface BillingProvidersFilters extends PaginationParams {
  is_active?: boolean;
}

// ============================================
// Global Window Type Extension
// ============================================

// ============================================
// Activity Feed Types
// ============================================

export type ActivityKind = 'application' | 'addon' | 'usage';

export interface ActivityFeedEntry {
  id: string;
  kind: ActivityKind;
  tenant_id: string;
  tenant_name: string;
  event_type: string;
  description: string;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  admin_id: string | null;
  is_system: boolean;
  created_at: string;
}

export interface ActivityFeedListResponse {
  data: ActivityFeedEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityFeedFilters extends PaginationParams {
  kind?: ActivityKind;
  search?: string;
}

// ============================================
// Audit Log Types (DB-backed admin action trail)
// ============================================

export interface AuditLogEntry {
  id: string;
  actor_admin_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  category: string;
  resource_id: string | null;
  resource_label: string | null;
  tenant_id: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  is_system: boolean;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogFilters extends PaginationParams {
  actor?: string;
  category?: string;
  action?: string;
  tenant_id?: string;
  from?: string;
  to?: string;
  search?: string;
}

// ============================================
// Tenant Offerings, Sales & Revenue Types
// ============================================

export type CountBreakdown = Record<string, number>;

export interface TenantOfferingsSummary {
  courses: {
    total: number;
    by_status: CountBreakdown;
    by_type: CountBreakdown;
    by_mode: CountBreakdown;
  };
  books: { total: number; by_status: CountBreakdown };
  bundles: { total: number; by_status: CountBreakdown };
  batches: { total: number; by_status: CountBreakdown };
  test_series: { total: number; by_status: CountBreakdown };
  access_grants: {
    enrollments: number;
    book_access: number;
    batch_enrollments: number;
    test_series_enrollments: number;
  };
}

export interface OfferingCourseListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  course_type: string;
  mode: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number;
  created_at: string;
  section_count: number;
  lesson_count: number;
  lecture_count: number;
  enrollment_count: number;
}

export interface OfferingCourseLecture {
  id: string;
  title: string;
  duration: string | null;
  processing_status: string;
  video_provider: string | null;
}

export interface OfferingCourseLesson {
  id: string;
  title: string;
  type: string;
  lectures: OfferingCourseLecture[];
}

export interface OfferingCourseSection {
  id: string;
  title: string;
  lessons: OfferingCourseLesson[];
}

export interface OfferingCourseDetail {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  status: string;
  course_type: string;
  mode: string;
  purchase_mode: string;
  difficulty: string;
  language: string[];
  duration: string | null;
  learning_outcomes: string[];
  prerequisites: string[];
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number;
  enrollment_count: number;
  total_lectures: number;
  sections: OfferingCourseSection[];
}

export interface OfferingBookListItem {
  id: string;
  title: string;
  slug: string;
  author: string | null;
  status: string;
  purchase_mode: string;
  file_format: string;
  pages: number | null;
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number;
  sample_enabled: boolean;
  sample_pages: number | null;
  created_at: string;
  book_access_count: number;
}

export interface OfferingBookConversion {
  id: string;
  source_type: string;
  source_filename: string;
  source_size_bytes: number;
  output_key: string | null;
  output_size_bytes: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface OfferingBookDetail extends OfferingBookListItem {
  description: string | null;
  summary: string | null;
  url: string | null;
  page_images_count: number;
  conversions: OfferingBookConversion[];
}

export interface OfferingItemRef {
  item_type: string;
  id: string | null;
  title: string | null;
  slug: string | null;
}

export interface OfferingBundleListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number;
  created_at: string;
  items: OfferingItemRef[];
}

export interface OfferingBatchListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  start_date: string;
  end_date: string | null;
  enrollment_open_date: string | null;
  enrollment_close_date: string | null;
  duration_days: number | null;
  validity_days: number | null;
  total_enrollments: number;
  created_at: string;
  items: OfferingItemRef[];
}

export interface OfferingTestSeriesListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  pricing_type: string;
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number | null;
  visibility: string;
  access_mode: string;
  created_at: string;
  test_count: number;
  enrollment_count: number;
}

export interface SalesOrderListItem {
  id: string;
  order_number: string;
  order_type: string;
  item_id: string;
  item_title: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  currency: string;
  base_amount: number;
  discount_amount: number;
  net_amount: number;
  tax_amount: number;
  total_amount: number;
  platform_fee: number;
  tenant_payout_amount: number | null;
  gateway_provider_name: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
}

export interface RevenueCurrencyBlock {
  currency: string;
  gross_total: number;
  discount_total: number;
  net_total: number;
  tax_total: number;
  platform_fee_total: number;
  tenant_payout_total: number;
  paid_order_count: number;
  refunded_order_count: number;
  refunded_amount: number;
}

export interface RevenueByOrderType {
  currency: string;
  order_type: string;
  net_total: number;
  total_amount: number;
  order_count: number;
}

export interface TenantRevenueSummary {
  by_currency: RevenueCurrencyBlock[];
  by_order_type: RevenueByOrderType[];
}

export type OfferingCoursesListResponse =
  PaginatedResponse<OfferingCourseListItem>;
export type OfferingBooksListResponse = PaginatedResponse<OfferingBookListItem>;
export type OfferingBundlesListResponse =
  PaginatedResponse<OfferingBundleListItem>;
export type OfferingBatchesListResponse =
  PaginatedResponse<OfferingBatchListItem>;
export type OfferingTestSeriesListResponse =
  PaginatedResponse<OfferingTestSeriesListItem>;
export type SalesOrdersListResponse = PaginatedResponse<SalesOrderListItem>;

export interface OfferingsCoursesFilters extends PaginationParams {
  status?: string;
  course_type?: string;
  mode?: string;
  search?: string;
}

export interface OfferingsBooksFilters extends PaginationParams {
  status?: string;
  file_format?: string;
  search?: string;
}

export interface SalesOrdersFilters extends PaginationParams {
  order_type?: string;
  status?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardStats {
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
  mrr: number;
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
    created_at: string;
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
    created_at: string;
  }>;
}

// ============================================
// Plan Entitlement Sync (backfill to existing tenants)
// ============================================

export interface EntitlementSyncOptions {
  source_version_id?: string;
  version_ids?: string[];
  statuses?: SubscriptionStatus[];
  tenant_ids?: string[];
  grant_missing_applications?: boolean;
  /**
   * Opt in to also lifting the limit of an entitlement the tenant already holds.
   * Off by default: a normal run only adds entitlements the tenant is missing.
   */
  raise_existing_limits?: boolean;
}

export interface EntitlementSyncApplyRequest extends EntitlementSyncOptions {
  reason: string;
}

export interface EntitlementSyncChange {
  action: 'CREATE' | 'RAISE';
  product_id: string;
  product_code: string;
  feature_key: string;
  application_code: string;
  constraint_type: string;
  unit: string | null;
  source_limit_value: number;
  source_is_unlimited: boolean;
  current_entitlement_id: string | null;
  current_limit_value: number | null;
  current_is_unlimited: boolean | null;
  current_source: EntitlementSource | null;
  raise_entitlement_ids: string[];
  application_missing: boolean;
}

export interface EntitlementSyncTenantPlan {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_status: string;
  subscription_id: string;
  subscription_status: SubscriptionStatus;
  subscription_period_end: string;
  plan_version_id: string;
  plan_version: number;
  creates: EntitlementSyncChange[];
  raises: EntitlementSyncChange[];
  unchanged_count: number;
  applications_to_grant: Array<{
    application_id: string;
    application_code: string;
  }>;
  warnings: string[];
}

export interface EntitlementSyncProductSummary {
  product_id: string;
  product_code: string;
  feature_key: string;
  application_code: string;
  constraint_type: string;
  unit: string | null;
  limit_value: number;
  is_unlimited: boolean;
  tenants_to_create: number;
  tenants_to_raise: number;
  tenants_unchanged: number;
}

export interface EntitlementSyncPlanRef {
  id: string;
  code: string;
  name: string;
}

export interface EntitlementSyncVersionRef {
  id: string;
  version: number;
  is_active: boolean;
  published_at: string | null;
  retired_at: string | null;
}

export interface EntitlementSyncPreview {
  plan: EntitlementSyncPlanRef;
  source_version: EntitlementSyncVersionRef;
  options_used: {
    statuses: SubscriptionStatus[];
    version_ids: string[] | null;
    tenant_ids: string[] | null;
    grant_missing_applications: boolean;
    raise_existing_limits: boolean;
  };
  summary: {
    tenants_matched: number;
    tenants_with_changes: number;
    entitlements_to_create: number;
    entitlements_to_raise: number;
    entitlements_unchanged: number;
    applications_to_grant: number;
  };
  products: EntitlementSyncProductSummary[];
  tenants: EntitlementSyncTenantPlan[];
}

export interface EntitlementSyncTenantResult {
  tenant_id: string;
  tenant_name: string;
  outcome: 'APPLIED' | 'NO_CHANGE' | 'FAILED';
  entitlements_created: number;
  entitlements_raised: number;
  applications_granted: number;
  created_product_codes: string[];
  raised_product_codes: string[];
  error?: string;
}

export interface EntitlementSyncResult {
  plan: EntitlementSyncPlanRef;
  source_version: EntitlementSyncVersionRef;
  summary: {
    tenants_processed: number;
    tenants_changed: number;
    tenants_failed: number;
    entitlements_created: number;
    entitlements_raised: number;
    applications_granted: number;
  };
  tenants: EntitlementSyncTenantResult[];
}

declare global {
  interface Window {
    authContext?: {
      authenticated: string | null;
      setAuthenticated: (token: string) => void;
    };
  }
}
