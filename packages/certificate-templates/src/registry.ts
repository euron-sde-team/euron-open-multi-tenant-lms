import {
  ElegantWhite,
  ModernBlue,
  MinimalDark,
  AcademicParchment,
  UniversityFormal,
  CorporateExecutive,
  TechGradient,
  EditorialLight,
  EditorialNoir,
  MasterclassLight,
  MasterclassDark,
  ScholarLight,
  ScholarDark,
  ProgramLight,
  ProgramDark,
  HonorsLight,
  HonorsDark,
} from "./templates";
import type { RegistryEntry, CertificateTemplateMeta } from "./types";

export const DEFAULT_TEMPLATE_ID = "elegant-white";

export const CERTIFICATE_TEMPLATES: Record<string, RegistryEntry> = {
  "elegant-white": {
    meta: {
      id: "elegant-white",
      name: "Elegant White",
      description:
        "Warm ivory with champagne gold accents, decorative borders, and refined serif typography.",
      theme: "elegant",
    },
    component: ElegantWhite,
  },
  "modern-blue": {
    meta: {
      id: "modern-blue",
      name: "Modern Blue",
      description:
        "Sleek modern design with blue gradient accents on a deep navy background.",
      theme: "modern",
    },
    component: ModernBlue,
  },
  "minimal-dark": {
    meta: {
      id: "minimal-dark",
      name: "Minimal Dark",
      description: "Clean minimalist dark theme with elegant serif typography.",
      theme: "minimal",
    },
    component: MinimalDark,
  },
  "academic-parchment": {
    meta: {
      id: "academic-parchment",
      name: "Academic Parchment",
      description:
        "Traditional university credential in warm parchment with navy, muted gold, wax-style seal, and a formal ribbon sash.",
      theme: "academic",
    },
    component: AcademicParchment,
  },
  "university-formal": {
    meta: {
      id: "university-formal",
      name: "University Formal",
      description:
        "Classic diploma aesthetic with burgundy frame, gold medallion, and Latin-style body copy.",
      theme: "academic",
    },
    component: UniversityFormal,
  },
  "corporate-executive": {
    meta: {
      id: "corporate-executive",
      name: "Corporate Executive",
      description:
        "Modern executive credential on ivory with a charcoal and teal palette, sans-serif typography, and grid-based composition.",
      theme: "corporate",
    },
    component: CorporateExecutive,
  },
  "tech-gradient": {
    meta: {
      id: "tech-gradient",
      name: "Tech Gradient",
      description:
        "Contemporary indigo-to-cyan gradient with geometric motifs, mono accents, and a glowing QR verification block.",
      theme: "tech",
    },
    component: TechGradient,
  },
  "editorial-light": {
    meta: {
      id: "editorial-light",
      name: "Editorial Light",
      description:
        "Magazine editorial aesthetic, generous whitespace, refined serif display, hairline rules, and a single ochre accent.",
      theme: "editorial",
    },
    component: EditorialLight,
  },
  "editorial-noir": {
    meta: {
      id: "editorial-noir",
      name: "Editorial Noir",
      description:
        "Dark counterpart to Editorial Light with warm whites and cognac accents on a rich near-black ground.",
      theme: "editorial",
    },
    component: EditorialNoir,
  },
  "masterclass-light": {
    meta: {
      id: "masterclass-light",
      name: "Masterclass Light",
      description:
        "Minimal skill-completion credential on white with a violet accent bar and confident bold sans-serif typography.",
      theme: "modern",
    },
    component: MasterclassLight,
  },
  "masterclass-dark": {
    meta: {
      id: "masterclass-dark",
      name: "Masterclass Dark",
      description:
        "Dark counterpart to Masterclass Light, deep violet-black with a soft glow behind the recipient name.",
      theme: "modern",
    },
    component: MasterclassDark,
  },
  "scholar-light": {
    meta: {
      id: "scholar-light",
      name: "Scholar Light",
      description:
        "Academic completion credential with a vertical blue ribbon, gold-rimmed logo seal, serif title, and tri-signature footer on warm ivory.",
      theme: "academic",
    },
    component: ScholarLight,
  },
  "scholar-dark": {
    meta: {
      id: "scholar-dark",
      name: "Scholar Dark",
      description:
        "Deep-navy scholar credential with a gilded medallion and blue-to-gold ribbon, formal, modern, and balanced.",
      theme: "academic",
    },
    component: ScholarDark,
  },
  "program-light": {
    meta: {
      id: "program-light",
      name: "Program Light",
      description:
        "Tech-corporate program credential on white with a cyan left-edge accent, pill caption, and confident bold sans-serif typography.",
      theme: "modern",
    },
    component: ProgramLight,
  },
  "program-dark": {
    meta: {
      id: "program-dark",
      name: "Program Dark",
      description:
        "Dark counterpart to Program Light, near-black ground with a glowing cyan stripe and subtle text-shadow on the recipient name.",
      theme: "modern",
    },
    component: ProgramDark,
  },
  "honors-light": {
    meta: {
      id: "honors-light",
      name: "Honors Light",
      description:
        "Academic honors letterhead on warm cream with deep plum and brass gold accents, double hairline rules, and a tri-signature footer.",
      theme: "academic",
    },
    component: HonorsLight,
  },
  "honors-dark": {
    meta: {
      id: "honors-dark",
      name: "Honors Dark",
      description:
        "Deep-aubergine honors letterhead with gilded double rules, corner fleurs, and ivory serif typography, formal and restrained.",
      theme: "academic",
    },
    component: HonorsDark,
  },
};

export function getTemplate(id: string): RegistryEntry | undefined {
  return CERTIFICATE_TEMPLATES[id];
}

export function listTemplates(): CertificateTemplateMeta[] {
  return Object.values(CERTIFICATE_TEMPLATES).map((entry) => entry.meta);
}
