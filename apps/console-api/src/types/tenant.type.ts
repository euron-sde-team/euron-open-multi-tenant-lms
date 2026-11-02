/**
 * Tenant Management Types
 * Request/Response DTOs for tenants, tenant users, subscriptions, entitlements, and add-ons
 */

// ============================================
// COMMON TYPES
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// TENANT TYPES
// ============================================

export type TenantStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED";

export interface CreateTenantRequest {
  name: string;
  slug: string;
  custom_domain?: string;
  /** ID of an existing tenant user to set as owner (user must exist and be ACTIVE) */
  owner_user_id: string;
}

export interface UpdateTenantRequest {
  name?: string;
  custom_domain?: string;
}

export interface SuspendTenantRequest {
  reason: string;
}

export interface TenantDomainResponse {
  id: string;
  domain_type: "SUBDOMAIN" | "CUSTOM";
  domain_name: string;
  subdomain_prefix: string | null;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "FAILED" | "EXPIRED";
  is_primary: boolean;
  ssl_active: boolean;
  ssl_status: string | null;
  ownership_verified: boolean;
  verified_at: Date | null;
  created_at: Date;
}

export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  owner_user_id: string;
  status: TenantStatus;
  created_at: Date;
  updated_at: Date;
  // Expanded fields (detail)
  owner?: TenantUserResponse;
  subscription_count?: number;
  active_subscription?: SubscriptionResponse | null;
  domains?: TenantDomainResponse[];
  // List-only: owner and plan from joins (no N+1)
  owner_email?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  active_plan_name?: string | null;
  active_plan_code?: string | null;
  active_plan_status?: string | null;
  active_billing_cycle?: string | null;
  active_period_start?: Date | null;
  active_period_end?: Date | null;
  primary_domain?: string | null;
}

export type TenantListResponse = PaginatedResponse<TenantResponse>;

export type TenantSortOption = "latest" | "oldest";

export interface TenantQueryParams extends PaginationParams {
  status?: TenantStatus;
  search?: string;
  /** Sort by signup date: latest (default) or oldest */
  sort?: TenantSortOption;
  /** Filter tenants by their active subscription's plan code */
  plan?: string;
}

// ============================================
// TENANT USER TYPES (Global Identity)
// ============================================

export type TenantUserStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "INVITED";
export type StaffMembershipStatus = "ACTIVE" | "SUSPENDED" | "INVITED";

/**
 * Minimal tenant user item for global search (e.g. owner picker)
 */
export interface GlobalTenantUserSearchItem {
  id: string;
  email: string;
  name: string;
  status: TenantUserStatus;
}

export type GlobalTenantUserSearchListResponse = PaginatedResponse<GlobalTenantUserSearchItem>;

/**
 * Global tenant user - can be staff in multiple tenants
 */
export interface TenantUserResponse {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: TenantUserStatus; // Global status
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
  profile_completed_at?: Date | null;
  // Per-tenant context (when viewing in a tenant context)
  membership?: TenantStaffMembershipResponse;
  // Count of tenants this user belongs to
  tenant_count?: number;
}

/**
 * Membership in a specific tenant with per-tenant status and roles
 */
export interface TenantStaffMembershipResponse {
  id: string;
  tenant_id: string;
  user_id: string;
  status: StaffMembershipStatus;
  invited_by: string | null;
  invited_at: Date | null;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Expanded
  roles?: TenantRoleResponse[];
  is_owner?: boolean;
  // User details (when listing memberships)
  user?: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    status: TenantUserStatus;
  };
  // Tenant details (when listing user's tenants)
  tenant?: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
  };
}

/**
 * Combined view: User with their membership in a tenant context
 */
export interface TenantUserWithMembershipResponse {
  // User fields
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: TenantUserStatus;
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
  // Profile enrichment
  designation?: string | null;
  // Membership fields
  membership_id: string;
  tenant_id: string;
  membership_status: StaffMembershipStatus;
  joined_at: Date | null;
  // Expanded
  roles?: TenantRoleResponse[];
  is_owner?: boolean;
}

/**
 * Create a new user and add them to the tenant, or add existing user
 */
export interface CreateTenantUserRequest {
  email: string;
  name?: string; // Required if creating new user
  password?: string; // Optional - for new users
  role_ids?: string[]; // Initial roles to assign in this tenant
}

/**
 * Invite an existing user to a tenant by email
 */
