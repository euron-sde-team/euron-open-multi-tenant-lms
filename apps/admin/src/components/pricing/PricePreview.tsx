"use client";

import { formatMoney, type ContentPrice } from "@open-mtlms/shared";

interface PricePreviewProps {
  prices: ContentPrice[];
  /**
   * Fallback discount semantics for rows that carry no `discount_type` (legacy
   * records): percent (default) or flat amount (hub products). A row that HAS a
   * type always wins, the admin chose it per item.
   */
  discountMode?: "percent" | "amount";
}

/**
 * Effective-price preview driven by the multi-currency price book: one entry
 * per priced currency, struck-through original when discounted. Renders
 * nothing when no currency has a price yet.
 */
export function PricePreview({ prices, discountMode = "percent" }: PricePreviewProps) {
  const priced = prices.filter((p) => p.amount > 0);
  if (priced.length === 0) return null;

  /**
   * Mirrors `readingFor()` in @open-mtlms/shared money.ts and `legacyDiscountTypeFor()`
   * on the server: the stored type decides, and `discountMode` only covers rows
   * that predate it.
   */
  const isFlat = (p: ContentPrice) => {
    if (p.discount_type === "FLAT") return true;
    if (p.discount_type === "PERCENTAGE") return false;
    return discountMode === "amount";
  };

  const effectiveAmount = (p: ContentPrice) => {
    const discount = p.discount ?? 0;
    if (discount <= 0) return p.amount;
    return isFlat(p)
      ? Math.max(0, p.amount - discount)
      : Math.max(0, p.amount * (1 - Math.min(100, discount) / 100));
  };

  const discounted = priced.filter((p) => (p.discount ?? 0) > 0);

  return (
    <div className="bg-muted/50 space-y-2 rounded-lg p-4">
      <p className="text-muted-foreground text-sm font-medium">Price Preview</p>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {priced.map((p) => {
          const final = effectiveAmount(p);
          return (
            <div key={p.currency}>
              <span className="text-2xl font-bold">{formatMoney(final, p.currency)}</span>
              {final < p.amount && (
                <span className="text-muted-foreground ml-2 text-sm line-through">
                  {formatMoney(p.amount, p.currency)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {discounted.length > 0 && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {discounted
            .map((p) =>
              isFlat(p)
                ? `${formatMoney(p.discount ?? 0, p.currency)} off (${p.currency})`
                : `${p.discount}% off (${p.currency})`
            )
            .join(", ")}
        </p>
      )}
    </div>
  );
}
