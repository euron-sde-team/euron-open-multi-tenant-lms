// Page Types - Page configuration and tenant settings

import type { SectionConfig } from "./section";
import type { ThemeConfig } from "./theme";
import type { PageLayoutOverrides, TenantLayout } from "./layout";
import type { AvailableRoutesResponse } from "./link";

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: "summary" | "summary_large_image";
  canonicalUrl?: string;
  noIndex?: boolean;
}

export interface PageConfig {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  sections: SectionConfig[];
  theme: ThemeConfig;
  seo: SEOConfig;
  isPublished: boolean;
  isHomePage?: boolean; // Flag to identify the home page
  layoutOverrides?: PageLayoutOverrides; // Per-page layout visibility overrides
  layout?: TenantLayout; // Embedded layout for this page
  metadata?: Record<string, unknown>; // Extensible metadata for additional data (e.g., LMS config)
  availableRoutes?: AvailableRoutesResponse; // Tenant-scoped routes for Button Generation Engine
  /** True when the underlying content (course/book) is ARCHIVED, hidden from discovery but accessible to purchasers. */
  is_archived?: boolean;
  /**
   * Custom-code pages. When renderMode is "CUSTOM_CODE" the page body is the
   * tenant's own HTML document (customHtml), rendered in a sandboxed iframe
   * instead of the section templates. Absent/"SECTIONS" = normal page.
   */
  renderMode?: "SECTIONS" | "CUSTOM_CODE";
  customCodeKind?: "SANITIZED_INLINE" | "SANDBOXED_IFRAME" | null;
  /** Published HTML document served for a custom-code page. */
  customHtml?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  customDomain?: string;
  logo?: string;
  favicon?: string;
  defaultTheme: ThemeConfig;
  pages: PageConfig[];
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  allowCustomDomain: boolean;
  maxPages: number;
  analyticsEnabled: boolean;
  customCss?: string;
  customScripts?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  contactEmail?: string;
  supportEmail?: string;
}

export interface TenantDomain {
  tenantId: string;
  type: "subdomain" | "custom";
  domain: string;
  verified: boolean;
  sslEnabled: boolean;
  createdAt: string;
}

// Template types
export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: "modern" | "classic" | "bold" | "minimal" | "creative";
  sections: Omit<SectionConfig, "id" | "createdAt" | "updatedAt">[];
  defaultTheme: ThemeConfig;
}
