import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { prefetchCourses } from "@/lib/prefetch-courses.server";
import { CoursesAllClient } from "../courses/courses-all-client";
import { buildBreadcrumbJsonLd, getBaseUrl, jsonLdScript } from "@/lib/seo";
import { getContentTerms } from "@/lib/content-terms.server";

export async function generateMetadata(): Promise<Metadata> {
  const terms = await getContentTerms();
  return {
    title: `All ${terms.course.plural}`,
    description: `Explore our ${terms.course.plural.toLowerCase()}. Filter by self-paced, live, hybrid, or shorts.`,
  };
}

export default async function AllCoursesPage() {
  const tenantHost = await getTenantHost();

  const [pageConfig, dehydratedState, terms] = await Promise.all([
    getTemplateForRequest("home"),
    tenantHost ? prefetchCourses(tenantHost).catch(() => null) : null,
    getContentTerms(),
  ]);

  const criticalThemeCss = pageConfig
    ? getCriticalThemeCss(pageConfig.theme)
    : "";
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
          { name: `All ${terms.course.plural}`, url: `${baseUrl}/all-courses` },
        ]),
      )}
      <HydrationBoundary state={dehydratedState ?? undefined}>
        <CoursesAllClient
          layout={layout}
          theme={pageConfig?.theme ?? null}
          availableRoutes={pageConfig?.availableRoutes}
          initialHost={tenantHost}
        />
      </HydrationBoundary>
    </>
  );
}
