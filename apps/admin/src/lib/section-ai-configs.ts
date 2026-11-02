/**
 * Section AI Configuration Registry
 *
 * Each entry owns the full AI contract for a section template:
 *   - label, display name in the AI Generate dialog
 *   - jsonSchema: JSON Schema sent to backend (Gemini uses this for structured output)
 *   - instructions, section-specific prompt instructions
 *   - transform, converts raw AI output → SectionContentMap-compatible shape
 *
 * To add AI support to a NEW template:
 *   1. Add an entry here: NO backend changes needed.
 *   2. The backend is a dumb proxy: it just runs inference with your schema and returns raw output.
 */

import { ALL_AVAILABLE_ROUTES } from "@open-mtlms/shared";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionAIConfig {
  label: string;
  // Standard JSON Schema (sent to backend, used by Gemini structured output)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonSchema: Record<string, any>;
  // Section-specific AI prompt instructions
  instructions: string;
  // Converts raw Gemini output → section content shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (
    output: Record<string, any>,
    orgLogos?: { light: string | null; dark: string | null } | null
  ) => Record<string, unknown>;
}

// ─── JSON Schema helpers ──────────────────────────────────────────────────────

const s = (desc?: string) => ({ type: "string", ...(desc && { description: desc }) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arr = (items: Record<string, any>, minItems?: number, maxItems?: number, desc?: string) => ({
  type: "array",
  items,
  ...(minItems !== undefined && { minItems }),
  ...(maxItems !== undefined && { maxItems }),
  ...(desc && { description: desc }),
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const obj = (properties: Record<string, any>, required?: string[]) => ({
  type: "object",
  properties,
  required: required ?? Object.keys(properties),
  additionalProperties: false,
});

// ─── ID helper ────────────────────────────────────────────────────────────────

let _idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++_idCounter}`;

// ─── Route helpers (for AI button → route mapping) ──────────────────────────

/** Only static, navigable routes, excludes parameterized paths like /blog/posts/[slug] */
const AI_NAVIGABLE_ROUTES = ALL_AVAILABLE_ROUTES.filter(
  (r) => !r.path.includes("[") && r.path !== "/edit"
);

/** Enum constraint for JSON Schema: AI can ONLY output these valid paths */
const ROUTE_PATH_ENUM = AI_NAVIGABLE_ROUTES.map((r) => r.path);

/** Human-readable route list for AI instructions */
const ROUTE_DESCRIPTIONS = AI_NAVIGABLE_ROUTES.map((r) => `"${r.path}" (${r.label})`).join(", ");

/** JSON Schema for a CTA button with text + route selection */
const ctaSchema = (textDesc: string, routeDesc: string) =>
  obj({
    text: s(textDesc),
    route: { type: "string", enum: ROUTE_PATH_ENUM, description: routeDesc },
  });

/** Transform AI CTA output → CTAButton shape with action config */
const transformCta = (
  cta: { text?: string; route?: string } | undefined,
  variant: "primary" | "secondary" | "outline" | "ghost",
  fallbackHref = "#"
) => {
  if (!cta?.text) return { text: "", href: fallbackHref, variant };
  const href = cta.route || fallbackHref;
  return {
    text: cta.text,
    href,
    variant,
    ...(cta.route && { action: { type: "navigate" as const, params: { path: cta.route } } }),
  };
};

const BUTTON_ROUTE_INSTRUCTIONS = `Available routes for button links: ${ROUTE_DESCRIPTIONS}. Pick the most contextually appropriate route for each button based on the business description.`;

// Declared here (not beside the niche factories below) because the
// SECTION_AI_CONFIGS literal invokes those factories eagerly at module init,
// so this const must already be initialized when they run.
const NICHE_ICON_HINT =
  "lucide-react style icon key in kebab-case. Prefer one of: 'rocket','zap','star','award','trophy','users','shield','heart','target','book','check','sparkles','flame','clock','globe','message'.";

// ─── Registry ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SECTION_AI_CONFIGS: Record<string, SectionAIConfig> = {
  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    label: "Hero",
    jsonSchema: obj({
      headline: s("Powerful, attention-grabbing headline (5-10 words)"),
      subheadline: s("Supporting subheadline expanding on the headline (1-2 sentences)"),
      description: s("Brief value proposition paragraph (2-3 sentences)"),
      primaryCta: ctaSchema(
        "Primary CTA button text (2-4 words, action-oriented, e.g. 'Get Started Free')",
        "Best route for the primary action button. For course/learning platforms use '/all-courses'. For general sites use '/login' or '/pricing'."
      ),
      secondaryCta: ctaSchema(
        "Secondary CTA button text (2-4 words, e.g. 'Learn More')",
        "Best route for the secondary/exploratory button. Typically '/about', '/pricing', or '/faq'."
      ),
    }),
    instructions: `Generate a hero section. Headline conveys core value. CTA buttons use action-oriented language. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
      secondaryCta: transformCta(d.secondaryCta, "secondary"),
    }),
  },

  // ── Hero: Code & Technology ───────────────────────────────────────────────
  "hero-code-tech": {
    label: "Hero: Code & Tech",
    jsonSchema: obj({
      headline: s("Full headline in one line (4-8 words, e.g. 'Code Your Way to Mastery')"),
      headlinePrefix: s("Leave empty string"),
      headlineAccent: s("Leave empty string"),
      badge: s(
        "Social proof badge text shown above the headline (e.g. '2,400 developers learning right now')"
      ),
      description: s("Value proposition paragraph (2-3 sentences)"),
      primaryCta: ctaSchema(
        "Primary CTA button text (2-5 words, e.g. 'Start Learning Free')",
        "Best route for the primary action. For coding/tech platforms use '/all-courses' or '/self-paced'."
      ),
      secondaryCta: ctaSchema(
        "Secondary CTA button text (2-4 words, e.g. 'Watch Demo')",
        "Best route for the secondary button. Typically '/about', '/pricing', or '/faq'."
      ),
      techLogos: arr(
        obj({ name: s("Technology name, e.g. 'React', 'TypeScript', 'Node.js', 'Python'") }),
        3,
        6,
        "3-6 technologies taught or used"
      ),
      stats: arr(
        obj(
          {
            value: s("Stat number as string, e.g. '2,400+', '98%', '50+'"),
            label: s("Stat label (1-3 words, e.g. 'Active Learners')"),
            suffix: { type: "string", description: "Optional suffix" },
          },
          ["value", "label"]
        ),
        2,
        4,
        "2-4 impressive stats"
      ),
      floatingCards: arr(
        obj({
          title: s("Course or project name (3-6 words)"),
          subtitle: s(
            "Short status or enrollment text, e.g. '1.2K enrolled', '12/12 tasks complete'"
          ),
        }),
        2,
        2,
        "Exactly 2 floating cards representing featured courses or projects"
      ),
    }),
    instructions: `Generate a tech/coding-themed hero section. Put the full headline in one line (e.g. "Code Your Way to Mastery"). Leave headlinePrefix and headlineAccent as empty strings. Badge should reference a realistic learner count. Tech logos must be real technologies relevant to the business. Stats must be realistic for the business scale. Floating cards represent featured courses or projects. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => {
      const techIconMap: Record<string, string> = {
        react: "react",
        typescript: "typescript",
        "node.js": "nodejs",
        nodejs: "nodejs",
        python: "python",
        javascript: "javascript",
        "next.js": "nextjs",
        nextjs: "nextjs",
        vue: "vuejs",
        "vue.js": "vuejs",
        angular: "angular",
        golang: "golang",
        go: "golang",
        rust: "rust",
        docker: "docker",
        kubernetes: "kubernetes",
        java: "java",
        swift: "swift",
        "c#": "csharp",
        php: "php",
        ruby: "ruby",
        kotlin: "kotlin",
        flutter: "flutter",
      };
      return {
        headline: d.headline,
        headlinePrefix: d.headlinePrefix,
        headlineAccent: d.headlineAccent,
        badge: d.badge,
        description: d.description,
        primaryCta: { ...transformCta(d.primaryCta, "primary"), hidden: false },
        secondaryCta: { ...transformCta(d.secondaryCta, "secondary"), hidden: false },
        techLogos: (d.techLogos ?? []).map((l: { name: string }, _i: number) => ({
          id: nextId("logo"),
          name: l.name,
          icon: techIconMap[l.name.toLowerCase()] ?? l.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        })),
        stats: (d.stats ?? []).map((stat: { value: string; label: string; suffix?: string }) => ({
          id: nextId("stat"),
          value: stat.value,
          label: stat.label,
          suffix: stat.suffix ?? "",
          prefix: "",
        })),
        floatingCards: (d.floatingCards ?? []).map((c: { title: string; subtitle: string }) => ({
          id: nextId("card"),
          title: c.title,
          subtitle: c.subtitle,
        })),
      };
    },
  },

  // ── Features ──────────────────────────────────────────────────────────────
  "features-grid": { ...featuresConfig("Features Grid") },
  "features-list": { ...featuresConfig("Features List") },
  "features-tabs": { ...featuresConfig("Features Tabs") },
  "features-accordion": { ...featuresConfig("Features Accordion") },

  // ── Testimonials ──────────────────────────────────────────────────────────
  "testimonials-carousel": { ...testimonialsConfig("Testimonials") },
  "testimonials-grid": { ...testimonialsConfig("Testimonials Grid") },

  // ── Logo Cloud ────────────────────────────────────────────────────────────
  "logo-cloud": {
    label: "Logo Cloud",
    jsonSchema: obj({
      headline: s("Optional headline, e.g. 'Trusted by leading companies'"),
      logos: arr(obj({ name: s("Company or brand name") }), 4, 8, "4-8 company/brand names"),
    }),
    instructions:
      "Generate company/brand names that would realistically partner with or be related to this business.",
    transform: (d, orgLogos) => ({
      headline: d.headline,
      logos: (d.logos ?? []).map((l: { name: string }, i: number) => ({
        id: nextId("logo"),
        name: l.name,
        logo: i === 0 && orgLogos?.light ? orgLogos.light : "",
      })),
    }),
  },

  // ── Stats Counter ─────────────────────────────────────────────────────────
  "stats-counter": {
    label: "Stats Counter",
    jsonSchema: obj({
      headline: s("Optional section headline"),
      stats: arr(
        obj(
          {
            value: s("Stat number as string, e.g. '500+', '15+', '98%', '24/7'"),
            label: s("Stat label (1-3 words)"),
            suffix: { type: "string", description: "Optional suffix like '+' or '%'" },
          },
          ["value", "label"]
        ),
        3,
        4,
        "3-4 impressive stats"
      ),
    }),
    instructions: `Generate 3-4 statistics about the business. Numbers must be realistic for the business's age and scale, a new startup should NOT claim "10K+ students". Format: value as string (e.g. "500+", "98%", "24/7"), label (1-3 words).`,
    transform: (d) => ({
      headline: d.headline,
      stats: (d.stats ?? []).map((stat: { value: string; label: string; suffix?: string }) => ({
        id: nextId("stat"),
        value: stat.value,
        label: stat.label,
        suffix: stat.suffix,
      })),
    }),
  },

  // ── About ─────────────────────────────────────────────────────────────────
  about: {
    label: "About",
    jsonSchema: obj({
      headline: s("Section headline, e.g. 'Our Story'"),
      subheadline: s("Subheadline (1 sentence)"),
      content: s("2-3 paragraphs about the company/business, plain text"),
    }),
    instructions:
      "Generate an about section. 2-3 paragraphs of plain text about what makes the business unique.",
    transform: (d) => ({ headline: d.headline, subheadline: d.subheadline, content: d.content }),
  },

  // ── Team ──────────────────────────────────────────────────────────────────
  // No AI config for "founders" or "team" ON PURPOSE. Those sections are real
  // people: names, roles and photos of an actual academy. Generating plausible
  // sounding colleagues is the one place invented content is not a draft to
  // edit but a claim about who works there. The button only appears for section
  // types listed here, so leaving them out is what hides it.

  // ── Timeline ──────────────────────────────────────────────────────────────
  timeline: {
    label: "Timeline",
    jsonSchema: obj({
      headline: s("Section headline, e.g. 'Our Journey'"),
      subheadline: s("Subheadline (1 sentence)"),
      items: arr(
        obj({
          date: s("Date or year (e.g. '2020', 'Jan 2021')"),
          title: s("Milestone title"),
          description: s("1-2 sentences"),
        }),
        3,
        8,
        "3-8 chronological milestones"
      ),
    }),
    instructions: "Generate a timeline of milestones in chronological order with realistic dates.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      items: (d.items ?? []).map((item: { date: string; title: string; description: string }) => ({
        id: nextId("item"),
        date: item.date,
        title: item.title,
        description: item.description,
      })),
    }),
  },

  // ── Gallery ───────────────────────────────────────────────────────────────
  gallery: {
    label: "Gallery",
    jsonSchema: obj({
      headline: s("Section headline"),
      images: arr(
        obj({ alt: s("Image alt text / description"), caption: s("Optional image caption") }, [
          "alt",
        ]),
        3,
        8,
        "3-8 gallery items"
      ),
    }),
    instructions: "Generate gallery image descriptions with alt text and captions.",
    transform: (d) => ({
      headline: d.headline,
      images: (d.images ?? []).map((img: { alt: string; caption?: string }) => ({
        id: nextId("img"),
        src: "",
        alt: img.alt,
        caption: img.caption,
      })),
    }),
  },

  // ── CTA ───────────────────────────────────────────────────────────────────
  "cta-banner": { ...ctaConfig("CTA Banner") },
  "cta-split": { ...ctaConfig("CTA Split") },

  // ── Pricing ───────────────────────────────────────────────────────────────
  "pricing-table": {
    label: "Pricing Table",
    jsonSchema: obj({
      headline: s("Section headline, e.g. 'Simple, Transparent Pricing'"),
      subheadline: s("Subheadline (1 sentence)"),
      tiers: arr(
        obj({
          name: s("Tier name, e.g. 'Starter', 'Pro', 'Enterprise'"),
          price: s("Price as string, e.g. '$29', 'Free', 'Custom'"),
          billingPeriod: s("Billing period, e.g. '/month', '/year'"),
          description: s("Short tier description (1 sentence)"),
          features: arr(obj({ text: s("Feature description") }), 3, 8, "3-8 features"),
          highlighted: {
            type: "boolean",
            description: "true for the most popular tier (only one)",
          },
          ctaText: s("CTA button text, e.g. 'Get Started', 'Try Free'"),
        }),
        2,
        4,
        "2-4 pricing tiers, only ONE highlighted"
      ),
    }),
    instructions:
      "Generate 2-4 pricing tiers with clear differentiation. Only ONE tier should be highlighted as popular.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      tiers: (d.tiers ?? []).map(
        (t: {
          name: string;
          price: string;
          billingPeriod: string;
          description: string;
          features: { text: string }[];
          highlighted: boolean;
          ctaText: string;
        }) => ({
          id: nextId("tier"),
          name: t.name,
          price: t.price,
          billingPeriod: t.billingPeriod,
          description: t.description,
          features: (t.features ?? []).map((f: { text: string }) => ({
            id: nextId("feat"),
            text: f.text,
          })),
          highlighted: t.highlighted,
          // The renderer reads tier.cta.{text,href} (a nested object). Emitting
          // flat ctaText/ctaHref leaves tier.cta undefined and crashes the
          // pricing table on render. Always produce a valid cta object.
          cta: { text: t.ctaText || "Get Started", href: "#" },
        })
      ),
    }),
  },

  // ── FAQ ───────────────────────────────────────────────────────────────────
  "faq-accordion": {
    label: "FAQ",
    jsonSchema: obj({
      headline: s("Section headline, e.g. 'Frequently Asked Questions'"),
      faqs: arr(
        obj({ question: s("FAQ question"), answer: s("Answer (2-3 sentences)") }),
        4,
        10,
        "4-10 FAQs"
      ),
    }),
    instructions:
      "Generate FAQs covering common concerns about the business. Answers should be 2-3 sentences each.",
    transform: (d) => ({
      headline: d.headline,
      faqs: (d.faqs ?? []).map((f: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: f.question,
        answer: f.answer,
      })),
    }),
  },

  // ── Contact Form ──────────────────────────────────────────────────────────
  "contact-form": {
    label: "Contact Form",
    jsonSchema: obj({
      headline: s("Section headline, e.g. 'Get in Touch'"),
      subheadline: s("Subheadline (1 sentence)"),
      successMessage: s("Message shown after successful form submission"),
    }),
    instructions:
      "Generate a contact form section with professional tone and a reassuring success message.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      successMessage: d.successMessage,
    }),
  },

  // ── Full-page sections ────────────────────────────────────────────────────
  "about-page": {
    label: "About Page",
    jsonSchema: obj({
      heroHeadline: s("Page headline"),
      heroSubheadline: s("Page subheadline (1-2 sentences)"),
      storyHeadline: s("Story section headline, e.g. 'Our Story'"),
      storyContent: s("2-3 paragraphs about company origin and mission"),
      valuesHeadline: s("Values section headline"),
      values: arr(
        obj({
          icon: s("lucide-react icon name in kebab-case"),
          title: s("Value name"),
          description: s("1-2 sentences"),
        }),
        3,
        6
      ),
      teamHeadline: s("Team section headline"),
      stats: arr(obj({ value: s("Stat value"), label: s("Stat label") }), 3, 4),
    }),
    instructions:
      "Generate an About Us page. Include authentic story, specific values with icons, realistic stats, and team headline.",
    transform: (d) => ({
      heroHeadline: d.heroHeadline,
      heroSubheadline: d.heroSubheadline,
      storyHeadline: d.storyHeadline,
      storyContent: d.storyContent,
      valuesHeadline: d.valuesHeadline,
      values: (d.values ?? []).map((v: { icon: string; title: string; description: string }) => ({
        id: nextId("val"),
        icon: v.icon,
        title: v.title,
        description: v.description,
      })),
      teamHeadline: d.teamHeadline,
      stats: (d.stats ?? []).map((stat: { value: string; label: string }) => ({
        id: nextId("stat"),
        value: stat.value,
        label: stat.label,
      })),
    }),
  },

  "contact-page": {
    label: "Contact Page",
    jsonSchema: obj(
      {
        headline: s("Page headline, e.g. 'Contact Us'"),
        subheadline: s("Subheadline (1 sentence)"),
        email: s("Contact email address"),
        phone: s("Contact phone number (optional)"),
        address: s("Physical address (optional)"),
        successMessage: s("Form success message"),
      },
      ["headline", "subheadline", "successMessage"]
    ),
    instructions: "Generate a contact page. Use real org contact details where available.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      email: d.email,
      phone: d.phone,
      address: d.address,
      successMessage: d.successMessage,
    }),
  },

  "pricing-page": {
    label: "Pricing Page",
    jsonSchema: obj({
      headline: s("Page headline"),
      subheadline: s("Subheadline (1 sentence)"),
      tiers: arr(
        obj({
          name: s("Tier name"),
          price: s("Price as string"),
          billingPeriod: s("e.g. '/month'"),
          description: s("1 sentence"),
          features: arr(obj({ text: s("Feature") }), 3, 8),
          highlighted: { type: "boolean" },
          ctaText: s("CTA text"),
        }),
        2,
        4
      ),
      faqHeadline: s("FAQ section headline"),
      faqs: arr(obj({ question: s("Question"), answer: s("Answer") }), 3, 6),
    }),
    instructions:
      "Generate a pricing page with 2-4 tiers (only ONE highlighted) and FAQs addressing pricing objections.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      tiers: (d.tiers ?? []).map(
        (t: {
          name: string;
          price: string;
          billingPeriod: string;
          description: string;
          features: { text: string }[];
          highlighted: boolean;
          ctaText: string;
        }) => ({
          id: nextId("tier"),
          name: t.name,
          price: t.price,
          billingPeriod: t.billingPeriod,
          description: t.description,
          features: (t.features ?? []).map((f: { text: string }) => ({
            id: nextId("feat"),
            text: f.text,
          })),
          highlighted: t.highlighted,
          ctaText: t.ctaText,
          ctaHref: "#",
        })
      ),
      faqHeadline: d.faqHeadline,
      faqs: (d.faqs ?? []).map((f: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: f.question,
        answer: f.answer,
      })),
    }),
  },

  "faq-page": {
    label: "FAQ Page",
    jsonSchema: obj({
      headline: s("Page headline"),
      subheadline: s("Subheadline"),
      categories: arr(
        obj({
          name: s("Category name"),
          faqs: arr(obj({ question: s("Question"), answer: s("Answer (2-3 sentences)") }), 2, 5),
        }),
        2,
        5,
        "2-5 FAQ categories"
      ),
    }),
    instructions:
      "Generate a comprehensive FAQ page with categories covering: getting started, features, pricing, support, security.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      categories: (d.categories ?? []).map(
        (cat: { name: string; faqs: { question: string; answer: string }[] }) => ({
          id: nextId("cat"),
          name: cat.name,
          faqs: (cat.faqs ?? []).map((f: { question: string; answer: string }) => ({
            id: nextId("faq"),
            question: f.question,
            answer: f.answer,
          })),
        })
      ),
    }),
  },

  "privacy-page": {
    label: "Privacy Page",
    jsonSchema: obj({
      headline: s("Page headline, e.g. 'Privacy Policy'"),
      lastUpdated: s("Last updated date, e.g. 'March 2026'"),
      sections: arr(
        obj({
          heading: s("Section heading"),
          content: s("Section content (plain text, 2-4 sentences)"),
        }),
        5,
        12,
        "5-12 privacy policy sections"
      ),
    }),
    instructions:
      "Generate a privacy policy. Cover: data collection, usage, sharing, security, cookies, user rights, contact info.",
    transform: (d) => ({
      headline: d.headline,
      lastUpdated: d.lastUpdated,
      sections: (d.sections ?? []).map((sec: { heading: string; content: string }) => ({
        id: nextId("sec"),
        heading: sec.heading,
        content: sec.content,
      })),
    }),
  },

  "terms-page": {
    label: "Terms of Service",
    jsonSchema: obj({
      headline: s("Page headline, e.g. 'Terms of Service'"),
      lastUpdated: s("Last updated date"),
      sections: arr(
        obj({
          heading: s("Section heading"),
          content: s("Section content (plain text, 2-4 sentences)"),
        }),
        5,
        12,
        "5-12 terms sections"
      ),
    }),
    instructions:
      "Generate terms of service. Cover: acceptance, responsibilities, IP, limitations, termination, governing law.",
    transform: (d) => ({
      headline: d.headline,
      lastUpdated: d.lastUpdated,
      sections: (d.sections ?? []).map((sec: { heading: string; content: string }) => ({
        id: nextId("sec"),
        heading: sec.heading,
        content: sec.content,
      })),
    }),
  },

  // ── AI Language Practice: Code & Tech ─────────────────────────────────────

  // ── About Us Page Sections ────────────────────────────────────────────────

  "about-us-hero": {
    label: "About Us: Hero",
    jsonSchema: obj({
      headline: s("First part of headline before the highlight (1-3 words, e.g. 'About')"),
      highlightText: s("Highlighted/accent word (1-2 words, e.g. 'Us')"),
      description: s("Compelling description of the business (2-3 sentences)"),
      stats: arr(
        obj({
          value: s("Stat value as string with suffix, e.g. '50+', '10K+', '95%'"),
          label: s("Stat label (1-3 words, e.g. 'Expert Courses')"),
        }),
        3,
        4,
        "3-4 impressive stats"
      ),
    }),
    instructions:
      "Generate an About Us hero section. The headline should be split into a plain part and a highlighted accent word. Description should be a compelling elevator pitch. Stats should be realistic and impressive for the business scale.",
    transform: (d) => ({
      headline: d.headline,
      highlightText: d.highlightText,
      description: d.description,
      stats: (d.stats ?? []).map((stat: { value: string; label: string }) => ({
        id: nextId("stat"),
        value: stat.value,
        label: stat.label,
      })),
    }),
  },

  "about-us-mission": {
    label: "About Us: Mission",
    jsonSchema: obj({
      blocks: arr(
        obj({
          label: s("Short uppercase label, e.g. 'Our Mission', 'Who We Are', 'Our Vision'"),
          title: s("Bold, inspiring title (5-10 words)"),
          description: s("Detailed description (2-4 sentences)"),
        }),
        2,
        3,
        "2-3 blocks (e.g. Mission, Who We Are, Vision)"
      ),
    }),
    instructions:
      "Generate mission/identity blocks. First block should be about the company mission. Second block about who the company is (team, expertise). Optional third for vision. Use inspiring, authentic language.",
    transform: (d) => ({
      blocks: (d.blocks ?? []).map(
        (block: { label: string; title: string; description: string }) => ({
          id: nextId("block"),
          label: block.label,
          title: block.title,
          description: block.description,
        })
      ),
    }),
  },

  "about-us-offerings": {
    label: "About Us: Offerings",
    jsonSchema: obj({
      headline: s("Section headline (2-4 words, e.g. 'What We Offer')"),
      description: s("Brief overview of offerings (1-2 sentences)"),
      offerings: arr(
        obj({
          icon: s(
            "lucide-react icon name in kebab-case, e.g. 'code', 'book-open', 'briefcase', 'globe', 'zap', 'heart'"
          ),
          title: s("Offering title (2-4 words)"),
          description: s("What this offering provides (1-2 sentences)"),
          tags: arr(s("Short tag label (1-2 words)"), 3, 5, "3-5 specific topic tags"),
        }),
        3,
        4,
        "3-4 offerings"
      ),
    }),
    instructions:
      "Generate offerings that reflect the business. Each offering should have a specific icon, clear title, concise description, and 3-5 specific topic tags. Icons: lucide-react names in kebab-case.",
    transform: (d) => ({
      headline: d.headline,
      description: d.description,
      offerings: (d.offerings ?? []).map(
        (o: { icon: string; title: string; description: string; tags: string[] }) => ({
          id: nextId("offering"),
          icon: o.icon,
          title: o.title,
          description: o.description,
          tags: o.tags ?? [],
        })
      ),
    }),
  },

  "about-us-values": {
    label: "About Us: Values",
    jsonSchema: obj({
      headline: s("Section headline (2-4 words, e.g. 'Our Values')"),
      description: s("Brief intro about the values (1 sentence)"),
      values: arr(
        obj({
          icon: s(
            "lucide-react icon name in kebab-case, e.g. 'globe', 'check-circle', 'zap', 'users', 'heart', 'shield', 'star', 'target'"
          ),
          title: s("Value name (1-2 words, e.g. 'Accessibility', 'Quality')"),
          description: s("What this value means to the company (1-2 sentences)"),
        }),
        4,
        6,
        "4-6 core values"
      ),
    }),
    instructions:
      "Generate core values that feel authentic and specific to the business. Each value should have a unique icon, a one-word title, and a specific description. Icons: lucide-react names in kebab-case.",
    transform: (d) => ({
      headline: d.headline,
      description: d.description,
      values: (d.values ?? []).map((v: { icon: string; title: string; description: string }) => ({
        id: nextId("value"),
        icon: v.icon,
        title: v.title,
        description: v.description,
      })),
    }),
  },

  // ── Contact Us Page Sections ────────────────────────────────────────────────

  "contact-us-hero": {
    label: "Contact Us: Hero",
    jsonSchema: obj({
      headline: s("First part of headline (2-4 words, e.g. 'Get in')"),
      highlightText: s("Italic accent word (1-2 words, e.g. 'Touch')"),
      description: s("Friendly description inviting people to reach out (1-2 sentences)"),
    }),
    instructions:
      "Generate a Contact Us hero section. The headline should invite conversation. The highlight text should be italic/accent. Keep it warm and professional.",
    transform: (d) => ({
      headline: d.headline,
      highlightText: d.highlightText,
      description: d.description,
    }),
  },

  "contact-us-info": {
    label: "Contact Us: Info Cards",
    jsonSchema: obj({
      cards: arr(
        obj({
          icon: s(
            "lucide-react icon name in kebab-case: 'mail', 'phone', 'map-pin', 'globe', 'building', 'clock', 'message-circle'"
          ),
          title: s("Short uppercase label (1-2 words, e.g. 'Email Us', 'Call Us', 'Visit Us')"),
          detail: s("Primary contact detail (email, phone number, or address)"),
          subtext: s("Additional info (e.g. 'We reply within 24 hours', 'Mon-Sat, 9AM-8PM')"),
        }),
        3,
        4,
        "3-4 contact method cards"
      ),
    }),
    instructions:
      "Generate contact info cards. Use realistic business contact details. Each card should have a unique communication channel (email, phone, location, etc.).",
    transform: (d) => ({
      cards: (d.cards ?? []).map(
        (card: { icon: string; title: string; detail: string; subtext: string }) => ({
          id: nextId("card"),
          icon: card.icon,
          title: card.title,
          detail: card.detail,
          subtext: card.subtext,
        })
      ),
    }),
  },

  "contact-us-form": {
    label: "Contact Us: Form",
    jsonSchema: obj({
      formHeadline: s("Form headline (3-5 words, e.g. 'Send us a message')"),
      formDescription: s(
        "Brief instruction (1 sentence, e.g. 'Fill out the form and our team will get back to you within 24 hours.')"
      ),
      submitText: s("Submit button text (2-3 words, e.g. 'Send Message')"),
      successHeadline: s("Success message headline (2-3 words, e.g. 'Message Sent!')"),
      successMessage: s("Success confirmation message (1 sentence)"),
      illustrationHeadline: s("Sidebar headline (3-6 words, e.g. 'We\\'re Always Here for You')"),
      illustrationDescription: s("Sidebar description (1-2 sentences, supportive and warm)"),
      illustrationStats: arr(
        obj({
          value: s("Stat value as string (e.g. '<2hr', '24/7', '98%')"),
          label: s("Stat label (1-2 words, e.g. 'Avg Reply', 'Support', 'Satisfied')"),
        }),
        3,
        3,
        "Exactly 3 support stats"
      ),
      faqHeadline: s("FAQ section title (2-3 words, e.g. 'Quick Answers')"),
      faqs: arr(
        obj({
          question: s("FAQ question relevant to contacting the business"),
          answer: s("Concise answer (1-2 sentences)"),
        }),
        3,
        5,
        "3-5 frequently asked questions"
      ),
    }),
    instructions:
      "Generate a contact form section with supporting info. The form should feel warm and professional. Stats should reflect good support metrics. FAQs should answer common contact-related questions.",
    transform: (d) => ({
      formHeadline: d.formHeadline,
      formDescription: d.formDescription,
      fields: [
        {
          id: nextId("f"),
          name: "name",
          label: "Full Name",
          type: "text",
          placeholder: "John Doe",
          required: true,
          halfWidth: true,
        },
        {
          id: nextId("f"),
          name: "email",
          label: "Email Address",
          type: "email",
          placeholder: "john@example.com",
          required: true,
          halfWidth: true,
        },
        {
          id: nextId("f"),
          name: "phone",
          label: "Phone Number",
          type: "tel",
          placeholder: "+91 98765 43210",
          halfWidth: true,
        },
        {
          id: nextId("f"),
          name: "subject",
          label: "Subject",
          type: "select",
          placeholder: "Select a subject",
          options: [
            "Course Inquiry",
            "Private Tuition",
            "Pricing & Plans",
            "Technical Support",
            "Partnership",
            "Other",
          ],
          halfWidth: true,
        },
        {
          id: nextId("f"),
          name: "message",
          label: "Your Message",
          type: "textarea",
          placeholder: "Tell us how we can help you...",
          required: true,
        },
      ],
      submitText: d.submitText,
      successHeadline: d.successHeadline,
      successMessage: d.successMessage,
      illustrationHeadline: d.illustrationHeadline,
      illustrationDescription: d.illustrationDescription,
      illustrationStats: (d.illustrationStats ?? []).map(
        (stat: { value: string; label: string }) => ({
          id: nextId("stat"),
          value: stat.value,
          label: stat.label,
        })
      ),
      faqHeadline: d.faqHeadline,
      faqs: (d.faqs ?? []).map((faq: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: faq.question,
        answer: faq.answer,
      })),
    }),
  },

  // ── FAQ Page Sections ──────────────────────────────────────────────────────

  "faq-us-hero": {
    label: "FAQ: Hero",
    jsonSchema: obj({
      headline: s("First part of headline (2-4 words, e.g. 'Frequently Asked')"),
      highlightText: s("Italic accent word (1-2 words, e.g. 'Questions')"),
      description: s("Friendly description about the FAQ page (1-2 sentences)"),
    }),
    instructions:
      "Generate an FAQ page hero section. Keep it simple and welcoming. The highlight text should be italic/accent.",
    transform: (d) => ({
      headline: d.headline,
      highlightText: d.highlightText,
      description: d.description,
    }),
  },

  "faq-us-list": {
    label: "FAQ: List",
    jsonSchema: obj({
      items: arr(
        obj({
          question: s("FAQ question relevant to the business"),
          answer: s("Detailed, helpful answer (2-4 sentences)"),
        }),
        8,
        16,
        "8-16 frequently asked questions covering enrollment, content, payment, support, etc."
      ),
    }),
    instructions:
      "Generate a comprehensive FAQ list. Cover topics like enrollment, course format, certificates, payment, refunds, support, and technical requirements. Answers should be detailed, friendly, and helpful, 2-4 sentences each.",
    transform: (d) => ({
      items: (d.items ?? []).map((item: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: item.question,
        answer: item.answer,
      })),
    }),
  },

  // ── Privacy Policy Page Sections ────────────────────────────────────────────

  "privacy-us-hero": {
    label: "Privacy: Hero",
    jsonSchema: obj({
      headline: s("First part of headline (1-2 words, e.g. 'Privacy')"),
      highlightText: s("Italic accent word (1-2 words, e.g. 'Policy')"),
      description: s("Brief description about privacy commitment (1-2 sentences)"),
      lastUpdated: s("Last updated date (e.g. 'March 15, 2026')"),
      version: s("Version number (e.g. '2.1')"),
    }),
    instructions:
      "Generate a privacy policy hero section. Keep it professional and trustworthy. Emphasize commitment to user privacy.",
    transform: (d) => ({
      headline: d.headline,
      highlightText: d.highlightText,
      description: d.description,
      lastUpdated: d.lastUpdated,
      version: d.version,
    }),
  },

  "privacy-us-content": {
    label: "Privacy: Content",
    jsonSchema: obj({
      sections: arr(
        obj({
          icon: s(
            "lucide-react icon name in kebab-case: 'shield-check', 'clipboard-check', 'archive', 'lightbulb', 'lock', 'clock', 'fingerprint', 'user', 'users', 'heart', 'pen-line', 'shield', 'file-text'"
          ),
          title: s(
            "Section title (2-4 words, e.g. 'Introduction', 'Data Security', 'Your Rights')"
          ),
          body: s(
            "Section body text, detailed, professional, 2-4 sentences covering the policy topic"
          ),
        }),
        8,
        12,
        "8-12 policy sections covering: introduction, applicability, data collection, data usage, security, retention/deletion, cookies, user rights, data sharing, children's privacy, policy updates"
      ),
    }),
    instructions:
      "Generate a comprehensive privacy policy. Each section should be professional, clear, and thorough. Cover standard privacy topics: introduction, what data is collected, how it's used, security measures, retention & deletion, cookies, user rights, data sharing policy, children's privacy, and policy updates. Use reassuring language that builds trust.",
    transform: (d) => ({
      sections: (d.sections ?? []).map((sec: { icon: string; title: string; body: string }) => ({
        id: nextId("sec"),
        icon: sec.icon,
        title: sec.title,
        body: sec.body,
      })),
    }),
  },

  // ── Terms of Service Page Sections ──────────────────────────────────────────

  "terms-us-hero": {
    label: "Terms: Hero",
    jsonSchema: obj({
      headline: s("First part of headline (2-3 words, e.g. 'Terms of')"),
      highlightText: s("Italic accent word (1-2 words, e.g. 'Service')"),
      description: s("Brief description inviting users to review the terms (1-2 sentences)"),
    }),
    instructions:
      "Generate a Terms of Service hero section. Keep it professional and clear. Emphasize that users should review the terms carefully.",
    transform: (d) => ({
      headline: d.headline,
      highlightText: d.highlightText,
      description: d.description,
    }),
  },

  "terms-us-content": {
    label: "Terms: Content",
    jsonSchema: obj({
      introText: s(
        "Opening paragraph explaining what the terms cover and that using the service means agreement (2-3 sentences)"
      ),
      sections: arr(
        obj({
          title: s(
            "Section title (2-4 words, e.g. 'Accounts', 'Payments & Refunds', 'Content Rules')"
          ),
          body: s("Section body, professional, clear, 2-4 sentences covering the terms topic"),
        }),
        10,
        14,
        "10-14 terms sections covering: accounts, communications, content access, payments, digital products, behavior rules, content rights, risk disclaimer, platform rights, subscriptions, legal terms, dispute resolution, updates"
      ),
    }),
    instructions:
      "Generate comprehensive Terms of Service. Each section should be professional, clear, and written in plain language. Cover standard topics: accounts, communications, content enrollment, payments/refunds, digital product access, content rules, user content rights, risk disclaimer, platform rights, subscriptions, miscellaneous legal, dispute resolution, and policy updates.",
    transform: (d) => ({
      introText: d.introText,
      sections: (d.sections ?? []).map((sec: { title: string; body: string }) => ({
        id: nextId("sec"),
        title: sec.title,
        body: sec.body,
      })),
    }),
  },

  "about-us-contact": {
    label: "About Us: Contact",
    jsonSchema: obj({
      label: s("Short uppercase label (1-2 words, e.g. 'Contact Us', 'Get In Touch')"),
      headline: s("Engaging headline (4-8 words, e.g. 'Questions? We\\'re here to help.')"),
      description: s("Friendly invitation to reach out (1-2 sentences)"),
      email: s(
        "Contact email address (use a professional-sounding email, e.g. 'contact@example.com')"
      ),
      emailLabel: s("Label above the email (2-4 words, e.g. 'Email us at')"),
    }),
    instructions:
      "Generate a contact CTA section. Tone should be warm, inviting, and professional. The email should be plausible for the business.",
    transform: (d) => ({
      label: d.label,
      headline: d.headline,
      description: d.description,
      email: d.email,
      emailLabel: d.emailLabel,
    }),
  },

  // ── Photography Landing Page Sections ──────────────────────────────────────

  "hero-photography": {
    label: "Hero: Photography",
    jsonSchema: obj({
      headline: s(
        "Bold, dramatic headline for a creative/photography brand (3-6 words, use line break \\n to split across 2 lines)"
      ),
      description: s("Compelling subtitle (1-2 sentences) that speaks to aspiring creatives"),
      stats: arr(
        obj({
          value: s("Stat value with suffix (e.g. '12K+', '4.9', '50+')"),
          label: s("Stat label (1-2 words, e.g. 'Students', 'Rating', 'Courses')"),
        }),
        2,
        4,
        "2-4 key stats showcasing credibility"
      ),
    }),
    instructions:
      "Generate a dramatic, attention-grabbing hero section for a creative education platform. The headline should be bold and aspirational, using uppercase style. Stats should showcase social proof. Do NOT generate CTA buttons, they are handled separately.",
    transform: (d) => ({
      headline: d.headline,
      description: d.description,
      primaryCta: { text: "Enroll Now", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Gallery", href: "#gallery-photography", variant: "outline" },
      stats: (d.stats ?? []).map((stat: { value: string; label: string }) => ({
        id: nextId("stat"),
        value: stat.value,
        label: stat.label,
      })),
    }),
  },

  "about-photography": {
    label: "About: Photography",
    jsonSchema: obj({
      headline: s("First line of heading (2-4 words, e.g. 'Learn from')"),
      headlineAccent: s("Accent/highlighted part of heading (2-4 words, e.g. 'the Best')"),
      description: s(
        "Primary bio paragraph (2-3 sentences) highlighting expertise, experience, and notable work"
      ),
      secondaryDescription: s(
        "Secondary paragraph (2-3 sentences) about teaching philosophy and what students can expect"
      ),
      credentials: arr(
        obj({
          icon: s("Lucide icon name: 'award' or 'graduation-cap'"),
          title: s("Credential title (2-3 words, e.g. 'Award Winning', 'Certified')"),
          description: s("Short credential description (5-10 words)"),
        }),
        2,
        2,
        "Exactly 2 credential cards"
      ),
    }),
    instructions:
      "Generate an instructor/about section for a creative education platform. The bio should sound experienced and authoritative but approachable. Credentials should highlight awards and certifications. Icons must be 'award' or 'graduation-cap'.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      secondaryDescription: d.secondaryDescription,
      credentials: (d.credentials ?? []).map(
        (c: { icon: string; title: string; description: string }) => ({
          id: nextId("cred"),
          icon: c.icon,
          title: c.title,
          description: c.description,
        })
      ),
    }),
  },

  "features-photography": {
    label: "Features: Photography",
    jsonSchema: obj({
      headline: s("Section heading (2-4 words, e.g. 'What You Get')"),
      features: arr(
        obj({
          icon: s(
            "Lucide icon name in kebab-case: 'video', 'users', 'message-circle', or 'download'"
          ),
          title: s("Feature title (2-4 words, e.g. 'HD Video Lessons')"),
          description: s("Feature description (1-2 sentences)"),
        }),
        4,
        4,
        "Exactly 4 features"
      ),
    }),
    instructions:
      "Generate 4 key features/benefits of the platform. Each should highlight a unique value proposition. Icons must be one of: 'video', 'users', 'message-circle', 'download'.",
    transform: (d) => ({
      headline: d.headline,
      features: (d.features ?? []).map(
        (f: { icon: string; title: string; description: string }) => ({
          id: nextId("feat"),
          icon: f.icon,
          title: f.title,
          description: f.description,
        })
      ),
    }),
  },

  "gallery-photography": {
    label: "Gallery: Photography",
    jsonSchema: obj({
      headline: s("Section heading (2-3 words, e.g. 'Student Work')"),
      description: s("Brief subtitle (1 sentence) about what the gallery showcases"),
    }),
    instructions:
      "Generate a heading and description for a student work gallery section. Keep it aspirational and encouraging.",
    transform: (d) => ({
      headline: d.headline,
      description: d.description,
    }),
  },

  "testimonials-photography": {
    label: "Testimonials: Photography",
    jsonSchema: obj({
      headline: s("Section heading (2-3 words, e.g. 'Success Stories')"),
      testimonials: arr(
        obj({
          quote: s(
            "Authentic testimonial quote (2-3 sentences) about learning experience and results"
          ),
          author: s("Full name of the student"),
          role: s(
            "Student's role/specialty (e.g. 'Portrait Photographer', 'Wedding Photographer')"
          ),
          rating: { type: "number", minimum: 4, maximum: 5, description: "Rating 4-5" },
        }),
        3,
        3,
        "Exactly 3 testimonials"
      ),
    }),
    instructions:
      "Generate 3 realistic, enthusiastic testimonials from students. Each should mention specific results or transformations. Roles should be photography-related specialties.",
    transform: (d) => ({
      headline: d.headline,
      testimonials: (d.testimonials ?? []).map(
        (t: { quote: string; author: string; role: string; rating: number }) => ({
          id: nextId("test"),
          quote: t.quote,
          author: t.author,
          role: t.role,
          rating: t.rating,
        })
      ),
    }),
  },

  "faq-photography": {
    label: "FAQ: Photography",
    jsonSchema: obj({
      headline: s("Section heading (1-2 words, e.g. 'FAQ')"),
      items: arr(
        obj({
          question: s("Common question (1 sentence)"),
          answer: s("Clear, helpful answer (2-3 sentences)"),
        }),
        4,
        6,
        "4-6 frequently asked questions"
      ),
    }),
    instructions:
      "Generate common FAQs for an online education/course platform. Cover topics like: equipment requirements, access duration, beginner suitability, refund policy, certificates. Answers should be reassuring and informative.",
    transform: (d) => ({
      headline: d.headline,
      items: (d.items ?? []).map((item: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: item.question,
        answer: item.answer,
      })),
    }),
  },

  "cta-photography": {
    label: "CTA: Photography",
    jsonSchema: obj({
      headline: s("Bold CTA headline first line (2-4 words, e.g. 'Start Your')"),
      headlineAccent: s("Bold CTA headline second line (2-4 words, e.g. 'Journey Today')"),
      description: s("Motivational subtitle (1-2 sentences)"),
      guaranteeText: s("Trust/guarantee text (e.g. '30-Day Money-Back Guarantee • No Risk')"),
    }),
    instructions:
      "Generate a bold, motivational CTA section. The headline should be split into two lines for dramatic effect. Include a guarantee or trust badge text. Do NOT generate CTA buttons, they are handled separately.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      primaryCta: { text: "Enroll Now", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View All Courses", href: "/all-courses", variant: "outline" },
      guaranteeText: d.guaranteeText,
    }),
  },

  // ── Mindfulness Template Sections ──────────────────────────────────────────

  "hero-mindfulness": {
    label: "Hero: Mindfulness",
    jsonSchema: obj({
      headline: s("Main headline (4-8 words, e.g. 'Find Your Path to')"),
      headlineAccent: s("Accent/highlighted part of headline (2-4 words, e.g. 'Inner Peace')"),
      description: s("Supporting description about the mindfulness platform (2-3 sentences)"),
      primaryCta: ctaSchema(
        "Primary CTA text (2-4 words, e.g. 'Start Learning Free')",
        "Best route for primary CTA. Typically '/login' or '/all-courses'.",
      ),
      secondaryCta: ctaSchema(
        "Secondary CTA text (2-4 words, e.g. 'Watch Demo')",
        "Best route for secondary CTA. Typically '/' or '/about'.",
      ),
      liveBadgeText: s("Short live badge text (1-2 words, e.g. 'Live Now')"),
      stats: arr(
        obj({
          icon: s("Icon name: 'heart-pulse', 'moon', or 'brain'"),
          label: s("Short stat label (1 word, e.g. 'Stress', 'Sleep', 'Focus')"),
          value: s("Stat value with sign (e.g. '-65%', '8.5h', '+42%')"),
        }),
        3, 3, "Exactly 3 wellness stats"
      ),
      benefits: arr(
        obj({
          icon: s("Icon name: 'shield-check', 'clock', 'award', or 'smartphone'"),
          label: s("Benefit label (2-4 words, e.g. 'Science-Backed Methods')"),
        }),
        3, 5, "3-5 benefit items"
      ),
    }),
    instructions: `Generate a mindfulness/wellness hero section. Focus on inner peace, meditation, breathwork, and personal growth. Stats should reflect wellness metrics. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
      secondaryCta: transformCta(d.secondaryCta, "outline"),
      liveBadgeText: d.liveBadgeText,
      stats: (d.stats ?? []).map((s: { icon: string; label: string; value: string }) => ({
        id: nextId("stat"),
        icon: s.icon,
        label: s.label,
        value: s.value,
      })),
      benefits: (d.benefits ?? []).map((b: { icon: string; label: string }) => ({
        id: nextId("benefit"),
        icon: b.icon,
        label: b.label,
      })),
    }),
  },

  "teach-mindfulness": {
    label: "Learn: Mindfulness",
    jsonSchema: obj({
      badge: s("Short badge text (3-6 words, e.g. 'Start Your Mindfulness Journey')"),
      headline: s("Main headline (3-6 words, e.g. 'Learn at Your Own Pace.')"),
      headlineAccent: s("Accent part (3-6 words, e.g. 'Grow Every Day.')"),
      description: s("Description inviting learners to explore courses (1-2 sentences)"),
      primaryCta: ctaSchema(
        "CTA button text (2-4 words, e.g. 'Explore Courses')",
        "Best route for the CTA. Typically '/all-courses'.",
      ),
    }),
    instructions: `Generate a section inviting learners to start their mindfulness journey on the platform. Focus on self-paced learning, expert guidance, and personal growth. Tone: warm, inviting, aspirational. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
    }),
  },

  "how-it-works-mindfulness": {
    label: "How It Works: Mindfulness",
    jsonSchema: obj({
      headline: s("Section headline (2-4 words, e.g. 'How it')"),
      headlineAccent: s("Accent word (1-2 words, e.g. 'works')"),
      description: s("Brief subtitle (1 sentence)"),
      steps: arr(
        obj({
          icon: s("Icon name: 'search', 'shopping-cart', 'graduation-cap', or 'star'"),
          stepLabel: s("Step label (e.g. 'STEP 1')"),
          title: s("Step title (1-2 words, e.g. 'Browse')"),
          description: s("Step description (1 sentence)"),
        }),
        3, 5, "3-5 steps"
      ),
    }),
    instructions: "Generate a how-it-works section for a mindfulness learning platform. Steps should guide from discovery to transformation.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      steps: (d.steps ?? []).map((step: { icon: string; stepLabel: string; title: string; description: string }) => ({
        id: nextId("step"),
        icon: step.icon,
        stepLabel: step.stepLabel,
        title: step.title,
        description: step.description,
      })),
    }),
  },

  "testimonials-mindfulness": {
    label: "Testimonials: Mindfulness",
    jsonSchema: obj({
      headline: s("Section headline (2-4 words, e.g. 'Stories of')"),
      headlineAccent: s("Accent word (1-2 words, e.g. 'transformation')"),
      description: s("Brief subtitle (1 sentence)"),
      testimonials: arr(
        obj({
          name: s("Full name"),
          role: { type: "string", enum: ["learner", "instructor"], description: "Role: learner or instructor" },
          quote: s("Testimonial quote (2-3 sentences)"),
          rating: { type: "number", minimum: 4, maximum: 5, description: "Rating (4 or 5)" },
        }),
        3, 6, "3-6 testimonials, mix of learners and instructors"
      ),
    }),
    instructions: "Generate testimonials for a mindfulness platform. Mix learner and instructor perspectives. Focus on transformation, peace, and growth.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      testimonials: (d.testimonials ?? []).map((t: { name: string; role: string; quote: string; rating: number }) => ({
        id: nextId("testimonial"),
        name: t.name,
        role: t.role,
        quote: t.quote,
        rating: t.rating,
      })),
    }),
  },

  "cta-mindfulness": {
    label: "CTA: Mindfulness",
    jsonSchema: obj({
      badge: s("Social proof badge (e.g. 'Join 50,000+ on Their Journey')"),
      headline: s("CTA headline (4-8 words, e.g. 'Begin Your Path to')"),
      headlineAccent: s("Accent part (2-4 words, e.g. 'Inner Peace')"),
      description: s("Motivational description (1-2 sentences)"),
      primaryCta: ctaSchema(
        "CTA button text (2-4 words, e.g. 'Explore Courses')",
        "Best route for the CTA. Typically '/all-courses' or '/login'.",
      ),
      trustBadges: arr(
        obj({ label: s("Trust badge text (2-4 words, e.g. 'No credit card required')") }),
        2, 4, "2-4 trust badges"
      ),
    }),
    instructions: `Generate a final CTA section for a mindfulness platform. Motivational tone. Trust badges should reduce friction. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
      trustBadges: (d.trustBadges ?? []).map((b: { label: string }) => ({
        id: nextId("trust"),
        label: b.label,
      })),
    }),
  },

  "roadmap-mindfulness": {
    label: "Roadmap: Mindfulness",
    jsonSchema: obj({
      headline: s("Section headline (2-3 words, e.g. 'Curated Learning')"),
      headlineAccent: s("Accent word (1-2 words, e.g. 'Paths')"),
      description: s("Brief subtitle (1-2 sentences about structured learning journeys)"),
      waypoints: arr(
        obj({
          label: s("Waypoint label (1 word, e.g. 'Discover', 'Learn', 'Practice')"),
          icon: s("Icon name: 'compass', 'book', 'repeat', 'sprout', or 'trophy'"),
        }),
        4, 6, "4-6 waypoints along the journey"
      ),
      goalLabel: s("Goal label at the end of the path (1-2 words, e.g. 'Inner Peace')"),
      primaryCta: ctaSchema(
        "CTA button text (2-4 words, e.g. 'Start Your Journey')",
        "Best route for the CTA. Typically '/all-courses' or '/login'.",
      ),
    }),
    instructions: `Generate a visual roadmap section for a mindfulness/wellness platform. This is design-centric, waypoints represent abstract stages of a learning journey (not specific courses). Keep labels short (1 word each). The goalLabel is the destination. Warm, inspiring tone. Icons must be one of: compass, book, repeat, sprout, trophy. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      waypoints: (d.waypoints ?? []).map((w: { label: string; icon: string }) => ({
        id: nextId("wp"),
        label: w.label,
        icon: w.icon,
      })),
      goalLabel: d.goalLabel,
      primaryCta: transformCta(d.primaryCta, "primary"),
    }),
  },

  // ============================================
  // Exam Prep Template Sections
  // ============================================

  "hero-examprep": {
    label: "Hero: IIT JEE / NEET",
    jsonSchema: obj({
      badge: s("Short badge text (3-8 words, e.g. 'India\\'s Most Trusted IIT JEE / NEET Platform')"),
      headline: s("Main headline (3-6 words, e.g. 'Master Your')"),
      headlineAccent: s("Accent/highlighted part (2-4 words, e.g. 'IIT JEE & NEET')"),
      description: s("Supporting description about the IIT JEE / NEET coaching platform (2-3 sentences)"),
      primaryCta: ctaSchema("Primary CTA text (2-4 words)", "Best route for CTA"),
      stats: arr(
        obj({
          value: s("Stat value with suffix (e.g. '50K+', '4.9', '200+')"),
          label: s("Stat label (1-2 words, e.g. 'Students', 'Rating', 'Courses')"),
        }),
        2, 4, "2-4 key stats"
      ),
    }),
    instructions: `Generate a hero section for an IIT JEE / NEET coaching platform. Focus on IIT JEE and NEET competitive exams. Stats should showcase social proof. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
      stats: (d.stats ?? []).map((stat: { value: string; label: string }) => ({
        id: nextId("stat"),
        value: stat.value,
        label: stat.label,
      })),
    }),
  },

  "features-examprep": {
    label: "Features: IIT JEE / NEET",
    jsonSchema: obj({
      headline: s("Section headline (3-6 words, e.g. 'Everything You Need to')"),
      headlineAccent: s("Accent text (3-5 words, e.g. 'Crack Your Dream Exam')"),
      description: s("Supporting description (1-2 sentences)"),
      features: arr(
        obj({
          icon: s("Icon name: 'presentation', 'file-text', 'mic', 'book-open', 'bar-chart', or 'video'"),
          title: s("Feature title (2-4 words)"),
          description: s("Feature description (1-2 sentences)"),
        }),
        4, 6, "4-6 features"
      ),
    }),
    instructions: "Generate features for an IIT JEE / NEET coaching platform. Include live classes, mock tests, AI interviews, study materials, progress tracking, and recorded courses.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      features: (d.features ?? []).map((f: { icon: string; title: string; description: string }) => ({
        id: nextId("feat"),
        icon: f.icon,
        title: f.title,
        description: f.description,
      })),
    }),
  },

  "learning-paths-examprep": {
    label: "Learning Paths: IIT JEE / NEET",
    jsonSchema: obj({
      headline: s("Section headline (2-3 words, e.g. 'Comprehensive')"),
      headlineAccent: s("Accent text (1-3 words, e.g. 'Learning Paths')"),
      description: s("Brief subtitle (1-2 sentences about structured learning journeys)"),
      waypoints: arr(
        obj({
          label: s("Waypoint label (1-2 words, e.g. 'Foundation', 'Practice', 'Mock Tests')"),
          icon: s("Icon name: 'compass', 'book', 'repeat', 'sprout', or 'trophy'"),
        }),
        4, 6, "4-6 waypoints along the journey"
      ),
      goalLabel: s("Goal label at the end of the path (1-2 words, e.g. 'Success')"),
      primaryCta: ctaSchema(
        "CTA button text (2-4 words, e.g. 'Start Your Journey')",
        "Best route for the CTA. Typically '/all-courses' or '/login'.",
      ),
    }),
    instructions: `Generate a visual roadmap section for an IIT JEE / NEET coaching platform. This is design-centric, waypoints represent abstract stages of a learning journey (not specific courses). Keep labels short (1-2 words each). The goalLabel is the destination. Motivating, academic tone. Icons must be one of: compass, book, repeat, sprout, trophy. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      waypoints: (d.waypoints ?? []).map((w: { label: string; icon: string }) => ({
        id: nextId("wp"),
        label: w.label,
        icon: w.icon,
      })),
      goalLabel: d.goalLabel,
      primaryCta: transformCta(d.primaryCta, "primary"),
    }),
  },

  "about-examprep": {
    label: "About: IIT JEE / NEET",
    jsonSchema: obj({
      badge: s("Short badge text (2-4 words, e.g. 'Expert Faculty Team')"),
      headline: s("Headline (2-4 words, e.g. 'Learn from')"),
      headlineAccent: s("Accent text (3-5 words, e.g. 'India\\'s Best Educators')"),
      description: s("Description about the faculty/team (2-3 sentences)"),
      credentials: arr(
        obj({
          title: s("Credential title (3-6 words)"),
          description: s("Credential description (1 sentence)"),
        }),
        2, 4, "2-4 credentials"
      ),
      primaryCta: ctaSchema("CTA text (2-4 words)", "Best route for CTA"),
    }),
    instructions: `Generate an about/faculty section for an IIT JEE / NEET coaching platform. Highlight expertise, experience, and track record. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      credentials: (d.credentials ?? []).map((c: { title: string; description: string }) => ({
        id: nextId("cred"),
        icon: "check",
        title: c.title,
        description: c.description,
      })),
      primaryCta: transformCta(d.primaryCta, "primary"),
    }),
  },

  "testimonials-examprep": {
    label: "Testimonials: IIT JEE / NEET",
    jsonSchema: obj({
      headline: s("Section headline (1-3 words, e.g. 'Success')"),
      headlineAccent: s("Accent text (1-2 words, e.g. 'Stories')"),
      description: s("Supporting description (1 sentence)"),
      testimonials: arr(
        obj({
          name: s("Full name"),
          role: s("Achievement (e.g. 'AIR 23, CSE 2023')"),
          quote: s("Testimonial quote (2-3 sentences)"),
          rating: { type: "number", minimum: 4, maximum: 5, description: "Rating (4 or 5)" },
        }),
        3, 6, "3-6 testimonials"
      ),
    }),
    instructions: "Generate success story testimonials for an IIT JEE / NEET coaching platform. Include realistic exam ranks and achievements.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      testimonials: (d.testimonials ?? []).map((t: { name: string; role: string; quote: string; rating: number }) => ({
        id: nextId("test"),
        name: t.name,
        role: t.role,
        quote: t.quote,
        rating: t.rating,
        initials: t.name.split(" ").map((n: string) => n[0]).join(""),
      })),
    }),
  },

  "faq-examprep": {
    label: "FAQ: IIT JEE / NEET",
    jsonSchema: obj({
      headline: s("Section headline (2-3 words, e.g. 'Frequently Asked')"),
      headlineAccent: s("Accent text (1-2 words, e.g. 'Questions')"),
      description: s("Supporting description (1 sentence)"),
      items: arr(
        obj({
          question: s("FAQ question"),
          answer: s("FAQ answer (2-4 sentences)"),
        }),
        4, 8, "4-8 FAQ items"
      ),
    }),
    instructions: "Generate FAQ items for an IIT JEE / NEET coaching platform. Cover topics like refund policy, mobile access, AI features, live class recordings, answer evaluation, and plan switching.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      items: (d.items ?? []).map((item: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: item.question,
        answer: item.answer,
      })),
    }),
  },

  "cta-examprep": {
    label: "CTA: IIT JEE / NEET",
    jsonSchema: obj({
      headline: s("Action-oriented CTA headline (5-10 words)"),
      description: s("Brief value reinforcement (1-2 sentences)"),
      primaryCta: ctaSchema("CTA button text (2-4 words)", "Best route for CTA"),
    }),
    instructions: `Generate a CTA section for an IIT JEE / NEET coaching platform. Action-oriented headline encouraging students to start their preparation journey. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
    }),
  },

  // Test Prep (All Govt Exams) Template Sections

  "hero-govtexam": {
    label: "Hero: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      badge: s("Short badge text (3-8 words, e.g. 'India\\'s #1 Government Exam Platform')"),
      headline: s("Main headline (3-6 words, e.g. 'Crack')"),
      headlineAccent: s("Accent/highlighted part (3-6 words, e.g. 'UPSC, SSC, Bank & All Govt Exams')"),
      description: s("Supporting description about the government exam coaching platform (2-3 sentences)"),
      primaryCta: ctaSchema("Primary CTA text (2-4 words)", "Best route for CTA"),
      stats: arr(
        obj({
          value: s("Stat value with suffix (e.g. '2M+', '4.8', '500+')"),
          label: s("Stat label (1-2 words, e.g. 'Aspirants', 'Rating', 'Courses')"),
        }),
        2, 4, "2-4 key stats"
      ),
    }),
    instructions: `Generate a hero section for a government exam coaching platform. Focus on UPSC, SSC, Banking, and Railway exams. Stats should showcase social proof. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
      stats: (d.stats ?? []).map((stat: { value: string; label: string }) => ({
        id: nextId("stat"),
        value: stat.value,
        label: stat.label,
      })),
    }),
  },

  "features-govtexam": {
    label: "Features: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      headline: s("Section headline (2-4 words)"),
      headlineAccent: s("Accent text (2-4 words)"),
      description: s("Brief section description (1-2 sentences)"),
      features: arr(
        obj({
          icon: s("Lucide icon name (e.g. 'video', 'file-text', 'mic', 'book-open', 'bar-chart', 'users')"),
          title: s("Feature title (2-4 words)"),
          description: s("Feature description (1-2 sentences)"),
        }),
        4, 6, "4-6 features"
      ),
    }),
    instructions: "Generate features for a government exam coaching platform. Include live classes, AI resume builder, AI mock interviews, study materials, progress analytics, and expert mentorship.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      features: (d.features ?? []).map((f: { icon: string; title: string; description: string }) => ({
        id: nextId("feat"),
        icon: f.icon,
        title: f.title,
        description: f.description,
      })),
    }),
  },

  "learning-paths-govtexam": {
    label: "Learning Paths: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      headline: s("Section headline (1-3 words)"),
      headlineAccent: s("Accent text (1-3 words)"),
      description: s("Brief description (1-2 sentences)"),
      waypoints: arr(
        obj({
          label: s("Waypoint label (1-2 words, e.g. 'Foundation', 'Practice')"),
          icon: s("Icon name: compass | book | repeat | sprout | trophy"),
          description: s("Short description (5-10 words)"),
        }),
        4, 6, "4-6 waypoints representing stages of the learning journey"
      ),
      goalLabel: s("Final destination label (1 word, e.g. 'Success')"),
    }),
    instructions: `Generate a visual roadmap section for a government exam coaching platform. This is design-centric, waypoints represent abstract stages of a learning journey (not specific courses). Keep labels short (1-2 words each). The goalLabel is the destination. Motivating, academic tone. Icons must be one of: compass, book, repeat, sprout, trophy. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      waypoints: (d.waypoints ?? []).map((wp: { label: string; icon: string; description: string }) => ({
        id: nextId("wp"),
        label: wp.label,
        icon: wp.icon,
        description: wp.description,
      })),
      goalLabel: d.goalLabel ?? "Success",
    }),
  },

  "about-govtexam": {
    label: "About: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      badge: s("Badge text (2-4 words)"),
      headline: s("Headline (2-4 words)"),
      headlineAccent: s("Accent text (2-4 words)"),
      description: s("About description (2-3 sentences)"),
      credentials: arr(
        obj({
          icon: s("Lucide icon name (e.g. 'check')"),
          title: s("Credential title (3-6 words)"),
          description: s("Credential description (1 sentence)"),
        }),
        2, 4, "2-4 credentials"
      ),
    }),
    instructions: `Generate an about/faculty section for a government exam coaching platform. Highlight expertise in UPSC, SSC, Banking, and Railway coaching. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      credentials: (d.credentials ?? []).map((c: { icon: string; title: string; description: string }) => ({
        id: nextId("cred"),
        icon: c.icon,
        title: c.title,
        description: c.description,
      })),
    }),
  },

  "testimonials-govtexam": {
    label: "Testimonials: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      headline: s("Section headline (1-2 words)"),
      headlineAccent: s("Accent text (1-2 words)"),
      description: s("Brief description (1 sentence)"),
      testimonials: arr(
        obj({
          name: s("Full name"),
          role: s("Achievement (e.g. 'AIR 89, CSE 2023', 'SSC CGL Selected')"),
          quote: s("Testimonial quote (2-3 sentences)"),
          rating: { type: "number", description: "Rating 1-5" },
          initials: s("2-letter initials"),
        }),
        3, 4, "3-4 testimonials"
      ),
    }),
    instructions: "Generate success story testimonials for a government exam coaching platform. Include realistic exam ranks and achievements for UPSC, SSC, Banking exams.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      testimonials: (d.testimonials ?? []).map((t: { name: string; role: string; quote: string; rating: number; initials: string }) => ({
        id: nextId("test"),
        name: t.name,
        role: t.role,
        quote: t.quote,
        rating: t.rating ?? 5,
        initials: t.initials ?? t.name.split(" ").map((n: string) => n[0]).join(""),
      })),
    }),
  },

  "faq-govtexam": {
    label: "FAQ: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      headline: s("Section headline (2-3 words)"),
      headlineAccent: s("Accent text (1-2 words)"),
      description: s("Brief description (1 sentence)"),
      faqs: arr(
        obj({
          question: s("FAQ question"),
          answer: s("Detailed answer (2-3 sentences)"),
        }),
        4, 8, "4-8 FAQ items"
      ),
    }),
    instructions: "Generate FAQ items for a government exam coaching platform. Cover topics like course packages, test series accuracy, mobile access, current affairs, refund policy, and AI mock interviews.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      faqs: (d.faqs ?? []).map((f: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: f.question,
        answer: f.answer,
      })),
    }),
  },

  "cta-govtexam": {
    label: "CTA: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      headline: s("Action-oriented headline (6-12 words)"),
      description: s("Supporting description (1-2 sentences)"),
      primaryCta: ctaSchema("CTA button text (2-4 words)", "Best route for CTA"),
    }),
    instructions: `Generate a CTA section for a government exam coaching platform. Action-oriented headline encouraging aspirants to start their preparation journey. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
    }),
  },

  "exam-categories-govtexam": {
    label: "Exam Categories: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      headline: s("Section headline (2-4 words)"),
      headlineAccent: s("Accent text (2-4 words)"),
      description: s("Brief section description (1 sentence)"),
      categories: arr(
        obj({
          icon: s("Lucide icon name (e.g. 'landmark', 'file-text', 'building', 'train-front')"),
          title: s("Exam name (2-4 words, e.g. 'UPSC CSE', 'SSC CGL')"),
          description: s("Brief exam description (5-10 words)"),
        }),
        3,
        6,
        "3-6 exam categories"
      ),
    }),
    instructions:
      "Generate exam category cards for a government exam coaching platform. Include major exams like UPSC, SSC, Banking, Railway, State PSC, etc.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      categories: (d.categories ?? []).map((c: { icon: string; title: string; description: string }) => ({
        id: nextId("cat"),
        icon: c.icon,
        title: c.title,
        description: c.description,
      })),
    }),
  },

  "trusted-by-govtexam": {
    label: "Trusted By: Test Prep (All Govt Exams)",
    jsonSchema: obj({
      label: s("Short label text (5-10 words, e.g. 'Trusted by aspirants from top institutions')"),
      items: arr(
        obj({
          icon: s("Lucide icon name (e.g. 'landmark', 'building', 'graduation-cap', 'newspaper')"),
          name: s("Short institution/brand name (1-3 words)"),
        }),
        6,
        10,
        "6-10 trusted institutions or brands"
      ),
    }),
    instructions:
      "Generate a list of trusted institutions and brands for a government exam coaching platform. Include well-known Indian universities, coaching institutes, newspapers, and organizations relevant to UPSC/SSC/Banking aspirants.",
    transform: (d) => ({
      label: d.label,
      items: (d.items ?? []).map((item: { icon: string; name: string }) => ({
        id: nextId("tb"),
        icon: item.icon,
        name: item.name,
      })),
    }),
  },

  // ────────────────────────────────────
  // Astrology Landing Page Sections
  // ────────────────────────────────────

  "hero-astrology": {
    label: "Hero: Astrology",
    jsonSchema: obj({
      headline: s("Mystical, inspiring headline for an astrology brand (3-6 words)"),
      headlineAccent: s("Accent part of headline in brand color (2-4 words)"),
      description: s("Compelling subtitle (1-2 sentences) about discovering cosmic wisdom"),
      stats: arr(
        obj({ value: s("Stat value with suffix (e.g. '10K+', '500+', '12')"), label: s("Stat label (1-2 words)") }),
        2, 4, "2-4 key stats"
      ),
    }),
    instructions: "Generate a mystical, inspiring hero section for an astrology education platform. The headline should feel cosmic and wise. Stats should showcase credibility (students, readings, courses). Do NOT generate CTA buttons.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      primaryCta: { text: "Begin Your Journey", href: "#live-courses-listing-astrology-2", variant: "primary" },
      secondaryCta: { text: "Explore Services", href: "#services-astrology", variant: "outline" },
      stats: (d.stats ?? []).map((stat: { value: string; label: string }) => ({
        id: nextId("stat"),
        value: stat.value,
        label: stat.label,
      })),
    }),
  },

  "about-astrology": {
    label: "About: Astrology",
    jsonSchema: obj({
      headline: s("First line of heading (2-4 words)"),
      headlineAccent: s("Accent part of heading (2-4 words)"),
      description: s("Primary bio paragraph (2-3 sentences) about the astrologer's expertise and approach"),
      secondaryDescription: s("Secondary paragraph (1-2 sentences) about the mission or philosophy"),
      credentials: arr(
        obj({ title: s("Credential title (2-4 words)"), description: s("Brief credential description (1 sentence)") }),
        2, 4, "2-4 credentials"
      ),
    }),
    instructions: "Generate content for an 'About the Astrologer' section. Focus on credibility, years of experience in Vedic/Western astrology, and the mission to help seekers. Credentials should highlight certifications, teaching experience, and specializations.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      secondaryDescription: d.secondaryDescription,
      credentials: (d.credentials ?? []).map((c: { title: string; description: string }, i: number) => ({
        id: nextId("cred"),
        icon: i % 2 === 0 ? "star" : "moon",
        title: c.title,
        description: c.description,
      })),
    }),
  },

  "services-astrology": {
    label: "Services: Astrology",
    jsonSchema: obj({
      headline: s("Section headline (2-4 words)"),
      description: s("Brief description of services offered (1-2 sentences)"),
      services: arr(
        obj({ title: s("Service name (2-4 words)"), description: s("Service description (1-2 sentences)") }),
        3, 6, "3-6 astrology services"
      ),
    }),
    instructions: "Generate astrology services like birth chart reading, transit forecast, compatibility analysis, career guidance, remedial astrology, etc. Each should feel professional and valuable.",
    transform: (d) => ({
      headline: d.headline,
      description: d.description,
      services: (d.services ?? []).map((svc: { title: string; description: string }, i: number) => ({
        id: nextId("svc"),
        icon: ["sun", "moon", "star", "compass"][i % 4],
        title: svc.title,
        description: svc.description,
      })),
    }),
  },

  "testimonials-astrology": {
    label: "Testimonials: Astrology",
    jsonSchema: obj({
      headline: s("Section headline (2-5 words)"),
      testimonials: arr(
        obj({
          quote: s("Student testimonial (2-3 sentences) about their astrology learning experience"),
          author: s("Student name (first name + last initial)"),
          role: s("Student role/description (e.g. 'Vedic Astrology Student')"),
        }),
        3, 5, "3-5 testimonials"
      ),
    }),
    instructions: "Generate realistic student testimonials for an astrology course platform. Focus on personal transformation, accuracy of readings, and quality of teaching.",
    transform: (d) => ({
      headline: d.headline,
      testimonials: (d.testimonials ?? []).map((t: { quote: string; author: string; role: string }) => ({
        id: nextId("test"),
        quote: t.quote,
        author: t.author,
        role: t.role,
        rating: 5,
      })),
    }),
  },

  "faq-astrology": {
    label: "FAQ: Astrology",
    jsonSchema: obj({
      headline: s("FAQ section headline (2-4 words)"),
      items: arr(
        obj({
          question: s("Frequently asked question about astrology courses or services"),
          answer: s("Helpful, informative answer (2-4 sentences)"),
        }),
        4, 8, "4-8 FAQ items"
      ),
    }),
    instructions: "Generate FAQs for an astrology education platform. Cover topics like: prior knowledge needed, Vedic vs Western astrology, accuracy of readings, course format, personal readings availability, certificates, etc.",
    transform: (d) => ({
      headline: d.headline,
      items: (d.items ?? []).map((item: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: item.question,
        answer: item.answer,
      })),
    }),
  },

  "cta-astrology": {
    label: "CTA: Astrology",
    jsonSchema: obj({
      headline: s("Bold CTA headline first line (2-4 words)"),
      headlineAccent: s("Bold CTA headline second line (2-4 words)"),
      description: s("Motivational subtitle (1-2 sentences)"),
      guaranteeText: s("Trust/guarantee text"),
    }),
    instructions: "Generate a mystical, motivational CTA section for an astrology platform. The headline should be cosmic and inspiring. Include a guarantee or trust text. Do NOT generate CTA buttons.",
    transform: (d) => ({
      headline: d.headline,
      headlineAccent: d.headlineAccent,
      description: d.description,
      primaryCta: { text: "Start Learning", href: "#live-courses-listing-astrology-2", variant: "primary" },
      secondaryCta: { text: "Book a Reading", href: "#books-listing-astrology", variant: "outline" },
      guaranteeText: d.guaranteeText,
    }),
  },

  // ── Corporate Upskilling Template ──

  "hero-corpupskill": {
    label: "Hero Slider: Corporate Upskilling",
    jsonSchema: obj({
      slides: arr(
        obj({
          badge: s("Short badge text (2-4 words, e.g. 'Continuous Learning')"),
          headlineLine1: s("First line of headline (2-4 words)"),
          headlineAccent: s("Gradient accent line (1-3 words)"),
          headlineLine3: s("Third line of headline (1-3 words)"),
          subtitle: s("Short subtitle (3-6 words)"),
          description: s("Supporting description (1-2 sentences)"),
          cornerBadge: s("Corner badge text (1-3 words, uppercase)"),
        }),
        2,
        4,
        "2-4 hero slides"
      ),
      primaryCta: ctaSchema("CTA button text (2-4 words)", "Best route for exploring courses"),
    }),
    instructions: `Generate hero slider content for a corporate upskilling / employee training platform. Each slide should focus on a different aspect: workforce development, skill building, career growth, staying current. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      slides: (d.slides ?? []).map((slide: { badge: string; headlineLine1: string; headlineAccent: string; headlineLine3: string; subtitle: string; description: string; cornerBadge: string }) => ({
        id: nextId("slide"),
        image: "",
        badge: slide.badge,
        headlineLine1: slide.headlineLine1,
        headlineAccent: slide.headlineAccent,
        headlineLine3: slide.headlineLine3,
        subtitle: slide.subtitle,
        description: slide.description,
        cornerBadge: slide.cornerBadge,
      })),
      primaryCta: transformCta(d.primaryCta, "primary"),
    }),
  },

  "trusted-by-corpupskill": {
    label: "Trusted By: Corporate Upskilling",
    jsonSchema: obj({
      label: s("Short label (5-10 words, e.g. 'Employees from Top Companies Learning Here')"),
      items: arr(
        obj({
          icon: s(
            "Brand key: 'brand-microsoft', 'brand-aws', 'brand-google', 'brand-slack', or 'brand-salesforce' (or match company name)"
          ),
          name: s("Company or brand name (1-2 words)"),
        }),
        5,
        5,
        "Exactly 5 companies with matching brand-* icon keys"
      ),
    }),
    instructions:
      "Generate exactly 5 well-known tech companies. Use icon keys brand-microsoft, brand-aws, brand-google, brand-slack, brand-salesforce matching each company.",
    transform: (d) => ({
      label: d.label,
      items: (d.items ?? []).map((item: { icon: string; name: string }) => {
        const n = (item.name || "").toLowerCase();
        let icon = item.icon;
        if (!icon?.startsWith("brand-")) {
          if (n.includes("microsoft")) icon = "brand-microsoft";
          else if (n.includes("aws") || n.includes("amazon web")) icon = "brand-aws";
          else if (n.includes("google")) icon = "brand-google";
          else if (n.includes("slack")) icon = "brand-slack";
          else if (n.includes("salesforce")) icon = "brand-salesforce";
          else icon = "brand-microsoft";
        }
        return { id: nextId("tb"), icon, name: item.name };
      }),
    }),
  },

  "features-split-corpupskill": {
    label: "Features Split: Corporate Upskilling",
    jsonSchema: obj({
      columns: arr(
        obj({
          icon: s("Lucide icon name for the column (e.g. 'trending-up', 'graduation-cap')"),
          headline: s("Column headline (3-5 words)"),
          description: s("Column description (1-2 sentences)"),
          checkItems: arr(
            obj({
              title: s("Check item title (2-5 words)"),
              description: s("Check item description (5-12 words)"),
            }),
            3,
            4,
            "3-4 check items per column"
          ),
          linkText: s("Link text (2-4 words)"),
        }),
        2,
        2,
        "Exactly 2 columns"
      ),
    }),
    instructions:
      "Generate content for a two-column features section for a corporate training platform. Column 1 should focus on career advancement. Column 2 should focus on skill development.",
    transform: (d) => ({
      columns: (d.columns ?? []).map((col: { icon: string; headline: string; description: string; checkItems: Array<{ title: string; description: string }>; linkText: string }) => ({
        icon: col.icon,
        headline: col.headline,
        description: col.description,
        checkItems: (col.checkItems ?? []).map((item: { title: string; description: string }) => ({
          id: nextId("ci"),
          title: item.title,
          description: item.description,
        })),
        linkText: col.linkText,
        linkHref: "/all-courses",
      })),
    }),
  },

  "analytics-corpupskill": {
    label: "Analytics: Corporate Upskilling",
    jsonSchema: obj({
      badge: s("Short badge text (2-3 words)"),
      headline: s("Section headline (4-7 words)"),
      description: s("Supporting description (1-2 sentences)"),
      chartCardSubtitle: s("Subtitle under chart card title (e.g. 'Current Progress - Q4 2024')"),
      chartBars: arr(
        obj({
          label: s("Bar label (skill area name)"),
          value: { type: "number" as const, description: "Progress percentage 0-100" },
        }),
        5,
        5,
        "Exactly 5 vertical bars for the skills chart"
      ),
      highlights: arr(
        obj({
          icon: s("Lucide icon name (e.g. 'trophy', 'target', 'medal')"),
          title: s("Highlight title (2-4 words)"),
          description: s("Highlight description (8-15 words)"),
        }),
        2,
        3,
        "2-3 highlights"
      ),
    }),
    instructions:
      "Generate analytics / progress tracking section content for a corporate training platform. chartBars must be 5 items with distinct skill labels and values 0-100. Highlights should reinforce the value of tracking progress (badges, benchmarking, goals). Do not include a separate stats grid.",
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      description: d.description,
      chartCardSubtitle: d.chartCardSubtitle,
      chartBars: (d.chartBars ?? []).map((b: { label: string; value: number }) => ({
        id: nextId("cb"),
        label: b.label,
        value: Math.min(100, Math.max(0, Number(b.value) || 0)),
      })),
      highlights: (d.highlights ?? []).map((hl: { icon: string; title: string; description: string }) => ({
        id: nextId("hl"),
        icon: hl.icon,
        title: hl.title,
        description: hl.description,
      })),
    }),
  },

  "testimonials-corpupskill": {
    label: "Testimonials: Corporate Upskilling",
    jsonSchema: obj({
      badge: s("Short badge text (2-3 words, e.g. 'Success Stories')"),
      headline: s("Section headline (2-4 words)"),
      description: s("One short sentence subheading under the headline (optional tone: warm, professional)"),
      testimonials: arr(
        obj({
          name: s("Full name"),
          role: s("Career transition (e.g. 'Software Engineer to Team Lead')"),
          quote: s("Testimonial quote (2-3 sentences about career growth)"),
          metricValue: s("Key metric value (e.g. '6mo', '35%', '2')"),
          metricLabel: s("Metric label (2-3 words, e.g. 'To Promotion', 'Salary Increase')"),
          rating: { type: "number" as const, description: "1-5 star rating, typically 5" },
          initials: s("2-letter initials"),
        }),
        3,
        5,
        "3-5 testimonials"
      ),
    }),
    instructions:
      "Generate employee success story testimonials for a corporate training platform. Each testimonial should include a measurable career outcome (promotion timeline, salary increase, level advancement). Use rating 4 or 5 for credible social proof.",
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      description: d.description,
      testimonials: (d.testimonials ?? []).map(
        (t: {
          name: string;
          role: string;
          quote: string;
          metricValue: string;
          metricLabel: string;
          rating?: number;
          initials: string;
        }) => ({
          id: nextId("test"),
          name: t.name,
          role: t.role,
          quote: t.quote,
          metricValue: t.metricValue,
          metricLabel: t.metricLabel,
          rating: Math.min(5, Math.max(1, Math.round(Number(t.rating) || 5))),
          initials: t.initials,
        })
      ),
    }),
  },

  "cta-corpupskill": {
    label: "CTA: Corporate Upskilling",
    jsonSchema: obj({
      headline: s("Bold CTA headline (3-6 words)"),
      description: s("Supporting text (1-2 sentences)"),
      primaryCta: ctaSchema("CTA button text (2-4 words)", "Best route for CTA"),
      trustBadges: arr(
        obj({
          icon: s("Lucide icon name (e.g. 'award', 'clock', 'rocket')"),
          text: s("Badge text (2-3 words)"),
        }),
        2,
        4,
        "2-4 trust badges"
      ),
    }),
    instructions: `Generate a call-to-action section for a corporate training platform. Focus on starting the learning journey and career advancement. Include trust badges for credibility. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      description: d.description,
      primaryCta: transformCta(d.primaryCta, "primary"),
      trustBadges: (d.trustBadges ?? []).map((b: { icon: string; text: string }) => ({
        id: nextId("tb"),
        icon: b.icon,
        text: b.text,
      })),
    }),
  },

  "solutions-grid-corpupskill": {
    label: "Solutions Grid: Corporate Upskilling",
    jsonSchema: obj({
      badge: s("Short badge text (2-3 words, e.g. 'Learning Library')"),
      headline: s("Section headline (5-10 words)"),
      description: s("Supporting description (1-2 sentences)"),
      cards: arr(
        obj({
          badge: s("Category badge (1-2 words, e.g. 'Leadership', 'Technical')"),
          title: s("Program title (2-5 words)"),
          description: s("Brief description (5-10 words, optional)"),
          rating: s("Rating value (e.g. '4.9')"),
          duration: s("Duration (e.g. '12 Hours', optional)"),
        }),
        4,
        6,
        "4-6 program cards"
      ),
    }),
    instructions:
      "Generate content for a masonry grid of corporate training programs. Include a mix of categories: Leadership, Technical, Compliance, Soft Skills, Innovation. Each card represents a course category or featured program.",
    transform: (d) => ({
      badge: d.badge,
      headline: d.headline,
      description: d.description,
      cards: (d.cards ?? []).map((c: { badge: string; title: string; description?: string; rating: string; duration?: string }) => ({
        id: nextId("card"),
        image: "",
        badge: c.badge,
        title: c.title,
        description: c.description,
        rating: c.rating,
        duration: c.duration,
      })),
    }),
  },

  // ─── Subscription Page Sections ─────────────────────────────────────────────

  "subscription-hero": {
    label: "Subscription Hero",
    jsonSchema: obj({
      headline: s("Bold, compelling subscription headline (5-10 words, e.g. 'Invest in Yourself.')"),
      subheadline: s("Supporting value proposition for subscribing (1-2 sentences)"),
      primaryCta: ctaSchema("Primary CTA text (2-4 words, e.g. 'Get Started')", "Route for the primary CTA, typically '/subscribe' or '/pricing'."),
      trustBadges: arr(obj({ label: s("Trust badge text (2-3 words, e.g. 'Secure payment', 'Cancel anytime')") }), 3, 5, "3-5 trust badges"),
      stats: arr(obj({ value: s("Stat value (e.g. '50+', '1000+')"), label: s("Stat label (1-2 words, e.g. 'Courses', 'Students')") }), 3, 4, "3-4 stats"),
    }),
    instructions: `Generate a subscription hero section. Focus on the value of subscribing, unlimited access, convenience, savings. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      primaryCta: transformCta(d.primaryCta, "primary"),
      trustBadges: (d.trustBadges ?? []).map((b: { label: string }) => ({ id: nextId("badge"), label: b.label })),
      stats: (d.stats ?? []).map((s: { value: string; label: string }) => ({ id: nextId("stat"), value: s.value, label: s.label })),
    }),
  },

  "subscription-features": {
    label: "Subscription Features",
    jsonSchema: obj({
      headline: s("Features section headline (3-8 words)"),
      subheadline: s("Brief description of what subscribers get (1-2 sentences)"),
      categories: arr(
        obj({
          label: s("Category name (2-4 words, e.g. 'Learning Tools', 'Premium Content')"),
          subtitle: s("Category description (1 sentence)"),
          items: arr(obj({ title: s("Feature title (2-5 words)"), description: s("Feature description (1 sentence)") }), 3, 5, "3-5 features"),
        }),
        2, 4, "2-4 feature categories"
      ),
    }),
    instructions: "Generate subscription features grouped by category. Focus on learning, content access, tools, and support benefits.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      categories: (d.categories ?? []).map((c: { label: string; subtitle?: string; items: { title: string; description?: string }[] }) => ({
        id: nextId("cat"),
        label: c.label,
        subtitle: c.subtitle,
        items: (c.items ?? []).map((item: { title: string; description?: string }) => ({
          id: nextId("feat"),
          title: item.title,
          description: item.description,
        })),
      })),
    }),
  },

  "subscription-comparison": {
    label: "Subscription Comparison",
    jsonSchema: obj({
      headline: s("Comparison section headline (3-8 words, e.g. 'Free vs Premium')"),
      subheadline: s("Brief explanation of the comparison (1 sentence)"),
      freeColumnLabel: s("Free tier label (1-2 words, e.g. 'Free')"),
      paidColumnLabel: s("Paid tier label (1-2 words, e.g. 'Premium')"),
      rows: arr(
        obj({
          feature: s("Feature name (2-5 words)"),
          freeValue: s("Free tier value, use 'true'/'false' for check/cross, or a text string like 'Limited'"),
          paidValue: s("Paid tier value, use 'true'/'false' for check/cross, or a text string like 'Unlimited'"),
        }),
        5, 10, "5-10 comparison rows"
      ),
    }),
    instructions: "Generate a free vs premium comparison table. Mix boolean (check/cross) and text values. Show clear advantages of the paid tier.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      freeColumnLabel: d.freeColumnLabel,
      paidColumnLabel: d.paidColumnLabel,
      rows: (d.rows ?? []).map((r: { feature: string; freeValue: string; paidValue: string }) => ({
        id: nextId("row"),
        feature: r.feature,
        freeValue: r.freeValue === "true" ? true : r.freeValue === "false" ? false : r.freeValue,
        paidValue: r.paidValue === "true" ? true : r.paidValue === "false" ? false : r.paidValue,
      })),
    }),
  },

  "subscription-faq": {
    label: "Subscription FAQ",
    jsonSchema: obj({
      headline: s("FAQ section headline (3-6 words)"),
      subheadline: s("Brief intro to the FAQ (1 sentence)"),
      items: arr(
        obj({
          question: s("FAQ question about subscription (1 sentence)"),
          answer: s("Clear, helpful answer (2-3 sentences)"),
        }),
        4, 8, "4-8 FAQ items"
      ),
    }),
    instructions: "Generate FAQ items about subscription plans, billing, cancellation, access, and content. Be clear and reassuring.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      items: (d.items ?? []).map((item: { question: string; answer: string }) => ({
        id: nextId("faq"),
        question: item.question,
        answer: item.answer,
      })),
    }),
  },

  "subscription-cta": {
    label: "Subscription CTA",
    jsonSchema: obj(
      {
        headline: s("Action-oriented CTA headline (5-10 words)"),
        subheadline: s("Brief value reinforcement for subscribing (1-2 sentences)"),
        primaryCta: ctaSchema("CTA button text (2-4 words, e.g. 'Subscribe Now')", "Route for the CTA, typically '/subscribe'."),
      },
      ["headline", "primaryCta"]
    ),
    instructions: `Generate a subscription CTA section. Urgency + value. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      primaryCta: transformCta(d.primaryCta, "primary"),
    }),
  },

  // ── Niche landing templates (cooking/fitness/music/business/arts/kids/finance/language/skills) ──
  "hero-cooking": nicheHeroConfig("Hero: Cooking"),
  "hero-cooking-alt": nicheHeroConfig("Hero: Cooking (Alt)"),
  "hero-fitness": nicheHeroConfig("Hero: Fitness"),
  "hero-fitness-alt": nicheHeroConfig("Hero: Fitness (Alt)"),
  "hero-music": nicheHeroConfig("Hero: Music"),
  "hero-music-alt": nicheHeroConfig("Hero: Music (Alt)"),
  "hero-business": nicheHeroConfig("Hero: Business"),
  "hero-business-alt": nicheHeroConfig("Hero: Business (Alt)"),
  "hero-arts": nicheHeroConfig("Hero: Arts"),
  "hero-arts-alt": nicheHeroConfig("Hero: Arts (Alt)"),
  "hero-arts-v3": nicheHeroConfig("Hero: Arts (Studio)"),
  "hero-kids": nicheHeroConfig("Hero: Kids"),
  "hero-kids-alt": nicheHeroConfig("Hero: Kids (Alt)"),
  "hero-kids-v3": nicheHeroConfig("Hero: Kids (Confetti)"),
  "hero-finance": nicheHeroConfig("Hero: Finance"),
  "hero-finance-alt": nicheHeroConfig("Hero: Finance (Alt)"),
  "hero-finance-v3": nicheHeroConfig("Hero: Finance (Wealth)"),
  "hero-design": nicheHeroConfig("Hero: Design & UX"),
  "hero-data-ai": nicheHeroConfig("Hero: Data Science & AI"),
  "hero-medical": nicheHeroConfig("Hero: Medical & Nursing"),
  "hero-beauty": nicheHeroConfig("Hero: Beauty & Makeup"),
  "hero-study-abroad": nicheHeroConfig("Hero: Study Abroad"),
  "hero-marketing": nicheHeroConfig("Hero: Digital Marketing"),
  "hero-cyber": nicheHeroConfig("Hero: Cybersecurity"),
  "hero-realestate": nicheHeroConfig("Hero: Real Estate"),
  "hero-cloud": nicheHeroConfig("Hero: Cloud & DevOps"),
  "hero-accounting": nicheHeroConfig("Hero: Accounting & CA"),
  "hero-law": nicheHeroConfig("Hero: Law & CLAT"),
  "hero-film": nicheHeroConfig("Hero: Film & Content"),
  "hero-startup": nicheHeroConfig("Hero: Entrepreneurship"),
  "hero-fashion": nicheHeroConfig("Hero: Fashion Design"),
  "hero-interior": nicheHeroConfig("Hero: Interior Design"),
  "hero-yoga": nicheHeroConfig("Hero: Yoga & Meditation"),
  "hero-dance": nicheHeroConfig("Hero: Dance"),
  "hero-codekids": nicheHeroConfig("Hero: Coding for Kids"),
  "hero-speaking": nicheHeroConfig("Hero: Public Speaking"),
  "hero-hospitality": nicheHeroConfig("Hero: Hospitality"),
  "hero-spiritual": nicheHeroConfig("Hero: Spirituality"),
  "feature-bento": nicheFeaturesConfig("Features: Bento Grid"),
  "stats-band": {
    label: "Stats & Logos Band",
    jsonSchema: obj({
      headline: s("Short band headline (3-6 words)"),
      subheadline: s("One supporting sentence"),
      stats: arr(
        obj({
          value: s("Stat value with suffix, e.g. '25K+', '4.9', '95%'"),
          label: s("Stat label (1-2 words)"),
        }),
        3,
        4,
        "3-4 impressive stats"
      ),
    }),
    instructions: "Generate credibility stats for this academy. Do NOT generate logos.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      stats: (d.stats ?? []).map((st: { value: string; label: string }) => ({
        id: nextId("stat"),
        value: st.value,
        label: st.label,
      })),
    }),
  },
  "hero-language": nicheHeroConfig("Hero: Language"),
  "hero-language-alt": nicheHeroConfig("Hero: Language (Alt)"),
  "hero-skills": nicheHeroConfig("Hero: Skills"),
  "hero-quant": nicheHeroConfig("Hero: Quant Finance"),
  "hero-quant-institute": {
    label: "Hero: Quant Institute (Light)",
    jsonSchema: obj(
      {
        eyebrow: s("Short italic eyebrow line above the headline (4-7 words, e.g. 'Learn. Build. Quantify Your Future.')"),
        headline: s("Headline line 1, a single strong opening word or two (e.g. 'Master')"),
        headlineAccent: s("Headline line 2, the accent phrase rendered in the brand color (2-3 words, e.g. 'Quantitative Finance.')"),
        headlineSuffix: s("Headline line 3, a short closing phrase (3-5 words, e.g. 'Think like a Quant.')"),
        description: s(
          "Supporting copy (2-3 sentences over 3 lines; use \\n between lines). Wrap the 2-3 most important phrases in **double asterisks** so they render bold."
        ),
        primaryCta: ctaSchema(
          "Primary CTA text (2-4 words, e.g. 'Explore Programs')",
          "Best route for the primary action, usually '/all-courses'."
        ),
        secondaryCta: ctaSchema(
          "Secondary CTA text (2-4 words, e.g. 'Book a Free Call')",
          "Best route for the secondary action, e.g. '/contact'."
        ),
        stats: arr(
          obj({
            value: s("Stat value with suffix (e.g. '15+', '2000+', '90%+')"),
            label: s("Stat label (2-4 words; use \\n to split across 2 lines, e.g. 'Students\\nTrained')"),
          }),
          3,
          3,
          "Exactly 3 credibility stats"
        ),
        trust: s("Short trusted-by lead-in (e.g. 'Trusted by students from')"),
      },
      ["eyebrow", "headline", "headlineAccent", "headlineSuffix", "description"]
    ),
    instructions: `Generate a light editorial hero for this academy. Do NOT describe or generate images, and do NOT generate institution logos. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => {
      const out: Record<string, unknown> = {
        eyebrow: d.eyebrow,
        headline: d.headline,
        headlineAccent: d.headlineAccent,
        headlineSuffix: d.headlineSuffix,
        description: d.description,
        trust: d.trust,
        stats: (d.stats ?? []).map((st: { value: string; label: string }) => ({
          id: nextId("stat"),
          value: st.value,
          label: st.label,
        })),
      };
      // Only override the seeded CTAs when the AI actually produced button text,
      // otherwise the merge would blank them out. `institutions` and `image` are
      // deliberately omitted so the seeded wordmarks + photo survive the merge.
      if (d.primaryCta?.text) out.primaryCta = transformCta(d.primaryCta, "primary", "/all-courses");
      if (d.secondaryCta?.text) out.secondaryCta = transformCta(d.secondaryCta, "outline");
      return out;
    },
  },

  "features-cooking": nicheFeaturesConfig("Features: Cooking"),
  "features-fitness": nicheFeaturesConfig("Features: Fitness"),
  "features-music": nicheFeaturesConfig("Features: Music"),
  "features-business": nicheFeaturesConfig("Features: Business"),
  "features-arts": nicheFeaturesConfig("Features: Arts"),
  "features-kids": nicheFeaturesConfig("Features: Kids"),
  "features-finance": nicheFeaturesConfig("Features: Finance"),
  "features-language": nicheFeaturesConfig("Features: Language"),
  "features-skills": nicheFeaturesConfig("Features: Skills"),

  "testimonials-cooking": nicheTestimonialsConfig("Testimonials: Cooking"),
  "testimonials-fitness": nicheTestimonialsConfig("Testimonials: Fitness"),
  "testimonials-music": nicheTestimonialsConfig("Testimonials: Music"),
  "testimonials-business": nicheTestimonialsConfig("Testimonials: Business"),
  "testimonials-arts": nicheTestimonialsConfig("Testimonials: Arts"),
  "testimonials-kids": nicheTestimonialsConfig("Testimonials: Kids"),
  "testimonials-finance": nicheTestimonialsConfig("Testimonials: Finance"),
  "testimonials-language": nicheTestimonialsConfig("Testimonials: Language"),
  "testimonials-skills": nicheTestimonialsConfig("Testimonials: Skills"),

  "cta-cooking": nicheCtaConfig("CTA: Cooking"),
  "cta-fitness": nicheCtaConfig("CTA: Fitness"),
  "cta-music": nicheCtaConfig("CTA: Music"),
  "cta-business": nicheCtaConfig("CTA: Business"),
  "cta-arts": nicheCtaConfig("CTA: Arts"),
  "cta-kids": nicheCtaConfig("CTA: Kids"),
  "cta-finance": nicheCtaConfig("CTA: Finance"),
  "cta-language": nicheCtaConfig("CTA: Language"),
  "cta-skills": nicheCtaConfig("CTA: Skills"),

  // Signature sections keep their curated items/images; AI only rewrites the heading copy.
  "recipes-cooking": sectionHeadingConfig("Recipes: Cooking", "signature recipes showcase"),
  "programs-fitness": sectionHeadingConfig("Programs: Fitness", "training programs"),
  "genres-music": sectionHeadingConfig("Genres: Music", "music genres"),
  "outcomes-business": sectionHeadingConfig("Outcomes: Business", "business outcomes and metrics"),
  "gallery-arts": sectionHeadingConfig("Gallery: Arts", "student work showcase"),
  "path-kids": sectionHeadingConfig("Path: Kids", "learning journey steps"),
  "markets-finance": sectionHeadingConfig("Markets: Finance", "live markets board"),
  "phrases-language": sectionHeadingConfig("Phrases: Language", "everyday phrases"),
  "tracks-skills": sectionHeadingConfig("Tracks: Skills", "career skill tracks"),
};

// ─── Shared config factories ──────────────────────────────────────────────────

function featuresConfig(label: string): SectionAIConfig {
  return {
    label,
    jsonSchema: obj({
      headline: s("Section headline (3-8 words)"),
      subheadline: s(
        "Section subheadline explaining what makes the features special (1-2 sentences)"
      ),
      features: arr(
        obj({
          icon: s(
            "lucide-react icon name in kebab-case, e.g. 'zap', 'shield', 'rocket', 'book-open', 'users', 'bar-chart', 'globe', 'lock'"
          ),
          title: s("Feature title (2-5 words)"),
          description: s("Feature description (1-2 sentences)"),
        }),
        3,
        6,
        "3-6 key features"
      ),
    }),
    instructions:
      "Generate features with concrete, specific language. Icons: lucide-react names in kebab-case (e.g. 'zap', 'shield', 'book-open').",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      features: (d.features ?? []).map(
        (f: { icon: string; title: string; description: string }) => ({
          id: nextId("feat"),
          icon: f.icon,
          title: f.title,
          description: f.description,
        })
      ),
    }),
  };
}

function testimonialsConfig(label: string): SectionAIConfig {
  return {
    label,
    jsonSchema: obj({
      headline: s("Section headline, e.g. 'What Our Students Say'"),
      subheadline: s("Subheadline (1 sentence)"),
      testimonials: arr(
        obj({
          quote: s("Testimonial quote (2-3 sentences)"),
          author: s("Person's full name"),
          role: s("Job title or role"),
          company: s("Company or context (e.g. 'Google', 'Career changer')"),
          rating: { type: "number", minimum: 4, maximum: 5, description: "Rating (4 or 5)" },
        }),
        3,
        6,
        "3-6 testimonials"
      ),
    }),
    instructions:
      "Generate customer testimonials. Include full names, titles, companies. Ratings 4-5 stars.",
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      testimonials: (d.testimonials ?? []).map(
        (
          t: { quote: string; author: string; role: string; company: string; rating: number },
          _i: number
        ) => ({
          id: nextId("test"),
          quote: t.quote,
          author: t.author,
          role: t.role,
          company: t.company,
          rating: t.rating,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(t.author)}`,
        })
      ),
    }),
  };
}

