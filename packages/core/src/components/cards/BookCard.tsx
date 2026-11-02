"use client";

import * as React from "react";
import { Bookmark, ShoppingCart } from "lucide-react";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { cn } from "../../lib/utils";
import { PartOfBundleBadge, type BundleRef } from "./PartOfBundleBadge";
import { Card } from "./card-shell";
import { priceInfoFromParts, type CardPriceParts } from "./price-parts";

export type BookCardVariant = "grid" | "list" | "featured";

export interface BookCardProps {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  pages?: number | null;
  priceInr?: string | null;
  priceUsd?: string | null;
  discountInr?: string | null;
  discountUsd?: string | null;
  purchaseMode?: string;
  language?: string[];
  /** Legacy author field (string) */
  author?: string | null;
  /** New authors field (array from book_authors) */
  authors?: { id: string; name: string }[];
  /** Optional click handler; defaults to navigating to /book/{slug} */
  onClick?: () => void;
  /** Base URL for thumbnails (used when thumbnailUrl is a key, not full URL) */
  thumbnailBaseUrl?: string;
  /** Currency preference: "INR" or "USD" */
  currency?: "INR" | "USD";
  /** Pre-resolved multi-currency price parts; rendered preferentially over priceInr/priceUsd. */
  priceParts?: CardPriceParts | null;
  /** Optional className for the card container */
  className?: string;
  /** Render in compact mode (smaller card) */
  compact?: boolean;
  /** Card display variant: grid (default), list, or featured */
  variant?: BookCardVariant;
  /** Callback when add-to-cart icon is clicked (FREE and PAID books) */
  onAddToCart?: () => void;
  /** Show add-to-cart icon button on the card */
  showAddToCartIcon?: boolean;
  /** Callback when bookmark icon is clicked */
  onBookmarkToggle?: () => void;
  /** Show bookmark icon button on the card */
  showBookmarkIcon?: boolean;
  /** Whether the book is bookmarked (fills the bookmark icon) */
  isBookmarked?: boolean;
  /** Whether the book is already in the cart (fills the cart icon) */
  isInCart?: boolean;
  /** Whether the current user already has access to this book */
  hasAccess?: boolean;
  /** Callback when user clicks "Continue Reading" on an owned book */
  onContinue?: () => void;
  /** Callback when user clicks "Buy Now", redirects to checkout instead of adding to cart */
  onBuyNow?: () => void;
  /** Access-managed storefront: hide all price text and purchase affordances. */
  accessManaged?: boolean;
  /** PUBLISHED bundles containing this book, renders a "Part of X" chip. */
  bundles?: BundleRef[];
}

/**
 * Shared BookCard component for displaying book information.
 * Used in both admin preview and user-facing web portal.
 */
