"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Eye,
  Flame,
  Monitor,
  MousePointerClick,
  Smartphone,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AnalyticsSkeleton,
  formatDuration,
  formatTimeAgo,
  getDeviceIcon,
  tryPathname,
} from "@/components/analytics/shared";
import { resolvePageUrlForPreview } from "@/lib/constants";
import { usePageHeatmap } from "@/lib/hooks/use-dashboard";
import { useTenantWebBaseUrl } from "@/lib/hooks/use-tenant-domain-url";
import { useTenantStore } from "@/lib/stores/tenant-store";

const POSTHOG_PROJECT_ID = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID ?? "";
const POSTHOG_APP_URL = (process.env.NEXT_PUBLIC_POSTHOG_APP_URL || "https://us.posthog.com").replace(/\/+$/, "");

const PREVIEW_HEIGHT = 700;
const DESKTOP_WIDTH = 1440;
const PREVIEW_CONTAINER_WIDTH = 580;
const IFRAME_SCALE = PREVIEW_CONTAINER_WIDTH / DESKTOP_WIDTH;
/** Timeout before showing "preview blocked" fallback (cross-origin iframes often never fire onLoad) */
const IFRAME_LOAD_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------ */
/*  Main Content                                                       */
/* ------------------------------------------------------------------ */

