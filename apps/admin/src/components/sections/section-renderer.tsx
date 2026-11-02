"use client";

import {
  AboutSection,
  AboutPageSection,
  ContactFormSection,
  ContactPageSection,
  CTABannerSection,
  FAQAccordionSection,
  FaqPageSection,
  FeaturesGridSection,
  CustomHtmlSection,
  HeroCodeTechSection,
  HeroSection,
  LoginFormSection,
  LogoCloudSection,
  PricingPageSection,
  PricingTableSection,
  PrivacyPageSection,
  SectionEditorProvider,
  StatsCounterSection,
  TermsPageSection,
  TestimonialsGridSection,
  TestimonialsScrollCodeTechSection,
  ContentListingSection,
  AboutUsHeroSection,
  AboutUsMissionSection,
  AboutUsOfferingsSection,
  AboutUsValuesSection,
  FoundersSection,
  TeamSection,
  AboutUsContactSection,
  ContactUsHeroSection,
  ContactUsInfoSection,
  ContactUsFormSection,
  FaqUsHeroSection,
  FaqUsListSection,
  PrivacyUsHeroSection,
  PrivacyUsContentSection,
  TermsUsHeroSection,
  TermsUsContentSection,
  HeroCookingSection,
  RecipesCookingSection,
  HeroFitnessSection,
  ProgramsFitnessSection,
  HeroMusicSection,
  GenresMusicSection,
  HeroBusinessSection,
  OutcomesBusinessSection,
  HeroQuantSection,
  HeroQuantInstituteSection,
  HeroArtsSection,
  HeroArtsAltSection,
  ArtsGallerySection,
  HeroKidsSection,
  HeroKidsAltSection,
  HeroArtsV3Section,
  HeroKidsV3Section,
  HeroFinanceV3Section,
  HeroDesignSection,
  HeroDataSection,
  HeroMedicalSection,
  HeroBeautySection,
  HeroStudySection,
  HeroMarketingSection,
  HeroCyberSection,
  HeroRealEstateSection,
  HeroCloudSection,
  HeroAccountingSection,
  HeroLawSection,
  HeroFilmSection,
  HeroStartupSection,
  HeroFashionSection,
  HeroInteriorSection,
  HeroYogaSection,
  HeroDanceSection,
  HeroCodeKidsSection,
  HeroSpeakingSection,
  HeroHospitalitySection,
  HeroSpiritualSection,
  FeatureBento,
  StatsBand,
  KidsPathSection,
  HeroFinanceSection,
  HeroFinanceAltSection,
  FinanceMarketsSection,
  HeroLanguageSection,
  HeroLanguageAltSection,
  LanguagePhrasesSection,
  HeroSkillsSection,
  SkillsTracksSection,
  FeaturesCookingSection,
  TestimonialsCookingSection,
  CtaCookingSection,
  FeaturesFitnessSection,
  TestimonialsFitnessSection,
  CtaFitnessSection,
  FeaturesMusicSection,
  TestimonialsMusicSection,
  CtaMusicSection,
  FeaturesBusinessSection,
  TestimonialsBusinessSection,
  CtaBusinessSection,
  FeaturesArtsSection,
  TestimonialsArtsSection,
  CtaArtsSection,
  FeaturesKidsSection,
  TestimonialsKidsSection,
  CtaKidsSection,
  FeaturesFinanceSection,
  TestimonialsFinanceSection,
  CtaFinanceSection,
  FeaturesLanguageSection,
  TestimonialsLanguageSection,
  CtaLanguageSection,
  FeaturesSkillsSection,
  TestimonialsSkillsSection,
  CtaSkillsSection,
  HeroCookingAltSection,
  HeroFitnessAltSection,
  HeroMusicAltSection,
  HeroBusinessAltSection,
  HeroPhotographySection,
  AboutPhotographySection,
  FeaturesPhotographySection,
  GalleryPhotographySection,
  TestimonialsPhotographySection,
  FaqPhotographySection,
  CtaPhotographySection,
  CoursesListingPhotographySection,
  BooksListingPhotographySection,
  HeroAstrologySection,
  AboutAstrologySection,
  ServicesAstrologySection,
  TestimonialsAstrologySection,
  FaqAstrologySection,
  CtaAstrologySection,
  CoursesListingAstrologySection,
  BooksListingAstrologySection,
  SubscriptionHeroSection,
  SubscriptionFeaturesSection,
  SubscriptionComparisonSection,
  SubscriptionPricingSection,
  SubscriptionFaqSection,
  SubscriptionCtaSection,
  HeroMindfulnessSection,
  TeachMindfulnessSection,
  HowItWorksMindfulnessSection,
  TestimonialsMindfulnessSection,
  CtaMindfulnessSection,
  RoadmapMindfulnessSection,
  HeroExamprepSection,
  FeaturesExamprepSection,
  LearningPathsExamprepSection,
  AboutExamprepSection,
  TestimonialsExamprepSection,
  FaqExamprepSection,
  CtaExamprepSection,
  ExamCategoriesGovtexamSection,
  TrustedByGovtexamSection,
  FeaturesSplitCorpupskillSection,
  AnalyticsCorpupskillSection,
  TrustedByCorpupskillSection,
  HeroSliderCorpupskillSection,
  SolutionsGridCorpupskillSection,
  TestimonialsCorpupskillSection,
  CtaCorpupskillSection,
  type SharedLinkProps,
} from "@open-mtlms/core";
import type {
  ContentListingItem,
  SectionConfig,
  TestimonialScrollItem,
  TextStyle,
  ThemeConfig,
} from "@open-mtlms/shared";
import { getTenantOrgImageUrl } from "@open-mtlms/shared/constants";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EditableImage } from "@/components/editor/editable-image";
import { EditableMedia } from "@/components/editor/editable-media";
import { EditableText } from "@/components/editor/editable-text";
import { fetchPublishedBooks } from "@/lib/api/published-books";
import { fetchPublishedBundles } from "@/lib/api/published-bundles";
import { fetchPublishedCategories } from "@/lib/api/published-categories";
import { fetchPublishedCourses } from "@/lib/api/published-courses";
import {
  fetchPublishedTestSeries,
  getTestSeriesCoverUrl,
} from "@/lib/api/published-test-series";
import { testimonialsApi } from "@/lib/api/testimonials";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import { EditModeProvider, useEditMode } from "@/lib/contexts/edit-mode-context";
import { SectionStyleProvider } from "@/lib/contexts/section-style-context";
import { useTenantWebHost } from "@/lib/hooks/use-tenant-domain-url";
import { useOrgDetails } from "@/lib/hooks/use-tenant-org";
import { cachedInPreview } from "@/lib/preview-cache";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useTenantStore } from "@/lib/stores/tenant-store";

