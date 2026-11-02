"use client";

import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import type { PublishedBundleListItem } from "@/lib/api/bundles";
import { emptyLayout } from "@/lib/default-layout";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useCart } from "@/lib/hooks/use-cart";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useCurrency, useCurrencyContext } from "@/lib/hooks/use-currency";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import {
  useInfinitePublishedBundles,
  type BundleFilter,
} from "@/lib/hooks/use-infinite-published-bundles";
import { useBookmark } from "@/lib/stores/bookmark-store";
import { THUMBNAILS_BASE_URL } from "@/lib/utils/constants";
import {
  AvailableRoutesProvider,
  BundleCard,
  BundleCardSkeleton,
  useAvailableRoutes,
  useToast,
} from "@open-mtlms/core";
import type { AvailableRoutesResponse, PageConfig, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { getErrorMessage, HIDDEN_PRICE, resolvePrice } from "@open-mtlms/shared";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { Loader2, Package, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface BundlesListingClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
}

function BundlesListingContent({
  layout,
  pageConfig,
}: Omit<BundlesListingClientProps, "availableRoutes">) {
  const router = useRouter();
  const { toast } = useToast();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const { isPathAvailable } = useAvailableRoutes();
  const { isAuthenticated } = useUserAuthStore();
  const guard = useBuyNowGuard();
  const currency = useCurrency();
  const { resolvedCurrency, defaultCurrency, enabledCurrencies } = useCurrencyContext();
  const { accessManaged } = useStorefrontConfig();
  const term = useContentTerm("bundle");

  const [filter, setFilter] = useState<BundleFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const theme: ThemeConfig = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfinitePublishedBundles(undefined, filter);

  const bundles = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.bundles);
  }, [data?.pages]);

  const filteredBundles = useMemo(() => {
    if (!searchQuery.trim()) return bundles;
    const q = searchQuery.toLowerCase();
    return bundles.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.subtitle?.toLowerCase().includes(q) ?? false)
    );
  }, [bundles, searchQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "120px", threshold: 0.1 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleBundleClick = (slug: string) => {
    router.push(`/bundles/${slug}`);
  };

  const handleCartToggle = (bundle: PublishedBundleListItem) => {
    guard.run(() => {
      if (isInCart(bundle.id)) {
        removeFromCart({ item_type: "BUNDLE", item_id: bundle.id });
        toast({ title: "Removed from cart", description: `${bundle.title ?? term.singular} has been removed from your cart.` });
      } else {
        addToCart(
          { item_type: "BUNDLE", item_id: bundle.id },
          {
            onSuccess: () => {
              toast({ title: "Added to cart", description: `${bundle.title ?? term.singular} has been added to your cart.` });
            },
            onError: (err) => {
              toast({ title: "Failed to add", description: getErrorMessage(err), variant: "destructive" });
            },
          }
        );
      }
    });
  };

  const handleBookmarkToggle = (bundle: PublishedBundleListItem) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const wasBookmarked = isBookmarked(bundle.id);
    toggleBookmark({
      productId: bundle.id,
      productType: "bundle",
      title: bundle.title ?? `Untitled ${term.singular}`,
      slug: bundle.slug ?? bundle.id,
      thumbnailUrl: bundle.thumbnailUrl ?? null,
      subtitle: bundle.subtitle,
    });
    toast({
      title: wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
      description: `${bundle.title ?? term.singular} has been ${wasBookmarked ? "removed from" : "added to"} your bookmarks.`,
    });
  };

  const cartAvailable = isPathAvailable("/cart");
  const bookmarkAvailable = isPathAvailable("/bookmark");

  return (
    <LayoutWrapper layout={effectiveLayout} theme={theme}>
      <div>
        {/* Hero header */}
        <div className="relative overflow-hidden bg-gradient-to-b from-muted/50 to-background px-4 pb-2 pt-8 sm:px-6 sm:pt-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1">
              <Package className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">{term.plural}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Save more with curated {term.plural}
            </h1>
            <p className="text-muted-foreground mt-2 mb-6 text-sm sm:mb-8 sm:text-base">
              Courses and books bundled together at a great price
            </p>

            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-sm flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search ${term.plural.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-xl border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "bookmarked"] as const)
                  .filter((f) => f !== "bookmarked" || isAuthenticated)
                  .map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 sm:px-4 ${
                        filter === f
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {f === "all" ? `All ${term.plural}` : "Bookmarked"}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">

        {isError && (
          <div className="border-destructive/50 bg-destructive/10 mb-8 flex flex-col items-center justify-center rounded-lg border py-12">
            <p className="text-destructive text-center text-sm sm:text-base">
              {error instanceof Error ? error.message : `Failed to load ${term.plural.toLowerCase()}. Please try again.`}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="hover:bg-muted mt-4 rounded-md border px-4 py-2 text-sm transition-colors"
            >
              <RefreshCw className="mr-2 inline h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {(isLoading || !currency) && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <BundleCardSkeleton key={i} className="w-full" />
            ))}
          </div>
        )}

        {!isLoading && currency && !isError && filteredBundles.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBundles.map((bundle) => (
              <BundleCard
                key={bundle.id}
                id={bundle.id}
                title={bundle.title}
                slug={bundle.slug}
                subtitle={bundle.subtitle}
                description={bundle.description}
                thumbnailUrl={bundle.thumbnailUrl}
                thumbnailBaseUrl={THUMBNAILS_BASE_URL ?? ""}
                priceInr={bundle.priceInr}
                priceUsd={bundle.priceUsd}
                discountInr={bundle.discountInr}
                discountUsd={bundle.discountUsd}
                purchaseMode={bundle.purchaseMode}
                priceParts={
                  accessManaged
                    ? HIDDEN_PRICE
                    : resolvePrice(
                        {
                          prices:
                            (bundle as { prices?: Record<string, { amount: number; discount?: number | null }> | null })
                              .prices ?? null,
                          legacyInr: bundle.priceInr,
                          legacyUsd: bundle.priceUsd,
                          legacyDiscountInr: bundle.discountInr,
                          legacyDiscountUsd: bundle.discountUsd,
                          purchaseMode: bundle.purchaseMode,
                        },
                        { resolvedCurrency, defaultCurrency, enabledCurrencies }
                      )
                }
                itemCount={bundle.itemCount}
                hasAccess={bundle.has_access}
                onClick={() => handleBundleClick(bundle.slug)}
                currency={currency === "USD" ? "USD" : "INR"}
                variant="grid"
                className="w-full transition-shadow duration-200 hover:shadow-lg"
                showAddToCartIcon={cartAvailable && !accessManaged}
                isInCart={isAuthenticated ? isInCart(bundle.id) : false}
                onAddToCart={cartAvailable && !accessManaged ? () => handleCartToggle(bundle) : undefined}
                showBookmarkIcon={bookmarkAvailable}
                isBookmarked={isAuthenticated ? isBookmarked(bundle.id) : false}
                onBookmarkToggle={
                  bookmarkAvailable ? () => handleBookmarkToggle(bundle) : undefined
                }
              />
            ))}
          </div>
        )}

        {!isLoading && currency && !isError && filteredBundles.length === 0 && (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-2xl border border-border py-12 sm:py-16">
            <Package className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground px-4 text-center text-sm sm:text-base">
              {searchQuery
              ? `No ${term.plural.toLowerCase()} match your search.`
              : filter === "bookmarked"
                ? `No bookmarked ${term.plural.toLowerCase()} yet.`
                : `No ${term.plural.toLowerCase()} available yet.`}
            </p>
          </div>
        )}

        <div ref={loadMoreRef} className="flex min-h-[80px] items-center justify-center py-8">
          {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
        </div>
      </div>
      </div>
      <EasyCheckoutGuardModal guard={guard} />
    </LayoutWrapper>
  );
}

export function BundlesListingClient(props: BundlesListingClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <BundlesListingContent {...rest} />
    </AvailableRoutesProvider>
  );
}
