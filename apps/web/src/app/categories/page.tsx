import type { Metadata } from "next";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { fetchCategories } from "@/lib/api/categories";
import { CategoriesListingClient } from "./categories-listing-client";
import { buildBreadcrumbJsonLd, getBaseUrl, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse content by category",
};

export default async function CategoriesPage() {
  const tenantHost = await getTenantHost();

  const [pageConfig, categoriesData] = await Promise.all([
    getTemplateForRequest("home"),
    fetchCategories(tenantHost),
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
          { name: "Categories", url: `${baseUrl}/categories` },
        ]),
      )}
      <CategoriesListingClient
        layout={layout}
        pageConfig={pageConfig}
        availableRoutes={pageConfig?.availableRoutes}
        initialCategories={categoriesData.categories}
      />
    </>
  );
}
