import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { SearchPageClient } from "@/components/search-page-client";

export const metadata: Metadata = {
  title: "Search",
  description: "Search courses, books, and content",
};

export default async function SearchPage() {
  // Use home template for layout/theme (search is not a separate template)
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
      <SearchPageClient initialPageConfig={pageConfig} />
    </>
  );
}
