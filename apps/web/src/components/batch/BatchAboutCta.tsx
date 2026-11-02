"use client";

import { AccessManagedCta, Button, useToast } from "@open-mtlms/core";
import { getErrorMessage } from "@open-mtlms/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { fetchBatchBySlug } from "@/lib/api/batches";
import { checkoutApi } from "@/lib/api/checkout";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useCurrencyContext } from "@/lib/hooks/use-currency";
import { usePrice } from "@/lib/hooks/use-price";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { discountLabel, isResolvedPrice, isUnavailablePrice, type ContentPrice } from "@open-mtlms/shared";
import { useUserAuthStore } from "@/lib/stores/auth-store";

interface Props {
  slug: string;
  batchId: string;
  /** Batch title, used as the contact-support subject in access-managed mode. */
  title?: string;
  purchaseMode: string;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  /** Multi-currency price book when the API provides one. */
  prices?: Record<string, { amount: number | string; discount?: number | string | null }> | ContentPrice[] | null;
  /** Optional cohort start label rendered as a small footer chip in the card. */
  startDateLabel?: string;
  /**
   * How long access lasts, e.g. "Lifetime cohort access", "90 days cohort
   * access", or "Cohort access until 12 Aug 2027". Computed by the parent from
   * the batch's end date / duration / validity so the card reflects the real
   * expiry instead of always claiming lifetime.
   */
  accessLabel?: string;
}

/**
 * Pricing card for the batch detail page. Mirrors the course-detail pricing
 * widget visually: rounded-xl card, big price + strikethrough original +
 * "% off" pill, primary "Buy Now" / "Enroll Now" button, "FREE" state, and
 * an "enrolled" state that swaps the buy CTA for "Continue".
 *
 * Buying bypasses the cart entirely: a free batch calls /checkout/free-enroll
 * inline; a paid batch redirects to /checkout/direct?type=BATCH&id=...
 * (mirrors the bundle CTA flow).
 *
 * Renders only the currency that matches the viewer's timezone (INR for
 * India, USD elsewhere), same `useCurrency()` hook the courses page uses.
 * Falls back to whichever single currency the tenant has set so an INR-only
 * batch still sells outside India.
 */
