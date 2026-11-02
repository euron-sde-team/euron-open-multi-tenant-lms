"use client";

import { ArrowLeft, LogIn, ShoppingCart, ArrowRight, Tag, X, AlertTriangle } from "lucide-react";
import type { SectionConfig, CartPageContent, ContentTerms } from "@open-mtlms/shared";
import {
  hasCustomSectionBackground,
  decodeHtmlEntities,
  discountLabel,
  formatMoney,
  isResolvedPrice,
  isUnavailablePrice,
} from "@open-mtlms/shared";
import { AccessManagedCta } from "@open-mtlms/core";
import { useContentTerms } from "@/lib/hooks/use-content-terms";
import { useCart } from "@/lib/hooks/use-cart";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { useCurrency, useCurrencyContext } from "@/lib/hooks/use-currency";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { getCourseThumbnailUrl } from "@/lib/api";
import { useBookmark } from "@/lib/stores/bookmark-store";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  cartItemCouponDiscount,
  computeEffectiveCurrency,
  resolveCartItemPrice,
} from "@/lib/utils/cart-pricing";
import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import type { CartItemResponse } from "@/lib/api/cart";

const COURSE_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=225&fit=crop&q=80";

function resolveThumbnailUrl(url: string | null): string {
  if (!url) return COURSE_PLACEHOLDER_IMAGE;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return getCourseThumbnailUrl(url) ?? COURSE_PLACEHOLDER_IMAGE;
}

/** Get the item type label, using the tenant's renamed singular terms */
function getItemTypeLabel(itemType: string, terms: ContentTerms): string {
  switch (itemType) {
    case "COURSE": return terms.course.singular;
    case "BOOK": return terms.book.singular;
    case "BUNDLE": return terms.bundle.singular;
    default: return itemType;
  }
}

/** Get the item detail route */
function getItemRoute(item: CartItemResponse): string {
  switch (item.item_type) {
    case "COURSE": return `/courses/${item.slug}`;
    case "BOOK": return `/books/${item.slug}`;
    case "BUNDLE": return `/bundles/${item.slug}`;
    default: return `/courses/${item.slug}`;
  }
}

interface CartPageSectionProps {
  section: SectionConfig;
}

