import { formatMoney } from "@open-mtlms/shared";

/**
 * Pre-resolved price display parts computed by the caller (apps/web) from the
 * buyer's currency context. Keeps packages/core context-free: cards render
 * these parts preferentially and fall back to the legacy INR/USD props when
 * absent. Structurally compatible with the shared ResolvedPrice and
 * UnavailablePrice shapes, so callers can pass a ResolvedPriceResult directly
 * (null falls through to the legacy props).
 */
export type CardPriceParts =
  | {
      currency: string;
      symbol: string;
      amount: number;
      original: number;
      hasDiscount: boolean;
      /** Absent means PERCENTAGE, what every item used before flat discounts. */
      discountType?: "PERCENTAGE" | "FLAT";
      unavailable?: false | undefined;
      hidden?: false | undefined;
    }
  | { unavailable: true; hidden?: boolean };

export interface CardPriceInfo {
  display: string;
  original: string | null;
  /** PAID item with no price in any enabled currency: hide buy CTAs. */
  unavailable?: boolean;
  /** Access-managed storefront: render no price text at all (not even "unavailable"). */
  hidden?: boolean;
}

export function priceInfoFromParts(parts: CardPriceParts): CardPriceInfo {
  if (parts.unavailable) {
    if (parts.hidden) {
      // Access-managed storefront (HIDDEN_PRICE sentinel): show nothing where
      // the price would be, cards keep media/title/links only.
      return { display: "", original: null, unavailable: true, hidden: true };
    }
    return { display: "Not available for purchase", original: null, unavailable: true };
  }
  return {
    display: formatMoney(parts.amount, parts.currency),
    original: parts.hasDiscount ? formatMoney(parts.original, parts.currency) : null,
  };
}
