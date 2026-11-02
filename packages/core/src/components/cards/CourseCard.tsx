"use client";

import * as React from "react";
import { Bookmark, ShoppingCart } from "lucide-react";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { cn } from "../../lib/utils";
import { Card } from "./card-shell";
import { PartOfBundleBadge, type BundleRef } from "./PartOfBundleBadge";
import { priceInfoFromParts, type CardPriceParts } from "./price-parts";

export type CourseCardVariant = "grid" | "list" | "featured";

export interface CourseCardProps {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  duration?: string | null;
  priceInr?: string | null;
  priceUsd?: string | null;
  discountInr?: string | null;
  discountUsd?: string | null;
  purchaseMode?: string;
  mode?: string;
  /** Explicit badge label (e.g. "Bestseller"). Overrides the mode-derived badge. */
  badge?: string;
  /** How the legacy `discount` value is interpreted: "percent" (default) or a flat "amount". */
  discountMode?: "percent" | "amount";
  difficulty?: string;
  language?: string[];
  instructor?: {
    id: string;
    name: string;
    avatar?: string | null;
  } | null;
  /** Optional click handler; defaults to navigating to /course/{slug} */
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
  variant?: CourseCardVariant;
  /** Callback when add-to-cart icon is clicked (PAID courses only) */
  onAddToCart?: () => void;
  /** Show add-to-cart icon button on the card */
  showAddToCartIcon?: boolean;
  /** Callback when bookmark icon is clicked */
  onBookmarkToggle?: () => void;
  /** Show bookmark icon button on the card */
  showBookmarkIcon?: boolean;
  /** Whether the course is bookmarked (fills the bookmark icon) */
  isBookmarked?: boolean;
  /** Whether the course is already in the cart (fills the cart icon) */
  isInCart?: boolean;
  /** Whether the current user already has access to this course */
  hasAccess?: boolean;
  /** Callback when user clicks "Continue Learning" on an owned course */
  onContinue?: () => void;
  /**
   * Progress percentage (0-100). Shown as a bar when showProgress is true, and
   * picks an owner's label (Start, Continue Learning, Completed) when known.
   */
  progressPercent?: number | null;
  /** The tenant's word for a course, used in the owner's label. Default "Course". */
  courseTerm?: string;
  /** Whether to show the progress bar (for enrolled courses). */
  showProgress?: boolean;
  /** Access-managed storefront: hide all price text and purchase affordances. */
  accessManaged?: boolean;
  /** PUBLISHED bundles containing this course, renders a "Part of X" chip. */
  bundles?: BundleRef[];
}

/**
 * Shared CourseCard component for displaying course information.
 * Used in both admin preview and user-facing web portal.
 */
