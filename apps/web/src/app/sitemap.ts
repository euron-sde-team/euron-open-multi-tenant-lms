import { type MetadataRoute } from "next";
import { headers } from "next/headers";
import { getTenantHost } from "@/lib/template.server";

const API_URL = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);

interface SitemapItem {
  slug: string;
  updatedAt: Date;
}

/**
 * Helper to fetch a list of slugs + timestamps from the learner-api.
 * Returns an empty array on any failure so the sitemap still generates.
 */
async function fetchSlugs(
  url: string,
  mapper: (item: Record<string, string>) => SitemapItem,
): Promise<SitemapItem[]> {
  try {
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return [];
    const data = await response.json();
    // Handle both { data: [...] } and raw array responses
    const items = Array.isArray(data) ? data : (data.data ?? data.items ?? data.bundles ?? data.posts ?? []);
    if (!Array.isArray(items)) return [];
    return items.map(mapper);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");
  const host = await getTenantHost() || "localhost:3620";

  // Determine base URL
  const protocol = process.env.NEXT_PUBLIC_NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  // Default sitemap for main domain or when no tenant
  if (!tenantId) {
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }

  // Fetch all content types in parallel
  const [pages, courses, books, bundles] = await Promise.all([
    // Pages
    fetchSlugs(
      `${API_URL}/pages/${tenantId}?published=true`,
      (p) => ({ slug: p.slug, updatedAt: new Date(p.updatedAt || p.updated_at) }),
    ),
    // Courses
    fetchSlugs(
      `${API_URL}/courses/${tenantId}?published=true`,
      (c) => ({ slug: c.slug, updatedAt: new Date(c.updatedAt || c.updated_at) }),
    ),
    // Books
    fetchSlugs(
      `${API_URL}/books/${tenantId}?published=true`,
      (b) => ({ slug: b.slug, updatedAt: new Date(b.updatedAt || b.updated_at) }),
    ),
    // Bundles
    fetchSlugs(
      `${API_URL}/bundles/${tenantId}?published=true`,
      (b) => ({ slug: b.slug, updatedAt: new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at) }),
    ),
  ]);

  return [
    // Static listing pages
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 1 },
    { url: `${baseUrl}/all-courses`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${baseUrl}/self-paced`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${baseUrl}/books`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${baseUrl}/bundles`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${baseUrl}/categories`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${baseUrl}/testimonials`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.4 },

    // Dynamic pages (skip home, already included above, skip courses/books prefixed pages)
    ...pages
      .filter((page) => {
        const isHome = !page.slug || page.slug === "/" || page.slug === "home";
        const isCourseOrBook = page.slug.startsWith("courses/") || page.slug.startsWith("books/");
        return !isHome && !isCourseOrBook;
      })
      .map((page) => ({
        url: `${baseUrl}/${page.slug}`,
        lastModified: page.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),

    // Course detail pages
    ...courses.map((course) => ({
      url: `${baseUrl}/courses/${course.slug}`,
      lastModified: course.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),

    // Book detail pages
    ...books.map((book) => ({
      url: `${baseUrl}/books/${book.slug}`,
      lastModified: book.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),

    // Bundle detail pages
    ...bundles.map((bundle) => ({
      url: `${baseUrl}/bundles/${bundle.slug}`,
      lastModified: bundle.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
