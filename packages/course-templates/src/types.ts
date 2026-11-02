import type { ReactNode } from "react";

/**
 * Types for Course Templates Package
 * 
 * These types define the data structures used by the shared course templates.
 * They are designed to work with both admin (edit mode) and web (read-only) apps.
 */

import type {
  CourseFormData,
  CourseDifficulty,
  CourseMode,

} from "@open-mtlms/shared";

// Re-export CourseFormData for convenience
export type { CourseFormData };

/**
 * Instructor data for display in templates
 */
export interface CourseInstructor {
  id: string;
  name: string;
  role: string;
  company?: string;
  avatar?: string;
  bio?: string;
  rating?: number;
  students?: number;
  courses?: number;
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
export interface CourseCategory {
  id: string;
  name: string;
  icon?: string;
}

/** Single review for ratings section display */
export interface CourseReviewItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  review?: string;
  createdAt: string;
}

/** Rating summary for ratings section */
export interface CourseRatingSummary {
  averageRating: number;
  totalRatings: number;
  ratingDistribution?: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

/**
 * Course display data - the main data type passed to templates
 * This is a superset of CourseFormData with additional display-specific fields
 */
export interface CourseDisplayData extends CourseFormData {
  // Additional display data that may come from external sources
  instructors?: CourseInstructor[];
  categories?: CourseCategory[];
  rating?: number;
  ratingTotalCount?: number;
  /** LMS reviews for ratings section (fetched from API) */
  ratings?: CourseReviewItem[];
  /** LMS rating summary (average, total, distribution) */
  ratingSummary?: CourseRatingSummary;
}

/**
 * Template variant types
 */
export type CourseTemplateId = "modern" | "photography";

/**
 * Section label keys for editable section headings and pricing card text
 */
export type CourseSectionLabelKey =
  | "sectionHeadlineLearningOutcomes"
  | "sectionHeadlineCourseContent"
  | "sectionHeadlineOfferings"
  | "sectionHeadlineRequirements"
  | "sectionHeadlineDescription"
  | "sectionHeadlineInstructor"
  | "sectionHeadlineFaq"
  | "sectionHeadlineRecommendations"
  | "pricingPlusHeadline"
  | "pricingPlusSubtext"
  | "pricingGuaranteeText";

/**
 * Section keys for AI content generation
 */
export type CourseAISectionKey =
  | "subtitle"
  | "learningOutcomes"
  | "curriculum"
  | "offerings"
  | "requirements"
  | "description"
  | "faqs"
  | "thumbnails";

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
       * How the admin expressed the discount. Optional because hand-built
       * price parts (admin previews) omit it; absent means PERCENTAGE, which
       * is what every non-hub item used before flat discounts existed.
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
export interface CourseEditCallbacks {
  onEditTitle?: (title: string) => void;
  onEditSubtitle?: (subtitle: string) => void;
  onEditDescription?: (description: string) => void;
  onEditDuration?: (duration: string) => void;
  onEditMode?: (mode: CourseMode) => void;
  onEditDifficulty?: (difficulty: CourseDifficulty) => void;
  onEditPrice?: () => void;
  onEditSyllabus?: () => void;
  onEditFAQ?: () => void;
  onEditRecommendations?: () => void;
  onEditOfferings?: () => void;
  onEditInstructors?: () => void;
  onEditCategories?: () => void;
  onEditLanguages?: () => void;
  onEditThumbnail?: () => void;
  onEditLearningOutcomes?: (outcomes: string[]) => void;
  onEditPrerequisites?: (prerequisites: string[]) => void;
  /** Updates editable section labels and pricing card text */
  onEditSectionLabels?: (updates: Partial<Record<CourseSectionLabelKey, string>>) => void;
  /** Toggle section visibility (hide/show) */
  onToggleSectionVisibility?: (sectionKey: string) => void;
  /** Edit course rating (1-5, admin override) */
  onEditRating?: (rating: number, ratingTotalCount?: number) => void;
  /** Add current course to cart (web only, when not in edit mode) */
  onAddToCart?: () => void;
  /** Remove current course from cart (web only) */
  onRemoveFromCart?: () => void;
  /** Whether the course is currently in the cart */
  isInCart?: boolean;
  /** Buy now / enroll (web only, when not in edit mode) */
  onBuyNow?: () => void | Promise<void>;
  /** True when free enrollment is in progress (disables Enroll button) */
  isEnrollingFree?: boolean;
  /** True when course ID hasn't resolved yet, disables all purchase/cart CTAs */
  isPurchaseDisabled?: boolean;
  /** Navigate to the learn page (web only, when user already has access) */
  onContinueLearning?: () => void;
  /** Open share modal (web only, when not in edit mode) */
  onShare?: () => void;
  /** Whether the current user already has access to this course */
  hasAccess?: boolean;
  /** Preferred currency for price display (based on user timezone). null = not yet resolved. */
  preferredCurrency?: "INR" | "USD" | null;
  /**
   * Pre-resolved multi-currency price parts computed by the caller from the
   * buyer's currency context. Rendered preferentially over the legacy
   * priceInr/priceUsd math. `{ unavailable: true }` means a PAID course with
   * no price in any enabled currency (hide buy CTAs).
   */
  priceParts?: TemplatePriceParts | null;
  /** Trigger AI generation for a specific section or all sections */
  onGenerateWithAI?: (sectionKey: CourseAISectionKey) => void;
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

/** Section keys for visibility toggle - must match keys in courseData.sectionVisibility */
export const COURSE_SECTION_KEYS = [
  "learningOutcomes",
  "curriculum",
  "offerings",
  "requirements",
  "description",
  "instructor",
  "faq",
  "ratings",
  "recommendations",
] as const;
export type CourseSectionKey = (typeof COURSE_SECTION_KEYS)[number];

/**
 * Props for course template components
 */
export interface CourseTemplateProps {
  /** Course data to display */
  courseData: CourseDisplayData;
  /** Whether edit mode is enabled */
  isEditMode?: boolean;
  /** Edit callbacks (only used when isEditMode is true) */
  editCallbacks?: CourseEditCallbacks;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Template configuration
 */
export interface CourseTemplateConfig {
  id: CourseTemplateId;
  name: string;
  description: string;
  thumbnail?: string;
}

/**
 * Available course templates. Only Modern is supported; Classic and Minimal have been removed.
 */
export const courseTemplateConfigs: CourseTemplateConfig[] = [
  {
    id: "modern",
    name: "Modern",
    description: "Clean, contemporary design with gradient hero and card-based sections",
  },
  {
    id: "photography",
    name: "Photography",
    description: "Bold neo-brutalist design with thick borders, box shadows, and uppercase typography",
  },
];
