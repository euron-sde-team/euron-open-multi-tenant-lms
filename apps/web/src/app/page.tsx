import type { Metadata } from "next";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { HomePageClient } from "@/components/home-page-client";
import { CustomCodePage } from "@/components/custom-code-page";
import {
  buildPageMetadata,
  buildHomeJsonLd,
  getBaseUrl,
  getTenantName,
  jsonLdScript,
} from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [template, host] = await Promise.all([
    getTemplateForRequest("home"),
    getTenantHost(),
  ]);

  const baseUrl = host ? getBaseUrl(host) : undefined;
  const tenantName = getTenantName(template?.layout ?? null, template);

  const meta = buildPageMetadata({
    title: template?.seo?.title ?? template?.title ?? tenantName,
    description: template?.seo?.description,
    seo: template?.seo,
    canonicalUrl: baseUrl,
    fallbackImage: template?.layout?.header?.logo ?? undefined,
  });

  // On the homepage the tab shows the tenant BRAND name, never the page's SEO
  // title (template-apply historically wrote the chosen template's name, e.g.
  // "Finance & Trading", into seo.title) and never the layout "%s | Tenant"
  // suffix. Force it to the tenant name so the tab is always exactly the tenant
  // brand, even for home pages saved before this was fixed. OG/Twitter titles
  // (derived from the same seo.title) are pinned to the brand too.
  meta.title = { absolute: tenantName };
  if (meta.openGraph) meta.openGraph.title = tenantName;
  if (meta.twitter) meta.twitter.title = tenantName;
  return meta;
}

export default async function HomePage() {
  const [pageConfig, host] = await Promise.all([
    getTemplateForRequest("home"),
    getTenantHost(),
  ]);

  if (!pageConfig) {
    return (
      <HomePageClient
        initialPageConfig={null}
        error="Tenant or page not found"
      />
    );
  }

  // Custom-code page: the tenant's own HTML document takes over the whole page,
  // rendered in a sandboxed iframe. SEO metadata still comes from generateMetadata.
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
  const tenantName = pageConfig.seo?.title || pageConfig.title || "Academy";

  return (
    <>
      <style
        dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
        data-tenant-critical-theme
      />
      {jsonLdScript(
        buildHomeJsonLd({
          tenantName,
          baseUrl,
          logo: pageConfig.layout?.header?.logo ?? undefined,
          description: pageConfig.seo?.description,
        }),
      )}
      <HomePageClient initialPageConfig={pageConfig} />
    </>
  );
}
