import type { SectionConfig, SectionType, ThemeConfig, SEOConfig } from "@open-mtlms/shared";
import { defaultThemeConfig, mindfulnessThemeConfig, getDefaultContent, getThemePreset } from "@open-mtlms/ui-config";

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  category: "landing" | "app" | "marketing" | "utility";
  pageCategories: string[];
  thumbnail: string;
  sections: SectionConfig[];
  theme: ThemeConfig;
  seo: SEOConfig;
  productCategory?: string;
}

const createSection = (section: {
  type: SectionType;
  variant: string;
  content: Record<string, unknown>;
  visible: boolean;
  order: number;
}): SectionConfig => ({
  id: `${section.type}-${section.order}`,
  type: section.type,
  variant: section.variant,
  content: section.content,
  visible: section.visible,
  order: section.order,
  deleted: false,
  settings: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Helper, shorthand for createSection with default content
// Uses `string` param to allow section types that may not yet be in the SectionType union (e.g. template-specific types)
const s = (type: string, variant: string, order: number, contentOverrides?: Record<string, unknown>) =>
  createSection({ type: type as SectionType, variant, content: { ...(getDefaultContent(type as SectionType) as Record<string, unknown>), ...contentOverrides }, visible: true, order });

// Single basic template for home page
const basicPageTemplate: PageTemplate = {
  id: "basic",
  name: "Basic Landing",
  description: "Simple landing page with hero, features, testimonials, about, CTA and course listing",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
  sections: [
    s("hero", "centered", 0, { headline: "Transform Your Knowledge Into a Thriving Business", subheadline: "Create, sell, and scale your digital products with our all-in-one platform" }),
    s("all-courses-listing", "scroll", 1),
    s("features-grid", "3-col", 2),
    s("self-paced-courses-listing", "scroll", 4),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("books-listing", "scroll", 7),
    s("testimonials-scroll-code-tech", "default", 8),
    s("bundles-listing", "scroll", 9),
    s("cta-banner", "simple", 10),
  ],
  theme: defaultThemeConfig,
  seo: {
    title: "Basic Landing",
    description: "Simple landing page with hero, features, testimonials, about, CTA and course listing",
  },
};

// Code & Technology landing page template
const codeTechPageTemplate: PageTemplate = {
  id: "code-tech",
  name: "Code & Technology",
  description: "Immersive dark landing page for coding bootcamps, developer courses, and tech education platforms",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&q=80",
  sections: [
    s("hero-code-tech", "default", 0),
    s("all-courses-listing", "scroll", 1),
    s("categories-listing", "grid", 4),
    s("self-paced-courses-listing", "scroll", 6),
    s("books-listing", "scroll", 9),
    s("bundles-listing", "scroll", 12),
    s("testimonials-scroll-code-tech", "default", 13),
  ],
  theme: defaultThemeConfig,
  seo: {
    title: "Code & Technology",
    description: "Master modern development with project-based courses",
  },
};

// Photography landing page template
const photographyPageTemplate: PageTemplate = {
  id: "photography",
  name: "Photography",
  description:
    "Bold neo-brutalist landing for photography: live & self-paced course listings, books, gallery, and CTAs",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&q=80",
  sections: [
    s("hero-photography", "default", 0),
    s("about-photography", "default", 1),
    s("courses-listing-photography", "default", 2),
    s("features-photography", "default", 3),
    s("books-listing-photography", "default", 4),
    s("gallery-photography", "default", 5),
    s("faq-photography", "default", 6),
    s("cta-photography", "default", 7),
  ],
  theme: getThemePreset("photography-brutalist")?.config ?? defaultThemeConfig,
  seo: {
    title: "Photography",
    description: "Master the art of photography with expert-led courses",
  },
};

// Exam Prep landing page template
const examprepPageTemplate: PageTemplate = {
  id: "examprep",
  name: "IIT JEE / NEET",
  description: "Professional landing page for IIT JEE / NEET coaching platforms with courses, learning paths, and study materials",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&h=600&fit=crop",
  sections: [
    s("hero-examprep", "default", 0),
    s("features-examprep", "default", 1),
    s("self-paced-courses-listing-examprep", "default", 3),
    s("books-listing-examprep", "default", 4),
    s("learning-paths-examprep", "default", 5),
    s("about-examprep", "default", 6),
    s("testimonials-examprep", "default", 7),
    s("faq-examprep", "default", 8),
    s("cta-examprep", "default", 9),
  ],
  theme: getThemePreset("examprep-academic")?.config ?? defaultThemeConfig,
  seo: {
    title: "IIT JEE / NEET",
    description: "Master your competitive exams with expert-led courses, mock tests, and personalized study plans",
  },
};

// Test Prep (All Govt Exams) landing page template
const govtexamPageTemplate: PageTemplate = {
  id: "govtexam",
  name: "Test Prep (All Govt Exams)",
  description: "Professional landing page for government exam preparation: UPSC, SSC, Banking, Railway coaching with courses, learning paths, and study materials",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=600&fit=crop",
  sections: [
    s("hero-govtexam", "default", 0),
    s("trusted-by-govtexam", "default", 1),
    s("exam-categories-govtexam", "default", 2),
    s("self-paced-courses-listing-govtexam", "default", 4),
    s("features-govtexam", "default", 5),
    s("books-listing-govtexam", "default", 6),
    s("about-govtexam", "default", 7),
    s("testimonials-govtexam", "default", 8),
    s("faq-govtexam", "default", 9),
    s("cta-govtexam", "default", 10),
  ],
  theme: getThemePreset("govtexam-warm")?.config ?? defaultThemeConfig,
  seo: {
    title: "Test Prep (All Govt Exams)",
    description: "Crack UPSC, SSC, Banking, and Railway exams with expert-led courses, mock tests, and comprehensive study materials",
  },
};

// Astrology cosmic landing page template
const astrologyPageTemplate: PageTemplate = {
  id: "astrology",
  name: "Astrology",
  description:
    "Cosmic celestial landing for astrology: live & self-paced courses, services, books, testimonials, and CTA",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200&q=80",
  sections: [
    s("hero-astrology", "default", 0),
    s("about-astrology", "default", 1),
    s("courses-listing-astrology", "default", 2),
    s("services-astrology", "default", 3),
    s("books-listing-astrology", "default", 4),
    s("testimonials-astrology", "default", 5),
    s("faq-astrology", "default", 6),
    s("cta-astrology", "default", 7),
  ],
  theme: getThemePreset("astrology-cosmic")?.config ?? defaultThemeConfig,
  seo: {
    title: "Astrology",
    description: "Discover the cosmos with expert astrology courses and celestial readings",
  },
};

// Corporate Upskilling landing page template
const corpupskillPageTemplate: PageTemplate = {
  id: "corpupskill",
  name: "Corporate Upskilling",
  description:
    "Corporate training landing: hero, trusted brands, features, live & self-paced courses, books, analytics, testimonials, CTA",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=600&fit=crop",
  sections: [
    s("hero-corpupskill", "default", 0),
    s("trusted-by-corpupskill", "default", 1),
    s("features-split-corpupskill", "default", 2),
    s("self-paced-courses-listing-corpupskill", "default", 4),
    s("books-listing-corpupskill", "default", 5),
    s("analytics-corpupskill", "default", 6),
    s("testimonials-corpupskill", "default", 7),
    s("cta-corpupskill", "default", 8),
  ],
  theme: getThemePreset("corpupskill-slate")?.config ?? defaultThemeConfig,
  seo: {
    title: "Corporate Upskilling",
    description: "Transform your workforce with expert-led training, certifications, and personalized learning paths for career growth",
  },
};

// About Us page template
const aboutUsPageTemplate: PageTemplate = {
  id: "about-us",
  name: "About Us",
  description: "Complete about us page with hero, mission, offerings, values, and contact sections",
  category: "landing",
  pageCategories: ["about"],
  thumbnail: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80",
  sections: [
    s("about-us-hero", "default", 0),
    s("about-us-mission", "default", 1),
    s("about-us-offerings", "default", 2),
    s("about-us-values", "default", 3),
    s("about-us-contact", "default", 4),
  ],
  theme: defaultThemeConfig,
  seo: {
    title: "About Us",
    description: "Learn about our mission, values, and what we offer",
  },
};

// Contact Us page template
const contactUsPageTemplate: PageTemplate = {
  id: "contact-us",
  name: "Contact Us",
  description: "Complete contact page with hero, info cards, contact form, and FAQ",
  category: "landing",
  pageCategories: ["contact"],
  thumbnail: "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?w=1200&q=80",
  sections: [
    s("contact-us-hero", "default", 0),
    s("contact-us-info", "default", 1),
    s("contact-us-form", "default", 2),
  ],
  theme: defaultThemeConfig,
  seo: {
    title: "Contact Us",
    description: "Get in touch with us, we'd love to hear from you",
  },
};

// FAQ page template
const faqPageTemplate: PageTemplate = {
  id: "faq-us",
  name: "FAQ",
  description: "FAQ page with hero and expandable question list",
  category: "landing",
  pageCategories: ["faq"],
  thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
  sections: [
    s("faq-us-hero", "default", 0),
    s("faq-us-list", "default", 1),
  ],
  theme: defaultThemeConfig,
  seo: {
    title: "FAQ",
    description: "Frequently asked questions, everything you need to know",
  },
};

// Privacy Policy page template
const privacyPageTemplate: PageTemplate = {
  id: "privacy-us",
  name: "Privacy Policy",
  description: "Privacy policy page with hero and expandable policy sections",
  category: "landing",
  pageCategories: ["privacy"],
  thumbnail: "https://images.unsplash.com/photo-1633265486064-086b219458ec?w=1200&q=80",
  sections: [
    s("privacy-us-hero", "default", 0),
    s("privacy-us-content", "default", 1),
  ],
  theme: defaultThemeConfig,
  seo: {
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal information",
  },
};

// Terms of Service page template
const termsPageTemplate: PageTemplate = {
  id: "terms-us",
  name: "Terms of Service",
  description: "Terms of service page with hero and numbered policy sections",
  category: "landing",
  pageCategories: ["terms"],
  thumbnail: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80",
  sections: [
    s("terms-us-hero", "default", 0),
    s("terms-us-content", "default", 1),
  ],
  theme: defaultThemeConfig,
  seo: {
    title: "Terms of Service",
    description: "Your rights, responsibilities, and how our platform works",
  },
};

// System-only templates (not shown in All Templates modal), for login and profile flows
const profilePageTemplate: PageTemplate = {
  id: "profile-minimal",
  name: "Profile",
  description: "User profile page",
  category: "utility",
  pageCategories: ["profile"],
  thumbnail: "",
  sections: [
    createSection({
      type: "member-profile" as SectionType,
      variant: "default",
      content: getDefaultContent("member-profile") as Record<string, unknown>,
      visible: true,
      order: 0,
    }),
  ],
  theme: defaultThemeConfig,
  seo: { title: "Profile", description: "Your account profile" },
};

const loginPageTemplate: PageTemplate = {
  id: "login-minimal",
  name: "Login",
  description: "Minimal login form",
  category: "utility",
  pageCategories: ["login"],
  thumbnail: "",
  sections: [
    createSection({
      type: "login-form" as SectionType,
      variant: "centered",
      content: getDefaultContent("login-form") as Record<string, unknown>,
      visible: true,
      order: 0,
    }),
  ],
  theme: defaultThemeConfig,
  seo: { title: "Login", description: "Sign in to your account" },
};


// Mindfulness landing page template
const mindfulnessPageTemplate: PageTemplate = {
  id: "mindfulness",
  name: "Mindfulness & Wellness",
  description: "Serene landing page for mindfulness, meditation, yoga, and wellness platforms",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80",
  sections: [
    s("hero-mindfulness", "default", 0),
    s("all-courses-listing", "scroll", 1),
    s("teach-mindfulness", "default", 2),
    s("categories-listing", "grid", 4),
    s("how-it-works-mindfulness", "default", 5),
    s("self-paced-courses-listing", "scroll", 6),
    s("books-listing", "scroll", 7),
    s("testimonials-mindfulness", "default", 8),
    s("bundles-listing", "scroll", 9),
    s("roadmap-mindfulness", "default", 10),
    s("cta-mindfulness", "default", 11),
  ],
  theme: mindfulnessThemeConfig,
  seo: {
    title: "Mindfulness & Wellness",
    description: "Find your path to inner peace through expert-led meditation, breathwork, and mindfulness courses",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Themed vertical templates. Each reuses the shared section components (so
// navigation, redirects and buttons behave exactly like every other template)
// and only swaps the theme palette + curated copy + section arrangement.
// Multiple presets share one theme to offer "variants" of the same look.
// ─────────────────────────────────────────────────────────────────────────────

// Culinary, variant 1: classic
const cookingPageTemplate: PageTemplate = {
  id: "cooking",
  name: "Cooking Academy",
  description: "Warm culinary landing page for cooking, baking and food-business academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80",
  sections: [
    s("hero-cooking", "default", 0),
    s("recipes-cooking", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("features-cooking", "default", 3),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("books-listing", "scroll", 8),
    s("testimonials-cooking", "default", 9),
    s("bundles-listing", "scroll", 10),
    s("cta-cooking", "default", 11),
  ],
  theme: getThemePreset("culinary-warmth")?.config ?? defaultThemeConfig,
  seo: { title: "Cooking Academy", description: "Master recipes and culinary skills with expert-led online cooking courses" },
};

// Culinary, variant 2: showcase (features-forward)
const cookingStudioPageTemplate: PageTemplate = {
  id: "cooking-studio",
  name: "Cooking Studio",
  description: "Feature-forward culinary landing page variant with a bold showcase layout",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=1200&q=80",
  sections: [
    s("hero-cooking-alt", "default", 0),
    s("features-cooking", "default", 1),
    s("categories-listing", "grid", 2),
    s("all-courses-listing", "scroll", 3),
    s("recipes-cooking", "default", 4),
    s("testimonials-cooking", "default", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("books-listing", "scroll", 8),
    s("cta-cooking", "default", 9),
  ],
  theme: getThemePreset("culinary-warmth")?.config ?? defaultThemeConfig,
  seo: { title: "Cooking Studio", description: "Hands-on cooking courses, live classes and recipe libraries" },
};

// Fitness, variant 1: bold
const fitnessPageTemplate: PageTemplate = {
  id: "fitness",
  name: "Fitness & Sports",
  description: "High-energy landing page for fitness, sports and online coaching platforms",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
  sections: [
    s("hero-fitness", "default", 0),
    s("programs-fitness", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("features-fitness", "default", 3),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("testimonials-fitness", "default", 8),
    s("bundles-listing", "scroll", 9),
    s("cta-fitness", "default", 10),
  ],
  theme: getThemePreset("athletic-energy")?.config ?? defaultThemeConfig,
  seo: { title: "Fitness & Sports", description: "Train with expert-led online fitness, sports and coaching programs" },
};

// Fitness, variant 2: clean
const fitnessProPageTemplate: PageTemplate = {
  id: "fitness-pro",
  name: "Fitness Pro",
  description: "Clean, focused fitness landing page variant for personal trainers and studios",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80",
  sections: [
    s("hero-fitness-alt", "default", 0),
    s("features-fitness", "default", 1),
    s("categories-listing", "grid", 2),
    s("all-courses-listing", "scroll", 3),
    s("programs-fitness", "default", 4),
    s("testimonials-fitness", "default", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("cta-fitness", "default", 8),
  ],
  theme: getThemePreset("athletic-energy")?.config ?? defaultThemeConfig,
  seo: { title: "Fitness Pro", description: "Structured online training programs, live sessions and expert coaching" },
};

// Music, variant 1: studio
const musicPageTemplate: PageTemplate = {
  id: "music",
  name: "Music Academy",
  description: "Vibrant landing page for music, audio production and performing-arts academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80",
  sections: [
    s("hero-music", "default", 0),
    s("genres-music", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("features-music", "default", 3),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("books-listing", "scroll", 8),
    s("testimonials-music", "default", 9),
    s("bundles-listing", "scroll", 10),
    s("cta-music", "default", 11),
  ],
  theme: getThemePreset("studio-sound")?.config ?? defaultThemeConfig,
  seo: { title: "Music Academy", description: "Learn instruments, production and performance from working musicians" },
};

// Music, variant 2: vibrant
const musicVibePageTemplate: PageTemplate = {
  id: "music-vibe",
  name: "Music Studio",
  description: "Bold, feature-forward music landing page variant for production studios",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80",
  sections: [
    s("hero-music-alt", "default", 0),
    s("features-music", "default", 1),
    s("categories-listing", "grid", 2),
    s("all-courses-listing", "scroll", 3),
    s("genres-music", "default", 4),
    s("testimonials-music", "default", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("cta-music", "default", 8),
  ],
  theme: getThemePreset("studio-sound")?.config ?? defaultThemeConfig,
  seo: { title: "Music Studio", description: "Production, theory and performance courses for modern musicians" },
};

// Business, variant 1: professional
const businessPageTemplate: PageTemplate = {
  id: "business",
  name: "Business & Corporate",
  description: "Professional landing page for corporate training and B2B learning academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80",
  sections: [
    s("hero-business", "default", 0),
    s("outcomes-business", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("features-business", "default", 3),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("testimonials-business", "default", 8),
    s("bundles-listing", "scroll", 9),
    s("cta-business", "default", 10),
  ],
  theme: getThemePreset("corporate-slate")?.config ?? defaultThemeConfig,
  seo: { title: "Business & Corporate", description: "Corporate training, certifications and analytics on one branded platform" },
};

// Business, variant 2: data-forward
const businessDataPageTemplate: PageTemplate = {
  id: "business-data",
  name: "Corporate Pro",
  description: "Data-forward corporate learning landing page variant with a results-first layout",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
  sections: [
    s("hero-business-alt", "default", 0),
    s("features-business", "default", 1),
    s("categories-listing", "grid", 2),
    s("all-courses-listing", "scroll", 3),
    s("outcomes-business", "default", 4),
    s("testimonials-business", "default", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("cta-business", "default", 8),
  ],
  theme: getThemePreset("corporate-slate")?.config ?? defaultThemeConfig,
  seo: { title: "Corporate Pro", description: "Role-based learning paths, live cohorts and measurable outcomes" },
};

// Arts & Crafts, 3 variants (artisan-craft theme)
const artsCraftsPageTemplate: PageTemplate = {
  id: "arts-crafts",
  name: "Arts & Crafts",
  description: "Warm, handmade landing page for arts, crafts and creative maker academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=1200&q=80",
  sections: [
    s("hero-arts", "default", 0),
    s("gallery-arts", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("features-arts", "default", 3),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("books-listing", "scroll", 8),
    s("testimonials-arts", "default", 9),
    s("bundles-listing", "scroll", 10),
    s("cta-arts", "default", 11),
  ],
  theme: getThemePreset("artisan-craft")?.config ?? defaultThemeConfig,
  seo: { title: "Arts & Crafts", description: "Learn painting, pottery, DIY and handmade skills from expert artisans" },
};

const artsGalleryPageTemplate: PageTemplate = {
  id: "arts-gallery",
  name: "Craft Gallery",
  description: "Showcase-first arts and crafts landing page variant with a gallery layout",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1200&q=80",
  sections: [
    s("hero-arts-alt", "default", 0),
    s("gallery-arts", "default", 1),
    s("features-arts", "default", 2),
    s("categories-listing", "grid", 3),
    s("all-courses-listing", "scroll", 4),
    s("self-paced-courses-listing", "scroll", 6),
    s("books-listing", "scroll", 7),
    s("testimonials-arts", "default", 8),
    s("cta-arts", "default", 9),
  ],
  theme: getThemePreset("artisan-craft")?.config ?? defaultThemeConfig,
  seo: { title: "Craft Gallery", description: "Hands-on art and craft courses with a showcase-first layout" },
};

const artsPlayfulPageTemplate: PageTemplate = {
  id: "arts-playful",
  name: "Creative Studio",
  description: "Minimal, beginner-friendly arts and crafts landing page variant",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?w=1200&q=80",
  // Distinct look from Arts & Crafts: a dedicated immersive studio hero
  // (drifting paint splashes) + a brighter coral theme.
  sections: [
    s("hero-arts-v3", "default", 0),
    s("features-arts", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("gallery-arts", "default", 3),
    s("about", "simple", 4),
    s("testimonials-arts", "default", 5),
    s("cta-arts", "default", 6),
  ],
  theme: getThemePreset("coral-warm")?.config ?? defaultThemeConfig,
  seo: { title: "Creative Studio", description: "Fun, beginner-friendly art and craft courses for every skill level" },
};

// Kids & School, 3 variants (kids-bright theme)
const kidsPageTemplate: PageTemplate = {
  id: "kids",
  name: "Kids Learning",
  description: "Bright, friendly landing page for kids learning, school and tutoring academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1587616211892-f743fcca64f9?w=1200&q=80",
  sections: [
    s("hero-kids", "default", 0),
    s("path-kids", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("features-kids", "default", 3),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("books-listing", "scroll", 8),
    s("testimonials-kids", "default", 9),
    s("bundles-listing", "scroll", 10),
    s("cta-kids", "default", 11),
  ],
  theme: getThemePreset("kids-bright")?.config ?? defaultThemeConfig,
  seo: { title: "Kids Learning", description: "Interactive courses, live classes and activities kids love" },
};

const kidsFriendlyPageTemplate: PageTemplate = {
  id: "kids-friendly",
  name: "School & Tutoring",
  description: "Friendly, feature-forward landing page variant for schools and tutoring",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=80",
  sections: [
    s("hero-kids-alt", "default", 0),
    s("path-kids", "default", 1),
    s("features-kids", "default", 2),
    s("categories-listing", "grid", 3),
    s("all-courses-listing", "scroll", 4),
    s("self-paced-courses-listing", "scroll", 6),
    s("books-listing", "scroll", 7),
    s("testimonials-kids", "default", 8),
    s("cta-kids", "default", 9),
  ],
  theme: getThemePreset("kids-bright")?.config ?? defaultThemeConfig,
  seo: { title: "School & Tutoring", description: "Tutoring, school subjects and skill-building in one friendly platform" },
};

const kidsPlayPageTemplate: PageTemplate = {
  id: "kids-play",
  name: "Little Learners",
  description: "Minimal, playful landing page variant for young learners",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1526634332515-d56c5fd16991?w=1200&q=80",
  // Distinct look from School & Tutoring: a dedicated immersive confetti hero
  // + a warm sunset theme.
  sections: [
    s("hero-kids-v3", "default", 0),
    s("features-kids", "default", 1),
    s("path-kids", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("testimonials-kids", "default", 5),
    s("cta-kids", "default", 6),
  ],
  theme: getThemePreset("sunset-orange")?.config ?? defaultThemeConfig,
  seo: { title: "Little Learners", description: "Playful, bite-sized lessons for young minds" },
};

// Finance & Trading, 3 variants (fintech-emerald theme)
const financePageTemplate: PageTemplate = {
  id: "finance",
  name: "Finance & Trading",
  description: "Professional landing page for finance, trading and investing academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
  sections: [
    s("hero-finance", "default", 0),
    s("markets-finance", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("features-finance", "default", 3),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("books-listing", "scroll", 8),
    s("testimonials-finance", "default", 9),
    s("bundles-listing", "scroll", 10),
    s("cta-finance", "default", 11),
  ],
  theme: getThemePreset("fintech-emerald")?.config ?? defaultThemeConfig,
  seo: { title: "Finance & Trading", description: "Practical finance, trading and investing courses from proven experts" },
};

// Quant Finance, premium dark 3D-mesh hero for finance / coding / technical academies
const quantFinancePageTemplate: PageTemplate = {
  id: "quant-finance",
  name: "Quant Finance Institute",
  description: "Premium dark landing page with a 3D wireframe hero for quantitative finance, coding and technical academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=1200&q=80",
  sections: [
    s("hero-quant", "default", 0),
    s("all-courses-listing", "scroll", 1),
    s("features-finance", "default", 2),
    s("categories-listing", "grid", 3),
    s("self-paced-courses-listing", "scroll", 5),
    s("testimonials-finance", "default", 6),
    s("books-listing", "scroll", 7),
    s("cta-finance", "default", 8),
  ],
  theme: getThemePreset("quant-navy")?.config ?? defaultThemeConfig,
  seo: { title: "Quant Finance Institute", description: "Master derivatives, risk, algorithmic trading and Python through hands-on, industry-focused projects" },
};

const financeMarketsPageTemplate: PageTemplate = {
  id: "finance-markets",
  name: "Trading Academy",
  description: "Bold, data-forward landing page variant for trading and market academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=1200&q=80",
  sections: [
    s("hero-finance-alt", "default", 0),
    s("markets-finance", "default", 1),
    s("features-finance", "default", 2),
    s("categories-listing", "grid", 3),
    s("all-courses-listing", "scroll", 4),
    s("self-paced-courses-listing", "scroll", 6),
    s("books-listing", "scroll", 7),
    s("testimonials-finance", "default", 8),
    s("cta-finance", "default", 9),
  ],
  theme: getThemePreset("fintech-emerald")?.config ?? defaultThemeConfig,
  seo: { title: "Trading Academy", description: "Live market sessions, strategies and analytics for serious traders" },
};

const financeCleanPageTemplate: PageTemplate = {
  id: "finance-clean",
  name: "Wealth Academy",
  description: "Clean, minimal landing page variant for investing and personal finance",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80",
  // Distinct look from Trading Academy: a dedicated immersive wealth hero
  // (rising growth arcs) + a dark-gold theme instead of the shared alt hero.
  sections: [
    s("hero-finance-v3", "default", 0),
    s("features-finance", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("markets-finance", "default", 3),
    s("about", "simple", 4),
    s("testimonials-finance", "default", 5),
    s("cta-finance", "default", 6),
  ],
  theme: getThemePreset("noir-gold")?.config ?? defaultThemeConfig,
  seo: { title: "Wealth Academy", description: "Clear, structured investing and personal-finance courses" },
};

// Language & Skills, 3 variants (language-coral theme)
const languagePageTemplate: PageTemplate = {
  id: "language",
  name: "Language Academy",
  description: "Modern landing page for language learning and communication academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=1200&q=80",
  sections: [
    s("hero-language", "default", 0),
    s("phrases-language", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("features-language", "default", 3),
    s("categories-listing", "grid", 5),
    s("about", "simple", 6),
    s("self-paced-courses-listing", "scroll", 7),
    s("books-listing", "scroll", 8),
    s("testimonials-language", "default", 9),
    s("bundles-listing", "scroll", 10),
    s("cta-language", "default", 11),
  ],
  theme: getThemePreset("language-coral")?.config ?? defaultThemeConfig,
  seo: { title: "Language Academy", description: "Structured lessons, live practice and immersion, all in one place" },
};

const languageFluentPageTemplate: PageTemplate = {
  id: "language-fluent",
  name: "Speak Fluently",
  description: "Vibrant, conversation-first language landing page variant",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80",
  sections: [
    s("hero-language-alt", "default", 0),
    s("phrases-language", "default", 1),
    s("features-language", "default", 2),
    s("categories-listing", "grid", 3),
    s("all-courses-listing", "scroll", 4),
    s("self-paced-courses-listing", "scroll", 6),
    s("books-listing", "scroll", 7),
    s("testimonials-language", "default", 8),
    s("cta-language", "default", 9),
  ],
  theme: getThemePreset("language-coral")?.config ?? defaultThemeConfig,
  seo: { title: "Speak Fluently", description: "Vibrant, conversation-first language courses that stick" },
};

const skillsHubPageTemplate: PageTemplate = {
  id: "skills",
  name: "Skills Hub",
  description: "Minimal landing page variant for practical, in-demand skills academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80",
  sections: [
    s("hero-skills", "default", 0),
    s("tracks-skills", "default", 1),
    s("features-skills", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("testimonials-skills", "default", 5),
    s("cta-skills", "default", 6),
  ],
  theme: getThemePreset("language-coral")?.config ?? defaultThemeConfig,
  seo: { title: "Skills Hub", description: "Practical, in-demand skills taught by industry pros" },
};

// Quant Finance Academy, light editorial hero (client-referenced pixel design)
// over the code-tech body sections.
const quantInstitutePageTemplate: PageTemplate = {
  id: "quant-institute",
  name: "Quant Finance Academy",
  description:
    "Light, editorial landing page with an italic serif hero, career stats and trusted-by bank wordmarks for quantitative finance and risk academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
  sections: [
    s("hero-quant-institute", "default", 0),
    // Body sections mirror the Code & Technology template (minus its hero).
    s("all-courses-listing", "scroll", 1),
    s("categories-listing", "grid", 4),
    s("self-paced-courses-listing", "scroll", 6),
    s("books-listing", "scroll", 9),
    s("bundles-listing", "scroll", 12),
    s("testimonials-scroll-code-tech", "default", 13),
  ],
  theme: getThemePreset("quant-light")?.config ?? defaultThemeConfig,
  seo: {
    title: "Quant Finance Academy",
    description:
      "Industry-focused training in quant finance, risk and modeling with self-paced programs, real-world projects and career support",
  },
};

// ⚠️ THIS ARRAY IS THE SOURCE OF TRUTH FOR ALL HOMEPAGE TEMPLATE IDS ⚠️
//
// The backend's `ALL_TEMPLATE_IDS` and `TemplateId` union (in
// apps/admin-api/src/lib/creator-intent/types.ts) are GENERATED
// from this array, specifically, the entries whose `pageCategories`
// includes "home". Never edit the backend lists by hand. The backend
// uses that enum as the closed list of values Gemini can return when
// picking a homepage template during onboarding.
//
// To add a homepage-eligible vertical template:
//   1. Append a new PageTemplate here with `pageCategories: ["home"]`.
//   2. Regenerate the enum in the admin API:
//        pnpm --filter @open-mtlms/admin-api sync:frontend-ids
//   3. Commit both files.
//
// Page-level templates (about-us, contact-us, faq-us, privacy-us,
// terms-us, login-minimal, profile-minimal) live
// here legitimately, they're referenced by the wizard's hardcoded
// `getAutoProvisionPages()` map, not by the backend enum. The sync
// script filters them out automatically via the `pageCategories`
// check, so you don't have to.
// ── Batch 1: new niche templates (framer-motion heroes + reusable sections) ──
const designStudioPageTemplate: PageTemplate = {
  id: "design-studio",
  name: "Design Studio",
  description: "Bold, creative landing page for design, UI and UX academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
  sections: [
    s("hero-design", "default", 0),
    s("stats-band", "default", 1, {
      logos: [
        { id: "1", image: "/templates/design-studio/logos/nova.svg", alt: "Nova" },
        { id: "2", image: "/templates/design-studio/logos/orbit.svg", alt: "Orbit" },
        { id: "3", image: "/templates/design-studio/logos/pixel.svg", alt: "Pixel" },
        { id: "4", image: "/templates/design-studio/logos/layer.svg", alt: "Layer" },
        { id: "5", image: "/templates/design-studio/logos/studio.svg", alt: "Studio" },
      ],
    }),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("design-vivid")?.config ?? defaultThemeConfig,
  seo: { title: "Design Studio", description: "Learn UI, UX and design systems with practical projects" },
};

const dataSciencePageTemplate: PageTemplate = {
  id: "data-science",
  name: "Data Science & AI",
  description: "Modern landing page for data science, AI and analytics programs",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
  sections: [
    s("hero-data-ai", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("stats-band", "default", 3),
    s("features-grid", "3-col", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("data-nebula")?.config ?? defaultThemeConfig,
  seo: { title: "Data Science & AI", description: "Master Python, machine learning and AI with real projects" },
};

const medicalPageTemplate: PageTemplate = {
  id: "medical-nursing",
  name: "Medical & Nursing",
  description: "Trustworthy landing page for medical, nursing and healthcare courses",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=80",
  sections: [
    s("hero-medical", "default", 0),
    s("stats-band", "default", 1),
    s("features-grid", "3-col", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("feature-bento", "default", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("medical-trust")?.config ?? defaultThemeConfig,
  seo: { title: "Medical & Nursing", description: "Structured medical, nursing and clinical courses by practitioners" },
};

const beautyPageTemplate: PageTemplate = {
  id: "beauty-makeup",
  name: "Beauty & Makeup",
  description: "Elegant landing page for beauty, makeup and salon academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1200&q=80",
  sections: [
    s("hero-beauty", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("testimonials-grid", "uniform", 3),
    s("about", "simple", 4),
    s("stats-band", "default", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("beauty-rose")?.config ?? defaultThemeConfig,
  seo: { title: "Beauty & Makeup", description: "Makeup, skincare and salon skills with pro techniques" },
};

const studyAbroadPageTemplate: PageTemplate = {
  id: "study-abroad",
  name: "Study Abroad",
  description: "Aspirational landing page for study abroad and admissions guidance",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=80",
  sections: [
    s("hero-study-abroad", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("categories-listing", "grid", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("abroad-azure")?.config ?? defaultThemeConfig,
  seo: { title: "Study Abroad", description: "IELTS, GRE and admissions guidance for top global universities" },
};

// ── Batch 2: premium heroes (marketing / cyber / real estate) ──
const digitalMarketingPageTemplate: PageTemplate = {
  id: "digital-marketing",
  name: "Digital Marketing",
  description: "High energy landing page for digital marketing and growth academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
  sections: [
    s("hero-marketing", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("marketing-punch")?.config ?? defaultThemeConfig,
  seo: { title: "Digital Marketing", description: "Master SEO, ads, social and analytics with real campaigns" },
};

const cybersecurityPageTemplate: PageTemplate = {
  id: "cybersecurity",
  name: "Cybersecurity",
  description: "Dark, technical landing page for cybersecurity and ethical hacking programs",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80",
  sections: [
    s("hero-cyber", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("stats-band", "default", 3),
    s("features-grid", "3-col", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("cyber-matrix")?.config ?? defaultThemeConfig,
  seo: { title: "Cybersecurity", description: "Ethical hacking, SOC operations and cloud security training" },
};

const realEstatePageTemplate: PageTemplate = {
  id: "real-estate",
  name: "Real Estate",
  description: "Clean, trustworthy landing page for real estate and property academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80",
  sections: [
    s("hero-realestate", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("categories-listing", "grid", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("estate-emerald")?.config ?? defaultThemeConfig,
  seo: { title: "Real Estate", description: "Sales, valuation and investment skills for a real estate career" },
};

// ── Batch 3A: premium heroes (cloud / accounting / law / film / startup) ──
const cloudDevopsPageTemplate: PageTemplate = {
  id: "cloud-devops",
  name: "Cloud & DevOps",
  description: "Technical landing page for cloud, DevOps and infrastructure programs",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80",
  sections: [
    s("hero-cloud", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("stats-band", "default", 3),
    s("features-grid", "3-col", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("cloud-sky")?.config ?? defaultThemeConfig,
  seo: { title: "Cloud & DevOps", description: "Master Docker, Kubernetes and cloud infrastructure with real deployments" },
};

const accountingCaPageTemplate: PageTemplate = {
  id: "accounting-ca",
  name: "Accounting & CA",
  description: "Trustworthy landing page for accounting, CA and commerce academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80",
  sections: [
    s("hero-accounting", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("ledger-navy")?.config ?? defaultThemeConfig,
  seo: { title: "Accounting & CA", description: "Accounting, GST, audit and taxation training for a finance career" },
};

const lawClatPageTemplate: PageTemplate = {
  id: "law-clat",
  name: "Law & CLAT",
  description: "Authoritative landing page for law, CLAT and judiciary academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80",
  sections: [
    s("hero-law", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("categories-listing", "grid", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("counsel-burgundy")?.config ?? defaultThemeConfig,
  seo: { title: "Law & CLAT", description: "CLAT, judiciary and drafting prep with moot courts and case studies" },
};

const filmContentPageTemplate: PageTemplate = {
  id: "film-content",
  name: "Film & Content",
  description: "Cinematic landing page for film, video and content creation programs",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=80",
  sections: [
    s("hero-film", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("stats-band", "default", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("cinema-crimson")?.config ?? defaultThemeConfig,
  seo: { title: "Film & Content", description: "Editing, cinematography, color and sound taught through real projects" },
};

const entrepreneurshipPageTemplate: PageTemplate = {
  id: "entrepreneurship",
  name: "Entrepreneurship",
  description: "High energy landing page for entrepreneurship and startup programs",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80",
  sections: [
    s("hero-startup", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("features-grid", "3-col", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("founder-indigo")?.config ?? defaultThemeConfig,
  seo: { title: "Entrepreneurship", description: "Fundraising, growth, product and sales from founders who have scaled" },
};

// ── Batch 3B: premium heroes (fashion / interior / yoga / dance) ──
const fashionDesignPageTemplate: PageTemplate = {
  id: "fashion-design",
  name: "Fashion Design",
  description: "Editorial landing page for fashion design and styling academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200&q=80",
  sections: [
    s("hero-fashion", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("testimonials-grid", "uniform", 3),
    s("about", "simple", 4),
    s("stats-band", "default", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("atelier-blush")?.config ?? defaultThemeConfig,
  seo: { title: "Fashion Design", description: "Draping, illustration, textiles and merchandising by industry designers" },
};

const interiorDesignPageTemplate: PageTemplate = {
  id: "interior-design",
  name: "Interior Design",
  description: "Warm landing page for interior design and architecture academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80",
  sections: [
    s("hero-interior", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("categories-listing", "grid", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("terra-warm")?.config ?? defaultThemeConfig,
  seo: { title: "Interior Design", description: "Space planning, 3D rendering, materials and lighting through real projects" },
};

const yogaPageTemplate: PageTemplate = {
  id: "yoga-meditation",
  name: "Yoga & Meditation",
  description: "Calm landing page for yoga, meditation and wellness academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80",
  sections: [
    s("hero-yoga", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("stats-band", "default", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("zen-teal")?.config ?? defaultThemeConfig,
  seo: { title: "Yoga & Meditation", description: "Hatha, vinyasa, pranayama and meditation with certified teacher training" },
};

const dancePageTemplate: PageTemplate = {
  id: "dance",
  name: "Dance",
  description: "Vibrant landing page for dance and performance academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1200&q=80",
  sections: [
    s("hero-dance", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("neon-fuchsia")?.config ?? defaultThemeConfig,
  seo: { title: "Dance", description: "Hip hop, contemporary, ballet and Bollywood with pro choreographers" },
};

// ── Batch 3C: premium heroes (coding kids / speaking / hospitality / spirituality) ──
const codingForKidsPageTemplate: PageTemplate = {
  id: "coding-for-kids",
  name: "Coding for Kids",
  description: "Playful landing page for coding for kids and STEM academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=1200&q=80",
  sections: [
    s("hero-codekids", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("stats-band", "default", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("playful-sky")?.config ?? defaultThemeConfig,
  seo: { title: "Coding for Kids", description: "Scratch, Python, robotics and game design through playful projects" },
};

const publicSpeakingPageTemplate: PageTemplate = {
  id: "public-speaking",
  name: "Public Speaking",
  description: "Confident landing page for public speaking and communication academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&q=80",
  sections: [
    s("hero-speaking", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("podium-violet")?.config ?? defaultThemeConfig,
  seo: { title: "Public Speaking", description: "Storytelling, debate and stage presence with real speaking practice" },
};

const hospitalityPageTemplate: PageTemplate = {
  id: "hospitality",
  name: "Hospitality & Culinary",
  description: "Warm landing page for hospitality, culinary and hotel management academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80",
  sections: [
    s("hero-hospitality", "default", 0),
    s("feature-bento", "default", 1),
    s("all-courses-listing", "scroll", 2),
    s("categories-listing", "grid", 3),
    s("stats-band", "default", 4),
    s("about", "simple", 5),
    s("testimonials-grid", "uniform", 6),
    s("cta-banner", "simple", 7),
  ],
  theme: getThemePreset("saffron-rouge")?.config ?? defaultThemeConfig,
  seo: { title: "Hospitality & Culinary", description: "Culinary arts, baking and hotel operations taught in real kitchens" },
};

const spiritualityPageTemplate: PageTemplate = {
  id: "spirituality",
  name: "Spirituality & Vedic",
  description: "Mystical landing page for spirituality, Vedic studies and meditation academies",
  category: "landing",
  pageCategories: ["home"],
  thumbnail: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=1200&q=80",
  sections: [
    s("hero-spiritual", "default", 0),
    s("stats-band", "default", 1),
    s("feature-bento", "default", 2),
    s("all-courses-listing", "scroll", 3),
    s("about", "simple", 4),
    s("testimonials-grid", "uniform", 5),
    s("cta-banner", "simple", 6),
  ],
  theme: getThemePreset("mystic-violet")?.config ?? defaultThemeConfig,
  seo: { title: "Spirituality & Vedic", description: "Vedic wisdom, meditation and Sanskrit taught by experienced masters" },
};

export const pageTemplates: PageTemplate[] = [
  basicPageTemplate,
  codeTechPageTemplate,
  photographyPageTemplate,
  mindfulnessPageTemplate,
  examprepPageTemplate,
  govtexamPageTemplate,
  astrologyPageTemplate,
  corpupskillPageTemplate,
  cookingPageTemplate,
  cookingStudioPageTemplate,
  fitnessPageTemplate,
  fitnessProPageTemplate,
  musicPageTemplate,
  musicVibePageTemplate,
  businessPageTemplate,
  businessDataPageTemplate,
  artsCraftsPageTemplate,
  artsGalleryPageTemplate,
  kidsPageTemplate,
  kidsFriendlyPageTemplate,
  // The playful arts/kids variants sit apart from their niche siblings so the
  // catalog never shows two similar cards back to back.
  artsPlayfulPageTemplate,
  financePageTemplate,
  quantFinancePageTemplate,
  kidsPlayPageTemplate,
  financeMarketsPageTemplate,
  financeCleanPageTemplate,
  languagePageTemplate,
  languageFluentPageTemplate,
  skillsHubPageTemplate,
  // Light quant variant sits apart from quantFinancePageTemplate so the
  // catalog never shows two similar cards back to back.
  quantInstitutePageTemplate,
  // New premium templates (batch 1 → 3C) appended after the original set
  designStudioPageTemplate,
  dataSciencePageTemplate,
  medicalPageTemplate,
  beautyPageTemplate,
  studyAbroadPageTemplate,
  digitalMarketingPageTemplate,
  cybersecurityPageTemplate,
  realEstatePageTemplate,
  cloudDevopsPageTemplate,
  accountingCaPageTemplate,
  lawClatPageTemplate,
  filmContentPageTemplate,
  entrepreneurshipPageTemplate,
  fashionDesignPageTemplate,
  interiorDesignPageTemplate,
  yogaPageTemplate,
  dancePageTemplate,
  codingForKidsPageTemplate,
  publicSpeakingPageTemplate,
  hospitalityPageTemplate,
  spiritualityPageTemplate,
  aboutUsPageTemplate,
  contactUsPageTemplate,
  faqPageTemplate,
  privacyPageTemplate,
  termsPageTemplate,
  profilePageTemplate,
  loginPageTemplate,
];

export const getTemplateById = (id: string) =>
  pageTemplates.find((t) => t.id === id);

export const getTemplatesByPageCategory = (pageCategoryId: string) =>
  pageTemplates.filter((t) => t.pageCategories.includes(pageCategoryId));
