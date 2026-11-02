"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  Pause,
  X,
  XCircle,
} from "lucide-react";

import { cn } from "@open-mtlms/core";

import { useSubscriptionAccess } from "@/lib/hooks/use-user-subscription";
import { userSubscriptionsApi } from "@/lib/api/user-subscriptions";

/**
 * Banner that shows contextual subscription status messages.
 * Only renders when the subscription is in a non-ACTIVE state.
 * Should be placed near the top of the layout (e.g., in a global wrapper).
 */
export function SubscriptionBanner() {
  const { data, isLoading } = useSubscriptionAccess();
  const [dismissed, setDismissed] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  if (isLoading || dismissed) return null;
  if (!data?.subscription) return null;

  const { status, grace_period_ends_at } = data.subscription;

  // Active subscriptions don't need a banner
  if (status === "ACTIVE") return null;

  const config = getBannerConfig(status, grace_period_ends_at);
  if (!config) return null;

  const handleUpdatePayment = async () => {
    setUpdatingPayment(true);
    try {
      const result = await userSubscriptionsApi.getPaymentUpdateLink();
      if (result.short_url) {
        window.open(result.short_url, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Silently fail, button is a convenience shortcut
    } finally {
      setUpdatingPayment(false);
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-4 py-3 text-sm",
        config.bgColor,
      )}
    >
      <config.icon className={cn("h-4 w-4 shrink-0", config.iconColor)} />
      <p className="flex-1">{config.message}</p>

      {/* CTA for HALTED status */}
      {status === "HALTED" && (
        <button
          onClick={handleUpdatePayment}
          disabled={updatingPayment}
          className="shrink-0 rounded-md bg-background/80 px-3 py-1 text-xs font-medium transition-colors hover:bg-background disabled:opacity-50"
        >
          <CreditCard className="mr-1 inline-block h-3 w-3" />
          Update Payment
        </button>
      )}

      {/* Resubscribe CTA for CANCELLED/EXPIRED/COMPLETED */}
      {(status === "EXPIRED" || status === "COMPLETED" || status === "CANCELLED") && (
        <Link
          href="/subscribe"
          className="shrink-0 rounded-md bg-background/80 px-3 py-1 text-xs font-medium transition-colors hover:bg-background"
        >
          Subscribe Again
        </Link>
      )}

      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 transition-colors hover:bg-background/50"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner configuration per status
// ---------------------------------------------------------------------------

interface BannerConfig {
  icon: typeof AlertTriangle;
  iconColor: string;
  bgColor: string;
  message: string;
}

function getBannerConfig(
  status: string,
  gracePeriodEndsAt?: string | null,
): BannerConfig | null {
  const graceDate = gracePeriodEndsAt
    ? new Date(gracePeriodEndsAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  switch (status) {
    case "PENDING":
    case "CREATED":
    case "AUTHENTICATED":
      return {
        icon: Clock,
        iconColor: "text-yellow-700",
        bgColor: "bg-yellow-50 text-yellow-800",
        message: "Your payment is being processed.",
      };

    case "HALTED":
      return {
        icon: AlertTriangle,
        iconColor: "text-red-700",
        bgColor: "bg-red-50 text-red-800",
        message:
          "Your payment failed. Please update your payment method to continue.",
      };

    case "PAUSED":
      return {
        icon: Pause,
        iconColor: "text-gray-700",
        bgColor: "bg-muted text-foreground",
        message: "Your subscription is paused.",
      };

    case "CANCELLED":
      if (graceDate) {
        return {
          icon: AlertTriangle,
          iconColor: "text-yellow-700",
          bgColor: "bg-yellow-50 text-yellow-800",
          message: `Your subscription has been cancelled. Access ends on ${graceDate}.`,
        };
      }
      return {
        icon: XCircle,
        iconColor: "text-red-700",
        bgColor: "bg-red-50 text-red-800",
        message: "Your subscription has been cancelled.",
      };

    case "EXPIRED":
    case "COMPLETED":
      return {
        icon: XCircle,
        iconColor: "text-gray-700",
        bgColor: "bg-muted text-foreground",
        message: "Your subscription has expired. Subscribe again to regain access.",
      };

    default:
      return null;
  }
}
