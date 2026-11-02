"use client";

import { Button } from "@open-mtlms/core";
import { Lock, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

import { findNavItem, NAV_ITEMS } from "@/lib/config/navigation-registry";
import {
  useFeatureAccessStore,
  type FeatureAccessState,
} from "@/lib/stores/feature-access-store";

/* ------------------------------------------------------------------ */
/*  FeatureGate                                                        */
/* ------------------------------------------------------------------ */

interface FeatureGateProps {
  /** Feature key(s) to check. If multiple, ANY being active grants access (OR logic) */
  featureKeys: string[];
  children: React.ReactNode;
}

export function FeatureGate({ featureKeys, children }: FeatureGateProps) {
  const isReady = useFeatureAccessStore((s) => s.isReady);
  const isAnyActive = useFeatureAccessStore((s) => s.isAnyFeatureActive(featureKeys));

  // While the store is populating, render nothing to prevent flash
  if (!isReady) return null;

  if (isAnyActive) return <>{children}</>;

  // Determine which state to show (locked or coming_soon)
  const accessInfo = useFeatureAccessStore.getState().getFeatureAccess(featureKeys[0]);

  return <FeatureGateFallback featureKeys={featureKeys} state={accessInfo.state} />;
}

/* ------------------------------------------------------------------ */
/*  Fallback                                                           */
/* ------------------------------------------------------------------ */

function FeatureGateFallback({
  featureKeys,
  state,
}: {
  featureKeys: string[];
  state: FeatureAccessState;
}) {
  // Find the nav item for context (description, label)
  const navItem =
    findNavItem(featureKeys[0]) ??
    NAV_ITEMS.find((item) =>
      item.featureKeys.some((fk) => featureKeys.includes(fk))
    );

  const featureLabel = navItem?.label ?? "This feature";

  if (state === "coming_soon") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
          <Sparkles className="text-primary h-8 w-8" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Coming Soon</h2>
        <p className="text-muted-foreground mb-6 max-w-md text-center">
          {navItem?.comingSoonDescription ??
            `${featureLabel} is currently under development. Stay tuned!`}
        </p>
        <p className="text-muted-foreground/60 text-sm">
          We&apos;re working hard to bring this feature to you.
        </p>
      </div>
    );
  }

  // Locked state
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
        <Lock className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">Feature Locked</h2>
      <p className="text-muted-foreground mb-6 max-w-md text-center">
        <span className="font-medium">{featureLabel}</span> is not included in
        your current plan. Upgrade to unlock this feature and more.
      </p>
      <Button asChild>
        <Link href="/dashboard/plans">
          <Zap className="mr-2 h-4 w-4" />
          View Plans
        </Link>
      </Button>
    </div>
  );
}
