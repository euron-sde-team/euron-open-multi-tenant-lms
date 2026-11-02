import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchBatchBySlug } from "@/lib/api/batches";
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  getBaseUrl,
  getTenantName,
  jsonLdScript,
} from "@/lib/seo";
import {
  getHomepageLayout,
  getTemplateForRequest,
  getTenantHost,
} from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { getContentTerms } from "@/lib/content-terms.server";

import { BatchDetailClient } from "./batch-detail-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenantHost = await getTenantHost();
  try {
    const batch = await fetchBatchBySlug(slug, tenantHost);
    const baseUrl = tenantHost ? getBaseUrl(tenantHost) : "";
    return buildPageMetadata({
      title: batch.title,
      description: batch.subtitle ?? batch.description ?? undefined,
      canonicalUrl: `${baseUrl}/batches/${slug}`,
      fallbackImage:
        batch.webThumbnailUrl ??
        batch.coverImageUrl ??
        batch.thumbnailUrl ??
        undefined,
      ogType: "website",
    });
  } catch {
    const terms = await getContentTerms();
    return { title: `${terms.batch.singular} Not Found` };
  }
}

/**
 * Consolidated batch detail page. Single canonical URL `/batches/[slug]`
 * with a `?tab=` query param controlling which section is visible. Wraps
 * everything in the tenant's normal `LayoutWrapper` so the site header,
 * sidebar (if configured), and footer stay intact, the previous custom
 * left rail (`BatchSidebar`) has been deleted.
 */
export default async function BatchPage({ params }: PageProps) {
  const { slug } = await params;
  const tenantHost = await getTenantHost();

  let batch;
  try {
    batch = await fetchBatchBySlug(slug, tenantHost);
  } catch {
    notFound();
  }

  // Page-level theme + tenant layout. We try the batch's own page config
  // first (slug `batches/{slug}` in tenant_pages) then fall back to the
  // homepage layout, same pattern as the bundle detail page.
  const pageConfig =
    (await getTemplateForRequest(`batches/${slug}`)) ??
    (await getTemplateForRequest("home"));
  const layout = pageConfig?.layout ?? (await getHomepageLayout());
  const criticalThemeCss = pageConfig
    ? getCriticalThemeCss(pageConfig.theme)
    : "";

  const baseUrl = tenantHost ? getBaseUrl(tenantHost) : "";
  const tenantName = getTenantName(layout);
  const terms = await getContentTerms();

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: baseUrl },
    { name: terms.batch.plural, url: `${baseUrl}/batches` },
    { name: batch.title, url: `${baseUrl}/batches/${slug}` },
  ]);

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      {jsonLdScript(breadcrumb)}
      <BatchDetailClient
        slug={slug}
        batch={batch}
        layout={layout}
        pageConfig={pageConfig}
        tenantName={tenantName}
        availableRoutes={pageConfig?.availableRoutes}
      />
    </>
  );
}
