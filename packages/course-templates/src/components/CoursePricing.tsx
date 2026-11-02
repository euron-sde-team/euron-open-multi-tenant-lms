"use client";

import { ShoppingCart, Gift } from "lucide-react";
import { formatNumber, type CourseFormData } from "@open-mtlms/shared";
import { AccessManagedCta } from "@open-mtlms/core";
import { cn, resolveTemplatePrice } from "../lib/utils";
import { useCourseEdit, useStorefrontAccess } from "../context";
import type { TemplatePriceParts } from "../types";

interface CoursePricingProps {
  courseData: CourseFormData;
  className?: string;
  variant?: "card" | "inline" | "hero";
  /** Pre-resolved multi-currency price parts; rendered preferentially over legacy INR math. */
  priceParts?: TemplatePriceParts | null;
}

export function CoursePricing({
  courseData,
  className,
  variant = "card",
  priceParts,
}: CoursePricingProps) {
  // Access-managed storefront: no price text, no buy CTAs, owners keep their
  // entry point upstream; everyone else gets Contact Support. Both hooks are
  // safe outside their providers (they fall back to defaults).
  const { accessManaged, supportEmail } = useStorefrontAccess();
  const { callbacks } = useCourseEdit();

  if (accessManaged) {
    const cta = (
      <AccessManagedCta
        hasAccess={!!callbacks.hasAccess}
        supportEmail={supportEmail}
        contactSubject={courseData.title}
        fullWidth={variant !== "inline"}
      />
    );

    if (variant === "inline") {
      return <div className={cn("text-center", className)}>{cta}</div>;
    }

    if (variant === "hero") {
      return <div className={cn("flex flex-wrap gap-4", className)}>{cta}</div>;
    }

    return (
      <div
        className={cn("sticky top-24 rounded-xl border shadow-lg overflow-hidden", className)}
        style={{
          backgroundColor: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
        }}
      >
        <div className="p-6">{cta}</div>
      </div>
    );
  }

  // Pre-resolved multi-currency parts win; legacy INR-first math is the fallback.
  const priceDisplay = resolveTemplatePrice(priceParts, {
    isUSD: false,
    priceInr: courseData.webPriceINR || 0,
    priceUsd: courseData.webPriceUSD || 0,
    discountInr: courseData.webDiscount || 0,
    discountUsd: courseData.mobileDiscount ?? courseData.webDiscount ?? 0,
  });
  const priceSymbol = priceDisplay.symbol;
  const priceLocale = priceDisplay.locale;
  const originalPrice = priceDisplay.originalPrice;
  const discount = priceDisplay.discountPct;
  // Badge text: "₹100 off" for a flat discount, "10% off" for a percentage.
  // `discount > 0` still gates the strikethrough, so it stays as the guard.
  const savingLabel = priceDisplay.savingLabel;
  const finalPrice = priceDisplay.finalPrice;
  const priceUnavailable = priceDisplay.unavailable && courseData.purchaseMode === "PAID";
  // Secondary USD line only applies to the legacy (no priceParts) path.
  const originalPriceUSD = priceParts ? 0 : courseData.webPriceUSD || 0;
  const discountUSD = courseData.mobileDiscount ?? courseData.webDiscount ?? 0;
  const finalPriceUSD = discountUSD > 0 ? Math.round(originalPriceUSD * (1 - discountUSD / 100)) : originalPriceUSD;

  if (variant === "inline") {
    if (courseData.purchaseMode === "FREE") {
      return (
        <div className={cn("text-center", className)}>
          <span className="text-4xl font-bold" style={{ color: "hsl(var(--primary))" }}>
            FREE
          </span>
        </div>
      );
    }

    if (priceUnavailable) {
      return (
        <div className={cn("text-center", className)}>
          <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Not available for purchase
          </span>
        </div>
      );
    }

    return (
      <div className={cn("flex items-baseline gap-2", className)}>
        <span className="text-3xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
          {priceSymbol}{formatNumber(finalPrice, priceLocale)}
        </span>
        {discount > 0 && (
          <>
            <span className="text-lg line-through" style={{ color: "hsl(var(--muted-foreground))" }}>
              {priceSymbol}{formatNumber(originalPrice, priceLocale)}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-sm font-medium"
              style={{
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              {savingLabel}
            </span>
          </>
        )}
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div className={cn("flex flex-wrap gap-4", className)}>
        <button
          className="flex-1 flex items-center justify-center gap-2 rounded-lg px-6 py-4 font-semibold transition-colors hover:opacity-90 active:opacity-95"
          style={{
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
          }}
        >
          <ShoppingCart className="h-5 w-5" />
          {courseData.purchaseMode === "FREE"
            ? "Enroll Free"
            : priceUnavailable
              ? "Not available for purchase"
              : `Enroll for ${priceSymbol}${formatNumber(finalPrice, priceLocale)}`}
        </button>
        <button
          className="flex items-center justify-center gap-2 rounded-lg border-2 px-6 py-4 font-semibold transition-colors hover:opacity-90 active:opacity-95"
          style={{ borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }}
        >
          <Gift className="h-5 w-5" />
          Gift This Course
        </button>
      </div>
    );
  }

  // Default card variant
  return (
    <div
      className={cn("sticky top-24 rounded-xl border shadow-lg overflow-hidden", className)}
      style={{
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      {/* Price Header */}
      <div className="p-6">
        {courseData.purchaseMode === "FREE" ? (
          <div className="text-center">
            <div className="text-4xl font-bold" style={{ color: "hsl(var(--primary))" }}>
              FREE
            </div>
            <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Enroll now and start learning
            </p>
          </div>
        ) : priceUnavailable ? (
          <div className="text-center">
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Not available for purchase
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                {priceSymbol}{formatNumber(finalPrice, priceLocale)}
              </span>
              {discount > 0 && (
                <>
                  <span className="text-lg line-through" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {priceSymbol}{formatNumber(originalPrice, priceLocale)}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-sm font-medium"
                    style={{
                      backgroundColor: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                    }}
                  >
                    {savingLabel}
                  </span>
                </>
              )}
            </div>
            {(originalPriceUSD > 0 || finalPriceUSD > 0) && (
              <div className="mt-1 flex flex-wrap items-baseline gap-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                <span className="font-semibold" style={{ color: "hsl(var(--card-foreground))" }}>
                  ${formatNumber(finalPriceUSD, "en-US")} USD
                </span>
                {discountUSD > 0 && originalPriceUSD > 0 && (
                  <>
                    <span className="line-through">${formatNumber(originalPriceUSD, "en-US")}</span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                      }}
                    >
                      {discountUSD}% off
                    </span>
                  </>
                )}
              </div>
            )}
            {priceDisplay.additionalPrices && priceDisplay.additionalPrices.length > 0 && (
              <div className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* CTA Buttons */}
        {!priceUnavailable && (
          <button
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-colors hover:opacity-90 active:opacity-95"
            style={{
              backgroundColor: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            <ShoppingCart className="h-5 w-5" />
            {courseData.purchaseMode === "FREE" ? "Enroll Now - Free" : "Buy Now"}
          </button>
        )}

        {courseData.purchaseMode === "PAID" && !priceUnavailable && (
        <button
          className="mt-2 w-full rounded-lg border px-4 py-3 font-semibold transition-colors hover:bg-muted/50 active:opacity-90"
          style={{
            borderColor: "hsl(var(--border))",
            color: "hsl(var(--card-foreground))",
          }}
        >
            Add to Cart
          </button>
        )}
      </div>

      {/* Coupon Section */}
      {courseData.purchaseMode === "PAID" && (
        <div className="border-t p-4" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter coupon code"
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              style={{
                borderColor: "hsl(var(--border))",
                backgroundColor: "hsl(var(--background))",
              }}
            />
            <button
              className="rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90 active:opacity-95"
              style={{
                backgroundColor: "hsl(var(--muted))",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Guarantee */}
      <div className="border-t p-4 text-center" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center justify-center gap-2">
          <Gift className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
          <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Get Instant Access
          </span>
        </div>
      </div>
    </div>
  );
}
