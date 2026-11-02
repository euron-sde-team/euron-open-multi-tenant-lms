/**
 * SEO utilities: JSON-LD structured data builders and metadata helpers.
 *
 * Provides Schema.org JSON-LD generators for each public page type plus a
 * shared `buildPageMetadata` helper that fills in canonical URLs, Open Graph,
 * Twitter Cards, noIndex, and og:image from the page's SEOConfig.
 *
 * All functions are pure (no side-effects) and safe to call during SSR.
 */

import type { Metadata } from "next";
import type { PageConfig, SEOConfig, TenantLayout } from "@open-mtlms/shared";
import { isResolvedPrice, resolvePrice } from "@open-mtlms/shared";

function decodeHtml(str?: string): string | undefined {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

// ---------------------------------------------------------------------------
// URL / tenant helpers
// ---------------------------------------------------------------------------

/**
 * Derive the canonical tenant brand name.
 *
 * Priority:
 *   1. `pageConfig.metadata.tenantName` (canonical brand name, set by the
 *      learner-api template endpoint from `tenants.name`).
 *   2. `pageConfig.seo.title` (page-specific SEO title, only meaningful on
 *      the homepage, where it's typically the tenant brand line).
 *   3. `pageConfig.title` (page title, last resort, may be a section heading).
 *   4. `"Academy"` (final fallback).
 *
 * Intentionally does NOT use `layout.header.logoAlt`: that field is alt text
 * for the logo `<img>` tag (accessibility) and tenants commonly leave it as
 * the literal string "Logo", which would then leak into tab titles and SEO.
 *
 * The `layout` argument is retained for backwards compatibility with existing
 * call sites but is currently unused; remove it once all callers stop passing it.
 */
export function getTenantName(layout?: TenantLayout | null, pageConfig?: PageConfig | null): string {
  void layout;
  const meta = pageConfig?.metadata as Record<string, unknown> | undefined;
  const fromMeta = typeof meta?.tenantName === "string" ? meta.tenantName.trim() : "";
  if (fromMeta) return fromMeta;
  if (pageConfig?.seo?.title) return decodeHtml(pageConfig.seo.title) ?? "Academy";
  if (pageConfig?.title) return decodeHtml(pageConfig.title) ?? "Academy";
  return "Academy";
}

/**
 * Extract the logo URL from the tenant layout.
 */
export function getTenantLogo(layout?: TenantLayout | null): string | undefined {
  return layout?.header?.logo ? layout.header.logo : undefined;
}

/**
 * Build the base URL for the current tenant from the resolved hostname.
 * Always returns a URL *without* a trailing slash.
 */
export function getBaseUrl(host: string): string {
  const protocol = process.env.NEXT_PUBLIC_NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${host}`;
}

// ---------------------------------------------------------------------------
// Metadata helper (fills in canonical, og:image, twitter, noIndex)
// ---------------------------------------------------------------------------

interface BuildMetadataOpts {
  /** Page title – falls back to SEO title → page title → undefined */
  title?: string;
  /** Description */
  description?: string;
  /** SEO config from PageConfig */
  seo?: SEOConfig;
  /** Full canonical URL (overrides seo.canonicalUrl) */
  canonicalUrl?: string;
  /** Fallback image URL (e.g. course/book thumbnail) */
  fallbackImage?: string;
  /** Additional OpenGraph type – defaults to "website" */
  ogType?: "website" | "article" | "book";
}

/**
 * Build a complete Next.js `Metadata` object using the page's SEO config.
 *
 * This helper fills every field that was previously missing: canonical URL,
 * Open Graph images, Twitter Cards, keywords, and noIndex.
 */
export function buildPageMetadata(opts: BuildMetadataOpts): Metadata {
  const { seo, fallbackImage, ogType = "website" } = opts;

  const title = decodeHtml(seo?.title || opts.title);
  const description = decodeHtml(seo?.description || opts.description);
  const ogTitle = decodeHtml(seo?.ogTitle || title);
  const ogDescription = seo?.ogDescription || description;
  const image = seo?.ogImage || fallbackImage;
  const canonical = opts.canonicalUrl || seo?.canonicalUrl;
  const keywords = seo?.keywords;
  const noIndex = seo?.noIndex;
  const twitterCard = seo?.twitterCard || (image ? "summary_large_image" : "summary");

  const metadata: Metadata = {
    title,
    description,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: ogType,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: twitterCard,
      title: ogTitle,
      description: ogDescription,
      ...(image ? { images: [image] } : {}),
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };

  return metadata;
}

// ---------------------------------------------------------------------------
// JSON-LD helpers
// ---------------------------------------------------------------------------

// Generic type for JSON-LD – avoids leaking `any` throughout.
type JsonLd = Record<string, unknown>;

/**
 * Render a JSON-LD `<script>` tag as a JSX element (for use in Server Components).
 * Strips `undefined` values before serialisation so Schema.org validators
 * don't trip over empty fields.
 */
/**
 * JSON for a `<script type="application/ld+json">` body. Tenant text (titles,
 * descriptions) lands here, so `<` (and with it `</script>` and `<!--`), `>`,
 * `&` and the JS line separators are written as unicode escapes: still the same
 * JSON, but nothing an HTML parser can end the element on.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data, (_key, value) => (value === undefined ? undefined : value))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function jsonLdScript(data: JsonLd | JsonLd[]): React.ReactElement {
  const clean = serializeJsonLd(data);
  // eslint-disable-next-line react/no-danger
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

// ---------------------------------------------------------------------------
// Organization + WebSite (home page / root layout)
// ---------------------------------------------------------------------------

interface OrganizationOpts {
  name: string;
  url: string;
  logo?: string;
  description?: string;
}

export function buildOrganizationJsonLd(opts: OrganizationOpts): JsonLd {
  return {
    "@type": "Organization",
    "@id": `${opts.url}/#organization`,
    name: opts.name,
    url: opts.url,
    ...(opts.logo ? { logo: opts.logo } : {}),
    ...(opts.description ? { description: opts.description } : {}),
  };
}

