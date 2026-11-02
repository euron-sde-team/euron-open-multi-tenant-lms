"use client";

import { AvailableRoutesProvider } from "@open-mtlms/core";
import type {
  AvailableRoutesResponse,
  PageConfig,
  TenantLayout,
} from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Share2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ShareModal } from "@/components/share-modal";
import { BatchPillNav } from "@/components/batch/BatchPillNav";
import {
  defaultBatchTab,
  isValidBatchTab,
  type BatchTabKey,
} from "@/components/batch/batch-tabs";
import { BatchAboutTab } from "@/components/batch/tabs/BatchAboutTab";
import { BatchContentTab } from "@/components/batch/tabs/BatchContentTab";
import { BatchLeaderboardTab } from "@/components/batch/tabs/BatchLeaderboardTab";
import { BatchOverviewTab } from "@/components/batch/tabs/BatchOverviewTab";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import {
  fetchBatchBySlug,
  type PublishedBatchDetail,
} from "@/lib/api/batches";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useUserAuthStore } from "@/lib/stores/auth-store";

interface BatchDetailClientProps {
  slug: string;
  batch: PublishedBatchDetail;
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
  tenantName: string;
  availableRoutes?: AvailableRoutesResponse | null;
}

export function BatchDetailClient(props: BatchDetailClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <BatchDetailContent {...rest} />
    </AvailableRoutesProvider>
  );
}

/**
 * Single canonical detail page for a batch. Pill nav at the top of the page
 * body switches the active tab via the `?tab=` query param. We re-fetch the
 * batch on the client because SSR has no access to the user's bearer token,
 * so `hasAccess` from the SSR payload is unreliable.
 */
function BatchDetailContent({
  slug,
  batch: initialBatch,
  layout,
  pageConfig,
  tenantName,
}: Omit<BatchDetailClientProps, "availableRoutes">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = pageConfig?.theme ?? null;
  const batchTerm = useContentTerm("batch");
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Defer the icon-heavy tree (pill nav + tab content) to post-mount. Both
  // the layout chrome above and the Lucide icons inside the pill nav have
  // produced false-positive hydration mismatches (browser extensions like
  // Dark Reader can mutate SVGs, theme toggles flip mid-render). Rendering
  // an empty shell on SSR and the first client paint guarantees the two
  // trees are byte-identical, so React's hydration check always passes.
  // This is the same pattern `DashboardHeader`, `TopBar`, and the
  // `BatchesListingContent` use elsewhere in the app.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * Back-button behaviour:
   *   • If there's an in-app history entry, pop it (preserves scroll/tab
   *     state on the previous page).
   *   • If the learner deep-linked into the page (no history, or the
   *     referrer is from a different origin / the marketing listing), fall
   *     back to the public `/batches` listing so they always have somewhere
   *     to go.
   */
  const handleBack = useCallback(() => {
    if (typeof window === "undefined") return;
    const hasInAppHistory =
      window.history.length > 1 &&
      !!document.referrer &&
      document.referrer.startsWith(window.location.origin);
    if (hasInAppHistory) {
      router.back();
    } else {
      router.push("/batches");
    }
  }, [router]);

  // Scope by member identity. `fetchBatchBySlug()` is auth-sensitive.
  // the response's `hasAccess` field reflects whether the *current* user
  // is enrolled. A bare `["batch-detail", slug]` key would let one
  // member's `hasAccess=true` snapshot leak to a guest or different
  // member on the same browser session (logout/login or account switch
  // does NOT clear React Query state, only Zustand/localStorage).
  // Including the member id (or "guest") in the key makes account
  // switches a different query, so the cached enrollment-derived UI
  // can't survive an identity change.
  const memberScope = useUserAuthStore((s) => s.member?.id ?? "guest");
  const { data: batch = initialBatch } = useQuery({
    queryKey: ["batch-detail", slug, memberScope],
    queryFn: () => fetchBatchBySlug(slug),
    enabled: !!slug,
    initialData: initialBatch,
    // SSR has no bearer token, so `initialBatch.hasAccess` is always
    // undefined. Without `initialDataUpdatedAt: 0`, React Query treats
    // initial data as fresh forever, never refetches with auth, and the
    // CTA below (which shares this queryKey via the cache) keeps showing
    // "Buy Now" even for already-enrolled buyers. Marking the SSR snapshot
    // as already-stale forces a CSR refetch on mount that fills in
    // `hasAccess` from the user's session.
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
  });

  const hasAccess = !!batch.hasAccess;
  const requested = searchParams?.get("tab");
  const activeTab: BatchTabKey = isValidBatchTab(requested)
    ? requested
    : defaultBatchTab(hasAccess);

  // SSR + first-paint shell. `suppressHydrationWarning` covers the
  // intentional swap from this empty div to the full content tree on the
  // next render, without it React would log a (harmless) warning about
  // the mounted-state branch.
  if (!mounted) {
    return (
      <div
        className="bg-background min-h-screen"
        suppressHydrationWarning
      />
    );
  }

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/batches/${batch.slug ?? slug}`;

  return (
    <LayoutWrapper layout={layout} theme={theme}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            aria-label="Share this batch"
            className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        <BatchPillNav slug={slug} activeTab={activeTab} />

        {activeTab === "overview" && (
          <BatchOverviewTab slug={slug} batch={batch} />
        )}
        {activeTab === "about" && (
          <BatchAboutTab slug={slug} batch={batch} tenantName={tenantName} />
        )}
        {activeTab === "content" && (
          <BatchContentTab slug={slug} hasAccess={hasAccess} />
        )}
        {activeTab === "leaderboard" && (
          <BatchLeaderboardTab slug={slug} hasAccess={hasAccess} />
        )}
      </div>
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        url={shareUrl}
        title={batch.title ?? batchTerm.singular}
        modalTitle={`Share this ${batchTerm.singular.toLowerCase()}`}
      />
    </LayoutWrapper>
  );
}
