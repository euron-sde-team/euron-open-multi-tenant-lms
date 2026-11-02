import type { ReactNode } from "react";

/**
 * Types for Book Templates Package
 * 
 * These types define the data structures used by the shared book templates.
 * They are designed to work with both admin (edit mode) and web (read-only) apps.
 */

/**
 * Book offering data
 */
export interface BookOfferingData {
  id: string;
  text: string;
}

/**
 * Book form data - the main data type for book management
 * Aligned with the database schema (books table)
 */
export interface BookFormData {
  id: string;
  title: string;
  slug: string;
  description: string;
  summary: string;
  author: string; // Author name (stored directly on book)
  language: string[]; // Array of languages (schema uses string[])
  pages: number;
  purchaseMode: "FREE" | "PAID";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; // Renamed from publishStatus
  priceInr: number; // Single price (schema: price_inr)
  priceUsd: number; // Single price (schema: price_usd)
  discountInr: number; // Single discount (schema: discount_inr)
  discountUsd: number; // Single discount (schema: discount_usd)
  thumbnailUrl: string; // Single thumbnail (schema: thumbnail_url)
  previewUrl: string;
  url: string; // S3 URL to EPUB or PDF (depending on fileFormat)
  /** Storage format of the book file. Drives which reader the web app mounts. */
  fileFormat: "EPUB" | "PDF";
  pageImages: string[]; // Array of page preview images
  authorIds: string[]; // For book_authors junction table
  categoryIds: string[]; // For book_categories junction table
  sortOrder: number;
  /** Access validity in days after purchase (default 365). null = lifetime (no expiry). */
  validityDays?: number | null;
  isBought?: boolean;
  /** Admin-editable average rating (1-5) */
  rating?: number;
  /** Total rating count for display */
  ratingTotalCount?: number;
  /** Recommended books for "More books you might like" section */
  recommendations?: BookRecommendationData[];
  /** Whether the "Read Sample" feature is enabled for this book */
  sampleEnabled?: boolean;
  /** Number of pages to show in the sample preview */
  samplePages?: number;

  // Legacy fields for backward compatibility with existing templates
  // These map to the new fields internally
  /** @deprecated Use status instead */
  publishStatus?: "PUBLISHED" | "NOT_PUBLISHED";
  /** @deprecated Use priceInr instead */
  webPriceINR?: number;
  /** @deprecated Use priceInr instead */
  mobilePriceINR?: number;
  /** @deprecated Use priceUsd instead */
  webPriceUSD?: number;
  /** @deprecated Use priceUsd instead */
  mobilePriceUSD?: number;
  /** @deprecated Use discountInr instead */
  webDiscount?: number;
  /** @deprecated Use discountInr instead */
  mobileDiscount?: number;
  /** @deprecated Use thumbnailUrl instead */
  webThumbnailUrl?: string;
  /** @deprecated Use thumbnailUrl instead */
  mobileThumbnailUrl?: string;
  /** @deprecated Not in schema - remove if not needed */
  offerings?: BookOfferingData[];
}

/**
 * Author data for display in templates
 */
export interface BookAuthor {
  id: string;
  name: string;
  bio?: string;
  avatar?: string;
  role?: string;
  company?: string;
  socialLinks?: Array<{
    platform: string;
    url: string;
  }>;
  experiences?: Array<{
    company: string;
    companyLogo?: string;
    years: number;
    details?: string;
  }>;
}

/**
 * Category data for display in templates
 */
export interface BookCategory {
  id: string;
  name: string;
  icon?: string;
}

/**
 * Book recommendation data for "More books you might like" section
 */
export interface BookRecommendationData {
  id: string;
  bookId: string;
  title: string;
  slug: string;
  thumbnailUrl?: string;
  sortOrder?: number;
}

/**
 * Create a BookRecommendationData from book details (for admin modal)
 */
export function createBookRecommendation(
  bookId: string,
  title: string,
  slug: string,
  thumbnailUrl?: string,
  sortOrder?: number
): BookRecommendationData {
  return {
    id: `rec-${bookId}-${Date.now()}`,
    bookId,
    title,
    slug,
    thumbnailUrl,
    sortOrder: sortOrder ?? 0,
  };
}

/**
 * Book display data - the main data type passed to templates
 */
export interface BookDisplayData extends BookFormData {
  authors?: BookAuthor[];
  categories?: BookCategory[];
}

/**
 * Template variant types
 */