export function BatchAboutCta({
  slug,
  batchId,
  title,
  purchaseMode,
  priceInr,
  priceUsd,
  discountInr,
  discountUsd,
  prices,
  startDateLabel,
  accessLabel,
}: Props) {
  // Batch pages have no coupon UI, but a shared link can carry one
  // (/batches/[slug]?coupon=CODE). Relay it into checkout rather than dropping
  // it, private coupons are never listed at checkout, so it cannot be re-entered.
  const searchParams = useSearchParams();
  const urlCoupon = searchParams.get("coupon");
  const batchCheckoutUrl = () => {
    const params = new URLSearchParams({ type: "BATCH", id: batchId });
    if (urlCoupon) params.set("coupon", urlCoupon);
    return `/checkout/direct?${params.toString()}`;
  };
  const batchTerm = useContentTerm("batch");
  const { toast } = useToast();
  const { isAuthenticated, member } = useUserAuthStore();
  const queryClient = useQueryClient();
  const [enrolling, setEnrolling] = useState(false);
  const { isLoaded: currencyLoaded } = useCurrencyContext();
  const { accessManaged, supportEmail } = useStorefrontConfig();
  const resolved = usePrice({
    prices: prices ?? null,
    legacyInr: priceInr,
    legacyUsd: priceUsd,
    legacyDiscountInr: discountInr,
    legacyDiscountUsd: discountUsd,
    purchaseMode,
  });
  const guard = useBuyNowGuard();

  // Match the parent's auth-scoped key so cache hits/refetches stay in
  // sync with `batch-detail-client.tsx`. A bare `["batch-detail", slug]`
  // would let one member's `hasAccess=true` snapshot leak across logout/
  // login or account switch, since React Query state isn't cleared on
  // logout.
  const memberScope = member?.id ?? "guest";
  const { data, isLoading } = useQuery({
    queryKey: ["batch-detail", slug, memberScope],
    queryFn: () => fetchBatchBySlug(slug),
    enabled: !!slug,
    staleTime: 60_000,
  });

  if (isLoading || !currencyLoaded) {
    return <PricingCardSkeleton />;
  }

  // Enrolled state, swap the buy CTA for "Continue" (matches the course
  // pricing card's "You have access" treatment).
  if (data?.hasAccess) {
    return (
      <PricingCard>
        <div className="text-center">
          <div className="text-primary inline-flex items-center justify-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            You&apos;re enrolled
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Continue where you left off
          </p>
        </div>
        <Button asChild size="lg" className="mt-5 w-full gap-2">
          <Link href={`/batches/${slug}?tab=overview`}>
            <GraduationCap className="h-5 w-5" />
            Continue Learning
          </Link>
        </Button>
        {startDateLabel && (
          <Footer icon={<CalendarDays className="h-3.5 w-3.5" />}>
            Cohort starts {startDateLabel}
          </Footer>
        )}
      </PricingCard>
    );
  }

  // Access-managed storefront: no price, no buy/free-enroll CTA, viewers
  // without access get the Contact Support entry point instead.
  if (accessManaged) {
    return (
      <PricingCard>
        <AccessManagedCta
          hasAccess={false}
          supportEmail={supportEmail}
          contactSubject={title ?? null}
          size="lg"
          fullWidth
        />
        {startDateLabel && (
          <Footer icon={<CalendarDays className="h-3.5 w-3.5" />}>
            Cohort starts {startDateLabel}
          </Footer>
        )}
      </PricingCard>
    );
  }

  const isFree = purchaseMode === "FREE";
  const priceUnavailable = !isFree && isUnavailablePrice(resolved);
  const price =
    isResolvedPrice(resolved) && resolved.original > 0
      ? {
          effectiveLabel: resolved.format(resolved.amount),
          originalLabel: resolved.format(resolved.original),
          discountPct: resolved.hasDiscount
            ? Math.round((1 - resolved.amount / resolved.original) * 100)
            : 0,
          // "₹100 off" for a flat discount, "10% off" for a percentage.
          savingLabel: discountLabel(resolved),
        }
      : null;

  const canPurchase = isFree || !!price;

  const handleJoin = async () => {
    if (!isAuthenticated) {
      guard.run(
        () => {
          if (isFree) {
            void doFreeEnroll();
          } else {
            window.location.href = batchCheckoutUrl();
          }
        },
        `/batches/${slug}`
      );
      return;
    }
    if (isFree) {
      setEnrolling(true);
      // Treat the freeEnroll mutation as the success boundary. Anything that
      // happens *after* the server commits the enrollment (cache invalidation,
      // refetches, telemetry) must not be able to surface a "Could not enroll"
      // toast, the user already has access and would otherwise be told to
      // retry after an irreversible state change.
      try {
        await checkoutApi.freeEnroll({ order_type: "BATCH", item_id: batchId });
      } catch (err) {
        toast({
          title: "Could not enroll",
          description: getErrorMessage(err),
          variant: "destructive",
        });
        setEnrolling(false);
        return;
      }
      toast({
        title: "Enrolled!",
        description: `You now have access to this ${batchTerm.singular.toLowerCase()}.`,
      });
      // Best-effort: refresh the parent query so the card swaps to the
      // "Continue Learning" state. Don't await and don't surface failures.
      // the next remount/refocus will refetch anyway.
      queryClient
        .invalidateQueries({
          queryKey: ["batch-detail", slug, memberScope],
        })
        .catch(() => {
          /* noop, enrollment is committed regardless */
        });
      setEnrolling(false);
      return;
    }
    window.location.href = batchCheckoutUrl();
  };

  const doFreeEnroll = async () => {
    setEnrolling(true);
    try {
      await checkoutApi.freeEnroll({ order_type: "BATCH", item_id: batchId });
    } catch (err) {
      toast({
        title: "Could not enroll",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      setEnrolling(false);
      return;
    }
    toast({
      title: "Enrolled!",
      description: `You now have access to this ${batchTerm.singular.toLowerCase()}.`,
    });
    queryClient
      .invalidateQueries({ queryKey: ["batch-detail", slug, memberScope] })
      .catch(() => {});
    setEnrolling(false);
  };

  return (
    <PricingCard>
      {isFree ? (
        <div className="text-center">
          <div className="text-primary text-4xl font-bold">FREE</div>
          <p className="text-muted-foreground mt-2 text-sm">
            Enroll now and start learning
          </p>
        </div>
      ) : price ? (
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-foreground text-3xl font-bold sm:text-4xl">
              {price.effectiveLabel}
            </span>
            {price.discountPct > 0 && (
              <>
                <span className="text-muted-foreground text-base line-through">
                  {price.originalLabel}
                </span>
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                  {price.savingLabel}
                </span>
              </>
            )}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            One-time payment · {accessLabel ?? "Lifetime cohort access"}
          </p>
        </div>
      ) : priceUnavailable ? (
        <div className="text-muted-foreground py-2 text-sm">
          Not available for purchase
        </div>
      ) : (
        <div className="text-muted-foreground py-2 text-sm">
          Pricing not yet configured.
        </div>
      )}

      <Button
        size="lg"
        className="mt-5 w-full gap-2"
        disabled={!canPurchase || enrolling}
        onClick={canPurchase ? handleJoin : undefined}
      >
        {enrolling ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Enrolling…
          </>
        ) : (
          <>{isFree ? "Enroll Now" : "Buy Now"}</>
        )}
      </Button>

      {startDateLabel && (
        <Footer icon={<CalendarDays className="h-3.5 w-3.5" />}>
          Cohort starts {startDateLabel}
        </Footer>
      )}
      <EasyCheckoutGuardModal guard={guard} />
    </PricingCard>
  );
}

function PricingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <p className="text-muted-foreground border-b px-6 py-3 text-xs font-medium uppercase tracking-wider">
        Pricing
      </p>
      <div className="p-6">{children}</div>
    </div>
  );
}

function PricingCardSkeleton() {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="border-b px-6 py-3">
        <div className="bg-muted h-3 w-16 animate-pulse rounded" />
      </div>
      <div className="space-y-3 p-6">
        <div className="bg-muted h-9 w-32 animate-pulse rounded" />
        <div className="bg-muted h-3 w-40 animate-pulse rounded" />
        <div className="bg-muted h-11 w-full animate-pulse rounded" />
      </div>
    </div>
  );
}

function Footer({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="text-muted-foreground mt-4 flex items-center gap-1.5 text-xs">
      {icon}
      <span className="truncate">{children}</span>
    </div>
  );
}

