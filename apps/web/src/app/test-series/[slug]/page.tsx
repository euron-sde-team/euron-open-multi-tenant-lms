import type { Metadata } from "next";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { fetchTestSeriesDetail } from "@/lib/api/test-series";
import { SeriesDetailClient } from "./series-detail-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const host = await getTenantHost();
  const series = await fetchTestSeriesDetail(slug, host).catch(() => null);

  if (!series) {
    return { title: slug.replace(/-/g, " ") };
  }
  return {
    title: series.title,
    description:
      series.description?.slice(0, 160) ||
      `Practice with ${series.totalTests} tests under exam conditions.`,
  };
}

export default async function TestSeriesDetailPage({ params }: Props) {
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
      <SeriesDetailClient
        slug={slug}
        theme={pageConfig?.theme ?? undefined}
        layout={pageConfig?.layout ?? null}
      />
    </>
  );
}
