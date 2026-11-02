/* ------------------------------------------------------------------ */
/*  Types matching the tenant features resolver API response           */
/* ------------------------------------------------------------------ */

/**
 * A tenant application (from GET /tenant/applications)
 */
export interface TenantApplication {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  status: string;
  sort_order: number;
}

/**
 * A resolved product within a feature (limit + usage data)
 */
export interface ResolvedProduct {
  code: string;
  constraint_type: "BOOLEAN" | "COUNT" | "LIMIT";
  limit_value: number;
  used_value: number;
  is_unlimited: boolean;
  unit: string | null;
}

/**
 * A resolved feature, contains enable state and product usage data
 */
export interface ResolvedFeature {
  key: string;
  name: string | null;
  category: string | null;
  /** Whether the feature is effectively enabled for this tenant */
  enabled: boolean;
  products: ResolvedProduct[];
}

/**
 * A resolved application with all its features
 * (from GET /tenant/features?application_code=...)
 */
export interface ResolvedApplication {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  features: ResolvedFeature[];
}

/* ------------------------------------------------------------------ */
/*  Sidebar feature map – maps feature keys to navigation items        */
/* ------------------------------------------------------------------ */

export interface FeatureSidebarItem {
  /** Route path (relative to /dashboard) */
  href: string;
  /** Display label in the sidebar */
  label: string;
  /** Lucide icon name (string key so the layout can resolve it) */
  icon: string;
  /** Feature keys that map to this sidebar item (any match → show) */
  featureKeys: string[];
  /** Sort order within the feature section of the sidebar */
  order: number;
}
