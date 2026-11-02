import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { prefetchTestimonials } from "@/lib/prefetch-testimonials.server";
import { TestimonialsClient } from "./testimonials-client";
import { buildBreadcrumbJsonLd, getBaseUrl, jsonLdScript } from "@/lib/seo";
import { getNavLabel } from "@/lib/content-terms.server";

export async function generateMetadata(): Promise<Metadata> {
  const title = await getNavLabel("/testimonials", "Testimonials");
  return {
    title,
    description: "Read what our community has to say. Share your own experience.",
  };
}

export default async function TestimonialsPage() {
  const tenantHost = await getTenantHost();

  const [pageConfig, dehydratedState, navLabel] = await Promise.all([
    getTemplateForRequest("home"),
    tenantHost ? prefetchTestimonials(tenantHost).catch(() => null) : null,
    getNavLabel("/testimonials", "Testimonials"),
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
          { name: navLabel, url: `${baseUrl}/testimonials` },
        ]),
      )}
      <HydrationBoundary state={dehydratedState ?? undefined}>
        <TestimonialsClient
          layout={layout}
          theme={pageConfig?.theme ?? null}
          availableRoutes={pageConfig?.availableRoutes}
          initialHost={tenantHost}
        />
      </HydrationBoundary>
    </>
  );
}
