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
  LogoCloudSection,
  PricingPageSection,
  PricingTableSection,
  PrivacyPageSection,
  SectionEditorProvider,
  SafeLink,
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
} from "@open-mtlms/shared";
import { HIDDEN_PRICE, resolvePrice } from "@open-mtlms/shared";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo } from "react";

import { EditableImage, EditableMedia, EditableText } from "@/components/view-components";
import { getCourseThumbnailUrl } from "@/lib/api";
import { fetchPublishedBooks } from "@/lib/api/books";
import { fetchPublishedBundles } from "@/lib/api/bundles";
import { fetchCategories } from "@/lib/api/categories";
import { fetchPublishedCourses } from "@/lib/api/courses";
import { fetchTestSeriesCatalog, getTestSeriesCoverUrl } from "@/lib/api/test-series";
import { testimonialsApi } from "@/lib/api/testimonials";
import { useCart } from "@/lib/hooks/use-cart";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useCurrencyContext } from "@/lib/hooks/use-currency";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { SectionStyleProvider } from "@/lib/contexts/section-style-context";
import { EditModeProvider } from "@/lib/edit-mode-context";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { useBookmark } from "@/lib/stores/bookmark-store";

import { SectionWrapper, AddSectionDivider } from "./section-wrapper";
import { LoginFormSection } from "./login-form";


// Course sections
import { CourseHeroSection } from "./course-hero";
import { CourseCurriculumSection } from "./course-curriculum";
import { CourseInstructorSection } from "./course-instructor";
import { CourseOfferingsSection } from "./course-offerings";
import { CoursePrerequisitesSection } from "./course-prerequisites";
import { CourseLearningOutcomesSection } from "./course-learning-outcomes";
// Full-page sections
import { CartPageSection } from "./cart-page";
import { BookmarkPageSection } from "./bookmark-page";
import { MemberProfileSection } from "./member-profile-section";

function WebLink({ href, className, children }: SharedLinkProps) {
  return (
    <SafeLink href={href} className={className}>
      {children}
    </SafeLink>
  );
}

interface SectionRendererProps {
  sections: SectionConfig[];
  /** When false, always render in view mode (avoids hydration mismatch with persisted editor store). */
  editMode?: boolean;
}

// Map section types to components
// Some section types use fallback renderers until dedicated components are built.
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
  "hybrid-courses-listing": ContentListingSection,
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
  "gallery-arts": ArtsGallerySection,
  "hero-kids": HeroKidsSection,
  "hero-kids-alt": HeroKidsAltSection,
  "hero-kids-v3": HeroKidsV3Section,
  "path-kids": KidsPathSection,
  "hero-finance": HeroFinanceSection,
  "hero-finance-alt": HeroFinanceAltSection,
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
  // Course sections
  "course-hero": CourseHeroSection,
  "course-curriculum": CourseCurriculumSection,
  "course-instructor": CourseInstructorSection,
  "course-offerings": CourseOfferingsSection,
  "course-prerequisites": CoursePrerequisitesSection,
  "course-learning-outcomes": CourseLearningOutcomesSection,
  "member-profile": MemberProfileSection,
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

// Individual section renderer that handles each section
// Not using memo here to ensure re-renders when section content changes
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
    // Fallback for unimplemented sections
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

export function SectionRenderer({ sections, editMode: editModeProp }: SectionRendererProps) {
  // Always use the prop value - public pages should pass editMode={false}
  // This avoids hydration mismatch with persisted editor store
  const isEditMode = editModeProp ?? false;

  // Enrolled-only tenants: strip catalog course-listing sections from public
  // pages entirely, there's no browsable catalog, so a home-page "explore
  // courses" grid would be a dead-end (backend returns only enrolled courses,
  // i.e. empty for guests). Kept visible in edit mode so admins still see them.
  const { enrolledCoursesOnly } = useStorefrontConfig();
  const hideCatalog = enrolledCoursesOnly && !isEditMode;

  // Filter by saved visibility (same as admin). Listings/testimonials still omit themselves when empty via each section component.
  const visibleSections = useMemo(() => {
    return sections
      .filter(
        (section) => isEditMode || (!section.deleted && section.visible !== false),
      )
      .filter(
        (section) => !(hideCatalog && section.type.includes("courses-listing")),
      )
      .sort((a, b) => a.order - b.order);
  }, [sections, isEditMode, hideCatalog]);

  const totalSections = visibleSections.length;
  const renderedSections: React.ReactNode[] = [];

  for (let index = 0; index < visibleSections.length; index++) {
    const section = visibleSections[index];

    renderedSections.push(
      <React.Fragment key={section.id}>
        {/* Add section divider before first section (insert at top) */}
        {index === 0 && isEditMode && <AddSectionDivider afterSectionId={undefined} />}
        <SectionItem section={section} index={index} totalSections={totalSections} />
        {/* Add section divider after each section */}
        {isEditMode && <AddSectionDivider afterSectionId={section.id} />}
      </React.Fragment>
    );
  }

  return (
    <EditModeProvider editMode={isEditMode}>
      <WebSectionEditorBridge>
        <div className="flex flex-col">
          {renderedSections}

          {visibleSections.length === 0 && (
            <div className="flex min-h-[50vh] items-center justify-center">
              <p className="text-muted-foreground">No sections to display</p>
            </div>
          )}
        </div>
      </WebSectionEditorBridge>
    </EditModeProvider>
  );
}

