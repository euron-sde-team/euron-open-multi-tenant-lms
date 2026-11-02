// Section Types - Core building blocks for the template system

import type { ContentPrice } from "./currency";

export type SectionType =
  | "about"
  | "about-astrology"
  | "about-examprep"
  | "about-govtexam"
  | "about-page"
  | "about-photography"
  | "about-us-contact"
  | "about-us-hero"
  | "about-us-mission"
  | "about-us-offerings"
  | "about-us-values"
  | "founders"
  | "all-courses-listing"
  | "book-author"
  | "book-description"
  | "book-hero"
  | "bookmark-page"
  | "book-offerings"
  | "book-recommendations"
  | "book-showcase"
  | "books-listing"
  | "books-listing-astrology"
  | "books-listing-examprep"
  | "books-listing-govtexam"
  | "books-listing-photography"
  | "bundles-listing"
  | "cart-page"
  | "categories-listing"
  | "test-series-listing"
  | "contact-form"
  | "contact-page"
  | "contact-us-form"
  | "contact-us-hero"
  | "contact-us-info"
  | "course-cards"
  | "course-curriculum"
  | "course-hero"
  | "course-instructor"
  | "course-learning-outcomes"
  | "course-offerings"
  | "course-prerequisites"
  | "course-recommendations"
  | "courses-listing-astrology"
  | "courses-listing-examprep"
  | "courses-listing-govtexam"
  | "courses-listing-photography"
  | "cta-astrology"
  | "cta-banner"
  | "cta-examprep"
  | "cta-govtexam"
  | "cta-mindfulness"
  | "cta-photography"
  | "cta-split"
  | "exam-categories-govtexam"
  | "faq"
  | "faq-accordion"
  | "faq-astrology"
  | "faq-examprep"
  | "faq-govtexam"
  | "faq-page"
  | "faq-photography"
  | "faq-us-hero"
  | "faq-us-list"
  // Privacy Policy Page Sections
  | "privacy-us-hero"
  | "privacy-us-content"
  // Terms of Service Page Sections
  | "terms-us-hero"
  | "terms-us-content"
  // Mindfulness Template Sections
  | "hero-mindfulness"
  | "teach-mindfulness"
  | "how-it-works-mindfulness"
  | "testimonials-mindfulness"
  | "cta-mindfulness"
  | "roadmap-mindfulness"
  // Photography Landing Page Sections
  | "hero-photography"
  | "hero-cooking"
  | "recipes-cooking"
  | "features-cooking"
  | "testimonials-cooking"
  | "cta-cooking"
  | "hero-cooking-alt"
  | "hero-fitness"
  | "programs-fitness"
  | "hero-fitness-alt"
  | "hero-music"
  | "genres-music"
  | "hero-music-alt"
  | "hero-business"
  | "outcomes-business"
  | "hero-business-alt"
  | "hero-arts"
  | "hero-arts-alt"
  | "hero-arts-v3"
  | "gallery-arts"
  | "hero-kids"
  | "hero-kids-alt"
  | "hero-kids-v3"
  | "path-kids"
  | "hero-finance"
  | "hero-finance-alt"
  | "hero-finance-v3"
  | "hero-design"
  | "hero-data-ai"
  | "hero-medical"
  | "hero-beauty"
  | "hero-study-abroad"
  | "hero-marketing"
  | "hero-cyber"
  | "hero-realestate"
  | "hero-cloud"
  | "hero-accounting"
  | "hero-law"
  | "hero-film"
  | "hero-startup"
  | "hero-fashion"
  | "hero-interior"
  | "hero-yoga"
  | "hero-dance"
  | "hero-codekids"
  | "hero-speaking"
  | "hero-hospitality"
  | "hero-spiritual"
  | "feature-bento"
  | "stats-band"
  | "markets-finance"
  | "hero-language"
  | "hero-language-alt"
  | "phrases-language"
  | "hero-skills"
  | "tracks-skills"
  | "hero-quant"
  | "hero-quant-institute"
  | "features-fitness"
  | "testimonials-fitness"
  | "cta-fitness"
  | "features-music"
  | "testimonials-music"
  | "cta-music"
  | "features-business"
  | "testimonials-business"
  | "cta-business"
  | "features-arts"
  | "testimonials-arts"
  | "cta-arts"
  | "features-kids"
  | "testimonials-kids"
  | "cta-kids"
  | "features-finance"
  | "testimonials-finance"
  | "cta-finance"
  | "features-language"
  | "testimonials-language"
  | "cta-language"
  | "features-skills"
  | "testimonials-skills"
  | "cta-skills"
  | "about-photography"
  | "features-photography"
  | "gallery-photography"
  | "testimonials-photography"
  | "cta-photography"
  | "faq-photography"
  | "courses-listing-photography"
  | "books-listing-photography"
  // Astrology Landing Page Sections
  | "hero-astrology"
  | "about-astrology"
  | "services-astrology"
  | "testimonials-astrology"
  | "faq-astrology"
  | "cta-astrology"
  | "courses-listing-astrology"
  | "self-paced-courses-listing-astrology"
  | "books-listing-astrology"
  // Subscription Page Sections
  | "subscription-hero"
  | "subscription-features"
  | "subscription-comparison"
  | "subscription-pricing"
  | "subscription-faq"
  | "subscription-cta"
  // Exam Prep Template Sections
  | "hero-examprep"
  | "features-examprep"
  | "learning-paths-examprep"
  | "about-examprep"
  | "testimonials-examprep"
  | "faq-examprep"
  | "cta-examprep"
  | "courses-listing-examprep"
  | "self-paced-courses-listing-examprep"
  | "books-listing-examprep"
  | "hero-govtexam"
  | "features-govtexam"
  | "learning-paths-govtexam"
  | "login-form"
  | "logo-cloud"
  | "member-profile"
  | "pricing-page"
  | "pricing-table"
  | "privacy-page"
  | "privacy-us-content"
  | "privacy-us-hero"
  | "roadmap-mindfulness"
  | "self-paced-courses-listing"
  | "self-paced-courses-listing-examprep"
  | "self-paced-courses-listing-govtexam"
  | "services-astrology"
  | "stats-counter"
  | "subscription-comparison"
  | "subscription-cta"
  | "subscription-faq"
  | "subscription-features"
  | "subscription-hero"
  | "subscription-pricing"
  | "teach-mindfulness"
  | "team"
  | "terms-page"
  | "terms-us-content"
  | "terms-us-hero"
  | "testimonials-astrology"
  | "testimonials-carousel"
  | "testimonials-examprep"
  | "testimonials-govtexam"
  | "testimonials-grid"
  | "testimonials-mindfulness"
  | "testimonials-photography"
  | "testimonials-scroll-code-tech"
  | "timeline"
  | "trusted-by-govtexam"
  | "hero-corpupskill"
  | "trusted-by-corpupskill"
  | "features-split-corpupskill"
  | "analytics-corpupskill"
  | "testimonials-corpupskill"
  | "cta-corpupskill"
  | "solutions-grid-corpupskill"
  | "self-paced-courses-listing-corpupskill"
  | "books-listing-corpupskill"
  // Generic Sections
  | "hero"
  | "header"
  | "footer"
  // Code Tech Template Sections
  | "hero-code-tech"
  // Feature Variant Sections
  | "features-grid"
  | "features-list"
  | "features-tabs"
  | "features-accordion"
  // Gallery
  | "gallery"
  // Custom HTML block (tenant's own HTML/CSS/JS in a sandboxed iframe)
  | "custom-html"
;

export interface TextStyle {
  color?: string;
  colorDark?: string;
  fontSize?: string;
  fontWeight?: "normal" | "medium" | "semibold" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
}