export interface InviteTenantUserRequest {
  email: string;
  role_ids?: string[]; // Roles to assign upon acceptance
  message?: string; // Optional invitation message
}

/**
 * Update global user fields
 */
export interface UpdateTenantUserRequest {
  name?: string;
  avatar_url?: string;
  email?: string;
  // null explicitly clears the stored phone; undefined leaves it unchanged
  phone?: string | null;
}

/**
 * Update membership in a specific tenant
 */
export interface UpdateTenantMembershipRequest {
  status?: StaffMembershipStatus;
}

export type TenantUserListResponse = PaginatedResponse<TenantUserWithMembershipResponse>;

export interface TenantUserQueryParams extends PaginationParams {
  status?: StaffMembershipStatus; // Filter by membership status
  search?: string;
  include_global_suspended?: boolean; // Include users who are globally suspended
}

export interface AssignTenantUserRoleRequest {
  role_id: string;
}

/**
 * List tenants a user belongs to
 */
export interface UserTenantsQueryParams extends PaginationParams {
  status?: StaffMembershipStatus;
}

export type UserTenantsListResponse = PaginatedResponse<TenantStaffMembershipResponse>;

// ============================================
// GLOBAL STAFF MEMBER TYPES (For /members page)
// ============================================

/**
 * Query params for global staff members listing
 */
export interface GlobalStaffMemberQueryParams extends PaginationParams {
  search?: string;
  status?: TenantUserStatus;
  tenant_id?: string; // Filter by specific tenant
}

/**
 * Global staff member response - tenant user with aggregated info
 */
export interface GlobalStaffMemberResponse {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: TenantUserStatus;
  last_login_at: Date | null;
  created_at: Date;
  // Aggregated info
  tenant_count: number;
  primary_role: string | null; // First role found across memberships
  primary_tenant_name: string | null; // First tenant name
}

export type GlobalStaffMemberListResponse = PaginatedResponse<GlobalStaffMemberResponse>;

export interface GlobalStaffMemberDetailsResponse extends GlobalStaffMemberResponse {
  phone: string | null;
  memberships: {
    id: string; // membership_id
    tenant_id: string;
    tenant_name: string;
    tenant_slug: string | null;
    status: StaffMembershipStatus;
    joined_at: Date | null;
    roles: {
      id: string;
      name: string;
      code: string;
    }[];
  }[];
}

// ============================================
// TENANT ROLE TYPES (for reference)
// ============================================

export interface TenantRoleResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
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

// ============================================
// SUBSCRIPTION TYPES
// ============================================

export type SubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED"
  | "TRIALING";

export type BillingCycle = "MONTHLY" | "YEARLY";
export type Currency = "INR" | "USD";

export interface CreateSubscriptionRequest {
  plan_version_id: string;
  billing_cycle: BillingCycle;
  currency: Currency;
  // Optional: for external billing integration
  external_subscription_id?: string;
  external_customer_id?: string;
  // Trial support
  is_trial?: boolean;
  trial_ends_at?: string; // ISO date
  // Custom validity range, when provided, overrides the billing-cycle-derived
  // current_period_start / current_period_end. ISO dates.
  valid_from?: string;
  valid_to?: string;
  // Replace: cancel existing ACTIVE/TRIALING subscription and create new one
  replace_existing?: boolean;
  // Force: proceed even when existing usage exceeds new plan limits (usage carried over as-is)
  force?: boolean;
}

export interface CancelSubscriptionRequest {
  reason?: string;
  cancel_immediately?: boolean; // true = now, false = end of period
}

export interface UpgradeSubscriptionRequest {
  new_plan_version_id: string;
  prorate?: boolean; // Calculate prorated amount
  // Force: proceed even when existing usage exceeds new plan limits (usage carried over as-is)
  force?: boolean;
}

export interface SubscriptionResponse {
  id: string;
  tenant_id: string;
  plan_version_id: string;
  // Snapshots
  plan_code_snapshot: string;
  plan_name_snapshot: string;
  plan_version_snapshot: number;
  // Billing
  billing_cycle: BillingCycle;
  currency: Currency;
  original_price: number;
  discount_applied: number;
  price_snapshot: number;
  // External
  external_subscription_id: string | null;
  external_customer_id: string | null;
  // Dates
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  cancelled_at: Date | null;
  cancel_effective_at: Date | null;
  // Status
  status: SubscriptionStatus;
  created_at: Date;
  updated_at: Date;
  // Expanded
  plan_version?: PlanVersionSummary;
  entitlements_created?: number;
  applications_granted?: number;
}