const fetchTestimonials = async (): Promise<TestimonialScrollItem[]> => {
  const res = await testimonialsApi.list({ page: 1, limit: 100 });
  return res.testimonials;
};

const fetchContentItems = async (params: {
  sectionType: string;
  limit: number;
  sortBy?: string;
  sortOrder?: string;
}): Promise<ContentListingItem[]> => {
  const { sectionType, limit, sortBy = "sort_order", sortOrder = "asc" } = params;
  const sort = sortBy as "created_at" | "title" | "sort_order";
  const order = sortOrder as "asc" | "desc";

  if (sectionType.includes("books") || sectionType === "book-showcase") {
    const res = await fetchPublishedBooks({ limit, sortBy: sort, sortOrder: order });
    return res.books.map((b) => ({
      id: b.id,
      type: "book" as const,
      title: b.title,
      slug: b.slug,
      description: b.description,
      thumbnailUrl: getCourseThumbnailUrl(b.thumbnailUrl),
      priceInr: b.priceInr,
      priceUsd: b.priceUsd,
      discountInr: b.discountInr,
      discountUsd: b.discountUsd,
      purchaseMode: b.purchaseMode,
      language: b.language,
      author: b.author,
      authors: b.authors,
      pages: b.pages,
      hasAccess: b.has_access,
      prices: (b as { prices?: Record<string, { amount: number; discount?: number | null }> | null }).prices ?? null,
    }) as ContentListingItem);
  }
  if (sectionType.includes("bundles")) {
    const res = await fetchPublishedBundles({ limit, sortBy: sort, sortOrder: order });
    return res.bundles.map((b) => ({
      id: b.id,
      type: "bundle" as const,
      title: b.title,
      slug: b.slug,
      subtitle: b.subtitle,
      description: b.description,
      thumbnailUrl: getCourseThumbnailUrl(b.thumbnailUrl),
      priceInr: b.priceInr,
      priceUsd: b.priceUsd,
      discountInr: b.discountInr,
      discountUsd: b.discountUsd,
      purchaseMode: b.purchaseMode,
      itemCount: b.itemCount,
      prices: (b as { prices?: Record<string, { amount: number; discount?: number | null }> | null }).prices ?? null,
    }) as ContentListingItem);
  }
  if (sectionType.includes("categories")) {
    const res = await fetchCategories();
    return res.categories.map((c) => ({
      id: c.id,
      type: "category" as const,
      title: c.name,
      slug: c.slug,
      description: c.description,
      iconUrl: c.icon_url,
    }));
  }
  if (sectionType.includes("test-series")) {
    const series = await fetchTestSeriesCatalog();
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
      prices: null,
    }) as ContentListingItem);
  }
  // Default: courses, any type whose id starts with these prefixes gets mode filtering
  const mode = sectionType.startsWith("self-paced-courses-listing")
      ? ("SELF_PACED" as const)
      : sectionType === "hybrid-courses-listing"
        ? ("HYBRID" as const)
        : undefined;
  const res = await fetchPublishedCourses({
    limit,
    sortBy: sort,
    sortOrder: order,
    mode,
  });
  return res.courses.map((c) => ({
    id: c.id,
    type: "course" as const,
    title: c.title,
    slug: c.slug,
    subtitle: c.subtitle,
    description: c.description,
    thumbnailUrl: getCourseThumbnailUrl(c.thumbnailUrl),
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
    hasAccess: c.has_access,
    progressPercent: c.progress_percent ?? null,
    prices: (c as { prices?: Record<string, { amount: number; discount?: number | null }> | null }).prices ?? null,
  }) as ContentListingItem);
};

