"use client";

import { Button, cn } from "@open-mtlms/core";
import { AlertTriangle, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useCurrentSubscription } from "@/lib/hooks/use-subscriptions";

function formatTimeRemaining(endsAt: Date): string {
  const now = new Date();
  const diff = endsAt.getTime() - now.getTime();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days} day${days !== 1 ? "s" : ""} and ${hours} hour${hours !== 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

export function GracePeriodBanner() {
  const { data: subscription, isLoading } = useCurrentSubscription();

  const bannerInfo = useMemo(() => {
    if (!subscription) return null;

    // PAST_DUE with active grace period
    if (subscription.status === "PAST_DUE" && subscription.grace_period_ends_at) {
      const endsAt = new Date(subscription.grace_period_ends_at);
      if (endsAt <= new Date()) {
        return {
          variant: "critical" as const,
          title: "Subscription expiring",
          message: "Your grace period has expired. Your account will be suspended shortly.",
          action: "View Plans",
          href: "/dashboard/plans",
        };
      }
      return {
        variant: "warning" as const,
        title: "Payment failed",
        message: `Your recurring payment could not be processed. You have ${formatTimeRemaining(endsAt)} left to update your payment method. Your subscription will end on ${endsAt.toLocaleDateString(undefined, { dateStyle: "medium" })} if not resolved.`,
        action: "Update Payment",
        href: "/dashboard/plans",
      };
    }

    return null;
  }, [subscription]);

  if (isLoading || !bannerInfo) return null;

  const isCritical = bannerInfo.variant === "critical";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-x-0 border-b px-4 py-3",
        isCritical
          ? "bg-destructive/15 text-destructive"
          : "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
      )}
    >
      <div className="flex items-center gap-3">
        {isCritical ? (
          <XCircle className="h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0" />
        )}
        <div>
          <p className="font-semibold">{bannerInfo.title}</p>
          <p className="text-sm">{bannerInfo.message}</p>
        </div>
      </div>
      <Button
        variant={isCritical ? "destructive" : "outline"}
        size="sm"
        asChild
      >
        <Link href={bannerInfo.href}>{bannerInfo.action}</Link>
      </Button>
    </div>
  );
}