export interface PlanVersionSummary {
  id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  version: number;
  is_active: boolean;
}

export type SubscriptionListResponse = PaginatedResponse<SubscriptionResponse>;

export interface SubscriptionQueryParams extends PaginationParams {
  status?: SubscriptionStatus;
}

// Global subscription list (across all tenants)
export interface GlobalSubscriptionResponse extends SubscriptionResponse {
  tenant_name: string;
  tenant_slug: string;
}

export type GlobalSubscriptionListResponse = PaginatedResponse<GlobalSubscriptionResponse>;

export interface GlobalSubscriptionQueryParams extends PaginationParams {
  status?: SubscriptionStatus;
  billing_cycle?: BillingCycle;
  currency?: Currency;
  search?: string; // search by tenant name, slug, plan name
}

// ============================================
// ENTITLEMENT TYPES
// ============================================

export type EntitlementSource = "PLAN" | "ADMIN" | "ADDON" | "PROMO";

export interface EntitlementResponse {
  id: string;
  tenant_id: string;
  product_id: string;
  // Denormalized
  application_code: string;
  feature_key: string;
  product_code: string;
  // Limits
  is_unlimited: boolean;
  limit_value: number;
  used_value: number;
  // Computed
  available_value: number; // limit_value - used_value (or Infinity if unlimited)
  usage_percentage: number; // (used_value / limit_value) * 100
  // Source
  source: EntitlementSource;
  source_subscription_id: string | null;
  source_plan_version_id: string | null;
  source_addon_id: string | null;
  // State
  is_active: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Expanded
  product?: ProductSummary;
  override_count?: number;
  latest_override?: EntitlementOverrideResponse | null;
}

export interface ProductSummary {
  id: string;
  code: string;
  constraint_type: "BOOLEAN" | "COUNT" | "LIMIT";
  unit: string | null;
  is_hard_limit: boolean;
  feature_key: string;
  feature_name: string | null;
}

export type EntitlementListResponse = PaginatedResponse<EntitlementResponse>;

export interface EntitlementQueryParams extends PaginationParams {
  application_code?: string;
  feature_key?: string;
  source?: EntitlementSource;
  is_active?: boolean;
}

export interface OverrideEntitlementRequest {
  new_limit_value: number;
  reason: string; // REQUIRED
}

export interface ResetUsageRequest {
  reason: string; // REQUIRED
}

export interface UpdateUsageRequest {
  new_used_value: number;
  reason: string; // REQUIRED
}

export interface CreateAdminEntitlementRequest {
  product_id: string;
  limit_value: number;
  is_unlimited?: boolean;
  reason: string; // REQUIRED, min 10 chars
}

export interface RevokeAdminEntitlementRequest {
  reason: string; // REQUIRED, min 10 chars
}

export interface EntitlementOverrideResponse {
  id: string;
  entitlement_id: string;
  old_limit_value: number;
  new_limit_value: number;
  reason: string;
  admin_id: string;
  admin_name?: string;
  created_at: Date;
}

// ============================================
// ENTITLEMENT CHECK/CONSUME TYPES
// ============================================

export interface EntitlementCheckRequest {
  tenant_id: string;
  feature_key: string;
  amount?: number; // Default 1
}

export interface EntitlementCheckResponse {
  allowed: boolean;
  reason?: string; // "OK", "LIMIT_REACHED", "NOT_FOUND", "INACTIVE"
  entitlement?: {
    id: string;
    is_unlimited: boolean;
    limit_value: number;
    used_value: number;
    available: number;
  };
}

export interface EntitlementConsumeRequest {
  tenant_id: string;
  feature_key: string;
  amount?: number; // Default 1
  resource_type?: string; // e.g., "course"
  resource_id?: string; // e.g., course ID
  idempotency_key?: string;
}

export interface EntitlementConsumeResponse {
  success: boolean;
  entitlement_id: string;
  new_used_value: number;
  remaining: number | "unlimited";
}

// ============================================
// TENANT ADD-ON TYPES
// ============================================

export type TenantAddonSource = "PURCHASED" | "ADMIN_PAID" | "ADMIN_FREE";
export type TenantAddonStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "SUSPENDED";

export interface GrantAddonRequest {
  addon_id: string;
  source: TenantAddonSource;
  custom_grant_value?: number; // Override addon's default
  reason?: string; // Required for ADMIN_FREE
  expires_at?: string; // ISO date for time-limited grants
}

