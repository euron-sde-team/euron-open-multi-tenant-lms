import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { BookmarkPageClient } from "./bookmark-page-client";

export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Saved bookmarks",
};

export default async function BookmarkPage() {
  const pageConfig = await getTemplateForRequest("home");
  const criticalThemeCss = pageConfig ? getCriticalThemeCss(pageConfig.theme) : "";
  const layout = pageConfig?.layout ?? null;

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      <BookmarkPageClient layout={layout} pageConfig={pageConfig} />
    </>
  );
}
