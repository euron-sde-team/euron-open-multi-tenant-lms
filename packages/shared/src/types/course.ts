// Course Types - Complete course management system types

import type { ContentPrice } from "./currency";

// ============ ENUMS ============

export type CourseMode = "LIVE" | "SELF_PACED" | "HYBRID";
export type CourseType = "NORMAL" | "PROJECT" | "WEBINAR" | "SHORTS";
export type CoursePurchaseMode = "FREE" | "PAID";
export type CourseStatus = "PUBLISHED" | "NOT_PUBLISHED" | "DRAFT";
export type CourseLanguage = 
  | "English" 
  | "Hindi" 
  | "Marathi" 
  | "Kannada" 
  | "Tamil" 
  | "Telugu" 
  | "Malayalam" 
  | "Bengali";

export type CourseDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "NONE";

export const COURSE_DIFFICULTIES: { value: CourseDifficulty; label: string }[] = [
  { value: "NONE", label: "None / N/A" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

// ============ THEME TYPES ============

export interface CourseThemeColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  input: string;
  ring: string;
}

export interface CourseThemeFonts {
  heading: string;
  body: string;
  headingWeight: string;
  bodyWeight: string;
}

export interface CourseThemeConfig {
  id: string;
  name: string;
  description: string;
  colors: {
    light: CourseThemeColors;
    dark: Partial<CourseThemeColors>;
  };
  fonts: CourseThemeFonts;
  borderRadius: string;
}

export interface CourseThemePreset {
  id: string;
  name: string;
  description: string;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
  config: CourseThemeConfig;
}

// ============ CONTENT TYPES ============

/**
 * A video attached to a syllabus item so prospective students can watch a
 * sample before buying. Held on the landing page's curriculum JSON rather than
 * in a table, so the public playback endpoint can authorise against exactly the
 * same record the page renders from and the two can never drift apart.
 */
export interface CoursePreviewVideo {
  /** Provider-side id: an EVS video id, or an external HLS / MP4 / YouTube URL. */
  videoKey: string;
  /** Resolved at play time when absent, so an admin never has to pick it. */
  provider?: "YOUTUBE" | "EVS" | "HLS" | "MP4";
  /** Shown on the play control; falls back to the lecture title. */
  title?: string;
  duration?: string;
  /** Lecture the video was picked from in the asset library, for traceability. */
  sourceLectureId?: string;
}

export interface CourseLecture {
  id: string;
  title: string;
  order: number;
  duration?: string;
  previewUrl?: string;
  videoUrl?: string;
  description?: string;
  /** Free sample playable by logged-out visitors. */
  previewVideo?: CoursePreviewVideo;
}

export interface CourseModuleData {
  id: string;
  title: string;
  order: number;
  lectures: CourseLecture[];
}

export interface CourseSectionData {
  id: string;
  title: string;
  order: number;
  /** @deprecated Use modules instead. Kept for backward compat during migration. */
  subtopics?: CourseLecture[];
  modules: CourseModuleData[];
}

export interface CourseOfferingData {
  id: string;
  icon: string;
  text: string;
}

export interface CourseFAQData {
  id: string;
  question: string;
  answer: string;
}

export interface CourseRecommendationData {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  thumbnailUrl?: string;
  sortOrder?: number;
}

export interface CourseInstructor {
  id: string;
  name: string;
  role: string;
  bio?: string;
  avatar?: string;
  socialLinks?: {
    platform: string;
    url: string;
  }[];
}

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  icon?: string;
}

// ============ MAIN COURSE FORM DATA ============

export interface CourseFormData {
  // Basic Information
  /** Page ID from `tenant_pages` table: NOT the `courses` table ID. Do not use for checkout/cart/enrollment APIs. */
  id?: string;
  title: string;
  subTitle: string;
  slug: string;
  description: string;
  duration: string;
  
  // Course Settings
  mode: CourseMode;
  type: CourseType;
  /** Difficulty level. NONE = do not show on frontend. */
  difficulty: CourseDifficulty;
  purchaseMode: CoursePurchaseMode;
  status: CourseStatus;
  language: CourseLanguage;
  /** Multiple languages (backend: language[]). Shown comma-separated in UI. */
  languages?: string[];
  weight: number;
  isYoungCourse: boolean;
  individualPricing: boolean;
  
  
  /** Access validity in days after purchase (default 365). null = lifetime (no expiry). */
  validityDays: number | null;

