import { z } from "zod";

// Base schemas
export const ctaButtonSchema = z.object({
  text: z.string().min(1, "Button text is required"),
  href: z.string().min(1, "Button link is required"),
  variant: z.enum(["primary", "secondary", "outline", "ghost"]),
});

export const navItemSchema: z.ZodType<{
  id: string;
  label: string;
  href: string;
  children?: { id: string; label: string; href: string }[];
}> = z.object({
  id: z.string(),
  label: z.string().min(1),
  href: z.string(),
  children: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1),
        href: z.string(),
      })
    )
    .optional(),
});

export const textStyleSchema = z.object({
  color: z.string().optional(),
  colorDark: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
});

export const sectionSettingsSchema = z.object({
  backgroundColor: z.string().optional(),
  backgroundColorDark: z.string().optional(),
  backgroundImage: z.string().optional(),
  paddingTop: z.string().optional(),
  paddingBottom: z.string().optional(),
  fullWidth: z.boolean().optional(),
  customClasses: z.string().optional(),
});

// Section content schemas
export const headerContentSchema = z.object({
  logo: z.string(),
  logoAlt: z.string(),
  navItems: z.array(navItemSchema),
  cta: ctaButtonSchema.optional(),
  showDarkModeToggle: z.boolean(),
});

export const heroContentSchema = z.object({
  headline: z.string().min(1, "Headline is required"),
  subheadline: z.string(),
  description: z.string().optional(),
  primaryCta: ctaButtonSchema.optional(),
  secondaryCta: ctaButtonSchema.optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  videoUrl: z.string().url().optional(),
  textStyles: z.record(z.string(), textStyleSchema).optional(),
});

export const featureItemSchema = z.object({
  id: z.string(),
  icon: z.string().optional(),
  title: z.string().min(1),
  description: z.string(),
  image: z.string().optional(),
});

export const featuresContentSchema = z.object({
  headline: z.string().min(1),
  subheadline: z.string().optional(),
  features: z.array(featureItemSchema).min(1),
  textStyles: z.record(z.string(), textStyleSchema).optional(),
});

export const testimonialSchema = z.object({
  id: z.string(),
  quote: z.string().min(1),
  author: z.string().min(1),
  role: z.string(),
  company: z.string().optional(),
  avatar: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const testimonialsContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  testimonials: z.array(testimonialSchema).min(1),
  textStyles: z.record(z.string(), textStyleSchema).optional(),
});

export const logoItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string(),
  url: z.string().optional(),
});

export const logoCloudContentSchema = z.object({
  headline: z.string().optional(),
  logos: z.array(logoItemSchema),
});

export const statItemSchema = z.object({
  id: z.string(),
  value: z.string(),
  label: z.string(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

export const statsContentSchema = z.object({
  headline: z.string().optional(),
  stats: z.array(statItemSchema).min(1),
  textStyles: z.record(z.string(), textStyleSchema).optional(),
});

export const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.string(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  socialLinks: z
    .array(
      z.object({
        platform: z.string(),
        url: z.string().url(),
      })
    )
    .optional(),
});

export const teamContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  members: z.array(teamMemberSchema).min(1),
});

export const timelineItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string().min(1),
  description: z.string(),
  icon: z.string().optional(),
});

export const timelineContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  items: z.array(timelineItemSchema).min(1),
});

export const galleryItemSchema = z.object({
  id: z.string(),
  image: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
});

export const galleryContentSchema = z.object({
  headline: z.string().optional(),
  items: z.array(galleryItemSchema),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export const ctaContentSchema = z.object({
  headline: z.string().min(1),
  subheadline: z.string().optional(),
  description: z.string().optional(),
  primaryCta: ctaButtonSchema,
  secondaryCta: ctaButtonSchema.optional(),
  image: z.string().optional(),
  textStyles: z.record(z.string(), textStyleSchema).optional(),
});

export const pricingTierSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string(),
  period: z.string().optional(),
  features: z.array(z.string()),
  cta: ctaButtonSchema,
  highlighted: z.boolean().optional(),
  badge: z.string().optional(),
});

export const pricingContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  tiers: z.array(pricingTierSchema).min(1),
  showToggle: z.boolean().optional(),
  monthlyLabel: z.string().optional(),
  yearlyLabel: z.string().optional(),
  textStyles: z.record(z.string(), textStyleSchema).optional(),
});

