"use client";

import * as React from "react";
import { Bookmark, Layers, ShoppingCart } from "lucide-react";
import { cn } from "../../lib/utils";
import { priceInfoFromParts, type CardPriceParts } from "./price-parts";

export type BundleCardVariant = "grid" | "list";

export interface BundleCardProps {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  priceInr?: string | null;
  priceUsd?: string | null;
  discountInr?: string | null;
  discountUsd?: string | null;
  purchaseMode?: string;
  itemCount?: number;
  onClick?: () => void;
  thumbnailBaseUrl?: string;
  currency?: "INR" | "USD";
  /** Pre-resolved multi-currency price parts; rendered preferentially over priceInr/priceUsd. */
  priceParts?: CardPriceParts | null;
  className?: string;
  variant?: BundleCardVariant;
  onAddToCart?: () => void;
  showAddToCartIcon?: boolean;
  onBookmarkToggle?: () => void;
  showBookmarkIcon?: boolean;
  isBookmarked?: boolean;
  isInCart?: boolean;
  hasAccess?: boolean;
  onContinue?: () => void;
  /** Access-managed storefront: hide all price text and purchase affordances. */
  accessManaged?: boolean;
}

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=225&fit=crop&q=80";

export function BundleCard({
  title,
  subtitle,
  thumbnailUrl,
  priceInr,
  priceUsd,
  discountInr,
  discountUsd,
  purchaseMode,
  itemCount = 0,
  onClick,
  thumbnailBaseUrl = "",
  currency = "INR",
  priceParts,
  className,
  variant = "grid",
  onAddToCart,
  showAddToCartIcon = false,
  onBookmarkToggle,
  showBookmarkIcon = false,
  isBookmarked = false,
  isInCart = false,
  hasAccess = false,
  onContinue,
  accessManaged = false,
}: BundleCardProps) {
  const imageUrl = (() => {
    if (!thumbnailUrl?.trim()) return PLACEHOLDER_IMAGE;
    if (
      thumbnailUrl.startsWith("http://") ||
      thumbnailUrl.startsWith("https://") ||
      thumbnailUrl.startsWith("data:")
    )
      return thumbnailUrl;
    if (thumbnailBaseUrl?.trim()) {
      const base = thumbnailBaseUrl.replace(/\/$/, "");
      const key = thumbnailUrl.startsWith("/") ? thumbnailUrl.slice(1) : thumbnailUrl;
      return `${base}/${key}`;
    }
    return PLACEHOLDER_IMAGE;
  })();

  const getPrice = () => {
    // Resolved multi-currency parts from the caller win over legacy INR/USD math.
    if (priceParts) {
      const info = priceInfoFromParts(priceParts);
      const off =
        !priceParts.unavailable && priceParts.hasDiscount && priceParts.original > 0
          ? Math.round((1 - priceParts.amount / priceParts.original) * 100)
          : 0;
      // Label the saving the way the admin entered it: "₹100 OFF" for a flat
      // discount, "10% OFF" for a percentage. A flat discount shown as a
      // percentage drifts every time the price is edited.
      const saved =
        !priceParts.unavailable && priceParts.hasDiscount
          ? Math.max(0, priceParts.original - priceParts.amount)
          : 0;
      const offLabel =
        saved > 0 && !priceParts.unavailable && priceParts.discountType === "FLAT"
          ? `${priceParts.symbol}${Math.round(saved).toLocaleString()} OFF`
          : off > 0
            ? `${off}% OFF`
            : null;
      return { ...info, off, offLabel };
    }

    if (purchaseMode === "FREE") return { display: "Free", original: null, off: 0, offLabel: null };
    const price = currency === "INR" ? priceInr : priceUsd;
    const discount = currency === "INR" ? discountInr : discountUsd;
    const sym = currency === "INR" ? "₹" : "$";
    if (!price) return { display: "Contact for price", original: null, off: 0, offLabel: null };
    const n = parseFloat(price);
    if (isNaN(n) || n <= 0) return { display: "Contact for price", original: null, off: 0, offLabel: null };
    const d = discount ? parseFloat(discount) : 0;
    if (d > 0 && d <= 100) {
      return {
        display: `${sym}${Math.round(n * (1 - d / 100))}`,
        original: `${sym}${Math.round(n)}`,
        off: Math.round(d),
        // Legacy columns are always a percentage.
        offLabel: `${Math.round(d)}% OFF`,
      };
    }
    return { display: `${sym}${Math.round(n)}`, original: null, off: 0, offLabel: null };
  };

  const p = hasAccess ? { display: "Owned", original: null, off: 0, offLabel: null } : getPrice();
  const isUnavailable = !hasAccess && !!(p as { unavailable?: boolean }).unavailable;
  // Access-managed storefront: owners keep the "Owned" indicator; everyone
  // else gets no price text at all (no discounts, no "Contact for price").
  // Triggered by the explicit prop or by the HIDDEN_PRICE sentinel in parts.
  const hidePrice =
    (accessManaged || !!(p as { hidden?: boolean }).hidden) && !hasAccess;

  const handleClick = () => {
    if (hasAccess && onContinue) {
      onContinue();
      return;
    }
    onClick?.();
  };

  // ── List variant ──
  if (variant === "list") {
    return (
      <div
        className={cn(
          "border-border bg-card group relative flex w-full max-w-xl cursor-pointer overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-lg",
          className
        )}
        onClick={handleClick}
      >
        <div className="bg-muted relative h-[140px] w-[180px] shrink-0 overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
            }}
          />
        </div>
        <div className="flex flex-1 flex-col justify-between p-4">
          <div>
            <h3 className="text-foreground line-clamp-1 text-base font-semibold">{title}</h3>
            {subtitle && (
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">{subtitle}</p>
            )}
          </div>
          {!hidePrice && (
            <div className="mt-2 flex items-center gap-2">
              {p.original && (
                <span className="text-muted-foreground text-sm line-through">{p.original}</span>
              )}
              <span
                className={cn(
                  "text-foreground font-semibold",
                  isUnavailable && "text-muted-foreground text-xs font-normal"
                )}
              >
                {p.display}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Grid variant: Stacked bundle card ──
  return (
    <div className={cn("group relative cursor-pointer pt-5", className)} onClick={handleClick}>
      {/* Stacked layers behind, visible depth with rotation and offset */}
      <div className="border-border bg-muted dark:border-border dark:bg-muted absolute inset-x-4 bottom-[10px] top-0 rotate-[1.5deg] rounded-xl border shadow-sm transition-transform duration-300 group-hover:rotate-[2.5deg]" />
      <div className="border-border bg-muted/30 dark:border-border dark:bg-muted/60 absolute inset-x-2 bottom-[5px] top-1 rotate-[0.5deg] rounded-xl border shadow-sm transition-transform duration-300 group-hover:rotate-[1deg]" />

      {/* Main card */}
      <div className="border-border bg-card relative overflow-hidden rounded-xl border shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl">
        {/* Thumbnail */}
        <div className="bg-muted relative aspect-video w-full overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Discount badge */}
          {p.off > 0 && !hidePrice && (
            <div className="absolute left-2.5 top-2.5 rounded-md bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {p.offLabel}
            </div>
          )}

          {/* Action buttons */}
          <div className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {showBookmarkIcon && onBookmarkToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBookmarkToggle();
                }}
                className="bg-background/70 text-foreground hover:bg-background flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors"
                aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
              >
                <Bookmark className={cn("h-4 w-4", isBookmarked && "fill-current")} />
              </button>
            )}
            {!hidePrice && !accessManaged && !hasAccess && purchaseMode !== "FREE" && showAddToCartIcon && onAddToCart && !isUnavailable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart();
                }}
                className="bg-background/70 text-foreground hover:text-primary hover:bg-background flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors"
                aria-label={isInCart ? "Remove from cart" : "Add to cart"}
              >
                <ShoppingCart className={cn("h-4 w-4", isInCart && "fill-current")} />
              </button>
            )}
          </div>

          {/* Items count, bottom left on image */}
          {itemCount > 0 && (
            <div className="bg-background/80 text-foreground absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
              <Layers className="text-primary h-3 w-3" />
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3.5">
          <h3 className="text-foreground line-clamp-2 text-sm font-semibold leading-snug">
            {title}
          </h3>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{subtitle}</p>
          )}

          {!hidePrice && (
            <div className="mt-2.5 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-base font-bold",
                  hasAccess ? "text-primary" : "text-foreground",
                  isUnavailable && "text-muted-foreground text-xs font-normal"
                )}
              >
                {p.display}
              </span>
              {p.original && (
                <span className="text-muted-foreground text-xs line-through">{p.original}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BundleCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative pt-5", className)}>
      <div className="border-border bg-muted absolute inset-x-4 bottom-[10px] top-0 rotate-[1.5deg] rounded-xl border" />
      <div className="border-border bg-muted/90 absolute inset-x-2 bottom-[5px] top-1 rotate-[0.5deg] rounded-xl border" />
      <div className="border-border bg-card relative overflow-hidden rounded-xl border">
        <div className="bg-muted aspect-video w-full animate-pulse" />
        <div className="space-y-2 p-3.5">
          <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
          <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
          <div className="bg-muted h-4 w-1/4 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