/**
 * A photo placed on top of a section and positioned by dragging it, e.g. a
 * founder's cut out portrait on an About us section.
 *
 * Everything is a PERCENTAGE of the section box, never pixels, so the photo
 * holds its place when the section grows or shrinks and on a phone. `width` is
 * a percentage of the section's width and the height follows the image's own
 * proportions, so a photo is never squashed.
 */
export interface SectionPhoto {
  id: string;
  url: string;
  /** Centre of the photo, as a percentage of the section box. */
  x: number;
  y: number;
  /** Width, as a percentage of the section width. */
  width: number;
  /** Degrees, clockwise. */
  rotation?: number;
  /** Stacking order among the photos on this section. */
  z?: number;
  /** Alternative text. Empty means decorative, which is the usual case here. */
  alt?: string;
  /** Hidden without being deleted, so it can be brought back. */
  hidden?: boolean;
}

export interface SectionSettings {
  backgroundColor?: string;
  backgroundColorDark?: string;
  backgroundImage?: string;
  paddingTop?: string;
  paddingBottom?: string;
  fullWidth?: boolean;
  customClasses?: string;
  /** Photos dropped onto this section and positioned by hand. */
  photos?: SectionPhoto[];
}

export interface SectionConfig {
  id: string;
  type: SectionType;
  variant: string;
  order: number;
  visible: boolean;
  deleted: boolean;
  content: unknown;
  settings: SectionSettings;
  createdAt: string;
  updatedAt: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** Whether this nav item is hidden by admin */
  hidden?: boolean;
  children?: NavItem[];
}

export interface CTAButton {
  text: string;
  href: string;
  variant: "primary" | "secondary" | "outline" | "ghost";
  /** Whether this button is hidden by admin (soft-delete, can be restored) */
  hidden?: boolean;
  /** New action system config (overrides href when present) */
  action?: import("./button-actions").ButtonActionConfig;
}

// Section Content Types
export interface HeaderContent {
  logo: string;
  logoAlt: string;
  navItems: NavItem[];
  cta?: CTAButton;
  showDarkModeToggle: boolean;
}

export interface HeroContent {
  headline: string;
  subheadline: string;
  description?: string;
  primaryCta?: CTAButton;
  secondaryCta?: CTAButton;
  image?: string;
  imageAlt?: string;
  videoUrl?: string;
  textStyles?: Record<string, TextStyle>;
  badge?: string;
  stats?: StatItem[];
}

export interface HeroCodeTechTechLogo {
  id: string;
  name: string;
  /**
   * Built-in glyph key (react | typescript | nodejs | python | …). Falls back
   * to the first letter of `name` when unrecognised. Independent of `name` so
   * a tenant can label a chip "LLMs" while keeping the Python glyph, or
   * change the glyph without retyping the label.
   */
  icon?: string;
  /** Uploaded logo URL. Takes precedence over `icon` when set. */
  logoImage?: string;
}

export interface HeroCodeTechFloatingCard {
  id: string;
  title: string;
  subtitle: string;
  image?: string;
  imageAlt?: string;
}

export interface HeroCodeTechSocialProof {
  avatars?: Array<{ id: string; initial: string; gradient?: string }>;
  totalCount?: string;
  rating?: string;
  reviewCount?: string;
}

export interface HeroCodeTechFeaturedIn {
  id: string;
  name: string;
}

export interface HeroCodeTechContent {
  headline: string;
  headlineAccent: string;
  headlinePrefix?: string;
  description?: string;
  badge?: string;
  primaryCta?: CTAButton;
  secondaryCta?: CTAButton;
  techLogos?: HeroCodeTechTechLogo[];
  socialProof?: HeroCodeTechSocialProof;
  image?: string;
  imageAlt?: string;
  videoUrl?: string;
  floatingCards?: HeroCodeTechFloatingCard[];
  stats?: StatItem[];
  featuredIn?: HeroCodeTechFeaturedIn[];
  codeTickerItems?: string[];
  /** Label before the tech-logo row. Defaults to "Learn". */
  techLogosLabel?: string;
  /** Label before the press/publication row. Defaults to "Featured in". */
  featuredInLabel?: string;
  /** Mock editor chrome, filenames, host and status line on the preview card. */
  editorChrome?: HeroCodeTechEditorChrome;
  textStyles?: Record<string, TextStyle>;
}

export interface HeroCodeTechEditorChrome {
  activeTab?: string;
  inactiveTab?: string;
  statusLabel?: string;
  host?: string;
  statusLine?: string;
}


// ── Testimonials Scroll: Code & Tech ──

export interface TestimonialScrollItem {
  id: string;
  name: string;
  imageUrl: string | null;
  memberName: string | null;
  text: string | null;
}

export interface TestimonialsScrollCodeTechContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  cardLabel?: string;
  emptyButtonText?: string;
  textStyles?: Record<string, TextStyle>;
}

export interface FeatureItem {
  id: string;
  icon?: string;
  title: string;
  description: string;
  image?: string;
}

export interface FeaturesContent {
  headline: string;
  subheadline?: string;
  features: FeatureItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company?: string;
  avatar?: string;
  rating?: number;
}

/**
 * A YouTube video testimonial. Rendered as a clickable card (thumbnail + play
 * overlay) that opens the video in an on-page modal. Kept as a separate group
 * from the text `testimonials` list.
 */
export interface VideoTestimonial {
  id: string;
  /** Full YouTube URL (watch, youtu.be, embed, or Shorts form). */
  youtubeUrl: string;
  /** Optional caption shown under the card. */
  title?: string;
  /** Optional person/role shown under the title. */
  author?: string;
  /** Optional custom thumbnail; falls back to the YouTube thumbnail. */
  thumbnail?: string;
  /**
   * Video shape. "landscape" (16:9, default) for normal videos, "portrait"
   * (9:16) for vertical videos and YouTube Shorts. A Shorts URL auto-selects
   * portrait when this is not set.
   */
  orientation?: "landscape" | "portrait";
}

export interface TestimonialsContent {
  headline: string;
  subheadline?: string;
  testimonials: Testimonial[];
  textStyles?: Record<string, TextStyle>;
  summaryStats?: StatItem[];
  /** Optional heading for the video-testimonials group. */
  videoHeadline?: string;
  /** Optional YouTube video testimonials, shown below the text testimonials. */
  videoTestimonials?: VideoTestimonial[];
}

export interface LogoItem {
  id: string;
  name: string;
  logo: string;
  url?: string;
}

export interface LogoCloudContent {
  headline?: string;
  logos: LogoItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface StatItem {
  id: string;
  value: string;
  label: string;
  prefix?: string;
  suffix?: string;
}

export interface StatsContent {
  headline?: string;
  stats: StatItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  avatar?: string;
  socialLinks?: { platform: string; url: string }[];
}

export interface TeamContent {
  headline: string;
  subheadline?: string;
  /** Small kicker above the headline, e.g. "Our people". */
  label?: string;
  members: TeamMember[];
  textStyles?: Record<string, TextStyle>;
}

/**
 * The founder and co founders of the academy: the same people shape as the
 * team, shown larger and with the bio, because this section is usually two or
 * three people rather than a dozen.
 */
export interface FoundersContent {
  label?: string;
  headline: string;
  subheadline?: string;
  members: TeamMember[];
  textStyles?: Record<string, TextStyle>;
}

export interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description: string;
  icon?: string;
}

export interface TimelineContent {
  headline: string;
  subheadline?: string;
  items: TimelineItem[];
}

export interface GalleryItem {
  id: string;
  image: string;
  alt: string;
  caption?: string;
}

export interface GalleryContent {
  headline?: string;
  items: GalleryItem[];
  columns?: 2 | 3 | 4;
}

