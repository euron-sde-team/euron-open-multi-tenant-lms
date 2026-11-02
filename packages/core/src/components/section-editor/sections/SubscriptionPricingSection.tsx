"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, SubscriptionPricingContent } from "@open-mtlms/shared";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";

import { cn } from "../../../lib/utils";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

interface SubscriptionPricingSectionProps {
  section: SectionConfig;
}

export function SubscriptionPricingSection({ section }: SubscriptionPricingSectionProps) {
  const content = section.content as SubscriptionPricingContent;
  const { EditableText, isEditMode, updateSectionContent } = useSectionEditor();
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof SubscriptionPricingContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  // Live data injected from web subscribe page (not stored in DB)
  const liveData = content.__liveData as {
    plans?: Array<{
      id: string;
      name: string;
      description: string | null;
      billing_cycle: "MONTHLY" | "YEARLY";
      currency: string;
      amount: string;
      trial_days: number;
      features_summary: string | null;
    }>;
    selectedCycle?: "MONTHLY" | "YEARLY";
    setSelectedCycle?: (cycle: "MONTHLY" | "YEARLY") => void;
    selectedCurrency?: "INR" | "USD";
    setSelectedCurrency?: (currency: "INR" | "USD") => void;
    availableCycles?: ("MONTHLY" | "YEARLY")[];
    availableCurrencies?: ("INR" | "USD")[];
    yearlySavingsPercent?: number;
    subscriptionName?: string | null;
    onSubscribe?: (plan: unknown) => void;
    isProcessing?: boolean;
    disabled?: boolean;
    selectedPlanId?: string | null;
    isAuthenticated?: boolean;
  } | undefined;

  const hasLiveData = !!liveData?.plans;

  return (
    <section
      id="pricing"
      className={cn(
        "px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h2"
            className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"
          />
          {content.subheadline && (
            <div className="mt-3 sm:mt-4">
              <EditableText
                value={content.subheadline}
                onChange={(value) => handleContentUpdate("subheadline", value)}
                styleKey="subheadline"
                as="p"
                className="text-base text-muted-foreground sm:text-lg"
              />
            </div>
          )}
        </div>

        {/* Pricing content */}
        <div className="mx-auto mt-10 max-w-xl sm:mt-12">
          {/* Admin preview mode, no live data */}
          {!hasLiveData && (
            <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-10 text-center">
              <CreditCard className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">
                {isEditMode
                  ? "Pricing plans will be displayed here using live data from the API."
                  : "No plans available."}
              </p>
            </div>
          )}

          {/* Live data mode, real plans from API */}
          {hasLiveData && liveData && (
            <div className="space-y-6">
              {/* Billing toggles */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                {(liveData.availableCycles?.length ?? 0) > 1 && (
                  <div className="inline-flex rounded-full border bg-muted/50 p-1">
                    <button
                      type="button"
                      onClick={() => liveData.setSelectedCycle?.("MONTHLY")}
                      className={cn(
                        "rounded-full px-5 py-2 text-xs font-semibold transition-all sm:text-sm",
                        liveData.selectedCycle === "MONTHLY"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <EditableLabel value={content.monthlyLabel} fallback="Monthly" onChange={(v) => handleContentUpdate("monthlyLabel", v)} />
                    </button>
                    <button
                      type="button"
                      onClick={() => liveData.setSelectedCycle?.("YEARLY")}
                      className={cn(
                        "rounded-full px-5 py-2 text-xs font-semibold transition-all sm:text-sm",
                        liveData.selectedCycle === "YEARLY"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <EditableLabel value={content.yearlyLabel} fallback="Yearly" onChange={(v) => handleContentUpdate("yearlyLabel", v)} />
                      {(liveData.yearlySavingsPercent ?? 0) > 0 && (
                        <span className="ml-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary sm:text-xs">
                          -{liveData.yearlySavingsPercent}%
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {(liveData.availableCurrencies?.length ?? 0) > 1 && (
                  <div className="inline-flex items-center gap-0.5 rounded-full border bg-muted/50 p-1">
                    {liveData.availableCurrencies?.map((currency) => (
                      <button
                        key={currency}
                        type="button"
                        onClick={() => liveData.setSelectedCurrency?.(currency)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                          liveData.selectedCurrency === currency
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {currency === "INR" ? "₹ INR" : "$ USD"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan cards */}
              {liveData.plans?.map((plan) => {
                const amount = parseFloat(plan.amount);
                const cycle = plan.billing_cycle === "MONTHLY" ? "month" : "year";
                const currencySymbol = plan.currency === "INR" ? "\u20B9" : "$";
                const isSelected = liveData.selectedPlanId === plan.id;

                return (
                  <div
                    key={plan.id}
                    className="relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-lg"
                  >
                    {/* Popular badge */}
                    {plan.billing_cycle === "YEARLY" && (liveData.availableCycles?.length ?? 0) > 1 && (
                      <div className="flex items-center justify-center gap-1 bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">
                        <Sparkles className="h-3 w-3" />
                        <EditableLabel value={content.popularBadgeLabel} fallback="Best Value" onChange={(v) => handleContentUpdate("popularBadgeLabel", v)} />
                      </div>
                    )}

                    <div className="p-5 sm:p-6">
                      {/* Plan header + price */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-base font-bold sm:text-lg">{plan.name}</h3>
                          {plan.description && (
                            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{plan.description}</p>
                          )}
                        </div>
                        <div className="flex items-baseline gap-0.5 sm:text-right">
                          <span className="text-3xl font-extrabold tabular-nums sm:text-4xl">
                            {currencySymbol}{amount.toLocaleString()}
                          </span>
                          <span className="text-sm text-muted-foreground">/{cycle}</span>
                        </div>
                      </div>

                      {plan.trial_days > 0 && (
                        <p className="mt-2 text-xs font-medium text-primary">
                          {plan.trial_days}-day free trial included
                        </p>
                      )}

                      {/* Subscribe button */}
                      <button
                        type="button"
                        onClick={() => liveData.onSubscribe?.(plan)}
                        disabled={liveData.disabled}
                        className={cn(
                          "mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all sm:text-base",
                          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      >
                        {isSelected && liveData.isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            {content.ctaText || "Subscribe Now"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Features list from content */}
              {content.features && content.features.length > 0 && (
                <div className="mx-auto max-w-md rounded-xl border bg-card/50 p-5 sm:p-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">What&apos;s included</p>
                  <ul className="space-y-2.5">
                    {content.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                          <Check className="h-2.5 w-2.5 text-primary" />
                        </div>
                        {isEditMode ? (
                          <EditableText
                            value={feature}
                            onChange={(value) => {
                              const newFeatures = [...(content.features || [])];
                              newFeatures[idx] = value;
                              handleContentUpdate("features", newFeatures);
                            }}
                          />
                        ) : (
                          <span>{feature}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