export interface CancelTenantAddonRequest {
  reason?: string;
}

export interface TenantAddonResponse {
  id: string;
  tenant_id: string;
  addon_id: string;
  source: TenantAddonSource;
  status: TenantAddonStatus;
  custom_grant_value: number | null;
  addon_subscription_id: string | null;
  entitlement_id: string | null;
  granted_by: string | null;
  reason: string | null;
  activated_at: Date;
  cancelled_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // List-friendly (addon name/product for display without expanding addon)
  addon_name?: string;
  product_code?: string;
  grant_value?: number;
  // Expanded
  addon?: AddonSummary;
  entitlement?: EntitlementResponse;
}

export interface AddonSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  application_id: string;
  application_code?: string;
  product_id: string;
  product_code?: string;
  grant_value: number;
  is_unlimited: boolean;
}

export type TenantAddonListResponse = PaginatedResponse<TenantAddonResponse>;

export interface TenantAddonQueryParams extends PaginationParams {
  status?: TenantAddonStatus;
  source?: TenantAddonSource;
}

// ============================================
// ADDON CATALOG TYPES (for listing available addons)
// ============================================

export interface AddonCatalogResponse {
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
  // Pricing
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  // State
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
}

export interface AddonCatalogListResponse {
  addons: AddonCatalogResponse[];
  total: number;
}

export interface AddonCatalogQueryParams extends PaginationParams {
  application_id?: string;
  product_id?: string;
  is_active?: boolean;
  is_public?: boolean;
  search?: string;
}

export type AddonDiscountType = "NONE" | "PERCENTAGE" | "FIXED";

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
  Omit<
    CreateAddonRequest,
    "application_id" | "code" | "product_id"
  >
>;

// ============================================
// TENANT APPLICATION TYPES (for reference)
// ============================================

export type TenantAppStatus = "ACTIVE" | "TRIALING" | "SUSPENDED" | "CANCELLED";
export type TenantAppSource = "SUBSCRIPTION" | "ADMIN_TRIAL" | "ADMIN_GRANT" | "PROMO";

export interface TenantApplicationResponse {
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
  activated_at: Date;
  suspended_at: Date | null;
  trial_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type TenantApplicationListResponse = PaginatedResponse<TenantApplicationResponse>;

export interface TenantApplicationQueryParams extends PaginationParams {
  search?: string;
  status?: TenantAppStatus;
  source?: TenantAppSource;
}

export interface GrantApplicationRequest {
  application_id: string;
  source: "ADMIN_GRANT" | "ADMIN_TRIAL" | "PROMO";
  reason?: string;
  trial_ends_at?: string; // ISO date, relevant for ADMIN_TRIAL
}

export interface UpdateTenantApplicationRequest {
  status?: TenantAppStatus;
  reason?: string;
}

// ============================================
// TENANT MEMBERS (End-users in tenant)
// Data stored only in tenant_members (no separate members table)
// ============================================

export type TenantMemberStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface TenantMemberResponse {
  id: string;
  tenant_id: string;
  status: TenantMemberStatus;
  joined_at: Date;
  invited_by: string | null;
  created_at: Date;
  updated_at: Date;
  email: string | null;
  name: string;
  avatar_url: string | null;
  email_verified: boolean;
  last_login_at: Date | null;
  phone: string | null;
}

export type TenantMemberListResponse = PaginatedResponse<TenantMemberResponse>;

export interface TenantMemberQueryParams extends PaginationParams {
  search?: string;
  status?: TenantMemberStatus;
}

export interface GlobalMemberQueryParams extends PaginationParams {
  search?: string;
  status?: TenantMemberStatus;
  tenant_id?: string;
}

export interface GlobalMemberResponse extends TenantMemberResponse {
  tenant_name: string;
  tenant_slug: string;
}

export type GlobalMemberListResponse = PaginatedResponse<GlobalMemberResponse>;

// ============================================
// TENANT AUDIT LOG (Unified events)
// ============================================

export interface TenantAuditLogEntry {
  id: string;
  kind: "application" | "addon";
  ref_id: string;
  event_type: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  admin_id: string | null;
  is_system: boolean;
  created_at: Date;
  description: string;
}

export type TenantAuditLogListResponse = PaginatedResponse<TenantAuditLogEntry>;

export type TenantAuditLogQueryParams = PaginationParams;
