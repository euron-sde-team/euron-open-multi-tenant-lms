import { z } from "zod";
import { sectionConfigSchema } from "./section";
import { themeConfigSchema } from "./theme";
import { pageLayoutOverridesSchema } from "./layout";

export const seoConfigSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  keywords: z.array(z.string()).optional(),
  ogImage: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  twitterCard: z.enum(["summary", "summary_large_image"]).optional(),
  canonicalUrl: z.string().url().optional(),
  noIndex: z.boolean().optional(),
});

export const pageConfigSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  slug: z.string().min(1),
  title: z.string().min(1),
  sections: z.array(sectionConfigSchema),
  theme: themeConfigSchema,
  seo: seoConfigSchema,
  isPublished: z.boolean(),
  isHomePage: z.boolean().optional(),
  layoutOverrides: pageLayoutOverridesSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const tenantSettingsSchema = z.object({
  allowCustomDomain: z.boolean(),
  maxPages: z.number().min(1),
  analyticsEnabled: z.boolean(),
  customCss: z.string().optional(),
  customScripts: z.string().optional(),
  socialLinks: z
    .object({
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      instagram: z.string().optional(),
      linkedin: z.string().optional(),
      youtube: z.string().optional(),
    })
    .optional(),
  contactEmail: z.string().email().optional(),
  supportEmail: z.string().email().optional(),
});

export const tenantConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  domain: z.string().optional(),
  customDomain: z.string().optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  defaultTheme: themeConfigSchema,
  pages: z.array(pageConfigSchema),
  settings: tenantSettingsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const tenantDomainSchema = z.object({
  tenantId: z.string(),
  type: z.enum(["subdomain", "custom"]),
  domain: z.string(),
  verified: z.boolean(),
  sslEnabled: z.boolean(),
  createdAt: z.string(),
});

export const templateConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  thumbnail: z.string(),
  category: z.enum(["modern", "classic", "bold", "minimal", "creative"]),
  sections: z.array(
    sectionConfigSchema.omit({
      id: true,
      createdAt: true,
      updatedAt: true,
    })
  ),
  defaultTheme: themeConfigSchema,
});
