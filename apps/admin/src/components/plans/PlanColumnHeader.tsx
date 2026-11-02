"use client";

import { Badge, Button, cn } from "@open-mtlms/core";
import { ArrowUp, Check, Loader2, Zap } from "lucide-react";

import type { PlanWithProducts } from "@/lib/api/plans";

type PlanRelation = "current" | "upgrade" | "downgrade" | "new";

interface PlanColumnHeaderProps {
  plan: PlanWithProducts;
  billingCycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
  currency: "INR" | "USD";
  relation: PlanRelation;
  onSelect: (planVersionId: string) => void;
  onActivateFreePlan?: (planVersionId: string) => void;
  isSubscribing: boolean;
}

function formatPrice(amount: number, currency: "INR" | "USD"): string {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PlanColumnHeader({
  plan,
  billingCycle,
  currency,
  relation,
  onSelect,
  onActivateFreePlan,
  isSubscribing,
}: PlanColumnHeaderProps) {
  const isFree = plan.purchase_mode === "FREE";

  const supportsMonthly =
    plan.pricing_frequency === "MONTHLY" || plan.pricing_frequency === "BOTH" || plan.pricing_frequency === "ALL";
  const supportsYearly =
    plan.pricing_frequency === "YEARLY" || plan.pricing_frequency === "BOTH" || plan.pricing_frequency === "ALL";
  const supportsTwoYearly =
    plan.pricing_frequency === "TWO_YEARLY" || plan.pricing_frequency === "ALL" || plan.pricing_frequency === "BOTH";

  const priceMonthly =
    currency === "INR" ? plan.price_monthly_inr : plan.price_monthly_usd;
  const priceYearly =
    currency === "INR" ? plan.price_yearly_inr : plan.price_yearly_usd;
  const priceTwoYearly =
    currency === "INR" ? plan.price_two_yearly_inr : plan.price_two_yearly_usd;

  // Determine displayed price based on billing cycle
  let displayPrice: number;
  let priceSuffix: string;
  let subText: string | null = null;

  if (isFree) {
    displayPrice = 0;
    priceSuffix = "";
  } else if (billingCycle === "TWO_YEARLY" && supportsTwoYearly) {
    displayPrice = priceTwoYearly;
    priceSuffix = "/2yr";
    if (priceTwoYearly > 0) {
      const monthlyEquiv = Math.round((priceTwoYearly / 24) * 100) / 100;
      subText = `≈ ${formatPrice(monthlyEquiv, currency)}/mo`;
    }
  } else if (billingCycle === "YEARLY" && supportsYearly) {
    displayPrice = priceYearly;
    priceSuffix = "/yr";
    if (priceYearly > 0) {
      const monthlyEquiv = Math.round((priceYearly / 12) * 100) / 100;
      subText = `≈ ${formatPrice(monthlyEquiv, currency)}/mo`;
    }
  } else if (supportsMonthly) {
    displayPrice = priceMonthly;
    priceSuffix = "/mo";
  } else if (supportsTwoYearly) {
    displayPrice = priceTwoYearly;
    priceSuffix = "/2yr";
    subText = "2 Yearly only";
  } else {
    // Plan only supports yearly but user is viewing monthly
    displayPrice = priceYearly;
    priceSuffix = "/yr";
    subText = "Yearly only";
  }

  const isCurrent = relation === "current";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-4 py-6",
        isCurrent && "bg-primary/5"
      )}
    >
      {/* Plan name + badge */}
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">{plan.plan_name}</h3>
        {isCurrent && (
          <Badge variant="default" className="text-[10px]">
            Current
          </Badge>
        )}
      </div>

      {/* Description */}
      {plan.plan_description && (
        <p className="text-muted-foreground text-center text-xs">
          {plan.plan_description}
        </p>
      )}

      {/* Price */}
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-bold tracking-tight">
            {isFree ? "Free" : formatPrice(displayPrice, currency)}
          </span>
          {!isFree && displayPrice > 0 && (
            <span className="text-muted-foreground text-sm">{priceSuffix}</span>
          )}
        </div>
        {subText && (
          <p className="text-muted-foreground mt-0.5 text-xs">{subText}</p>
        )}
        {!isFree && displayPrice > 0 && (
          <p className="text-muted-foreground mt-0.5 text-xs">+18% taxes applicable</p>
        )}
      </div>

      {/* CTA */}
      {isCurrent ? (
        <Button variant="outline" size="sm" disabled className="w-full max-w-[160px]">
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Current Plan
        </Button>
      ) : isFree ? (
        <Button
          size="sm"
          onClick={() => onActivateFreePlan ? onActivateFreePlan(plan.id) : onSelect(plan.id)}
          disabled={isSubscribing}
          className="w-full max-w-[160px]"
        >
          {isSubscribing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="mr-1.5 h-3.5 w-3.5" />
          )}
          Get Started
        </Button>
      ) : relation === "downgrade" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelect(plan.id)}
          disabled={isSubscribing}
          className="w-full max-w-[160px]"
        >
          {isSubscribing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUp className="mr-1.5 h-3.5 w-3.5 rotate-180" />
          )}
          Downgrade
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => onSelect(plan.id)}
          disabled={isSubscribing}
          className="w-full max-w-[160px]"
        >
          {isSubscribing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="mr-1.5 h-3.5 w-3.5" />
          )}
          {relation === "upgrade" ? "Upgrade" : "Get Started"}
        </Button>
      )}
    </div>
  );
}
