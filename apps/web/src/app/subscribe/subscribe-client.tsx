"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Crown,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { useToast } from "@open-mtlms/core";
import type { SectionConfig, SectionType, ThemeConfig, TenantLayout } from "@open-mtlms/shared";

import { getDefaultContent } from "@open-mtlms/ui-config";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { trackSubscriptionStarted } from "@/lib/analytics";
import {
  useSubscriptionPlans,
  useMySubscription,
  useSubscribe,
  useVerifySubscriptionAuth,
} from "@/lib/hooks/use-user-subscription";
import type { UserSubscriptionPlan } from "@/lib/api/user-subscriptions";

interface SubscribeClientProps {
  theme?: ThemeConfig;
  layout: TenantLayout | null;
}

type FlowStatus = "idle" | "subscribing" | "awaiting_payment" | "success" | "timeout" | "failed";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

// Default section order when no page_config is saved
const DEFAULT_SECTION_ORDER: SectionType[] = [
  "subscription-hero",
  "subscription-features",
  "subscription-comparison",
  "subscription-pricing",
  "subscription-faq",
  "subscription-cta",
];

function createDefaultSections(): SectionConfig[] {
  const defaultContents: Record<string, unknown> = {};
  for (const type of DEFAULT_SECTION_ORDER) {
    try {
      defaultContents[type] = getDefaultContent(type);
    } catch {
      defaultContents[type] = {};
    }
  }

  const now = new Date().toISOString();
  return DEFAULT_SECTION_ORDER.map((type, index) => ({
    id: `sub-${type}`,
    type,
    variant: "default",
    order: index,
    // Only show pricing by default when no config saved
    visible: type === "subscription-pricing",
    deleted: false,
    content: defaultContents[type] ?? {},
    settings: {},
    createdAt: now,
    updatedAt: now,
  }));
}

