/**
 * Course Data Converter for Web App
 * 
 * Converts PageConfig to CourseFormData for template rendering
 */

import {
  decodeHtmlEntities,
  type ContentPrice,
  type PageConfig,
  type CourseFormData,
  type CourseMode,
  type CourseLanguage,
  type CoursePreviewVideo,
} from "@open-mtlms/shared";

const dh = decodeHtmlEntities;

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
  /** API-injected from courses table (DB source of truth) */
  webPriceINR?: number;
  webPriceUSD?: number;
  mobilePriceINR?: number;
  mobilePriceUSD?: number;
  webDiscount?: number;
  mobileDiscount?: number;
  /** Multi-currency price book, API-injected from the DB (merged view, enabled currencies only) */
  prices?: ContentPrice[];
  purchaseMode?: "FREE" | "PAID";
  rating?: number;
  ratingTotalCount?: number;
  studentsCount?: number;
  category?: string;
  categoryIcon?: string;
  enrollCta?: { text: string; href: string };
  previewVideoUrl?: string;
  // Category data from admin
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

// Default course theme
const defaultTheme = {
  id: "plus",
  name: "Plus",
  description: "Default modern theme",
  colors: {
    light: {
      primary: "174 58% 39%",
      primaryForeground: "0 0% 100%",
      secondary: "215 20% 65%",
      secondaryForeground: "222 47% 11%",
      accent: "174 58% 39%",
      accentForeground: "0 0% 100%",
      background: "0 0% 100%",
      foreground: "222 47% 11%",
      muted: "210 40% 96%",
      mutedForeground: "215 16% 47%",
      card: "0 0% 100%",
      cardForeground: "222 47% 11%",
      border: "214 32% 91%",
      input: "214 32% 91%",
      ring: "174 58% 39%",
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
  borderRadius: "0.5rem",
};

/**
 * Convert a PageConfig to CourseFormData for template rendering
 */
export function convertPageConfigToCourseData(page: PageConfig): CourseFormData {
  // Start with defaults
  const courseData: CourseFormData = {
    id: page.id, // WARNING: This is a tenant_pages ID, NOT courses table ID. Use resolvedCourseId for checkout/cart APIs.
    tenantId: page.tenantId,
    title: dh(page.title),
    slug: page.slug,
    subTitle: "",
    description: "",
    duration: "",
    mode: "SELF_PACED",
    type: "NORMAL",
    difficulty: "NONE",
    purchaseMode: "PAID",
    validityDays: 365,
    status: "PUBLISHED",
    language: "English",
    weight: 0,
    isYoungCourse: false,
    individualPricing: false,
    webPriceINR: 0,
    mobilePriceINR: 0,
    webPriceUSD: 0,
    mobilePriceUSD: 0,
    webDiscount: 0,
    mobileDiscount: 0,
    webThumbnailUrl: "",
    mobileThumbnailUrl: "",
    previewUrl: "",
    learningOutcomes: [],
    prerequisites: [],
    sections: [],
    offerings: [],
    faqs: [],
    recommendations: [],
    instructorIds: [],
    categoryIds: [],
    theme: defaultTheme,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };

  // Apply theme if present
  if (page.theme) {
    courseData.theme = {
      id: "page-theme",
      name: "Page Theme",
      description: "Theme from page",
      colors: {
        light: {
          primary: page.theme.colors?.light?.primary || defaultTheme.colors.light.primary,
          primaryForeground: page.theme.colors?.light?.primaryForeground || defaultTheme.colors.light.primaryForeground,
          secondary: page.theme.colors?.light?.secondary || defaultTheme.colors.light.secondary,
          secondaryForeground: page.theme.colors?.light?.secondaryForeground || defaultTheme.colors.light.secondaryForeground,
          accent: page.theme.colors?.light?.accent || defaultTheme.colors.light.accent,
          accentForeground: page.theme.colors?.light?.accentForeground || defaultTheme.colors.light.accentForeground,
          background: page.theme.colors?.light?.background || defaultTheme.colors.light.background,
          foreground: page.theme.colors?.light?.foreground || defaultTheme.colors.light.foreground,
          muted: page.theme.colors?.light?.muted || defaultTheme.colors.light.muted,
          mutedForeground: page.theme.colors?.light?.mutedForeground || defaultTheme.colors.light.mutedForeground,
          card: page.theme.colors?.light?.card || defaultTheme.colors.light.card,
          cardForeground: page.theme.colors?.light?.cardForeground || defaultTheme.colors.light.cardForeground,
          border: page.theme.colors?.light?.border || defaultTheme.colors.light.border,
          input: page.theme.colors?.light?.input || defaultTheme.colors.light.input,
          ring: page.theme.colors?.light?.ring || defaultTheme.colors.light.ring,
        },
        dark: {
          background: page.theme.colors?.dark?.background || defaultTheme.colors.dark.background,
          foreground: page.theme.colors?.dark?.foreground || defaultTheme.colors.dark.foreground,
          card: page.theme.colors?.dark?.card || defaultTheme.colors.dark.card,
          cardForeground: page.theme.colors?.dark?.cardForeground || defaultTheme.colors.dark.cardForeground,
          muted: page.theme.colors?.dark?.muted || defaultTheme.colors.dark.muted,
          mutedForeground: page.theme.colors?.dark?.mutedForeground || defaultTheme.colors.dark.mutedForeground,
          border: page.theme.colors?.dark?.border || defaultTheme.colors.dark.border,
          input: page.theme.colors?.dark?.input || defaultTheme.colors.dark.input,
        },
      },
      fonts: {
        heading: page.theme.fonts?.heading || defaultTheme.fonts.heading,
        body: page.theme.fonts?.body || defaultTheme.fonts.body,
        headingWeight: page.theme.fonts?.headingWeight || defaultTheme.fonts.headingWeight,
        bodyWeight: page.theme.fonts?.bodyWeight || defaultTheme.fonts.bodyWeight,
      },
      borderRadius: page.theme.borders?.radius || defaultTheme.borderRadius,
    };
  }

  // Build sectionVisibility from all sections (for template to hide sections)
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
  const sectionVisibility: Record<string, boolean> = {};
  for (const section of page.sections) {
    if (section.deleted) continue;
    const key = SECTION_TYPE_TO_KEY[section.type];
    if (key) sectionVisibility[key] = section.visible !== false;
    const heroSettings = section.settings as { __descriptionVisible?: boolean; __ratingVisible?: boolean } | undefined;
    if (section.type === "course-hero") {
      sectionVisibility.description = heroSettings?.__descriptionVisible !== false;
      sectionVisibility.heroRating = heroSettings?.__ratingVisible !== false;
    }
  }
  if (Object.keys(sectionVisibility).length > 0) {
    courseData.sectionVisibility = sectionVisibility;
  }

  // Extract data from visible sections only (hidden sections not shown on web)
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
          courseData.difficulty = (content.difficulty as CourseFormData["difficulty"]) || courseData.difficulty;
          courseData.duration = content.duration || courseData.duration;
          courseData.language = (content.language as CourseLanguage) || courseData.language;
          courseData.previewUrl = content.previewVideoUrl || courseData.previewUrl;
          
          // Pricing, prefer API-injected values (DB source of truth), fallback to legacy page-stored values
          if (content.webPriceINR !== undefined) {
            courseData.webPriceINR = content.webPriceINR;
            courseData.mobilePriceINR = content.mobilePriceINR ?? content.webPriceINR;
          } else if (content.price !== undefined) {
            courseData.webPriceINR = content.price;
            courseData.mobilePriceINR = content.price;
          }
          if (content.webPriceUSD !== undefined) {
            courseData.webPriceUSD = content.webPriceUSD;
            courseData.mobilePriceUSD = content.mobilePriceUSD ?? content.webPriceUSD;
          }
          if (content.webDiscount !== undefined) {
            courseData.webDiscount = content.webDiscount;
            courseData.mobileDiscount = content.mobileDiscount ?? content.webDiscount;
          } else if (content.discount !== undefined) {
            courseData.webDiscount = content.discount;
            courseData.mobileDiscount = content.discount;
          }
          // Multi-currency price book (API-injected from the DB, like the
          // legacy fields above). Without this, items priced only in non-INR/USD
          // currencies render "Not available for purchase".
          if (Array.isArray(content.prices) && content.prices.length > 0) {
            courseData.prices = content.prices;
          }
          if (content.purchaseMode) {
            courseData.purchaseMode = content.purchaseMode;
          } else {
            const hasBookPrice = (courseData.prices ?? []).some((p) => p.amount > 0);
            courseData.purchaseMode =
              courseData.webPriceINR > 0 || courseData.webPriceUSD > 0 || hasBookPrice
                ? "PAID"
                : "FREE";
          }
          
          // Category data
          if (content.categoryIds) {
            courseData.categoryIds = content.categoryIds;
          }
          
          // Editable labels stored in hero section
          if (content.descriptionHeadline) {
            courseData.sectionHeadlineDescription = dh(content.descriptionHeadline);
          }
          if (content.pricingPlusHeadline) {
            courseData.pricingPlusHeadline = dh(content.pricingPlusHeadline);
          }
          if (content.pricingPlusSubtext) {
            courseData.pricingPlusSubtext = dh(content.pricingPlusSubtext);
          }
          if (content.pricingGuaranteeText) {
            courseData.pricingGuaranteeText = dh(content.pricingGuaranteeText);
          }
          if (content.validityDays !== undefined) {
            // null = lifetime; preserve it. Ignore only invalid non-positive numbers.
            courseData.validityDays =
              content.validityDays === null || content.validityDays > 0
                ? content.validityDays
                : courseData.validityDays;
          }
          if (content.rating !== undefined) courseData.rating = content.rating;
          if (content.ratingTotalCount !== undefined) courseData.ratingTotalCount = content.ratingTotalCount;
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

      case "faq":
      case "faq-accordion": {
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

  return courseData;
}

/**
 * Extract instructors directly from page config sections
 * Returns instructor objects that can be passed directly to CourseProvider
 */
export function extractInstructorsFromPageConfig(page: PageConfig): Array<{
  id: string;
  name: string;
  role: string;
  company?: string;
  avatar?: string;
  bio?: string;
  rating?: number;
  students?: number;
  courses?: number;
}> {
  const instructors: Array<{
    id: string;
    name: string;
    role: string;
    company?: string;
    avatar?: string;
    bio?: string;
    rating?: number;
    students?: number;
    courses?: number;
  }> = [];

  for (const section of page.sections) {
    if (!section.visible || section.deleted) continue;

    if (section.type === "course-instructor") {
      const content = section.content as CourseInstructorSectionContent;
      if (content?.instructors) {
        for (const instructor of content.instructors) {
          instructors.push({
            id: instructor.id,
            name: dh(instructor.name),
            role: dh(instructor.role),
            avatar: instructor.avatar,
            bio: dh(instructor.bio),
            rating: instructor.rating,
            students: instructor.studentsCount,
          });
        }
      }
    }
  }

  return instructors;
}

/**
 * Extract categories directly from page config sections (from course-hero)
 * Returns category objects that can be passed directly to CourseProvider
 */
export function extractCategoriesFromPageConfig(page: PageConfig): Array<{
  id: string;
  name: string;
  icon?: string;
}> {
  for (const section of page.sections) {
    if (!section.visible || section.deleted) continue;

    if (section.type === "course-hero") {
      const content = section.content as CourseHeroSectionContent;
      if (content?.categories && content.categories.length > 0) {
        return content.categories.map((c) => ({
          id: c.id,
          name: dh(c.name),
          icon: c.icon,
        }));
      }
    }
  }

  return [];
}
