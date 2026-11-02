"use client";

import { formatMoney } from "@open-mtlms/shared";
import { Check, ChevronDown, Loader2, Tag, X } from "lucide-react";
import { useState } from "react";

import { checkoutApi, type CouponValidationResult } from "@/lib/api/checkout";
import {
  useAvailableCoupons,
  type AvailableCoupon,
} from "@/lib/hooks/use-available-coupons";
import { cn } from "@/lib/utils";

interface CouponOffersProps {
  orderType: string;
  itemId: string;
  /** Buyer's resolved currency. Offers are not fetched until this is known. */
  currency: string | null | undefined;
  applied: CouponValidationResult | null;
  onApply: (result: CouponValidationResult) => void;
  onRemove: () => void;
  className?: string;
  /** Hide the heading on surfaces that already have their own section title. */
  showHeading?: boolean;
}

/** Pull the server's message out of an axios error, whatever shape it took. */
function errorMessage(err: unknown): string {
  const e = err as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  };
  return (
    e?.response?.data?.error?.message ||
    e?.response?.data?.message ||
    (err instanceof Error ? err.message : "Could not apply this coupon")
  );
}

/**
 * "Ends today" / "Ends in 4 days", but only once the deadline is close enough to
 * be a reason to act. A date three months out is noise.
 */
function expiryHint(validTo: string | null): string | null {
  if (!validTo) return null;
  const days = Math.ceil(
    (new Date(validTo).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0 || days > 14) return null;
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days} days`;
}

function offerLabel(c: AvailableCoupon): string {
  return c.discount_type === "FIXED"
    ? `${formatMoney(c.discount_value, c.currency)} off`
    : `${c.discount_value}% off`;
}

/**
 * The coupon area: public offers the buyer can apply in one click, plus the
 * manual code field.
 *
 * The field is always rendered, never gated on the offer list, private coupons
 * are deliberately absent from that list and can only arrive by being typed in.
 */
export function CouponOffers({
  orderType,
  itemId,
  currency,
  applied,
  onApply,
  onRemove,
  className,
  showHeading = true,
}: CouponOffersProps) {
  const { data: offers = [] } = useAvailableCoupons(orderType, itemId, currency);

  const [code, setCode] = useState("");
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOtherOffers, setShowOtherOffers] = useState(false);

  const apply = async (raw: string) => {
    const candidate = raw.trim().toUpperCase();
    if (!candidate) return;
    setApplyingCode(candidate);
    setError(null);
    try {
      const result = await checkoutApi.validateCoupon({
        coupon_code: candidate,
        order_type: orderType,
        item_id: itemId,
        currency: currency ?? "INR",
      });
      onApply(result);
      setCode("");
      setShowOtherOffers(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setApplyingCode(null);
    }
  };

  const remove = () => {
    setCode("");
    setError(null);
    setShowOtherOffers(false);
    onRemove();
  };

  // ---------------------------------------------------------------- applied --
  if (applied) {
    const others = offers.filter((o) => o.code !== applied.code);

    return (
      <div className={cn("space-y-3", className)}>
        <div className="overflow-hidden rounded-xl border border-emerald-600/30 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/40">
          {/* The code is the one thing here that must stay fully readable, so it
              never truncates and nothing competes with it for width. The saving
              lives in the breakdown below rather than beside it, in a 380px
              product sidebar a second right-aligned figure starved the code
              down to a couple of characters. */}
          <div className="flex items-start justify-between gap-2 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="break-all font-mono text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                {applied.code}
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300">
                applied
              </span>
            </div>
            <button
              type="button"
              onClick={remove}
              aria-label={`Remove coupon ${applied.code}`}
              className="-mr-1 shrink-0 rounded p-1 text-emerald-700 transition-colors hover:bg-emerald-600/10 dark:text-emerald-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <dl className="space-y-1.5 border-t border-emerald-600/20 bg-background/60 px-4 py-3 text-sm dark:border-emerald-500/20">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Price</dt>
              <dd>{formatMoney(applied.original_amount, applied.currency)}</dd>
            </div>
            <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400">
              <dt>You save</dt>
              <dd>
                &minus;{formatMoney(applied.discount_amount, applied.currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
              <dt>You pay</dt>
              <dd>{formatMoney(applied.net_amount, applied.currency)}</dd>
            </div>
          </dl>
        </div>

        {/* Applying a coupon used to hide the rest of the list outright, so a
            buyer could never compare it against a better one. */}
        {others.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowOtherOffers((v) => !v)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  showOtherOffers && "rotate-180",
                )}
              />
              {showOtherOffers ? "Hide" : "View"} {others.length} other offer
              {others.length === 1 ? "" : "s"}
            </button>
            {showOtherOffers && (
              <div className="mt-2 space-y-2">
                {others.map((offer) => (
                  <OfferCard
                    key={offer.code}
                    offer={offer}
                    isBest={false}
                    busy={applyingCode === offer.code}
                    disabled={applyingCode !== null}
                    onClick={() => apply(offer.code)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    );
  }

  // -------------------------------------------------------------- unapplied --
  const busy = applyingCode !== null;

  return (
    <div className={cn("space-y-3", className)}>
      {offers.length > 0 && (
        <div className="space-y-2">
          {showHeading && (
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Offers for this item
            </p>
          )}
          {offers.map((offer, i) => (
            <OfferCard
              key={offer.code}
              offer={offer}
              // The list arrives sorted by saving, so the first card is the
              // best deal by construction.
              isBest={i === 0 && offers.length > 1}
              busy={applyingCode === offer.code}
              disabled={busy}
              onClick={() => apply(offer.code)}
            />
          ))}
        </div>
      )}

      {offers.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">or enter a code</span>
          <span className="bg-border h-px flex-1" />
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && apply(code)}
          placeholder="Enter coupon code"
          disabled={busy}
          className="border-input bg-background focus-visible:ring-ring flex-1 rounded-md border px-3 py-2 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case focus-visible:outline-none focus-visible:ring-1 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => apply(code)}
          disabled={busy || !code.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {applyingCode === code.trim().toUpperCase() ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Apply"
          )}
        </button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

function OfferCard({
  offer,
  isBest,
  busy,
  disabled,
  onClick,
}: {
  offer: AvailableCoupon;
  isBest: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const expiry = expiryHint(offer.valid_to);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // hover:bg-muted, never hover:bg-accent, accent is tenant-controlled and
      // can be any vivid colour, which would make this text unreadable.
      className={cn(
        "group hover:border-primary/50 hover:bg-muted flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed p-3 text-left transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <span className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
        <Tag className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-all font-mono text-sm font-semibold">
            {offer.code}
          </span>
          {isBest && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              Best value
            </span>
          )}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs">
          {offerLabel(offer)}
          {expiry && ` · ${expiry}`}
        </span>
      </span>

      <span className="ml-auto shrink-0 text-right">
        <span className="block text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          Save {formatMoney(offer.discount_amount, offer.currency)}
        </span>
        <span className="text-primary mt-0.5 flex items-center justify-end gap-1 text-xs font-medium">
          {busy ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Applying
            </>
          ) : (
            <span className="group-hover:underline">Apply</span>
          )}
        </span>
      </span>
    </button>
  );
}