  // Pricing
  webPriceINR: number;
  mobilePriceINR: number;
  webPriceUSD: number;
  mobilePriceUSD: number;
  webDiscount: number;
  mobileDiscount: number;
  /**
   * Multi-currency price book (one entry per tenant-enabled currency).
   * INR/USD entries are mirrored into the legacy fields above on save;
   * undefined means the course predates multi-currency (legacy fields rule).
   */
  prices?: ContentPrice[];
  
  // Media (URLs for display; keys for save when using S3)
  webThumbnailUrl: string;
  mobileThumbnailUrl: string;
  previewUrl: string;
  /** S3 key for web thumbnail (sent on save when using S3) */
  thumbnailKey?: string | null;
  /** S3 key for mobile thumbnail (sent on save when using S3) */
  secondaryThumbnailKey?: string | null;
  /** S3 key for preview media (sent on save when using S3) */
  previewKey?: string | null;
  
  // Content Arrays
  learningOutcomes: string[];
  prerequisites: string[];
  sections: CourseSectionData[];
  offerings: CourseOfferingData[];
  faqs: CourseFAQData[];
  recommendations: CourseRecommendationData[];
  
  // Instructors/Mentors (multiple allowed)
  instructorIds: string[];
  
  // Categories (multiple allowed, last one shown in UI)
  categoryIds: string[];
  
  /** Section visibility - hide/show sections on course page. Keys: learningOutcomes, curriculum, offerings, requirements, description, instructor, faq, recommendations. Default true when undefined. */
  sectionVisibility?: Record<string, boolean>;

  /** Course rating (1-5) - from LMS avg or admin override. Displayed in hero. */
  rating?: number;
  /** Total number of ratings - from LMS when no override. For "X ratings" display. */
  ratingTotalCount?: number;

  // Section Headlines (editable labels for course detail page sections)
  sectionHeadlineLearningOutcomes?: string;
  sectionHeadlineCourseContent?: string;
  sectionHeadlineOfferings?: string;
  sectionHeadlineRequirements?: string;
  sectionHeadlineDescription?: string;
  sectionHeadlineInstructor?: string;
  sectionHeadlineFaq?: string;
  sectionHeadlineRecommendations?: string;
  
  // Pricing Card Labels (editable text for the pricing card)
  pricingPlusHeadline?: string;
  pricingPlusSubtext?: string;
  pricingGuaranteeText?: string;
  
  // Theme
  theme: CourseThemeConfig;
  
  // Metadata
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============ TEMPLATE TYPES ============

export interface CourseTemplateConfig {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  mode: CourseMode;
  type: CourseType;
  defaultTheme: CourseThemeConfig;
  defaultContent: Partial<CourseFormData>;
}

// ============ DEFAULT VALUES ============

export const DEFAULT_COURSE_LANGUAGE: CourseLanguage = "English";

export const COURSE_LANGUAGES: CourseLanguage[] = [
  "English",
  "Hindi",
  "Marathi",
  "Kannada",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Bengali",
];

export const COURSE_MODES: { value: CourseMode; label: string }[] = [
  { value: "SELF_PACED", label: "Self-Paced" },
];

export const COURSE_TYPES: { value: CourseType; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "PROJECT", label: "Project" },
];

export const COURSE_STATUSES: { value: CourseStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "NOT_PUBLISHED", label: "Unpublished" },
  { value: "PUBLISHED", label: "Published" },
];

export const PURCHASE_MODES: { value: CoursePurchaseMode; label: string }[] = [
  { value: "FREE", label: "Free" },
  { value: "PAID", label: "Paid" },
];

// ============ ICON OPTIONS FOR OFFERINGS ============

export const OFFERING_ICONS = [
  { value: "video", label: "Video", emoji: "📹" },
  { value: "document", label: "Document", emoji: "📄" },
  { value: "download", label: "Download", emoji: "⬇️" },
  { value: "certificate", label: "Certificate", emoji: "🏆" },
  { value: "live", label: "Live Session", emoji: "🔴" },
  { value: "quiz", label: "Quiz", emoji: "❓" },
  { value: "project", label: "Project", emoji: "💼" },
  { value: "support", label: "Support", emoji: "💬" },
  { value: "lifetime", label: "Lifetime Access", emoji: "♾️" },
  { value: "mobile", label: "Mobile Access", emoji: "📱" },
  { value: "code", label: "Source Code", emoji: "💻" },
  { value: "assignment", label: "Assignment", emoji: "📝" },
];