import { BookmarkPageSection } from "./bookmark-page";
import { CartPageSection } from "./cart-page";
import { CourseCurriculumSection } from "./course-curriculum";
import { CourseHeroSection } from "./course-hero";
import { CourseInstructorSection } from "./course-instructor";
import { CourseLearningOutcomesSection } from "./course-learning-outcomes";
import { CourseOfferingsSection } from "./course-offerings";
import { CoursePrerequisitesSection } from "./course-prerequisites";
import { MemberProfileSection } from "./member-profile-section";
import { SectionWrapper, AddSectionDivider } from "./section-wrapper";

interface SectionRendererProps {
  sections: SectionConfig[];
  theme?: ThemeConfig;
  editMode?: boolean;
  // Force the color mode instead of following the global `.dark` class. Needed
  // for the standalone template preview, where the app's next-themes provider
  // pins the root class to light and would override a manual toggle.
  forceColorMode?: "light" | "dark";
  contentEditable?: boolean; // If false, only theme/arrangement editing allowed (for course templates)
  restrictedSectionTypes?: string[]; // Section types that should be completely static
  disableDeleteDuplicate?: boolean; // If true, hide delete and duplicate buttons in section toolbar
}

const sectionComponents: Record<string, React.ComponentType<{ section: SectionConfig }>> = {
  hero: HeroSection,
  "hero-code-tech": HeroCodeTechSection,
  "testimonials-scroll-code-tech": TestimonialsScrollCodeTechSection,
  "custom-html": CustomHtmlSection,
  "features-grid": FeaturesGridSection,
  "features-list": FeaturesGridSection,
  "features-tabs": FeaturesGridSection,
  "features-accordion": FeaturesGridSection,
  "testimonials-carousel": TestimonialsGridSection,
  "testimonials-grid": TestimonialsGridSection,
  "logo-cloud": LogoCloudSection,
  "stats-counter": StatsCounterSection,
  "cta-banner": CTABannerSection,
  "cta-split": CTABannerSection,
  "pricing-table": PricingTableSection,
  "faq-accordion": FAQAccordionSection,
  faq: FAQAccordionSection,
  "contact-form": ContactFormSection,
  "login-form": LoginFormSection,
  "member-profile": MemberProfileSection,
  "about-page": AboutPageSection,
  "contact-page": ContactPageSection,
  "pricing-page": PricingPageSection,
  "faq-page": FaqPageSection,
  "privacy-page": PrivacyPageSection,
  "terms-page": TermsPageSection,
  "cart-page": CartPageSection,
  "bookmark-page": BookmarkPageSection,
  // Content sections
  about: AboutSection,
  timeline: FeaturesGridSection,
  gallery: FeaturesGridSection,
  // Catalog sections
  "course-cards": ContentListingSection,
  "book-showcase": ContentListingSection,
  // Content Listing sections
  "all-courses-listing": ContentListingSection,
  "self-paced-courses-listing": ContentListingSection,
  "books-listing": ContentListingSection,
  "bundles-listing": ContentListingSection,
  "categories-listing": ContentListingSection,
  "test-series-listing": ContentListingSection,
  // About Us Page Sections
  "about-us-hero": AboutUsHeroSection,
  "about-us-mission": AboutUsMissionSection,
  "about-us-offerings": AboutUsOfferingsSection,
  "about-us-values": AboutUsValuesSection,
  // "team" used to point at FeaturesGridSection, a generic features grid that
  // ignores members, roles and photos, so a Team section rendered the wrong
  // thing entirely even though the type and its default content were right.
  founders: FoundersSection,
  team: TeamSection,
  "about-us-contact": AboutUsContactSection,
  // Contact Us Page Sections
  "contact-us-hero": ContactUsHeroSection,
  "contact-us-info": ContactUsInfoSection,
  "contact-us-form": ContactUsFormSection,
  // FAQ Page Sections
  "faq-us-hero": FaqUsHeroSection,
  "faq-us-list": FaqUsListSection,
  // Privacy Policy Page Sections
  "privacy-us-hero": PrivacyUsHeroSection,
  "privacy-us-content": PrivacyUsContentSection,
  // Terms of Service Page Sections
  "terms-us-hero": TermsUsHeroSection,
  "terms-us-content": TermsUsContentSection,
  // Photography Landing Page Sections
  "hero-photography": HeroPhotographySection,
  "hero-cooking": HeroCookingSection,
  "recipes-cooking": RecipesCookingSection,
  "hero-fitness": HeroFitnessSection,
  "programs-fitness": ProgramsFitnessSection,
  "hero-music": HeroMusicSection,
  "genres-music": GenresMusicSection,
  "hero-business": HeroBusinessSection,
  "outcomes-business": OutcomesBusinessSection,
  "hero-quant": HeroQuantSection,
  "hero-quant-institute": HeroQuantInstituteSection,
  "hero-cooking-alt": HeroCookingAltSection,
  "hero-fitness-alt": HeroFitnessAltSection,
  "hero-music-alt": HeroMusicAltSection,
  "hero-business-alt": HeroBusinessAltSection,
  "hero-arts": HeroArtsSection,
  "hero-arts-alt": HeroArtsAltSection,
  "hero-arts-v3": HeroArtsV3Section,
  "hero-kids-v3": HeroKidsV3Section,
  "hero-finance-v3": HeroFinanceV3Section,
  "hero-design": HeroDesignSection,
  "hero-data-ai": HeroDataSection,
  "hero-medical": HeroMedicalSection,
  "hero-beauty": HeroBeautySection,
  "hero-study-abroad": HeroStudySection,
  "hero-marketing": HeroMarketingSection,
  "hero-cyber": HeroCyberSection,
  "hero-realestate": HeroRealEstateSection,
  "hero-cloud": HeroCloudSection,
  "hero-accounting": HeroAccountingSection,
  "hero-law": HeroLawSection,
  "hero-film": HeroFilmSection,
  "hero-startup": HeroStartupSection,
  "hero-fashion": HeroFashionSection,
  "hero-interior": HeroInteriorSection,
  "hero-yoga": HeroYogaSection,
  "hero-dance": HeroDanceSection,
  "hero-codekids": HeroCodeKidsSection,
  "hero-speaking": HeroSpeakingSection,
  "hero-hospitality": HeroHospitalitySection,
  "hero-spiritual": HeroSpiritualSection,
  "feature-bento": FeatureBento,
  "stats-band": StatsBand,
  "gallery-arts": ArtsGallerySection,
  "hero-kids": HeroKidsSection,
  "hero-kids-alt": HeroKidsAltSection,
  "path-kids": KidsPathSection,
  "hero-finance": HeroFinanceSection,
  "hero-finance-alt": HeroFinanceAltSection,
  "markets-finance": FinanceMarketsSection,
  "hero-language": HeroLanguageSection,
  "hero-language-alt": HeroLanguageAltSection,
  "phrases-language": LanguagePhrasesSection,
  "hero-skills": HeroSkillsSection,
  "tracks-skills": SkillsTracksSection,
  "features-cooking": FeaturesCookingSection,
  "testimonials-cooking": TestimonialsCookingSection,
  "cta-cooking": CtaCookingSection,
  "features-fitness": FeaturesFitnessSection,
  "testimonials-fitness": TestimonialsFitnessSection,
  "cta-fitness": CtaFitnessSection,
  "features-music": FeaturesMusicSection,
  "testimonials-music": TestimonialsMusicSection,
  "cta-music": CtaMusicSection,
  "features-business": FeaturesBusinessSection,
  "testimonials-business": TestimonialsBusinessSection,
  "cta-business": CtaBusinessSection,
  "features-arts": FeaturesArtsSection,
  "testimonials-arts": TestimonialsArtsSection,
  "cta-arts": CtaArtsSection,
  "features-kids": FeaturesKidsSection,
  "testimonials-kids": TestimonialsKidsSection,
  "cta-kids": CtaKidsSection,
  "features-finance": FeaturesFinanceSection,
  "testimonials-finance": TestimonialsFinanceSection,
  "cta-finance": CtaFinanceSection,
  "features-language": FeaturesLanguageSection,
  "testimonials-language": TestimonialsLanguageSection,
  "cta-language": CtaLanguageSection,
  "features-skills": FeaturesSkillsSection,
  "testimonials-skills": TestimonialsSkillsSection,
  "cta-skills": CtaSkillsSection,
  "about-photography": AboutPhotographySection,
  "features-photography": FeaturesPhotographySection,
  "gallery-photography": GalleryPhotographySection,
  "testimonials-photography": TestimonialsPhotographySection,
  "faq-photography": FaqPhotographySection,
  "cta-photography": CtaPhotographySection,
  "courses-listing-photography": CoursesListingPhotographySection,
  "books-listing-photography": BooksListingPhotographySection,
  // Mindfulness Template Sections
  "hero-mindfulness": HeroMindfulnessSection,
  "teach-mindfulness": TeachMindfulnessSection,
  "how-it-works-mindfulness": HowItWorksMindfulnessSection,
  "testimonials-mindfulness": TestimonialsMindfulnessSection,
  "cta-mindfulness": CtaMindfulnessSection,
  "roadmap-mindfulness": RoadmapMindfulnessSection,
  // Astrology Landing Page Sections
  "hero-astrology": HeroAstrologySection,
  "about-astrology": AboutAstrologySection,
  "services-astrology": ServicesAstrologySection,
  "testimonials-astrology": TestimonialsAstrologySection,
  "faq-astrology": FaqAstrologySection,
  "cta-astrology": CtaAstrologySection,
  "courses-listing-astrology": CoursesListingAstrologySection,
  "self-paced-courses-listing-astrology": CoursesListingAstrologySection,
  "books-listing-astrology": BooksListingAstrologySection,
  // Course Page Sections
  "course-hero": CourseHeroSection,
  "course-curriculum": CourseCurriculumSection,
  "course-offerings": CourseOfferingsSection,
  "course-instructor": CourseInstructorSection,
  "course-prerequisites": CoursePrerequisitesSection,
  "course-learning-outcomes": CourseLearningOutcomesSection,
  // Subscription Page Sections
  "subscription-hero": SubscriptionHeroSection,
  "subscription-features": SubscriptionFeaturesSection,
  "subscription-comparison": SubscriptionComparisonSection,
  "subscription-pricing": SubscriptionPricingSection,
  "subscription-faq": SubscriptionFaqSection,
  "subscription-cta": SubscriptionCtaSection,
  // Exam Prep Template Sections
  "hero-examprep": HeroExamprepSection,
  "features-examprep": FeaturesExamprepSection,
  "learning-paths-examprep": LearningPathsExamprepSection,
  "about-examprep": AboutExamprepSection,
  "testimonials-examprep": TestimonialsExamprepSection,
  "faq-examprep": FaqExamprepSection,
  "cta-examprep": CtaExamprepSection,
  "courses-listing-examprep": ContentListingSection,
  "self-paced-courses-listing-examprep": ContentListingSection,
  "books-listing-examprep": ContentListingSection,
  // Test Prep (All Govt Exams) Template Sections, reuses Exam Prep components
  "hero-govtexam": HeroExamprepSection,
  "features-govtexam": FeaturesExamprepSection,
  "learning-paths-govtexam": LearningPathsExamprepSection,
  "about-govtexam": AboutExamprepSection,
  "testimonials-govtexam": TestimonialsExamprepSection,
  "faq-govtexam": FaqExamprepSection,
  "cta-govtexam": CtaExamprepSection,
  "courses-listing-govtexam": ContentListingSection,
  "self-paced-courses-listing-govtexam": ContentListingSection,
  "books-listing-govtexam": ContentListingSection,
  "exam-categories-govtexam": ExamCategoriesGovtexamSection,
  "trusted-by-govtexam": TrustedByGovtexamSection,
  // Corporate Upskilling
  "hero-corpupskill": HeroSliderCorpupskillSection,
  "trusted-by-corpupskill": TrustedByCorpupskillSection,
  "features-split-corpupskill": FeaturesSplitCorpupskillSection,
  "analytics-corpupskill": AnalyticsCorpupskillSection,
  "solutions-grid-corpupskill": SolutionsGridCorpupskillSection,
  "testimonials-corpupskill": TestimonialsCorpupskillSection,
  "cta-corpupskill": CtaCorpupskillSection,
  "self-paced-courses-listing-corpupskill": ContentListingSection,
  "books-listing-corpupskill": ContentListingSection,
};

