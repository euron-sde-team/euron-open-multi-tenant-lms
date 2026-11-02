import { decodeHtmlEntities, type ContentPrice, type PageConfig } from "@open-mtlms/shared";
import type { BookDisplayData, BookAuthor, BookCategory, BookOfferingData, BookRecommendationData } from "@open-mtlms/book-templates";

const dh = decodeHtmlEntities;

/**
 * Converts a PageConfig (from the CMS) to BookDisplayData (for book templates)
 * Note: Book data is stored in section.content (not section.settings)
 */
export function convertPageConfigToBookData(
  pageConfig: PageConfig,
): BookDisplayData & { prices?: ContentPrice[] } {
  // Extract book-specific data from sections
  const heroSection = pageConfig.sections.find((s) => s.type === "book-hero");
  const descriptionSection = pageConfig.sections.find((s) => s.type === "book-description");
  const offeringsSection = pageConfig.sections.find((s) => s.type === "book-offerings");
  const recommendationsSection = pageConfig.sections.find((s) => s.type === "book-recommendations");

  // Extract data from hero section content (primary source) or settings (fallback for older data)
  const heroContent = (heroSection?.content || heroSection?.settings) as {
    title?: string;
    description?: string;
    language?: string;
    pages?: number;
    purchaseMode?: "FREE" | "PAID";
    publishStatus?: "PUBLISHED" | "NOT_PUBLISHED";
    webPriceINR?: number;
    mobilePriceINR?: number;
    webPriceUSD?: number;
    mobilePriceUSD?: number;
    webDiscount?: number;
    mobileDiscount?: number;
    /** Multi-currency price book mirrored into the page JSON on editor save */
    prices?: ContentPrice[];
    webThumbnailUrl?: string;
    mobileThumbnailUrl?: string;
    previewUrl?: string;
    url?: string;
    authorIds?: string[];
    categoryIds?: string[];
    isBought?: boolean;
    authors?: BookAuthor[];
    categories?: BookCategory[];
    rating?: number;
    ratingTotalCount?: number;
    validityDays?: number | null;
  } | undefined;

  // Extract description from description section (content field)
  const descriptionContent = (descriptionSection?.content || descriptionSection?.settings) as { 
    content?: string 
  } | undefined;

  // Extract offerings from offerings section (content field)
  const offeringsContent = (offeringsSection?.content || offeringsSection?.settings) as { 
    offerings?: BookOfferingData[] 
  } | undefined;
  const offerings = offeringsContent?.offerings || [];

  // Extract recommendations from book-recommendations section
  const recommendationsContent = (recommendationsSection?.content || recommendationsSection?.settings) as {
    recommendations?: BookRecommendationData[];
  } | undefined;
  const recommendations = recommendationsContent?.recommendations || [];

  // Generate slug from page config
  const slug = pageConfig.slug.startsWith("books/")
    ? pageConfig.slug.replace("books/", "")
    : pageConfig.slug;

  // Extract prices from legacy fields
  const webPriceINR = heroContent?.webPriceINR || 0;
  const webPriceUSD = heroContent?.webPriceUSD || 0;
  const webDiscount = heroContent?.webDiscount || 0;
  const webThumbnailUrl = heroContent?.webThumbnailUrl || "";
  const publishStatus = heroContent?.publishStatus || "NOT_PUBLISHED";

  return {
    id: pageConfig.id,
    title: dh(heroContent?.title || pageConfig.title) || "Untitled Book",
    slug,
    description: dh(heroContent?.description || descriptionContent?.content),
    // New schema fields
    summary: "",
    author: "",
    language: heroContent?.language ? (Array.isArray(heroContent.language) ? heroContent.language : [heroContent.language]) : ["English"],
    pages: heroContent?.pages || 0,
    purchaseMode: heroContent?.purchaseMode || "FREE",
    status: publishStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    priceInr: webPriceINR,
    priceUsd: webPriceUSD,
    discountInr: webDiscount,
    discountUsd: 0,
    // Multi-currency price book snapshot from the page JSON (the live API map
    // overlays this in book-page-client once loaded)
    prices:
      Array.isArray(heroContent?.prices) && heroContent.prices.length > 0
        ? heroContent.prices
        : undefined,
    thumbnailUrl: webThumbnailUrl,
    pageImages: [],
    sortOrder: 0,
    // Legacy fields for backward compatibility
    publishStatus,
    webPriceINR,
    mobilePriceINR: heroContent?.mobilePriceINR || 0,
    webPriceUSD,
    mobilePriceUSD: heroContent?.mobilePriceUSD || 0,
    webDiscount,
    mobileDiscount: heroContent?.mobileDiscount || 0,
    webThumbnailUrl,
    mobileThumbnailUrl: heroContent?.mobileThumbnailUrl || "",
    previewUrl: heroContent?.previewUrl || "",
    url: heroContent?.url || "",
    fileFormat: (heroContent as { fileFormat?: "EPUB" | "PDF" } | undefined)?.fileFormat ?? "EPUB",
    authorIds: heroContent?.authorIds || [],
    categoryIds: heroContent?.categoryIds || [],
    offerings: offerings.map((o) => ({ ...o, text: o.text != null ? dh(o.text) : o.text })),
    isBought: heroContent?.isBought || false,
    rating: heroContent?.rating,
    ratingTotalCount: heroContent?.ratingTotalCount,
    validityDays:
      heroContent?.validityDays === undefined ? 365 : heroContent.validityDays,
    // Include full author and category data if available
    authors: heroContent?.authors?.map((a) => ({ ...a, name: dh(a.name), bio: a.bio != null ? dh(a.bio) : a.bio })),
    categories: heroContent?.categories?.map((c) => ({ ...c, name: dh(c.name) })),
    recommendations: recommendations.map((r) => ({ ...r, title: dh(r.title) })),
  };
}