// ============ HELPER FUNCTIONS ============

export function generateCourseSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Default dummy content for new courses so creation page templates show a full preview */
export const DEFAULT_COURSE_DUMMY_DATA = {
  title: "Complete Course Title",
  subTitle: "A compelling subtitle that describes what students will learn and achieve in this course.",
  description:
    "This is a sample course description. Replace with your actual course overview, key highlights, and what makes this course valuable. You can add multiple paragraphs and format as needed.",
  duration: "8 weeks",
  learningOutcomes: [
    "Master the core concepts and fundamentals",
    "Build real-world projects from scratch",
    "Apply best practices and industry standards",
    "Gain hands-on experience with practical exercises",
    "Prepare for certifications or job interviews",
  ],
  prerequisites: ["Basic computer skills", "No prior experience required"],
  sections: [
    {
      id: "section-dummy-1",
      title: "Introduction & Setup",
      order: 1,
      modules: [
        {
          id: "mod-dummy-1-1",
          title: "Getting Started",
          order: 0,
          lectures: [
            { id: "lec-1-1", title: "Welcome and course overview", order: 0, duration: "5 min" },
            { id: "lec-1-2", title: "Environment setup", order: 1, duration: "12 min" },
            { id: "lec-1-3", title: "Your first exercise", order: 2, duration: "8 min" },
          ],
        },
      ],
    },
    {
      id: "section-dummy-2",
      title: "Core Concepts",
      order: 2,
      modules: [
        {
          id: "mod-dummy-2-1",
          title: "Fundamentals",
          order: 0,
          lectures: [
            { id: "lec-2-1", title: "Understanding the fundamentals", order: 0, duration: "15 min" },
            { id: "lec-2-2", title: "Key principles explained", order: 1, duration: "20 min" },
            { id: "lec-2-3", title: "Practice session", order: 2, duration: "25 min" },
          ],
        },
      ],
    },
    {
      id: "section-dummy-3",
      title: "Advanced Topics",
      order: 3,
      modules: [
        {
          id: "mod-dummy-3-1",
          title: "Deep Dive",
          order: 0,
          lectures: [
            { id: "lec-3-1", title: "Going deeper", order: 0, duration: "18 min" },
            { id: "lec-3-2", title: "Project: Build something real", order: 1, duration: "45 min" },
          ],
        },
      ],
    },
  ] as CourseSectionData[],
  offerings: [
    { id: "off-dummy-1", icon: "video", text: "X hours of video content" },
    { id: "off-dummy-2", icon: "download", text: "Downloadable resources" },
    { id: "off-dummy-3", icon: "certificate", text: "Certificate of completion" },
    { id: "off-dummy-4", icon: "lifetime", text: "Lifetime access" },
  ] as CourseOfferingData[],
  faqs: [
    { id: "faq-dummy-1", question: "Who is this course for?", answer: "This course is designed for beginners and intermediate learners who want to build a strong foundation." },
    { id: "faq-dummy-2", question: "Do I need any prior experience?", answer: "No prior experience is required. We start from the basics and progress step by step." },
    { id: "faq-dummy-3", question: "How long do I have access?", answer: "You get lifetime access to the course content and future updates." },
  ] as CourseFAQData[],
  instructorIds: ["mentor-1"],
  categoryIds: [],
  webPriceINR: 2999,
  mobilePriceINR: 2999,
  webPriceUSD: 39,
  mobilePriceUSD: 39,
  webDiscount: 20,
  mobileDiscount: 20,
};