export function SubscribeClient({ theme, layout }: SubscribeClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useUserAuthStore();

  const { data: plansInfo, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: mySub, isLoading: mySubLoading, refetch: refetchMySub } = useMySubscription();
  const subscribeMutation = useSubscribe();
  const verifyMutation = useVerifySubscriptionAuth();

  const [status, setStatus] = useState<FlowStatus>("idle");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [paymentShortUrl, setPaymentShortUrl] = useState<string | null>(null);
  const gatewaySubIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const authenticatedExtendedRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleActivated = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    setStatus("success");
    toast({
      title: "Subscription activated",
      description: "Your subscription is now active.",
    });
    setTimeout(() => router.push("/account/subscription"), 1500);
  }, [toast, router]);

  // Fallback: call verify-auth endpoint which checks Razorpay directly
  const attemptFallbackVerification = useCallback(async () => {
    try {
      const result = await verifyMutation.mutateAsync({
        razorpay_subscription_id: gatewaySubIdRef.current ?? undefined,
      });
      if (result.status === "ACTIVE") {
        handleActivated();
        return;
      }
    } catch {
      // Fallback failed, not critical, show timeout UI
    }
    // Re-fetch subscription one final time after verify attempt
    const { data } = await refetchMySub();
    if (data?.status === "ACTIVE") {
      handleActivated();
    } else {
      setStatus("timeout");
    }
  }, [verifyMutation, refetchMySub, handleActivated]);

  const startPolling = useCallback(() => {
    pollStartRef.current = Date.now();
    pollTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed >= POLL_TIMEOUT_MS) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        attemptFallbackVerification();
        return;
      }
      const { data } = await refetchMySub();
      if (data?.status === "ACTIVE") {
        handleActivated();
      } else if (data?.status === "AUTHENTICATED" && !authenticatedExtendedRef.current) {
        authenticatedExtendedRef.current = true;
        pollStartRef.current = Date.now() - POLL_TIMEOUT_MS / 2;
      }
    }, POLL_INTERVAL_MS);
  }, [refetchMySub, handleActivated, attemptFallbackVerification]);

  const [selectedCycle, setSelectedCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selectedCurrency, setSelectedCurrency] = useState<"INR" | "USD">("INR");
  const [currencyAutoDetected, setCurrencyAutoDetected] = useState(false);

  const allPlans = plansInfo?.plans ?? [];
  const subscriptionName = plansInfo?.subscription_name;

  // Available currencies and cycles
  const availableCurrencies = useMemo(() => {
    const currencies = new Set(allPlans.map((p) => p.currency));
    return Array.from(currencies) as ("INR" | "USD")[];
  }, [allPlans]);

  const availableCycles = useMemo(() => {
    const plansForCurrency = allPlans.filter((p) => p.currency === selectedCurrency);
    const cycles = new Set(plansForCurrency.map((p) => p.billing_cycle));
    return Array.from(cycles) as ("MONTHLY" | "YEARLY")[];
  }, [allPlans, selectedCurrency]);

  /**
   * Report the started subscription once it is actually ACTIVE.
   *
   * Reported from an effect rather than inside handleActivated because the plan
   * list is declared below that callback, and because activation is confirmed
   * by polling, so the success state can be reached more than once.
   *
   * Meta has a dedicated Subscribe event for a paid subscription; GA4 has none,
   * so analytics.ts reports it there as a purchase.
   */
  const subscribeReportedRef = useRef(false);
  useEffect(() => {
    if (status !== "success" || subscribeReportedRef.current) return;
    const plan = allPlans.find((p) => p.id === selectedPlanId);
    if (!plan) return;
    subscribeReportedRef.current = true;
    trackSubscriptionStarted(
      gatewaySubIdRef.current ?? "",
      plan.id,
      plan.name,
      // `amount` is major units; `amount_in_smallest` is the paise figure.
      Number(plan.amount),
      plan.currency
    );
  }, [status, allPlans, selectedPlanId]);

  // Currency auto-detect on mount
  useEffect(() => {
    if (currencyAutoDetected || allPlans.length === 0) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isIndia = tz === "Asia/Kolkata" || tz === "Asia/Calcutta";
    const preferred = isIndia ? "INR" : "USD";

    if (availableCurrencies.includes(preferred)) {
      setSelectedCurrency(preferred);
    } else if (availableCurrencies.length > 0) {
      setSelectedCurrency(availableCurrencies[0]);
    }
    setCurrencyAutoDetected(true);
  }, [allPlans, availableCurrencies, currencyAutoDetected]);

  // If current cycle is unavailable for selected currency, fall back
  useEffect(() => {
    if (availableCycles.length > 0 && !availableCycles.includes(selectedCycle)) {
      setSelectedCycle(availableCycles[0]);
    }
  }, [availableCycles, selectedCycle]);

  // Filter plans for current currency
  const plansForCurrency = useMemo(
    () => allPlans.filter((p) => p.currency === selectedCurrency),
    [allPlans, selectedCurrency],
  );

  const monthlyPlan = plansForCurrency.find((p) => p.billing_cycle === "MONTHLY");
  const yearlyPlan = plansForCurrency.find((p) => p.billing_cycle === "YEARLY");

  // Calculate yearly savings
  const yearlySavingsPercent = useMemo(() => {
    if (!monthlyPlan || !yearlyPlan) return 0;
    const monthlyAnnual = parseFloat(monthlyPlan.amount) * 12;
    const yearlyAmount = parseFloat(yearlyPlan.amount);
    if (monthlyAnnual <= 0) return 0;
    return Math.round((1 - yearlyAmount / monthlyAnnual) * 100);
  }, [monthlyPlan, yearlyPlan]);

  const handleSubscribe = useCallback(
    (plan: UserSubscriptionPlan) => {
      if (!isAuthenticated) {
        router.push(`/login?redirect=${encodeURIComponent("/subscribe")}`);
        return;
      }

      setSelectedPlanId(plan.id);
      setStatus("subscribing");

      subscribeMutation.mutate(plan.id, {
        onSuccess: (result) => {
          if (result.short_url) {
            setPaymentShortUrl(result.short_url);
            gatewaySubIdRef.current = result.gateway_subscription_id;
            setStatus("awaiting_payment");
            window.open(result.short_url, "_blank", "noopener,noreferrer");
            startPolling();
          } else {
            setStatus("failed");
            toast({
              title: "Subscription created",
              description: "Could not open payment page. Please try again.",
              variant: "destructive",
            });
          }
        },
        onError: (err) => {
          setStatus("failed");
          setSelectedPlanId(null);
          toast({
            title: "Subscription failed",
            description:
              err instanceof Error ? err.message : "Something went wrong.",
            variant: "destructive",
          });
        },
      });
    },
    [isAuthenticated, router, toast, subscribeMutation, startPolling],
  );

  const isLoading = plansLoading || mySubLoading;
  const hasActiveSub = mySub && mySub.status === "ACTIVE";

  // Resolve sections from page_config or defaults
  const baseSections = useMemo<SectionConfig[]>(() => {
    const config = plansInfo?.page_config;
    if (config && Array.isArray(config) && config.length > 0) {
      return config as SectionConfig[];
    }
    return createDefaultSections();
  }, [plansInfo?.page_config]);

  // Enrich sections with live plan data for the pricing section
  const enrichedSections = useMemo(() => {
    return baseSections.map((s) => {
      if (s.type === "subscription-pricing") {
        return {
          ...s,
          content: {
            ...(s.content as Record<string, unknown>),
            __liveData: {
              plans: plansForCurrency,
              selectedCycle,
              setSelectedCycle,
              selectedCurrency,
              setSelectedCurrency,
              availableCycles,
              availableCurrencies,
              yearlySavingsPercent,
              subscriptionName,
              onSubscribe: handleSubscribe,
              isProcessing: status !== "idle" && status !== "failed",
              disabled: status !== "idle" && status !== "failed",
              selectedPlanId,
              isAuthenticated,
            },
          },
        };
      }
      if (s.type === "subscription-comparison") {
        return {
          ...s,
          content: {
            ...(s.content as Record<string, unknown>),
            __subscriptionName: subscriptionName,
          },
        };
      }
      return s;
    });
  }, [
    baseSections,
    plansForCurrency,
    selectedCycle,
    selectedCurrency,
    availableCycles,
    availableCurrencies,
    yearlySavingsPercent,
    subscriptionName,
    handleSubscribe,
    status,
    selectedPlanId,
    isAuthenticated,
  ]);

  return (
    <LayoutWrapper layout={layout} theme={theme}>
      <TenantThemeProvider theme={theme}>
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Already subscribed */}
        {!isLoading && hasActiveSub && (
          <div className="mx-auto max-w-3xl px-4 py-12">
            <div className="mx-auto max-w-md rounded-lg border bg-muted/50 p-8 text-center">
              <Crown className="mx-auto mb-4 h-10 w-10 text-primary" />
              <h2 className="text-xl font-semibold">
                You are subscribed to {mySub.plan_name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Status: {mySub.status}
              </p>
              <Link
                href="/account/subscription"
                className="mt-4 inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Manage Subscription
              </Link>
            </div>
          </div>
        )}


        {/* Section-based subscribe page */}
        {!isLoading && !hasActiveSub && (
          <>
            {plansForCurrency.length === 0 && allPlans.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                No subscription plans are currently available.
              </div>
            ) : (
              <SectionRenderer
                sections={enrichedSections}
                editMode={false}
              />
            )}
          </>
        )}

        {/* Awaiting payment overlay */}
        {status === "awaiting_payment" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="mx-4 max-w-sm rounded-lg border bg-background p-8 text-center shadow-lg">
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">
                Verifying payment...
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Complete your payment in the new tab. This page will update automatically.
              </p>
              {paymentShortUrl && (
                <a
                  href={paymentShortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open payment page again
                </a>
              )}
            </div>
          </div>
        )}

        {/* Success overlay */}
        {status === "success" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="mx-4 max-w-sm rounded-lg border bg-background p-8 text-center shadow-lg">
              <Check className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">
                Subscription Activated!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Redirecting to your subscription page...
              </p>
            </div>
          </div>
        )}

        {/* Timeout overlay */}
        {status === "timeout" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="mx-4 max-w-sm rounded-lg border bg-background p-8 text-center shadow-lg">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">
                Payment is being processed
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your payment may still be processing. You can check your subscription status or try again.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href="/account/subscription"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Check Subscription Status
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setSelectedPlanId(null);
                    setPaymentShortUrl(null);
                  }}
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Back to Plans
                </button>
              </div>
            </div>
          </div>
        )}
      </TenantThemeProvider>
    </LayoutWrapper>
  );
}