function ctaConfig(label: string): SectionAIConfig {
  return {
    label,
    jsonSchema: obj(
      {
        headline: s("Action-oriented CTA headline (5-10 words)"),
        subheadline: s("Brief value reinforcement (1-2 sentences)"),
        primaryCta: ctaSchema(
          "Primary CTA button text (2-4 words, e.g. 'Get Started Today')",
          "Best route for the primary CTA. Typically '/login', '/all-courses', or '/pricing'."
        ),
        secondaryCta: ctaSchema(
          "Secondary CTA button text (2-4 words, optional, e.g. 'Contact Us')",
          "Best route for the secondary CTA. Typically '/contact', '/about', or '/faq'."
        ),
      },
      ["headline", "subheadline", "primaryCta"]
    ),
    instructions: `Generate a CTA section. Action-oriented headline, brief value reinforcement, strong primary CTA. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      headline: d.headline,
      subheadline: d.subheadline,
      primaryCta: transformCta(d.primaryCta, "primary"),
      secondaryCta: d.secondaryCta?.text ? transformCta(d.secondaryCta, "secondary") : undefined,
    }),
  };
}

// ─── Niche template section factories ───────────────────────────────────────
// These map AI output onto the bespoke niche content shapes. Images are never
// generated here: hero images and the curated item images come from the seeded
// default content and are preserved by the shallow content merge on apply.
// NICHE_ICON_HINT is declared above SECTION_AI_CONFIGS (these factories run
// during that literal's initialization, so the const must exist beforehand).

/** Hero (HeroPhotographyContent), reused for every bespoke hero + alt variant. */
function nicheHeroConfig(label: string): SectionAIConfig {
  return {
    label,
    jsonSchema: obj(
      {
        eyebrow: s("Short eyebrow / tag label shown above the headline (2-4 words)"),
        headline: s("Bold, benefit-led hero headline (3-7 words; use \\n to split across 2 lines)"),
        description: s("Supporting subtitle (1-2 sentences)"),
        primaryCta: ctaSchema(
          "Primary CTA text (2-4 words, e.g. 'Start Learning')",
          "Best route for the primary action, usually '/all-courses'."
        ),
        secondaryCta: ctaSchema(
          "Secondary CTA text (2-4 words, e.g. 'Explore')",
          "Best route for the secondary action, e.g. '/about' or '/pricing'."
        ),
        stats: arr(
          obj({
            value: s("Stat value with suffix (e.g. '10K+', '4.9', '120+')"),
            label: s("Stat label (1-2 words, e.g. 'Members', 'Rating')"),
          }),
          2,
          3,
          "2-3 credibility stats"
        ),
      },
      ["eyebrow", "headline", "description"]
    ),
    instructions: `Generate a hero for this niche academy. Do NOT describe or generate images. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => {
      const out: Record<string, unknown> = {
        eyebrow: d.eyebrow,
        headline: d.headline,
        description: d.description,
        stats: (d.stats ?? []).map((st: { value: string; label: string }) => ({
          id: nextId("stat"),
          value: st.value,
          label: st.label,
        })),
      };
      // Only override the seeded CTAs when the AI actually produced button text,
      // otherwise the merge would blank them out.
      if (d.primaryCta?.text) out.primaryCta = transformCta(d.primaryCta, "primary", "/all-courses");
      if (d.secondaryCta?.text) out.secondaryCta = transformCta(d.secondaryCta, "outline");
      return out;
    },
  };
}

