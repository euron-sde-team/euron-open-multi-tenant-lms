import { NotFoundError } from "../errors/not-found.error";
import type { PageConfigResponse } from "../repositories/pages.repository";
import pagesRepository from "../repositories/pages.repository";
import tenantRepository from "../repositories/tenant.repository";
import tenantOrgRepository from "../repositories/tenant-org.repository";
import booksRepository, { type BookWithRelations } from "../repositories/books.repository";
import * as coursesRepo from "../repositories/courses.repository";
import routesService, { type AvailableRoutesResponse } from "./routes.service";
import { getPriceMapsForEntities, type PriceMapEntry } from "../utils/price-resolver";
import { isAccessManaged } from "../utils/assert-self-serve";
import config from "../config";

const DEFAULT_SLUG = "home";

/** Array form of the per-currency price map (hero/pricing section content consumes this shape). */
type ContentPriceArray = Array<{
  currency: string;
  amount: number;
  discount: number;
  discount_type: PriceMapEntry["discount_type"];
}>;

/**
 * `discount_type` MUST survive this conversion: these arrays overwrite the
 * hero/pricing section prices the storefront resolves with resolvePrice(),
 * and an entry without a type falls back to percent. That fallback turned a
 * flat ₹200 off ₹2,000 course into "200%", clamped to 100% off, i.e. a free
 * item on the detail page while list pages (which pass the map through
 * untouched) showed the right price.
 */
function priceMapToArray(
  map: Record<string, PriceMapEntry> | undefined
): ContentPriceArray {
  return Object.entries(map ?? {}).map(([currency, p]) => ({
    currency,
    amount: p.amount,
    discount: p.discount,
    discount_type: p.discount_type,
  }));
}

// Root page may be stored as "home", "", or "/" depending on how it was created
const ROOT_SLUG_ALIASES = ["home", "", "/"];

/** Page config response extended with tenant-level layout and available routes */
export interface TemplateResponse extends PageConfigResponse {
  layout: unknown | null;
  availableRoutes?: AvailableRoutesResponse;
  /** True when the underlying course/book is ARCHIVED (hidden from discovery but accessible to purchasers). */
  is_archived?: boolean;
  metadata?: Record<string, unknown>;
  /** Tenant favicon URL (from org details) */
  faviconUrl?: string | null;
  /** Canonical tenant brand name (from tenants.name). Used by the web app for tab titles, OG tags, JSON-LD provider names. */
  tenantName?: string | null;
}

