"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  type ContentPrice,
  type PageConfig,
  type TenantLayout,
  type ThemeConfig,
  getAvailableRoutesResponse,
  isResolvedPrice,
} from "@open-mtlms/shared";
import { AvailableRoutesProvider, useToast } from "@open-mtlms/core";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import {
  BookProvider,
  ModernTemplate,
  ClassicTemplate,
  MinimalTemplate,
  AmazonTemplate,
  type BookAuthor,
  type BookCategory,
  type BookTemplateId,
  type CouponValidationResult,
} from "@open-mtlms/book-templates";
import { CouponOffers } from "@/components/common/CouponOffers";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { ShareModal } from "@/components/share-modal";
import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { checkoutApi } from "@/lib/api/checkout";
import { useCart } from "@/lib/hooks/use-cart";
import { useCurrency } from "@/lib/hooks/use-currency";
import { usePrice } from "@/lib/hooks/use-price";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useBookmark } from "@/lib/stores/bookmark-store";
import { THUMBNAILS_BASE_URL } from "@/lib/utils/constants";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { apiGet } from "@/lib/api/api-client";
import { captureEvent, trackAddToCart, trackBookPurchase, trackProductViewed } from "@/lib/analytics";
import { convertPageConfigToBookData, extractAuthorsFromPageConfig, extractCategoriesFromPageConfig } from "./book-converter";

// Normalize theme to ensure it has the correct structure
function normalizeTheme(theme: unknown): ThemeConfig {
  if (!theme || typeof theme !== "object") return defaultThemeConfig;

  const t = theme as Record<string, unknown>;

  // Check if it's the old simplified format
  if ("colorScheme" in t || "primaryColor" in t || !("colors" in t)) {
    return defaultThemeConfig;
  }

  // Check for correct structure
  const hasCorrectStructure =
    t.colors &&
    typeof t.colors === "object" &&
    "light" in (t.colors as object) &&
    t.fonts &&
    typeof t.fonts === "object";

  if (!hasCorrectStructure) return defaultThemeConfig;

  return {
    ...defaultThemeConfig,
    ...t,
    colors: {
      light: {
        ...defaultThemeConfig.colors.light,
        ...((t.colors as { light?: object })?.light || {}),
      },
      dark: { 
        ...defaultThemeConfig.colors.dark, 
        ...((t.colors as { dark?: object })?.dark || {}) 
      },
    },
    fonts: { ...defaultThemeConfig.fonts, ...((t.fonts as object) || {}) },
    spacing: { ...defaultThemeConfig.spacing, ...((t.spacing as object) || {}) },
    borders: { ...defaultThemeConfig.borders, ...((t.borders as object) || {}) },
  } as ThemeConfig;
}

/** Banner shown at the top of archived content pages for enrolled users. */
function ArchivedBanner() {
  return (
    <div className="bg-muted border-b px-4 py-3 text-center text-sm text-muted-foreground">
      This content has been archived. Your access is preserved, but no new updates will be made.
    </div>
  );
}

/** Full-page message for non-enrolled users viewing archived content. */
function ArchivedUnavailable() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold">Content No Longer Available</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        This book has been archived and is no longer available for purchase.
      </p>
    </div>
  );
}

interface BookPageClientProps {
  initialPageConfig: PageConfig;
  layout: TenantLayout | null;
}