export interface CTAContent {
  headline: string;
  subheadline?: string;
  description?: string;
  primaryCta: CTAButton;
  secondaryCta?: CTAButton;
  image?: string;
  textStyles?: Record<string, TextStyle>;
  emailPlaceholder?: string;
  benefits?: string[];
  trustBadges?: { id: string; icon: string; label: string }[];
}

export interface PricingTier {
  id: string;
  name: string;
  description?: string;
  price: string;
  period?: string;
  features: string[];
  cta: CTAButton;
  highlighted?: boolean;
  badge?: string;
  icon?: string;
}

export interface PricingContent {
  headline: string;
  subheadline?: string;
  tiers: PricingTier[];
  showToggle?: boolean;
  monthlyLabel?: string;
  yearlyLabel?: string;
  textStyles?: Record<string, TextStyle>;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface FAQContent {
  headline: string;
  subheadline?: string;
  items: FAQItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface ContactFormContent {
  headline: string;
  subheadline?: string;
  fields: {
    name: boolean;
    email: boolean;
    phone: boolean;
    company: boolean;
    message: boolean;
  };
  submitText: string;
  successMessage: string;
  /** Contact info shown in "with-info" variant */
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    hours?: string;
  };
}

export interface LoginFormSocialProvider {
  id: string;
  name: string;
  /** Icon key: "google" | "facebook" | "twitter" | "github" | "apple" */
  icon: string;
  href: string;
}

export interface LoginFormContent {
  headline: string;
  subheadline?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  submitText: string;
  forgotPasswordText?: string;
  forgotPasswordHref?: string;
  /** Social login provider buttons */
  socialProviders?: LoginFormSocialProvider[];
  /** Text above social buttons, e.g. "Or sign in with" */
  socialHeadline?: string;
  /** Footer text, e.g. "Don't have an account?" */
  footerText?: string;
  /** Footer link text, e.g. "Sign Up" */
  footerLinkText?: string;
  footerLinkHref?: string;
  /** Optional background image for split variant */
  image?: string;
  imageAlt?: string;
  /** Left brand-panel tagline (split variant). */
  brandTagline?: string;
  /** Left brand-panel features (split variant): each carries an editable Lucide
   *  icon (name) + text. Legacy text-only string entries are still accepted. */
  brandFeatures?: Array<string | LoginBrandFeatureItem>;
}

/** A single editable login brand-panel feature: a Lucide icon name + text. */
export interface LoginBrandFeatureItem {
  /** Lucide icon name (see LOGIN_BRAND_FEATURE_ICONS). */
  icon: string;
  text: string;
}

/** Curated Lucide icon names offered in the login feature icon picker. */
export const LOGIN_BRAND_FEATURE_ICONS = [
  "GraduationCap",
  "Mic",
  "MessageSquare",
  "FileText",
  "Video",
  "BookOpen",
  "Sparkles",
  "Brain",
  "Award",
  "Users",
  "Rocket",
  "PenTool",
] as const;

export const DEFAULT_LOGIN_BRAND_FEATURES: LoginBrandFeatureItem[] = [
  { icon: "GraduationCap", text: "Interactive Courses & Books" },
  { icon: "FileText", text: "Quizzes, Assignments & Test Series" },
  { icon: "Award", text: "Verifiable Certificates" },
  { icon: "Video", text: "Video Lessons On Any Device" },
];

/**
 * Normalize stored login brand features to a uniform {icon, text} shape.
 * Accepts the legacy string[] form (text-only) and back-fills a sensible icon
 * by position so existing pages keep rendering after the model gained icons.
 */
export function normalizeLoginBrandFeatures(
  raw: LoginFormContent["brandFeatures"],
): LoginBrandFeatureItem[] {
  if (!raw || raw.length === 0) return DEFAULT_LOGIN_BRAND_FEATURES;
  return raw.map((f, i) => {
    if (typeof f === "string") {
      return {
        icon: DEFAULT_LOGIN_BRAND_FEATURES[i]?.icon ?? "GraduationCap",
        text: f,
      };
    }
    return { icon: f.icon || "GraduationCap", text: f.text };
  });
}

// ============================================
// Full-page section content types
// ============================================

export interface AboutPageValue {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface AboutPageTeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface AboutPageContent {
  headline: string;
  subheadline?: string;
  story: string;
  storyImage?: string;
  storyImageAlt?: string;
  mission?: string;
  vision?: string;
  values?: AboutPageValue[];
  stats?: { id: string; value: string; label: string; suffix?: string }[];
  teamHeadline?: string;
  teamMembers?: AboutPageTeamMember[];
}

export interface ContactPageContent {
  headline: string;
  subheadline?: string;
  formFields: {
    name: boolean;
    email: boolean;
    phone: boolean;
    company: boolean;
    message: boolean;
  };
  submitText: string;
  successMessage: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    hours?: string;
  };
  mapEmbed?: string;
  socialLinks?: { id: string; platform: string; url: string; icon: string }[];
}

export interface PricingPageContent {
  headline: string;
  subheadline?: string;
  tiers: PricingTier[];
  showToggle?: boolean;
  monthlyLabel?: string;
  yearlyLabel?: string;
  faqHeadline?: string;
  faqItems?: FAQItem[];
  ctaHeadline?: string;
  ctaSubheadline?: string;
  ctaButton?: CTAButton;
}

export interface FAQPageItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface FAQPageCategory {
  id: string;
  name: string;
}

export interface FAQPageContent {
  headline: string;
  subheadline?: string;
  categories?: FAQPageCategory[];
  items: FAQPageItem[];
  contactHeadline?: string;
  contactText?: string;
  contactLinkText?: string;
  contactLinkHref?: string;
}

export interface LegalSection {
  id: string;
  title: string;
  content: string;
}

export interface PrivacyPageContent {
  headline: string;
  subheadline?: string;
  lastUpdated?: string;
  sections: LegalSection[];
  contactHeadline?: string;
  contactText?: string;
  contactEmail?: string;
}

export interface TermsPageContent {
  headline: string;
  subheadline?: string;
  lastUpdated?: string;
  sections: LegalSection[];
  contactHeadline?: string;
  contactText?: string;
  contactEmail?: string;
}

export interface FooterColumn {
  id: string;
  title: string;
  links: { label: string; href: string }[];
}

export interface FooterContent {
  logo: string;
  logoAlt: string;
  description?: string;
  columns: FooterColumn[];
  socialLinks?: { platform: string; url: string; icon: string }[];
  copyright: string;
  bottomLinks?: { label: string; href: string }[];
}

export interface ProductItem {
  id: string;
  title: string;
  description: string;
  price: string;
  originalPrice?: string;
  image: string;
  badge?: string;
  rating?: number;
  reviewCount?: number;
  href: string;
}

export interface CourseItem {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorAvatar?: string;
  price: string;
  originalPrice?: string;
  image: string;
  duration?: string;
  lessons?: number;
  level?: "beginner" | "intermediate" | "advanced";
  rating?: number;
  students?: number;
  href: string;
}

export interface CourseCardsContent {
  headline: string;
  subheadline?: string;
  courses: CourseItem[];
}

export interface BookItem {
  id: string;
  title: string;
  author: string;
  description: string;
  price: string;
  originalPrice?: string;
  cover: string;
  pages?: number;
  format?: string[];
  rating?: number;
  href: string;
}

export interface BookShowcaseContent {
  headline: string;
  subheadline?: string;
  books: BookItem[];
}

// ── Content Listing (generic sections for courses, books, bundles, categories) ──

export interface ContentListingContent {
  /** CTA on an item the learner already owns. Defaults per template ("Continue Learning" / "Continue Reading"). */
  continueLabel?: string;
  /** CTA on an item not yet owned. Defaults per template ("View" / "View Book"). */
  viewLabel?: string;
  headline: string;
  subheadline?: string;
  itemCount?: number;
  seeAllLink?: string;
  textStyles?: Record<string, TextStyle>;
}

export interface ContentListingItem {
  id: string;
  type: "course" | "book" | "bundle" | "category" | "test-series";
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  // Pricing (courses, books, bundles)
  priceInr?: string | null;
  priceUsd?: string | null;
  discountInr?: string | null;
  discountUsd?: string | null;
  purchaseMode?: string;
  /** Explicit badge label (e.g. "Bestseller"). Overrides the mode-derived badge on the card. */
  badge?: string;
  // Course-specific
  mode?: string;
  difficulty?: string;
  language?: string[];
  duration?: string | null;
  instructor?: { id: string; name: string; avatar?: string | null } | null;
  // Book-specific
  pages?: number | null;
  author?: string | null;
  authors?: { id: string; name: string }[];
  // Bundle-specific
  itemCount?: number;
  // Category-specific
  iconUrl?: string | null;
  // Access / enrollment
  hasAccess?: boolean;
  /** The member's progress on an owned course (0 to 100), when known. */
  progressPercent?: number | null;
}

export interface AboutContent {
  headline: string;
  subheadline?: string;
  content: string;
  image?: string;
  imagePosition?: "left" | "right";
  stats?: StatItem[];
  textStyles?: Record<string, TextStyle>;
}

// Course Page Section Content Types
export interface CourseHeroContent {
  title: string;
  subtitle: string;
  description?: string;
  thumbnail: string;
  thumbnailAlt?: string;
  previewVideoUrl?: string;
  mode: "SELF_PACED" | "LIVE" | "HYBRID";
  duration: string;
  language?: string;
  rating?: number;
  studentsCount?: number;
  price: number;
  originalPrice?: number;
  discount?: number;
  currency?: string;
  /** Multi-currency price book mirrored from CourseFormData.prices on save. */
  prices?: ContentPrice[];
  enrollCta?: CTAButton;
  category?: string;
  categoryIcon?: string;
  // Editable section/pricing labels (persisted for round-trip)
  descriptionHeadline?: string;
  pricingPlusHeadline?: string;
  pricingPlusSubtext?: string;
  pricingGuaranteeText?: string;
  /** Access validity in days after purchase (default 365). null = lifetime (no expiry). */
  validityDays?: number | null;
}

/** One syllabus row, as stored on the landing page's curriculum section. */
export interface CourseCurriculumLecture {
  id: string;
  title: string;
  duration?: string;
  /** Marks the row as a free sample. Without previewVideo it is a label only. */
  isPreview?: boolean;
  /** The sample itself, playable without logging in. */
  previewVideo?: {
    videoKey: string;
    provider?: "YOUTUBE" | "EVS" | "HLS" | "MP4";
    title?: string;
    duration?: string;
    sourceLectureId?: string;
  };
}

export interface CourseCurriculumModule {
  id: string;
  title: string;
  order: number;
  lectures: CourseCurriculumLecture[];
}

export interface CourseCurriculumSection {
  id: string;
  title: string;
  order: number;
  /** @deprecated Use modules instead. Kept for backward compat. */
  lectures?: CourseCurriculumLecture[];
  modules?: CourseCurriculumModule[];
}

export interface CourseCurriculumContent {
  headline: string;
  subheadline?: string;
  sections: CourseCurriculumSection[];
  totalLectures?: number;
  totalDuration?: string;
}

export interface CourseOfferingItem {
  id: string;
  icon: string;
  text: string;
}

export interface CourseOfferingsContent {
  headline: string;
  subheadline?: string;
  offerings: CourseOfferingItem[];
}

export interface CourseInstructorContent {
  headline: string;
  subheadline?: string;
  instructors: {
    id: string;
    name: string;
    role: string;
    bio?: string;
    avatar?: string;
    rating?: number;
    studentsCount?: number;
    coursesCount?: number;
    socialLinks?: { platform: string; url: string }[];
  }[];
}

export interface CoursePrerequisitesContent {
  headline: string;
  subheadline?: string;
  prerequisites: string[];
}

export interface CourseLearningOutcomesContent {
  headline: string;
  subheadline?: string;
  outcomes: string[];
}

export interface CartPageContent {
  headline: string;
  subheadline?: string;
  checkoutButtonText?: string;
  emptyCartMessage?: string;
}

export interface BookmarkPageContent {
  headline: string;
  subheadline?: string;
  emptyBookmarkMessage?: string;
}

/** Member profile section - renders user profile form/sidebar (Profile, Settings, etc.). Data comes from auth. */
export interface MemberProfileContent {
  headline?: string;
  subheadline?: string;
  /** Tab labels */
  profileTabLabel?: string;
  settingsTabLabel?: string;
  /** Form field labels */
  firstNameLabel?: string;
  lastNameLabel?: string;
  phoneLabel?: string;
  emailLabel?: string;
  genderLabel?: string;
  aboutLabel?: string;
  /** Helper/hint text */
  phoneHint?: string;
  emailHint?: string;
  /** Placeholders */
  firstNamePlaceholder?: string;
  lastNamePlaceholder?: string;
  phonePlaceholder?: string;
  aboutPlaceholder?: string;
  genderPlaceholder?: string;
  otpPlaceholder?: string;
  /** Button/action text */
  sendVerificationCodeText?: string;
  verifyText?: string;
  cancelOtpText?: string;
  updateProfileText?: string;
  deleteAccountTitle?: string;
  deleteAccountDescription?: string;
  deleteAccountButton?: string;
  yesDeleteText?: string;
  cancelText?: string;
}

// ============================================
// About Us page section content types
// ============================================

export interface AboutUsHeroStat {
  id: string;
  value: string;
  label: string;
}

export interface AboutUsHeroContent {
  headline: string;
  highlightText?: string;
  description: string;
  stats?: AboutUsHeroStat[];
  textStyles?: Record<string, TextStyle>;
}

export interface AboutUsMissionBlock {
  id: string;
  label: string;
  title: string;
  description: string;
}

export interface AboutUsMissionContent {
  blocks: AboutUsMissionBlock[];
  textStyles?: Record<string, TextStyle>;
}

export interface AboutUsOfferingItem {
  id: string;
  icon?: string;
  title: string;
  description: string;
  tags?: string[];
}

export interface AboutUsOfferingsContent {
  headline: string;
  description?: string;
  offerings: AboutUsOfferingItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface AboutUsValueItem {
  id: string;
  icon?: string;
  title: string;
  description: string;
}

export interface AboutUsValuesContent {
  headline: string;
  description?: string;
  values: AboutUsValueItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface AboutUsContactContent {
  label?: string;
  headline: string;
  description: string;
  email: string;
  emailLabel?: string;
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// Contact Us page section content types
// ============================================

export interface ContactUsHeroContent {
  headline: string;
  highlightText?: string;
  description: string;
  textStyles?: Record<string, TextStyle>;
}

export interface ContactUsInfoCard {
  id: string;
  icon?: string;
  title: string;
  detail: string;
  subtext?: string;
}

export interface ContactUsInfoContent {
  cards: ContactUsInfoCard[];
  textStyles?: Record<string, TextStyle>;
}

export interface ContactUsFormField {
  id: string;
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "select" | "textarea";
  placeholder?: string;
  required?: boolean;
  options?: string[];
  halfWidth?: boolean;
}

export interface ContactUsFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ContactUsFormContent {
  formHeadline: string;
  formDescription?: string;
  fields: ContactUsFormField[];
  submitText: string;
  successHeadline: string;
  successMessage: string;
  illustrationHeadline?: string;
  illustrationDescription?: string;
  illustrationStats?: Array<{ id: string; value: string; label: string }>;
  faqHeadline?: string;
  faqs?: ContactUsFaqItem[];
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// FAQ page section content types
// ============================================

export interface FaqUsHeroContent {
  headline: string;
  highlightText?: string;
  description: string;
  textStyles?: Record<string, TextStyle>;
}

export interface FaqUsItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqUsListContent {
  items: FaqUsItem[];
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// Privacy Policy page section content types
// ============================================

export interface PrivacyUsHeroContent {
  headline: string;
  highlightText?: string;
  description: string;
  lastUpdated?: string;
  version?: string;
  textStyles?: Record<string, TextStyle>;
}

export interface PrivacyUsPolicySection {
  id: string;
  icon?: string;
  title: string;
  body: string;
}

export interface PrivacyUsContentContent {
  sections: PrivacyUsPolicySection[];
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// Terms of Service page section content types
// ============================================

export interface TermsUsHeroContent {
  headline: string;
  highlightText?: string;
  description: string;
  textStyles?: Record<string, TextStyle>;
}

export interface TermsUsSection {
  id: string;
  title: string;
  body: string;
}

export interface TermsUsContentContent {
  introText?: string;
  sections: TermsUsSection[];
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// Mindfulness Template section content types
// ============================================

export interface HeroMindfulnessBenefit {
  id: string;
  icon: string;
  label: string;
}

export interface HeroMindfulnessStat {
  id: string;
  icon: string;
  label: string;
  value: string;
}

export interface HeroMindfulnessContent {
  headline: string;
  headlineAccent: string;
  description?: string;
  primaryCta?: CTAButton;
  secondaryCta?: CTAButton;
  image?: string;
  imageAlt?: string;
  videoUrl?: string;
  liveBadgeText?: string;
  stats?: HeroMindfulnessStat[];
  benefits?: HeroMindfulnessBenefit[];
  textStyles?: Record<string, TextStyle>;
}

export interface TeachMindfulnessContent {
  badge?: string;
  headline: string;
  headlineAccent?: string;
  description?: string;
  primaryCta?: CTAButton;
  textStyles?: Record<string, TextStyle>;
}

export interface HowItWorksMindfulnessStep {
  id: string;
  icon: string;
  stepLabel: string;
  title: string;
  description: string;
}

export interface HowItWorksMindfulnessContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  steps?: HowItWorksMindfulnessStep[];
  textStyles?: Record<string, TextStyle>;
}

export interface TestimonialsMindfulnessItem {
  id: string;
  name: string;
  role: "learner" | "instructor";
  quote: string;
  avatar?: string;
  rating?: number;
}

export interface TestimonialsMindfulnessContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  testimonials?: TestimonialsMindfulnessItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface CtaMindfulnessTrustBadge {
  id: string;
  label: string;
}

export interface CtaMindfulnessContent {
  badge?: string;
  headline: string;
  headlineAccent?: string;
  description?: string;
  primaryCta?: CTAButton;
  trustBadges?: CtaMindfulnessTrustBadge[];
  textStyles?: Record<string, TextStyle>;
}

export interface RoadmapMindfulnessWaypoint {
  id: string;
  label: string;
  icon: string;
}

export interface RoadmapMindfulnessContent {
  /** Pill above the heading. Defaults to "Structured Learning". */
  badgeLabel?: string;
  headline: string;
  headlineAccent?: string;
  description?: string;
  waypoints?: RoadmapMindfulnessWaypoint[];
  goalLabel?: string;
  primaryCta?: CTAButton;
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// Photography Landing Page section content types
// ============================================

export interface HeroPhotographyStat {
  id: string;
  value: string;
  label: string;
}

/** A single uploadable media card, e.g. one poster/thumbnail in a hero
 *  carousel/marquee. Optional so heroes that use a single `image` are unaffected. */
export interface HeroGalleryItem {
  id: string;
  src: string;
  alt?: string;
}

/** A single trusted-by institution wordmark (hero-quant-institute). */
export interface HeroInstitutionItem {
  id: string;
  name: string;
  /** Hosted wordmark image URL; falls back to a styled text span when absent. */
  logo?: string;
}

export interface HeroPhotographyContent {
  /**
   * Decorative tile / mock-UI labels, keyed per template ("paletteLabel",
   * "recLabel", …). Shared across every Bespoke hero variant, which reuse this
   * content type but each render a different set of props in their artwork.
   * Unset keys fall back to the copy the template shipped with.
   */
  tileLabels?: Record<string, string>;
  /**
   * Decorative list content inside hero artwork (category pills, case-status
   * steps), keyed per template. Same fallback rule as `tileLabels`: an unset
   * key renders the list the template shipped with.
   */
  tileItems?: Record<string, string[]>;
  eyebrow?: string;
  headline: string;
  headlineAccent?: string;
  /** Optional 3rd headline line rendered after the accent line (hero-quant-institute). */
  headlineSuffix?: string;
  description?: string;
  primaryCta?: CTAButton;
  secondaryCta?: CTAButton;
  image?: string;
  imageAlt?: string;
  stats?: HeroPhotographyStat[];
  /** Optional set of uploadable media cards (used by carousel/marquee heroes). */
  gallery?: HeroGalleryItem[];
  trust?: string;
  /** Optional trusted-by institution wordmarks (hero-quant-institute). */
  institutions?: HeroInstitutionItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface RecipesCookingItem {
  id: string;
  title: string;
  category: string;
  time: string;
  level: string;
  image: string;
}

export interface RecipesCookingContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: RecipesCookingItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface ProgramsFitnessItem {
  id: string;
  title: string;
  level: string;
  duration: string;
  sessions: string;
  image: string;
}

export interface ProgramsFitnessContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: ProgramsFitnessItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface GenresMusicItem {
  id: string;
  title: string;
  tracks: string;
  level: string;
  image: string;
}

export interface GenresMusicContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: GenresMusicItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface OutcomesBusinessMetric {
  id: string;
  value: string;
  label: string;
  description: string;
}

export interface OutcomesBusinessContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  metrics: OutcomesBusinessMetric[];
  textStyles?: Record<string, TextStyle>;
}

export interface ArtsGalleryItem {
  id: string;
  title: string;
  medium: string;
  image: string;
}

export interface ArtsGalleryContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: ArtsGalleryItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface KidsPathStep {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

export interface KidsPathContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  steps: KidsPathStep[];
  textStyles?: Record<string, TextStyle>;
}

export interface FinanceMarketsTicker {
  id: string;
  symbol: string;
  name: string;
  price: string;
  change: string;
  up: boolean;
}

export interface FinanceMarketsStat {
  id: string;
  value: string;
  label: string;
}

export interface FinanceMarketsContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  tickers: FinanceMarketsTicker[];
  stats?: FinanceMarketsStat[];
  textStyles?: Record<string, TextStyle>;
}

export interface LanguagePhrasesItem {
  id: string;
  phrase: string;
  translation: string;
  language: string;
}

export interface LanguagePhrasesContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: LanguagePhrasesItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface SkillsTracksItem {
  id: string;
  title: string;
  level: string;
  lessons: string;
  image: string;
}

export interface SkillsTracksContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: SkillsTracksItem[];
  textStyles?: Record<string, TextStyle>;
}

/** Shared content shapes for per-niche bespoke body sections (features / testimonials / cta). */
export interface NicheFeatureItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface NicheFeaturesContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: NicheFeatureItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface NicheTestimonialItem {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatar?: string;
  rating?: number;
}

export interface NicheTestimonialsContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: NicheTestimonialItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface NicheCtaAction {
  text: string;
  href: string;
  hidden?: boolean;
}

export interface NicheCtaContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  primaryCta: NicheCtaAction;
  secondaryCta?: NicheCtaAction;
  textStyles?: Record<string, TextStyle>;
}

export interface FeatureBentoItem {
  id: string;
  icon?: string;
  title: string;
  description: string;
  size?: "sm" | "md" | "lg";
  image?: string;
}

export interface FeatureBentoContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: FeatureBentoItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface StatsBandStat {
  id: string;
  value: string;
  label: string;
}

export interface StatsBandLogo {
  id: string;
  image: string;
  alt?: string;
}

export interface StatsBandContent {
  /** Caption above the logo row. Defaults to "Trusted by teams everywhere". */
  logosLabel?: string;
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  stats: StatsBandStat[];
  logos?: StatsBandLogo[];
  textStyles?: Record<string, TextStyle>;
}

export interface AboutPhotographyCredential {
  id: string;
  icon?: string;
  title: string;
  description: string;
}

export interface AboutPhotographyContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  secondaryDescription?: string;
  image?: string;
  imageAlt?: string;
  credentials?: AboutPhotographyCredential[];
  textStyles?: Record<string, TextStyle>;
}

export interface FeaturesPhotographyItem {
  id: string;
  icon?: string;
  title: string;
  description: string;
}

export interface FeaturesPhotographyContent {
  headline: string;
  features: FeaturesPhotographyItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface GalleryPhotographyItem {
  id: string;
  image: string;
  alt: string;
}

export interface GalleryPhotographyContent {
  headline: string;
  description?: string;
  items: GalleryPhotographyItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface TestimonialsPhotographyItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  avatar?: string;
  rating?: number;
}

export interface TestimonialsPhotographyContent {
  headline: string;
  testimonials: TestimonialsPhotographyItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface FaqPhotographyItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqPhotographyContent {
  headline: string;
  items: FaqPhotographyItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface CtaPhotographyContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  primaryCta?: CTAButton;
  secondaryCta?: CTAButton;
  guaranteeText?: string;
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// Astrology Landing Page section content types
// ============================================

export interface HeroAstrologySlide {
  id: string;
  image: string;
  imageAlt?: string;
}

export interface HeroAstrologyStat {
  id: string;
  value: string;
  label: string;
}

export interface HeroAstrologyContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  primaryCta?: CTAButton;
  secondaryCta?: CTAButton;
  slides?: HeroAstrologySlide[];
  stats?: HeroAstrologyStat[];
  textStyles?: Record<string, TextStyle>;
}

export interface AboutAstrologyCredential {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface AboutAstrologyContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  secondaryDescription?: string;
  image?: string;
  imageAlt?: string;
  credentials?: AboutAstrologyCredential[];
  textStyles?: Record<string, TextStyle>;
}

export interface ServicesAstrologyItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface ServicesAstrologyContent {
  headline: string;
  description?: string;
  services?: ServicesAstrologyItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface TestimonialsAstrologyItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  avatar?: string;
  rating: number;
}

export interface TestimonialsAstrologyContent {
  headline: string;
  testimonials?: TestimonialsAstrologyItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface FaqAstrologyItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqAstrologyContent {
  headline: string;
  items?: FaqAstrologyItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface CtaAstrologyContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  backgroundImage?: string;
  primaryCta?: CTAButton;
  secondaryCta?: CTAButton;
  guaranteeText?: string;
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// Subscription Page section content types
// ============================================

export interface SubscriptionHeroContent {
  headline: string;
  subheadline: string;
  primaryCta: CTAButton;
  secondaryCta?: CTAButton;
  trustBadges: Array<{ id: string; label: string }>;
  stats: Array<{ id: string; value: string; label: string }>;
  textStyles?: Record<string, TextStyle>;
}

export interface SubscriptionFeatureItem {
  id: string;
  title: string;
  description?: string;
}

export interface SubscriptionFeatureCategory {
  id: string;
  label: string;
  subtitle?: string;
  items: SubscriptionFeatureItem[];
}

export interface SubscriptionFeaturesContent {
  /** Pill above the heading. Defaults to "Everything you get". */
  badgeLabel?: string;
  headline: string;
  subheadline?: string;
  categories: SubscriptionFeatureCategory[];
  textStyles?: Record<string, TextStyle>;
}

export interface SubscriptionComparisonRow {
  id: string;
  feature: string;
  freeValue: string | boolean;
  paidValue: string | boolean;
}

export interface SubscriptionComparisonContent {
  /** Heading of the first comparison-table column. Defaults to "Feature". */
  featureColumnLabel?: string;
  headline: string;
  subheadline?: string;
  freeColumnLabel: string;
  paidColumnLabel: string;
  rows: SubscriptionComparisonRow[];
  textStyles?: Record<string, TextStyle>;
}

export interface SubscriptionPricingContent {
  /** Billing-cycle toggle labels. Default to "Monthly" / "Yearly". */
  monthlyLabel?: string;
  yearlyLabel?: string;
  /** Badge on the highlighted plan. Defaults to "Best Value". */
  popularBadgeLabel?: string;
  headline: string;
  subheadline?: string;
  ctaText: string;
  showCouponField: boolean;
  features: string[];
  textStyles?: Record<string, TextStyle>;
  // NOTE: Actual plan data (prices, billing cycles, currency) comes from API at render time
  // Injected at runtime via __liveData (not stored in DB)
  __liveData?: Record<string, unknown>;
}

export interface SubscriptionFaqContent {
  /** Pill above the heading. Defaults to "FAQ". */
  badgeLabel?: string;
  headline: string;
  subheadline?: string;
  items: FAQItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface SubscriptionCtaContent {
  headline: string;
  subheadline?: string;
  primaryCta: CTAButton;
  textStyles?: Record<string, TextStyle>;
}

// ============================================
// Exam Prep Template section content types
// ============================================

export interface HeroExamprepStat {
  id: string;
  value: string;
  label: string;
}

export interface HeroExamprepContent {
  badge?: string;
  headline: string;
  headlineAccent?: string;
  description?: string;
  primaryCta?: CTAButton;
  image?: string;
  imageAlt?: string;
  stats?: HeroExamprepStat[];
  textStyles?: Record<string, TextStyle>;
}

export interface FeaturesExamprepItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  link?: string;
}

export interface FeaturesExamprepContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  features: FeaturesExamprepItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface LearningPathStep {
  id: string;
  text: string;
}

export interface LearningPathCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  steps: LearningPathStep[];
  price: string;
  originalPrice?: string;
  discount?: string;
  ctaText?: string;
  ctaHref?: string;
  accentColor?: string;
}

export interface LearningPathsExamprepContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  paths: LearningPathCard[];
  textStyles?: Record<string, TextStyle>;
}

export interface AboutExamprepCredential {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface AboutExamprepContent {
  badge?: string;
  headline: string;
  headlineAccent?: string;
  description?: string;
  secondaryDescription?: string;
  image?: string;
  imageAlt?: string;
  credentials: AboutExamprepCredential[];
  primaryCta?: CTAButton;
  textStyles?: Record<string, TextStyle>;
}

export interface TestimonialsExamprepItem {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  initials?: string;
}

export interface TestimonialsExamprepContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  testimonials: TestimonialsExamprepItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface FaqExamprepItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqExamprepContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  items: FaqExamprepItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface CtaExamprepContent {
  headline: string;
  description?: string;
  primaryCta?: CTAButton;
  textStyles?: Record<string, TextStyle>;
}

export interface TrustedByItem {
  id: string;
  icon: string;
  name: string;
}

export interface TrustedByGovtexamContent {
  label?: string;
  items: TrustedByItem[];
  textStyles?: Record<string, TextStyle>;
}

export interface FeaturesSplitColumn {
  icon: string;
  headline: string;
  description?: string;
  checkItems: Array<{ id: string; title: string; description: string }>;
  linkText?: string;
  linkHref?: string;
}

export interface FeaturesSplitCorpupskillContent {
  columns: [FeaturesSplitColumn, FeaturesSplitColumn];
  textStyles?: Record<string, TextStyle>;
}

export interface AnalyticsStat {
  id: string;
  value: string;
  label: string;
}

export interface AnalyticsHighlight {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface AnalyticsCorpupskillContent {
  badge?: string;
  headline: string;
  description?: string;
  /** Subtitle under "Your Skill Development" in the chart card (HTML: "Current Progress - Q4 2024") */
  chartCardSubtitle?: string;
  highlights: AnalyticsHighlight[];
  /** @deprecated Stats grid removed from UI; kept optional for legacy page JSON */
  stats?: AnalyticsStat[];
  /** Bar chart rows matching design: skill name + progress 0–100 */
  chartBars?: Array<{ id: string; label: string; value: number }>;
  textStyles?: Record<string, TextStyle>;
}

export interface HeroSlide {
  id: string;
  image: string;
  imageAlt?: string;
  badge: string;
  headlineLine1: string;
  headlineAccent: string;
  headlineLine3: string;
  subtitle: string;
  description: string;
  cornerBadge?: string;
}

export interface HeroSliderCorpupskillContent {
  slides: HeroSlide[];
  primaryCta?: CTAButton;
  textStyles?: Record<string, TextStyle>;
}

export interface SolutionCard {
  id: string;
  image?: string;
  badge: string;
  title: string;
  description?: string;
  rating?: string;
  ratingCount?: string;
  duration?: string;
}

export interface SolutionsGridCorpupskillContent {
  badge?: string;
  headline: string;
  description?: string;
  cards: SolutionCard[];
  exploreCta?: { headline?: string; text: string; href: string };
  textStyles?: Record<string, TextStyle>;
}

export interface TestimonialCorpupskill {
  id: string;
  name: string;
  role: string;
  quote: string;
  /** Optional outcome line (e.g. promotion timeline), shown as caption like UPSC-style cards */
  metricValue: string;
  metricLabel: string;
  /** Star rating 1–5 (same as IIT JEE / Govt Exam testimonials) */
  rating?: number;
  /** @deprecated No longer used in UI; kept for existing saved pages */
  highlighted?: boolean;
  initials: string;
}

export interface TestimonialsCorpupskillContent {
  badge?: string;
  headline: string;
  /** Optional subcopy under headline (Mindfulness / Exam Prep pattern) */
  description?: string;
  testimonials: TestimonialCorpupskill[];
  textStyles?: Record<string, TextStyle>;
}

export interface TrustBadge {
  id: string;
  icon: string;
  text: string;
}

export interface CtaCorpupskillContent {
  headline: string;
  description?: string;
  /** Full-bleed background photo (dark overlay applied for readability) */
  backgroundImage?: string;
  backgroundImageAlt?: string;
  primaryCta?: CTAButton;
  trustBadges?: TrustBadge[];
  textStyles?: Record<string, TextStyle>;
}

export interface ExamCategoryItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface ExamCategoriesGovtexamContent {
  headline: string;
  headlineAccent?: string;
  description?: string;
  categories: ExamCategoryItem[];
  textStyles?: Record<string, TextStyle>;
}

/**
 * Custom HTML block section: a tenant's own HTML/CSS/JS document rendered in a
 * sandboxed iframe, auto-sized to its content. The field is named `customHtml`
 * (not `html`) so it reuses the pages-route XSS-sanitizer exemption that keeps
 * <style>/<script> intact on save.
 */
export interface CustomHtmlContent {
  customHtml: string;
  /** Fallback height (px) before the iframe reports its real content height. */
  minHeight?: number;
}

// Union type for all content types
export type SectionContentMap = {
  header: HeaderContent;
  footer: FooterContent;
  hero: HeroContent;
  "hero-code-tech": HeroCodeTechContent;
  "testimonials-scroll-code-tech": TestimonialsScrollCodeTechContent;
  "features-grid": FeaturesContent;
  "features-list": FeaturesContent;
  "features-tabs": FeaturesContent;
  "features-accordion": FeaturesContent;
  "testimonials-carousel": TestimonialsContent;
  "testimonials-grid": TestimonialsContent;
  "logo-cloud": LogoCloudContent;
  "stats-counter": StatsContent;
  about: AboutContent;
  team: TeamContent;
  timeline: TimelineContent;
  gallery: GalleryContent;
  "cta-banner": CTAContent;
  "cta-split": CTAContent;
  "pricing-table": PricingContent;
  "faq-accordion": FAQContent;
  "contact-form": ContactFormContent;
  "login-form": LoginFormContent;
  "member-profile": MemberProfileContent;
  "about-page": AboutPageContent;
  "contact-page": ContactPageContent;
  "pricing-page": PricingPageContent;
  "faq-page": FAQPageContent;
  "privacy-page": PrivacyPageContent;
  "terms-page": TermsPageContent;
  "cart-page": CartPageContent;
  "bookmark-page": BookmarkPageContent;
  "course-cards": CourseCardsContent;
  "book-showcase": BookShowcaseContent;
  // Content Listing sections
  "all-courses-listing": ContentListingContent;
  "self-paced-courses-listing": ContentListingContent;
  "custom-html": CustomHtmlContent;
  "books-listing": ContentListingContent;
  "bundles-listing": ContentListingContent;
  "categories-listing": ContentListingContent;
  "test-series-listing": ContentListingContent;
  // Course Page Sections
  "course-hero": CourseHeroContent;
  "course-curriculum": CourseCurriculumContent;
  "course-offerings": CourseOfferingsContent;
  "course-instructor": CourseInstructorContent;
  "course-prerequisites": CoursePrerequisitesContent;
  "course-learning-outcomes": CourseLearningOutcomesContent;
  // Book Page Sections (content shape varies; cast at use site)
  "book-hero": Record<string, unknown>;
  "book-description": Record<string, unknown>;
  "book-offerings": Record<string, unknown>;
  "book-author": Record<string, unknown>;
  "book-recommendations": Record<string, unknown>;
  // About Us Page Sections
  "about-us-hero": AboutUsHeroContent;
  "about-us-mission": AboutUsMissionContent;
  "about-us-offerings": AboutUsOfferingsContent;
  "about-us-values": AboutUsValuesContent;
  "about-us-contact": AboutUsContactContent;
  // Contact Us Page Sections
  "contact-us-hero": ContactUsHeroContent;
  "contact-us-info": ContactUsInfoContent;
  "contact-us-form": ContactUsFormContent;
  // FAQ Page Sections
  "faq-us-hero": FaqUsHeroContent;
  "faq-us-list": FaqUsListContent;
  // Privacy Policy Page Sections
  "privacy-us-hero": PrivacyUsHeroContent;
  "privacy-us-content": PrivacyUsContentContent;
  // Terms of Service Page Sections
  "terms-us-hero": TermsUsHeroContent;
  "terms-us-content": TermsUsContentContent;
  // Mindfulness Template Sections
  "hero-mindfulness": HeroMindfulnessContent;
  "teach-mindfulness": TeachMindfulnessContent;
  "how-it-works-mindfulness": HowItWorksMindfulnessContent;
  "testimonials-mindfulness": TestimonialsMindfulnessContent;
  "cta-mindfulness": CtaMindfulnessContent;
  "roadmap-mindfulness": RoadmapMindfulnessContent;
  // Photography Landing Page Sections
  "hero-photography": HeroPhotographyContent;
  "hero-cooking": HeroPhotographyContent;
  "recipes-cooking": RecipesCookingContent;
  "features-cooking": NicheFeaturesContent;
  "testimonials-cooking": NicheTestimonialsContent;
  "cta-cooking": NicheCtaContent;
  "hero-cooking-alt": HeroPhotographyContent;
  "hero-fitness": HeroPhotographyContent;
  "programs-fitness": ProgramsFitnessContent;
  "hero-fitness-alt": HeroPhotographyContent;
  "hero-music": HeroPhotographyContent;
  "genres-music": GenresMusicContent;
  "hero-music-alt": HeroPhotographyContent;
  "hero-business": HeroPhotographyContent;
  "outcomes-business": OutcomesBusinessContent;
  "hero-business-alt": HeroPhotographyContent;
  "hero-arts": HeroPhotographyContent;
  "hero-arts-alt": HeroPhotographyContent;
  "hero-arts-v3": HeroPhotographyContent;
  "gallery-arts": ArtsGalleryContent;
  "hero-kids": HeroPhotographyContent;
  "hero-kids-alt": HeroPhotographyContent;
  "hero-kids-v3": HeroPhotographyContent;
  "path-kids": KidsPathContent;
  "hero-finance": HeroPhotographyContent;
  "hero-finance-alt": HeroPhotographyContent;
  "hero-finance-v3": HeroPhotographyContent;
  "hero-design": HeroPhotographyContent;
  "hero-data-ai": HeroPhotographyContent;
  "hero-medical": HeroPhotographyContent;
  "hero-beauty": HeroPhotographyContent;
  "hero-study-abroad": HeroPhotographyContent;
  "hero-marketing": HeroPhotographyContent;
  "hero-cyber": HeroPhotographyContent;
  "hero-realestate": HeroPhotographyContent;
  "hero-cloud": HeroPhotographyContent;
  "hero-accounting": HeroPhotographyContent;
  "hero-law": HeroPhotographyContent;
  "hero-film": HeroPhotographyContent;
  "hero-startup": HeroPhotographyContent;
  "hero-fashion": HeroPhotographyContent;
  "hero-interior": HeroPhotographyContent;
  "hero-yoga": HeroPhotographyContent;
  "hero-dance": HeroPhotographyContent;
  "hero-codekids": HeroPhotographyContent;
  "hero-speaking": HeroPhotographyContent;
  "hero-hospitality": HeroPhotographyContent;
  "hero-spiritual": HeroPhotographyContent;
  "feature-bento": FeatureBentoContent;
  "stats-band": StatsBandContent;
  "markets-finance": FinanceMarketsContent;
  "hero-language": HeroPhotographyContent;
  "hero-language-alt": HeroPhotographyContent;
  "phrases-language": LanguagePhrasesContent;
  "hero-skills": HeroPhotographyContent;
  "tracks-skills": SkillsTracksContent;
  "hero-quant": HeroPhotographyContent;
  "hero-quant-institute": HeroPhotographyContent;
  "features-fitness": NicheFeaturesContent;
  "testimonials-fitness": NicheTestimonialsContent;
  "cta-fitness": NicheCtaContent;
  "features-music": NicheFeaturesContent;
  "testimonials-music": NicheTestimonialsContent;
  "cta-music": NicheCtaContent;
  "features-business": NicheFeaturesContent;
  "testimonials-business": NicheTestimonialsContent;
  "cta-business": NicheCtaContent;
  "features-arts": NicheFeaturesContent;
  "testimonials-arts": NicheTestimonialsContent;
  "cta-arts": NicheCtaContent;
  "features-kids": NicheFeaturesContent;
  "testimonials-kids": NicheTestimonialsContent;
  "cta-kids": NicheCtaContent;
  "features-finance": NicheFeaturesContent;
  "testimonials-finance": NicheTestimonialsContent;
  "cta-finance": NicheCtaContent;
  "features-language": NicheFeaturesContent;
  "testimonials-language": NicheTestimonialsContent;
  "cta-language": NicheCtaContent;
  "features-skills": NicheFeaturesContent;
  "testimonials-skills": NicheTestimonialsContent;
  "cta-skills": NicheCtaContent;
  "about-photography": AboutPhotographyContent;
  "features-photography": FeaturesPhotographyContent;
  "gallery-photography": GalleryPhotographyContent;
  "testimonials-photography": TestimonialsPhotographyContent;
  "cta-photography": CtaPhotographyContent;
  "faq-photography": FaqPhotographyContent;
  "courses-listing-photography": ContentListingContent;
  "books-listing-photography": ContentListingContent;
  // Astrology Landing Page Sections
  "hero-astrology": HeroAstrologyContent;
  "about-astrology": AboutAstrologyContent;
  "services-astrology": ServicesAstrologyContent;
  "testimonials-astrology": TestimonialsAstrologyContent;
  "faq-astrology": FaqAstrologyContent;
  "cta-astrology": CtaAstrologyContent;
  "courses-listing-astrology": ContentListingContent;
  "self-paced-courses-listing-astrology": ContentListingContent;
  "books-listing-astrology": ContentListingContent;
  // Subscription Page Sections
  "subscription-hero": SubscriptionHeroContent;
  "subscription-features": SubscriptionFeaturesContent;
  "subscription-comparison": SubscriptionComparisonContent;
  "subscription-pricing": SubscriptionPricingContent;
  "subscription-faq": SubscriptionFaqContent;
  "subscription-cta": SubscriptionCtaContent;
  // Exam Prep Template Sections
  "hero-examprep": HeroExamprepContent;
  "features-examprep": FeaturesExamprepContent;
  "learning-paths-examprep": RoadmapMindfulnessContent;
  "about-examprep": AboutExamprepContent;
  "testimonials-examprep": TestimonialsExamprepContent;
  "faq-examprep": FaqExamprepContent;
  "cta-examprep": CtaExamprepContent;
  "courses-listing-examprep": ContentListingContent;
  "self-paced-courses-listing-examprep": ContentListingContent;
  "books-listing-examprep": ContentListingContent;
  // Test Prep (All Govt Exams) Template Sections
  "hero-govtexam": HeroExamprepContent;
  "features-govtexam": FeaturesExamprepContent;
  "learning-paths-govtexam": RoadmapMindfulnessContent;
  "about-govtexam": AboutExamprepContent;
  "testimonials-govtexam": TestimonialsExamprepContent;
  "faq-govtexam": FaqExamprepContent;
  "cta-govtexam": CtaExamprepContent;
  "courses-listing-govtexam": ContentListingContent;
  "self-paced-courses-listing-govtexam": ContentListingContent;
  "books-listing-govtexam": ContentListingContent;
  "exam-categories-govtexam": ExamCategoriesGovtexamContent;
  "trusted-by-govtexam": TrustedByGovtexamContent;
  "hero-corpupskill": HeroSliderCorpupskillContent;
  "trusted-by-corpupskill": TrustedByGovtexamContent;
  "features-split-corpupskill": FeaturesSplitCorpupskillContent;
  "analytics-corpupskill": AnalyticsCorpupskillContent;
  "solutions-grid-corpupskill": SolutionsGridCorpupskillContent;
  "testimonials-corpupskill": TestimonialsCorpupskillContent;
  "cta-corpupskill": CtaCorpupskillContent;
  "self-paced-courses-listing-corpupskill": ContentListingContent;
  "books-listing-corpupskill": ContentListingContent;
};