/** NicheFeaturesContent, reused for every per-niche features section. */
function nicheFeaturesConfig(label: string): SectionAIConfig {
  return {
    label,
    jsonSchema: obj({
      eyebrow: s("Short eyebrow / tag label (2-4 words)"),
      headline: s("Section headline (3-8 words)"),
      subheadline: s("Subheadline (1-2 sentences)"),
      items: arr(
        obj({
          icon: s(NICHE_ICON_HINT),
          title: s("Feature title (2-5 words)"),
          description: s("Feature description (1-2 sentences)"),
        }),
        3,
        6,
        "3-6 niche-specific features"
      ),
    }),
    instructions: "Generate niche-specific features with concrete language. Icons in kebab-case.",
    transform: (d) => ({
      eyebrow: d.eyebrow,
      headline: d.headline,
      subheadline: d.subheadline,
      items: (d.items ?? []).map((f: { icon: string; title: string; description: string }) => ({
        id: nextId("feat"),
        icon: f.icon,
        title: f.title,
        description: f.description,
      })),
    }),
  };
}

/** NicheTestimonialsContent, reused for every per-niche testimonials section. */
function nicheTestimonialsConfig(label: string): SectionAIConfig {
  return {
    label,
    jsonSchema: obj({
      eyebrow: s("Short eyebrow / tag label (2-4 words)"),
      headline: s("Section headline (e.g. 'Loved by Learners')"),
      subheadline: s("Subheadline (1 sentence)"),
      items: arr(
        obj({
          quote: s("Testimonial quote (2-3 sentences)"),
          name: s("Person's full name"),
          role: s("Role or context (e.g. 'Home Baker', 'Career Changer')"),
          rating: { type: "number", minimum: 4, maximum: 5, description: "Rating (4 or 5)" },
        }),
        3,
        6,
        "3-6 testimonials"
      ),
    }),
    instructions: "Generate realistic niche testimonials with full names and roles. Ratings 4-5.",
    transform: (d) => ({
      eyebrow: d.eyebrow,
      headline: d.headline,
      subheadline: d.subheadline,
      items: (d.items ?? []).map(
        (t: { quote: string; name: string; role: string; rating: number }) => ({
          id: nextId("test"),
          name: t.name,
          role: t.role,
          quote: t.quote,
          rating: t.rating,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(t.name)}`,
        })
      ),
    }),
  };
}

/** NicheCtaContent, reused for every per-niche CTA section. */
function nicheCtaConfig(label: string): SectionAIConfig {
  return {
    label,
    jsonSchema: obj(
      {
        eyebrow: s("Short eyebrow / tag label (2-4 words)"),
        headline: s("Action-oriented CTA headline (5-10 words)"),
        subheadline: s("Brief value reinforcement (1-2 sentences)"),
        primaryCta: ctaSchema(
          "Primary CTA text (2-4 words)",
          "Best route for the primary action, usually '/all-courses'."
        ),
        secondaryCta: ctaSchema(
          "Secondary CTA text (2-4 words)",
          "Best route for the secondary action, e.g. '/about'."
        ),
      },
      ["eyebrow", "headline", "subheadline", "primaryCta"]
    ),
    instructions: `Generate a CTA section for this niche. ${BUTTON_ROUTE_INSTRUCTIONS}`,
    transform: (d) => ({
      eyebrow: d.eyebrow,
      headline: d.headline,
      subheadline: d.subheadline,
      primaryCta: {
        text: d.primaryCta?.text ?? "Get Started",
        href: d.primaryCta?.route ?? "/all-courses",
      },
      secondaryCta: d.secondaryCta?.text
        ? { text: d.secondaryCta.text, href: d.secondaryCta.route ?? "#" }
        : undefined,
    }),
  };
}

/** Heading-only config for signature sections, rewrites eyebrow/headline/subheadline,
 * keeps the curated items and their images via the shallow content merge. */
function sectionHeadingConfig(label: string, context: string): SectionAIConfig {
  return {
    label,
    jsonSchema: obj({
      eyebrow: s("Short eyebrow / tag label shown above the headline (2-4 words)"),
      headline: s("Section headline (3-8 words)"),
      subheadline: s("Subheadline (1-2 sentences)"),
    }),
    instructions: `Rewrite the heading and subheading for a ${context} section to match this academy. Keep it concise; do not generate list items or images.`,
    transform: (d) => ({
      eyebrow: d.eyebrow,
      headline: d.headline,
      subheadline: d.subheadline,
    }),
  };
}
