import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TemplatePriceParts } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TemplatePriceDisplay {
  /** PAID course with no price in any enabled currency: hide buy CTAs. */
  unavailable: boolean;
  symbol: string;
  finalPrice: number;
  originalPrice: number;
  discountPct: number;
  /**
   * The saving, labelled the way the admin entered it: "₹100 off" for a flat
   * discount, "10% off" for a percentage. Null when there is nothing to show.
   * Prefer this over `discountPct` when rendering a badge, a flat discount
   * displayed as a percentage drifts every time the price is edited.
   */
  savingLabel: string | null;
  locale: "en-IN" | "en-US";
  /** Other configured currency prices (admin editor preview only). */
  additionalPrices?: Array<{ currency: string; label: string }>;
}

/**
 * Build the badge text from a resolved price. Shared by the template packages
 * so course, book and bundle cards all label a saving identically.
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

/**
 * Resolve the pricing-card display values: pre-resolved multi-currency
 * priceParts from the caller win; otherwise fall back to the legacy
 * INR/USD math driven by preferredCurrency.
 */
export function resolveTemplatePrice(
  priceParts: TemplatePriceParts | null | undefined,
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
    const locale = priceParts.currency === "INR" ? "en-IN" : "en-US";
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
        locale,
      }),
      locale,
      additionalPrices: priceParts.additionalPrices,
    };
  }

  const price = legacy.isUSD ? legacy.priceUsd : legacy.priceInr;
  const discount = legacy.isUSD ? legacy.discountUsd : legacy.discountInr;
  // The legacy columns are always a percentage, content-prices.service mirrors
  // a FLAT price-book row into them as its percent equivalent to keep that true.
  return {
    unavailable: false,
    symbol: legacy.isUSD ? "$" : "₹",
    finalPrice: discount > 0 ? Math.round(price * (1 - discount / 100)) : price,
    originalPrice: price,
    discountPct: discount,
    savingLabel: discount > 0 ? `${discount}% off` : null,
    locale: legacy.isUSD ? "en-US" : "en-IN",
  };
}

/** Format course languages for display: backend may store multiple; show comma-separated. */
export function formatCourseLanguages(languages: string[] | undefined, fallbackSingle: string | undefined): string {
  if (languages?.length) return languages.join(", ");
  return fallbackSingle || "English";
}

/**
 * Format date to relative time (e.g., "2 hours ago", "1 day ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
}

/** Decode HTML entities (e.g. &amp; → &) so they display correctly. */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (str == null || typeof str !== "string") return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extract YouTube video ID from various URL formats and return embed URL.
 * Supports: youtu.be/, youtube.com/watch?v=, youtube.com/embed/, youtube.com/v/
 * Returns null if URL is not a valid YouTube URL.
 */
export function getYoutubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Regex to match various YouTube URL formats and extract the video ID
  // eslint-disable-next-line no-useless-escape
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  // Video ID should be exactly 11 characters
  if (match && match[2].length === 11) {
    const videoId = match[2];
    return `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1`;
  }
  
  return null;
}
