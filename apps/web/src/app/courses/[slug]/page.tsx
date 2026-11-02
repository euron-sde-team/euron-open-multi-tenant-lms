import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { CoursePageClient } from "./course-page-client";
import {
  buildPageMetadata,
  buildCourseJsonLd,
  buildBreadcrumbJsonLd,
  getBaseUrl,
  extractPageMeta,
  jsonLdScript,
  serializeJsonLd,
  getTenantName,
} from "@/lib/seo";
import { getContentTerms } from "@/lib/content-terms.server";

interface CoursePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const courseSlug = `courses/${slug}`;
  const [template, host] = await Promise.all([
    getTemplateForRequest(courseSlug),
    getTenantHost(),
  ]);

  if (!template) {
    const terms = await getContentTerms();
    return { title: `${terms.course.singular} Not Found` };
  }

  const baseUrl = host ? getBaseUrl(host) : "";
  const pageMeta = extractPageMeta(template);

  return buildPageMetadata({
    title: template.title,
    seo: template.seo,
    canonicalUrl: `${baseUrl}/courses/${slug}`,
    fallbackImage: pageMeta.thumbnail,
    ogType: "website",
  });
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const courseSlug = `courses/${slug}`;

  const [pageConfig, host, terms] = await Promise.all([
    getTemplateForRequest(courseSlug),
    getTenantHost(),
    getContentTerms(),
  ]);

  if (!pageConfig) {
    notFound();
  }

  const layout = pageConfig.layout ?? null;
  const criticalThemeCss = getCriticalThemeCss(pageConfig.theme);
  const baseUrl = host ? getBaseUrl(host) : "";
  const tenantName = getTenantName(pageConfig.layout, pageConfig);
  const pageMeta = extractPageMeta(pageConfig);

  // Build Course JSON-LD (may include FAQ schema)
  const courseJsonLd = buildCourseJsonLd({
    name: pageConfig.seo?.title || pageConfig.title,
    description: pageConfig.seo?.description,
    url: `${baseUrl}/courses/${slug}`,
    image: pageMeta.thumbnail,
    providerName: tenantName,
    providerUrl: baseUrl,
    courseMode: pageMeta.courseMode,
    price: pageMeta.price,
    priceCurrency: pageMeta.priceCurrency,
    instructorName: pageMeta.instructorName,
    faqs: pageMeta.faqs,
  });

  // Breadcrumb: Home > All Courses > Course Name
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: baseUrl },
    { name: terms.course.plural, url: `${baseUrl}/all-courses` },
    { name: pageConfig.title, url: `${baseUrl}/courses/${slug}` },
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: criticalThemeCss }} data-tenant-critical-theme />
      {courseJsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      {jsonLdScript(breadcrumb)}
      <CoursePageClient
        initialPageConfig={pageConfig}
        layout={layout}
        courseSlug={slug}
      />
    </>
  );
}
