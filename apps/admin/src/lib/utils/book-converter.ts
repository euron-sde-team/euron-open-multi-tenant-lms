/**
 * Book Data Converter Utilities
 * 
 * Converts between:
 * - Page (API model with SectionConfig[]) ↔ BookFormData (store model)
 * 
 * This enables the BookEditorContainer templates to work with book pages
 * stored in the pages API.
 */

import type {
  BookOfferingData,
  BookAuthor,
  BookCategory,
} from "@open-mtlms/book-templates";
import { getDefaultBookFormData } from "@open-mtlms/book-templates";
import {
  decodeHtmlEntities,
  type ContentPrice,
  type SectionConfig,
  type ThemeConfig,
} from "@open-mtlms/shared";

const dh = decodeHtmlEntities;

import type { BookFormDataWithPrices } from "../stores/book-store";
import type { Page, CreatePageRequest, UpdatePageRequest } from "../types/page";

// ============ Helper Types for Section Content ============

interface BookHeroSectionContent {
  title?: string;
  description?: string;
  language?: string | string[];
  pages?: number;
  purchaseMode?: "FREE" | "PAID";
  publishStatus?: "PUBLISHED" | "NOT_PUBLISHED";
  webPriceINR?: number;
  mobilePriceINR?: number;
  webPriceUSD?: number;
  mobilePriceUSD?: number;
  webDiscount?: number;
  mobileDiscount?: number;
  /** Multi-currency price book mirrored from BookFormData.prices on save. */
  prices?: ContentPrice[];
  webThumbnailUrl?: string;
  mobileThumbnailUrl?: string;
  previewUrl?: string;
  url?: string;
  authorIds?: string[];
  categoryIds?: string[];
  isBought?: boolean;
  // Full author/category data for web display
  authors?: BookAuthor[];
  categories?: BookCategory[];
}

interface BookDescriptionSectionContent {
  content?: string;
}

interface BookOfferingsSectionContent {
  headline?: string;
  subheadline?: string;
  offerings?: BookOfferingData[];
}

interface BookAuthorSectionContent {
  headline?: string;
  subheadline?: string;
  authors?: BookAuthor[];
}

// ============ Page to BookFormData Conversion ============

/**
 * Convert a Page (from API) to BookFormData (for store)
 * Extracts data from page sections into the flat BookFormData structure
 */
export function pageToBookFormData(page: Page): BookFormDataWithPrices {
  const defaults = getDefaultBookFormData();

  // Extract slug without the "books/" prefix
  const slug = page.slug.startsWith("books/")
    ? page.slug.replace("books/", "")
    : page.slug;

  // Start with defaults
  const bookData: BookFormDataWithPrices = {
    ...defaults,
    id: page.id,
    title: dh(page.title),
    slug,
  };

  // Extract data from each section type
  for (const section of page.sections) {
    if (!section.visible || section.deleted) continue;

    switch (section.type) {
      case "book-hero": {
        const content = section.content as BookHeroSectionContent;
        if (content) {
          bookData.title = dh(content.title) || bookData.title;
          bookData.description = dh(content.description) || bookData.description;
          // Handle language - ensure it's always an array
          const lang = content.language || bookData.language;
          bookData.language = Array.isArray(lang) ? lang : [lang || "English"];
          bookData.pages = content.pages ?? bookData.pages;
          bookData.purchaseMode = content.purchaseMode || bookData.purchaseMode;
          bookData.publishStatus = content.publishStatus || bookData.publishStatus;
          bookData.webPriceINR = content.webPriceINR ?? bookData.webPriceINR;
          bookData.mobilePriceINR = content.mobilePriceINR ?? bookData.mobilePriceINR;
          bookData.webPriceUSD = content.webPriceUSD ?? bookData.webPriceUSD;
          bookData.mobilePriceUSD = content.mobilePriceUSD ?? bookData.mobilePriceUSD;
          bookData.webDiscount = content.webDiscount ?? bookData.webDiscount;
          bookData.mobileDiscount = content.mobileDiscount ?? bookData.mobileDiscount;
          // Multi-currency price book: mirror INR/USD entries into the legacy
          // fields so untouched template code keeps working.
          if (Array.isArray(content.prices) && content.prices.length > 0) {
            bookData.prices = content.prices;
            const inr = content.prices.find((p) => p.currency === "INR");
            const usd = content.prices.find((p) => p.currency === "USD");
            if (inr) {
              bookData.priceInr = inr.amount;
              bookData.webPriceINR = inr.amount;
              bookData.mobilePriceINR = inr.amount;
              bookData.discountInr = inr.discount ?? 0;
              bookData.webDiscount = inr.discount ?? 0;
              bookData.mobileDiscount = inr.discount ?? 0;
            }
            if (usd) {
              bookData.priceUsd = usd.amount;
              bookData.webPriceUSD = usd.amount;
              bookData.mobilePriceUSD = usd.amount;
              bookData.discountUsd = usd.discount ?? 0;
            }
          }
          bookData.webThumbnailUrl = content.webThumbnailUrl || bookData.webThumbnailUrl;
          bookData.mobileThumbnailUrl = content.mobileThumbnailUrl || bookData.mobileThumbnailUrl;
          bookData.previewUrl = content.previewUrl || bookData.previewUrl;
          bookData.url = content.url || bookData.url;
          bookData.authorIds = content.authorIds || bookData.authorIds;
          bookData.categoryIds = content.categoryIds || bookData.categoryIds;
          bookData.isBought = content.isBought ?? bookData.isBought;
        }
        break;
      }

      case "book-description": {
        const content = section.content as BookDescriptionSectionContent;
        if (content?.content) {
          bookData.description = dh(content.content);
        }
        break;
      }

      case "book-offerings": {
        const content = section.content as BookOfferingsSectionContent;
        if (content?.offerings) {
          bookData.offerings = content.offerings.map((o) => ({
            ...o,
            ...(typeof (o as { text?: unknown }).text === "string"
              ? { text: dh((o as { text?: string }).text) }
              : {}),
          }));
        }
        break;
      }
    }
  }

  return bookData;
}