export function buildWebSiteJsonLd(opts: {
  name: string;
  url: string;
  searchUrl?: string;
}): JsonLd {
  return {
    "@type": "WebSite",
    "@id": `${opts.url}/#website`,
    url: opts.url,
    name: opts.name,
    publisher: { "@id": `${opts.url}/#organization` },
    ...(opts.searchUrl
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: `${opts.searchUrl}{search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
}

/**
 * Combined Organization + WebSite graph for the home page.
 */
export function buildHomeJsonLd(opts: {
  tenantName: string;
  baseUrl: string;
  logo?: string;
  description?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationJsonLd({
        name: opts.tenantName,
        url: opts.baseUrl,
        logo: opts.logo,
        description: opts.description,
      }),
      buildWebSiteJsonLd({
        name: opts.tenantName,
        url: opts.baseUrl,
        searchUrl: `${opts.baseUrl}/search?q=`,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

interface CourseJsonLdOpts {
  name: string;
  description?: string;
  url: string;
  image?: string;
  providerName: string;
  providerUrl: string;
  /** e.g. "self_paced", "live", "hybrid" */
  courseMode?: string;
  price?: number | string;
  priceCurrency?: string;
  instructorName?: string;
  faqs?: Array<{ question: string; answer: string }>;
}

export function buildCourseJsonLd(opts: CourseJsonLdOpts): JsonLd[] {
  const courseSchema: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    provider: {
      "@type": "Organization",
      name: opts.providerName,
      url: opts.providerUrl,
    },
    ...(opts.instructorName
      ? { instructor: { "@type": "Person", name: opts.instructorName } }
      : {}),
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      ...(opts.courseMode
        ? { courseSchedule: { "@type": "Schedule", repeatFrequency: opts.courseMode } }
        : {}),
    },
    ...(opts.price != null
      ? {
          offers: {
            "@type": "Offer",
            price: typeof opts.price === "string" ? parseFloat(opts.price) || 0 : opts.price,
            priceCurrency: opts.priceCurrency || "INR",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  const result: JsonLd[] = [courseSchema];

  // FAQPage schema (separate graph)
  if (opts.faqs && opts.faqs.length > 0) {
    result.push(buildFaqJsonLd(opts.faqs));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Book
// ---------------------------------------------------------------------------

interface BookJsonLdOpts {
  name: string;
  description?: string;
  url: string;
  image?: string;
  authorName?: string;
  providerName: string;
  providerUrl: string;
  price?: number | string;
  priceCurrency?: string;
}

export function buildBookJsonLd(opts: BookJsonLdOpts): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.authorName
      ? { author: { "@type": "Person", name: opts.authorName } }
      : {}),
    publisher: {
      "@type": "Organization",
      name: opts.providerName,
      url: opts.providerUrl,
    },
    ...(opts.price != null
      ? {
          offers: {
            "@type": "Offer",
            price: typeof opts.price === "string" ? parseFloat(opts.price) || 0 : opts.price,
            priceCurrency: opts.priceCurrency || "INR",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Bundle (Product schema, contains multiple courses/books)
// ---------------------------------------------------------------------------

interface BundleJsonLdOpts {
  name: string;
  description?: string;
  url: string;
  image?: string;
  providerName: string;
  providerUrl: string;
  price?: number | string;
  priceCurrency?: string;
  itemCount?: number;
}

export function buildBundleJsonLd(opts: BundleJsonLdOpts): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    brand: {
      "@type": "Organization",
      name: opts.providerName,
      url: opts.providerUrl,
    },
    ...(opts.price != null
      ? {
          offers: {
            "@type": "Offer",
            price: typeof opts.price === "string" ? parseFloat(opts.price) || 0 : opts.price,
            priceCurrency: opts.priceCurrency || "INR",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
    ...(opts.itemCount
      ? { additionalProperty: { "@type": "PropertyValue", name: "itemCount", value: opts.itemCount } }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export function buildFaqJsonLd(faqs: Array<{ question: string; answer: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ---------------------------------------------------------------------------
// ItemList (for listing pages like /all-courses, /books, etc.)
// ---------------------------------------------------------------------------

export function buildItemListJsonLd(
  name: string,
  items: Array<{ url: string; name?: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.url,
      ...(item.name ? { name: item.name } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// Article (blog posts)
// ---------------------------------------------------------------------------

export function buildArticleJsonLd(opts: {
  headline: string;
  description?: string;
  url: string;
  imageUrl?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  authorUrl?: string;
  publisherName: string;
  publisherUrl: string;
  publisherLogoUrl?: string;
  articleSection?: string;
  keywords?: string[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.imageUrl ? { image: [opts.imageUrl] } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    ...(opts.authorName
      ? {
          author: {
            "@type": "Person",
            name: opts.authorName,
            ...(opts.authorUrl ? { url: opts.authorUrl } : {}),
          },
        }
      : {}),
    publisher: {
      "@type": "Organization",
      name: opts.publisherName,
      url: opts.publisherUrl,
      ...(opts.publisherLogoUrl
        ? {
            logo: {
              "@type": "ImageObject",
              url: opts.publisherLogoUrl,
            },
          }
        : {}),
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": opts.url,
    },
    ...(opts.articleSection ? { articleSection: opts.articleSection } : {}),
    ...(opts.keywords && opts.keywords.length > 0
      ? { keywords: opts.keywords.join(", ") }
      : {}),
    url: opts.url,
  };
}

// ---------------------------------------------------------------------------
// WebPage (generic pages, about, contact, custom pages)
// ---------------------------------------------------------------------------

export function buildWebPageJsonLd(opts: {
  name: string;
  description?: string;
  url: string;
  providerName: string;
  providerUrl: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url: opts.url,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${opts.providerUrl}/#website`,
    },
    publisher: {
      "@type": "Organization",
      name: opts.providerName,
      url: opts.providerUrl,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper to extract metadata fields from PageConfig for courses/books
// ---------------------------------------------------------------------------

/**
 * Extract structured data fields from a PageConfig's sections/metadata.
 * Courses and books store pricing, thumbnails, instructor info in metadata.
 */
export function extractPageMeta(pageConfig: PageConfig): {
  thumbnail?: string;
  price?: string | number;
  priceCurrency?: string;
  instructorName?: string;
  courseMode?: string;
  faqs?: Array<{ question: string; answer: string }>;
  authorName?: string;
} {
  const meta = pageConfig.metadata as Record<string, unknown> | undefined;
  const result: ReturnType<typeof extractPageMeta> = {};

  if (!meta) return result;

  // Pricing
  if (meta.price != null) result.price = meta.price as string | number;
  if (meta.priceInr != null) result.price = meta.priceInr as string | number;
  if (meta.priceCurrency) result.priceCurrency = meta.priceCurrency as string;

  // Multi-currency price book: offer metadata uses the tenant DEFAULT currency
  // (SEO output must be stable per page, not per-viewer geo).
  const metaPrices = meta.prices as
    | Record<string, { amount: number | string; discount?: number | string | null }>
    | Array<{ currency: string; amount: number; discount: number | null }>
    | undefined;
  if (metaPrices) {
    const defaultCurrency =
      (meta.defaultCurrency as string | undefined) ||
      (meta.default_currency as string | undefined) ||
      result.priceCurrency ||
      "INR";
    const resolved = resolvePrice(
      {
        prices: metaPrices,
        legacyInr: meta.priceInr as string | number | undefined,
        legacyUsd: meta.priceUsd as string | number | undefined,
      },
      {
        resolvedCurrency: defaultCurrency,
        defaultCurrency,
        enabledCurrencies: [defaultCurrency, "INR", "USD"],
      }
    );
    if (isResolvedPrice(resolved)) {
      result.price = resolved.amount;
      result.priceCurrency = resolved.currency;
    }
  }

  // Thumbnail
  if (meta.thumbnailUrl) result.thumbnail = meta.thumbnailUrl as string;
  if (meta.thumbnail) result.thumbnail = meta.thumbnail as string;

  // Instructor
  if (meta.instructorName) result.instructorName = meta.instructorName as string;

  // Course mode
  if (meta.courseMode) result.courseMode = meta.courseMode as string;
  if (meta.mode) result.courseMode = meta.mode as string;

  // Author (books)
  if (meta.authorName) result.authorName = meta.authorName as string;

  // FAQs
  if (Array.isArray(meta.faqs)) {
    result.faqs = (meta.faqs as Array<{ question?: string; answer?: string }>)
      .filter((f) => f.question && f.answer)
      .map((f) => ({ question: f.question!, answer: f.answer! }));
  }

  return result;
}
