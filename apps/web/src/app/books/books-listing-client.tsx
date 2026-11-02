"use client";

import { useCart } from "@/lib/hooks/use-cart";
import { useCurrency, useCurrencyContext } from "@/lib/hooks/use-currency";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useBookmark } from "@/lib/stores/bookmark-store";
import { THUMBNAILS_BASE_URL } from "@/lib/utils/constants";
import {
  AvailableRoutesProvider,
  BookCard,
  BookCardSkeleton,
  useAvailableRoutes,
  useToast,
} from "@open-mtlms/core";
import type { AvailableRoutesResponse, PageConfig, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { getErrorMessage, HIDDEN_PRICE, resolvePrice } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { BookOpen, Loader2, RefreshCw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for manual refetch or future use
import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { type PublishedBookListItem } from "@/lib/api/books";
import { emptyLayout } from "@/lib/default-layout";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import {
  useInfinitePublishedBooks,
  type BookFilter,
} from "@/lib/hooks/use-infinite-published-books";
import { useUserAuthStore } from "@/lib/stores/auth-store";

interface BooksListingClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
}

function BooksListingContent({
  layout,
  pageConfig,
}: Omit<BooksListingClientProps, "availableRoutes">) {
  const router = useRouter();
  // This listing has no coupon UI of its own, but a shared link can carry one
  // (/books?coupon=CODE). Relay it so the code survives into checkout, private
  // coupons are never listed there, so an unforwarded code is simply lost.
  const searchParams = useSearchParams();
  const urlCoupon = searchParams.get("coupon");
  const bookTerm = useContentTerm("book");
  const { toast } = useToast();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const { isPathAvailable } = useAvailableRoutes();
  const { isAuthenticated } = useUserAuthStore();
  const currency = useCurrency();
  const { resolvedCurrency, defaultCurrency, enabledCurrencies } = useCurrencyContext();
  const { accessManaged } = useStorefrontConfig();
  const guard = useBuyNowGuard();

  const [filter, setFilter] = useState<BookFilter>("all");
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
  } = useInfinitePublishedBooks(filter);

  const books = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.books);
  }, [data?.pages]);

  const filteredBooks = useMemo(() => {
    let result = books;
    // When on bookmarked tab, filter by live bookmark state for instant removal
    if (filter === "bookmarked") {
      result = result.filter((b) => isBookmarked(b.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.author?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [books, searchQuery, filter, isBookmarked]);

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

  const handleBookClick = (slug: string) => {
    router.push(`/books/${slug}`);
  };

  const handleCartToggle = (book: PublishedBookListItem) => {
    guard.run(() => {
      if (isInCart(book.id)) {
        removeFromCart({ item_type: "BOOK", item_id: book.id });
        toast({ title: "Removed from cart", description: `${book.title ?? bookTerm.singular} has been removed from your cart.` });
      } else {
        addToCart(
          { item_type: "BOOK", item_id: book.id },
          {
            onSuccess: () => {
              toast({ title: "Added to cart", description: `${book.title ?? bookTerm.singular} has been added to your cart.` });
            },
            onError: (err) => {
              toast({ title: "Failed to add", description: getErrorMessage(err), variant: "destructive" });
            },
          }
        );
      }
    });
  };

  const handleBuyNow = (book: PublishedBookListItem) => {
    guard.run(
      () => {
        const params = new URLSearchParams({ type: "BOOK", id: book.id });
        if (urlCoupon) params.set("coupon", urlCoupon);
        window.location.href = `/checkout/direct?${params.toString()}`;
      },
      `/books/${book.slug}`
    );
  };

  const handleBookmarkToggle = (book: PublishedBookListItem) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const wasBookmarked = isBookmarked(book.id);
    toggleBookmark({
      productId: book.id,
      productType: "book",
      title: book.title ?? `Untitled ${bookTerm.singular}`,
      slug: book.slug ?? book.id,
      thumbnailUrl: book.thumbnailUrl ?? null,
    });
    toast({
      title: wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
      description: `${book.title ?? "Book"} has been ${wasBookmarked ? "removed from" : "added to"} your bookmarks.`,
    });
  };

  const cartAvailable = isPathAvailable("/cart");
  const bookmarkAvailable = isPathAvailable("/bookmark");

  return (
    <LayoutWrapper layout={effectiveLayout} theme={theme}>
      <div className="container-custom section-padding scroll-smooth">
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{bookTerm.plural}</h1>
        <p className="text-muted-foreground mb-6 text-sm sm:mb-8 sm:text-base">
          Browse our collection of {bookTerm.plural.toLowerCase()}
        </p>

        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${bookTerm.plural.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-md border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "all" as const, label: `All ${bookTerm.plural}` },
                { value: "FREE" as const, label: `Free ${bookTerm.plural}` },
                { value: "PAID" as const, label: `Paid ${bookTerm.plural}` },
                { value: "bookmarked" as const, label: "Bookmarked", authOnly: true },
              ] as const
            )
              .filter((f) => !(("authOnly" in f && f.authOnly) && !isAuthenticated))
              .map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 sm:px-4 ${
                    filter === f.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
          </div>
        </div>

        {isError && (
          <div className="border-destructive/50 bg-destructive/10 mb-8 flex flex-col items-center justify-center rounded-lg border py-12">
            <p className="text-destructive text-center text-sm sm:text-base">
              {error instanceof Error ? error.message : `Failed to load ${bookTerm.plural.toLowerCase()}. Please try again.`}
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
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <BookCardSkeleton key={i} className="w-full" />
            ))}
          </div>
        )}

        {!isLoading && currency && !isError && filteredBooks.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredBooks.map((book) => {
              const owned = book.has_access === true;
              return (
                <BookCard
                  key={book.id}
                  id={book.id}
                  title={book.title}
                  slug={book.slug}
                  description={book.description}
                  thumbnailUrl={book.thumbnailUrl}
                  thumbnailBaseUrl={THUMBNAILS_BASE_URL ?? ""}
                  pages={book.pages}
                  priceInr={book.priceInr}
                  priceUsd={book.priceUsd}
                  discountInr={book.discountInr}
                  discountUsd={book.discountUsd}
                  purchaseMode={book.purchaseMode}
                  language={book.language}
                  author={book.author}
                  authors={book.authors}
                  bundles={book.bundles}
                  onClick={() => handleBookClick(book.slug)}
                  currency={currency === "USD" ? "USD" : "INR"}
                  priceParts={
                    accessManaged
                      ? HIDDEN_PRICE
                      : resolvePrice(
                          {
                            prices:
                              (book as { prices?: Record<string, { amount: number; discount?: number | null }> | null })
                                .prices ?? null,
                            legacyInr: book.priceInr,
                            legacyUsd: book.priceUsd,
                            legacyDiscountInr: book.discountInr,
                            legacyDiscountUsd: book.discountUsd,
                            purchaseMode: book.purchaseMode,
                          },
                          { resolvedCurrency, defaultCurrency, enabledCurrencies }
                        )
                  }
                  variant="grid"
                  className="w-full"
                  hasAccess={owned}
                  onContinue={owned ? () => router.push(`/book-reader/${book.slug}`) : undefined}
                  showAddToCartIcon={!owned && cartAvailable && !accessManaged}
                  isInCart={isAuthenticated ? isInCart(book.id) : false}
                  onAddToCart={!owned && cartAvailable && !accessManaged ? () => handleCartToggle(book) : undefined}
                  onBuyNow={!owned && !accessManaged ? () => handleBuyNow(book) : undefined}
                  showBookmarkIcon={bookmarkAvailable}
                  isBookmarked={isAuthenticated ? isBookmarked(book.id) : false}
                  onBookmarkToggle={
                    bookmarkAvailable ? () => handleBookmarkToggle(book) : undefined
                  }
                />
              );
            })}
          </div>
        )}

        {!isLoading && currency && !isError && filteredBooks.length === 0 && (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-12 sm:py-16">
            <BookOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground px-4 text-center text-sm sm:text-base">
              {searchQuery
                ? `No ${bookTerm.plural.toLowerCase()} match your search.`
                : filter === "bookmarked"
                  ? `No bookmarked ${bookTerm.plural.toLowerCase()} yet.`
                  : filter === "all"
                    ? `No ${bookTerm.plural.toLowerCase()} available yet.`
                    : `No ${filter === "FREE" ? "free" : "paid"} ${bookTerm.plural.toLowerCase()}.`}
            </p>
          </div>
        )}

        <div ref={loadMoreRef} className="flex min-h-[80px] items-center justify-center py-8">
          {isFetchingNextPage && <Loader2 className="text-primary h-6 w-6 animate-spin" />}
        </div>
      </div>
      <EasyCheckoutGuardModal guard={guard} />
    </LayoutWrapper>
  );
}

export function BooksListingClient(props: BooksListingClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <BooksListingContent {...rest} />
    </AvailableRoutesProvider>
  );
}
