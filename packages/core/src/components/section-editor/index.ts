export {
  SectionEditorProvider,
  useSectionEditor,
  type SectionEditorContextValue,
  type SectionEditorProviderProps,
  type SharedEditableTextProps,
  type SharedEditableMediaProps,
  type SharedEditableImageProps,
  type SharedLinkProps,
  type ContactFormSubmitPayload,
  type ContactPrefill,
} from "./SectionEditorContext";
export { useContactPrefill } from "./useContactPrefill";
export { EditableLabel, type EditableLabelProps } from "./EditableLabel";

// Shared section components
export { HeroCodeTechSection } from "./sections/HeroCodeTechSection";
export { HeroSection } from "./sections/HeroSection";
export { FeaturesGridSection } from "./sections/FeaturesGridSection";
export { CustomHtmlSection } from "./sections/CustomHtmlSection";
export { StatsCounterSection } from "./sections/StatsCounterSection";
export { FAQAccordionSection } from "./sections/FAQAccordionSection";
export { LogoCloudSection } from "./sections/LogoCloudSection";
export { TestimonialsGridSection } from "./sections/TestimonialsGridSection";
export { TestimonialsScrollCodeTechSection } from "./sections/TestimonialsScrollCodeTechSection";
export { ContentListingSection } from "./sections/ContentListingSection";
export { AboutSection } from "./sections/AboutSection";
export { CTABannerSection } from "./sections/CTABannerSection";
export { PricingTableSection } from "./sections/PricingTableSection";
export { AboutPageSection } from "./sections/AboutPageSection";
export { ContactFormSection } from "./sections/ContactFormSection";
export { ContactPageSection } from "./sections/ContactPageSection";
export { FaqPageSection } from "./sections/FaqPageSection";
export { LoginFormSection } from "./sections/LoginFormSection";
export { PricingPageSection } from "./sections/PricingPageSection";
export { PrivacyPageSection } from "./sections/PrivacyPageSection";
export { TermsPageSection } from "./sections/TermsPageSection";
export { AboutUsHeroSection } from "./sections/AboutUsHeroSection";
export { AboutUsMissionSection } from "./sections/AboutUsMissionSection";
export { AboutUsOfferingsSection } from "./sections/AboutUsOfferingsSection";
export { AboutUsValuesSection } from "./sections/AboutUsValuesSection";
export { FoundersSection, TeamSection } from "./sections/PeopleSection";
export { AboutUsContactSection } from "./sections/AboutUsContactSection";
export { ContactUsHeroSection } from "./sections/ContactUsHeroSection";
export { ContactUsInfoSection } from "./sections/ContactUsInfoSection";
export { ContactUsFormSection } from "./sections/ContactUsFormSection";
export { FaqUsHeroSection } from "./sections/FaqUsHeroSection";
export { FaqUsListSection } from "./sections/FaqUsListSection";
export { PrivacyUsHeroSection } from "./sections/PrivacyUsHeroSection";
export { PrivacyUsContentSection } from "./sections/PrivacyUsContentSection";
export { TermsUsHeroSection } from "./sections/TermsUsHeroSection";
export { TermsUsContentSection } from "./sections/TermsUsContentSection";
export { HeroMindfulnessSection } from "./sections/HeroMindfulnessSection";
export { TeachMindfulnessSection } from "./sections/TeachMindfulnessSection";
export { HowItWorksMindfulnessSection } from "./sections/HowItWorksMindfulnessSection";
export { TestimonialsMindfulnessSection } from "./sections/TestimonialsMindfulnessSection";
export { CtaMindfulnessSection } from "./sections/CtaMindfulnessSection";
export { RoadmapMindfulnessSection } from "./sections/RoadmapMindfulnessSection";
// Cooking Landing Page Sections
export { HeroCookingSection } from "./sections/HeroCookingSection";
export { RecipesCookingSection } from "./sections/RecipesCookingSection";
// Fitness / Music / Business Sections
export { HeroFitnessSection } from "./sections/HeroFitnessSection";
export { ProgramsFitnessSection } from "./sections/ProgramsFitnessSection";
export { HeroMusicSection } from "./sections/HeroMusicSection";
export { GenresMusicSection } from "./sections/GenresMusicSection";
export { HeroBusinessSection } from "./sections/HeroBusinessSection";
export { OutcomesBusinessSection } from "./sections/OutcomesBusinessSection";
export { HeroQuantSection } from "./sections/HeroQuantSection";
export { HeroQuantInstituteSection } from "./sections/HeroQuantInstituteSection";
// Bespoke heroes (Arts / Kids / Finance / Language / Skills + v2 alt heroes)
export {
  HeroArtsSection,
  HeroArtsAltSection,
  HeroKidsSection,
  HeroKidsAltSection,
  HeroFinanceSection,
  HeroFinanceAltSection,
  HeroLanguageSection,
  HeroLanguageAltSection,
  HeroSkillsSection,
  HeroCookingAltSection,
  HeroFitnessAltSection,
  HeroMusicAltSection,
  HeroBusinessAltSection,
  HeroArtsV3Section,
  HeroKidsV3Section,
  HeroFinanceV3Section,
} from "./sections/BespokeHeroWrappers";
export {
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
} from "./sections/MotionHeroWrappers";
export { FeatureBento } from "./sections/FeatureBento";
export { StatsBand } from "./sections/StatsBand";
export { ArtsGallerySection } from "./sections/ArtsGallerySection";
export { KidsPathSection } from "./sections/KidsPathSection";
export { FinanceMarketsSection } from "./sections/FinanceMarketsSection";
export { LanguagePhrasesSection } from "./sections/LanguagePhrasesSection";
export { SkillsTracksSection } from "./sections/SkillsTracksSection";
// Per-niche bespoke body sections (features / testimonials / cta)
export {
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
} from "./sections/NicheBodyWrappers";
// Photography Landing Page Sections
export { HeroPhotographySection } from "./sections/HeroPhotographySection";
export { AboutPhotographySection } from "./sections/AboutPhotographySection";
export { FeaturesPhotographySection } from "./sections/FeaturesPhotographySection";
export { GalleryPhotographySection } from "./sections/GalleryPhotographySection";
export { TestimonialsPhotographySection } from "./sections/TestimonialsPhotographySection";
export { FaqPhotographySection } from "./sections/FaqPhotographySection";
export { CtaPhotographySection } from "./sections/CtaPhotographySection";
export { CoursesListingPhotographySection } from "./sections/CoursesListingPhotographySection";
export { BooksListingPhotographySection } from "./sections/BooksListingPhotographySection";
// Astrology Landing Page Sections
export { HeroAstrologySection } from "./sections/HeroAstrologySection";
export { AboutAstrologySection } from "./sections/AboutAstrologySection";
export { ServicesAstrologySection } from "./sections/ServicesAstrologySection";
export { TestimonialsAstrologySection } from "./sections/TestimonialsAstrologySection";
export { FaqAstrologySection } from "./sections/FaqAstrologySection";
export { CtaAstrologySection } from "./sections/CtaAstrologySection";
export { CoursesListingAstrologySection } from "./sections/CoursesListingAstrologySection";
export { BooksListingAstrologySection } from "./sections/BooksListingAstrologySection";
// Subscription Page Sections
export { SubscriptionHeroSection } from "./sections/SubscriptionHeroSection";
export { SubscriptionFeaturesSection } from "./sections/SubscriptionFeaturesSection";
export { SubscriptionComparisonSection } from "./sections/SubscriptionComparisonSection";
export { SubscriptionPricingSection } from "./sections/SubscriptionPricingSection";
export { SubscriptionFaqSection } from "./sections/SubscriptionFaqSection";
export { SubscriptionCtaSection } from "./sections/SubscriptionCtaSection";
// Exam Prep Template Sections
export { HeroExamprepSection } from "./sections/HeroExamprepSection";
export { FeaturesExamprepSection } from "./sections/FeaturesExamprepSection";
export { LearningPathsExamprepSection } from "./sections/LearningPathsExamprepSection";
export { AboutExamprepSection } from "./sections/AboutExamprepSection";
export { TestimonialsExamprepSection } from "./sections/TestimonialsExamprepSection";
export { FaqExamprepSection } from "./sections/FaqExamprepSection";
export { CtaExamprepSection } from "./sections/CtaExamprepSection";
// Test Prep (All Govt Exams) Template Sections
export { ExamCategoriesGovtexamSection } from "./sections/ExamCategoriesGovtexamSection";
export { TrustedByGovtexamSection } from "./sections/TrustedByGovtexamSection";

// Corporate Upskilling Template Sections
export { TrustedByCorpupskillSection } from "./sections/TrustedByCorpupskillSection";
export { HeroSliderCorpupskillSection } from "./sections/HeroSliderCorpupskillSection";
export { FeaturesSplitCorpupskillSection } from "./sections/FeaturesSplitCorpupskillSection";
export { AnalyticsCorpupskillSection } from "./sections/AnalyticsCorpupskillSection";
export { SolutionsGridCorpupskillSection } from "./sections/SolutionsGridCorpupskillSection";
export { TestimonialsCorpupskillSection } from "./sections/TestimonialsCorpupskillSection";
export { CtaCorpupskillSection } from "./sections/CtaCorpupskillSection";