/**
 * Extracts recommendations from PageConfig (book-recommendations section)
 */
export function extractRecommendationsFromPageConfig(pageConfig: PageConfig): BookRecommendationData[] {
  const section = pageConfig.sections.find((s) => s.type === "book-recommendations");
  if (!section) return [];
  const content = (section.content || section.settings) as { recommendations?: BookRecommendationData[] } | undefined;
  return (content?.recommendations || []).map((r) => ({ ...r, title: dh(r.title) }));
}

/**
 * Extracts authors from PageConfig
 * Authors can be stored in hero section content or in a dedicated author section
 */
export function extractAuthorsFromPageConfig(pageConfig: PageConfig): BookAuthor[] {
  // First check hero section for embedded authors
  const heroSection = pageConfig.sections.find((s) => s.type === "book-hero");
  const heroContent = (heroSection?.content || heroSection?.settings) as { 
    authors?: BookAuthor[] 
  } | undefined;
  
  if (heroContent?.authors && heroContent.authors.length > 0) {
    return heroContent.authors.map((a) => ({ ...a, name: dh(a.name), bio: a.bio != null ? dh(a.bio) : a.bio }));
  }

  // Fallback to dedicated author section
  const authorSection = pageConfig.sections.find((s) => s.type === "book-author");
  if (!authorSection) return [];

  const authorContent = (authorSection.content || authorSection.settings) as {
    authors?: BookAuthor[]
  } | undefined;
  return (authorContent?.authors || []).map((a) => ({ ...a, name: dh(a.name), bio: a.bio != null ? dh(a.bio) : a.bio }));
}

/**
 * Extracts categories from PageConfig
 * Categories can be stored in hero section content
 */
export function extractCategoriesFromPageConfig(pageConfig: PageConfig): BookCategory[] {
  const heroSection = pageConfig.sections.find((s) => s.type === "book-hero");
  
  if (!heroSection) return [];
  
  const heroContent = (heroSection.content || heroSection.settings) as {
    categories?: BookCategory[]
  } | undefined;
  return (heroContent?.categories || []).map((c) => ({ ...c, name: dh(c.name) }));
}
