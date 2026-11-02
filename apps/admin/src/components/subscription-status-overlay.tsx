"use client";

import { Button } from "@open-mtlms/core";
import { AlertTriangle, CreditCard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  cycleWord,
  formatEndDay,
  formatMoney,
  RenewalPayDialog,
} from "@/components/renewal/renewal-pay-dialog";
import type { RenewalStatus } from "@/lib/api/subscriptions";
import { useCurrentSubscription, useRenewalStatus } from "@/lib/hooks/use-subscriptions";

const ALLOWED_PATHS = ["/dashboard/plans", "/dashboard/payment", "/dashboard/pages"];

/**
 * A renewal lock is stricter than an ended plan: the point is that the
 * dashboard stops until the plan is paid. Only paying (Plans) and the invoices
 * stay reachable. Learners' websites are NOT affected, this is the admin
 * dashboard only.
 */
const RENEWAL_LOCK_ALLOWED_PATHS = ["/dashboard/plans", "/dashboard/billing"];

export function SubscriptionStatusOverlay() {
  const { data: subscription, isLoading } = useCurrentSubscription();
  const { data: renewal } = useRenewalStatus();
  const pathname = usePathname();

  if (
    renewal?.state === "LOCKED" &&
    !RENEWAL_LOCK_ALLOWED_PATHS.some((p) => pathname?.startsWith(p))
  ) {
    return <RenewalLock renewal={renewal} />;
  }

  // Don't show overlay on allowed paths (plans, payment)
  if (ALLOWED_PATHS.some((p) => pathname?.startsWith(p))) return null;

  // Don't show while loading or if subscription exists and is active/trialing/past_due
  if (isLoading) return null;

  // Show overlay only when there's no active subscription at all (null = no subscription)
  // or when subscription is cancelled/expired
  const isCancelled =
    subscription === null ||
    subscription?.status === "CANCELLED" ||
    subscription?.status === "EXPIRED";

  if (!isCancelled) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">
          {subscription === null ? "No Active Subscription" : "Subscription Ended"}
        </h2>
        <p className="mb-2 text-muted-foreground">
          {subscription === null
            ? "You need an active subscription to access your dashboard. Choose a plan to get started."
            : `Your ${subscription.plan_name_snapshot ?? "subscription"} plan has been cancelled. Reactivate to regain full access to your dashboard.`}
        </p>
        {subscription?.cancelled_at && (
          <p className="mb-4 text-sm text-muted-foreground">
            Cancelled on{" "}
            {new Date(subscription.cancelled_at).toLocaleDateString(undefined, {
              dateStyle: "medium",
            })}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/dashboard/plans">
              <CreditCard className="mr-2 h-4 w-4" />
              {subscription === null ? "View Plans" : "Reactivate"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Expired more than 7 days ago, unpaid: the dashboard waits for the payment. */
function RenewalLock({ renewal }: { renewal: RenewalStatus }) {
  const [open, setOpen] = useState(false);
  const money = (n: number) => formatMoney(n, renewal.currency);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Payment overdue</h2>
        <p className="mb-2 text-muted-foreground">
          Your {renewal.plan_name} plan expired on {formatEndDay(renewal.period_end)}. Your
          dashboard is paused until the plan is renewed. Your website stays live for your learners.
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          {renewal.back_due_cycles > 0
            ? `Due: ${money(renewal.first_charge_total)} incl. GST, covering ${renewal.back_due_cycles} overdue ${cycleWord(renewal.billing_cycle, renewal.back_due_cycles)}${renewal.first_charge_total > renewal.back_due_total ? ` and the current ${cycleWord(renewal.billing_cycle)}` : ""}.`
            : `Due: ${money(renewal.first_charge_total)} incl. GST.`}
        </p>
        {renewal.can_pay ? (
          <>
            <Button onClick={() => setOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Pay {money(renewal.first_charge_total)}
            </Button>
            <RenewalPayDialog renewal={renewal} open={open} onOpenChange={setOpen} />
          </>
        ) : (
          <p className="text-sm font-medium">Please ask your account owner to renew the plan.</p>
        )}
      </div>
    </div>
  );
}
