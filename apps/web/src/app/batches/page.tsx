import type { Metadata } from "next";

import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { buildBreadcrumbJsonLd, getBaseUrl, jsonLdScript } from "@/lib/seo";
import { getContentTerms } from "@/lib/content-terms.server";

import { BatchesListingClient } from "./batches-listing-client";

export async function generateMetadata(): Promise<Metadata> {
  const terms = await getContentTerms();
  return {
    title: terms.batch.plural,
    description: `Browse our live cohort ${terms.batch.plural.toLowerCase()}`,
  };
}

/**
 * Public listing of every PUBLISHED batch for this tenant. Mirrors the
 * `/bundles` listing pattern: server fetches layout + theme, the client
 * fetches the batch list itself (no SSR prefetch yet, can be added if
 * Time-to-First-Card ever shows up as a bottleneck).
 *
 * Each card links to /batches/{slug}, where the existing auth-aware
 * CTA decides between "Join Batch" and "Open Dashboard".
 */
export default async function BatchesPage() {
  const tenantHost = await getTenantHost();
  const pageConfig = await getTemplateForRequest("home");
  const terms = await getContentTerms();

  const criticalThemeCss = pageConfig
    ? getCriticalThemeCss(pageConfig.theme)
    : "";
  const layout = pageConfig?.layout ?? null;
  const baseUrl = tenantHost ? getBaseUrl(tenantHost) : "";

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      {jsonLdScript(
        buildBreadcrumbJsonLd([
          { name: "Home", url: baseUrl },
          { name: terms.batch.plural, url: `${baseUrl}/batches` },
        ])
      )}
      <BatchesListingClient
        layout={layout}
        pageConfig={pageConfig}
        availableRoutes={pageConfig?.availableRoutes}
      />
    </>
  );
}