const FALLBACK_LIGHT = {
  primary: "221.2 83.2% 53.3%",
  primaryForeground: "210 40% 98%",
  secondary: "210 40% 96.1%",
  secondaryForeground: "222.2 47.4% 11.2%",
  accent: "210 40% 96.1%",
  accentForeground: "222.2 47.4% 11.2%",
  background: "0 0% 100%",
  foreground: "222.2 84% 4.9%",
  muted: "210 40% 96.1%",
  mutedForeground: "215.4 16.3% 46.9%",
  card: "0 0% 100%",
  cardForeground: "222.2 84% 4.9%",
  border: "214.3 31.8% 91.4%",
  input: "214.3 31.8% 91.4%",
  ring: "221.2 83.2% 53.3%",
  destructive: "0 84.2% 60.2%",
  destructiveForeground: "210 40% 98%",
};

const FALLBACK_DARK = {
  primary: "217.2 91.2% 59.8%",
  primaryForeground: "222.2 47.4% 11.2%",
  secondary: "217.2 32.6% 17.5%",
  secondaryForeground: "210 40% 98%",
  accent: "217.2 32.6% 17.5%",
  accentForeground: "210 40% 98%",
  background: "222.2 84% 4.9%",
  foreground: "210 40% 98%",
  muted: "217.2 32.6% 17.5%",
  mutedForeground: "215 20.2% 65.1%",
  card: "222.2 84% 4.9%",
  cardForeground: "210 40% 98%",
  border: "217.2 32.6% 17.5%",
  input: "217.2 32.6% 17.5%",
  ring: "224.3 76.3% 48%",
  destructive: "0 62.8% 30.6%",
  destructiveForeground: "210 40% 98%",
};

