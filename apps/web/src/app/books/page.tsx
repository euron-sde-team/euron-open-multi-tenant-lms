import type { Metadata } from "next";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { BooksListingClient } from "./books-listing-client";
import { buildBreadcrumbJsonLd, getBaseUrl, jsonLdScript } from "@/lib/seo";
import { getContentTerms } from "@/lib/content-terms.server";

export async function generateMetadata(): Promise<Metadata> {
  const terms = await getContentTerms();
  return {
    title: terms.book.plural,
    description: `Browse our collection of ${terms.book.plural.toLowerCase()}`,
  };
}

export default async function BooksPage() {
  const [pageConfig, tenantHost, terms] = await Promise.all([
    getTemplateForRequest("home"),
    getTenantHost(),
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
          { name: terms.book.plural, url: `${baseUrl}/books` },
        ]),
      )}
      <BooksListingClient
        layout={layout}
        pageConfig={pageConfig}
        availableRoutes={pageConfig?.availableRoutes}
      />
    </>
  );
}
