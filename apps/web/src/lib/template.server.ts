import type { PageConfig, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { headers } from "next/headers";

/**
 * Resolve the original tenant hostname from request headers.
 * The Cloudflare Worker rewrites Host to the Amplify origin, so we
 * must read the forwarded header to get the real tenant hostname.
 *
 * Priority: X-Tenant-Host (worker) → X-Original-Host (legacy) →
 *           X-Forwarded-Host (proxy) → Host (direct)
 */
export async function getTenantHost(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-tenant-host") ||
    h.get("x-original-host") ||
    h.get("x-forwarded-host") ||
    h.get("host") ||
    ""
  );
}

interface ApiResponse {
  data: PageConfig & {
    layout?: TenantLayout | null;
    faviconUrl?: string | null;
    tenantName?: string | null;
  };
  success: boolean;
  message?: string;
}

function getTemplateApiUrl(slugParam: string): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) {
    const base = apiUrl.replace(/\/$/, "");
    return `${base}/template?slug=${encodeURIComponent(slugParam)}`;
  }
  if (process.env.USER_SERVER_URL) {
    const base = process.env.USER_SERVER_URL.replace(/\/$/, "");
    return `${base}/api/v1/template?slug=${encodeURIComponent(slugParam)}`;
  }
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1/template?slug=${encodeURIComponent(slugParam)}`;
}

/**
 * Check if a slug represents the homepage
 */
function isHomepageSlug(slug: string): boolean {
  return slug === "home" || slug === "/" || slug === "";
}

/**
 * Fetch the global theme from homepage
 */
async function fetchGlobalTheme(tenantHost: string): Promise<ThemeConfig | null> {
  const url = getTemplateApiUrl("home");

  try {
    const response = await fetch(url, {
      headers: {
        "X-Tenant-Host": tenantHost,
      },
      next: { revalidate: 5 },
    });

    if (!response.ok) return null;

    const json: ApiResponse = await response.json();
    if (!json.success || !json.data) return null;

    return json.data.theme;
  } catch (error) {
    console.error("[template.server] Failed to fetch global theme:", error);
    return null;
  }
}

/**
 * Fetch the homepage layout (tenant-level or legacy from sections).
 * Used to ensure logo and layout are global, available on all pages.
 */
async function fetchHomepageLayout(tenantHost: string): Promise<TenantLayout | null> {
  const url = getTemplateApiUrl("home");

  try {
    const response = await fetch(url, {
      headers: {
        "X-Tenant-Host": tenantHost,
      },
      next: { revalidate: 5 },
    });

    if (!response.ok) return null;

    const json: ApiResponse = await response.json();
    if (!json.success || !json.data) return null;

    const data = json.data;
    if (data.layout) return data.layout as TenantLayout;

    const legacyLayout = extractLayoutFromSections(data.sections);
    return legacyLayout;
  } catch (error) {
    console.error("[template.server] Failed to fetch homepage layout:", error);
    return null;
  }
}

// Key used to embed layout in first section's settings (legacy format)
const LAYOUT_SETTINGS_KEY = "__tenantLayout__";

/**
 * Extract layout from first section's settings (backward compat / legacy).
 * New pages have layout at the tenant level, returned in the API response.
 */
function extractLayoutFromSections(sections: PageConfig["sections"]): TenantLayout | null {
  if (!sections || sections.length === 0) return null;

  const firstSection = sections[0];
  const settings = firstSection.settings as Record<string, unknown> | undefined;

  if (settings && settings[LAYOUT_SETTINGS_KEY]) {
    return settings[LAYOUT_SETTINGS_KEY] as TenantLayout;
  }
  return null;
}

/**
 * Fetch published page config for the current request (tenant from host headers).
 * Uses Next.js fetch cache (revalidate 5s); deduped with generateMetadata when both call it.
 *
 * The backend returns the tenant-level layout in every response, so no extra
 * homepage fetch is needed. Layout is available as `pageConfig.layout`.
 *
 * For non-homepage pages, the theme is inherited from the homepage (global theme).
 *
 * @param slug - The page slug without leading slash (e.g., "contact", "about", "home")
 */
export async function getTemplateForRequest(slug?: string): Promise<PageConfig | null> {
  const tenantHost = await getTenantHost();
  // Normalize slug: remove leading/trailing slashes, default to "home"
  const normalizedSlug = (slug || "").replace(/^\/+|\/+$/g, "").trim();
  const slugParam = normalizedSlug && normalizedSlug !== "/" ? normalizedSlug : "home";
  const url = getTemplateApiUrl(slugParam);

  console.log("[template.server] Fetching template:", { url, tenantHost, slugParam });

  try {
    const response = await fetch(url, {
      headers: {
        "X-Tenant-Host": tenantHost,
      },
      next: { revalidate: 5 },
    });

    console.log("[template.server] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[template.server] Error response:", errorText);
      if (response.status === 404) return null;
      return null;
    }

    const json: ApiResponse = await response.json();
    console.log("[template.server] Response success:", json.success, "hasData:", !!json.data);
    
    if (!json.success || !json.data) return null;

    const pageConfig = json.data;
    const faviconUrl = json.data.faviconUrl;
    const tenantName = json.data.tenantName;

    // Layout priority:
    // 1. Tenant-level layout from API response (new: stored in tenants.layout column)
    // 2. Legacy: extracted from first section's __tenantLayout__ setting
    // 3. For non-homepage: use homepage layout (ensures logo/layout is global on all pages)
    if (!pageConfig.layout) {
      const legacyLayout = extractLayoutFromSections(pageConfig.sections);
      if (legacyLayout) {
        console.log("[template.server] Using legacy layout from sections for:", slugParam);
        pageConfig.layout = legacyLayout;
      } else if (!isHomepageSlug(slugParam)) {
        const homepageLayout = await fetchHomepageLayout(tenantHost);
        if (homepageLayout) {
          console.log("[template.server] Using homepage layout globally for:", slugParam);
          pageConfig.layout = homepageLayout;
        }
      }
    }

    // Non-home pages: inherit theme from homepage (global theme)
    if (!isHomepageSlug(slugParam)) {
      const globalTheme = await fetchGlobalTheme(tenantHost);
      if (globalTheme) {
        console.log("[template.server] Applying global theme from homepage to:", slugParam);
        pageConfig.theme = globalTheme;
      }
    }

    // Pass favicon URL + canonical tenant brand name through metadata so they're
    // available to generateMetadata and any consumer of PageConfig.
    if (faviconUrl || tenantName) {
      pageConfig.metadata = {
        ...(pageConfig.metadata ?? {}),
        ...(faviconUrl ? { faviconUrl } : {}),
        ...(tenantName ? { tenantName } : {}),
      };
    }

    return pageConfig;
  } catch (error) {
    console.error("[template.server] Fetch error:", error);
    return null;
  }
}

/**
 * Get the layout (header/footer/sidebar) from the homepage config.
 * Used by non-homepage pages (books, courses) to maintain consistent navigation.
 */
export async function getHomepageLayout(): Promise<TenantLayout | null> {
  try {
    const homeConfig = await getTemplateForRequest("home");
    return homeConfig?.layout ?? null;
  } catch (error) {
    console.error("[template.server] Error fetching homepage layout:", error);
    return null;
  }
}
