"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { Button, Card, CardContent, Skeleton, SkeletonRows } from "@open-mtlms/core";
import type { ThemeConfig, TenantLayout } from "@open-mtlms/shared";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useTestSeriesDetail } from "@/lib/hooks/use-test-series";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { resolveSeriesTests } from "@/lib/utils/test-series-progress";

interface Props {
  slug: string;
  theme?: ThemeConfig;
  layout?: TenantLayout | null;
}

export function SeriesDashboardClient({ slug, theme, layout }: Props) {
  const { isAuthenticated } = useUserAuthStore();
  const testSeriesTerm = useContentTerm("testSeries");
  const { data: series, isLoading, error } = useTestSeriesDetail(slug);
  const resolved = useMemo(
    () => (series ? resolveSeriesTests(series) : []),
    [series]
  );

  if (isLoading) {
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-9 w-2/3" />
            <SkeletonRows rows={5} rowClassName="h-20" className="mt-6" />
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

  if (!isAuthenticated) {
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
            <Lock className="text-muted-foreground mx-auto h-10 w-10" />
            <h1 className="text-foreground mt-4 text-2xl font-bold">
              Please sign in
            </h1>
            <p className="text-muted-foreground mt-2">
              You need to be logged in to attempt tests.
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent(
                `/test-series/${slug}/dashboard`
              )}`}
            >
              <Button className="mt-6">Sign in</Button>
            </Link>
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper layout={layout ?? null} theme={theme}>
      <TenantThemeProvider theme={theme}>
        <div className="bg-background min-h-screen">
          <div className="container mx-auto max-w-4xl px-4 py-8">
            <Link
              href={`/test-series/${slug}`}
              className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {series.title}
            </Link>

            <h1 className="text-foreground text-3xl font-bold tracking-tight">
              Your tests
            </h1>
            <p className="text-muted-foreground mt-1">
              {series.totalTests} tests ·{" "}
              {series.accessMode === "SEQUENTIAL"
                ? "Tests unlock one at a time"
                : "All tests open"}
            </p>

            <div className="mt-6 space-y-3">
              {resolved.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BookOpen className="text-muted-foreground mx-auto h-10 w-10" />
                    <p className="text-muted-foreground mt-3">
                      No tests in this {testSeriesTerm.singular.toLowerCase()} yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                resolved.map(({ test: t, isLocked, cta, resultHref }, idx) => {
                  const isDone =
                    t.lastAttemptStatus === "SUBMITTED" ||
                    t.lastAttemptStatus === "AUTO_SUBMITTED";
                  const isInProgress = t.lastAttemptStatus === "IN_PROGRESS";
                  return (
                    <Card key={t.id} className={isLocked ? "opacity-70" : undefined}>
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                              isDone
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : isLocked ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              idx + 1
                            )}
                          </span>
                          <div>
                            <h3 className="text-foreground font-medium">
                              {t.name}
                              {t.isFreePreview && (
                                <span className="text-primary ml-2 text-xs font-normal">
                                  Free preview
                                </span>
                              )}
                            </h3>
                            {t.description && (
                              <p className="text-muted-foreground line-clamp-1 text-xs">
                                {t.description}
                              </p>
                            )}
                            <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                              <Clock className="h-3 w-3" />
                              {t.durationMin} min
                              <span>·</span>
                              <span>{t.totalMarks} marks</span>
                              {isInProgress && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-600 dark:text-amber-400">
                                    In progress
                                  </span>
                                </>
                              )}
                              {isDone && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    Submitted
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        {cta.kind === "locked" ? (
                          <Button size="sm" variant="outline" disabled>
                            <Lock className="mr-1 h-4 w-4" />
                            Locked
                          </Button>
                        ) : cta.kind === "scheduled" || cta.kind === "closed" ? (
                          <Button size="sm" variant="outline" disabled>
                            <Clock className="mr-1 h-4 w-4" />
                            {cta.label}
                          </Button>
                        ) : (
                          <div className="flex shrink-0 items-center gap-2">
                            {cta.kind === "reattempt" && resultHref && (
                              <Link href={resultHref}>
                                <Button size="sm" variant="outline">
                                  <BarChart3 className="mr-1 h-4 w-4" />
                                  View result
                                </Button>
                              </Link>
                            )}
                            <Link href={cta.href}>
                              <Button
                                size="sm"
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
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </TenantThemeProvider>
    </LayoutWrapper>
  );
}