export function getDefaultCourseFormData(): CourseFormData {
  return {
    title: DEFAULT_COURSE_DUMMY_DATA.title,
    subTitle: DEFAULT_COURSE_DUMMY_DATA.subTitle,
    slug: generateCourseSlug(DEFAULT_COURSE_DUMMY_DATA.title),
    description: DEFAULT_COURSE_DUMMY_DATA.description,
    duration: DEFAULT_COURSE_DUMMY_DATA.duration,
    mode: "SELF_PACED",
    type: "NORMAL",
    difficulty: "NONE",
    purchaseMode: "PAID",
    validityDays: 365,
    status: "DRAFT",
    language: "English",
    languages: ["English"],
    weight: 0,
    isYoungCourse: false,
    individualPricing: false,
    webPriceINR: DEFAULT_COURSE_DUMMY_DATA.webPriceINR,
    mobilePriceINR: DEFAULT_COURSE_DUMMY_DATA.mobilePriceINR,
    webPriceUSD: DEFAULT_COURSE_DUMMY_DATA.webPriceUSD,
    mobilePriceUSD: DEFAULT_COURSE_DUMMY_DATA.mobilePriceUSD,
    webDiscount: DEFAULT_COURSE_DUMMY_DATA.webDiscount,
    mobileDiscount: DEFAULT_COURSE_DUMMY_DATA.mobileDiscount,
    webThumbnailUrl: "",
    mobileThumbnailUrl: "",
    previewUrl: "",
    learningOutcomes: [...DEFAULT_COURSE_DUMMY_DATA.learningOutcomes],
    prerequisites: [...DEFAULT_COURSE_DUMMY_DATA.prerequisites],
    sections: DEFAULT_COURSE_DUMMY_DATA.sections.map((s, si) => ({
      ...s,
      id: `section-${Date.now()}-${si}-${Math.random().toString(36).slice(2, 9)}`,
      modules: s.modules.map((m, mi) => ({
        ...m,
        id: `module-${Date.now()}-${si}-${mi}-${Math.random().toString(36).slice(2, 9)}`,
        lectures: m.lectures.map((l, li) => ({
          ...l,
          id: `lecture-${Date.now()}-${si}-${mi}-${li}-${Math.random().toString(36).slice(2, 9)}`,
        })),
      })),
    })),
    offerings: DEFAULT_COURSE_DUMMY_DATA.offerings.map((o, i) => ({
      ...o,
      id: `offering-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
    })),
    faqs: DEFAULT_COURSE_DUMMY_DATA.faqs.map((f, i) => ({
      ...f,
      id: `faq-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
    })),
    recommendations: [],
    sectionVisibility: {
      recommendations: false,
      ratings: false,
    },
    instructorIds: [...DEFAULT_COURSE_DUMMY_DATA.instructorIds],
    categoryIds: [...DEFAULT_COURSE_DUMMY_DATA.categoryIds],
    theme: {
      id: "plus",
      name: "Plus",
      description: "Default modern theme – teal/cyan accents like the course detail page",
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
    },
  };
}

export function createCourseLecture(
  title: string,
  order: number
): CourseLecture {
  return {
    id: `lecture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    order,
  };
}

export function createCourseModule(
  title: string,
  order: number
): CourseModuleData {
  return {
    id: `module-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    order,
    lectures: [],
  };
}

export function createCourseSection(
  title: string,
  order: number
): CourseSectionData {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    order,
    modules: [],
  };
}

/** Normalize section to modules format. Migrates legacy subtopics to a single module. */
export function normalizeSectionModules(section: CourseSectionData): CourseSectionData {
  if (section.modules && section.modules.length > 0) return section;
  if (section.subtopics && section.subtopics.length > 0) {
    return {
      ...section,
      modules: [
        {
          id: `module-${section.id}-legacy`,
          title: "Content",
          order: 0,
          lectures: section.subtopics.map((l, i) => ({ ...l, order: i })),
        },
      ],
      subtopics: undefined,
    };
  }
  return { ...section, modules: section.modules ?? [] };
}

export function createCourseOffering(
  icon: string,
  text: string
): CourseOfferingData {
  return {
    id: `offering-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    icon,
    text,
  };
}

export function createCourseFAQ(
  question: string,
  answer: string
): CourseFAQData {
  return {
    id: `faq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    question,
    answer,
  };
}

export function createCourseRecommendation(
  courseId: string,
  title: string,
  slug: string,
  thumbnailUrl?: string,
  sortOrder?: number
): CourseRecommendationData {
  return {
    id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    courseId,
    title,
    slug,
    thumbnailUrl,
    sortOrder: sortOrder ?? 0,
  };
}