function SectionItem({
  section,
  index,
  totalSections,
}: {
  section: SectionConfig;
  index: number;
  totalSections: number;
}) {
  // Skip header/footer - use layout header/footer instead
  if (section.type === "header" || section.type === "footer") {
    return null;
  }

  const SectionComponent = sectionComponents[section.type];

  if (!SectionComponent) {
    return (
      <SectionWrapper section={section} index={index} totalSections={totalSections}>
        <div className="section-padding">
          <div className="container-custom">
            <div className="border-muted-foreground/25 rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                Section type &quot;{section.type}&quot; ({section.variant}) - Coming soon
              </p>
            </div>
          </div>
        </div>
      </SectionWrapper>
    );
  }

  const textStyles = (section.content as Record<string, unknown>)?.textStyles as
    | Record<string, TextStyle>
    | undefined;

  return (
    <SectionWrapper section={section} index={index} totalSections={totalSections}>
      <SectionStyleProvider sectionId={section.id} textStyles={textStyles}>
        <SectionComponent section={section} />
      </SectionStyleProvider>
    </SectionWrapper>
  );
}

export function SectionRenderer({
  sections,
  theme,
  editMode: editModeProp,
  forceColorMode,
  contentEditable: contentEditableProp = true,
  restrictedSectionTypes: restrictedSectionTypesProp,
  disableDeleteDuplicate: disableDeleteDuplicateProp = false,
}: SectionRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isEditMode = editModeProp ?? false;
  const isContentEditable = contentEditableProp;
  const restrictedSectionTypes = restrictedSectionTypesProp ?? [];
  const [classIsDark, setClassIsDark] = useState(false);

  // When a mode is forced (standalone preview), honor it directly; otherwise
  // follow the global `.dark` class managed by the theme provider.
  const isDarkMode = forceColorMode ? forceColorMode === "dark" : classIsDark;

  // Detect initial dark mode state (client-side only)
  useEffect(() => {
    if (forceColorMode) return;
    setClassIsDark(document.documentElement.classList.contains("dark"));
  }, [forceColorMode]);

  // Listen for dark mode changes via MutationObserver
  useEffect(() => {
    if (forceColorMode) return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          const isDark = document.documentElement.classList.contains("dark");
          setClassIsDark(isDark);
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [forceColorMode]);

  const visibleSections = useMemo(() => {
    return sections
      .filter((section) => isEditMode || (section.visible !== false && !section.deleted))
      .sort((a, b) => a.order - b.order);
  }, [sections, isEditMode]);

  // Get theme colors based on current dark/light mode
  const getThemeColors = useCallback(() => {
    const fallback = isDarkMode ? FALLBACK_DARK : FALLBACK_LIGHT;

    // Get light colors as base
    const lightColors = theme?.colors?.light;
    // Get dark colors if available
    const darkColors = theme?.colors?.dark;

    // Use dark colors when in dark mode, otherwise use light colors
    const colors = isDarkMode ? { ...lightColors, ...darkColors } : lightColors;

    return {
      primary: colors?.primary || fallback.primary,
      primaryForeground: colors?.primaryForeground || fallback.primaryForeground,
      secondary: colors?.secondary || fallback.secondary,
      secondaryForeground: colors?.secondaryForeground || fallback.secondaryForeground,
      accent: colors?.accent || fallback.accent,
      accentForeground: colors?.accentForeground || fallback.accentForeground,
      background: colors?.background || fallback.background,
      foreground: colors?.foreground || fallback.foreground,
      muted: colors?.muted || fallback.muted,
      mutedForeground: colors?.mutedForeground || fallback.mutedForeground,
      card: colors?.card || fallback.card,
      cardForeground: colors?.cardForeground || fallback.cardForeground,
      border: colors?.border || fallback.border,
      input: colors?.input || fallback.input,
      ring: colors?.ring || fallback.ring,
      destructive: colors?.destructive || fallback.destructive,
      destructiveForeground: colors?.destructiveForeground || fallback.destructiveForeground,
    };
  }, [theme?.colors?.light, theme?.colors?.dark, isDarkMode]);

  // Extract theme values with fallbacks based on current mode
  const themeValues = useMemo(() => {
    const colors = getThemeColors();
    return {
      ...colors,
      radius: theme?.borders?.radius || "0.5rem",
      headingFont: theme?.fonts?.heading || "Plus Jakarta Sans",
      bodyFont: theme?.fonts?.body || "Inter",
    };
  }, [getThemeColors, theme?.borders?.radius, theme?.fonts?.heading, theme?.fonts?.body]);

  // Apply theme directly to container element via CSS custom properties
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Set CSS custom properties directly on the container
    container.style.setProperty("--primary", themeValues.primary);
    container.style.setProperty("--primary-foreground", themeValues.primaryForeground);
    container.style.setProperty("--secondary", themeValues.secondary);
    container.style.setProperty("--secondary-foreground", themeValues.secondaryForeground);
    container.style.setProperty("--accent", themeValues.accent);
    container.style.setProperty("--accent-foreground", themeValues.accentForeground);
    container.style.setProperty("--background", themeValues.background);
    container.style.setProperty("--foreground", themeValues.foreground);
    container.style.setProperty("--muted", themeValues.muted);
    container.style.setProperty("--muted-foreground", themeValues.mutedForeground);
    container.style.setProperty("--card", themeValues.card);
    container.style.setProperty("--card-foreground", themeValues.cardForeground);
    container.style.setProperty("--border", themeValues.border);
    container.style.setProperty("--input", themeValues.input);
    container.style.setProperty("--ring", themeValues.ring);
    container.style.setProperty("--destructive", themeValues.destructive);
    container.style.setProperty("--destructive-foreground", themeValues.destructiveForeground);
    container.style.setProperty("--radius", themeValues.radius);

    // Set direct styles
    container.style.backgroundColor = `hsl(${themeValues.background})`;
    container.style.color = `hsl(${themeValues.foreground})`;
    container.style.fontFamily = `"${themeValues.bodyFont}", system-ui, sans-serif`;
  }, [themeValues]);

  const totalSections = visibleSections.length;

  return (
    <EditModeProvider
      editMode={isEditMode}
      contentEditable={isContentEditable}
      restrictedSectionTypes={restrictedSectionTypes}
      disableDeleteDuplicate={disableDeleteDuplicateProp}
    >
      <SectionEditorBridge>
        <div
          ref={containerRef}
          // When a mode is forced (standalone preview iframe), also carry the
          // `dark` class so Tailwind `dark:` variants render faithfully, the
          // preview can't toggle the root class (next-themes pins it).
          className={`page-theme-preview flex min-h-full flex-col rounded-lg ${isEditMode ? "" : "overflow-hidden"} ${forceColorMode === "dark" ? "dark" : ""}`}
          data-theme-id={theme?.id || "default"}
        >
          {visibleSections.map((section, index) => (
            <React.Fragment key={section.id}>
              {/* Add section divider before first section (insert at top) */}
              {index === 0 && isEditMode && <AddSectionDivider afterSectionId={undefined} />}
              <SectionItem section={section} index={index} totalSections={totalSections} />
              {/* Add section divider after each section */}
              {isEditMode && <AddSectionDivider afterSectionId={section.id} />}
            </React.Fragment>
          ))}

          {visibleSections.length === 0 && (
            <div className="flex min-h-[50vh] items-center justify-center">
              <p className="text-muted-foreground">
                No sections to display. Click &quot;Add Section&quot; to get started.
              </p>
            </div>
          )}
        </div>
      </SectionEditorBridge>
    </EditModeProvider>
  );
}