function PageHeatmapContent() {
  const searchParams = useSearchParams();
  const pageUrl = searchParams?.get("url") ?? "";
  const { selectedTenantId, selectedTenant } = useTenantStore();
  const tenantSlug = selectedTenant?.tenant_slug;
  const tenantBaseUrl = useTenantWebBaseUrl();
  const { data, isLoading } = usePageHeatmap(
    selectedTenantId ?? undefined,
    pageUrl || undefined,
    tenantSlug
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  // Resolve localhost URLs to tenant's actual domain (from domains API; supports n tenants)
  const resolvedPageUrl = useMemo(
    () => resolvePageUrlForPreview(pageUrl, tenantBaseUrl || undefined, tenantSlug ?? undefined),
    [pageUrl, tenantBaseUrl, tenantSlug]
  );

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

  // Detect when iframe fails to load (e.g. X-Frame-Options blocks cross-origin embed in production)
  useEffect(() => {
    if (!pageUrl) return;
    setIframeBlocked(false);
    setIframeLoaded(false);
    const t = setTimeout(() => {
      setIframeBlocked(true);
    }, IFRAME_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [pageUrl]);

  if (!pageUrl) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/analytics"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Analytics
        </Link>
        <p className="text-muted-foreground">No page URL specified.</p>
      </div>
    );
  }

  if (isLoading) return <AnalyticsSkeleton />;

  const maxElemClicks = data?.top_clicked_elements?.[0]?.click_count ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/analytics"
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Analytics
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Flame className="h-6 w-6" />
              Page Heatmap
            </h1>
            <p className="text-muted-foreground mt-1 truncate text-sm" title={resolvedPageUrl}>
              {tryPathname(resolvedPageUrl)}
            </p>
            <p className="text-muted-foreground max-w-md truncate text-xs" title={resolvedPageUrl}>
              {resolvedPageUrl}
            </p>
          </div>
          <a
            href={resolvedPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Open Page
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.total_clicks ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Clickers</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.unique_clickers ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <Eye className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.total_pageviews ?? 0).toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              {(data?.unique_viewers ?? 0).toLocaleString()} unique
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(data?.avg_time_on_page_seconds ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clicks/User</CardTitle>
            <Flame className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.unique_clickers ?? 0) > 0
                ? ((data?.total_clicks ?? 0) / (data?.unique_clickers ?? 1)).toFixed(1)
                : "0"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* Page Preview                                                 */}
      {/* ============================================================ */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Flame className="h-4 w-4 text-orange-500" />
              Page Preview
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Scrollable desktop view of the page.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          <div ref={outerRef} className="flex w-full border-t" style={{ height: PREVIEW_HEIGHT }}>
            {/* Left: scaled desktop iframe preview */}
            <div
              className="relative shrink-0 overflow-hidden bg-white"
              style={{ width: PREVIEW_CONTAINER_WIDTH, height: PREVIEW_HEIGHT }}
            >
              <div
                style={{
                  width: DESKTOP_WIDTH,
                  height: PREVIEW_HEIGHT / IFRAME_SCALE,
                  transform: `scale(${IFRAME_SCALE})`,
                  transformOrigin: "top left",
                }}
              >
                <iframe
                  ref={iframeRef}
                  src={resolvedPageUrl}
                  className="h-full w-full border-0"
                  title="Page preview"
                  sandbox="allow-scripts allow-same-origin"
                  referrerPolicy="no-referrer"
                  onLoad={handleIframeLoad}
                />
              </div>

              {iframeBlocked && !iframeLoaded && (
                <div className="bg-muted/50 absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                  <p className="text-muted-foreground text-center text-sm">
                    Preview cannot be embedded (cross-origin blocked). Use the button below to open the page.
                  </p>
                  <a
                    href={resolvedPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                  >
                    Open Page <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
              {!iframeBlocked && !iframeLoaded && (
                <div className="bg-muted/50 absolute inset-0 flex items-center justify-center">
                  <div className="space-y-2 text-center">
                    <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
                    <p className="text-muted-foreground text-sm">Loading preview...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: element click details panel */}
            <div className="flex min-w-0 flex-1 flex-col border-l">
              <div className="shrink-0 border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Click Details</h3>
                <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>{(data?.total_clicks ?? 0).toLocaleString()} total clicks</span>
                  <span>{(data?.unique_clickers ?? 0).toLocaleString()} unique users</span>
                  <span>{(data?.total_pageviews ?? 0).toLocaleString()} pageviews</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Top Clicked Elements
                </p>
                {(data?.top_clicked_elements?.length ?? 0) > 0 ? (
                  <div className="space-y-1.5">
                    {data!.top_clicked_elements.map((el, i) => {
                      const pct = Math.round((el.click_count / maxElemClicks) * 100);
                      const hue = Math.max(0, 120 - Math.round((pct / 100) * 120));
                      return (
                        <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: `hsl(${hue}, 70%, 45%)` }}
                          >
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-primary/10 text-primary shrink-0 rounded px-1 py-0.5 font-mono text-[10px]">
                                {`<${el.tag}>`}
                              </span>
                              <span className="truncate text-xs" title={el.text}>
                                {el.text || "(no text)"}
                              </span>
                            </div>
                            <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: `linear-gradient(90deg, hsl(120,70%,45%), hsl(${hue},70%,45%))`,
                                }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-bold">
                            {el.click_count.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    No element click data yet
                  </p>
                )}
              </div>

              <div className="text-muted-foreground flex shrink-0 items-center gap-2 border-t px-4 py-2 text-[10px]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                Admin-only, not visible to end users
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Click Timeline (hourly) */}
      {(data?.click_timeline?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Click Activity by Hour</CardTitle>
            <CardDescription className="text-xs">
              When users click on this page (UTC). Each bar = one hour.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const byHour = new Map<number, number>();
              for (let i = 0; i < 24; i++) byHour.set(i, 0);
              for (const h of data!.click_timeline) {
                const hourNum = parseInt(h.hour.slice(0, 2), 10);
                if (!isNaN(hourNum)) byHour.set(hourNum, h.count);
              }
              const maxCount = Math.max(...byHour.values(), 1);
              const totalClicks = [...byHour.values()].reduce((a, b) => a + b, 0);
              return (
                <div className="space-y-3">
                  <div className="flex h-28 items-end gap-1">
                    {Array.from({ length: 24 }, (_, i) => {
                      const count = byHour.get(i) ?? 0;
                      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      const hue = count > 0 ? Math.max(0, 120 - Math.round((pct / 100) * 120)) : 0;
                      return (
                        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                          <div className="flex h-20 w-full flex-col justify-end">
                            {count > 0 ? (
                              <div
                                className="border-border/50 w-full rounded-t border transition-colors hover:opacity-90"
                                style={{
                                  height: `${Math.max(pct, 4)}%`,
                                  backgroundColor: `hsl(${hue}, 70%, 50%)`,
                                }}
                                title={`${String(i).padStart(2, "0")}:00, ${count} clicks`}
                              />
                            ) : (
                              <div
                                className="bg-muted/30 w-full rounded-t"
                                style={{ height: "4%" }}
                                title={`${String(i).padStart(2, "0")}:00-0 clicks`}
                              />
                            )}
                          </div>
                          <span className="text-muted-foreground text-[9px]">
                            {String(i).padStart(2, "0")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between border-t pt-1 text-xs">
                    <span>0, midnight</span>
                    <span className="text-foreground font-medium">
                      {totalClicks.toLocaleString()} total clicks
                    </span>
                    <span>23-11pm</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Click by Device & Browser */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Smartphone className="text-muted-foreground h-4 w-4" />
            <CardTitle className="text-sm font-medium">Clicks by Device</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.click_by_device?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {data!.click_by_device.map((d, i) => {
                  const DevIcon = getDeviceIcon(d.name);
                  const total = data!.click_by_device.reduce((s, x) => s + x.count, 0);
                  const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <DevIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{d.name}</span>
                          <span className="text-muted-foreground">
                            {d.count.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">No device data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Monitor className="text-muted-foreground h-4 w-4" />
            <CardTitle className="text-sm font-medium">Clicks by Browser</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.click_by_browser?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {data!.click_by_browser.map((b, i) => {
                  const total = data!.click_by_browser.reduce((s, x) => s + x.count, 0);
                  const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{b.name}</span>
                        <span className="text-muted-foreground">
                          {b.count.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">No browser data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sessions on this page */}
      {(data?.sessions_on_page?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Video className="h-4 w-4" />
              Sessions on This Page
            </CardTitle>
            <CardDescription className="text-xs">
              Recent user sessions that visited this page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] space-y-1 overflow-y-auto">
              {data!.sessions_on_page.map((session, i) => {
                const DevIcon = getDeviceIcon(session.device_type);
                const location =
                  session.city !== "Unknown"
                    ? `${session.city}, ${session.country}`
                    : session.country !== "Unknown"
                      ? session.country
                      : "-";
                const recordingUrl = POSTHOG_PROJECT_ID
                  ? `${POSTHOG_APP_URL}/project/${POSTHOG_PROJECT_ID}/replay/${session.session_id}`
                  : undefined;

                return (
                  <div
                    key={i}
                    className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <DevIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate font-mono text-xs">
                          {session.distinct_id.includes(":")
                            ? session.distinct_id.split(":")[1]?.slice(0, 8)
                            : session.distinct_id.slice(0, 8)}
                          ...
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {session.browser}/{session.os}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                        <span>{formatDuration(session.duration_seconds)}</span>
                        <span>{session.page_count} pages</span>
                        {location !== "-" && <span>{location}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-right">
                      <span className="text-muted-foreground text-xs">
                        {formatTimeAgo(session.start_time)}
                      </span>
                      {recordingUrl && (
                        <a
                          href={recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Video className="h-3 w-3" />
                          Watch
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PageHeatmapPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <PageHeatmapContent />
    </Suspense>
  );
}