// ============ BookFormData to Page Sections Conversion ============

/**
 * Create a section with proper structure
 */
function createSection(params: {
  id: string;
  type: string;
  variant?: string;
  order: number;
  content: unknown;
  settings?: Record<string, unknown>;
}): SectionConfig {
  return {
    id: params.id,
    type: params.type as SectionConfig["type"],
    variant: params.variant || "default",
    order: params.order,
    visible: true,
    deleted: false,
    content: params.content,
    settings: params.settings || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Convert BookFormData to page sections for saving
 * @param bookData - The book form data
 * @param authors - Optional array of all available authors (used to map authorIds to full objects)
 * @param categories - Optional array of all available categories (used to map categoryIds to full objects)
 */
export function bookFormDataToSections(
  bookData: BookFormDataWithPrices,
  authors?: BookAuthor[],
  categories?: BookCategory[]
): SectionConfig[] {
  const now = Date.now();
  const sections: SectionConfig[] = [];

  // Map authorIds to full author objects if authors array is provided
  const selectedAuthors = authors && bookData.authorIds
    ? bookData.authorIds
        .map(id => authors.find(a => a.id === id))
        .filter((a): a is BookAuthor => a !== undefined)
    : undefined;

  // Map categoryIds to full category objects if categories array is provided
  const selectedCategories = categories && bookData.categoryIds
    ? bookData.categoryIds
        .map(id => categories.find(c => c.id === id))
        .filter((c): c is BookCategory => c !== undefined)
    : undefined;

  // 1. Book Hero Section
  sections.push(
    createSection({
      id: `section-book-hero-${now}`,
      type: "book-hero",
      variant: "default",
      order: 0,
      content: {
        title: bookData.title,
        description: bookData.description,
        language: bookData.language,
        pages: bookData.pages,
        purchaseMode: bookData.purchaseMode,
        publishStatus: bookData.publishStatus,
        webPriceINR: bookData.webPriceINR,
        mobilePriceINR: bookData.mobilePriceINR,
        webPriceUSD: bookData.webPriceUSD,
        mobilePriceUSD: bookData.mobilePriceUSD,
        webDiscount: bookData.webDiscount,
        mobileDiscount: bookData.mobileDiscount,
        prices: bookData.prices,
        webThumbnailUrl: bookData.webThumbnailUrl,
        mobileThumbnailUrl: bookData.mobileThumbnailUrl,
        previewUrl: bookData.previewUrl,
        url: bookData.url,
        authorIds: bookData.authorIds,
        categoryIds: bookData.categoryIds,
        isBought: bookData.isBought,
        // Include full author/category data for web display
        authors: selectedAuthors,
        categories: selectedCategories,
      } satisfies BookHeroSectionContent,
    })
  );

  // 2. Book Description Section
  if (bookData.description) {
    sections.push(
      createSection({
        id: `section-book-description-${now + 1}`,
        type: "book-description",
        variant: "default",
        order: 1,
        content: {
          content: bookData.description,
        } satisfies BookDescriptionSectionContent,
      })
    );
  }

  // 3. Book Author Section (if any authors selected)
  if (selectedAuthors && selectedAuthors.length > 0) {
    sections.push(
      createSection({
        id: `section-book-author-${now + 3}`,
        type: "book-author",
        variant: "default",
        order: 3,
        content: {
          headline: selectedAuthors.length > 1 ? "About the Authors" : "About the Author",
          subheadline: "Meet the experts behind this book",
          authors: selectedAuthors,
        } satisfies BookAuthorSectionContent,
      })
    );
  }

  return sections;
}

/**
 * Convert BookFormData to CreatePageRequest for creating a new book page
 * @param bookData - The book form data
 * @param tenantId - The tenant ID
 * @param authors - Optional array of all available authors
 * @param categories - Optional array of all available categories
 */
export function bookFormDataToCreateRequest(
  bookData: BookFormDataWithPrices,
  tenantId: string,
  authors?: BookAuthor[],
  categories?: BookCategory[]
): CreatePageRequest {
  const sections = bookFormDataToSections(bookData, authors, categories);

  // Create default theme
  const theme: ThemeConfig = {
    id: "book-theme",
    name: "Book Theme",
    mode: "light",
    colors: {
      light: {
        primary: "201 96% 32%",
        primaryForeground: "0 0% 100%",
        secondary: "210 40% 96%",
        secondaryForeground: "222 47% 11%",
        accent: "210 40% 96%",
        accentForeground: "222 47% 11%",
        background: "0 0% 100%",
        foreground: "222 47% 11%",
        muted: "210 40% 96%",
        mutedForeground: "215 16% 47%",
        card: "0 0% 100%",
        cardForeground: "222 47% 11%",
        border: "214 32% 91%",
        input: "214 32% 91%",
        ring: "201 96% 32%",
        destructive: "0 84% 60%",
        destructiveForeground: "0 0% 98%",
        success: "142 76% 36%",
        successForeground: "0 0% 98%",
        warning: "38 92% 50%",
        warningForeground: "0 0% 98%",
      },
      dark: {
        background: "222 47% 11%",
        foreground: "210 40% 98%",
        card: "222 47% 14%",
        cardForeground: "210 40% 98%",
        muted: "217 33% 17%",
        mutedForeground: "215 20% 65%",
        border: "217 33% 17%",
        input: "217 33% 17%",
      },
    },
    fonts: {
      heading: "Inter",
      body: "Inter",
      headingWeight: "700",
      bodyWeight: "400",
    },
    spacing: {
      sectionPaddingY: "4rem",
      sectionPaddingX: "1.5rem",
      containerMaxWidth: "1280px",
      gap: "1rem",
      gapLg: "2rem",
    },
    borders: {
      radius: "0.5rem",
      radiusSm: "0.25rem",
      radiusMd: "0.375rem",
      radiusLg: "0.5rem",
      radiusFull: "9999px",
    },
  };

  return {
    tenantId,
    slug: `books/${bookData.slug}`,
    title: bookData.title,
    sections,
    theme,
    seo: {
      title: bookData.title,
      description: bookData.description?.substring(0, 160) || "",
      keywords: [],
    },
    isPublished: bookData.publishStatus === "PUBLISHED",
  };
}

/**
 * Convert BookFormData to UpdatePageRequest for saving
 * @param bookData - The book form data
 * @param originalTheme - Optional original theme config to preserve
 * @param authors - Optional array of all available authors
 * @param categories - Optional array of all available categories
 */
export function bookFormDataToUpdateRequest(
  bookData: BookFormDataWithPrices,
  originalTheme?: ThemeConfig,
  authors?: BookAuthor[],
  categories?: BookCategory[]
): UpdatePageRequest {
  const sections = bookFormDataToSections(bookData, authors, categories);

  return {
    title: bookData.title,
    sections,
    theme: originalTheme,
    seo: {
      title: bookData.title,
      description: bookData.description?.substring(0, 160) || "",
      keywords: [],
    },
    isPublished: bookData.publishStatus === "PUBLISHED",
  };
}

/**
 * Extract slug from a book page slug (removes "books/" prefix)
 */
export function extractBookSlug(pageSlug: string): string {
  return pageSlug.startsWith("books/")
    ? pageSlug.replace("books/", "")
    : pageSlug;
}
