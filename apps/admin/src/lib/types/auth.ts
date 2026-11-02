/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Signup request payload
 */
export interface SignupRequest {
  /** Optional, backend derives a default from the email local-part when absent */
  name?: string;
  email: string;
  password: string;
  phone: string;
  /** WhatsApp OTP code, required in production, ignored in non-production */
  otpCode?: string;
}

/**
 * User data returned from API
 */
export interface User {
  id: string;
  email: string;
  name: string;
}

/**
 * Tenant data
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** URL to the tenant's subdomain (e.g., https://northwind.example.com) */
  subdomainUrl?: string;
}

/**
 * Login response from API
 */
export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * Tenant membership info
 */
export interface TenantMembership {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  status: string;
  is_owner: boolean;
  joined_at: string | null;
}

/**
 * User profile with tenant memberships (from /me endpoint)
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: string;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  phone: string | null;
  phone_verified: boolean;
  designation: string | null;
  profile_completed_at: string | null;
  tenants: TenantMembership[];
  /** Role names for the current tenant */
  roles?: string[];
  /** Permission codes for the current tenant */
  permissions?: string[];
  /** Whether the user is the owner of the current tenant */
  is_owner?: boolean;
  /** True for platform operators, unlocks the all-tenants switcher search */
  is_platform_admin?: boolean;
  /** True when the X-Tenant-Id header pointed to a revoked/invalid tenant */
  tenant_access_denied?: boolean;
  /** The tenant ID the backend actually resolved to (may differ from X-Tenant-Id) */
  resolved_tenant_id?: string | null;
}

/**
 * API Response wrapper format
 */
export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

/**
 * Auth state for the store
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
