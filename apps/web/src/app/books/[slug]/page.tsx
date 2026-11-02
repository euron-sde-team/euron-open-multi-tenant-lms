import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTemplateForRequest, getHomepageLayout, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { BookPageClient } from "./book-page-client";
import {
  buildPageMetadata,
  buildBookJsonLd,
  buildBreadcrumbJsonLd,
  getBaseUrl,
  extractPageMeta,
  jsonLdScript,
  getTenantName,
} from "@/lib/seo";
import { getContentTerms } from "@/lib/content-terms.server";

interface BookPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bookSlug = `books/${slug}`;
  const [template, host] = await Promise.all([
    getTemplateForRequest(bookSlug),
    getTenantHost(),
  ]);

  if (!template) {
    const terms = await getContentTerms();
    return { title: `${terms.book.singular} Not Found` };
  }

  const baseUrl = host ? getBaseUrl(host) : "";
  const pageMeta = extractPageMeta(template);

  return buildPageMetadata({
    title: template.title,
    seo: template.seo,
    canonicalUrl: `${baseUrl}/books/${slug}`,
    fallbackImage: pageMeta.thumbnail,
    ogType: "book",
  });
}

export default async function BookPage({ params }: BookPageProps) {
  const { slug } = await params;
  const bookSlug = `books/${slug}`;

  const [pageConfig, layout, host, terms] = await Promise.all([
    getTemplateForRequest(bookSlug),
    getHomepageLayout(),
    getTenantHost(),
    getContentTerms(),
  ]);

  if (!pageConfig) {
    notFound();
  }

  const criticalThemeCss = getCriticalThemeCss(pageConfig.theme);
  const baseUrl = host ? getBaseUrl(host) : "";
  const tenantName = getTenantName(pageConfig.layout ?? layout, pageConfig);
  const pageMeta = extractPageMeta(pageConfig);

  const bookJsonLd = buildBookJsonLd({
    name: pageConfig.seo?.title || pageConfig.title,
    description: pageConfig.seo?.description,
    url: `${baseUrl}/books/${slug}`,
    image: pageMeta.thumbnail,
    authorName: pageMeta.authorName,
    providerName: tenantName,
    providerUrl: baseUrl,
    price: pageMeta.price,
    priceCurrency: pageMeta.priceCurrency,
  });

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: baseUrl },
    { name: terms.book.plural, url: `${baseUrl}/books` },
    { name: pageConfig.title, url: `${baseUrl}/books/${slug}` },
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: criticalThemeCss }} data-tenant-critical-theme />
      {jsonLdScript(bookJsonLd)}
      {jsonLdScript(breadcrumb)}
      <BookPageClient
        initialPageConfig={pageConfig}
        layout={layout}
      />
    </>
  );
}
