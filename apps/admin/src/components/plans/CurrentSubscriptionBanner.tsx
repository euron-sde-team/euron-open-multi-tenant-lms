"use client";

import { Badge, Button, Card, CardContent } from "@open-mtlms/core";
import { AlertTriangle, CalendarDays, CreditCard, Download, XCircle } from "lucide-react";

import type { CurrentSubscription } from "@/lib/api/subscriptions";
import { useInvoiceUrl } from "@/lib/hooks/use-subscriptions";

interface CurrentSubscriptionBannerProps {
  subscription: CurrentSubscription;
  onCancel: () => void;
  isCancelling: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_STYLES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  ACTIVE: { variant: "default", label: "Active" },
  TRIALING: { variant: "secondary", label: "Trial" },
  PAST_DUE: { variant: "destructive", label: "Past Due" },
  CANCELLED: { variant: "destructive", label: "Cancelled" },
  EXPIRED: { variant: "outline", label: "Expired" },
};

export function CurrentSubscriptionBanner({
  subscription,
  onCancel,
  isCancelling,
}: CurrentSubscriptionBannerProps) {
  const { data: invoiceData } = useInvoiceUrl();
  const invoiceUrl = invoiceData?.invoice_url;

  const statusInfo = STATUS_STYLES[subscription.status] ?? {
    variant: "outline" as const,
    label: subscription.status,
  };

  const isAdminAllotted = !subscription.external_subscription_id;
  const isCancellationScheduled =
    !!subscription.cancelled_at &&
    subscription.status !== "CANCELLED" &&
    subscription.status !== "EXPIRED";
  const canCancel =
    !isAdminAllotted &&
    !isCancellationScheduled &&
    (subscription.status === "ACTIVE" || subscription.status === "TRIALING");
  const isPastDue = subscription.status === "PAST_DUE";

  return (
    <div className="mb-8 space-y-3">
      <Card className="border-primary/30">
        <CardContent className="py-5">
          {/* Past Due Warning */}
          {isPastDue && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Payment failed.</span>{" "}
                {subscription.grace_period_ends_at
                  ? `Grace period ends ${formatDate(subscription.grace_period_ends_at)}. Please update your payment method.`
                  : "Please update your payment method to avoid service interruption."}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Plan info */}
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">
                    {subscription.plan_name_snapshot}
                  </h3>
                  {isCancellationScheduled ? (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                    >
                      Cancellation Scheduled
                    </Badge>
                  ) : (
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  )}
                  {isAdminAllotted && (
                    <Badge variant="outline" className="text-[10px]">
                      Admin Allotted
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {subscription.billing_cycle === "MONTHLY" ? "Monthly" : "Yearly"}{" "}
                  billing
                </p>
              </div>
            </div>

            {/* Center: Billing details */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <CreditCard className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-muted-foreground">Price:</span>
                <span className="font-medium">
                  {formatPrice(subscription.price_snapshot, subscription.currency)}
                  /{subscription.billing_cycle === "MONTHLY" ? "mo" : "yr"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-muted-foreground">
                  {subscription.status === "CANCELLED" || isCancellationScheduled
                    ? "Ends:"
                    : "Renews:"}
                </span>
                <span className="font-medium">
                  {formatDate(subscription.current_period_end)}
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex shrink-0 gap-2">
              {invoiceUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Invoice
                  </a>
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  disabled={isCancelling}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Scheduled Notice */}
      {isCancellationScheduled && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-sm">
            <span className="font-medium">Your subscription has been cancelled.</span>{" "}
            You&apos;ll continue to have full access until{" "}
            <span className="font-medium">
              {formatDate(subscription.current_period_end)}
            </span>
            . After that, your dashboard features will be disabled.
          </div>
        </div>
      )}
    </div>
  );
}
