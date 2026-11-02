import type { Metadata } from "next";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { MyLearningClient } from "@/components/my-learning/my-learning-client";
import { getNavLabel } from "@/lib/content-terms.server";

export async function generateMetadata(): Promise<Metadata> {
  const title = await getNavLabel("/my-learning", "My Learning");
  return {
    title,
    description:
      "Your enrolled courses and owned books. Track progress and continue learning.",
  };
}

export default async function MyLearningPage() {
  const tenantHost = await getTenantHost();

  const pageConfig = await getTemplateForRequest("home");
  const criticalThemeCss = pageConfig
    ? getCriticalThemeCss(pageConfig.theme)
    : "";
  const layout = pageConfig?.layout ?? null;

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      <MyLearningClient
        layout={layout}
        theme={pageConfig?.theme ?? null}
        availableRoutes={pageConfig?.availableRoutes}
        initialHost={tenantHost}
      />
    </>
  );
}
