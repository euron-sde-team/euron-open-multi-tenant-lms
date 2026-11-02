"use client";

import type { SectionConfig } from "@open-mtlms/shared";

import { BespokeHero } from "./BespokeHero";

interface Props {
  section: SectionConfig;
}

export function HeroArtsSection({ section }: Props) {
  return <BespokeHero section={section} variant="arts" />;
}
export function HeroArtsAltSection({ section }: Props) {
  return <BespokeHero section={section} variant="arts-alt" />;
}
export function HeroKidsSection({ section }: Props) {
  return <BespokeHero section={section} variant="kids" />;
}
export function HeroKidsAltSection({ section }: Props) {
  return <BespokeHero section={section} variant="kids-alt" />;
}
export function HeroFinanceSection({ section }: Props) {
  return <BespokeHero section={section} variant="finance" />;
}
export function HeroFinanceAltSection({ section }: Props) {
  return <BespokeHero section={section} variant="finance-alt" />;
}
export function HeroLanguageSection({ section }: Props) {
  return <BespokeHero section={section} variant="language" />;
}
export function HeroLanguageAltSection({ section }: Props) {
  return <BespokeHero section={section} variant="language-alt" />;
}
export function HeroSkillsSection({ section }: Props) {
  return <BespokeHero section={section} variant="skills" />;
}
export function HeroCookingAltSection({ section }: Props) {
  return <BespokeHero section={section} variant="cooking-alt" />;
}
export function HeroFitnessAltSection({ section }: Props) {
  return <BespokeHero section={section} variant="fitness-alt" />;
}
export function HeroMusicAltSection({ section }: Props) {
  return <BespokeHero section={section} variant="music-alt" />;
}
export function HeroBusinessAltSection({ section }: Props) {
  return <BespokeHero section={section} variant="business-alt" />;
}
export function HeroArtsV3Section({ section }: Props) {
  return <BespokeHero section={section} variant="arts-v3" />;
}
export function HeroKidsV3Section({ section }: Props) {
  return <BespokeHero section={section} variant="kids-v3" />;
}
export function HeroFinanceV3Section({ section }: Props) {
  return <BespokeHero section={section} variant="finance-v3" />;
}
