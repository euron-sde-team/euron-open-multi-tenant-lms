/**
 * Course Data Converter Utilities
 * 
 * Converts Page (from API) to CourseFormData for template rendering
 */

import type {
  CourseFormData,
  CourseMode,
  CourseLanguage,
  CoursePreviewVideo,
} from "../types/course";
import { getDefaultCourseFormData } from "../types/course";
import type { ContentPrice } from "../types/currency";
import type { PageConfig } from "../types/page";
import { decodeHtmlEntities } from "./format";

const dh = decodeHtmlEntities;

// ============ Helper Types for Section Content ============

interface CourseHeroSectionContent {
  title?: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  thumbnailAlt?: string;
  mode?: CourseMode;
  duration?: string;
  language?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  currency?: string;
  prices?: ContentPrice[];
  rating?: number;
  studentsCount?: number;
  category?: string;
  categoryIcon?: string;
  enrollCta?: { text: string; href: string };
  previewVideoUrl?: string;
}

interface CourseCurriculumSectionContent {
  headline?: string;
  subheadline?: string;
  sections?: Array<{
    id: string;
    title: string;
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

/**
 * Convert a PageConfig (from API) to CourseFormData (for template rendering)
 * Extracts data from page sections into the flat CourseFormData structure
 */
export function pageConfigToCourseFormData(page: PageConfig): CourseFormData {
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

  // Extract data from each section type
  for (const section of page.sections) {
    if (!section.visible || section.deleted) continue;

    switch (section.type) {
      case "course-hero": {
        const content = section.content as CourseHeroSectionContent;
        if (content) {
          courseData.title = dh(content.title) || courseData.title;
          courseData.subTitle = dh(content.subtitle) || courseData.subTitle;
          courseData.description = dh(content.description) || courseData.description;
          courseData.webThumbnailUrl = content.thumbnail || courseData.webThumbnailUrl;
          courseData.mobileThumbnailUrl = content.thumbnail || courseData.mobileThumbnailUrl;
          courseData.mode = (content.mode as CourseMode) || courseData.mode;
          courseData.duration = content.duration || courseData.duration;
          courseData.language = (content.language as CourseLanguage) || courseData.language;
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
        }
        break;
      }

      case "course-curriculum": {
        const content = section.content as CourseCurriculumSectionContent;
        if (content?.sections) {
          courseData.sections = content.sections.map((s, index) => {
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
        break;
      }

      case "course-learning-outcomes": {
        const content = section.content as CourseLearningOutcomesSectionContent;
        if (content?.outcomes) {
          courseData.learningOutcomes = content.outcomes.map((o) => dh(o));
        }
        break;
      }

      case "course-prerequisites": {
        const content = section.content as CoursePrerequisitesSectionContent;
        if (content?.prerequisites) {
          courseData.prerequisites = content.prerequisites.map((p) => dh(p));
        }
        break;
      }

      case "course-instructor": {
        const content = section.content as CourseInstructorSectionContent;
        if (content?.instructors) {
          courseData.instructorIds = content.instructors.map((i) => i.id);
        }
        break;
      }
    }
  }

  return courseData;
}

/**
 * Check if a page slug represents a course page
 */
export function isCoursePageSlug(slug: string): boolean {
  return slug.startsWith("courses/");
}

/**
 * Extract the course slug from a full page slug
 */
export function extractCourseSlug(pageSlug: string): string {
  if (pageSlug.startsWith("courses/")) {
    return pageSlug.substring("courses/".length);
  }
  return pageSlug;
}