export function CourseCard({
  id,
  title: rawTitle,
  slug,
  subtitle: rawSubtitle,
  description: rawDescription,
  thumbnailUrl,
  duration,
  priceInr,
  priceUsd,
  discountInr,
  discountUsd,
  purchaseMode = "PAID",
  mode = "SELF_PACED",
  badge,
  discountMode = "percent",
  difficulty = "NONE",
  language = ["English"],
  instructor: _instructor,
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
  progressPercent,
  bundles,
  showProgress = false,
  accessManaged = false,
  courseTerm = "Course",
}: CourseCardProps) {
  // Decode HTML entities once so every render site in this component sees clean text.
  const title = decodeHtmlEntities(rawTitle);
  const subtitle = rawSubtitle != null ? decodeHtmlEntities(rawSubtitle) : rawSubtitle;
  const description = rawDescription != null ? decodeHtmlEntities(rawDescription) : rawDescription;
  const showDifficulty = difficulty && difficulty !== "NONE";
  // Fallback placeholder image for courses - education/learning themed
  const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=225&fit=crop&q=80";

  // Build thumbnail URL: use as-is if absolute; else base + key (with slash between)
  const imageUrl = (() => {
    if (!thumbnailUrl?.trim()) return PLACEHOLDER_IMAGE;
    if (
      thumbnailUrl.startsWith("http://") ||
      thumbnailUrl.startsWith("https://") ||
      thumbnailUrl.startsWith("data:")
    ) {
      return thumbnailUrl;
    }
    if (thumbnailBaseUrl?.trim()) {
      const base = thumbnailBaseUrl.replace(/\/$/, "");
      const key = thumbnailUrl.startsWith("/") ? thumbnailUrl.slice(1) : thumbnailUrl;
      return `${base}/${key}`;
    }
    return PLACEHOLDER_IMAGE;
  })();

  // Calculate price display
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
    // Validate: price must be a valid positive number
    if (isNaN(numPrice) || numPrice <= 0) {
      return { display: "FREE", original: null };
    }

    const numDiscount = discount ? parseFloat(discount) : 0;

    // "amount" = flat discount (price minus amount);
    // "percent" = percentage off (0–100), the default for courses/books.
    if (numDiscount > 0) {
      const finalPrice =
        discountMode === "amount"
          ? numPrice - numDiscount
          : numDiscount <= 100
            ? numPrice * (1 - numDiscount / 100)
            : numPrice;
      if (finalPrice > 0 && finalPrice < numPrice) {
        return {
          display: `${symbol}${Math.round(finalPrice)}`,
          original: `${symbol}${Math.round(numPrice)}`,
        };
      }
    }

    return { display: `${symbol}${Math.round(numPrice)}`, original: null };
  };

  // An owner's label follows their progress when the caller knows it, the same
  // wording as the bundle page; unknown progress keeps "Continue Learning".
  const ownedLabel =
    progressPercent == null || !Number.isFinite(progressPercent)
      ? "Continue Learning"
      : progressPercent >= 100
        ? `${courseTerm} Completed`
        : progressPercent <= 0
          ? `Start ${courseTerm}`
          : "Continue Learning";
  const priceInfo = hasAccess ? { display: ownedLabel, original: null } : getPrice();
  const isUnavailable = !hasAccess && !!(priceInfo as { unavailable?: boolean }).unavailable;
  // Access-managed storefront: owners keep the "Continue Learning" indicator;
  // everyone else gets no price text at all (no FREE badge, no discounts).
  // Triggered by the explicit prop or by the HIDDEN_PRICE sentinel in parts.
  const hidePrice =
    (accessManaged || !!(priceInfo as { hidden?: boolean }).hidden) && !hasAccess;

  // Mode badge text, an explicit `badge` wins over the course mode.
  const getModeText = () => {
    if (badge) return badge;
    switch (mode) {
      case "LIVE":
        return "Live";
      case "HYBRID":
        return "Hybrid";
      default:
        return "Self-Paced";
    }
  };

  // Difficulty badge color
  const getDifficultyColor = () => {
    switch (difficulty) {
      case "ADVANCED":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "INTERMEDIATE":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
  };

  const handleClick = () => {
    if (hasAccess && onContinue) {
      onContinue();
      return;
    }
    if (onClick) {
      onClick();
    }
  };

  const showAddToCart =
    !hidePrice &&
    !accessManaged &&
    !hasAccess &&
    purchaseMode === "PAID" &&
    showAddToCartIcon &&
    onAddToCart &&
    !isUnavailable;

  const showBookmark = showBookmarkIcon && onBookmarkToggle;

  const iconBtnBase =
    "absolute z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors backdrop-blur-sm";
  const addToCartBtnClass = cn(
    iconBtnBase,
    "text-foreground hover:text-primary",
    "bg-background/80 hover:bg-background shadow-sm"
  );
  const bookmarkBtnClass = cn(
    iconBtnBase,
    "text-foreground hover:text-primary",
    "bg-background/80 hover:bg-background shadow-sm"
  );

  const addToCartButton = showAddToCart ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAddToCart?.();
      }}
      className={cn(
        addToCartBtnClass,
        variant === "featured" ? "right-2 bottom-2" : "right-2 top-2"
      )}
      aria-label={isInCart ? "Remove from cart" : "Add to cart"}
    >
      <ShoppingCart className={cn("h-4 w-4", isInCart && "fill-current")} />
    </button>
  ) : null;

  const bookmarkButton = showBookmark ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onBookmarkToggle?.();
      }}
      className={cn(
        bookmarkBtnClass,
        variant === "featured" ? "right-2 top-2" : showAddToCart ? "right-12 top-2" : "right-2 top-2"
      )}
      aria-label={isBookmarked ? "Remove from bookmarks" : "Add to bookmarks"}
    >
      <Bookmark className={cn("h-4 w-4", isBookmarked && "fill-current")} />
    </button>
  ) : null;

  // List variant - horizontal card layout
  if (variant === "list") {
    return (
      <Card
        className={cn(
          "group relative flex overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer w-full max-w-2xl",
          className
        )}
        onClick={handleClick}
      >
        {/* Thumbnail */}
        <div className="relative h-[140px] w-[200px] shrink-0 overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
            }}
          />
        {/* Mode badge */}
        <div className="absolute left-2 top-2">
          <span className="rounded bg-primary/90 px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {getModeText()}
          </span>
        </div>
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
            {(subtitle || description) && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {subtitle || description}
              </p>
            )}

            {/* Metadata row */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {showDifficulty && (
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", getDifficultyColor())}>
                  {difficulty!.charAt(0) + difficulty!.slice(1).toLowerCase()}
                </span>
              )}
              {duration && <span className="text-xs text-muted-foreground">{duration}</span>}
            </div>
          </div>

          {/* Price */}
          {!hidePrice && (
            <div className="mt-2 flex items-center gap-2">
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
      </Card>
    );
  }

  // Featured variant - larger card with more emphasis
  if (variant === "featured") {
    return (
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer w-[340px]",
          className
        )}
        onClick={handleClick}
      >
        {/* Thumbnail */}
        <div className="relative h-[200px] overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {/* Mode badge */}
          <div className="absolute left-3 top-3">
            <span className="rounded bg-primary/90 px-2.5 py-1 text-xs font-medium text-primary-foreground">
              {getModeText()}
            </span>
          </div>
          {/* Featured badge */}
          <div className="absolute right-3 top-3">
            <span className="rounded bg-yellow-500/90 px-2.5 py-1 text-xs font-semibold text-yellow-900">
              Featured
            </span>
          </div>
          {bookmarkButton}
          {addToCartButton}
          {/* Title overlay */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="line-clamp-2 text-lg font-bold text-white">{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col p-4">
          {/* Description */}
          {(subtitle || description) && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {subtitle || description}
            </p>
          )}

          {/* Metadata and Price row */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-2">
              {showDifficulty && (
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", getDifficultyColor())}>
                  {difficulty!.charAt(0) + difficulty!.slice(1).toLowerCase()}
                </span>
              )}
              {duration && <span className="text-xs text-muted-foreground">{duration}</span>}
            </div>
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

  // Default grid variant
  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer",
        compact ? "w-[200px]" : "w-[280px]",
        className
      )}
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className={cn("relative overflow-hidden bg-muted", compact ? "h-[130px]" : "h-[160px]")}>
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
          }}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="absolute bottom-3 left-3 right-3">
            <p className="line-clamp-2 text-sm font-medium text-white">{title}</p>
          </div>
        </div>
        {/* Mode badge */}
        <div className="absolute left-2 top-2">
          <span className="rounded bg-primary/90 px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {getModeText()}
          </span>
        </div>
        {/* Part-of-bundle, bottom left, clear of the mode badge above and the
            bookmark / cart buttons on the right. */}
        {bundles && bundles.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <PartOfBundleBadge bundles={bundles} onImage />
          </div>
        )}
        {bookmarkButton}
        {addToCartButton}
      </div>

      {/* Content */}
      <div className={cn("flex flex-1 flex-col", compact ? "p-3" : "p-4")}>
        {/* Title */}
        <h3
          className={cn(
            "line-clamp-2 font-semibold text-foreground",
            compact ? "text-sm" : "text-base"
          )}
        >
          {title}
        </h3>

        {/* Subtitle or description */}
        {!compact && (subtitle || description) && (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {subtitle || description}
          </p>
        )}

        {/* Metadata row */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {showDifficulty && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                getDifficultyColor()
              )}
            >
              {difficulty!.charAt(0) + difficulty!.slice(1).toLowerCase()}
            </span>
          )}
          {/* Duration */}
          {duration && (
            <span className="text-xs text-muted-foreground">{duration}</span>
          )}
        </div>

        {/* Progress bar (for enrolled courses) */}
        {showProgress && progressPercent != null && (
          <div className="mt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Progress</span>
              <span className="text-xs font-medium text-foreground">
                {Math.min(100, Math.max(0, progressPercent))}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progressPercent >= 100 ? "bg-green-500" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        )}

        {/* Price, pinned to the bottom so every card aligns regardless of how
            much title/description text it has (uniform card heights). */}
        {!hidePrice && (
          <div className="mt-auto flex items-center gap-2 pt-3">
            <span
              className={cn(
                "font-semibold",
                hasAccess || priceInfo.display === "FREE"
                  ? "text-green-600 dark:text-green-400"
                  : "text-foreground",
                compact ? "text-sm" : "text-base",
                isUnavailable && "text-muted-foreground text-xs font-normal"
              )}
            >
              {priceInfo.display}
            </span>
            {priceInfo.original && (
              <span className="text-xs text-muted-foreground line-through">
                {priceInfo.original}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Skeleton loader for CourseCard
 */
export function CourseCardSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden animate-pulse",
        compact ? "w-[200px]" : "w-[280px]",
        className
      )}
    >
      <div className={cn("bg-muted", compact ? "h-[130px]" : "h-[160px]")} />
      <div className={cn("flex flex-col", compact ? "p-3" : "p-4")}>
        <div className="h-5 w-3/4 rounded bg-muted" />
        {!compact && <div className="mt-2 h-4 w-full rounded bg-muted" />}
        <div className="mt-2 flex gap-2">
          <div className="h-5 w-16 rounded bg-muted" />
          <div className="h-5 w-12 rounded bg-muted" />
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <div className="h-6 w-6 rounded-full bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="mt-3 h-5 w-16 rounded bg-muted" />
      </div>
    </Card>
  );
}