export function BookCard({
  id,
  title: rawTitle,
  slug,
  description: rawDescription,
  thumbnailUrl,
  pages,
  priceInr,
  priceUsd,
  discountInr,
  discountUsd,
  purchaseMode = "PAID",
  language = ["English"],
  author: _author,
  authors: _authors = [],
  onClick,
  thumbnailBaseUrl = "",
  currency = "INR",
  priceParts,
  className,
  compact = false,
  variant = "grid",
  onAddToCart,
  showAddToCartIcon = false,
  onBookmarkToggle,
  showBookmarkIcon = false,
  isBookmarked = false,
  isInCart = false,
  hasAccess = false,
  onContinue,
  onBuyNow,
  accessManaged = false,
  bundles,
}: BookCardProps) {
  // Decode HTML entities once so every render site in this component sees clean text.
  const title = decodeHtmlEntities(rawTitle);
  const description = rawDescription != null ? decodeHtmlEntities(rawDescription) : rawDescription;
  // Build thumbnail URL: use as-is if absolute; else base + key (with slash between)
  const imageUrl = (() => {
    if (!thumbnailUrl?.trim()) return "/images/book-placeholder.svg";
    if (thumbnailUrl.startsWith("http://") || thumbnailUrl.startsWith("https://") || thumbnailUrl.startsWith("data:")) {
      return thumbnailUrl;
    }
    if (thumbnailBaseUrl?.trim()) {
      const base = thumbnailBaseUrl.replace(/\/$/, "");
      const key = thumbnailUrl.startsWith("/") ? thumbnailUrl.slice(1) : thumbnailUrl;
      return `${base}/${key}`;
    }
    return "/images/book-placeholder.svg";
  })();

  // Calculate price display (discount is percentage 0–100)
  const getPrice = () => {
    // Resolved multi-currency parts from the caller win over legacy INR/USD math.
    if (priceParts) return priceInfoFromParts(priceParts);

    const price = currency === "INR" ? priceInr : priceUsd;
    const discount = currency === "INR" ? discountInr : discountUsd;
    const symbol = currency === "INR" ? "₹" : "$";

    if (purchaseMode === "FREE" || !price) {
      return { display: "FREE", original: null };
    }

    const numPrice = parseFloat(price);
    const numDiscount = discount ? parseFloat(discount) : 0;

    if (numDiscount > 0 && numDiscount <= 100) {
      const finalPrice = numPrice * (1 - numDiscount / 100);
      return {
        display: `${symbol}${Math.round(finalPrice)}`,
        original: `${symbol}${Math.round(numPrice)}`,
      };
    }

    return { display: `${symbol}${Math.round(numPrice)}`, original: null };
  };

  const priceInfo = hasAccess ? { display: "Continue Reading", original: null } : getPrice();
  const isUnavailable = !hasAccess && !!(priceInfo as { unavailable?: boolean }).unavailable;
  // Access-managed storefront: owners keep the "Continue Reading" indicator;
  // everyone else gets no price text at all (no FREE badge, no discounts).
  // Triggered by the explicit prop or by the HIDDEN_PRICE sentinel in parts.
  const hidePrice =
    (accessManaged || !!(priceInfo as { hidden?: boolean }).hidden) && !hasAccess;

  const handleClick = () => {
    if (onClick) onClick();
  };

  const showAddToCart =
    !hidePrice && !accessManaged && !hasAccess && showAddToCartIcon && onAddToCart && !isUnavailable;
  const showBookmark = showBookmarkIcon && onBookmarkToggle;

  const iconBtnBase =
    "flex shrink-0 items-center justify-center rounded-full transition-colors";
  const addToCartBtnClass = cn(
    iconBtnBase,
    "text-foreground/90 hover:text-primary bg-background/80 hover:bg-background",
    variant === "list" && "absolute right-1 top-1 z-10 h-6 w-6",
    (variant === "grid" || variant === "featured") && "h-8 w-8"
  );
  const bookmarkBtnClass = cn(
    iconBtnBase,
    "text-foreground/90 hover:text-primary bg-background/80 hover:bg-background",
    variant === "list" && "absolute z-10 h-6 w-6",
    variant === "list" && (showAddToCart ? "right-8 top-1" : "right-1 top-1"),
    (variant === "grid" || variant === "featured") && "h-8 w-8"
  );

  const addToCartButton = showAddToCart ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAddToCart?.();
      }}
      className={addToCartBtnClass}
      aria-label={isInCart ? "Remove from cart" : "Add to cart"}
    >
      <ShoppingCart className={cn(variant === "list" ? "h-3 w-3" : "h-4 w-4", isInCart && "fill-current")} />
    </button>
  ) : null;

  const bookmarkButton = showBookmark ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onBookmarkToggle?.();
      }}
      className={bookmarkBtnClass}
      aria-label={isBookmarked ? "Remove from bookmarks" : "Add to bookmarks"}
    >
      <Bookmark
        className={cn(
          variant === "list" ? "h-3 w-3" : "h-4 w-4",
          isBookmarked && "fill-current"
        )}
      />
    </button>
  ) : null;

  // Pages icon SVG
  const PagesIcon = ({ className: iconClassName }: { className?: string }) => (
    <svg
      className={iconClassName}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );

  // List variant - horizontal card layout
  if (variant === "list") {
    return (
      <Card
        className={cn(
          "group relative flex overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer w-full max-w-xl",
          className
        )}
        onClick={handleClick}
      >
        {/* Book Cover */}
        <div className="relative h-[160px] w-[110px] shrink-0 overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/book-placeholder.svg";
            }}
          />
          {purchaseMode === "FREE" && !hasAccess && !accessManaged && (
            <div className="absolute left-1 top-1 z-10">
              <span className="rounded bg-green-500/90 px-1.5 py-0.5 text-xs font-medium text-white">
                FREE
              </span>
            </div>
          )}
          {bookmarkButton}
          {addToCartButton}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between p-4">
          <div>
            {/* Title */}
            <h3 className="line-clamp-1 text-base font-semibold text-foreground">
              {title}
            </h3>

            {/* Description */}
            {description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {/* Metadata and Price row */}
          <div className="mt-2 flex items-center justify-between">
            {pages && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <PagesIcon className="h-4 w-4" />
                <span className="text-xs">{pages} pages</span>
              </div>
            )}
            {!hidePrice && (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-semibold",
                    hasAccess || priceInfo.display === "FREE" ? "text-green-600 dark:text-green-400" : "text-foreground",
                    isUnavailable && "text-muted-foreground text-xs font-normal"
                  )}
                >
                  {priceInfo.display}
                </span>
                {priceInfo.original && (
                  <span className="text-xs text-muted-foreground line-through">{priceInfo.original}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Featured variant - larger card with more emphasis
  if (variant === "featured") {
    return (
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer w-[260px]",
          className
        )}
        onClick={handleClick}
      >
        {/* Book Cover - Larger for featured */}
        <div className="relative h-[360px] overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/book-placeholder.svg";
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {/* Featured badge */}
          <div className="absolute left-3 top-3">
            <span className="rounded bg-yellow-500/90 px-2.5 py-1 text-xs font-semibold text-yellow-900">
              Featured
            </span>
          </div>
          {/* Right side: FREE badge + action icons in one row; bookmark on far right when cart absent */}
          {((purchaseMode === "FREE" && !hasAccess && !accessManaged) || showBookmark || showAddToCart) && (
            <div
              className={cn(
                "absolute right-3 top-3 z-10 flex flex-row items-center gap-1.5",
                showBookmark && !showAddToCart && "justify-end"
              )}
            >
              {purchaseMode === "FREE" && !hasAccess && !accessManaged && (
                <span className="rounded bg-green-500/90 px-2 py-1 text-xs font-medium text-white">
                  FREE
                </span>
              )}
              {bookmarkButton}
              {addToCartButton}
            </div>
          )}
          {/* Title overlay */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="line-clamp-2 text-lg font-bold text-white">{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col p-4">
          {/* Description */}
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}

          {/* Metadata and Price row */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            {pages && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <PagesIcon className="h-4 w-4" />
                <span className="text-xs">{pages} pages</span>
              </div>
            )}
            {!hidePrice && (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-lg font-bold",
                    hasAccess || priceInfo.display === "FREE" ? "text-green-600 dark:text-green-400" : "text-foreground",
                    isUnavailable && "text-muted-foreground text-sm font-normal"
                  )}
                >
                  {priceInfo.display}
                </span>
                {priceInfo.original && (
                  <span className="text-sm text-muted-foreground line-through">{priceInfo.original}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Default grid variant, bordered card + fixed meta heights so rows align in catalog grids
  const pagesLabel =
    typeof pages === "number" && pages > 0 ? `${pages} pages` : "\u00a0";

  return (
    <Card
      className={cn(
        "group relative flex h-full w-full flex-col cursor-pointer p-4 transition-shadow hover:shadow-md",
        className
      )}
      onClick={handleClick}
    >
      {/* Book cover with 3D shadow effect */}
      <div className="relative mx-auto w-[85%] shrink-0">
        {/* Spine shadow */}
        <div className="absolute -left-1 top-2 bottom-2 w-2 rounded-l-sm bg-black/20 blur-[2px] dark:bg-black/40" />
        {/* Book image */}
        <div
          className="relative overflow-hidden rounded-md shadow-[4px_4px_16px_rgba(0,0,0,0.25)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[4px_8px_24px_rgba(0,0,0,0.35)]"
          style={{ aspectRatio: "2/3" }}
        >
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/book-placeholder.svg";
            }}
          />
          {/* Subtle shine overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Action icons */}
          {(showBookmark || showAddToCart) && (
            <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {bookmarkButton}
              {addToCartButton}
            </div>
          )}

        </div>
      </div>

      {/* Info below the book, min-heights keep price row aligned across siblings */}
      <div className="mx-auto mt-4 flex min-h-0 w-[85%] flex-1 flex-col">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1 min-h-[1.25rem] line-clamp-1 text-xs text-muted-foreground">{pagesLabel}</p>

        {/* Part-of-bundle sits in the flow, NOT overlaid on the cover: a book
            cover is portrait and only 85% of an already-narrow card, so a
            chip pinned there clips the bundle name ("Part of Web Devel…").
            and the name is the entire point. The reserved min-height keeps
            price rows aligned across sibling cards whether or not a book is
            bundled. */}
        <div className="mt-1.5 min-h-[1.5rem]">
          {bundles && bundles.length > 0 && (
            <PartOfBundleBadge bundles={bundles} />
          )}
        </div>

        {/* Price / Access, pinned to bottom of card */}
        <div className="mt-auto border-t border-border/60 pt-3">
          {hasAccess ? (
            <button
              type="button"
              className="w-full rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              onClick={(e) => {
                e.stopPropagation();
                onContinue?.();
              }}
            >
              Continue Reading →
            </button>
          ) : hidePrice ? (
            // Access-managed storefront: no price, no buy CTA, keep the row
            // height so sibling cards stay aligned.
            <div className="min-h-[2.25rem]" />
          ) : (
            <div className="flex min-h-[2.25rem] items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span
                  className={cn(
                    "text-base font-bold",
                    priceInfo.display === "FREE"
                      ? "text-green-600 dark:text-green-400"
                      : "text-foreground",
                    isUnavailable && "text-muted-foreground text-xs font-normal"
                  )}
                >
                  {priceInfo.display}
                </span>
                {priceInfo.original && (
                  <span className="text-[11px] text-muted-foreground line-through">
                    {priceInfo.original}
                  </span>
                )}
              </div>
              {!isUnavailable && (
                <button
                  type="button"
                  className="shrink-0 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (purchaseMode === "FREE") {
                      onClick?.();
                    } else if (onBuyNow) {
                      onBuyNow();
                    } else if (onAddToCart) {
                      onAddToCart();
                    } else {
                      onClick?.();
                    }
                  }}
                >
                  {purchaseMode === "FREE" ? "Get Free" : "Buy Now"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Skeleton loader for BookCard
 */
export function BookCardSkeleton({
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("flex h-full w-full flex-col p-4 animate-pulse", className)}>
      <div className="mx-auto w-[85%] shrink-0">
        <div className="rounded-md bg-muted shadow-md" style={{ aspectRatio: "2/3" }} />
      </div>
      <div className="mx-auto mt-4 flex min-h-0 w-[85%] flex-1 flex-col">
        <div className="min-h-[2.5rem] space-y-2">
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
        <div className="mt-1 min-h-[1.25rem]">
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
        <div className="mt-auto border-t border-border/60 pt-3">
          <div className="flex min-h-[2.25rem] items-center justify-between gap-2">
            <div className="h-5 w-12 rounded bg-muted" />
            <div className="h-7 w-16 shrink-0 rounded-md bg-muted" />
          </div>
        </div>
      </div>
    </Card>
  );
}