/** Recommendation item for book-recommendations section */
interface BookRecommendationItem {
  id: string;
  bookId: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

function bookToPageConfig(
  book: BookWithRelations,
  recommendations: BookRecommendationItem[] = [],
  prices: ContentPriceArray = []
): PageConfigResponse {
  // Parse prices as numbers for the template
  const priceInr = book.priceInr ? parseFloat(book.priceInr) : 0;
  const priceUsd = book.priceUsd ? parseFloat(book.priceUsd) : 0;
  const discountInr = book.discountInr ? parseFloat(book.discountInr) : 0;
  const discountUsd = book.discountUsd ? parseFloat(book.discountUsd) : 0;

  // Build book-hero section content (matching what book-converter.ts expects)
  const heroContent = {
    title: book.title,
    description: book.description || "",
    language: book.language,
    pages: book.pages || 0,
    purchaseMode: book.purchaseMode as "FREE" | "PAID",
    publishStatus: "PUBLISHED" as const,
    // null = lifetime access. Must be emitted explicitly rather than omitted:
    // book-converter.ts only falls back to 365 when the key is `undefined`,
    // so an explicit null is what carries "lifetime" through to the template.
    validityDays: book.validityDays,
    webPriceINR: priceInr,
    mobilePriceINR: priceInr,
    webPriceUSD: priceUsd,
    mobilePriceUSD: priceUsd,
    webDiscount: discountInr,
    mobileDiscount: discountUsd,
    prices,
    webThumbnailUrl: book.thumbnailUrl || "",
    mobileThumbnailUrl: book.thumbnailUrl || "",
    previewUrl: book.previewUrl || "",
    url: book.url || "",
    authorIds: book.authorIds,
    categoryIds: book.categoryIds,
    authors: book.authors.map((a) => ({
      id: a.id,
      name: a.name,
      bio: a.bio || "",
      profileUrl: a.profileUrl || "",
    })),
    categories: book.categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      iconUrl: c.iconUrl || "",
    })),
    rating: book.rating != null ? Number(book.rating) : undefined,
    ratingTotalCount: book.ratingTotalCount ?? 0,
  };

  // Build book-description section content
  const descriptionContent = {
    content: book.description || "",
  };

  // Build book-author section content (for "About the Author" block)
  const authorContent = {
    authors: book.authors.map((a) => ({
      id: a.id,
      name: a.name,
      bio: a.bio || "",
      profileUrl: a.profileUrl || "",
    })),
  };

  // Build sections array with explicit type
  const sections: Array<{
    id: string;
    type: string;
    content: unknown;
    settings: Record<string, unknown>;
  }> = [
    {
      id: `${book.id}-hero`,
      type: "book-hero",
      content: heroContent,
      settings: {},
    },
    {
      id: `${book.id}-description`,
      type: "book-description",
      content: descriptionContent,
      settings: {},
    },
  ];

  // Only add author section if there are authors
  if (book.authors.length > 0) {
    sections.push({
      id: `${book.id}-author`,
      type: "book-author",
      content: authorContent,
      settings: {},
    });
  }

  // Add book-recommendations section if there are recommendations
  if (recommendations.length > 0) {
    sections.push({
      id: `${book.id}-recommendations`,
      type: "book-recommendations",
      content: {
        headline: "More books you might like",
        recommendations: recommendations.map((r) => ({
          id: r.id,
          bookId: r.bookId,
          title: r.title,
          slug: r.slug,
          thumbnailUrl: r.thumbnailUrl ?? undefined,
          sortOrder: r.sortOrder,
        })),
      },
      settings: {},
    });
  }

  return {
    id: book.id,
    tenantId: book.tenantId,
    slug: `books/${book.slug}`,
    title: book.title,
    sections,
    theme: null,
    seo: {
      title: book.title,
      description: book.summary || book.description || "",
    },
    isPublished: true,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

const DEFAULT_HEADER = {
  enabled: true,
  logo: "",
  logoAlt: "",
  navItems: [],
  showDarkModeToggle: true,
  variant: "dashboard",
  sticky: true,
  searchBar: { enabled: true, placeholder: "Search courses, instructors, topics..." },
  profileDropdown: { enabled: true, showAvatar: true, showName: true, menuItems: [] },
  showNotifications: true,
};

const DEFAULT_FOOTER = {
  enabled: true,
  logo: "",
  logoAlt: "",
  description: "",
  columns: [],
  socialLinks: [],
  copyright: `© ${new Date().getFullYear()} All rights reserved.`,
  variant: "simple",
  useHeaderLogo: true,
};

const DEFAULT_SIDEBAR = {
  enabled: true,
  position: "left",
  width: "280px",
  collapsible: true,
  defaultCollapsed: true,
  showLogo: false,
  logoSize: "md",
  navItems: [],
  widgets: [],
};

const DEFAULT_TOPBAR = {
  enabled: false,
  content: { type: "text", text: "" },
  dismissible: false,
};

/**
 * Ensures a layout from the DB has all required sections by
 * merging with defaults. Handles new tenants that only have
 * partial layout (e.g. only sidebar.navItems from admin seeding).
 */
function ensureCompleteLayout(layout: unknown): unknown {
  if (!layout || typeof layout !== "object") return null;
  const l = layout as Record<string, unknown>;

  return {
    ...l,
    header: l.header ?? DEFAULT_HEADER,
    footer: l.footer ?? DEFAULT_FOOTER,
    sidebar: {
      ...DEFAULT_SIDEBAR,
      ...(typeof l.sidebar === "object" && l.sidebar ? l.sidebar as Record<string, unknown> : {}),
    },
    topBar: l.topBar ?? DEFAULT_TOPBAR,
  };
}

/**
 * Filters hidden sidebar items and strips admin metadata fields
 * before returning layout to the web app.
 * Also ensures the layout has all required sections with defaults.
 */
function sanitizeSidebarForWeb(layout: unknown): unknown {
  const completeLayout = ensureCompleteLayout(layout);
  if (!completeLayout || typeof completeLayout !== "object") return completeLayout;

  const l = completeLayout as Record<string, unknown>;
  const sidebar = l.sidebar as Record<string, unknown> | undefined;
  if (!sidebar?.navItems || !Array.isArray(sidebar.navItems)) return completeLayout;

  return {
    ...l,
    sidebar: {
      ...sidebar,
      navItems: (sidebar.navItems as Record<string, unknown>[])
        .filter((item) => item.visible !== false)
        .map(({ itemType: _type, featureKey: _key, visible: _vis, ...rest }) => rest),
    },
  };
}

/**
 * Extracts community/messaging links from tenant org social_links JSON.
 * Used for the floating widget on the home page.
 */
function extractCommunityLinks(
  socialLinks: unknown
): { platform: string; url: string }[] {
  if (!socialLinks || typeof socialLinks !== "object") return [];
  const links = socialLinks as Record<string, unknown>;
  const result: { platform: string; url: string }[] = [];
  if (typeof links.whatsapp === "string" && links.whatsapp) result.push({ platform: "whatsapp", url: links.whatsapp });
  if (typeof links.telegram === "string" && links.telegram) result.push({ platform: "telegram", url: links.telegram });
  if (typeof links.discord === "string" && links.discord) result.push({ platform: "discord", url: links.discord });
  return result;
}

class TemplateService {
  /**
   * Get published page config for tenant by slug (default: home).
   * Also includes the tenant-level layout (header, sidebar, footer config).
   *
   * For root/home page, tries "home", "", "/" since admin may store it differently.
   * For course pages, also tries "courses/<slug>" since pages are stored with that prefix.
   * For book pages, tries tenant_pages first then books table.
   */
  async getTemplateForTenant(tenantId: string, slug?: string, tenantName?: string): Promise<TemplateResponse> {
    const requestedSlug = (slug || "").trim() || DEFAULT_SLUG;
    const slugsToTry =
      requestedSlug === DEFAULT_SLUG ? ROOT_SLUG_ALIASES : [requestedSlug];

    // Also try "courses/<slug>" if the slug doesn't already have that prefix
    if (requestedSlug !== DEFAULT_SLUG && !requestedSlug.startsWith("courses/") && !requestedSlug.startsWith("books/")) {
      slugsToTry.push(`courses/${requestedSlug}`);
    }

    // Fetch page + tenant layout + org details in parallel for performance
    const layoutPromise = tenantRepository.getLayout(tenantId);
    const orgDetailsPromise = tenantOrgRepository.findByTenantId(tenantId);

    let isArchived = false;
    let page: PageConfigResponse | undefined;
    for (const s of slugsToTry) {
      page = await pagesRepository.findPublishedByTenantAndSlug(tenantId, s);
      if (page) break;
    }

    // If no page found and slug starts with "books/", try the books table
    if (!page && requestedSlug.startsWith("books/")) {
      const bookSlug = requestedSlug.replace(/^books\//, "");
      const book = await booksRepository.findPublishedByTenantAndSlug(tenantId, bookSlug, { allowArchived: true });
      if (book) {
        if (book.status === "ARCHIVED") {
          isArchived = true;
        }
        const [recommendations, bookPriceMaps] = await Promise.all([
          booksRepository.findRecommendationsByBookId(tenantId, book.id),
          getPriceMapsForEntities(tenantId, "BOOK", [
            {
              id: book.id,
              price_inr: book.priceInr,
              price_usd: book.priceUsd,
              discount_inr: book.discountInr,
              discount_usd: book.discountUsd,
            },
          ]),
        ]);
        page = bookToPageConfig(book, recommendations, priceMapToArray(bookPriceMaps.get(book.id)));
      }
    }

    if (!page) {
      throw new NotFoundError(
        `Published page not found for slug: ${requestedSlug}. Ensure the page exists and is published in the admin.`
      );
    }

    // For course pages: merge validityDays and pricing from LMS course into course-hero section
    // (DB is source of truth for consistency; page may have stale data from admin save)
    const courseSlug =
      page.slug?.startsWith("courses/") ? page.slug.replace(/^courses\/?/, "") : null;
    if (courseSlug && page.sections && Array.isArray(page.sections)) {
      const course = await coursesRepo.findPublishedCourseBySlug(tenantId, courseSlug, { allowArchived: true });
      if (course && String(course.status) === "ARCHIVED") {
        isArchived = true;
      }
      const sections = page.sections as Array<{ type?: string; content?: Record<string, unknown> }>;
      for (const sec of sections) {
        if (sec.type === "course-hero" && sec.content && typeof sec.content === "object") {
          const content = sec.content as Record<string, unknown>;
          if (course) {
            const c = course as unknown as {
              validity_days?: number | null;
              price_inr?: string | number | null;
              price_usd?: string | number | null;
              discount_inr?: string | number | null;
              discount_usd?: string | number | null;
              purchase_mode?: string;
              difficulty?: string | null;
            };
            // NULL validity_days = lifetime access. Always write the DB value
            // through, including the null, because the page JSON carries a
            // `validityDays` baked in at creation time. Skipping the assignment
            // (or defaulting to 365) leaves that stale number on screen and a
            // lifetime course advertises an expiry it does not have.
            content.validityDays =
              c.validity_days == null ? null : Number(c.validity_days);
            if (c.difficulty != null) content.difficulty = String(c.difficulty);
            content.webPriceINR = c.price_inr != null ? parseFloat(String(c.price_inr)) : 0;
            content.webPriceUSD = c.price_usd != null ? parseFloat(String(c.price_usd)) : 0;
            content.mobilePriceINR = content.webPriceINR;
            content.mobilePriceUSD = content.webPriceUSD;
            content.webDiscount = c.discount_inr != null ? parseFloat(String(c.discount_inr)) : 0;
            content.mobileDiscount = c.discount_usd != null ? parseFloat(String(c.discount_usd)) : content.webDiscount;
            content.purchaseMode = c.purchase_mode ?? "PAID";
            // Multi-currency price map from the DB (page JSON may be stale)
            const coursePriceMaps = await getPriceMapsForEntities(tenantId, "COURSE", [
              {
                id: course.id,
                price_inr: c.price_inr,
                price_usd: c.price_usd,
                discount_inr: c.discount_inr,
                discount_usd: c.discount_usd,
              },
            ]);
            content.prices = priceMapToArray(coursePriceMaps.get(course.id));
          }
          break;
        }
      }
    }

    const [rawLayout, orgDetails] = await Promise.all([layoutPromise, orgDetailsPromise]);
    const layout = sanitizeSidebarForWeb(rawLayout);
    const availableRoutes = await routesService.getAvailableRoutes(tenantId);

    // Build favicon URL from org details
    let faviconUrl: string | null = null;
    if (orgDetails?.favicon_key) {
      faviconUrl = orgDetails.favicon_key.startsWith("http")
        ? orgDetails.favicon_key
        : `${config.TENANT_DETAILS_BASE_URL}/${orgDetails.favicon_key}`;
    }

    // Resolve logo URLs. tenant_org_details is the source of truth (admin
    // preview reads it on every render); the layout's stored logo URL can go
    // stale because uploads change the ULID in the S3 key but the synced
    // header.logo only updates if syncLogoToLayout succeeds. Always prefer
    // org_details and fall back to whatever the layout has.
    const resolveAssetUrl = (key: string | undefined | null): string | null => {
      if (!key || typeof key !== "string" || key === "") return null;
      return key.startsWith("http") ? key : `${config.TENANT_DETAILS_BASE_URL}/${key}`;
    };

    const orgLightUrl = resolveAssetUrl(orgDetails?.logo_light_key ?? null);
    const orgDarkUrl = resolveAssetUrl(orgDetails?.logo_dark_key ?? null);

    if (layout && typeof layout === "object") {
      const l = layout as Record<string, unknown>;

      const applyLogos = (section: Record<string, unknown> | undefined) => {
        if (!section) return;
        section.logo = orgLightUrl ?? resolveAssetUrl(section.logo as string | undefined) ?? orgDarkUrl ?? null;
        section.logoDark = orgDarkUrl ?? resolveAssetUrl(section.logoDark as string | undefined) ?? orgLightUrl ?? null;
      };

      applyLogos(l.header as Record<string, unknown> | undefined);
      applyLogos(l.footer as Record<string, unknown> | undefined);
    }

    // Extract community links from org social_links
    const communityLinks = orgDetails?.social_links
      ? extractCommunityLinks(orgDetails.social_links)
      : [];

    // Merge communityLinks into layout so all pages can access layout.communityLinks
    if (communityLinks.length > 0 && layout && typeof layout === "object") {
      (layout as Record<string, unknown>).communityLinks = communityLinks;
    }

    // Access-managed storefront: the page metadata's generic `price` /
    // `priceCurrency` keys feed server-rendered SEO JSON-LD offers, null
    // them so structured data carries no offer (the snake/camel price keys
    // and `prices` maps are already handled by the response-edge scrub).
    const accessManaged = await isAccessManaged(tenantId);

    // Custom-code moderation kill switch: a BLOCKED custom-code page must never
    // serve tenant HTML/JS. Fall back to the section render so the URL stays
    // live but safe.
    const servedRenderMode =
      page.renderMode === "CUSTOM_CODE" && page.moderationStatus !== "BLOCKED"
        ? "CUSTOM_CODE"
        : "SECTIONS";
    const servedCustomHtml =
      servedRenderMode === "CUSTOM_CODE" ? page.customHtml ?? null : null;

    return {
      ...page,
      renderMode: servedRenderMode,
      customHtml: servedCustomHtml,
      layout,
      availableRoutes,
      is_archived: isArchived,
      faviconUrl,
      tenantName: tenantName ?? null,
      metadata: {
        ...(page.metadata ?? {}),
        ...(communityLinks.length > 0 ? { communityLinks } : {}),
        ...(accessManaged ? { price: null, priceCurrency: null } : {}),
      },
    };
  }
}

export default new TemplateService();
