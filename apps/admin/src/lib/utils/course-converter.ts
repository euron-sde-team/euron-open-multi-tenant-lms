/**
 * Course Data Converter Utilities
 * 
 * Converts between:
 * - Page (API model with SectionConfig[]) ↔ CourseFormData (store model)
 * - LMS full response (courses table + sections/lessons/lectures/faqs) ↔ CourseFormData
 * 
 * This enables the CourseEditorContainer templates to work with course pages
 * stored in the pages API or with LMS tables.
 */

import type {
  ContentPrice,
  CourseFormData,
  CourseMode,
  CourseLanguage,
  CoursePreviewVideo,
  SectionConfig,
  ThemeConfig,
} from "@open-mtlms/shared";
import { decodeHtmlEntities, getDefaultCourseFormData, normalizeSectionModules } from "@open-mtlms/shared";

const dh = decodeHtmlEntities;

import type { LMSCourseFullResponse } from "../types/course-lms";
import type { Page, UpdatePageRequest } from "../types/page";

import { legacyToPrices } from "./price-fields";

// ============ Helper Types for Section Content ============

interface CourseHeroSectionContent {
  title?: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  thumbnailAlt?: string;
  mode?: CourseMode;
  difficulty?: string;
  duration?: string;
  language?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  currency?: string;
  /** Multi-currency price book mirrored from CourseFormData.prices on save. */
  prices?: ContentPrice[];
  rating?: number;
  ratingTotalCount?: number;
  studentsCount?: number;
  category?: string;
  categoryIcon?: string;
  enrollCta?: { text: string; href: string };
  previewVideoUrl?: string;
  // Category data for web display
  categoryIds?: string[];
  categories?: Array<{ id: string; name: string; icon?: string }>;
  // Editable labels stored in hero section for round-trip
  descriptionHeadline?: string;
  pricingPlusHeadline?: string;
  pricingPlusSubtext?: string;
  pricingGuaranteeText?: string;
  validityDays?: number | null;
}

interface CourseCurriculumSectionContent {
  headline?: string;
  subheadline?: string;
  sections?: Array<{
    id: string;
    title: string;
    /** @deprecated Use modules instead. Legacy format. */
    lectures?: Array<{
      id: string;
      title: string;
      duration?: string;
      isPreview?: boolean;
      previewVideo?: CoursePreviewVideo;
    }>;
    modules?: Array<{
      id: string;
      title: string;
      order: number;
      lectures: Array<{
        id: string;
        title: string;
        duration?: string;
        isPreview?: boolean;
        previewVideo?: CoursePreviewVideo;
      }>;
    }>;
  }>;
  totalLectures?: number;
  totalDuration?: string;
}

interface CourseOfferingsSectionContent {
  headline?: string;
  subheadline?: string;
  offerings?: Array<{
    id: string;
    icon: string;
    text: string;
  }>;
}

interface FAQSectionContent {
  headline?: string;
  subheadline?: string;
  faqs?: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}

interface CourseLearningOutcomesSectionContent {
  headline?: string;
  subheadline?: string;
  outcomes?: string[];
}

interface CoursePrerequisitesSectionContent {
  headline?: string;
  subheadline?: string;
  prerequisites?: string[];
}

interface CourseRecommendationsSectionContent {
  headline?: string;
  recommendations?: Array<{
    id: string;
    courseId: string;
    title: string;
    slug: string;
    thumbnailUrl?: string;
    sortOrder?: number;
  }>;
}

interface CourseInstructorSectionContent {
  headline?: string;
  subheadline?: string;
  instructors?: Array<{
    id: string;
    name: string;
    role: string;
    bio?: string;
    avatar?: string;
    rating?: number;
    studentsCount?: number;
    socialLinks?: Array<{ platform: string; url: string }>;
  }>;
}

// ============ LMS Full Response to CourseFormData ============

