import type { TenantLayout } from "@open-mtlms/shared";
import { getDefaultTenantLayout } from "@open-mtlms/ui-config";

import type { Page } from "../types/page";
import { pageToPageConfig } from "../types/page";

import { pagesApi } from "./pages";
import { tenantsApi } from "./tenants";

/**
 * Extract layout from homepage page (from sections or page-level layout).
 * Homepage may store layout in first section's __tenantLayout__ (legacy).
 */
async function getHomepageLayout(tenantId: string): Promise<TenantLayout | null> {
  try {
    const homepage = await pagesApi.getHomepage(tenantId);
    if (!homepage) return null;

    const pageConfig = pageToPageConfig(homepage as Page);
    return (pageConfig.layout as TenantLayout) ?? null;
  } catch {
    return null;
  }
}

/**
 * Merge logo from source layout into target when target lacks logo.
 * Ensures header and footer use the global logo from homepage when available.
 */
function mergeLogoIntoLayout(
  target: TenantLayout,
  source: TenantLayout | null
): TenantLayout {
  if (!source?.header?.logo) return target;

  const targetHasLogo = !!target?.header?.logo;
  if (targetHasLogo) return target;

  return {
    ...target,
    header: {
      ...target.header,
      logo: source.header.logo,
      logoAlt: source.header.logoAlt ?? target.header?.logoAlt,
    },
    footer: target.footer
      ? {
          ...target.footer,
          // Footer uses headerLogo/headerLogoAlt from layout.header, so no change needed
        }
      : target.footer,
  };
}

/**
 * Get layout for the tenant, enriched with homepage logo when tenant layout lacks it.
 * Logo is synced from Organisation Settings on upload, layout.header.logo is the runtime source.
 */
export async function getLayoutWithHomepageLogo(
  tenantId: string
): Promise<TenantLayout> {
  const [tenantLayout, homepageLayout] = await Promise.all([
    tenantsApi.getLayout(tenantId),
    getHomepageLayout(tenantId),
  ]);

  const baseLayout = tenantLayout ?? (getDefaultTenantLayout(tenantId) as TenantLayout);

  // If tenant layout has logo, use as-is
  if (baseLayout?.header?.logo) {
    return baseLayout;
  }

  // If homepage has logo, merge it into the layout (global logo from homepage)
  if (homepageLayout?.header?.logo) {
    return mergeLogoIntoLayout(baseLayout, homepageLayout);
  }

  return baseLayout;
}
