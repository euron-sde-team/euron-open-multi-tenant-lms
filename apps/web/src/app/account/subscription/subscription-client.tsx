"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  Receipt,
  XCircle,
} from "lucide-react";

import { cn, useToast } from "@open-mtlms/core";
import type { ThemeConfig, TenantLayout } from "@open-mtlms/shared";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import {
  useMySubscription,
  useCancelMySubscription,
  useVerifySubscriptionAuth,
  userSubKeys,
} from "@/lib/hooks/use-user-subscription";
import { userSubscriptionsApi } from "@/lib/api/user-subscriptions";
import { useQueryClient } from "@tanstack/react-query";

interface SubscriptionClientProps {
  theme?: ThemeConfig;
  layout: TenantLayout | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CREATED: { label: "Created", color: "bg-blue-100 text-blue-700" },
  AUTHENTICATED: { label: "Authenticated", color: "bg-blue-100 text-blue-700" },
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700" },
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  HALTED: { label: "Payment Failed", color: "bg-red-100 text-red-700" },
  PAUSED: { label: "Paused", color: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-700" },
  COMPLETED: { label: "Completed", color: "bg-gray-100 text-gray-700" },
  EXPIRED: { label: "Expired", color: "bg-gray-100 text-gray-700" },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: string | null | undefined, currency: string): string {
  if (!amount) return "N/A";
  const num = parseFloat(amount);
  const symbol = currency === "INR" ? "\u20B9" : "$";
  return `${symbol}${num.toLocaleString()}`;
}

export function SubscriptionClient({ theme, layout }: SubscriptionClientProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription, isLoading } = useMySubscription();
  const cancelMutation = useCancelMySubscription();
  const verifyMutation = useVerifySubscriptionAuth();
  const verifyAttemptedRef = useRef(false);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  // Auto-verify: if subscription is stuck at CREATED/AUTHENTICATED, call verify endpoint
  useEffect(() => {
    if (
      !subscription ||
      verifyAttemptedRef.current ||
      !["CREATED", "AUTHENTICATED"].includes(subscription.status)
    ) {
      return;
    }
    verifyAttemptedRef.current = true;
    verifyMutation.mutate(
      {},
      {
        onSuccess: (result) => {
          if (result.status === "ACTIVE") {
            queryClient.invalidateQueries({ queryKey: userSubKeys.all });
          }
        },
      },
    );
  }, [subscription?.id, subscription?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = useCallback(
    (cancelAtPeriodEnd: boolean) => {
      cancelMutation.mutate(cancelAtPeriodEnd, {
        onSuccess: () => {
          setShowCancelConfirm(false);
          toast({
            title: "Cancellation initiated",
            description: cancelAtPeriodEnd
              ? "Your subscription will remain active until the end of the current billing period."
              : "Your subscription has been cancelled.",
          });
        },
        onError: (err) => {
          toast({
            title: "Cancellation failed",
            description:
              err instanceof Error ? err.message : "Something went wrong.",
            variant: "destructive",
          });
        },
      });
    },
    [cancelMutation, toast],
  );

  const handleUpdatePayment = useCallback(async () => {
    setUpdatingPayment(true);
    try {
      const result = await userSubscriptionsApi.getPaymentUpdateLink();
      if (result.short_url) {
        window.open(result.short_url, "_blank", "noopener,noreferrer");
      } else {
        toast({
          title: "No payment link available",
          description: "Please contact support to update your payment method.",
        });
      }
    } catch (err) {
      toast({
        title: "Failed to get payment link",
        description:
          err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setUpdatingPayment(false);
    }
  }, [toast]);

  const statusInfo = subscription
    ? STATUS_LABELS[subscription.status] ?? {
        label: subscription.status,
        color: "bg-gray-100 text-gray-700",
      }
    : null;

  const canCancel =
    subscription &&
    ["ACTIVE", "AUTHENTICATED", "PENDING"].includes(subscription.status) &&
    !subscription.cancel_at_period_end;

  return (
    <LayoutWrapper layout={layout} theme={theme}>
      <TenantThemeProvider theme={theme}>
        <AuthGuard>
          <div className="mx-auto max-w-3xl px-4 py-12">
            <h1 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
              My Subscription
            </h1>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* No subscription */}
            {!isLoading && !subscription && (
              <div className="rounded-lg border bg-muted/50 p-8 text-center">
                <Crown className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <h2 className="text-lg font-semibold">No active subscription</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Subscribe to a plan to get access to all content.
                </p>
                <Link
                  href="/subscribe"
                  className="mt-4 inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  View Plans
                </Link>
              </div>
            )}

            {/* Subscription details */}
            {!isLoading && subscription && (
              <div className="space-y-6">
                {/* Plan & Status card */}
                <div className="rounded-lg border bg-background p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">
                          {subscription.plan_name}
                        </h2>
                      </div>
                      {subscription.plan_description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {subscription.plan_description}
                        </p>
                      )}
                    </div>
                    {statusInfo && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          statusInfo.color,
                        )}
                      >
                        {statusInfo.label}
                      </span>
                    )}
                  </div>

                  {subscription.cancel_at_period_end && subscription.status !== "CANCELLED" && (
                    <div className="mt-4 flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Cancels at end of current billing period
                    </div>
                  )}
                </div>

                {/* Billing details */}
                <div className="rounded-lg border bg-background p-6">
                  <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Billing Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoRow
                      icon={<CreditCard className="h-4 w-4" />}
                      label="Amount"
                      value={`${formatCurrency(subscription.amount, subscription.currency)} / ${subscription.billing_cycle === "MONTHLY" ? "month" : "year"}`}
                    />
                    <InfoRow
                      icon={<Calendar className="h-4 w-4" />}
                      label="Current Period"
                      value={
                        subscription.current_period_start
                          ? `${formatDate(subscription.current_period_start)} - ${formatDate(subscription.current_period_end)}`
                          : "N/A"
                      }
                    />
                    {subscription.next_charge_at && !["CANCELLED", "EXPIRED", "COMPLETED"].includes(subscription.status) && (
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Next Charge"
                        value={formatDate(subscription.next_charge_at)}
                      />
                    )}
                    {subscription.trial_ends_at && (
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Trial Ends"
                        value={formatDate(subscription.trial_ends_at)}
                      />
                    )}
                    {subscription.grace_period_ends_at && (
                      <InfoRow
                        icon={<AlertTriangle className="h-4 w-4 text-yellow-600" />}
                        label="Grace Period Ends"
                        value={formatDate(subscription.grace_period_ends_at)}
                      />
                    )}
                  </div>
                </div>

                {/* Last payment */}
                {subscription.last_payment_at && (
                  <div className="rounded-lg border bg-background p-6">
                    <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                      Last Payment
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoRow
                        icon={<Receipt className="h-4 w-4" />}
                        label="Amount"
                        value={formatCurrency(
                          subscription.last_payment_amount,
                          subscription.currency,
                        )}
                      />
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Date"
                        value={formatDate(subscription.last_payment_at)}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  {!["CANCELLED", "EXPIRED", "COMPLETED"].includes(subscription.status) && (
                    <button
                      onClick={handleUpdatePayment}
                      disabled={updatingPayment}
                      className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {updatingPayment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      Update Payment Method
                    </button>
                  )}

                  {canCancel && (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel Subscription
                    </button>
                  )}

                  {["CANCELLED", "EXPIRED", "COMPLETED"].includes(subscription.status) && (
                    <Link
                      href="/subscribe"
                      className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Crown className="h-4 w-4" />
                      Subscribe Again
                    </Link>
                  )}
                </div>

                {/* Cancellation confirm dialog */}
                {showCancelConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
                    <div className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
                      <h3 className="text-lg font-semibold">
                        Cancel Subscription
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Are you sure you want to cancel? Your subscription will
                        be cancelled, but you&apos;ll retain access until the
                        end of your current billing period.
                      </p>
                      <div className="mt-6 flex flex-col gap-2">
                        <button
                          onClick={() => handleCancel(true)}
                          disabled={cancelMutation.isPending}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                            "bg-red-100 text-red-800 hover:bg-red-200",
                            "disabled:opacity-50",
                          )}
                        >
                          {cancelMutation.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          Cancel Subscription
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          disabled={cancelMutation.isPending}
                          className="w-full rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                        >
                          Keep Subscription
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Subscribed since */}
            {!isLoading && subscription && (
              <p className="mt-6 text-center text-xs text-muted-foreground">
                Subscribed since {formatDate(subscription.created_at)}
              </p>
            )}
          </div>
        </AuthGuard>
      </TenantThemeProvider>
    </LayoutWrapper>
  );
}

// ---------------------------------------------------------------------------
// Info Row
// ---------------------------------------------------------------------------

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
