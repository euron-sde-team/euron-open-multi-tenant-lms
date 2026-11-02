"use client";

import { Button, Card, CardContent, useToast } from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BillingToggle } from "@/components/plans/BillingToggle";
import { CancelSubscriptionDialog } from "@/components/plans/CancelSubscriptionDialog";
import { CurrentSubscriptionBanner } from "@/components/plans/CurrentSubscriptionBanner";
import { EligibilityDialog } from "@/components/plans/EligibilityDialog";
import { PaymentProcessingDialog } from "@/components/plans/PaymentProcessingDialog";
import { PlanComparisonTable } from "@/components/plans/PlanComparisonTable";
import { TenantSelector } from "@/components/tenant-selector";
import { plansApi } from "@/lib/api/plans";
import { subscriptionsApi } from "@/lib/api/subscriptions";
import { applicationKeys } from "@/lib/hooks/use-applications";
import { useCurrency } from "@/lib/hooks/use-currency";
import { entitlementKeys, useEntitlements } from "@/lib/hooks/use-entitlements";
import { usePlansWithProducts } from "@/lib/hooks/use-plans";
import { sidebarKeys } from "@/lib/hooks/use-sidebar-config";
import {
  useCancelSubscription,
  useCreateCheckout,
  useCurrentSubscription,
} from "@/lib/hooks/use-subscriptions";
import { useTenantStore } from "@/lib/stores/tenant-store";

const PAYMENT_AWAIT_WINDOW_MS = 5 * 60 * 1000;
const PROCESSING_POLL_INTERVAL_MS = 2000;
const PROCESSING_DURATION_MS = 10000;

