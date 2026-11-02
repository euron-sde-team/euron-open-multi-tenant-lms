/**
 * Tenant Types for User-Facing APIs
 */

// ============================================
// TENANT CONTEXT TYPES
// ============================================

/**
 * Tenant context attached to requests after resolution
 */
export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

// ============================================
// TENANT PAGE TYPES
// ============================================

/**
 * SEO metadata for a tenant page
 */
export interface TenantPageSeo {
  title?: string;
  description?: string;
  keywords?: string[];
  og_title?: string;
  og_description?: string;
  og_image?: string;
  [key: string]: unknown;
}

/**
 * Theme configuration for a tenant page
 */
export interface TenantPageTheme {
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  [key: string]: unknown;
}

/**
 * Section in a tenant page
 */
export interface TenantPageSection {
  id: string;
  type: string;
  order: number;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Full tenant page response for single page API
 */
export interface TenantPageResponse {
  id: string;
  slug: string;
  title: string;
  sections: TenantPageSection[];
  theme: TenantPageTheme;
  seo: TenantPageSeo;
  published_at: Date | null;
}

/**
 * Summary tenant page for list API
 */
export interface TenantPageSummary {
  id: string;
  slug: string;
  title: string;
}

/**
 * List response for tenant pages
 */
export interface TenantPageListResponse {
  pages: TenantPageSummary[];
}