/** Web is view-only, provides render-only component implementations */
function WebSectionEditorBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const courseTerm = useContentTerm("course");
  const { isAuthenticated, member } = useUserAuthStore();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const guard = useBuyNowGuard();
  const { resolvedCurrency, defaultCurrency, enabledCurrencies, accessManaged, isLoaded } =
    useCurrencyContext();

  // Resolve listing-card prices under the buyer's currency context. Returns
  // null while the context loads so cards fall back to legacy INR/USD math
  // (the listing skeleton gates rendering until the currency resolves).
  const resolveItemPriceParts = useCallback(
    (item: ContentListingItem) => {
      if (!isLoaded) return null;
      // Access-managed storefront: never expose a price to listing cards.
      if (accessManaged) return HIDDEN_PRICE;
      const result = resolvePrice(
        {
          prices:
            (item as { prices?: Record<string, { amount: number | string; discount?: number | string | null }> | null })
              .prices ?? null,
          legacyInr: item.priceInr,
          legacyUsd: item.priceUsd,
          legacyDiscountInr: item.discountInr,
          legacyDiscountUsd: item.discountUsd,
          purchaseMode: item.purchaseMode,
          discountMode: "percent",
        },
        { resolvedCurrency, defaultCurrency, enabledCurrencies }
      );
      return result;
    },
    [isLoaded, accessManaged, resolvedCurrency, defaultCurrency, enabledCurrencies]
  );

  // Prefill contact forms (page sections) from the logged-in member; null when
  // logged out so the form stays blank.
  const contactPrefill = useMemo(
    () =>
      member
        ? {
            name: member.name ?? "",
            email: member.email ?? "",
            phone: member.phone ?? "",
          }
        : null,
    [member]
  );

  const onCartToggle = useCallback(
    (item: { type: string; id: string; title: string }) => {
      // guard.run handles the logged-out path: opens the Easy Checkout modal when
      // the tenant has it enabled, otherwise falls back to the /login redirect.
      guard.run(() => {
        const itemType = item.type.toUpperCase() as "COURSE" | "BOOK" | "BUNDLE";
        if (isInCart(item.id)) {
          removeFromCart({ item_type: itemType, item_id: item.id });
        } else {
          addToCart({ item_type: itemType, item_id: item.id });
        }
      });
    },
    [guard, isInCart, addToCart, removeFromCart]
  );

  const onBookmarkToggle = useCallback(
    (item: { type: string; id: string; title: string; slug: string; thumbnailUrl?: string | null }) => {
      if (!isAuthenticated) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      toggleBookmark({
        productId: item.id,
        productType: item.type as "course" | "book" | "bundle",
        title: item.title,
        slug: item.slug,
        thumbnailUrl: item.thumbnailUrl ?? null,
      });
    },
    [isAuthenticated, toggleBookmark, router]
  );

  const isInCartCheck = useCallback((itemId: string) => isAuthenticated && isInCart(itemId), [isAuthenticated, isInCart]);
  const isBookmarkedCheck = useCallback((itemId: string) => isAuthenticated && isBookmarked(itemId), [isAuthenticated, isBookmarked]);

  const onContentItemClick = useCallback(
    (item: { type: string; slug: string }) => {
      switch (item.type) {
        case "course":
          router.push(`/courses/${item.slug}`);
          break;
        case "book":
          router.push(`/books/${item.slug}`);
          break;
        case "bundle":
          router.push(`/bundles/${item.slug}`);
          break;
        case "category":
          router.push(`/categories/${item.slug}`);
          break;
        case "test-series":
          router.push(`/test-series/${item.slug}`);
          break;
      }
    },
    [router]
  );

  const onContentItemContinue = useCallback(
    (item: { type: string; slug: string }) => {
      switch (item.type) {
        case "course":
          router.push(`/learn/courses/${item.slug}`);
          break;
        case "book":
          router.push(`/learn/books/${item.slug}`);
          break;
        case "bundle":
          router.push(`/bundles/${item.slug}`);
          break;
      }
    },
    [router]
  );

  return (
    <SectionEditorProvider
      value={{
        isEditMode: false,
        updateSectionContent: () => {},
        EditableText,
        EditableMedia,
        EditableImage,
        LinkComponent: WebLink,
        fetchTestimonials,
        fetchContentItems,
        tenantIdentifier: "web",
        onContentItemClick,
        onContentItemContinue,
        // Access-managed storefront: omit the cart handler so listing cards
        // never render an add-to-cart icon.
        onCartToggle: accessManaged ? undefined : onCartToggle,
        isInCart: isInCartCheck,
        onBookmarkToggle,
        isBookmarked: isBookmarkedCheck,
        resolveItemPriceParts,
        contactPrefill,
        courseTerm: courseTerm.singular,
      }}
    >
      {children}
      <EasyCheckoutGuardModal guard={guard} />
    </SectionEditorProvider>
  );
}