export default function PlansPage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const tenantId = useTenantStore((s) => s.selectedTenantId);

  // Data hooks
  const { data: plans, isLoading: plansLoading } = usePlansWithProducts();
  const { data: currentSubscription, refetch: refetchSubscription } =
    useCurrentSubscription();
  const { data: entitlements } = useEntitlements(tenantId ?? undefined);

  // Mutations
  const createCheckout = useCreateCheckout();
  const cancelSubscription = useCancelSubscription();

  // Local state
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY" | "TWO_YEARLY">(
    "YEARLY"
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Payment flow refs
  const paymentWindowOpenedAt = useRef<number | null>(null);
  const hadSubscriptionBeforePayment = useRef<string | null>(null);

  // Enforce sort_order from backend (defensive: backend already sorts).
  // Free plans are deprecated and hidden from the comparison table per
  // product direction, so we filter out any purchase_mode === "FREE" rows.
  //
  // Per product direction we now expose ONLY the "Scale" plan (Starter and
  // Growth are hidden). Plan names are entered manually in core-admin and may
  // carry a prefix (e.g. "LMS Scale"), so we match case-insensitively on the
  // plan_name CONTAINING "scale" ("Scale"/"SCALE"/"LMS Scale", etc.).
  const sortedPlans = useMemo(() => {
    if (!plans) return [];
    return [...plans]
      .filter((p) => p.purchase_mode !== "FREE")
      .filter((p) => p.plan_name?.toLowerCase().includes("scale"))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [plans]);

  // Compute yearly savings percentage from first plan that supports both cycles
  const yearlySavingsPercent = useMemo(() => {
    if (!sortedPlans || sortedPlans.length === 0) return undefined;
    const bothPlan = sortedPlans.find(
      (p) =>
        (p.pricing_frequency === "BOTH" || p.pricing_frequency === "ALL") &&
        (currency === "INR" ? p.price_monthly_inr : p.price_monthly_usd) > 0
    );
    if (!bothPlan) return undefined;
    const monthly =
      currency === "INR"
        ? bothPlan.price_monthly_inr
        : bothPlan.price_monthly_usd;
    const yearly =
      currency === "INR"
        ? bothPlan.price_yearly_inr
        : bothPlan.price_yearly_usd;
    if (monthly === 0) return undefined;
    return Math.round((1 - yearly / (monthly * 12)) * 100);
  }, [sortedPlans, currency]);

  // Compute two-yearly savings percentage from first plan that supports ALL cycles
  const twoYearlySavingsPercent = useMemo(() => {
    if (!sortedPlans || sortedPlans.length === 0) return undefined;
    const allPlan = sortedPlans.find(
      (p) =>
        (p.pricing_frequency === "ALL" || p.pricing_frequency === "BOTH") &&
        (currency === "INR" ? p.price_monthly_inr : p.price_monthly_usd) > 0
    );
    if (!allPlan) return undefined;
    const monthly = currency === "INR" ? allPlan.price_monthly_inr : allPlan.price_monthly_usd;
    const twoYearly = currency === "INR" ? allPlan.price_two_yearly_inr : allPlan.price_two_yearly_usd;
    if (monthly === 0) return undefined;
    return Math.round((1 - twoYearly / (monthly * 24)) * 100);
  }, [sortedPlans, currency]);

  // Current plan version ID, treat as null during scheduled cancellation
  // so all plans show "Get Started" buttons instead of "Current Plan"
  const isCancellationScheduled =
    !!currentSubscription?.cancelled_at &&
    currentSubscription.status !== "CANCELLED" &&
    currentSubscription.status !== "EXPIRED";
  const currentPlanVersionId = isCancellationScheduled
    ? null
    : (currentSubscription?.plan_version_id ?? null);

  // Selected plan object for the eligibility dialog
  const selectedPlan = useMemo(
    () => sortedPlans.find((p) => p.id === selectedPlanId) ?? null,
    [sortedPlans, selectedPlanId]
  );

  // Handle plan selection → open eligibility dialog
  const handleSelectPlan = useCallback((planVersionId: string) => {
    setSelectedPlanId(planVersionId);
  }, []);

  // Handle eligibility confirmed → create checkout
  const handleConfirmSubscribe = useCallback(
    async (planVersionId: string, cycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY") => {
      setIsSubscribing(true);
      try {
        const result = await createCheckout.mutateAsync({
          plan_version_id: planVersionId,
          billing_cycle: cycle,
          currency,
          trial_days: 0,
        });
        setSelectedPlanId(null);
        if (result.short_url) {
          hadSubscriptionBeforePayment.current =
            currentSubscription?.id ?? null;
          paymentWindowOpenedAt.current = Date.now();
          window.open(result.short_url, "_blank", "noopener,noreferrer");
          toast({
            title: "Payment opened",
            description:
              "Complete payment in the new tab. Return here when done.",
          });
        }
      } catch (err) {
        toast({
          title:
            err instanceof Error ? err.message : "Failed to create checkout",
          variant: "destructive",
        });
      } finally {
        setIsSubscribing(false);
      }
    },
    [currency, createCheckout, toast, currentSubscription?.id]
  );

  // Activate free plan
  const handleActivateFreePlan = useCallback(
    async (planVersionId: string) => {
      setIsSubscribing(true);
      try {
        await plansApi.activateFreePlan(planVersionId);
        await refetchSubscription();
        queryClient.invalidateQueries({ queryKey: applicationKeys.all });
        queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
        queryClient.invalidateQueries({ queryKey: sidebarKeys.all });
        toast({ title: "Free plan activated", description: "Your plan is now active." });
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Failed to activate free plan",
          variant: "destructive",
        });
      } finally {
        setIsSubscribing(false);
      }
    },
    [queryClient, refetchSubscription, toast]
  );

  // Cancel subscription
  const handleCancelConfirm = useCallback(async () => {
    if (!currentSubscription) return;
    try {
      await cancelSubscription.mutateAsync(currentSubscription.id);
      setCancelDialogOpen(false);
      toast({ title: "Subscription cancelled" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to cancel",
        variant: "destructive",
      });
    }
  }, [currentSubscription, cancelSubscription, toast]);

  // Payment visibility polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const openedAt = paymentWindowOpenedAt.current;
      if (!openedAt || Date.now() - openedAt > PAYMENT_AWAIT_WINDOW_MS) return;
      paymentWindowOpenedAt.current = null;
      setProcessingPayment(true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Payment processing poll loop
  useEffect(() => {
    if (!processingPayment) return;
    const start = Date.now();
    const poll = async () => {
      const elapsed = Date.now() - start;
      if (elapsed >= PROCESSING_DURATION_MS) {
        setProcessingPayment(false);
        await refetchSubscription();
        queryClient.invalidateQueries({ queryKey: applicationKeys.all });
        queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
        queryClient.invalidateQueries({ queryKey: sidebarKeys.all });
        toast({
          title: "Subscription updated",
          description: "Your plan is now active.",
        });
        return;
      }
      const sub = await subscriptionsApi.getCurrent();
      if (sub && sub.id !== hadSubscriptionBeforePayment.current) {
        setProcessingPayment(false);
        await refetchSubscription();
        queryClient.invalidateQueries({ queryKey: applicationKeys.all });
        queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
        queryClient.invalidateQueries({ queryKey: sidebarKeys.all });
        toast({
          title: "Payment successful",
          description: "Your subscription is now active.",
        });
        return;
      }
      setTimeout(poll, PROCESSING_POLL_INTERVAL_MS);
    };
    const t = setTimeout(poll, PROCESSING_POLL_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [processingPayment, queryClient, refetchSubscription, toast]);

  return (
    <div className="container mx-auto max-w-7xl py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-muted-foreground">
            Choose a plan to unlock LMS features for your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/billing/invoices")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Invoices
          </Button>
          <TenantSelector />
        </div>
      </div>

      {/* Current subscription banner */}
      {currentSubscription && (
        <CurrentSubscriptionBanner
          subscription={currentSubscription}
          onCancel={() => setCancelDialogOpen(true)}
          isCancelling={cancelSubscription.isPending}
        />
      )}

      {/* Billing toggle */}
      <BillingToggle
        billingCycle={billingCycle}
        onToggle={setBillingCycle}
        yearlySavingsPercent={yearlySavingsPercent}
        twoYearlySavingsPercent={twoYearlySavingsPercent}
      />

      {/* Plans comparison table */}
      {plansLoading && (
        <div className="space-y-4">
          <div className="bg-muted/50 h-[400px] w-full animate-pulse rounded-lg" />
        </div>
      )}
      {!plansLoading && sortedPlans.length > 0 && (
        <PlanComparisonTable
          plans={sortedPlans}
          billingCycle={billingCycle}
          currency={currency}
          currentPlanVersionId={currentPlanVersionId}
          entitlements={entitlements}
          onSelectPlan={handleSelectPlan}
          onActivateFreePlan={handleActivateFreePlan}
          isSubscribing={isSubscribing}
        />
      )}
      {!plansLoading && sortedPlans.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No plans available at the moment.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Eligibility dialog */}
      <EligibilityDialog
        plan={selectedPlan}
        billingCycle={billingCycle}
        currency={currency}
        isOpen={!!selectedPlanId}
        onConfirm={handleConfirmSubscribe}
        onCancel={() => setSelectedPlanId(null)}
        isSubscribing={isSubscribing}
      />

      {/* Cancel subscription dialog */}
      {currentSubscription && (
        <CancelSubscriptionDialog
          subscription={currentSubscription}
          isOpen={cancelDialogOpen}
          onConfirm={handleCancelConfirm}
          onCancel={() => setCancelDialogOpen(false)}
          isPending={cancelSubscription.isPending}
        />
      )}

      {/* Payment processing dialog */}
      <PaymentProcessingDialog isOpen={processingPayment} />
    </div>
  );
}
