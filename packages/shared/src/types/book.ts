/**
 * Book Types for Shared Package
 * 
 * These types define the data structures used by books in both admin and web apps.
 */

// ============================================
// Book Offering Types
// ============================================

export interface BookOfferingData {
  id: string;
  text: string;
}

// ============================================
// Book Author Types
// ============================================

export interface BookAuthorData {
  id: string;
  name: string;
  bio?: string;
  avatar?: string;
  role?: string;
  company?: string;
}

// ============================================
// Book Category Types
// ============================================

export interface BookCategoryData {
  id: string;
  name: string;
  icon?: string;
}

// ============================================
// Book Form Data (Admin)
// ============================================

export type BookPurchaseMode = "FREE" | "PAID";
export type BookPublishStatus = "PUBLISHED" | "NOT_PUBLISHED";
export type BookFileFormat = "EPUB" | "PDF";

export interface BookFormData {
  id: string;
  title: string;
  slug: string;
  description: string;
  language: string;
  pages: number;
  purchaseMode: BookPurchaseMode;
  publishStatus: BookPublishStatus;
  webPriceINR: number;
  mobilePriceINR: number;
  webPriceUSD: number;
  mobilePriceUSD: number;
  webDiscount: number;
  mobileDiscount: number;
  webThumbnailUrl: string;
  mobileThumbnailUrl: string;
  previewUrl: string;
  url: string; // EPUB or PDF S3 URL
  fileFormat: BookFileFormat;
  authorIds: string[];
  categoryIds: string[];
  offerings: BookOfferingData[];
  isBought?: boolean;
  tenantId?: string;
}

// ============================================
// Book Display Data (for templates)
// ============================================

export interface BookDisplayData extends BookFormData {
  authors?: BookAuthorData[];
  categories?: BookCategoryData[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a URL-friendly slug from text
 */
export function generateBookSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Create a new book offering
 */
export function createBookOffering(text: string): BookOfferingData {
  return {
    id: `offering-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text,
  };
}

/**
 * Get default book form data
 */
export function getDefaultBookFormData(): BookFormData {
  return {
    id: "",
    title: "Untitled Book",
    slug: "",
    description: "",
    language: "English",
    pages: 0,
    purchaseMode: "FREE",
    publishStatus: "NOT_PUBLISHED",
    webPriceINR: 0,
    mobilePriceINR: 0,
    webPriceUSD: 0,
    mobilePriceUSD: 0,
    webDiscount: 0,
    mobileDiscount: 0,
    webThumbnailUrl: "",
    mobileThumbnailUrl: "",
    previewUrl: "",
    url: "",
    fileFormat: "EPUB",
    authorIds: [],
    categoryIds: [],
    offerings: [],
    isBought: false,
  };
}
