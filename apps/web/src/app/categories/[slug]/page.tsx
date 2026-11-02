import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTemplateForRequest, getTenantHost } from "@/lib/template.server";
import { getCriticalThemeCss } from "@/lib/theme-css.server";
import { fetchCategoryBySlug, fetchCategories, fetchCoursesByCategory, fetchBooksByCategory } from "@/lib/api/categories";
import { CategoryDetailClient } from "./category-detail-client";

export const metadata: Metadata = {
  title: "Category",
  description: "Browse courses and books in this category",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const tenantHost = await getTenantHost();

  const [pageConfig, category, categoriesData, coursesData, booksData] = await Promise.all([
    getTemplateForRequest("home"),
    fetchCategoryBySlug(slug, tenantHost),
    fetchCategories(tenantHost),
    fetchCoursesByCategory(slug, tenantHost),
    fetchBooksByCategory(slug, tenantHost),
  ]);

  if (!category) notFound();

  const parentCategory = category.parent_id
    ? categoriesData.categories.find((c) => c.id === category.parent_id) ?? null
    : null;
  const subcategories = categoriesData.categories.filter((c) => c.parent_id === category.id);

  const criticalThemeCss = pageConfig ? getCriticalThemeCss(pageConfig.theme) : "";
  const layout = pageConfig?.layout ?? null;

  return (
    <>
      {criticalThemeCss && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalThemeCss }}
          data-tenant-critical-theme
        />
      )}
      <CategoryDetailClient
        layout={layout}
        pageConfig={pageConfig}
        availableRoutes={pageConfig?.availableRoutes}
        category={category}
        parentCategory={parentCategory}
        subcategories={subcategories}
        initialCourses={coursesData.courses}
        initialBooks={booksData.books}
      />
    </>
  );
}
