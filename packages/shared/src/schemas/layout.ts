import { z } from "zod";
import { ctaButtonSchema, navItemSchema, footerColumnSchema } from "./section";

// ============================================
// Sidebar Schemas
// ============================================

export const sidebarBadgeVariantSchema = z.enum([
  "new",
  "free",
  "popular",
  "beta",
  "pro",
]);

export const sidebarItemTypeSchema = z.enum(["system", "entitlement", "custom"]);

export const sidebarNavItemSchema: z.ZodType<{
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: { text: string; variant: "new" | "free" | "popular" | "beta" | "pro" };
  children?: {
    id: string;
    label: string;
    href: string;
    icon?: string;
    badge?: { text: string; variant: "new" | "free" | "popular" | "beta" | "pro" };
    isExternal?: boolean;
  }[];
  isExternal?: boolean;
  itemType?: "system" | "entitlement" | "custom";
  featureKey?: string;
  visible?: boolean;
}> = z.object({
  id: z.string(),
  label: z.string().min(1),
  href: z.string(),
  icon: z.string().optional(),
  badge: z
    .object({
      text: z.string(),
      variant: sidebarBadgeVariantSchema,
    })
    .optional(),
  children: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1),
        href: z.string(),
        icon: z.string().optional(),
        badge: z
          .object({
            text: z.string(),
            variant: sidebarBadgeVariantSchema,
          })
          .optional(),
        isExternal: z.boolean().optional(),
      })
    )
    .optional(),
  isExternal: z.boolean().optional(),
  itemType: sidebarItemTypeSchema.optional(),
  featureKey: z.string().optional(),
  visible: z.boolean().optional(),
});

export const sidebarWidgetTypeSchema = z.enum([
  "custom-html",
  "social-links",
  "newsletter",
  "contact-info",
  "banner",
]);

export const sidebarWidgetContentSchema = z.object({
  // For custom-html widget
  html: z.string().optional(),

  // For social-links widget
  socialLinks: z
    .array(
      z.object({
        platform: z.string(),
        url: z.string(),
        icon: z.string(),
      })
    )
    .optional(),

  // For newsletter widget
  newsletterTitle: z.string().optional(),
  newsletterDescription: z.string().optional(),
  newsletterPlaceholder: z.string().optional(),
  newsletterButtonText: z.string().optional(),

  // For contact-info widget
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),

  // For banner widget
  bannerImage: z.string().optional(),
  bannerLink: z.string().optional(),
  bannerAlt: z.string().optional(),
});

export const sidebarWidgetSchema = z.object({
  id: z.string(),
  type: sidebarWidgetTypeSchema,
  title: z.string().optional(),
  content: sidebarWidgetContentSchema,
  visible: z.boolean(),
  order: z.number(),
});

// ============================================
// Top Bar Schemas
// ============================================

export const topBarContentTypeSchema = z.enum(["text", "rich"]);

export const topBarButtonSchema = z.object({
  text: z.string(),
  href: z.string(),
  variant: z.enum(["primary", "secondary", "outline", "ghost"]),
});

export const topBarCountdownSchema = z.object({
  enabled: z.boolean(),
  targetDate: z.string().optional(),
  label: z.string().optional(),
});

export const topBarContentSchema = z.object({
  type: topBarContentTypeSchema,

  // For text type
  text: z.string().optional(),
  link: z
    .object({
      text: z.string(),
      href: z.string(),
    })
    .optional(),

  // For rich type
  richContent: z
    .object({
      message: z.string(),
      buttons: z.array(topBarButtonSchema).optional(),
      countdown: topBarCountdownSchema.optional(),
    })
    .optional(),
});

// ============================================
// Layout Element Schemas
// ============================================

export const headerVariantSchema = z.enum([
  "minimal",
  "centered",
  "transparent",
  "sticky",
]);

export const layoutHeaderSchema = z.object({
  enabled: z.boolean(),
  logo: z.string(),
  logoAlt: z.string(),
  navItems: z.array(navItemSchema),
  cta: ctaButtonSchema.optional(),
  showDarkModeToggle: z.boolean(),
  variant: headerVariantSchema,
  sticky: z.boolean().optional(),
});

export const footerVariantSchema = z.enum([
  "simple",
  "centered",
  "columns",
  "comprehensive",
]);

// Re-export footerColumnSchema from section for convenience
export { footerColumnSchema } from "./section";

export const layoutFooterSchema = z.object({
  enabled: z.boolean(),
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
  variant: footerVariantSchema,
  contactInfo: z
    .object({
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  whatsappContacts: z
    .array(
      z.object({
        number: z.string(),
        href: z.string(),
      })
    )
    .optional(),
  appDownload: z
    .object({
      enabled: z.boolean(),
      appStoreUrl: z.string().optional(),
      playStoreUrl: z.string().optional(),
    })
    .optional(),
  useHeaderLogo: z.boolean().optional(),
});

export const layoutSidebarSchema = z.object({
  enabled: z.boolean(),
  position: z.literal("left"),
  width: z.string(),
  navItems: z.array(sidebarNavItemSchema),
  widgets: z.array(sidebarWidgetSchema),
  collapsible: z.boolean(),
  showLogo: z.boolean().optional(),
  logoSize: z.enum(["sm", "md", "lg"]).optional(),
});

export const layoutTopBarSchema = z.object({
  enabled: z.boolean(),
  content: topBarContentSchema,
  dismissible: z.boolean(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
});

// ============================================
// Layout Template Schemas
// ============================================

export const layoutTemplateIdSchema = z.enum([
  "full-width",
  "with-sidebar",
  "minimal",
  "dashboard",
]);

export const layoutTemplateSchema = z.object({
  id: layoutTemplateIdSchema,
  name: z.string(),
  description: z.string(),
  thumbnail: z.string(),
  preview: z.object({
    hasHeader: z.boolean(),
    hasFooter: z.boolean(),
    hasSidebar: z.boolean(),
    hasTopBar: z.boolean(),
  }),
  defaultConfig: z.object({
    header: layoutHeaderSchema,
    footer: layoutFooterSchema,
    sidebar: layoutSidebarSchema,
    topBar: layoutTopBarSchema,
    templateId: layoutTemplateIdSchema.optional(),
  }),
});

// ============================================
// Main Tenant Layout Schema
// ============================================

export const tenantLayoutSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  header: layoutHeaderSchema,
  footer: layoutFooterSchema,
  sidebar: layoutSidebarSchema,
  topBar: layoutTopBarSchema,
  templateId: layoutTemplateIdSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ============================================
// Page Layout Overrides Schema
// ============================================

export const pageLayoutOverridesSchema = z.object({
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  hideSidebar: z.boolean().optional(),
  hideTopBar: z.boolean().optional(),
});

// ============================================
// Partial Schemas for Updates
// ============================================

export const partialLayoutHeaderSchema = layoutHeaderSchema.partial();
export const partialLayoutFooterSchema = layoutFooterSchema.partial();
export const partialLayoutSidebarSchema = layoutSidebarSchema.partial();
export const partialLayoutTopBarSchema = layoutTopBarSchema.partial();

export const partialTenantLayoutSchema = z.object({
  header: partialLayoutHeaderSchema.optional(),
  footer: partialLayoutFooterSchema.optional(),
  sidebar: partialLayoutSidebarSchema.optional(),
  topBar: partialLayoutTopBarSchema.optional(),
  templateId: layoutTemplateIdSchema.optional(),
});
