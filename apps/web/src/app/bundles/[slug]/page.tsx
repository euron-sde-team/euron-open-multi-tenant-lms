import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getTemplateForRequest,
  getHomepageLayout,
  getTenantHost,
} from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { fetchBundleBySlug } from "@/lib/api/bundles";
import { BundleDetailClient } from "./bundle-detail-client";
import {
  buildPageMetadata,
  buildBundleJsonLd,
  buildBreadcrumbJsonLd,
  getBaseUrl,
  jsonLdScript,
  getTenantName,
} from "@/lib/seo";
import { getContentTerms } from "@/lib/content-terms.server";

interface BundlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: BundlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenantHost = await getTenantHost();

  try {
    const bundle = await fetchBundleBySlug(slug, tenantHost);
    const baseUrl = tenantHost ? getBaseUrl(tenantHost) : "";

    return buildPageMetadata({
      title: bundle.title,
      description: bundle.subtitle ?? bundle.description ?? undefined,
      canonicalUrl: `${baseUrl}/bundles/${slug}`,
      fallbackImage: bundle.thumbnailUrl ?? undefined,
      ogType: "website",
    });
  } catch {
    const terms = await getContentTerms();
    return { title: `${terms.bundle.singular} Not Found` };
  }
}

export default async function BundlePage({ params }: BundlePageProps) {
  const { slug } = await params;
  const tenantHost = await getTenantHost();

  let bundle;
  try {
    bundle = await fetchBundleBySlug(slug, tenantHost);
  } catch {
    notFound();
  }

  const pageConfig = await getTemplateForRequest("home");
  const layout = await getHomepageLayout();
  const terms = await getContentTerms();
  const criticalThemeCss = pageConfig
    ? getCriticalThemeCss(pageConfig.theme)
    : "";

  const baseUrl = tenantHost ? getBaseUrl(tenantHost) : "";
  const tenantName = getTenantName(pageConfig?.layout ?? layout);

  const bundleJsonLd = buildBundleJsonLd({
    name: bundle.title,
    description: bundle.subtitle ?? bundle.description ?? undefined,
    url: `${baseUrl}/bundles/${slug}`,
    image: bundle.thumbnailUrl ?? undefined,
    providerName: tenantName,
    providerUrl: baseUrl,
    price: bundle.priceInr ?? undefined,
    itemCount: bundle.itemCount,
  });

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: baseUrl },
    { name: terms.bundle.plural, url: `${baseUrl}/bundles` },
    { name: bundle.title, url: `${baseUrl}/bundles/${slug}` },
  ]);

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      {jsonLdScript(bundleJsonLd)}
      {jsonLdScript(breadcrumb)}
      <BundleDetailClient
        bundle={bundle}
        layout={layout}
        pageConfig={pageConfig}
        availableRoutes={pageConfig?.availableRoutes}
      />
    </>
  );
}
