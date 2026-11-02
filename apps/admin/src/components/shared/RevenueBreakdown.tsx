"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@open-mtlms/core";
import { Info } from "lucide-react";

import {
  COMBINED_REVENUE_SUBNOTE,
  FALLBACK_USD_TO_INR_RATE,
  formatInr,
  formatUsd,
  type RevenueBreakdown,
} from "../../lib/utils/currency";

type Variant = "card" | "inline" | "cell";

interface Props {
  /** Server-provided breakdown; if `null`/`undefined`, treated as zero. */
  value?: RevenueBreakdown | null;
  /** Layout variant. `card` = three stacked rows; `inline` = same compact; `cell` = single combined value with tooltip. */
  variant?: Variant;
  /** Optional label shown above `card` variant (e.g. "Revenue", "Avg Order Value"). */
  label?: string;
  /** Include the "expected after conversion" subnote under the combined row. */
  showSubnote?: boolean;
  /** Class for outer wrapper. */
  className?: string;
}

/**
 * Displays a multi-currency revenue value with explicit INR / USD / Combined rows.
 *
 * `card`, used in dashboard/analytics cards. Three stacked rows.
 * `inline`, same content, tighter spacing, for use inside existing Cards.
 * `cell`, single combined-in-INR value with a hover tooltip showing the split.
 *          Use in table cells (customer LTV lists, product revenue columns).
 */
export function RevenueBreakdownDisplay({
  value,
  variant = "card",
  label,
  showSubnote = true,
  className,
}: Props) {
  const inr = value?.inr ?? 0;
  const usd = value?.usd ?? 0;
  const combined = value?.combined_inr ?? inr + usd * FALLBACK_USD_TO_INR_RATE;
  const rate = value?.conversion_rate ?? FALLBACK_USD_TO_INR_RATE;

  if (variant === "cell") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`inline-flex items-center gap-1 cursor-help ${className ?? ""}`}
            >
              <span className="font-medium">≈ {formatInr(combined)}</span>
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">INR payments</span>
                <span className="font-medium">{formatInr(inr)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">USD payments</span>
                <span className="font-medium">{formatUsd(usd)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-1 mt-1">
                <span className="text-muted-foreground">Combined (≈ INR)</span>
                <span className="font-medium">{formatInr(combined)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 leading-tight">
                {COMBINED_REVENUE_SUBNOTE(rate)}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isCard = variant === "card";

  return (
    <div className={className}>
      {label && isCard && (
        <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
      )}
      {/*
        Using explicit literal class names here (not a template string) so
        Tailwind's content scanner actually sees both `space-y-2` and
        `space-y-1` and emits them into the production CSS bundle. Previously
        this was `space-y-${isCard ? "2" : "1"}`, which worked in dev (JIT
        picks up anything on demand) but silently dropped `space-y-2` from
        the compiled bundle.
      */}
      <div className={isCard ? "space-y-2" : "space-y-1"}>
        <Row
          label="Revenue from INR Payments"
          value={formatInr(inr)}
          emphasis
        />
        <Row
          label="Revenue from USD Payments"
          value={formatUsd(usd)}
          emphasis
        />
        <Row
          label="Combined Revenue (≈ INR)"
          value={formatInr(combined)}
          emphasis
          subtle
        />
      </div>
      {showSubnote && (
        <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
          {COMBINED_REVENUE_SUBNOTE(rate)}
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
  subtle,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <span
        className={`${emphasis ? "text-base font-semibold" : "text-sm"} ${
          subtle ? "text-muted-foreground" : ""
        } tabular-nums`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Compact two-row display for "Avg Order Value" style cards where we
 * only want INR and USD (no combined value).
 */
export function AvgOrderValueDisplay({
  inr,
  usd,
  className,
}: {
  inr: number | null;
  usd: number | null;
  className?: string;
}) {
  const hasInr = inr != null && inr > 0;
  const hasUsd = usd != null && usd > 0;

  if (!hasInr && !hasUsd) {
    return <div className={`text-2xl font-bold ${className ?? ""}`}>-</div>;
  }

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      {hasInr && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase text-muted-foreground">INR</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatInr(inr!)}
          </span>
        </div>
      )}
      {hasUsd && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase text-muted-foreground">USD</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatUsd(usd!)}
          </span>
        </div>
      )}
    </div>
  );
}
