import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TemplatePriceDisplay {
  /** PAID book with no price in any enabled currency: hide buy CTAs. */
  unavailable: boolean;
  symbol: string;
  finalPrice: number;
  originalPrice: number;
  discountPct: number;
  /** Saving labelled as entered: "₹100 off" (FLAT) or "10% off". */
  savingLabel: string | null;
  locale: "en-IN" | "en-US";
  /** Other configured currency prices (admin editor preview only). */
  additionalPrices?: Array<{ currency: string; label: string }>;
}

/**
 * Resolve the pricing display values: pre-resolved multi-currency priceParts
 * from the caller win; otherwise fall back to the legacy INR/USD math driven
 * by preferredCurrency.
 */
export function resolveTemplatePrice(
  priceParts:
    | {
        currency: string;
        symbol: string;
        amount: number;
        original: number;
        hasDiscount: boolean;
        /** Absent means PERCENTAGE, see TemplatePriceParts in ../types. */
        discountType?: "PERCENTAGE" | "FLAT";
        unavailable?: false | undefined;
        additionalPrices?: Array<{ currency: string; label: string }>;
      }
    | { unavailable: true }
    | null
    | undefined,
  legacy: {
    isUSD: boolean;
    priceInr: number;
    priceUsd: number;
    discountInr: number;
    discountUsd: number;
  },
): TemplatePriceDisplay {
  if (priceParts) {
    if (priceParts.unavailable) {
      return {
        unavailable: true,
        symbol: "",
        finalPrice: 0,
        originalPrice: 0,
        discountPct: 0,
        savingLabel: null,
        locale: "en-US",
      };
    }
    const discountPct =
      priceParts.hasDiscount && priceParts.original > 0
        ? Math.round((1 - priceParts.amount / priceParts.original) * 100)
        : 0;
    return {
      unavailable: false,
      symbol: priceParts.symbol,
      finalPrice: discountPct > 0 ? Math.round(priceParts.amount) : priceParts.amount,
      originalPrice: priceParts.original,
      discountPct,
      savingLabel: buildSavingLabel({
        discountType: priceParts.discountType,
        saved: priceParts.hasDiscount
          ? Math.max(0, priceParts.original - priceParts.amount)
          : 0,
        discountPct,
        symbol: priceParts.symbol,
        locale: priceParts.currency === "INR" ? "en-IN" : "en-US",
      }),
      locale: priceParts.currency === "INR" ? "en-IN" : "en-US",
      additionalPrices: priceParts.additionalPrices,
    };
  }

  const price = legacy.isUSD ? legacy.priceUsd : legacy.priceInr;
  const discount = legacy.isUSD ? legacy.discountUsd : legacy.discountInr;
  return {
    unavailable: false,
    symbol: legacy.isUSD ? "$" : "₹",
    finalPrice: discount > 0 ? Math.round(price * (1 - discount / 100)) : price,
    originalPrice: price,
    discountPct: discount,
    // Legacy columns are always a percentage, a FLAT price-book row is
    // mirrored into them as its percent equivalent by content-prices.service.
    savingLabel: discount > 0 ? `${discount}% off` : null,
    locale: legacy.isUSD ? "en-US" : "en-IN",
  };
}

/**
 * Build the badge text from a resolved price: "₹100 off" for a flat discount,
 * "10% off" for a percentage. Mirrors the helper in @open-mtlms/course-templates so
 * every card labels a saving identically.
 */
export function buildSavingLabel(args: {
  discountType?: "PERCENTAGE" | "FLAT";
  saved: number;
  discountPct: number;
  symbol: string;
  locale: "en-IN" | "en-US";
}): string | null {
  if (args.saved <= 0) return null;
  if (args.discountType === "FLAT") {
    return `${args.symbol}${Math.round(args.saved).toLocaleString(args.locale)} off`;
  }
  return args.discountPct > 0 ? `${args.discountPct}% off` : null;
}
