import { PAGE_CATEGORY_ROUTES } from "@open-mtlms/shared";
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Info,
  Mail,
  UserRound,
  HelpCircle,
  Shield,
  FileText,
  ShoppingCart,
  Bookmark,
  LogIn,
} from "lucide-react";

export interface PageCategory {
  id: string;
  name: string;
  description: string;
  /** Display route shown to users (with leading slash) */
  route: string;
  /** Slug used in database/API (without leading slash, "home" for root) */
  slug: string;
  icon: LucideIcon;
  templateCategories: string[];
  /** Alternative slugs that should map to this category (for backward compatibility) */
  slugAliases?: string[];
  /** Optional link to a settings page shown on the card (replaces editor link) */
  settingsHref?: string;
}

/** Admin-specific metadata per category. Extends shared PAGE_CATEGORY_ROUTES. */
const ADMIN_CATEGORY_METADATA: Record<
  string,
  { description: string; icon: LucideIcon; templateCategories: string[]; slugAliases?: string[]; settingsHref?: string }
> = {
  home: {
    description: "Main landing page for your website",
    icon: Home,
    templateCategories: ["landing"],
    slugAliases: ["", "index", "landing"],
  },
  about: {
    description: "Share your company story and mission",
    icon: Info,
    templateCategories: ["marketing"],
    slugAliases: ["about-us", "aboutus"],
  },
  contact: {
    description: "Contact form and company information",
    icon: Mail,
    templateCategories: ["utility"],
    slugAliases: ["contact-us", "contactus"],
  },
  faq: {
    description: "Frequently asked questions",
    icon: HelpCircle,
    templateCategories: ["utility", "marketing"],
    slugAliases: ["faqs", "help", "questions"],
  },
  privacy: {
    description: "Privacy policy and data handling",
    icon: Shield,
    templateCategories: ["utility"],
    slugAliases: ["privacy-policy", "privacypolicy"],
  },
  terms: {
    description: "Terms and conditions",
    icon: FileText,
    templateCategories: ["utility"],
    slugAliases: ["terms-of-service", "tos", "terms-and-conditions"],
  },
  login: {
    description: "User authentication page",
    icon: LogIn,
    templateCategories: ["utility"],
    slugAliases: ["signin", "sign-in"],
    settingsHref: "/dashboard/settings/authentication",
  },
  profile: {
    description: "User profile page. View and edit account, settings, and preferences. Published by default.",
    icon: UserRound,
    templateCategories: ["utility"],
    slugAliases: ["account", "settings"],
  },
  cart: {
    description: "Shopping cart",
    icon: ShoppingCart,
    templateCategories: ["utility"],
    slugAliases: ["shopping-cart"],
  },
  bookmark: {
    description: "Saved bookmarks",
    icon: Bookmark,
    templateCategories: ["utility"],
    slugAliases: ["bookmarks", "saved"],
  },
};

const DEFAULT_METADATA = {
  description: "Custom page",
  icon: FileText,
  templateCategories: ["marketing"],
  slugAliases: [] as string[],
};

/**
 * Page categories derived from shared PAGE_CATEGORY_ROUTES.
 * Add new pages in packages/shared/src/constants/page-category-routes.ts
 * Optionally add ADMIN_CATEGORY_METADATA here for custom icon/description.
 */
export const PAGE_CATEGORIES: PageCategory[] = PAGE_CATEGORY_ROUTES.map((r) => {
  const meta = ADMIN_CATEGORY_METADATA[r.id] ?? DEFAULT_METADATA;
  return {
    id: r.id,
    name: r.label,
    description: meta.description,
    route: r.path,
    slug: r.slug,
    icon: meta.icon,
    templateCategories: meta.templateCategories,
    slugAliases: meta.slugAliases,
    settingsHref: meta.settingsHref,
  };
});

/** Cart and Bookmark are system pages - exclude from createable page categories grid */
export const SYSTEM_ONLY_CATEGORY_IDS = ["cart", "bookmark"] as const;
/** Main page categories grid (excludes system-only categories) */
export const PAGE_CATEGORIES_FOR_GRID: PageCategory[] = PAGE_CATEGORIES.filter(
  (c) => !SYSTEM_ONLY_CATEGORY_IDS.includes(c.id as (typeof SYSTEM_ONLY_CATEGORY_IDS)[number])
);

/**
 * Get a page category by its ID
 */
export const getCategoryById = (id: string): PageCategory | undefined =>
  PAGE_CATEGORIES.find((c) => c.id === id);

/**
 * Get a page category by its route
 */
export const getCategoryByRoute = (route: string): PageCategory | undefined =>
  PAGE_CATEGORIES.find((c) => c.route === route);

/**
 * Check if a route matches any category
 */
export const isValidCategoryRoute = (route: string): boolean =>
  PAGE_CATEGORIES.some((c) => c.route === route);

/**
 * Find a category by database slug, checking both the main slug and aliases.
 */
export const getCategoryBySlug = (slug: string): PageCategory | undefined => {
  const normalizedSlug = slug.toLowerCase().trim().replace(/^\/+|\/+$/g, "");
  const exactMatch = PAGE_CATEGORIES.find((c) => c.slug === normalizedSlug);
  if (exactMatch) return exactMatch;
  return PAGE_CATEGORIES.find((c) =>
    c.slugAliases?.some((alias) => alias.toLowerCase() === normalizedSlug)
  );
};

/**
 * Check if a slug matches any category (including aliases)
 */
export const slugMatchesCategory = (slug: string): boolean =>
  getCategoryBySlug(slug) !== undefined;

/**
 * Get the database slug for a category (used when creating pages)
 */
export const getCategorySlug = (categoryId: string): string | undefined => {
  const category = getCategoryById(categoryId);
  return category?.slug;
};

/**
 * Content pages a tenant may replace with their own custom HTML/CSS/JS.
 *
 * Per product decision, custom code is offered ONLY for the fixed marketing/
 * info pages. It is intentionally NOT offered for system/dynamic pages
 * (all-courses, cart, checkout, course/book players, test series, etc.) or
 * course/book landing pages, those are data-driven and must stay
 * platform-rendered so listings, redirects and new content stay in sync.
 */
export const CUSTOM_CODE_ALLOWED_SLUGS = [
  "home",
  "about",
  "contact",
  "faq",
  "privacy",
  "terms",
] as const;

/**
 * Whether the custom-code editor should be offered for a page with this slug.
 * Normalizes leading/trailing slashes so "" and "/" both resolve to home.
 */
export const canUseCustomCode = (slug: string | null | undefined): boolean => {
  const normalized = (slug ?? "").toLowerCase().trim().replace(/^\/+|\/+$/g, "");
  const key = normalized === "" ? "home" : normalized;
  return (CUSTOM_CODE_ALLOWED_SLUGS as readonly string[]).includes(key);
};
