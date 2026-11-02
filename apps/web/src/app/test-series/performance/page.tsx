import type { Metadata } from "next";

import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";

import { PerformanceClient } from "./performance-client";

export const metadata: Metadata = {
  title: "My Performance",
  description: "Your test and practice analytics in one place.",
};

export default async function PerformancePage() {
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
      <PerformanceClient
        theme={pageConfig?.theme ?? undefined}
        layout={pageConfig?.layout ?? null}
      />
    </>
  );
}
