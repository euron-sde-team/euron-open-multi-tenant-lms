"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { AccessManagedCta, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, SkeletonRows, useToast } from "@open-mtlms/core";
import type { ThemeConfig, TenantLayout } from "@open-mtlms/shared";
import { useQueryClient } from "@tanstack/react-query";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { CouponOffers } from "@/components/common/CouponOffers";
import type { CouponValidationResult } from "@/lib/api/checkout";
import { useCurrencyContext } from "@/lib/hooks/use-currency";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useTestSeriesDetail } from "@/lib/hooks/use-test-series";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { checkoutApi } from "@/lib/api/checkout";
import { resolveTestSeriesPrice } from "@/lib/utils/test-series-price";
import { resolveSeriesTests } from "@/lib/utils/test-series-progress";
import { getTestSeriesCoverUrl } from "@/lib/api/test-series";

interface Props {
  slug: string;
  theme?: ThemeConfig;
  layout?: TenantLayout | null;
}

/** Compact local date+time for schedule badges, e.g. "Jun 25, 9:00 AM". */
function formatSchedule(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SeriesDetailClient({ slug, theme, layout }: Props) {
  const { isAuthenticated } = useUserAuthStore();
  const testSeriesTerm = useContentTerm("testSeries");
  const { resolvedCurrency, defaultCurrency, enabledCurrencies } = useCurrencyContext();
  const { accessManaged, supportEmail } = useStorefrontConfig();
  const { data: series, isLoading, error } = useTestSeriesDetail(slug);
  const guard = useBuyNowGuard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [coupon, setCoupon] = useState<CouponValidationResult | null>(null);

  const resolvedTests = useMemo(
    () => (series ? resolveSeriesTests(series) : []),
    [series]
  );

  const handleBuyNow = useCallback(() => {
    if (!series) return;
    const params = new URLSearchParams({ type: "TEST_SERIES", id: series.id });
    // Direct checkout re-validates ?coupon= server-side, so carrying the code
    // over means the buyer does not have to apply it a second time.
    if (coupon?.code) params.set("coupon", coupon.code);
    guard.run(() => {
      window.location.href = `/checkout/direct?${params.toString()}`;
    }, `/test-series/${slug}`);
  }, [series, guard, slug, coupon?.code]);

  const handleFreeEnroll = useCallback(() => {
    if (!series) return;
    const seriesId = series.id;
    const doEnroll = async () => {
      setIsEnrolling(true);
      // Optimistic: unlock the series immediately; rollback on failure and
      // reconverge with the server either way.
      const detailKey = ["test-series", "detail", slug];
      const prev = queryClient.getQueryData<typeof series>(detailKey);
      if (prev) queryClient.setQueryData(detailKey, { ...prev, hasAccess: true });
      try {
        await checkoutApi.freeEnroll({ order_type: "TEST_SERIES", item_id: seriesId });
        toast({
          title: "Enrolled",
          description: `You now have access to this ${testSeriesTerm.singular.toLowerCase()}.`,
        });
      } catch (err) {
        if (prev) queryClient.setQueryData(detailKey, prev);
        toast({
          title: "Enrollment failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsEnrolling(false);
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }
    };
    guard.run(() => {
      void doEnroll();
    }, `/test-series/${slug}`);
  }, [series, guard, slug, toast, queryClient]);

  if (isLoading) {
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <Skeleton className="h-4 w-28" />
            <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <SkeletonRows rows={5} rowClassName="h-16" className="mt-6" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-44 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    );
  }

  if (error || !series) {
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
            <h1 className="text-foreground text-2xl font-bold">{testSeriesTerm.singular} not found</h1>
            <p className="text-muted-foreground mt-2">
              This {testSeriesTerm.singular.toLowerCase()} doesn&apos;t exist or is no longer available.
            </p>
            <Link href="/test-series">
              <Button variant="outline" className="mt-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to catalog
              </Button>
            </Link>
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    );
  }

  const price = resolveTestSeriesPrice(series, {
    resolvedCurrency,
    defaultCurrency,
    enabledCurrencies,
  });
  const isPaid = series.pricingType === "PAID";
  const hasAccess = series.hasAccess;

  return (
    <LayoutWrapper layout={layout ?? null} theme={theme}>
      <TenantThemeProvider theme={theme}>
        <div className="bg-background min-h-screen">
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <Link
              href="/test-series"
              className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to catalog
            </Link>

            {series.coverImageKey && (
              <div className="bg-muted mb-6 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getTestSeriesCoverUrl(series.coverImageKey) ?? ""}
                  alt={series.title}
                  className="aspect-[21/9] w-full object-cover"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Main */}
              <div className="md:col-span-2">
                <h1 className="text-foreground text-3xl font-bold tracking-tight">
                  {series.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {series.totalTests} tests
                  </span>
                  {/* null validityDays = lifetime, not "no validity", render it. */}
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {series.validityDays == null
                      ? "Lifetime access"
                      : `${series.validityDays} days access`}
                  </span>
                  <span className="text-muted-foreground">
                    {series.accessMode === "SEQUENTIAL"
                      ? "Sequential unlock"
                      : "All tests open"}
                  </span>
                </div>

                {series.description && (
                  <p className="text-muted-foreground mt-4 whitespace-pre-line leading-relaxed">
                    {series.description}
                  </p>
                )}

                <h2 className="text-foreground mt-8 text-xl font-semibold">
                  Tests in this {testSeriesTerm.singular.toLowerCase()}
                </h2>
                <div className="mt-4 grid gap-4">
                  {resolvedTests.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No tests added yet.
                    </p>
                  ) : (
                    resolvedTests.map(({ test: t, isLocked, cta, schedule, resultHref }, idx) => {
                      const isDone =
                        t.lastAttemptStatus === "SUBMITTED" ||
                        t.lastAttemptStatus === "AUTO_SUBMITTED";
                      const ctaDisabled =
                        !isAuthenticated ||
                        cta.kind === "locked" ||
                        cta.kind === "scheduled" ||
                        cta.kind === "closed";
                      return (
                        <Card
                          key={t.id}
                          className={`group overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
                            isLocked ? "opacity-70" : ""
                          }`}
                        >
                          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
                            {/* Number / status badge */}
                            <span
                              className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${
                                isDone
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : isLocked
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-primary/10 text-primary"
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-6 w-6" />
                              ) : isLocked ? (
                                <Lock className="h-6 w-6" />
                              ) : (
                                idx + 1
                              )}
                            </span>

                            {/* Title + meta */}
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                {t.isFreePreview && (
                                  <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                    Free preview
                                  </span>
                                )}
                                {isDone && !t.isFreePreview && (
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    Completed
                                  </span>
                                )}
                                {schedule.notYetOpen && schedule.availableFrom && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                    <Clock className="h-3 w-3" />
                                    Opens {formatSchedule(schedule.availableFrom)}
                                  </span>
                                )}
                                {schedule.closed && (
                                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                    Closed
                                  </span>
                                )}
                                {!schedule.closed &&
                                  !schedule.notYetOpen &&
                                  schedule.availableUntil && (
                                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Closes {formatSchedule(schedule.availableUntil)}
                                    </span>
                                  )}
                              </div>
                              <h3 className="text-foreground text-lg font-semibold leading-snug">
                                {t.name}
                              </h3>
                              {t.description && (
                                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                                  {t.description}
                                </p>
                              )}
                              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-2 text-xs">
                                <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium">
                                  <Clock className="h-3.5 w-3.5" />
                                  {t.durationMin} min
                                </span>
                                <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium">
                                  {t.totalMarks} marks
                                </span>
                              </div>
                            </div>

                            {/* CTA */}
                            <div className="shrink-0 sm:w-44">
                              {ctaDisabled ? (
                                <Button variant="outline" disabled className="w-full">
                                  {cta.kind === "locked" ? (
                                    <>
                                      <Lock className="mr-1 h-4 w-4" />
                                      Locked
                                    </>
                                  ) : cta.kind === "scheduled" ? (
                                    <>
                                      <Clock className="mr-1 h-4 w-4" />
                                      {cta.label}
                                    </>
                                  ) : cta.kind === "closed" ? (
                                    "Closed"
                                  ) : (
                                    "Sign in to start"
                                  )}
                                </Button>
                              ) : (
                                <div className="space-y-2">
                                  <Link href={cta.href} className="block">
                                    <Button
                                      className="w-full"
                                      variant={
                                        cta.kind === "result" ? "outline" : "default"
                                      }
                                    >
                                      {cta.kind === "continue" && (
                                        <PlayCircle className="mr-1 h-4 w-4" />
                                      )}
                                      {cta.kind === "reattempt" && (
                                        <RotateCcw className="mr-1 h-4 w-4" />
                                      )}
                                      {cta.kind === "start" && (
                                        <PlayCircle className="mr-1 h-4 w-4" />
                                      )}
                                      {cta.label}
                                    </Button>
                                  </Link>
                                  {cta.kind === "reattempt" && resultHref && (
                                    <Link href={resultHref} className="block">
                                      <Button variant="outline" className="w-full">
                                        <BarChart3 className="mr-1 h-4 w-4" />
                                        View result
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sidebar (CTA) */}
              <aside className="md:col-span-1">
                <Card className="sticky top-6">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {hasAccess
                        ? "Get started"
                        : accessManaged
                          ? "Get access"
                          : isPaid
                            ? `Buy this ${testSeriesTerm.singular.toLowerCase()}`
                            : "Enroll for free"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {hasAccess ? (
                      <>
                        <p className="text-muted-foreground text-sm">
                          {series.accessMode === "SEQUENTIAL"
                            ? "Tests unlock as you complete them."
                            : `All tests in this ${testSeriesTerm.singular.toLowerCase()} are open. Start anytime.`}
                        </p>
                        <Link href={`/test-series/${slug}/dashboard`}>
                          <Button className="w-full">Go to dashboard</Button>
                        </Link>
                      </>
                    ) : accessManaged ? (
                      <AccessManagedCta
                        hasAccess={false}
                        supportEmail={supportEmail}
                        contactSubject={series.title}
                        fullWidth
                      />
                    ) : isPaid ? (
                      <>
                        {price && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-foreground text-3xl font-bold">
                              {price.symbol}
                              {price.format(price.effective)}
                            </span>
                            {price.hasDiscount && (
                              <>
                                <span className="text-muted-foreground text-base line-through">
                                  {price.symbol}
                                  {price.format(price.original)}
                                </span>
                                <span className="text-emerald-600 text-xs font-semibold dark:text-emerald-400">
                                  {price.savingLabel}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {series.validityDays == null
                            ? "Lifetime access, no expiry."
                            : `Access for ${series.validityDays} days after purchase.`}
                        </p>
                        <CouponOffers
                          orderType="TEST_SERIES"
                          itemId={series.id}
                          currency={price?.currency ?? resolvedCurrency}
                          applied={coupon}
                          onApply={setCoupon}
                          onRemove={() => setCoupon(null)}
                        />
                        <Button
                          className="w-full"
                          onClick={handleBuyNow}
                          disabled={!guard.isReady}
                        >
                          Buy Now
                        </Button>
                        {!isAuthenticated && (
                          <p className="text-muted-foreground text-center text-xs">
                            You can sign up at checkout.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground text-sm">
                          This {testSeriesTerm.singular.toLowerCase()} is free. Enroll to start practicing.
                        </p>
                        <Button
                          className="w-full"
                          onClick={handleFreeEnroll}
                          disabled={isEnrolling || !guard.isReady}
                        >
                          {isEnrolling && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Enroll for free
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        </div>
        <EasyCheckoutGuardModal guard={guard} />
      </TenantThemeProvider>
    </LayoutWrapper>
  );
}