export interface LmsToCourseFormPageInfo {
  id: string;
  tenantId: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Convert LMS API full response (course + sections + lessons + lectures + faqs) to CourseFormData.
 * Used when editor loads from courses/LMS tables. Pass page info for id/slug/tenantId (from the course page).
 */
export function lmsFullToCourseFormData(
  full: LMSCourseFullResponse,
  pageInfo: LmsToCourseFormPageInfo,
  theme?: ThemeConfig
): CourseFormData {
  const defaults = getDefaultCourseFormData();
  const { course, sections: lmsSections, faqs } = full;

  const courseData: CourseFormData = {
    ...defaults,
    id: pageInfo.id,
    tenantId: pageInfo.tenantId,
    title: dh(course.title),
    slug: course.slug ?? pageInfo.slug,
    subTitle: dh(course.subtitle ?? ""),
    description: dh(course.description ?? ""),
    createdAt: pageInfo.createdAt,
    updatedAt: pageInfo.updatedAt,
    learningOutcomes: (course.learningOutcomes ?? []).map((o) => dh(o)),
    prerequisites: (course.prerequisites ?? []).map((p) => dh(p)),
    duration: course.duration ?? "",
    mode: (course.mode as CourseMode) || "SELF_PACED",
    difficulty: (course.difficulty as CourseFormData["difficulty"]) || "NONE",
    language: Array.isArray(course.language) && course.language[0] ? (course.language[0] as CourseLanguage) : "English",
    webThumbnailUrl: course.thumbnailUrl ?? "",
    mobileThumbnailUrl: course.secondaryThumbnailUrl ?? course.thumbnailUrl ?? "",
    previewUrl: course.previewUrl ?? "",
    thumbnailKey: course.thumbnailKey ?? undefined,
    secondaryThumbnailKey: course.secondaryThumbnailKey ?? undefined,
    previewKey: course.previewKey ?? undefined,
    purchaseMode: (course.purchaseMode as "FREE" | "PAID") || "PAID",
    validityDays:
      course.validityDays === undefined ? (defaults.validityDays ?? 365) : course.validityDays,
    webPriceINR: course.priceInr ? Number(course.priceInr) : defaults.webPriceINR,
    mobilePriceINR: course.priceInr ? Number(course.priceInr) : defaults.mobilePriceINR,
    webPriceUSD: course.priceUsd ? Number(course.priceUsd) : defaults.webPriceUSD,
    mobilePriceUSD: course.priceUsd ? Number(course.priceUsd) : defaults.mobilePriceUSD,
    webDiscount: course.discountInr ? Number(course.discountInr) : 0,
    mobileDiscount: course.discountInr ? Number(course.discountInr) : 0,
    prices: course.prices?.length
      ? course.prices
      : legacyToPrices(course.priceInr, course.priceUsd, course.discountInr, course.discountUsd),
    categoryIds: course.categoryIds ?? [],
    faqs: (faqs ?? []).map((f) => ({
      id: f.id,
      question: dh(f.question),
      answer: dh(f.answer),
    })),
    sections: (lmsSections ?? []).map((sec, secIndex) => {
      const lectures = (sec.lessons ?? [])
        .filter((l) => l.lesson.type === "LECTURE")
        .map((l, lecIndex) => ({
          id: l.lesson.id,
          title: dh(l.lesson.title),
          order: lecIndex,
          duration: l.lecture?.duration ?? undefined,
          videoUrl: l.lecture?.video_key ?? undefined,
          description: l.lecture?.summary ? dh(l.lecture.summary) : undefined,
          previewUrl: l.lesson.is_preview ? "preview" : undefined,
        }));
      return {
        id: sec.id,
        title: dh(sec.title),
        order: secIndex,
        modules: [
          {
            id: `module-${sec.id}-lms`,
            title: "Content",
            order: 0,
            lectures,
          },
        ],
      };
    }),
  };

  if (theme) {
    courseData.theme = {
      id: "page-theme",
      name: "Page Theme",
      description: "Theme from page",
      colors: {
        light: {
          primary: theme.colors?.light?.primary ?? defaults.theme.colors.light.primary,
          primaryForeground: theme.colors?.light?.primaryForeground ?? defaults.theme.colors.light.primaryForeground,
          secondary: theme.colors?.light?.secondary ?? defaults.theme.colors.light.secondary,
          secondaryForeground: theme.colors?.light?.secondaryForeground ?? defaults.theme.colors.light.secondaryForeground,
          accent: theme.colors?.light?.accent ?? defaults.theme.colors.light.accent,
          accentForeground: theme.colors?.light?.accentForeground ?? defaults.theme.colors.light.accentForeground,
          background: theme.colors?.light?.background ?? defaults.theme.colors.light.background,
          foreground: theme.colors?.light?.foreground ?? defaults.theme.colors.light.foreground,
          muted: theme.colors?.light?.muted ?? defaults.theme.colors.light.muted,
          mutedForeground: theme.colors?.light?.mutedForeground ?? defaults.theme.colors.light.mutedForeground,
          card: theme.colors?.light?.card ?? defaults.theme.colors.light.card,
          cardForeground: theme.colors?.light?.cardForeground ?? defaults.theme.colors.light.cardForeground,
          border: theme.colors?.light?.border ?? defaults.theme.colors.light.border,
          input: theme.colors?.light?.input ?? defaults.theme.colors.light.input,
          ring: theme.colors?.light?.ring ?? defaults.theme.colors.light.ring,
        },
        dark: {
          background: theme.colors?.dark?.background ?? defaults.theme.colors.dark.background,
          foreground: theme.colors?.dark?.foreground ?? defaults.theme.colors.dark.foreground,
          card: theme.colors?.dark?.card ?? defaults.theme.colors.dark.card,
          cardForeground: theme.colors?.dark?.cardForeground ?? defaults.theme.colors.dark.cardForeground,
          muted: theme.colors?.dark?.muted ?? defaults.theme.colors.dark.muted,
          mutedForeground: theme.colors?.dark?.mutedForeground ?? defaults.theme.colors.dark.mutedForeground,
          border: theme.colors?.dark?.border ?? defaults.theme.colors.dark.border,
          input: theme.colors?.dark?.input ?? defaults.theme.colors.dark.input,
        },
      },
      fonts: {
        heading: theme.fonts?.heading ?? defaults.theme.fonts.heading,
        body: theme.fonts?.body ?? defaults.theme.fonts.body,
        headingWeight: theme.fonts?.headingWeight ?? defaults.theme.fonts.headingWeight,
        bodyWeight: theme.fonts?.bodyWeight ?? defaults.theme.fonts.bodyWeight,
      },
      borderRadius: theme.borders?.radius ?? defaults.theme.borderRadius,
    };
  }

  return courseData;
}

// ============ Page to CourseFormData Conversion ============

/**
 * Convert a Page (from API) to CourseFormData (for store)
 * Extracts data from page sections into the flat CourseFormData structure
 */
export function pageToCourseFormData(page: Page): CourseFormData {
  const defaults = getDefaultCourseFormData();
  
  // Start with defaults
  const courseData: CourseFormData = {
    ...defaults,
    id: page.id,
    tenantId: page.tenantId,
    title: dh(page.title),
    slug: page.slug,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };

  // Apply theme if present (convert from ThemeConfig to CourseThemeConfig format)
  if (page.theme) {
    courseData.theme = {
      id: "page-theme",
      name: "Page Theme",
      description: "Theme from page",
      colors: {
        light: {
          primary: page.theme.colors?.light?.primary || defaults.theme.colors.light.primary,
          primaryForeground: page.theme.colors?.light?.primaryForeground || defaults.theme.colors.light.primaryForeground,
          secondary: page.theme.colors?.light?.secondary || defaults.theme.colors.light.secondary,
          secondaryForeground: page.theme.colors?.light?.secondaryForeground || defaults.theme.colors.light.secondaryForeground,
          accent: page.theme.colors?.light?.accent || defaults.theme.colors.light.accent,
          accentForeground: page.theme.colors?.light?.accentForeground || defaults.theme.colors.light.accentForeground,
          background: page.theme.colors?.light?.background || defaults.theme.colors.light.background,
          foreground: page.theme.colors?.light?.foreground || defaults.theme.colors.light.foreground,
          muted: page.theme.colors?.light?.muted || defaults.theme.colors.light.muted,
          mutedForeground: page.theme.colors?.light?.mutedForeground || defaults.theme.colors.light.mutedForeground,
          card: page.theme.colors?.light?.card || defaults.theme.colors.light.card,
          cardForeground: page.theme.colors?.light?.cardForeground || defaults.theme.colors.light.cardForeground,
          border: page.theme.colors?.light?.border || defaults.theme.colors.light.border,
          input: page.theme.colors?.light?.input || defaults.theme.colors.light.input,
          ring: page.theme.colors?.light?.ring || defaults.theme.colors.light.ring,
        },
        dark: {
          background: page.theme.colors?.dark?.background || defaults.theme.colors.dark.background,
          foreground: page.theme.colors?.dark?.foreground || defaults.theme.colors.dark.foreground,
          card: page.theme.colors?.dark?.card || defaults.theme.colors.dark.card,
          cardForeground: page.theme.colors?.dark?.cardForeground || defaults.theme.colors.dark.cardForeground,
          muted: page.theme.colors?.dark?.muted || defaults.theme.colors.dark.muted,
          mutedForeground: page.theme.colors?.dark?.mutedForeground || defaults.theme.colors.dark.mutedForeground,
          border: page.theme.colors?.dark?.border || defaults.theme.colors.dark.border,
          input: page.theme.colors?.dark?.input || defaults.theme.colors.dark.input,
        },
      },
      fonts: {
        heading: page.theme.fonts?.heading || defaults.theme.fonts.heading,
        body: page.theme.fonts?.body || defaults.theme.fonts.body,
        headingWeight: page.theme.fonts?.headingWeight || defaults.theme.fonts.headingWeight,
        bodyWeight: page.theme.fonts?.bodyWeight || defaults.theme.fonts.bodyWeight,
      },
      borderRadius: page.theme.borders?.radius || defaults.theme.borderRadius,
    };
  }

  // Build sectionVisibility from page sections (for course editor)
  const sectionVisibility: Record<string, boolean> = {};

  // Extract data from each section type
  for (const section of page.sections) {
    if (section.deleted) continue;

    // Capture visibility for course sections (always, so we persist hide state)
    const key = SECTION_TYPE_TO_KEY[section.type];
    if (key) {
      sectionVisibility[key] = section.visible !== false;
    }

    // Skip deleted sections; extract content from visible AND hidden (editor needs all data)
    if (section.deleted) continue;

    switch (section.type) {
      case "course-hero": {
        const content = section.content as CourseHeroSectionContent;
        const heroSettings = section.settings as { __descriptionVisible?: boolean; __ratingVisible?: boolean } | undefined;
        if (heroSettings?.__descriptionVisible === false) {
          sectionVisibility.description = false;
        } else {
          sectionVisibility.description = true;
        }
        // Hero rating visibility (admin can hide the inline star rating from learners)
        if (heroSettings?.__ratingVisible === false) {
          sectionVisibility.heroRating = false;
        }
        if (content) {
          courseData.title = dh(content.title) || courseData.title;
          courseData.subTitle = dh(content.subtitle) || courseData.subTitle;
          courseData.description = dh(content.description) || courseData.description;
          courseData.webThumbnailUrl = content.thumbnail || courseData.webThumbnailUrl;
          courseData.mobileThumbnailUrl = content.thumbnail || courseData.mobileThumbnailUrl;
          courseData.mode = (content.mode as CourseMode) || courseData.mode;
          courseData.difficulty = (content.difficulty as CourseFormData["difficulty"]) || courseData.difficulty;
          courseData.duration = content.duration || courseData.duration;
          const langRaw = content.language;
          if (langRaw) {
            if (typeof langRaw === "string" && langRaw.includes(",")) {
              courseData.languages = langRaw.split(",").map((s) => s.trim()).filter(Boolean);
              courseData.language = (courseData.languages[0] as CourseLanguage) || courseData.language;
            } else {
              courseData.language = (langRaw as CourseLanguage) || courseData.language;
              courseData.languages = courseData.languages ?? [courseData.language];
            }
          }
          courseData.previewUrl = content.previewVideoUrl || courseData.previewUrl;
          
          // Pricing
          if (content.price !== undefined) {
            courseData.webPriceINR = content.price;
            courseData.mobilePriceINR = content.price;
          }
          if (content.discount !== undefined) {
            courseData.webDiscount = content.discount;
            courseData.mobileDiscount = content.discount;
          }
          // Multi-currency price book: mirror INR/USD entries into the legacy
          // fields so untouched template code keeps working.
          if (Array.isArray(content.prices) && content.prices.length > 0) {
            courseData.prices = content.prices;
            const inr = content.prices.find((p) => p.currency === "INR");
            const usd = content.prices.find((p) => p.currency === "USD");
            if (inr) {
              courseData.webPriceINR = inr.amount;
              courseData.mobilePriceINR = inr.amount;
              courseData.webDiscount = inr.discount ?? 0;
            }
            if (usd) {
              courseData.webPriceUSD = usd.amount;
              courseData.mobilePriceUSD = usd.amount;
              courseData.mobileDiscount = usd.discount ?? 0;
            }
          }
          // Set purchase mode based on price
          const hasAnyPrice =
            (content.price && content.price > 0) ||
            (courseData.prices ?? []).some((p) => p.amount > 0);
          courseData.purchaseMode = hasAnyPrice ? "PAID" : "FREE";
          
          // Editable labels stored in hero section
          if ((content as { descriptionHeadline?: string }).descriptionHeadline) {
            courseData.sectionHeadlineDescription = dh((content as { descriptionHeadline?: string }).descriptionHeadline);
          }
          if ((content as { pricingPlusHeadline?: string }).pricingPlusHeadline) {
            courseData.pricingPlusHeadline = dh((content as { pricingPlusHeadline?: string }).pricingPlusHeadline);
          }
          if ((content as { pricingPlusSubtext?: string }).pricingPlusSubtext) {
            courseData.pricingPlusSubtext = dh((content as { pricingPlusSubtext?: string }).pricingPlusSubtext);
          }
          if ((content as { pricingGuaranteeText?: string }).pricingGuaranteeText) {
            courseData.pricingGuaranteeText = dh((content as { pricingGuaranteeText?: string }).pricingGuaranteeText);
          }
          if ((content as { validityDays?: number | null }).validityDays !== undefined) {
            courseData.validityDays = (content as { validityDays?: number | null }).validityDays ?? null;
          }
          // Rating (override from page or from LMS)
          if (content.rating !== undefined) courseData.rating = content.rating;
          if ((content as { ratingTotalCount?: number }).ratingTotalCount !== undefined) {
            courseData.ratingTotalCount = (content as { ratingTotalCount?: number }).ratingTotalCount;
          }
        }
        break;
      }

      case "course-curriculum": {
        const content = section.content as CourseCurriculumSectionContent;
        if (content?.sections) {
          courseData.sections = content.sections.map((s, index) => {
            // Support 3-level (modules) or legacy (lectures flat)
            const modules =
              s.modules && s.modules.length > 0
                ? s.modules.map((m, mIndex) => ({
                    id: m.id,
                    title: dh(m.title),
                    order: mIndex,
                    lectures: (m.lectures || []).map((l, lIndex) => ({
                      id: l.id,
                      title: dh(l.title),
                      order: lIndex,
                      duration: l.duration,
                      previewUrl: l.isPreview ? "preview" : undefined,
                      previewVideo: l.previewVideo,
                    })),
                  }))
                : [
                    {
                      id: `module-${s.id}-legacy`,
                      title: "Content",
                      order: 0,
                      lectures: (s.lectures || []).map((l, lIndex) => ({
                        id: l.id,
                        title: dh(l.title),
                        order: lIndex,
                        duration: l.duration,
                        previewUrl: l.isPreview ? "preview" : undefined,
                        previewVideo: l.previewVideo,
                      })),
                    },
                  ];
            return {
              id: s.id,
              title: dh(s.title),
              order: index,
              modules,
            };
          });
        }
        // Extract section headline
        if (content?.headline) {
          courseData.sectionHeadlineCourseContent = dh(content.headline);
        }
        break;
      }

      case "course-offerings": {
        const content = section.content as CourseOfferingsSectionContent;
        if (content?.offerings) {
          courseData.offerings = content.offerings.map((o) => ({
            id: o.id,
            icon: o.icon,
            text: dh(o.text),
          }));
        }
        // Extract section headline
        if (content?.headline) {
          courseData.sectionHeadlineOfferings = dh(content.headline);
        }
        break;
      }

      case "faq": {
        const content = section.content as FAQSectionContent;
        if (content?.faqs) {
          courseData.faqs = content.faqs.map((f) => ({
            id: f.id,
            question: dh(f.question),
            answer: dh(f.answer),
          }));
        }
        // Extract section headline
        if (content?.headline) {
          courseData.sectionHeadlineFaq = dh(content.headline);
        }
        break;
      }

      case "course-learning-outcomes": {
        const content = section.content as CourseLearningOutcomesSectionContent;
        if (content?.outcomes) {
          courseData.learningOutcomes = content.outcomes.map((o) => dh(o));
        }
        // Extract section headline
        if (content?.headline) {
          courseData.sectionHeadlineLearningOutcomes = dh(content.headline);
        }
        break;
      }

      case "course-prerequisites": {
        const content = section.content as CoursePrerequisitesSectionContent;
        if (content?.prerequisites) {
          courseData.prerequisites = content.prerequisites.map((p) => dh(p));
        }
        // Extract section headline
        if (content?.headline) {
          courseData.sectionHeadlineRequirements = dh(content.headline);
        }
        break;
      }

      case "course-instructor": {
        const content = section.content as CourseInstructorSectionContent;
        if (content?.instructors) {
          courseData.instructorIds = content.instructors.map((i) => i.id);
        }
        // Extract section headline
        if (content?.headline) {
          courseData.sectionHeadlineInstructor = dh(content.headline);
        }
        break;
      }

      case "course-recommendations": {
        const content = section.content as CourseRecommendationsSectionContent;
        if (content?.recommendations) {
          courseData.recommendations = content.recommendations.map((r) => ({
            id: r.id,
            courseId: r.courseId,
            title: dh(r.title),
            slug: r.slug,
            thumbnailUrl: r.thumbnailUrl,
            sortOrder: r.sortOrder ?? 0,
          }));
        }
        if (content?.headline) {
          courseData.sectionHeadlineRecommendations = dh(content.headline);
        }
        break;
      }
    }
  }

  courseData.sectionVisibility = Object.keys(sectionVisibility).length > 0 ? sectionVisibility : undefined;

  return courseData;
}

// ============ CourseFormData to Page Sections Conversion ============

/**
 * Create a section with proper structure
 */
function createSection(params: {
  id: string;
  type: string;
  variant?: string;
  order: number;
  content: unknown;
  visible?: boolean;
  settings?: Record<string, unknown>;
}): SectionConfig {
  return {
    id: params.id,
    type: params.type as SectionConfig["type"],
    variant: params.variant || "default",
    order: params.order,
    visible: params.visible !== false,
    deleted: false,
    content: params.content,
    settings: params.settings || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Map section type to sectionVisibility key */
const SECTION_TYPE_TO_KEY: Record<string, string> = {
  "course-learning-outcomes": "learningOutcomes",
  "course-curriculum": "curriculum",
  "course-offerings": "offerings",
  "course-prerequisites": "requirements",
  "faq": "faq",
  "course-instructor": "instructor",
  "course-ratings": "ratings",
  "course-recommendations": "recommendations",
};

/**
 * Category type for passing to section conversion
 */
interface CategoryData {
  id: string;
  name: string;
  icon?: string;
}

/**
 * Instructor type for passing to section conversion
 */
interface InstructorData {
  id: string;
  name: string;
  role: string;
  bio?: string;
  avatar?: string;
  rating?: number;
  students?: number;
  courses?: number;
}

/**
 * Convert CourseFormData to page sections for saving
 * @param courseData - The course form data
 * @param categories - Optional array of all available categories (used to map categoryIds to full objects)
 * @param instructors - Optional array of all available instructors (used to map instructorIds to full objects)
 */
export function courseFormDataToSections(
  courseData: CourseFormData,
  categories?: CategoryData[],
  instructors?: InstructorData[]
): SectionConfig[] {
  const now = Date.now();
  const sections: SectionConfig[] = [];

  // Map categoryIds to full category objects if categories array is provided
  const selectedCategories = categories && courseData.categoryIds
    ? courseData.categoryIds
        .map(id => categories.find(c => c.id === id))
        .filter((c): c is CategoryData => c !== undefined)
    : undefined;

  const sv = courseData.sectionVisibility ?? {};
  // Sections that should be hidden by default (require explicit opt-in)
  const hiddenByDefault = new Set(["recommendations", "ratings"]);
  const isVisible = (key: string) => hiddenByDefault.has(key) ? sv[key] === true : sv[key] !== false;

  // 1. Course Hero Section (always visible; description visibility in settings)
  sections.push(
    createSection({
      id: `section-hero-${now}`,
      type: "course-hero",
      variant: "default",
      order: 0,
      visible: true,
      settings: { __descriptionVisible: sv.description !== false, __ratingVisible: sv.heroRating !== false },
      content: {
        title: courseData.title,
        subtitle: courseData.subTitle,
        description: courseData.description,
        thumbnail: courseData.webThumbnailUrl,
        thumbnailAlt: courseData.title,
        mode: courseData.mode,
        difficulty: courseData.difficulty,
        duration: courseData.duration,
        language: (courseData.languages?.length ? courseData.languages.join(", ") : (courseData.language || "English")),
        price: courseData.purchaseMode === "PAID" ? courseData.webPriceINR : 0,
        originalPrice: courseData.webPriceINR,
        discount: courseData.webDiscount,
        currency: "INR",
        prices: courseData.purchaseMode === "PAID" ? courseData.prices : [],
        previewVideoUrl: courseData.previewUrl,
        rating: courseData.rating != null ? Number(courseData.rating.toFixed(1)) : undefined,
        ratingTotalCount: courseData.ratingTotalCount,
        // Include category data for web display
        categoryIds: courseData.categoryIds,
        categories: selectedCategories,
        // Editable labels stored in hero section for round-trip
        descriptionHeadline: courseData.sectionHeadlineDescription,
        pricingPlusHeadline: courseData.pricingPlusHeadline,
        pricingPlusSubtext: courseData.pricingPlusSubtext,
        pricingGuaranteeText: courseData.pricingGuaranteeText,
        validityDays: courseData.validityDays === undefined ? 365 : courseData.validityDays,
      } satisfies CourseHeroSectionContent,
    })
  );

  // 2. Learning Outcomes Section (always create for visibility control)
  sections.push(
    createSection({
      id: `section-learning-${now + 1}`,
      type: "course-learning-outcomes",
      variant: "grid",
      order: 1,
      visible: isVisible("learningOutcomes"),
      content: {
          headline: courseData.sectionHeadlineLearningOutcomes ?? "What You'll Learn",
          subheadline: "By the end of this course, you will be able to:",
          outcomes: courseData.learningOutcomes,
        } satisfies CourseLearningOutcomesSectionContent,
      })
    );

  // 3. Curriculum Section (always create for visibility control)
  sections.push(
    createSection({
      id: `section-curriculum-${now + 2}`,
      type: "course-curriculum",
      variant: "default",
      order: 2,
      visible: isVisible("curriculum"),
      content: {
          headline: courseData.sectionHeadlineCourseContent ?? "Course Content",
          subheadline: "What you'll learn in this course",
          sections: courseData.sections.map((s) => {
            const norm = normalizeSectionModules(s);
            return {
              id: norm.id,
              title: norm.title,
              modules: norm.modules.map((m) => ({
                id: m.id,
                title: m.title,
                order: m.order,
                lectures: m.lectures.map((l) => ({
                  id: l.id,
                  title: l.title,
                  duration: l.duration,
                  // A row counts as a preview if it is flagged or carries a
                  // video, so attaching one is enough to publish the sample.
                  isPreview: !!l.previewUrl || !!l.previewVideo,
                  previewVideo: l.previewVideo,
                })),
              })),
            };
          }),
          totalLectures: courseData.sections.reduce(
            (acc, s) =>
              acc +
              normalizeSectionModules(s).modules.reduce(
                (mAcc, m) => mAcc + m.lectures.length,
                0
              ),
            0
          ),
        } satisfies CourseCurriculumSectionContent,
      })
    );

  // 4. Offerings Section (always create for visibility control)
  sections.push(
    createSection({
      id: `section-offerings-${now + 3}`,
      type: "course-offerings",
      variant: "default",
      order: 3,
      visible: isVisible("offerings"),
      content: {
          headline: courseData.sectionHeadlineOfferings ?? "This Course Includes",
          subheadline: "Everything you get with this course",
          offerings: courseData.offerings.map((o) => ({
            id: o.id,
            icon: o.icon,
            text: o.text,
          })),
        } satisfies CourseOfferingsSectionContent,
      })
    );

  // 5. Prerequisites Section (always create for visibility control)
  sections.push(
    createSection({
      id: `section-prerequisites-${now + 4}`,
      type: "course-prerequisites",
      variant: "default",
      order: 4,
      visible: isVisible("requirements"),
      content: {
          headline: courseData.sectionHeadlineRequirements ?? "Requirements",
          subheadline: "Before you begin this course",
          prerequisites: courseData.prerequisites,
        } satisfies CoursePrerequisitesSectionContent,
      })
    );

  // 6. FAQ Section (always create for visibility control)
  sections.push(
    createSection({
      id: `section-faq-${now + 5}`,
      type: "faq",
      variant: "default",
      order: 5,
      visible: isVisible("faq"),
      content: {
          headline: courseData.sectionHeadlineFaq ?? "Frequently Asked Questions",
          subheadline: "Find answers to common questions about this course",
          faqs: courseData.faqs.map((f) => ({
            id: f.id,
            question: f.question,
            answer: f.answer,
          })),
        } satisfies FAQSectionContent,
      })
    );

  // 6a. Course Ratings Section (always create for visibility control; content from LMS)
  sections.push(
    createSection({
      id: `section-ratings-${now + 5.4}`,
      type: "course-ratings",
      variant: "default",
      order: 5.4,
      visible: isVisible("ratings"),
      content: {},
    })
  );

  // 6b. Course Recommendations Section (always create for visibility control)
  const recommendations = courseData.recommendations || [];
  sections.push(
    createSection({
      id: `section-recommendations-${now + 5.5}`,
      type: "course-recommendations",
      variant: "default",
      order: 5.5,
      visible: isVisible("recommendations"),
      content: {
          headline: courseData.sectionHeadlineRecommendations ?? "You May Also Like",
          recommendations: recommendations.map((r) => ({
            id: r.id,
            courseId: r.courseId,
            title: r.title,
            slug: r.slug,
            thumbnailUrl: r.thumbnailUrl,
            sortOrder: r.sortOrder ?? 0,
          })),
        } satisfies CourseRecommendationsSectionContent,
      })
    );

  // 7. Instructor Section (always create for visibility control)
  if (instructors) {
    const selectedInstructors =
      courseData.instructorIds
        ?.map((id) => instructors.find((i) => i.id === id))
        .filter((i): i is InstructorData => i !== undefined) ?? [];
    sections.push(
      createSection({
        id: `section-instructor-${now + 6}`,
        type: "course-instructor",
        variant: "default",
        order: 6,
        visible: isVisible("instructor"),
        content: {
          headline: courseData.sectionHeadlineInstructor ?? "Your Instructor",
          subheadline: "Learn from industry experts",
          instructors: selectedInstructors.map((i) => ({
            id: i.id,
            name: i.name,
            role: i.role,
            bio: i.bio,
            avatar: i.avatar,
            rating: i.rating,
            studentsCount: i.students,
          })),
        } satisfies CourseInstructorSectionContent,
      })
    );
  }

  return sections;
}

/**
 * Convert course theme (CourseThemeConfig) to ThemeConfig for LayoutWrapper.
 * Ensures course-specific colors are used instead of admin defaults.
 */
export function courseThemeToThemeConfig(
  courseTheme: CourseFormData["theme"],
  fallback: ThemeConfig
): ThemeConfig {
  if (!courseTheme?.colors?.light) return fallback;
  const light = courseTheme.colors.light;
  const dark = courseTheme.colors.dark || {};
  return {
    id: courseTheme.id || "course-theme",
    name: courseTheme.name || "Course Theme",
    mode: "system",
    colors: {
      light: {
        ...fallback.colors.light,
        primary: light.primary,
        primaryForeground: light.primaryForeground,
        secondary: light.secondary,
        secondaryForeground: light.secondaryForeground,
        accent: light.accent,
        accentForeground: light.accentForeground,
        background: light.background,
        foreground: light.foreground,
        muted: light.muted,
        mutedForeground: light.mutedForeground,
        card: light.card,
        cardForeground: light.cardForeground,
        border: light.border,
        input: light.input,
        ring: light.ring,
      },
      dark: {
        ...fallback.colors.dark,
        primary: dark.primary ?? light.primary,
        primaryForeground: dark.primaryForeground ?? light.primaryForeground,
        background: dark.background ?? fallback.colors.dark.background,
        foreground: dark.foreground ?? fallback.colors.dark.foreground,
        card: dark.card ?? fallback.colors.dark.card,
        cardForeground: dark.cardForeground ?? fallback.colors.dark.cardForeground,
        muted: dark.muted ?? fallback.colors.dark.muted,
        mutedForeground: dark.mutedForeground ?? fallback.colors.dark.mutedForeground,
        border: dark.border ?? fallback.colors.dark.border,
        input: dark.input ?? fallback.colors.dark.input,
      },
    },
    fonts: {
      heading: courseTheme.fonts?.heading ?? fallback.fonts.heading,
      body: courseTheme.fonts?.body ?? fallback.fonts.body,
      headingWeight: courseTheme.fonts?.headingWeight ?? fallback.fonts.headingWeight,
      bodyWeight: courseTheme.fonts?.bodyWeight ?? fallback.fonts.bodyWeight,
    },
    spacing: fallback.spacing,
    borders: {
      ...fallback.borders,
      radius: courseTheme.borderRadius ?? fallback.borders.radius,
    },
  };
}

/**
 * Convert CourseFormData to UpdatePageRequest for saving
 * @param courseData - The course form data
 * @param originalTheme - Optional original theme config to preserve
 * @param categories - Optional array of all available categories (used to map categoryIds to full objects)
 * @param instructors - Optional array of all available instructors (used to map instructorIds to full objects)
 */
export function courseFormDataToUpdateRequest(
  courseData: CourseFormData,
  originalTheme?: ThemeConfig,
  categories?: CategoryData[],
  instructors?: InstructorData[]
): UpdatePageRequest {
  const sections = courseFormDataToSections(courseData, categories, instructors);

  // Convert course theme back to page ThemeConfig format
  const theme: ThemeConfig | undefined = originalTheme || (courseData.theme ? {
    id: courseData.theme.id || "course-theme",
    name: courseData.theme.name || "Course Theme",
    mode: "light" as const,
    colors: {
      light: {
        primary: courseData.theme.colors.light.primary,
        primaryForeground: courseData.theme.colors.light.primaryForeground,
        secondary: courseData.theme.colors.light.secondary,
        secondaryForeground: courseData.theme.colors.light.secondaryForeground,
        accent: courseData.theme.colors.light.accent,
        accentForeground: courseData.theme.colors.light.accentForeground,
        background: courseData.theme.colors.light.background,
        foreground: courseData.theme.colors.light.foreground,
        muted: courseData.theme.colors.light.muted,
        mutedForeground: courseData.theme.colors.light.mutedForeground,
        card: courseData.theme.colors.light.card,
        cardForeground: courseData.theme.colors.light.cardForeground,
        border: courseData.theme.colors.light.border,
        input: courseData.theme.colors.light.input,
        ring: courseData.theme.colors.light.ring,
        destructive: "0 84% 60%",
        destructiveForeground: "0 0% 98%",
        success: "142 76% 36%",
        successForeground: "0 0% 98%",
        warning: "38 92% 50%",
        warningForeground: "0 0% 98%",
      },
      dark: {
        background: courseData.theme.colors.dark.background || "222 47% 11%",
        foreground: courseData.theme.colors.dark.foreground || "210 40% 98%",
        card: courseData.theme.colors.dark.card || "222 47% 14%",
        cardForeground: courseData.theme.colors.dark.cardForeground || "210 40% 98%",
        muted: courseData.theme.colors.dark.muted || "217 33% 17%",
        mutedForeground: courseData.theme.colors.dark.mutedForeground || "215 20% 65%",
        border: courseData.theme.colors.dark.border || "217 33% 17%",
        input: courseData.theme.colors.dark.input || "217 33% 17%",
      },
    },
    fonts: {
      heading: courseData.theme.fonts.heading,
      body: courseData.theme.fonts.body,
      headingWeight: courseData.theme.fonts.headingWeight,
      bodyWeight: courseData.theme.fonts.bodyWeight,
    },
    spacing: {
      sectionPaddingY: "4rem",
      sectionPaddingX: "1.5rem",
      containerMaxWidth: "1280px",
      gap: "1rem",
      gapLg: "2rem",
    },
    borders: {
      radius: courseData.theme.borderRadius,
      radiusSm: "calc(var(--radius) - 4px)",
      radiusMd: "calc(var(--radius) - 2px)",
      radiusLg: "var(--radius)",
      radiusFull: "9999px",
    },
  } : undefined);

  return {
    title: courseData.title,
    sections,
    theme,
    seo: {
      title: courseData.title,
      description: courseData.subTitle || courseData.description,
      keywords: [],
    },
  };
}