export type BookTemplateId = "classic" | "modern" | "minimal" | "amazon";

/**
 * Pre-resolved multi-currency price parts passed by the web caller.
 * Structurally compatible with the shared ResolvedPrice / UnavailablePrice
 * shapes, so callers can pass a ResolvedPriceResult directly.
 */
export type TemplatePriceParts =
  | {
      currency: string;
      symbol: string;
      amount: number;
      original: number;
      hasDiscount: boolean;
      /**
       * How the admin expressed the discount. Optional: hand-built price parts
       * omit it, and absent means PERCENTAGE, what every item used before
       * flat discounts existed.
       */
      discountType?: "PERCENTAGE" | "FLAT";
      unavailable?: false | undefined;
      /**
       * Other configured currency prices, pre-formatted by the caller.
       * The admin editor passes these so the full price book is visible at a
       * glance; the storefront passes a single resolved price and omits this.
       */
      additionalPrices?: Array<{ currency: string; label: string }>;
    }
  | { unavailable: true };

/**
 * Coupon validation result from the checkout API.
 * Defined here so template packages don't depend on web app types.
 */
export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  discount_amount: number;
  original_amount: number;
  net_amount: number;
  currency: string;
}

/**
 * Edit callback types for admin mode
 */
export interface BookEditCallbacks {
  onEditTitle?: (title: string) => void;
  onEditDescription?: (description: string) => void;
  onEditLanguage?: (language: string) => void;
  onEditPages?: (pages: number) => void;
  onEditPrice?: () => void;
  onEditAuthors?: () => void;
  onEditCategories?: () => void;
  onEditThumbnail?: () => void;
  onEditOfferings?: () => void;
  onEditPdfUrl?: (url: string) => void;
  onEditRecommendations?: () => void;
  /** Edit sample preview settings (enable/disable, number of pages) */
  onEditSampleSettings?: () => void;
  /** Edit book rating (admin override, 0-5) */
  onEditRating?: () => void;
  /** Web: Add to cart (passed from book-page-client) */
  onAddToCart?: () => void;
  /** Web: Buy now - add to cart and navigate to /cart */
  onBuyNow?: () => void;
  /** Web: Navigate to the reader (when user already has access) */
  onContinueReading?: () => void;
  /** Whether the current user already has access to this book */
  hasAccess?: boolean;
  /** Whether the access check has completed (false = still loading) */
  accessChecked?: boolean;
  /** Whether the book is currently in the cart */
  isInCart?: boolean;
  /** Preferred currency for price display (based on user timezone). null = not yet resolved. */
  preferredCurrency?: "INR" | "USD" | null;
  /**
   * Pre-resolved multi-currency price parts computed by the caller from the
   * buyer's currency context. Rendered preferentially over the legacy
   * priceInr/priceUsd math. `{ unavailable: true }` means a PAID book with
   * no price in any enabled currency (hide buy CTAs).
   */
  priceParts?: TemplatePriceParts | null;
  /** Whether the book is currently bookmarked */
  isBookmarked?: boolean;
  /** Web: Toggle bookmark */
  onBookmarkToggle?: () => void;
  /** Open share modal (web only, when not in edit mode) */
  onShare?: () => void;
  /** Validate a coupon code (web only). Returns validation result or throws. */
  onValidateCoupon?: (code: string) => Promise<CouponValidationResult>;
  /** Called when coupon is applied successfully */
  onCouponApplied?: (result: CouponValidationResult) => void;
  /** Called when coupon is removed */
  onCouponRemoved?: () => void;
  /**
   * Rendered in place of the built-in coupon input when supplied. The storefront
   * passes its CouponOffers block here, templates cannot import it directly,
   * since packages sit below the app in the dependency graph.
   */
  couponSlot?: ReactNode;
  /** Currently applied coupon result (for price display) */
  appliedCoupon?: CouponValidationResult | null;
}

/**
 * Props for book template components
 */
export interface BookTemplateProps {
  /** Book data to display */
  bookData: BookDisplayData;
  /** Whether edit mode is enabled */
  isEditMode?: boolean;
  /** Edit callbacks (only used when isEditMode is true) */
  editCallbacks?: BookEditCallbacks;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Template configuration
 */
export interface BookTemplateConfig {
  id: BookTemplateId;
  name: string;
  description: string;
  thumbnail?: string;
}

/**
 * Available book templates
 */
export const bookTemplateConfigs: BookTemplateConfig[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional side-by-side layout with book cover and details, matching the original design",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with gradient hero, 3D book cover, and sticky sidebar",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean, centered layout with typography-focused design",
  },
  {
    id: "amazon",
    name: "Amazon Style",
    description: "E-commerce inspired layout with three columns: cover, details, and purchase box",
  },
];