export const faqItemSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const faqContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  items: z.array(faqItemSchema).min(1),
  textStyles: z.record(z.string(), textStyleSchema).optional(),
});

export const contactFormContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  fields: z.object({
    name: z.boolean(),
    email: z.boolean(),
    phone: z.boolean(),
    company: z.boolean(),
    message: z.boolean(),
  }),
  submitText: z.string(),
  successMessage: z.string(),
  contactInfo: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    hours: z.string().optional(),
  }).optional(),
});

export const footerColumnSchema = z.object({
  id: z.string(),
  title: z.string(),
  links: z.array(
    z.object({
      label: z.string(),
      href: z.string(),
    })
  ),
});

export const footerContentSchema = z.object({
  logo: z.string(),
  logoAlt: z.string(),
  description: z.string().optional(),
  columns: z.array(footerColumnSchema),
  socialLinks: z
    .array(
      z.object({
        platform: z.string(),
        url: z.string(),
        icon: z.string(),
      })
    )
    .optional(),
  copyright: z.string(),
  bottomLinks: z
    .array(
      z.object({
        label: z.string(),
        href: z.string(),
      })
    )
    .optional(),
});

export const productItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  price: z.string(),
  originalPrice: z.string().optional(),
  image: z.string(),
  badge: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  href: z.string(),
});

export const courseItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  instructor: z.string(),
  instructorAvatar: z.string().optional(),
  price: z.string(),
  originalPrice: z.string().optional(),
  image: z.string(),
  duration: z.string().optional(),
  lessons: z.number().optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  rating: z.number().optional(),
  students: z.number().optional(),
  href: z.string(),
});

export const courseCardsContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  courses: z.array(courseItemSchema),
});

export const bookItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  author: z.string(),
  description: z.string(),
  price: z.string(),
  originalPrice: z.string().optional(),
  cover: z.string(),
  pages: z.number().optional(),
  format: z.array(z.string()).optional(),
  rating: z.number().optional(),
  href: z.string(),
});

export const bookShowcaseContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  books: z.array(bookItemSchema),
});

export const aboutContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  content: z.string(),
  image: z.string().optional(),
  imagePosition: z.enum(["left", "right"]).optional(),
  stats: z.array(statItemSchema).optional(),
  textStyles: z.record(z.string(), textStyleSchema).optional(),
});

// Section config schema
export const sectionTypeSchema = z.enum([
  "header",
  "footer",
  "hero",
  "features-grid",
  "features-list",
  "features-tabs",
  "features-accordion",
  "testimonials-carousel",
  "testimonials-grid",
  "logo-cloud",
  "stats-counter",
  "about",
  "team",
  "timeline",
  "gallery",
  "cta-banner",
  "cta-split",
  "pricing-table",
  "faq-accordion",
  "contact-form",
  "course-cards",
  "book-showcase",
  "book-hero",
  "book-description",
  "book-offerings",
  "book-author",
  "book-recommendations",
  // Luxury sections
  "luxury-hero",
  "luxury-trust",
  "luxury-categories",
  "luxury-features",
  "luxury-how-it-works",
  "luxury-stats",
  "luxury-testimonials",
  "luxury-pricing",
  "luxury-faq",
  "luxury-cta",
]);

export const sectionConfigSchema = z.object({
  id: z.string(),
  type: sectionTypeSchema,
  variant: z.string(),
  order: z.number(),
  visible: z.boolean(),
  deleted: z.boolean(),
  content: z.record(z.unknown()),
  settings: sectionSettingsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Content schema map for validation
export const contentSchemaMap = {
  header: headerContentSchema,
  footer: footerContentSchema,
  hero: heroContentSchema,
  "features-grid": featuresContentSchema,
  "features-list": featuresContentSchema,
  "features-tabs": featuresContentSchema,
  "features-accordion": featuresContentSchema,
  "testimonials-carousel": testimonialsContentSchema,
  "testimonials-grid": testimonialsContentSchema,
  "logo-cloud": logoCloudContentSchema,
  "stats-counter": statsContentSchema,
  about: aboutContentSchema,
  team: teamContentSchema,
  timeline: timelineContentSchema,
  gallery: galleryContentSchema,
  "cta-banner": ctaContentSchema,
  "cta-split": ctaContentSchema,
  "pricing-table": pricingContentSchema,
  "faq-accordion": faqContentSchema,
  "contact-form": contactFormContentSchema,
  "course-cards": courseCardsContentSchema,
  "book-showcase": bookShowcaseContentSchema,
} as const;