export function CartPageSection({ section }: CartPageSectionProps) {
  const content = section.content as CartPageContent;
  const router = useRouter();
  const { items, summary, isLoading, removeFromCart, removeItemCoupon } = useCart();
  const { isAuthenticated } = useUserAuthStore();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const currency = useCurrency();
  const { resolvedCurrency, defaultCurrency, enabledCurrencies } = useCurrencyContext();
  const { accessManaged, supportEmail } = useStorefrontConfig();
  const guard = useBuyNowGuard();
  const terms = useContentTerms();

  const checkoutButtonText = content?.checkoutButtonText ?? "Proceed to Checkout";
  const emptyCartMessage = content?.emptyCartMessage ?? "Your cart is empty. Start shopping to add items to your cart!";

  const hasCustomBg = hasCustomSectionBackground(section);

  // Wait for currency detection before rendering prices
  if (!currency) {
    return (
      <section className={cn("py-12 md:py-20", hasCustomBg ? "bg-transparent" : "bg-background")}>
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </section>
    );
  }

  // Access-managed storefront: no self-checkout, show a contact-support
  // notice instead of the cart UI.
  if (accessManaged) {
    return (
      <section className={cn("py-12 md:py-16", hasCustomBg ? "bg-transparent" : "bg-background")}>
        <div className="container-custom">
          <div className="mx-auto max-w-2xl rounded-xl border border-dashed bg-muted/30 p-12 text-center">
            <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold">Checkout Unavailable</h2>
            <p className="mt-2 text-muted-foreground">
              This store does not support self-checkout. Please contact support for access.
            </p>
            <div className="mt-6 flex justify-center">
              <AccessManagedCta hasAccess={false} supportEmail={supportEmail} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Separate owned and purchasable items
  const purchasableItems = items.filter((i) => !i.is_owned);
  const ownedItems = items.filter((i) => i.is_owned);

  // Resolve each item under the buyer's currency. If any item only resolves
  // via the tenant default currency, the whole order falls back to the
  // default currency so every line shares one currency.
  const buyerCtx = { resolvedCurrency, defaultCurrency, enabledCurrencies };
  const { effectiveCurrency, forcedToDefault } = computeEffectiveCurrency(purchasableItems, buyerCtx);
  const effectiveCtx = { resolvedCurrency: effectiveCurrency, defaultCurrency, enabledCurrencies };
  const fmt = (n: number) => formatMoney(n, effectiveCurrency);
  // Legacy footer (≈ other currency) only applies to INR/USD-only tenants.
  const onlyInrUsd = enabledCurrencies.every((c) => c === "INR" || c === "USD");

  // Calculate subtotal from individual items (already coupon-adjusted from API)
  const subtotal = purchasableItems.reduce((sum, item) => {
    const result = resolveCartItemPrice(item, effectiveCtx);
    const basePrice = isResolvedPrice(result) ? result.amount : 0;
    const couponDiscount = cartItemCouponDiscount(item, effectiveCurrency);
    return sum + (basePrice - couponDiscount);
  }, 0);

  // Tax info from summary (already calculated on coupon-adjusted totals by backend)
  const taxMode = summary.tax_mode;
  const taxPercentage = summary.tax_percentage ?? 0;

  // Compute tax on the coupon-adjusted subtotal
  let taxAmount = 0;
  let grandTotal = subtotal;
  if (taxMode === "EXCLUSIVE" && taxPercentage > 0) {
    taxAmount = +(subtotal * taxPercentage / 100).toFixed(2);
    grandTotal = +(subtotal + taxAmount).toFixed(2);
  } else if (taxMode === "INCLUSIVE" && taxPercentage > 0) {
    taxAmount = +(subtotal - subtotal / (1 + taxPercentage / 100)).toFixed(2);
    grandTotal = subtotal;
  }

  const handleSaveForLater = (item: CartItemResponse) => {
    toggleBookmark({
      productId: item.item_id,
      productType: item.item_type.toLowerCase() as "course" | "book" | "bundle",
      title: item.title,
      slug: item.slug,
      thumbnailUrl: item.thumbnail_url,
    });
    removeFromCart({ item_type: item.item_type, item_id: item.item_id });
  };

  // When not logged in, show login prompt (or Easy Checkout entry point if enabled).
  // While the auth-config query is still resolving (`guard.isReady === false`),
  // we render a loading state instead of showing the wrong button copy. This
  // avoids a flicker between "Log In" and "Continue" on cold loads.
  if (!isAuthenticated) {
    if (!guard.isReady) {
      return (
        <section className={cn("py-12 md:py-16", hasCustomBg ? "bg-transparent" : "bg-background")}>
          <div className="container-custom">
            <div className="mx-auto max-w-2xl rounded-xl border border-dashed bg-muted/30 p-12 text-center text-muted-foreground">
              <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm">Loading your cart…</p>
            </div>
          </div>
        </section>
      );
    }
    return (
      <section className={cn("py-12 md:py-16", hasCustomBg ? "bg-transparent" : "bg-background")}>
        <div className="container-custom">
          <div className="mx-auto max-w-2xl rounded-xl border border-dashed bg-muted/30 p-12 text-center">
            <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold">Your Cart</h2>
            <p className="mt-2 text-muted-foreground">
              {guard.easyCheckoutEnabled
                ? "Continue with quick checkout to view and complete your cart."
                : "Please log in to view your cart."}
            </p>
            <button
              type="button"
              onClick={() => guard.run(() => router.refresh(), "/cart")}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <LogIn className="h-4 w-4" />
              {guard.easyCheckoutEnabled ? "Continue" : "Log In"}
            </button>
          </div>
        </div>
        <EasyCheckoutGuardModal guard={guard} />
      </section>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <section className={cn("py-12 md:py-16", hasCustomBg ? "bg-transparent" : "bg-background")}>
        <div className="container-custom">
          <h1 className="mb-8 text-2xl font-bold">Shopping Cart</h1>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 border-b border-border pb-4">
                  <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-muted sm:h-36 sm:w-44" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-48 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </section>
    );
  }

  // Empty cart
  if (items.length === 0) {
    return (
      <section className={cn("py-12 md:py-16", hasCustomBg ? "bg-transparent" : "bg-background")}>
        <div className="container-custom">
          <div className="mx-auto max-w-2xl py-16 text-center">
            <ShoppingCart className="mx-auto mb-6 h-20 w-20 text-muted-foreground/30" />
            <h1 className="text-2xl font-bold">Your Cart is Empty</h1>
            <p className="mt-3 text-muted-foreground">{emptyCartMessage}</p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Continue Shopping
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Cart item renderer
  const renderCartItem = (item: CartItemResponse) => {
    const isOwned = item.is_owned;
    const isFree = item.purchase_mode === "FREE";
    const result = resolveCartItemPrice(item, effectiveCtx);
    const priceUnavailable = !isOwned && !isFree && isUnavailablePrice(result);
    const price = isResolvedPrice(result) ? result.amount : 0;
    const originalPrice = isResolvedPrice(result) ? result.original : 0;
    const couponItemDiscount = cartItemCouponDiscount(item, effectiveCurrency);
    const finalPrice = price - couponItemDiscount;
    const hasDiscount = finalPrice < originalPrice && originalPrice > 0;
    const discountPct =
      isResolvedPrice(result) && result.hasDiscount && result.original > 0
        ? Math.round((1 - result.amount / result.original) * 100)
        : 0;
    // "₹100 off" for a flat discount, "10% off" for a percentage.
    const savingLabel = isResolvedPrice(result) ? discountLabel(result) : null;
    const alreadyBookmarked = isBookmarked(item.item_id);

    return (
      <div key={item.id} className="border-b border-border py-5 first:pt-0 last:border-b-0">
        <div className={cn("flex gap-4 sm:gap-5", isOwned && "opacity-50")}>
          {/* Thumbnail */}
          <div
            className={cn(
              "shrink-0 cursor-pointer overflow-hidden rounded-lg bg-muted",
              item.item_type === "BOOK"
                ? "h-32 w-24 sm:h-40 sm:w-28"
                : "h-24 w-40 sm:h-28 sm:w-48"
            )}
            onClick={() => router.push(getItemRoute(item))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveThumbnailUrl(item.thumbnail_url)}
              alt={decodeHtmlEntities(item.title)}
              className={cn(
                "h-full w-full transition-transform duration-200 hover:scale-105",
                item.item_type === "BOOK" ? "object-contain" : "object-cover"
              )}
              onError={(e) => {
                (e.target as HTMLImageElement).src = COURSE_PLACEHOLDER_IMAGE;
              }}
            />
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              {/* Title & meta */}
              <div className="min-w-0 flex-1">
                <h3
                  className="cursor-pointer text-sm font-semibold leading-snug text-foreground hover:text-primary sm:text-base"
                  onClick={() => router.push(getItemRoute(item))}
                >
                  {decodeHtmlEntities(item.title)}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {getItemTypeLabel(item.item_type, terms)}
                  </span>
                  {isOwned && (
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                      Already Purchased
                    </span>
                  )}
                  {isFree && !isOwned && (
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                      FREE
                    </span>
                  )}
                </div>
              </div>

              {/* Price, right aligned */}
              <div className="shrink-0 text-right">
                {isOwned ? (
                  <span className="text-sm text-muted-foreground">Owned</span>
                ) : isFree ? (
                  <span className="text-base font-bold text-green-600 dark:text-green-400">FREE</span>
                ) : priceUnavailable ? (
                  <span className="text-xs text-muted-foreground">Not available for purchase</span>
                ) : (
                  <>
                    <p className="text-base font-bold text-foreground sm:text-lg">
                      {fmt(finalPrice)}
                    </p>
                    {hasDiscount && (
                      <div className="mt-0.5 flex items-center justify-end gap-1.5">
                        <span className="text-xs text-muted-foreground line-through">
                          {fmt(originalPrice)}
                        </span>
                        {discountPct > 0 && (
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            {savingLabel}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Per-item coupon tag */}
                    {item.coupon_code && item.coupon_valid && couponItemDiscount > 0 && (
                      <div className="group relative mt-0.5 flex items-center justify-end gap-1">
                        <Tag className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">
                          {item.coupon_code} -{fmt(couponItemDiscount)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeItemCoupon(item.id); }}
                          className="ml-0.5 rounded-full p-0.5 text-green-600 transition-colors hover:bg-green-500/10 dark:text-green-400"
                          title="Remove coupon"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="pointer-events-none absolute -top-8 right-0 z-10 hidden whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                          {item.coupon_code}: -{fmt(couponItemDiscount)} off
                        </div>
                      </div>
                    )}
                    {/* Expired/invalid coupon warning */}
                    {item.coupon_code && !item.coupon_valid && (
                      <div className="mt-0.5 flex items-center justify-end gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {item.coupon_code} expired
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeItemCoupon(item.id); }}
                          className="ml-0.5 rounded-full p-0.5 text-amber-500 transition-colors hover:bg-amber-500/10"
                          title="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action buttons: Amazon style text links */}
            <div className="mt-3 flex items-center gap-1">
              <button
                type="button"
                onClick={() => removeFromCart({ item_type: item.item_type, item_id: item.item_id })}
                className="rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 hover:underline sm:text-sm"
              >
                Delete
              </button>
              <span className="text-muted-foreground/40">|</span>
              <button
                type="button"
                onClick={() => handleSaveForLater(item)}
                className="rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 hover:underline sm:text-sm"
              >
                {alreadyBookmarked ? "Saved" : "Save for later"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className={cn("py-8 md:py-12", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── Left column: Cart items ── */}
          <div>
            {/* Back + Header */}
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="mb-1 flex items-baseline justify-between border-b border-border pb-4">
              <h1 className="text-2xl font-bold">Shopping Cart</h1>
              <span className="text-sm text-muted-foreground">Price</span>
            </div>

            {/* Purchasable items */}
            {purchasableItems.length > 0 && (
              <div>
                {purchasableItems.map(renderCartItem)}
              </div>
            )}

            {/* Owned items section */}
            {ownedItems.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Already Purchased
                </p>
                {ownedItems.map(renderCartItem)}
              </div>
            )}

            {/* Subtotal at bottom of items */}
            <div className="mt-4 flex justify-end border-t border-border pt-4">
              <p className="text-sm sm:text-base">
                Subtotal ({summary.purchasable_items} {summary.purchasable_items === 1 ? "item" : "items"}):{" "}
                <span className="font-bold">{fmt(subtotal)}</span>
              </p>
            </div>
          </div>

          {/* ── Right column: Order Summary ── */}
          <div className="lg:sticky lg:top-24">
            {forcedToDefault && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Some items are not priced in {resolvedCurrency}. Your total is shown in {effectiveCurrency}.
              </div>
            )}
            <div className="rounded-xl border bg-card p-5">
              {/* Subtotal */}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subtotal ({summary.purchasable_items} {summary.purchasable_items === 1 ? "item" : "items"})
                  </span>
                  <span className="font-medium">{fmt(subtotal)}</span>
                </div>
              </div>

              {/* Tax */}
              <div className="space-y-2.5 text-sm">
                {taxMode === "EXCLUSIVE" && taxPercentage > 0 && (
                  <div className="flex justify-between border-t border-border pt-2.5">
                    <span className="text-muted-foreground">
                      Tax ({taxPercentage}% GST)
                    </span>
                    <span className="font-medium">
                      {fmt(taxAmount)}
                    </span>
                  </div>
                )}

                {taxMode === "INCLUSIVE" && taxPercentage > 0 && (
                  <div className="flex justify-between border-t border-border pt-2.5 text-xs">
                    <span className="text-muted-foreground">
                      Includes GST ({taxPercentage}%)
                    </span>
                    <span className="text-muted-foreground">
                      {fmt(taxAmount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Grand total */}
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-base font-bold">
                    {fmt(grandTotal)}
                  </span>
                </div>
                {onlyInrUsd && effectiveCurrency === "INR" && parseFloat(summary.total_usd) > 0 && (
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    ≈ ${parseFloat(summary.total_usd).toLocaleString()} USD
                  </p>
                )}
                {onlyInrUsd && effectiveCurrency === "USD" && parseFloat(summary.total_inr) > 0 && (
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    ≈ ₹{parseFloat(summary.total_inr).toLocaleString("en-IN")} INR
                  </p>
                )}
              </div>

              {/* Checkout button */}
              <button
                type="button"
                onClick={() => router.push("/checkout")}
                disabled={summary.purchasable_items === 0}
                className={cn(
                  "mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors",
                  summary.purchasable_items > 0
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                )}
              >
                {checkoutButtonText}
              </button>

              {/* Free items note */}
              {items.some((i) => i.purchase_mode === "FREE" && !i.is_owned) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Free items will be automatically enrolled upon checkout.
                </p>
              )}
            </div>

            {/* Continue shopping link */}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-3 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
