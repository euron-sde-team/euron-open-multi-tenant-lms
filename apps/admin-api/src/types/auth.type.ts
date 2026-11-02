/**
 * JWT Token Types
 * Distinguishes between different user types in the platform
 */
export const TokenType = {
  ADMIN: "admin",
  TENANT: "tenant",
  MEMBER: "member",
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

/**
 * Base JWT Payload structure
 * All token types extend this
 */
export interface BaseJwtPayload {
  id: string;
  email: string;
  type: TokenType;
  iat?: number; // Issued at (added by JWT library)
  exp?: number; // Expiration (added by JWT library)
}

/**
 * Tenant User JWT Payload
 */
export interface TenantJwtPayload extends BaseJwtPayload {
  type: typeof TokenType.TENANT;
}

/**
 * Signup request data
 */
export interface SignupData {
  email: string;
  password: string;
  name: string;
  /** Optional E.164 phone number, stored unverified. */
  phone?: string;
}

/**
 * Login response data
 */
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Signup response, same shape as LoginResponse (no tenant created at signup)
 */
export type SignupResponse = LoginResponse;

/**
 * Create organization request data
 */
export interface CreateOrganizationData {
  name: string;
  /**
   * When present, the bare-org-create path is replaced by the auto-provisioning
   * flow: pick template/theme via intelligence layer + the AI model, seed home +
   * about + faq + terms + privacy pages, seed sample DRAFT course, persist
   * quiz answers + creator_intent_profile on tenant_users.
   *
   * Optional, bare create still works without these fields.
   */
  quiz_answers?: import("../lib/creator-intent/types").QuizAnswers;
  timezone?: string;
}

/**
 * Create organization response data
 */
export interface CreateOrganizationResponse {
  id: string;
  name: string;
  slug: string;
  /** URL to the tenant's subdomain (e.g., https://x-academy.example.com) */
  subdomainUrl?: string;
  // Populated only when quiz-driven provisioning ran:
  sample_course_slug?: string;
  sample_course_url?: string;
  template_id?: string;
  theme_id?: string;
  generation_source?: "ai" | "fallback";
}

/**
 * Metadata extracted from the HTTP request on login/signup
 */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  } | null;
  timezone?: string;
}

/**
 * User profile with tenant memberships
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: string;
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  phone: string | null;
  phone_verified: boolean;
  designation: string | null;
  profile_completed_at: Date | null;
  tenants: TenantMembership[];
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
  joined_at: Date | null;
}