/**
 * Default book form data
 */
export function getDefaultBookFormData(): BookFormData {
  return {
    id: "",
    title: "Untitled Book",
    slug: "",
    description: "",
    summary: "",
    author: "",
    language: ["English"],
    pages: 0,
    purchaseMode: "FREE",
    status: "DRAFT",
    priceInr: 0,
    priceUsd: 0,
    discountInr: 0,
    discountUsd: 0,
    thumbnailUrl: "",
    previewUrl: "",
    url: "",
    fileFormat: "EPUB",
    pageImages: [],
    authorIds: [],
    categoryIds: [],
    sortOrder: 0,
    validityDays: 365,
    isBought: false,
    rating: undefined,
    ratingTotalCount: undefined,
    sampleEnabled: true,
    samplePages: 10,
    // Legacy fields for backward compatibility
    publishStatus: "NOT_PUBLISHED",
    webPriceINR: 0,
    mobilePriceINR: 0,
    webPriceUSD: 0,
    mobilePriceUSD: 0,
    webDiscount: 0,
    mobileDiscount: 0,
    webThumbnailUrl: "",
    mobileThumbnailUrl: "",
    offerings: [],
  };
}

/**
 * Sample book data for previews and demos
 */
export const sampleBookData: BookDisplayData = {
  id: "sample-book",
  title: "The Complete Python Programming Guide",
  slug: "complete-python-programming-guide",
  description: `
    <p>This comprehensive guide covers everything you need to know about Python programming, from basic syntax to advanced concepts.</p>
    <p>Whether you're a complete beginner or an experienced developer looking to expand your skills, this book provides practical examples and real-world projects to help you master Python.</p>
    <h3>What you'll learn:</h3>
    <ul>
      <li>Python fundamentals and syntax</li>
      <li>Object-oriented programming</li>
      <li>Working with data structures</li>
      <li>File handling and I/O operations</li>
      <li>Web development with Python</li>
      <li>Data science and machine learning basics</li>
    </ul>
  `,
  summary: "A comprehensive guide to Python programming covering fundamentals to advanced concepts.",
  author: "Dr. Sarah Johnson",
  language: ["English"],
  pages: 450,
  purchaseMode: "PAID",
  status: "PUBLISHED",
  priceInr: 999,
  priceUsd: 19,
  discountInr: 200,
  discountUsd: 4,
  thumbnailUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=600&fit=crop",
  previewUrl: "",
  url: "",
  fileFormat: "EPUB",
  pageImages: [],
  authorIds: ["author-1"],
  categoryIds: ["cat-1"],
  sortOrder: 0,
  isBought: false,
  // Legacy fields for backward compatibility
  publishStatus: "PUBLISHED",
  webPriceINR: 999,
  mobilePriceINR: 799,
  webPriceUSD: 19,
  mobilePriceUSD: 15,
  webDiscount: 20,
  mobileDiscount: 20,
  webThumbnailUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=600&fit=crop",
  mobileThumbnailUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=600&fit=crop",
  offerings: [
    { id: "off-1", text: "450+ pages of in-depth content" },
    { id: "off-2", text: "50+ practical coding exercises" },
    { id: "off-3", text: "Real-world project examples" },
    { id: "off-4", text: "Lifetime access to updates" },
    { id: "off-5", text: "Downloadable code samples" },
  ],
};

export const sampleAuthors: BookAuthor[] = [
  {
    id: "author-1",
    name: "Dr. Sarah Johnson",
    bio: "Dr. Sarah Johnson is a software engineer and educator with over 15 years of experience in Python development. She has taught programming at Stanford University and has authored multiple bestselling programming books.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    role: "Senior Software Engineer",
    company: "TechCorp Inc.",
  },
];

export const sampleCategories: BookCategory[] = [
  { id: "cat-1", name: "Programming" },
  { id: "cat-2", name: "Data Science" },
  { id: "cat-3", name: "Web Development" },
];

/**
 * API response from books endpoint (camelCase from backend)
 */
