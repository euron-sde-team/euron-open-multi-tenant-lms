import type { Metadata } from "next";
import { getTemplateForRequest } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { SeriesDashboardClient } from "./dashboard-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Series dashboard",
};

export default async function SeriesDashboardPage({ params }: Props) {
  const { slug } = await params;
  const pageConfig = await getTemplateForRequest("home");
  const criticalThemeCss = pageConfig
    ? getCriticalThemeCss(pageConfig.theme)
    : "";

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      <SeriesDashboardClient
        slug={slug}
        theme={pageConfig?.theme ?? undefined}
        layout={pageConfig?.layout ?? null}
      />
    </>
  );
}
