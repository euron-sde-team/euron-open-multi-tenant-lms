"use client";

import {
  AvailableRoutesProvider,
  useToast,
} from "@open-mtlms/core";
import type {
  AvailableRoutesResponse,
  PageConfig,
  TenantLayout,
  ThemeConfig,
} from "@open-mtlms/shared";
import { CalendarDays, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import {
  fetchMyBatches,
  fetchPublishedBatches,
  type PublishedBatchListItem,
} from "@/lib/api/batches";
import { emptyLayout } from "@/lib/default-layout";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useCurrency } from "@/lib/hooks/use-currency";
import { usePrice } from "@/lib/hooks/use-price";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { isResolvedPrice, isUnavailablePrice } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";

interface BatchesListingClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
}

function BatchesListingContent({
  layout,
  pageConfig,
}: Omit<BatchesListingClientProps, "availableRoutes">) {
  const { toast: _toast } = useToast();
  const batchTerm = useContentTerm("batch");
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  // Defer all icon-rendering markup to post-mount. The layout chrome above us
  // (header, sidebar, footer) flips on `mounted` state, and any conditional
  // theme-toggle / auth icons inside it can shift their SVG inner shapes
  // between SSR and the first client paint. Rendering a lightweight shell on
  // SSR keeps the icon tree stable until hydration is complete.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const theme: ThemeConfig = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["published-batches"],
    queryFn: () => fetchPublishedBatches({ page: 1, limit: 24 }),
  });

  // Enrolled-batch lookup. Only fires for authenticated visitors, guests
  // get the regular pricing CTA on every card. Failure is non-fatal: the
  // listing still renders, cards just default to "not enrolled" state.
  //
  // Scope by member id so a previous user's enrollment set can't leak
  // across logout/login or account switches, without member in the
  // queryKey, React Query would treat the prior user's response as
  // fresh for `staleTime` seconds and mark the wrong cards as
  // "Enrolled", silently changing buyer click paths to dashboard URLs
  // for batches the current user doesn't own. With member in the key,
  // an identity change becomes a different query and refetches.
  const isAuthenticated = useUserAuthStore((s) => s.isAuthenticated);
  const memberId = useUserAuthStore((s) => s.member?.id ?? null);
  const { data: myBatches = [] } = useQuery({
    queryKey: ["my-batches", memberId ?? "guest"],
    queryFn: fetchMyBatches,
    enabled: isAuthenticated && !!memberId,
    retry: false,
    staleTime: 30_000,
  });
  const enrolledBatchIds = useMemo(
    () => new Set(myBatches.map((b) => b.id)),
    [myBatches]
  );

  const batches = data?.batches ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    const q = searchQuery.toLowerCase();
    return batches.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.subtitle?.toLowerCase().includes(q) ?? false)
    );
  }, [batches, searchQuery]);

  // SSR returns a minimal shell. The layout chrome (header/sidebar/footer)
  // emits theme- and auth-driven Lucide icons whose internal SVG shapes can
  // differ between SSR and the first client paint, which trips React's
  // hydration check. Deferring the full tree to post-mount keeps SSR and the
  // first CSR render structurally identical (both render the shell).
  if (!mounted) {
    return <div className="bg-background min-h-screen" suppressHydrationWarning />;
  }

  return (
    <LayoutWrapper layout={effectiveLayout} theme={theme}>
      <div>
        {/* Hero header */}
        <div className="from-muted/50 to-background relative overflow-hidden bg-gradient-to-b px-4 pb-2 pt-8 sm:px-6 sm:pt-10">
          <div className="mx-auto max-w-6xl">
            <div className="border-primary/30 bg-primary/10 mb-3 inline-flex items-center gap-2 rounded-full border px-3.5 py-1">
              <CalendarDays className="text-primary h-3.5 w-3.5" />
              <span className="text-primary text-xs font-semibold uppercase tracking-wider">
                {batchTerm.plural}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Live cohort {batchTerm.plural.toLowerCase()}
            </h1>
            <p className="text-muted-foreground mb-6 mt-2 text-sm sm:mb-8 sm:text-base">
              Join a fixed-start {batchTerm.singular.toLowerCase()} and learn together with a unified live
              class schedule.
            </p>

            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-sm flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search ${batchTerm.plural.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-input bg-background placeholder:text-muted-foreground h-10 w-full rounded-xl border px-3 py-2 pl-9 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
          {isError && (
            <div className="border-destructive/50 bg-destructive/10 mb-8 flex flex-col items-center justify-center rounded-lg border py-12">
              <p className="text-destructive text-center text-sm sm:text-base">
                {error instanceof Error
                  ? error.message
                  : `Failed to load ${batchTerm.plural.toLowerCase()}. Please try again.`}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="hover:bg-muted mt-4 rounded-md border px-4 py-2 text-sm transition-colors"
              >
                <RefreshCw className="mr-2 inline h-4 w-4" />
                Retry
              </button>
            </div>
          )}

          {(isLoading || !currency) && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card overflow-hidden rounded-2xl border"
                >
                  <div className="bg-muted aspect-[16/9] animate-pulse" />
                  <div className="space-y-3 p-4">
                    <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && currency && !isError && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  isEnrolled={enrolledBatchIds.has(b.id)}
                />
              ))}
            </div>
          )}

          {!isLoading && currency && !isError && filtered.length === 0 && (
            <div className="bg-muted/30 border-border flex flex-col items-center justify-center rounded-2xl border py-12 sm:py-16">
              <CalendarDays className="text-muted-foreground/50 mb-4 h-12 w-12" />
              <p className="text-muted-foreground px-4 text-center text-sm sm:text-base">
                {searchQuery
                  ? `No ${batchTerm.plural.toLowerCase()} match your search.`
                  : `No ${batchTerm.plural.toLowerCase()} available yet.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </LayoutWrapper>
  );
}

/**
 * Compact batch card. Clicks through to /batches/{slug} (the consolidated
 * detail page). That page picks the default tab based on enrollment state
 * (About for visitors, Dashboard for enrolled members) and handles the
 * auth-aware "Open Dashboard" vs "Join Batch" CTA.
 */
function BatchCard({
  batch,
  isEnrolled,
}: {
  batch: PublishedBatchListItem;
  isEnrolled: boolean;
}) {
  const startDate = new Date(batch.startDate).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const { accessManaged } = useStorefrontConfig();
  const isFree = batch.purchaseMode === "FREE";
  const resolved = usePrice({
    prices:
      (batch as { prices?: Record<string, { amount: number; discount?: number | null }> | null })
        .prices ?? null,
    legacyInr: batch.priceInr,
    legacyUsd: batch.priceUsd,
    legacyDiscountInr: batch.discountInr,
    legacyDiscountUsd: batch.discountUsd,
    purchaseMode: batch.purchaseMode,
  });
  const priceUnavailable = !isFree && isUnavailablePrice(resolved);
  const priceLabel = isFree
    ? "Free"
    : priceUnavailable
      ? "Not available for purchase"
      : isResolvedPrice(resolved)
        ? resolved.format(resolved.amount)
        : "-";

  // Resolution priority: web thumbnail (Phase 10, landscape) → legacy
  // single thumbnail → cover image → mobile thumbnail (final fallback so
  // a card that only ever uploaded the portrait asset still renders
  // *something* instead of a flat grey box).
  const thumbnailSrc =
    batch.webThumbnailUrl ||
    batch.thumbnailUrl ||
    batch.coverImageUrl ||
    batch.mobileThumbnailUrl ||
    null;

  // Enrolled cards skip pricing entirely, students who already paid
  // shouldn't see the price tag, and the CTA points straight at the
  // dashboard tab instead of the marketing about page.
  const detailHref = isEnrolled
    ? `/batches/${batch.slug}?tab=overview`
    : `/batches/${batch.slug}`;

  return (
    <Link
      href={detailHref}
      className="bg-card group block overflow-hidden rounded-2xl border transition-shadow duration-200 hover:shadow-lg"
    >
      <div className="bg-muted relative aspect-[16/9] overflow-hidden">
        {thumbnailSrc && (
          <img
            src={thumbnailSrc}
            alt={batch.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          <span className="bg-background/90 rounded-full px-2.5 py-1 text-xs font-medium">
            {batch.itemCount} item{batch.itemCount === 1 ? "" : "s"}
          </span>
          {isEnrolled && (
            <span className="bg-primary/90 text-primary-foreground rounded-full px-2.5 py-1 text-xs font-semibold">
              Enrolled
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-1 text-base font-semibold">{batch.title}</h3>
        {batch.subtitle && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {batch.subtitle}
          </p>
        )}
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Starts {startDate}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          {isEnrolled ? (
            <>
              <span className="text-primary text-sm font-semibold">
                Go to Dashboard
              </span>
              <span className="text-primary text-xs font-medium">→</span>
            </>
          ) : (
            <>
              {/* Access-managed storefront: no price (or "Free") text on cards */}
              {accessManaged ? (
                <span />
              ) : (
                <span
                  className={
                    priceUnavailable
                      ? "text-muted-foreground text-xs"
                      : "text-base font-semibold"
                  }
                >
                  {priceLabel}
                </span>
              )}
              <span className="text-primary text-xs font-medium">View →</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export function BatchesListingClient(props: BatchesListingClientProps) {
  return (
    <AvailableRoutesProvider initialRoutes={props.availableRoutes ?? undefined}>
      <BatchesListingContent
        layout={props.layout}
        pageConfig={props.pageConfig}
      />
    </AvailableRoutesProvider>
  );
}
