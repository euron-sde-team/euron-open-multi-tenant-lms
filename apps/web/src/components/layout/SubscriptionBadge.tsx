"use client";

import { SafeLink } from "@open-mtlms/core";
import { Crown } from "lucide-react";

import { useSubscriptionAccess } from "@/lib/hooks/use-user-subscription";

export function SubscriptionBadge() {
  const { data: access } = useSubscriptionAccess();

  if (!access?.subscriptionsEnabled) return null;

  // Active subscriber
  if (access.hasAccess) {
    const label = access.subscriptionName
      ? access.subscriptionName.length > 12
        ? access.subscriptionName.slice(0, 12) + "\u2026"
        : access.subscriptionName
      : "Pro";

    return (
      <SafeLink
        href="/account/subscription"
        title={access.subscriptionName ?? "Pro"}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60"
      >
        <Crown className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </SafeLink>
    );
  }

  // Non-subscriber: CTA
  return (
    <SafeLink
      href="/subscribe"
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60"
    >
      <Crown className="h-4 w-4" />
      <span className="hidden sm:inline">Subscribe</span>
    </SafeLink>
  );
}
