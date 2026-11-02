"use client";

import type { SectionConfig } from "@open-mtlms/shared";

import { NicheCtaSection } from "./NicheCtaSection";
import { NicheFeaturesSection } from "./NicheFeaturesSection";
import { NicheTestimonialsSection } from "./NicheTestimonialsSection";
import type { NicheVariant } from "./niche-visuals";

interface Props {
  section: SectionConfig;
}

const mk = (variant: NicheVariant) => ({
  Features: ({ section }: Props) => <NicheFeaturesSection section={section} variant={variant} />,
  Testimonials: ({ section }: Props) => <NicheTestimonialsSection section={section} variant={variant} />,
  Cta: ({ section }: Props) => <NicheCtaSection section={section} variant={variant} />,
});

const cooking = mk("cooking");
export const FeaturesCookingSection = cooking.Features;
export const TestimonialsCookingSection = cooking.Testimonials;
export const CtaCookingSection = cooking.Cta;

const fitness = mk("fitness");
export const FeaturesFitnessSection = fitness.Features;
export const TestimonialsFitnessSection = fitness.Testimonials;
export const CtaFitnessSection = fitness.Cta;

const music = mk("music");
export const FeaturesMusicSection = music.Features;
export const TestimonialsMusicSection = music.Testimonials;
export const CtaMusicSection = music.Cta;

const business = mk("business");
export const FeaturesBusinessSection = business.Features;
export const TestimonialsBusinessSection = business.Testimonials;
export const CtaBusinessSection = business.Cta;

const arts = mk("arts");
export const FeaturesArtsSection = arts.Features;
export const TestimonialsArtsSection = arts.Testimonials;
export const CtaArtsSection = arts.Cta;

const kids = mk("kids");
export const FeaturesKidsSection = kids.Features;
export const TestimonialsKidsSection = kids.Testimonials;
export const CtaKidsSection = kids.Cta;

const finance = mk("finance");
export const FeaturesFinanceSection = finance.Features;
export const TestimonialsFinanceSection = finance.Testimonials;
export const CtaFinanceSection = finance.Cta;

const language = mk("language");
export const FeaturesLanguageSection = language.Features;
export const TestimonialsLanguageSection = language.Testimonials;
export const CtaLanguageSection = language.Cta;

const skills = mk("skills");
export const FeaturesSkillsSection = skills.Features;
export const TestimonialsSkillsSection = skills.Testimonials;
export const CtaSkillsSection = skills.Cta;