export interface BookApiResponse {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  author: string | null;
  description: string | null;
  summary: string | null;
  pages: number | null;
  url: string | null;
  pageImages: string[];
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: "FREE" | "PAID";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  language: string[];
  thumbnailUrl: string | null;
  previewUrl: string | null;
  sortOrder: number;
  validityDays?: number | null;
  rating?: number | null;
  ratingTotalCount?: number | null;
  sampleEnabled?: boolean;
  samplePages?: number | null;
  fileFormat?: "EPUB" | "PDF";
  authorIds: string[];
  categoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert API response to BookFormData
 */
export function apiResponseToBookFormData(apiBook: BookApiResponse): BookFormData {
  const priceInr = apiBook.priceInr ? parseFloat(apiBook.priceInr) : 0;
  const priceUsd = apiBook.priceUsd ? parseFloat(apiBook.priceUsd) : 0;
  const discountInr = apiBook.discountInr ? parseFloat(apiBook.discountInr) : 0;
  const discountUsd = apiBook.discountUsd ? parseFloat(apiBook.discountUsd) : 0;
  const thumbnailUrl = apiBook.thumbnailUrl || "";

  return {
    id: apiBook.id,
    title: apiBook.title,
    slug: apiBook.slug,
    description: apiBook.description || "",
    summary: apiBook.summary || "",
    author: apiBook.author || "",
    language: apiBook.language || ["English"],
    pages: apiBook.pages || 0,
    purchaseMode: apiBook.purchaseMode,
    status: apiBook.status,
    priceInr,
    priceUsd,
    discountInr,
    discountUsd,
    thumbnailUrl,
    previewUrl: apiBook.previewUrl || "",
    url: apiBook.url || "",
    fileFormat: apiBook.fileFormat ?? "EPUB",
    pageImages: apiBook.pageImages || [],
    authorIds: apiBook.authorIds || [],
    categoryIds: apiBook.categoryIds || [],
    sortOrder: apiBook.sortOrder || 0,
    validityDays:
      (apiBook as { validityDays?: number | null }).validityDays === undefined
        ? 365
        : (apiBook as { validityDays?: number | null }).validityDays,
    isBought: false,
    rating: apiBook.rating != null ? Number(apiBook.rating) : undefined,
    ratingTotalCount: apiBook.ratingTotalCount ?? undefined,
    sampleEnabled: apiBook.sampleEnabled ?? true,
    samplePages: apiBook.samplePages ?? 10,
    // Legacy fields for backward compatibility with templates
    publishStatus: apiBook.status === "PUBLISHED" ? "PUBLISHED" : "NOT_PUBLISHED",
    webPriceINR: priceInr,
    mobilePriceINR: priceInr,
    webPriceUSD: priceUsd,
    mobilePriceUSD: priceUsd,
    webDiscount: discountInr,
    mobileDiscount: discountUsd,
    webThumbnailUrl: thumbnailUrl,
    mobileThumbnailUrl: thumbnailUrl,
    offerings: [],
  };
}

/**
 * Convert BookFormData to API request format
 */
export function bookFormDataToApiRequest(bookData: BookFormData): Record<string, unknown> {
  return {
    title: bookData.title,
    slug: bookData.slug,
    author: bookData.author || null,
    description: bookData.description || null,
    summary: bookData.summary || null,
    pages: bookData.pages || null,
    url: bookData.url || null,
    page_images: bookData.pageImages || [],
    price_inr: bookData.priceInr ? String(bookData.priceInr) : null,
    price_usd: bookData.priceUsd ? String(bookData.priceUsd) : null,
    discount_inr: bookData.discountInr ? String(bookData.discountInr) : null,
    discount_usd: bookData.discountUsd ? String(bookData.discountUsd) : null,
    purchase_mode: bookData.purchaseMode,
    status: bookData.status,
    language: Array.isArray(bookData.language) ? bookData.language : [bookData.language || "English"],
    thumbnail_url: bookData.thumbnailUrl || null,
    preview_url: bookData.previewUrl || null,
    sort_order: bookData.sortOrder || 0,
    validity_days: bookData.validityDays === undefined ? 365 : bookData.validityDays,
    rating: bookData.rating != null ? String(bookData.rating) : null,
    rating_total_count: bookData.ratingTotalCount ?? null,
    sample_enabled: bookData.sampleEnabled ?? true,
    sample_pages: bookData.samplePages ?? 10,
    file_format: bookData.fileFormat ?? "EPUB",
    author_ids: bookData.authorIds || [],
    category_ids: bookData.categoryIds || [],
  };
}
