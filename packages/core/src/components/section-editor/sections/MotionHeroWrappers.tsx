"use client";

import type { SectionConfig } from "@open-mtlms/shared";

import { BespokeAccountingHero } from "./BespokeAccountingHero";
import { BespokeBeautyHero } from "./BespokeBeautyHero";
import { BespokeCloudHero } from "./BespokeCloudHero";
import { BespokeCodeKidsHero } from "./BespokeCodeKidsHero";
import { BespokeCyberHero } from "./BespokeCyberHero";
import { BespokeDanceHero } from "./BespokeDanceHero";
import { BespokeDataHero } from "./BespokeDataHero";
import { BespokeDesignHero } from "./BespokeDesignHero";
import { BespokeFashionHero } from "./BespokeFashionHero";
import { BespokeFilmHero } from "./BespokeFilmHero";
import { BespokeHospitalityHero } from "./BespokeHospitalityHero";
import { BespokeInteriorHero } from "./BespokeInteriorHero";
import { BespokeLawHero } from "./BespokeLawHero";
import { BespokeMarketingHero } from "./BespokeMarketingHero";
import { BespokeMedicalHero } from "./BespokeMedicalHero";
import { BespokeRealEstateHero } from "./BespokeRealEstateHero";
import { BespokeSpeakingHero } from "./BespokeSpeakingHero";
import { BespokeSpiritualHero } from "./BespokeSpiritualHero";
import { BespokeStartupHero } from "./BespokeStartupHero";
import { BespokeStudyHero } from "./BespokeStudyHero";
import { BespokeYogaHero } from "./BespokeYogaHero";

interface Props {
  section: SectionConfig;
}

export function HeroDesignSection({ section }: Props) {
  return <BespokeDesignHero section={section} />;
}
export function HeroDataSection({ section }: Props) {
  return <BespokeDataHero section={section} />;
}
export function HeroMedicalSection({ section }: Props) {
  return <BespokeMedicalHero section={section} />;
}
export function HeroBeautySection({ section }: Props) {
  return <BespokeBeautyHero section={section} />;
}
export function HeroStudySection({ section }: Props) {
  return <BespokeStudyHero section={section} />;
}
export function HeroMarketingSection({ section }: Props) {
  return <BespokeMarketingHero section={section} />;
}
export function HeroCyberSection({ section }: Props) {
  return <BespokeCyberHero section={section} />;
}
export function HeroRealEstateSection({ section }: Props) {
  return <BespokeRealEstateHero section={section} />;
}
export function HeroCloudSection({ section }: Props) {
  return <BespokeCloudHero section={section} />;
}
export function HeroAccountingSection({ section }: Props) {
  return <BespokeAccountingHero section={section} />;
}
export function HeroLawSection({ section }: Props) {
  return <BespokeLawHero section={section} />;
}
export function HeroFilmSection({ section }: Props) {
  return <BespokeFilmHero section={section} />;
}
export function HeroStartupSection({ section }: Props) {
  return <BespokeStartupHero section={section} />;
}
export function HeroFashionSection({ section }: Props) {
  return <BespokeFashionHero section={section} />;
}
export function HeroInteriorSection({ section }: Props) {
  return <BespokeInteriorHero section={section} />;
}
export function HeroYogaSection({ section }: Props) {
  return <BespokeYogaHero section={section} />;
}
export function HeroDanceSection({ section }: Props) {
  return <BespokeDanceHero section={section} />;
}
export function HeroCodeKidsSection({ section }: Props) {
  return <BespokeCodeKidsHero section={section} />;
}
export function HeroSpeakingSection({ section }: Props) {
  return <BespokeSpeakingHero section={section} />;
}
export function HeroHospitalitySection({ section }: Props) {
  return <BespokeHospitalityHero section={section} />;
}
export function HeroSpiritualSection({ section }: Props) {
  return <BespokeSpiritualHero section={section} />;
}
