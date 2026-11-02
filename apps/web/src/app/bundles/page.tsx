import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { prefetchBundles } from "@/lib/prefetch-bundles.server";
import { BundlesListingClient } from "./bundles-listing-client";
import { buildBreadcrumbJsonLd, getBaseUrl, jsonLdScript } from "@/lib/seo";
import { getContentTerms } from "@/lib/content-terms.server";

export async function generateMetadata(): Promise<Metadata> {
  const terms = await getContentTerms();
  return {
    title: terms.bundle.plural,
    description: `Browse our course and book ${terms.bundle.plural.toLowerCase()}`,
  };
}

export default async function BundlesPage() {
  const tenantHost = await getTenantHost();

  const [pageConfig, dehydratedState, terms] = await Promise.all([
    getTemplateForRequest("home"),
    tenantHost ? prefetchBundles(tenantHost).catch(() => null) : null,
    getContentTerms(),
  ]);

  const criticalThemeCss = pageConfig ? getCriticalThemeCss(pageConfig.theme) : "";
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
          { name: terms.bundle.plural, url: `${baseUrl}/bundles` },
        ]),
      )}
      <HydrationBoundary state={dehydratedState ?? undefined}>
        <BundlesListingClient
          layout={layout}
          pageConfig={pageConfig}
          availableRoutes={pageConfig?.availableRoutes}
        />
      </HydrationBoundary>
    </>
  );
}