function AdminLink({ href, className, children }: SharedLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

const fetchTestimonials = async (): Promise<TestimonialScrollItem[]> =>
  cachedInPreview("testimonials", async () => {
    const res = await testimonialsApi.list({ limit: 100, status: "APPROVED" });
    return res.testimonials;
  });

/** Bridges local editor implementations into the shared SectionEditorContext */
function SectionEditorBridge({ children }: { children: React.ReactNode }) {
  const isEditMode = useEditMode();
  const { updateSectionContent, updateSection } = useEditorStore();
  const tenantHost = useTenantWebHost();
  const { data: orgDetails } = useOrgDetails();
  const selectedTenant = useTenantStore((s) => s.selectedTenant);
  // Read-only tenant branding for editor previews (e.g. the login brand panel
  // renders the real logo / name / footer, which stay non-editable).
  const tenantBrand = {
    name: selectedTenant?.tenant_name ?? null,
    logoUrl:
      getTenantOrgImageUrl(orgDetails?.logoLightKey) ||
      getTenantOrgImageUrl(orgDetails?.logoDarkKey) ||
      null,
  };

  const setSectionVisible = (sectionId: string, visible: boolean) => {
    updateSection(sectionId, { visible });
  };

  const fetchContentItemsUncached = async (params: {
    sectionType: string;
    limit: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ContentListingItem[]> => {
    if (!tenantHost) return [];
    const { sectionType, limit, sortBy = "sort_order", sortOrder = "asc" } = params;

    // Test series come from the learner API catalog, same as the
    // live web page. Fetching them here keeps the builder WYSIWYG (mirrors
    // apps/web's section-renderer) instead of showing an empty "coming soon".
    if (sectionType.includes("test-series")) {
      const series = await fetchPublishedTestSeries(tenantHost);
      return series.slice(0, limit).map((s) => ({
        id: s.id,
        type: "test-series" as const,
        title: s.title,
        slug: s.slug,
        description: s.description,
        thumbnailUrl: getTestSeriesCoverUrl(s.coverImageKey),
        priceInr: s.priceInr,
        priceUsd: s.priceUsd,
        discountInr: s.discountInr,
        discountUsd: s.discountUsd,
        purchaseMode: s.pricingType,
      }));
    }
    // Map section type to API call
    if (sectionType.includes("books") || sectionType === "book-showcase") {
      const res = await fetchPublishedBooks(tenantHost, {
        limit,
        sortBy: sortBy as "created_at" | "title" | "sort_order",
        sortOrder: sortOrder as "asc" | "desc",
      });
      return res.books.map((b) => ({
        id: b.id,
        type: "book" as const,
        title: b.title,
        slug: b.slug,
        description: b.description,
        thumbnailUrl: resolveThumbnailForDisplay(b.thumbnailUrl),
        priceInr: b.priceInr,
        priceUsd: b.priceUsd,
        discountInr: b.discountInr,
        discountUsd: b.discountUsd,
        purchaseMode: b.purchaseMode,
        language: b.language,
        author: b.author,
        authors: b.authors,
        pages: b.pages,
      }));
    }
    if (sectionType.includes("bundles")) {
      const res = await fetchPublishedBundles(tenantHost, {
        limit,
        sortBy: sortBy as "created_at" | "title" | "sort_order",
        sortOrder: sortOrder as "asc" | "desc",
      });
      return res.bundles.map((b) => ({
        id: b.id,
        type: "bundle" as const,
        title: b.title,
        slug: b.slug,
        subtitle: b.subtitle,
        description: b.description,
        thumbnailUrl: resolveThumbnailForDisplay(b.thumbnailUrl),
        priceInr: b.priceInr,
        priceUsd: b.priceUsd,
        discountInr: b.discountInr,
        discountUsd: b.discountUsd,
        purchaseMode: b.purchaseMode,
        itemCount: b.itemCount,
      }));
    }
    if (sectionType.includes("categories")) {
      const res = await fetchPublishedCategories(tenantHost);
      return res.categories.map((c) => ({
        id: c.id,
        type: "category" as const,
        title: c.name,
        slug: c.slug,
        description: c.description,
        iconUrl: c.icon_url,
      }));
    }
    // Default: courses, prefix matches IIT JEE / NEET style listing types
    const mode = sectionType.startsWith("self-paced-courses-listing")
      ? ("SELF_PACED" as const)
      : undefined;
    const res = await fetchPublishedCourses(tenantHost, {
      limit,
      sortBy: sortBy as "created_at" | "title" | "sort_order",
      sortOrder: sortOrder as "asc" | "desc",
      mode,
    });
    return res.courses.map((c) => ({
      id: c.id,
      type: "course" as const,
      title: c.title,
      slug: c.slug,
      subtitle: c.subtitle,
      description: c.description,
      thumbnailUrl: resolveThumbnailForDisplay(c.thumbnailUrl),
      duration: c.duration,
      priceInr: c.priceInr,
      priceUsd: c.priceUsd,
      discountInr: c.discountInr,
      discountUsd: c.discountUsd,
      purchaseMode: c.purchaseMode,
      mode: c.mode,
      difficulty: c.difficulty,
      language: c.language,
      instructor: c.instructor,
    }));
  };

  // Inside /preview/* iframes, dedupe identical catalog requests across the
  // many template-preview iframes via a short-TTL sessionStorage cache.
  // Everywhere else this is a direct pass-through.
  const fetchContentItems = async (params: {
    sectionType: string;
    limit: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ContentListingItem[]> =>
    cachedInPreview(
      `content:${tenantHost}:${params.sectionType}:${params.limit}:${params.sortBy ?? "sort_order"}:${params.sortOrder ?? "asc"}`,
      () => fetchContentItemsUncached(params),
    );

  return (
    <SectionEditorProvider
      value={{
        isEditMode,
        updateSectionContent,
        EditableText,
        EditableMedia,
        EditableImage,
        LinkComponent: AdminLink,
        fetchTestimonials,
        fetchContentItems,
        tenantIdentifier: tenantHost || undefined,
        tenantBrand,
        setSectionVisible,
      }}
    >
      {children}
    </SectionEditorProvider>
  );
}
