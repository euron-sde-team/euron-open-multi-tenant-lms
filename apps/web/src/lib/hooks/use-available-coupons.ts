"use client";

import { useQuery } from "@tanstack/react-query";

import { checkoutApi, type AvailableCoupon } from "@/lib/api/checkout";

export type { AvailableCoupon };

/**
 * Public coupons redeemable on this item right now, best offer first.
 *
 * Savings are priced per currency, so the currency is part of the key, a buyer
 * switching country gets re-quoted rather than shown stale amounts.
 *
 * Never throws into the UI: an empty list is the normal answer for most items,
 * and a failure here must not block checkout. Callers treat "no offers" and
 * "lookup failed" the same way.
 */
export function useAvailableCoupons(
  orderType: string | null | undefined,
  itemId: string | null | undefined,
  currency: string | null | undefined,
) {
  return useQuery({
    queryKey: ["available-coupons", orderType, itemId, currency],
    queryFn: async (): Promise<AvailableCoupon[]> => {
      const res = await checkoutApi.availableCoupons({
        order_type: orderType!,
        item_id: itemId!,
        currency: currency ?? undefined,
      });
      return res.coupons ?? [];
    },
    enabled: !!orderType && !!itemId && !!currency,
    staleTime: 60_000,
    retry: false,
  });
}
