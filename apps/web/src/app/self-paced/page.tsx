import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { prefetchCourses } from "@/lib/prefetch-courses.server";
import { CoursesAllClient } from "../courses/courses-all-client";
import { buildBreadcrumbJsonLd, getBaseUrl, jsonLdScript } from "@/lib/seo";
import { getNavLabel } from "@/lib/content-terms.server";
import { singularizeTerm } from "@open-mtlms/shared";

export async function generateMetadata(): Promise<Metadata> {
  const title = await getNavLabel("/self-paced", "Self Paced Courses");
  return {
    title,
    description: "Learn at your own pace with our self-paced courses.",
  };
}

export default async function SelfPacedCoursesPage() {
  const tenantHost = await getTenantHost();

  const [pageConfig, dehydratedState, navLabel] = await Promise.all([
    getTemplateForRequest("home"),
    tenantHost ? prefetchCourses(tenantHost).catch(() => null) : null,
    getNavLabel("/self-paced", "Self Paced Courses"),
  ]);

  const layout = pageConfig?.layout ?? null;
  const theme = pageConfig?.theme ?? null;
  const criticalThemeCss = theme ? getCriticalThemeCss(theme) : "";
  const baseUrl = tenantHost ? getBaseUrl(tenantHost) : "";

  return (
    <>
      {criticalThemeCss && (
        <style dangerouslySetInnerHTML={{ __html: criticalThemeCss }} data-tenant-critical-theme />
      )}
      {jsonLdScript(
        buildBreadcrumbJsonLd([
          { name: "Home", url: baseUrl },
          { name: navLabel, url: `${baseUrl}/self-paced` },
        ]),
      )}
      <HydrationBoundary state={dehydratedState ?? undefined}>
        <CoursesAllClient
          layout={layout}
          theme={theme}
          availableRoutes={pageConfig?.availableRoutes}
          initialHost={tenantHost}
          fixedMode="SELF_PACED"
          pageTitle={navLabel}
          pageSubtitle="Learn at your own pace, anytime."
          term={{ plural: navLabel, singular: singularizeTerm(navLabel) }}
        />
      </HydrationBoundary>
    </>
  );
}
