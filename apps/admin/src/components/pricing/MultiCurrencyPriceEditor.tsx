"use client";

import { Input, Label, useToast } from "@open-mtlms/core";
import {
  formatMoney,
  getCurrencySymbol,
  roundPsychological,
  type ContentPrice,
} from "@open-mtlms/shared";
import { Loader2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { currencySettingsApi } from "@/lib/api/currency-settings";
import { useCurrencySettings } from "@/lib/hooks/use-currency-settings";
import { cn } from "@/lib/utils";

interface MultiCurrencyPriceEditorProps {
  value: ContentPrice[];
  onChange: (prices: ContentPrice[]) => void;
  /**
   * "none" hides the discount column entirely. Otherwise this is only the
   * FALLBACK mode used when the item carries no `discount_type` yet (a brand
   * new item, or one saved before the column existed), the admin picks the
   * real mode with the toggle, and it is stored per item.
   */
  discountMode?: "percent" | "amount" | "none";
  disabled?: boolean;
}

type DiscountType = "PERCENTAGE" | "FLAT";

interface CurrencyRow {
  currency: string;
  isDefault: boolean;
}

/** Fallback rows while settings load: identical to the legacy INR/USD UX. */
const FALLBACK_ROWS: CurrencyRow[] = [
  { currency: "INR", isDefault: true },
  { currency: "USD", isDefault: false },
];

export function MultiCurrencyPriceEditor({
  value,
  onChange,
  discountMode = "percent",
  disabled = false,
}: MultiCurrencyPriceEditorProps) {
  const { toast } = useToast();
  const { data: settings, isLoading } = useCurrencySettings();
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);
  // Raw text drafts per input so partial entries ("0", "0.") survive re-renders
  // even though zero-amount rows are dropped from the canonical price array.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const setDraft = useCallback((key: string, raw: string) => {
    setDrafts((prev) => ({ ...prev, [key]: raw }));
  }, []);

  const clearDraft = useCallback((key: string) => {
    setDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const settingsReady = !isLoading && !!settings?.currencies?.length;

  const rows: CurrencyRow[] = useMemo(() => {
    if (!settingsReady) return FALLBACK_ROWS;
    return [...settings!.currencies]
      .filter((c) => c.is_active !== false)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ currency: c.currency, isDefault: c.is_default }));
  }, [settingsReady, settings]);

  const defaultCurrency = rows.find((r) => r.isDefault)?.currency ?? rows[0]?.currency;

  const enabledSet = useMemo(() => new Set(rows.map((r) => r.currency.toUpperCase())), [rows]);

  // Prune entries for currencies the tenant has disabled (e.g. an INR entry
  // hydrated from legacy columns before the tenant switched currencies). They
  // render nowhere in this editor, so left alone they would invisibly ride
  // along into save payloads and previews. Only prune once real settings are
  // loaded; never against the INR/USD fallback rows.
  useEffect(() => {
    if (!settingsReady) return;
    const pruned = value.filter((p) => enabledSet.has(p.currency?.toUpperCase()));
    if (pruned.length !== value.length) onChange(pruned);
  }, [settingsReady, enabledSet, value, onChange]);

  const entryFor = useCallback(
    (code: string) => value.find((p) => p.currency?.toUpperCase() === code.toUpperCase()),
    [value]
  );

  /**
   * The admin's toggle choice while no price row exists to carry it yet.
   * Without this the toggle is inert on a brand-new item: the type is derived
   * from the rows, and with zero rows a click has nothing to stamp, so the
   * selection visually snaps back. Once rows exist, their stored value wins,
   * keeping server truth authoritative.
   */
  const [typeOverride, setTypeOverride] = useState<DiscountType | null>(null);

  /**
   * The item's discount mode. Read off the rows (they all carry the same value,
   * the backend rejects a mixed payload), then the pending toggle choice, then
   * the caller's `discountMode` for an item that has no rows or predates the
   * column.
   */
  const discountType: DiscountType = useMemo(() => {
    const stored = value.find(
      (p) => p.discount_type === "FLAT" || p.discount_type === "PERCENTAGE"
    )?.discount_type;
    if (stored === "FLAT" || stored === "PERCENTAGE") return stored;
    if (typeOverride) return typeOverride;
    return discountMode === "amount" ? "FLAT" : "PERCENTAGE";
  }, [value, typeOverride, discountMode]);

  const emit = useCallback(
    (code: string, patch: { amount?: number; discount?: number | null }) => {
      const upper = code.toUpperCase();
      const existing = value.find((p) => p.currency?.toUpperCase() === upper);
      const next: ContentPrice = {
        currency: upper,
        amount: patch.amount !== undefined ? patch.amount : (existing?.amount ?? 0),
        discount:
          patch.discount !== undefined ? patch.discount : (existing?.discount ?? null),
        // Stamped on every row so the payload is never mixed, and so an item
        // that predates the column adopts the mode as soon as it is edited.
        discount_type: discountType,
      };
      const rest = value.filter(
        (p) =>
          p.currency?.toUpperCase() !== upper &&
          (!settingsReady || enabledSet.has(p.currency?.toUpperCase()))
      );
      if (next.amount > 0) {
        onChange([...rest, next]);
      } else {
        // No price for this currency: drop the row from the price book
        onChange(rest);
      }
    },
    [value, onChange, settingsReady, enabledSet, discountType]
  );

  /**
   * Switch the whole item between PERCENTAGE and FLAT.
   *
   * Every discount RESETS to none: a number typed in one unit means something
   * completely different in the other ("10" is 10% off or ₹10 off), so carrying
   * it across the switch silently repriced items and produced invalid states
   * (a flat 500 read as 500%, clamped to a 100%-off free item). Forcing the
   * admin to re-enter the discount in the new unit removes that entire class
   * of error. Prices are untouched; only discounts clear.
   */
  const setDiscountType = useCallback(
    (next: DiscountType) => {
      if (next === discountType) return;
      setTypeOverride(next);
      if (value.length > 0) {
        onChange(value.map((p) => ({ ...p, discount: null, discount_type: next })));
      }
      // Drop in-progress discount drafts too, or the old digits would linger
      // in the inputs after the reset.
      setDrafts((prev) => {
        const entries = Object.entries(prev).filter(([key]) => !key.endsWith(":discount"));
        return entries.length === Object.keys(prev).length
          ? prev
          : Object.fromEntries(entries);
      });
    },
    [discountType, value, onChange]
  );

  const handleSuggest = useCallback(
    async (code: string) => {
      if (!defaultCurrency) return;
      const defaultEntry = value.find(
        (p) => p.currency?.toUpperCase() === defaultCurrency.toUpperCase()
      );
      if (!defaultEntry || defaultEntry.amount <= 0) return;
      setSuggestingFor(code);
      try {
        const result = await currencySettingsApi.fxSuggest({
          from: defaultCurrency,
          to: [code],
          amount: defaultEntry.amount,
        });
        const suggestion = result.suggestions.find(
          (s) => s.currency?.toUpperCase() === code.toUpperCase()
        );
        if (suggestion) {
          clearDraft(`${code}:price`);
          emit(code, { amount: roundPsychological(suggestion.amount, code) });
        } else {
          toast({
            title: "No suggestion available",
            description: `Could not fetch a rate for ${code}.`,
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Suggestion failed",
          description: err instanceof Error ? err.message : "Could not fetch FX rate.",
          variant: "destructive",
        });
      } finally {
        setSuggestingFor(null);
      }
    },
    [defaultCurrency, value, emit, clearDraft, toast]
  );

  const defaultEntry = defaultCurrency ? entryFor(defaultCurrency) : undefined;
  const canSuggest = !!defaultEntry && defaultEntry.amount > 0;
  const showDiscount = discountMode !== "none";
  const isFlat = discountType === "FLAT";

  return (
    <div className="space-y-3">
      {showDiscount && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">Discount type</span>
          <div
            role="radiogroup"
            aria-label="Discount type"
            className="bg-muted inline-flex rounded-md p-0.5"
          >
            {(
              [
                { type: "PERCENTAGE" as const, label: "Percentage" },
                { type: "FLAT" as const, label: "Flat amount" },
              ]
            ).map((opt) => (
              <button
                key={opt.type}
                type="button"
                role="radio"
                aria-checked={discountType === opt.type}
                disabled={disabled}
                onClick={() => setDiscountType(opt.type)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  discountType === opt.type
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-muted-foreground text-xs">
            {isFlat
              ? "A fixed amount off, entered per currency."
              : "One percentage off, applied to every currency."}
          </span>
        </div>
      )}
      <div
        className={
          showDiscount
            ? "text-muted-foreground grid grid-cols-[1fr_minmax(0,7rem)] items-center gap-2 text-xs font-medium sm:grid-cols-[7rem_1fr_minmax(0,7rem)]"
            : "text-muted-foreground grid grid-cols-[1fr] items-center gap-2 text-xs font-medium sm:grid-cols-[7rem_1fr]"
        }
      >
        <span className="hidden sm:block">Currency</span>
        <span>Price</span>
        {showDiscount && <span>{isFlat ? "Discount" : "Discount %"}</span>}
      </div>
      {rows.map((row) => {
        const entry = entryFor(row.currency);
        const symbol = getCurrencySymbol(row.currency);
        const isSuggesting = suggestingFor === row.currency;

        /**
         * What the buyer will actually pay, shown live under the row.
         *
         * A FLAT discount shows the amount off ("₹100 OFF") and never a
         * percentage: a derived percentage drifts every time the price is
         * edited, so it would be noise.
         */
        const rawDiscount = entry?.discount ?? 0;
        const preview =
          entry && entry.amount > 0 && rawDiscount > 0
            ? isFlat
              ? {
                  invalid: rawDiscount > entry.amount,
                  badge: formatMoney(rawDiscount, row.currency),
                  sells: formatMoney(Math.max(0, entry.amount - rawDiscount), row.currency),
                }
              : {
                  invalid: rawDiscount > 100,
                  badge: `${rawDiscount}%`,
                  sells: formatMoney(
                    Math.max(0, entry.amount * (1 - Math.min(100, rawDiscount) / 100)),
                    row.currency
                  ),
                }
            : null;

        return (
          <div
            key={row.currency}
            className={
              showDiscount
                ? "grid grid-cols-[1fr_minmax(0,7rem)] items-center gap-2 sm:grid-cols-[7rem_1fr_minmax(0,7rem)]"
                : "grid grid-cols-[1fr] items-center gap-2 sm:grid-cols-[7rem_1fr]"
            }
          >
            <Label
              htmlFor={`price-${row.currency}`}
              className="col-span-full text-sm font-medium sm:col-span-1"
            >
              {row.currency}
              {row.isDefault && <span className="text-destructive ml-0.5">*</span>}
              {symbol !== row.currency && (
                <span className="text-muted-foreground ml-1 text-xs">{symbol}</span>
              )}
            </Label>
            {/* Flex wrapper styled like the Input so the symbol prefix and the
                wand suffix occupy real layout space: works for symbols of any
                width (MAD, KSh, NZ$) without padding guesswork. */}
            <div
              className={cn(
                "border-input bg-background ring-offset-background focus-within:ring-ring flex h-10 items-center rounded-md border focus-within:ring-2 focus-within:ring-offset-2",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <span className="text-muted-foreground shrink-0 pl-3 text-sm">{symbol}</span>
              <Input
                id={`price-${row.currency}`}
                type="number"
                min="0"
                step="any"
                required={row.isDefault}
                disabled={disabled}
                value={
                  drafts[`${row.currency}:price`] ??
                  (entry && entry.amount > 0 ? entry.amount : "")
                }
                onChange={(e) => {
                  setDraft(`${row.currency}:price`, e.target.value);
                  emit(row.currency, { amount: Number(e.target.value) || 0 });
                }}
                onBlur={() => clearDraft(`${row.currency}:price`)}
                placeholder="0"
                className="h-full min-w-0 flex-1 border-0 bg-transparent pl-2 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {!row.isDefault && (
                <button
                  type="button"
                  title={
                    canSuggest
                      ? `Suggest from ${defaultCurrency} price`
                      : `Set the ${defaultCurrency ?? "default"} price first`
                  }
                  disabled={disabled || !canSuggest || isSuggesting}
                  onClick={() => handleSuggest(row.currency)}
                  className="text-muted-foreground hover:bg-muted mr-1.5 shrink-0 rounded-md p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSuggesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
            {showDiscount && (
              <div className="relative">
                <Input
                  id={`discount-${row.currency}`}
                  type="number"
                  min="0"
                  max={isFlat ? (entry && entry.amount > 0 ? entry.amount : undefined) : "100"}
                  step="any"
                  disabled={disabled || !entry || entry.amount <= 0}
                  value={
                    drafts[`${row.currency}:discount`] ??
                    (entry && entry.discount != null && entry.discount > 0 ? entry.discount : "")
                  }
                  onChange={(e) => {
                    setDraft(`${row.currency}:discount`, e.target.value);
                    const n = Number(e.target.value) || 0;
                    emit(row.currency, { discount: n > 0 ? n : null });
                  }}
                  onBlur={() => clearDraft(`${row.currency}:discount`)}
                  placeholder="0"
                  className={isFlat ? undefined : "pr-7"}
                />
                {!isFlat && (
                  <span className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    %
                  </span>
                )}
              </div>
            )}
            {showDiscount && preview && (
              <p
                className={cn(
                  "col-span-full text-xs sm:col-start-2 sm:col-end-[-1]",
                  preview.invalid ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {preview.invalid ? (
                  <>The discount is larger than the price.</>
                ) : (
                  <>
                    <span className="font-medium">{preview.badge} OFF</span>
                    {", sells at "}
                    <span className="text-foreground font-medium">{preview.sells}</span>
                  </>
                )}
              </p>
            )}
          </div>
        );
      })}
      <p className="text-muted-foreground text-xs">
        The {defaultCurrency ?? "default"} price is required; it is the fallback for buyers
        without a price in their currency.
      </p>
    </div>
  );
}
