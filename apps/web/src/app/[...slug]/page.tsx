import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { HomePageClient } from "@/components/home-page-client";
import { CustomCodePage } from "@/components/custom-code-page";
import {
  buildPageMetadata,
  buildWebPageJsonLd,
  buildBreadcrumbJsonLd,
  getBaseUrl,
  jsonLdScript,
  getTenantName,
} from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

const STATIC_ASSET_EXTENSIONS = /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|map|woff2?|ttf|eot)$/i;

function isBlockedPath(slugPath: string): boolean {
  if (slugPath.startsWith("dashboard") || slugPath === "edit") return true;
  if (STATIC_ASSET_EXTENSIONS.test(slugPath)) return true;
  return false;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = slug.join("/");
  if (isBlockedPath(slugPath)) return { title: "Page Not Found" };

  const host = await getTenantHost();
  const baseUrl = host ? getBaseUrl(host) : "";
  const template = await getTemplateForRequest(slugPath);
  if (!template) return { title: "Page Not Found" };

  return buildPageMetadata({
    title: template.title,
    seo: template.seo,
    canonicalUrl: `${baseUrl}/${slugPath}`,
  });
}

export default async function DynamicPage({ params }: PageProps) {
  const { slug } = await params;
  const slugPath = slug.join("/");

  // Block admin routes on customer site - prevent misuse
  if (isBlockedPath(slugPath)) notFound();

  // Home is only served at /, redirect /home to root
  if (slugPath === "home") redirect("/");

  const [pageConfig, host] = await Promise.all([
    getTemplateForRequest(slugPath),
    getTenantHost(),
  ]);

  if (!pageConfig) {
    notFound();
  }

  // Custom-code page: tenant's own HTML document in a sandboxed iframe.
  if (pageConfig.renderMode === "CUSTOM_CODE" && pageConfig.customHtml) {
    return (
      <CustomCodePage
        html={pageConfig.customHtml}
        kind={pageConfig.customCodeKind}
        title={pageConfig.seo?.title || pageConfig.title}
      />
    );
  }

  const criticalThemeCss = getCriticalThemeCss(pageConfig.theme);
  const baseUrl = host ? getBaseUrl(host) : "";
  const tenantName = getTenantName(pageConfig.layout, pageConfig);

  // Build readable breadcrumb from slug path
  const slugParts = slugPath.split("/");
  const breadcrumbItems = [{ name: "Home", url: baseUrl }];
  let currentPath = "";
  for (const part of slugParts) {
    currentPath += `/${part}`;
    breadcrumbItems.push({
      name: part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      url: `${baseUrl}${currentPath}`,
    });
  }

  const webPageJsonLd = buildWebPageJsonLd({
    name: pageConfig.seo?.title || pageConfig.title,
    description: pageConfig.seo?.description,
    url: `${baseUrl}/${slugPath}`,
    providerName: tenantName,
    providerUrl: baseUrl,
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: criticalThemeCss }} data-tenant-critical-theme />
      {jsonLdScript(webPageJsonLd)}
      {jsonLdScript(buildBreadcrumbJsonLd(breadcrumbItems))}
      <HomePageClient initialPageConfig={pageConfig} />
    </>
  );
}
