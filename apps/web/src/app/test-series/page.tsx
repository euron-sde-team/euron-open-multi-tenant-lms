import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { CatalogClient } from "./catalog-client";
import { getContentTerms } from "@/lib/content-terms.server";

export async function generateMetadata(): Promise<Metadata> {
  const terms = await getContentTerms();
  return {
    title: terms.testSeries.plural,
    description: `Browse all available ${terms.testSeries.plural.toLowerCase()}.`,
  };
}

export default async function TestSeriesCatalogPage() {
  const pageConfig = await getTemplateForRequest("home");
  const criticalThemeCss = pageConfig ? getCriticalThemeCss(pageConfig.theme) : "";

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      <CatalogClient
        theme={pageConfig?.theme ?? undefined}
        layout={pageConfig?.layout ?? null}
      />
    </>
  );
}