export function BookPageClient({ initialPageConfig, layout }: BookPageClientProps) {
  const [mounted, setMounted] = useState(false);
  const bookTerm = useContentTerm("book");
  const router = useRouter();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const { toast } = useToast();
  const { isAuthenticated, member } = useUserAuthStore();
  const preferredCurrency = useCurrency();
  const { accessManaged, supportEmail } = useStorefrontConfig();
  const guard = useBuyNowGuard();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [resolvedBookId, setResolvedBookId] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [apiAuthors, setApiAuthors] = useState<BookAuthor[]>([]);
  const [apiCategories, setApiCategories] = useState<BookCategory[]>([]);
  const [apiPrices, setApiPrices] = useState<Record<
    string,
    { amount: number; discount?: number | null }
  > | null>(null);
  const isArchived = initialPageConfig.is_archived === true;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Normalize the theme from page config
  const theme = normalizeTheme(initialPageConfig.theme);

  // Convert page config to book form data
  const bookData = useMemo(() => convertPageConfigToBookData(initialPageConfig), [initialPageConfig]);

  // Resolve actual book ID, access state, and author/category data from learner-api
  useEffect(() => {
    const slug = bookData.slug ?? initialPageConfig.slug?.replace(/^books\/?/, "");
    if (!slug) return;
    let cancelled = false;

    apiGet<{
      id: string;
      has_access?: boolean;
      is_archived?: boolean;
      authors?: Array<{
        id: string;
        name: string;
        bio: string | null;
        expertise: string | null;
        profileUrl: string | null;
        socials?: {
          linkedinUrl: string | null;
          twitterUrl: string | null;
          githubUrl: string | null;
          youtubeUrl: string | null;
          websiteUrl: string | null;
          facebookUrl: string | null;
          instagramUrl: string | null;
        };
        experiences?: Array<{
          company: string;
          companyLogo: string | null;
          years: number;
          details: string | null;
        }>;
      }>;
      categories?: Array<{ id: string; name: string; slug: string; iconUrl: string | null }>;
      prices?: Record<string, { amount: number; discount?: number | null }> | null;
    }>(`/books/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (cancelled || !data?.id) return;
        setResolvedBookId(data.id);
        // DB-merged price map (enabled currencies only): the freshest price
        // source, preferred over the page-JSON snapshot which can be stale
        // after a tenant changes currencies.
        if (data.prices && Object.keys(data.prices).length > 0) {
          setApiPrices(data.prices);
        }
        if (data.has_access === true) setHasAccess(true);
        setAccessChecked(true);
        if (data.authors?.length) {
          setApiAuthors(data.authors.map((a) => {
            const socialLinks: Array<{ platform: string; url: string }> = [];
            if (a.socials?.linkedinUrl) socialLinks.push({ platform: "linkedin", url: a.socials.linkedinUrl });
            if (a.socials?.twitterUrl) socialLinks.push({ platform: "twitter", url: a.socials.twitterUrl });
            if (a.socials?.githubUrl) socialLinks.push({ platform: "github", url: a.socials.githubUrl });
            if (a.socials?.youtubeUrl) socialLinks.push({ platform: "youtube", url: a.socials.youtubeUrl });
            if (a.socials?.websiteUrl) socialLinks.push({ platform: "website", url: a.socials.websiteUrl });
            if (a.socials?.facebookUrl) socialLinks.push({ platform: "facebook", url: a.socials.facebookUrl });
            if (a.socials?.instagramUrl) socialLinks.push({ platform: "instagram", url: a.socials.instagramUrl });
            return {
              id: a.id,
              name: a.name,
              bio: a.bio ?? undefined,
              avatar: a.profileUrl ?? undefined,
              role: a.expertise ?? undefined,
              socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
              experiences: a.experiences?.map((e) => ({
                company: e.company,
                companyLogo: e.companyLogo ?? undefined,
                years: e.years,
                details: e.details ?? undefined,
              })),
            };
          }));
        }
        if (data.categories?.length) {
          setApiCategories(data.categories.map((c) => ({
            id: c.id,
            name: c.name,
            icon: c.iconUrl ?? undefined,
          })));
        }
        captureEvent("book_viewed", { book_id: data.id, book_slug: slug, tenant_id: member?.tenantId });
      })
      .catch(() => { setAccessChecked(true); });
    return () => {
      cancelled = true;
    };
  }, [bookData.slug, initialPageConfig.slug, member?.tenantId]);

  // Get authors, prefer API data, fallback to page config
  const authors: BookAuthor[] = useMemo(() => {
    if (apiAuthors.length > 0) return apiAuthors;
    const extracted = extractAuthorsFromPageConfig(initialPageConfig);
    if (extracted.length > 0) return extracted;
    return [];
  }, [apiAuthors, initialPageConfig]);

  // Get categories, prefer API data, fallback to page config
  const categories: BookCategory[] = useMemo(() => {
    if (apiCategories.length > 0) return apiCategories;
    const extracted = extractCategoriesFromPageConfig(initialPageConfig);
    if (extracted.length > 0) return extracted;
    return [];
  }, [apiCategories, initialPageConfig]);

  // Get the selected template from layout, default to "amazon" for e-commerce style layout
  const templateId: BookTemplateId = layout?.bookPageTemplateId || "amazon";

  // Handle start reading
  const handleStartReading = () => {
    // Navigate to the book reader
    router.push(`/book-reader/${bookData.slug}`);
  };

  // Handle unlock: FREE: enroll via API (no payment); PAID: redirect to checkout
  const handleUnlock = useCallback(() => {
    const slug = bookData.slug ?? initialPageConfig.slug?.replace(/^books\/?/, "") ?? "";
    const doUnlock = async () => {
      const itemId = resolvedBookId;
      if (!itemId) {
        toast({ title: "Error", description: `${bookTerm.singular} is not available yet. Please try again.`, variant: "destructive" });
        return;
      }

      if (bookData.purchaseMode === "FREE") {
        trackBookPurchase(itemId);
        try {
          await checkoutApi.freeEnroll({ order_type: "BOOK", item_id: itemId });
          setHasAccess(true);
          toast({
            title: "Access granted",
            description: `You now have access to this ${bookTerm.singular.toLowerCase()}. Redirecting...`,
          });
          router.push(`/book-reader/${bookData.slug}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to get access";
          toast({ title: "Failed to unlock", description: msg, variant: "destructive" });
        }
        return;
      }

      trackBookPurchase(itemId);
      const params = new URLSearchParams({ type: "BOOK", id: itemId });
      if (couponResult?.code) params.set("coupon", couponResult.code);
      window.location.href = `/checkout/direct?${params.toString()}`;
    };
    guard.run(() => { void doUnlock(); }, `/books/${slug}`);
  }, [bookData, initialPageConfig, guard, resolvedBookId, router, toast, couponResult, bookTerm]);

  const handleAddToCart = useCallback(() => {
    const slug = bookData.slug ?? initialPageConfig.slug?.replace(/^books\/?/, "") ?? "";
    guard.run(() => {
      const itemId = resolvedBookId;
      if (!itemId) {
        toast({ title: "Error", description: `${bookTerm.singular} is not available yet. Please try again.`, variant: "destructive" });
        return;
      }

      if (isInCart(itemId)) {
        removeFromCart({ item_type: "BOOK", item_id: itemId });
        toast({ title: "Removed from cart", description: `${bookData.title ?? bookTerm.singular} has been removed from your cart.` });
      } else {
        addToCart({ item_type: "BOOK", item_id: itemId, coupon_code: couponResult?.code });
        trackAddToCart(itemId, "BOOK", undefined, {
          name: bookData.title,
          price: isResolvedPrice(priceParts) ? priceParts.amount : undefined,
          currency: chargeCurrency ?? undefined,
        });
        toast({ title: "Added to cart", description: `${bookData.title ?? bookTerm.singular} has been added to your cart.` });
      }
    }, `/books/${slug}`);
  }, [addToCart, removeFromCart, isInCart, toast, bookData, initialPageConfig, guard, resolvedBookId, couponResult, bookTerm]);

  const handleBuyNow = useCallback(() => {
    const slug = bookData.slug ?? initialPageConfig.slug?.replace(/^books\/?/, "") ?? "";
    const doBuyNow = async () => {
      const itemId = resolvedBookId;
      if (!itemId) {
        toast({ title: "Error", description: `${bookTerm.singular} is not available yet. Please try again.`, variant: "destructive" });
        return;
      }

      if (bookData.purchaseMode === "FREE") {
        try {
          await checkoutApi.freeEnroll({ order_type: "BOOK", item_id: itemId });
          setHasAccess(true);
          toast({
            title: "Access granted",
            description: `You now have access to this ${bookTerm.singular.toLowerCase()}. Redirecting...`,
          });
          router.push(`/book-reader/${bookData.slug}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to get access";
          toast({ title: "Failed to unlock", description: msg, variant: "destructive" });
        }
        return;
      }

      const buyParams = new URLSearchParams({ type: "BOOK", id: itemId });
      if (couponResult?.code) buyParams.set("coupon", couponResult.code);
      window.location.href = `/checkout/direct?${buyParams.toString()}`;
    };
    guard.run(() => { void doBuyNow(); }, `/books/${slug}`);
  }, [bookData, initialPageConfig, guard, resolvedBookId, router, toast, couponResult, bookTerm]);

  const handleContinueReading = useCallback(() => {
    const slug = bookData.slug ?? initialPageConfig.slug?.replace(/^books\/?/, "") ?? "";
    router.push(`/book-reader/${slug}`);
  }, [bookData.slug, initialPageConfig.slug, router]);

  // Resolve display price under the buyer's currency context. Null while the
  // context loads, templates fall back to the legacy preferredCurrency math.
  const priceParts = usePrice({
    prices: apiPrices ?? (bookData as { prices?: ContentPrice[] | null }).prices ?? null,
    legacyInr: bookData.priceInr,
    legacyUsd: bookData.priceUsd,
    legacyDiscountInr: bookData.discountInr ?? bookData.webDiscount,
    legacyDiscountUsd: bookData.discountUsd,
    purchaseMode: bookData.purchaseMode,
  });
  const chargeCurrency = isResolvedPrice(priceParts) ? priceParts.currency : null;

  // ViewContent / view_item, once the book and its resolved price are known.
  const viewReportedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = resolvedBookId ?? null;
    if (!id || viewReportedRef.current === id) return;
    viewReportedRef.current = id;
    trackProductViewed(
      {
        id,
        name: bookData.title,
        category: "BOOK",
        price: isResolvedPrice(priceParts) ? priceParts.amount : undefined,
      },
      chargeCurrency ?? undefined
    );
  }, [resolvedBookId, bookData.title, priceParts, chargeCurrency]);

  const handleBookmarkToggle = useCallback(() => {
    const slug = bookData.slug ?? initialPageConfig.slug?.replace(/^books\/?/, "") ?? "";
    guard.run(() => {
      const productId = resolvedBookId;
      if (!productId) return;
      const wasBookmarked = isBookmarked(productId);
      toggleBookmark({
        productId,
        productType: "book",
        title: bookData.title ?? `Untitled ${bookTerm.singular}`,
        slug: bookData.slug ?? "",
        thumbnailUrl: bookData.webThumbnailUrl || bookData.thumbnailUrl || null,
      });
      toast({
        title: wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
        description: wasBookmarked
          ? `${bookData.title ?? bookTerm.singular} has been removed from your bookmarks.`
          : `${bookData.title ?? bookTerm.singular} has been added to your bookmarks.`,
      });
    }, `/books/${slug}`);
  }, [toggleBookmark, toast, bookData, initialPageConfig, isBookmarked, guard, resolvedBookId, bookTerm]);

  const renderTemplate = () => {
    const templateProps = {
      onStartReading: handleStartReading,
      onUnlock: handleUnlock,
    };

    switch (templateId) {
      case "modern":
        return <ModernTemplate {...templateProps} />;
      case "minimal":
        return <MinimalTemplate {...templateProps} />;
      case "amazon":
        return <AmazonTemplate {...templateProps} />;
      case "classic":
      default:
        return <ClassicTemplate {...templateProps} />;
    }
  };

  // Archived content: gate access, non-enrolled users see "unavailable" message
  if (isArchived && accessChecked && !hasAccess) {
    return (
      <AvailableRoutesProvider initialRoutes={initialPageConfig.availableRoutes ?? getAvailableRoutesResponse()}>
        <LayoutWrapper layout={layout} theme={theme}>
          <ArchivedUnavailable />
        </LayoutWrapper>
      </AvailableRoutesProvider>
    );
  }

  // Show a simple loading state while mounting to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <AvailableRoutesProvider initialRoutes={initialPageConfig.availableRoutes ?? getAvailableRoutesResponse()}>
      <LayoutWrapper layout={layout} theme={theme}>
        <BookProvider
        bookData={bookData}
        authors={authors}
        categories={categories}
        isEditMode={false}
        thumbnailBaseUrl={THUMBNAILS_BASE_URL}
        accessManaged={accessManaged}
        supportEmail={supportEmail}
        callbacks={{
          onAddToCart: handleAddToCart,
          onBuyNow: handleBuyNow,
          onContinueReading: handleContinueReading,
          onShare: () => setShareModalOpen(true),
          hasAccess,
          accessChecked,
          isInCart: resolvedBookId ? isInCart(resolvedBookId) : false,
          preferredCurrency: preferredCurrency === "USD" ? "USD" : preferredCurrency === null ? null : "INR",
          priceParts,
          isBookmarked: resolvedBookId ? isBookmarked(resolvedBookId) : false,
          onBookmarkToggle: (isAuthenticated || guard.easyCheckoutEnabled) ? handleBookmarkToggle : undefined,
          couponSlot: resolvedBookId ? (
            <CouponOffers
              orderType="BOOK"
              itemId={resolvedBookId}
              currency={chargeCurrency ?? preferredCurrency}
              applied={couponResult}
              onApply={(result) => setCouponResult(result)}
              onRemove={() => setCouponResult(null)}
            />
          ) : undefined,
          onCouponApplied: (result) => setCouponResult(result),
          onCouponRemoved: () => setCouponResult(null),
          appliedCoupon: couponResult,
        }}
      >
        <div className="min-h-screen">
          {isArchived && hasAccess && <ArchivedBanner />}
          {renderTemplate()}
        </div>
      </BookProvider>
    </LayoutWrapper>
    <ShareModal
      isOpen={shareModalOpen}
      onClose={() => setShareModalOpen(false)}
      url={`${typeof window !== "undefined" ? window.location.origin : ""}/books/${bookData.slug ?? initialPageConfig.slug?.replace(/^books\/?/, "") ?? ""}`}
      title={bookData.title ?? bookTerm.singular}
      modalTitle="Share this book"
    />
    <EasyCheckoutGuardModal guard={guard} />
    </AvailableRoutesProvider>
  );
}
