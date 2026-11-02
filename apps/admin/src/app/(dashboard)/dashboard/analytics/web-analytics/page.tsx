"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@open-mtlms/core";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Eye,
  ExternalLink,
  Flame,
  Globe,
  GraduationCap,
  Loader2,
  Monitor,
  MousePointerClick,
  Search,
  Smartphone,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ExcelExportButton } from "@/components/analytics/excel-export";
import {
  AnalyticsSkeleton,
  formatDuration,
  formatTimeAgo,
  getDeviceIcon,
  ListCard,
  StatCard,
  tryPathname,
} from "@/components/analytics/shared";
import { SetupOrganizationCard } from "@/components/dashboard/SetupOrganizationCard";
import {
  dashboardApi,
  type PageHeatmapItem,
  type UserSessionItem,
} from "@/lib/api/dashboard";
import {
  useBookAccessBreakdown,
  useEnrollmentBreakdown,
  usePostHogInsights,
  useUserStats,
} from "@/lib/hooks/use-dashboard";
import { useTenantStore } from "@/lib/stores/tenant-store";

const POSTHOG_PROJECT_ID = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID ?? "";
const POSTHOG_APP_URL = (process.env.NEXT_PUBLIC_POSTHOG_APP_URL || "https://us.posthog.com").replace(/\/+$/, "");

function normalizePageHeatmaps(items: PageHeatmapItem[]): PageHeatmapItem[] {
  const byNormalized = new Map<string, PageHeatmapItem>();
  for (const p of items) {
    let url = p.page_url;
    try {
      const u = new URL(p.page_url);
      if (u.pathname === "/home" || u.pathname === "/home/") {
        u.pathname = "/";
        url = u.toString();
      }
    } catch {
      // keep as-is if URL parse fails
    }
    const existing = byNormalized.get(url);
    if (existing) {
      existing.total_clicks += p.total_clicks;
      existing.unique_clickers += p.unique_clickers;
      existing.top_clicked_elements = [
        ...existing.top_clicked_elements,
        ...p.top_clicked_elements,
      ]
        .sort((a, b) => b.click_count - a.click_count)
        .slice(0, 10);
    } else {
      byNormalized.set(url, { ...p, page_url: url });
    }
  }
  return Array.from(byNormalized.values());
}

function normalizeTopPages(
  items: Array<{ url: string; count: number }>
): Array<{ url: string; count: number }> {
  const byNormalized = new Map<string, number>();
  for (const p of items) {
    let url = p.url;
    try {
      const u = new URL(p.url);
      if (u.pathname === "/home" || u.pathname === "/home/") {
        u.pathname = "/";
        url = u.toString();
      }
    } catch {
      /* keep as-is */
    }
    byNormalized.set(url, (byNormalized.get(url) ?? 0) + p.count);
  }
  return Array.from(byNormalized.entries())
    .map(([url, count]) => ({ url, count }))
    .sort((a, b) => b.count - a.count);
}

export default function WebAnalyticsPage() {
  const { tenants, selectedTenantId, selectedTenant } = useTenantStore();
  const tenantSlug = selectedTenant?.tenant_slug;
  const { data: insights, isLoading } = usePostHogInsights(
    selectedTenantId ?? undefined,
    tenantSlug
  );

  const [courseSearch, setCourseSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [debouncedCourseSearch, setDebouncedCourseSearch] = useState("");
  const [debouncedBookSearch, setDebouncedBookSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingEmbedUrl, setRecordingEmbedUrl] = useState<string | null>(
    null
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [directPostHogUrl, setDirectPostHogUrl] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCourseSearch(courseSearch), 300);
    return () => clearTimeout(t);
  }, [courseSearch]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBookSearch(bookSearch), 300);
    return () => clearTimeout(t);
  }, [bookSearch]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserSearch(userSearch), 300);
    return () => clearTimeout(t);
  }, [userSearch]);

  const { data: enrollments } = useEnrollmentBreakdown(
    selectedTenantId ?? undefined,
    20,
    debouncedCourseSearch || undefined
  );
  const { data: bookAccess } = useBookAccessBreakdown(
    selectedTenantId ?? undefined,
    20,
    debouncedBookSearch || undefined
  );
  const { data: userStats } = useUserStats(
    selectedTenantId ?? undefined,
    1,
    20,
    debouncedUserSearch || undefined
  );

  // Platform admins have no memberships but operate a selected tenant, so gate
  // the setup card on the active selection, not the membership list.
  if (tenants.length === 0 && !selectedTenantId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <SetupOrganizationCard />
      </div>
    );
  }

  const insightsLoading = isLoading;
  const pageHeatmaps = normalizePageHeatmaps(
    insights?.page_heatmaps ?? []
  );
  const maxClicks = Math.max(
    ...pageHeatmaps.map((p) => p.total_clicks),
    1
  );

  const courses = enrollments ?? [];
  const books = bookAccess ?? [];
  const users = userStats?.members ?? [];

  const handleWatchRecording = async (
    sessionId: string,
    directUrl: string
  ) => {
    setRecordingLoading(true);
    setRecordingEmbedUrl(null);
    setIframeLoaded(false);
    setEmbedFailed(false);
    setDirectPostHogUrl(directUrl);
    const result = await dashboardApi.getPostHogReplayEmbedToken(
      sessionId,
      tenantSlug
    );
    setRecordingLoading(false);
    if (result?.embedUrl) {
      setRecordingEmbedUrl(result.embedUrl);
    } else {
      window.open(directUrl, "_blank", "noopener,noreferrer");
    }
  };

  const webStatsExport = [
    { Metric: "Page Views", Value: insights?.page_views ?? 0 },
    { Metric: "Unique Visitors", Value: insights?.unique_visitors ?? 0 },
    { Metric: "Sessions", Value: insights?.session_count ?? 0 },
    { Metric: "Bounce Rate", Value: `${insights?.bounce_rate ?? 0}%` },
    { Metric: "DAU", Value: insights?.daily_active_users ?? 0 },
    { Metric: "WAU", Value: insights?.weekly_active_users ?? 0 },
    { Metric: "MAU", Value: insights?.monthly_active_users ?? 0 },
    { Metric: "New Visitors", Value: insights?.new_visitors ?? 0 },
    {
      Metric: "Returning Visitors",
      Value: insights?.returning_visitors ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Web Vitals</h1>
          <p className="text-sm text-muted-foreground">
            Engagement and performance insights (Last 30 Days)
          </p>
        </div>
        <ExcelExportButton
          data={webStatsExport}
          fileName="web-analytics"
          label="Export"
        />
      </div>

      {/* Primary Engagement Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Page Views"
          value={insightsLoading ? "-" : (insights?.page_views ?? 0)}
          icon={Eye}
          subtitle="Total pageviews"
        />
        <StatCard
          title="Unique Visitors"
          value={insightsLoading ? "-" : (insights?.unique_visitors ?? 0)}
          icon={Users}
          subtitle="Distinct users"
        />
        <StatCard
          title="Sessions"
          value={insightsLoading ? "-" : (insights?.session_count ?? 0)}
          icon={MousePointerClick}
          subtitle={
            insightsLoading
              ? "Loading…"
              : `Avg. ${formatDuration(insights?.avg_session_duration_seconds ?? 0)}`
          }
        />
        <StatCard
          title="Bounce Rate"
          value={
            insightsLoading ? "-" : `${insights?.bounce_rate ?? 0}%`
          }
          icon={Activity}
          subtitle="Single-page sessions"
        />
      </div>

      {/* Active Users */}
      <div className="grid gap-4 grid-cols-3">
        <StatCard
          title="DAU"
          value={insightsLoading ? "-" : (insights?.daily_active_users ?? 0)}
          icon={Zap}
          subtitle="Daily active users"
        />
        <StatCard
          title="WAU"
          value={insightsLoading ? "-" : (insights?.weekly_active_users ?? 0)}
          icon={BarChart3}
          subtitle="Weekly active users"
        />
        <StatCard
          title="MAU"
          value={
            insightsLoading ? "-" : (insights?.monthly_active_users ?? 0)
          }
          icon={Users}
          subtitle="Monthly active users"
        />
      </div>

      {/* New vs Returning */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="New Visitors"
          value={insightsLoading ? "-" : (insights?.new_visitors ?? 0)}
          icon={UserPlus}
          subtitle="First-time visitors in last 30 days"
        />
        <StatCard
          title="Returning Visitors"
          value={
            insightsLoading ? "-" : (insights?.returning_visitors ?? 0)
          }
          icon={UserCheck}
          subtitle="Previously seen visitors"
        />
      </div>

      {/* Per-Course Analytics Navigation */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Course Analytics
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              View analytics per course
            </CardTitle>
            <CardDescription className="text-xs">
              Click a course to see its page views, engagement, heatmap,
              locations, sessions, and conversion funnel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            {courses.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {courses.map((c) => (
                    <Link
                      key={c.course_id}
                      href={`/dashboard/analytics/courses-analytics/${c.course_id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {c.course_title}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 capitalize">
                          ({c.mode})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {c.enrollment_count} enrollments
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {debouncedCourseSearch
                  ? "No courses match your search"
                  : "No courses found. Create courses to see per-course analytics."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Book Analytics Navigation */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Book Analytics
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              View analytics per book
            </CardTitle>
            <CardDescription className="text-xs">
              Click a book to see its page views, engagement, heatmap,
              locations, sessions, and purchase funnel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search books..."
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            {books.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {books.map((b) => (
                    <Link
                      key={b.book_id}
                      href={`/dashboard/analytics/books-analytics/${b.book_id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {b.book_title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {b.access_count} accesses
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {debouncedBookSearch
                  ? "No books match your search"
                  : "No books found. Create books to see per-book analytics."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-User Analytics Navigation */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <User className="h-5 w-5" />
          User Analytics
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              View analytics per user
            </CardTitle>
            <CardDescription className="text-xs">
              Click a user to see their sessions, pages visited, events,
              location, device info, and content engagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            {users.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/dashboard/analytics/users/${u.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {u.name}
                        </span>
                        {u.email && (
                          <span className="text-xs text-muted-foreground truncate block">
                            {u.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                      <span>{u.enrollments_count} courses</span>
                      <span>{u.book_access_count} books</span>
                      <ArrowRight className="h-4 w-4 group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {debouncedUserSearch
                  ? "No users match your search"
                  : "No users found yet."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Page Click Heatmap: Visual Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Flame className="h-5 w-5" />
          Page Click Heatmap
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Visual click density across your pages. Warmer colors = more clicks.
          Expand a page to see which elements users click most.
        </p>

        {insightsLoading ? (
          <AnalyticsSkeleton />
        ) : pageHeatmaps.length > 0 ? (
          <div className="space-y-3">
            {pageHeatmaps.map((page, i) => {
              const intensity = Math.round(
                (page.total_clicks / maxClicks) * 100
              );
              const hue = Math.max(
                0,
                120 - Math.round((intensity / 100) * 120)
              );
              const bgColor = `hsl(${hue}, 80%, 50%)`;
              const bgLight = `hsl(${hue}, 80%, 95%)`;
              const clicksPerUser =
                page.unique_clickers > 0
                  ? (page.total_clicks / page.unique_clickers).toFixed(1)
                  : "0";

              return (
                <Link
                  key={i}
                  href={`/dashboard/analytics/heatmap?url=${encodeURIComponent(page.page_url)}`}
                  className="block"
                >
                  <Card className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                    <div className="flex">
                      <div
                        className="w-2 shrink-0"
                        style={{ backgroundColor: bgColor }}
                      />
                      <div className="flex-1 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-background"
                                style={{ backgroundColor: bgColor }}
                              />
                              <span className="text-sm font-semibold truncate text-primary inline-flex items-center gap-1">
                                {tryPathname(page.page_url)}
                                <Flame className="h-3 w-3 text-orange-500 shrink-0" />
                              </span>
                            </div>
                            <p
                              className="text-xs text-muted-foreground mt-0.5 truncate"
                              title={page.page_url}
                            >
                              {page.page_url}
                            </p>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div>
                              <div
                                className="text-lg font-bold"
                                style={{ color: bgColor }}
                              >
                                {page.total_clicks.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                clicks
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs">
                          <div
                            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                            style={{ backgroundColor: bgLight }}
                          >
                            <Users className="h-3 w-3" />
                            <span className="font-medium">
                              {page.unique_clickers.toLocaleString()}
                            </span>
                            <span className="text-muted-foreground">
                              unique clickers
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MousePointerClick className="h-3 w-3" />
                            <span className="font-medium">{clicksPerUser}</span>
                            <span className="text-muted-foreground">
                              clicks/user
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Flame className="h-3 w-3" />
                            <span className="font-medium">{intensity}%</span>
                            <span className="text-muted-foreground">
                              intensity
                            </span>
                          </div>
                        </div>

                        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${intensity}%`,
                              background: `linear-gradient(90deg, hsl(120,80%,50%), ${bgColor})`,
                            }}
                          />
                        </div>

                        {page.top_clicked_elements.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Top Clicked Elements
                            </p>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {page.top_clicked_elements
                                .slice(0, 6)
                                .map((el, j) => {
                                  const elMax =
                                    page.top_clicked_elements[0]?.click_count ??
                                    1;
                                  const elPct = Math.round(
                                    (el.click_count / elMax) * 100
                                  );
                                  return (
                                    <div
                                      key={j}
                                      className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs"
                                    >
                                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                                        {`<${el.tag}>`}
                                      </span>
                                      <span
                                        className="truncate flex-1"
                                        title={el.text}
                                      >
                                        {el.text || "(no text)"}
                                      </span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <div className="h-1.5 w-8 rounded-full bg-muted overflow-hidden">
                                          <div
                                            className="h-full rounded-full bg-primary/60"
                                            style={{ width: `${elPct}%` }}
                                          />
                                        </div>
                                        <span className="font-medium">
                                          {el.click_count}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}

            {/* Heatmap legend */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Low</span>
              <div className="flex h-3 w-40 rounded-full overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      backgroundColor: `hsl(${120 - i * 6}, 80%, 50%)`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">High</span>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center space-y-2">
                <Flame className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No click heatmap data yet. Click data will appear once users
                  interact with your site.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Sessions with Recording Links */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Video className="h-5 w-5" />
          User Sessions
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Recent sessions with location, device, navigation path, and links to
          view session recordings.
        </p>

        {insightsLoading ? (
          <AnalyticsSkeleton />
        ) : (insights?.user_sessions?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {/* Session table header */}
            <div className="hidden lg:grid grid-cols-[1fr_120px_80px_80px_120px_120px_100px_140px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              <span>User</span>
              <span>Time</span>
              <span>Duration</span>
              <span>Pages</span>
              <span>Entry Page</span>
              <span>Exit Page</span>
              <span>Location</span>
              <span>Actions</span>
            </div>

            <div className="max-h-[700px] overflow-y-auto space-y-1">
              {insights!.user_sessions.map(
                (session: UserSessionItem, i: number) => {
                  const DevIcon = getDeviceIcon(session.device_type);
                  const location =
                    session.city !== "Unknown"
                      ? `${session.city}, ${session.country}`
                      : session.country !== "Unknown"
                        ? session.country
                        : "-";
                  const userId = session.distinct_id.includes(":")
                    ? session.distinct_id.split(":")[1]?.slice(0, 8)
                    : session.distinct_id.slice(0, 8);
                  const recordingUrl = `${POSTHOG_APP_URL}/project/${POSTHOG_PROJECT_ID}/replay/${session.session_id}`;

                  return (
                    <div
                      key={i}
                      className="rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      {/* Desktop row */}
                      <div className="hidden lg:grid grid-cols-[1fr_120px_80px_80px_120px_120px_100px_140px] gap-2 items-center px-3 py-2.5 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <DevIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span
                            className="font-mono text-xs truncate"
                            title={session.distinct_id}
                          >
                            {userId}...
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {session.browser}/{session.os}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(session.start_time)}
                        </span>
                        <span className="text-xs font-medium">
                          {formatDuration(session.duration_seconds)}
                        </span>
                        <span className="text-xs">{session.page_count}</span>
                        <span
                          className="text-xs truncate"
                          title={session.entry_url}
                        >
                          {tryPathname(session.entry_url)}
                        </span>
                        <span
                          className="text-xs truncate"
                          title={session.exit_url}
                        >
                          {tryPathname(session.exit_url)}
                        </span>
                        <span className="text-xs truncate" title={location}>
                          {location}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleWatchRecording(
                                session.session_id,
                                recordingUrl
                              )
                            }
                            disabled={recordingLoading}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            {recordingLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Video className="h-3 w-3" />
                            )}
                            {recordingLoading ? "…" : "Watch"}
                          </button>
                          <a
                            href={recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                            title="Open session"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open
                          </a>
                        </div>
                      </div>

                      {/* Mobile card */}
                      <div className="lg:hidden p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DevIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span
                              className="font-mono text-xs"
                              title={session.distinct_id}
                            >
                              {userId}...
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(session.start_time)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {formatDuration(session.duration_seconds)}
                          </span>
                          <span>
                            {session.page_count} pages
                          </span>
                          <span>
                            {session.browser}/{session.os}
                          </span>
                          {location !== "-" && (
                            <span>
                              {location}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">
                            {tryPathname(session.entry_url)}
                          </span>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {tryPathname(session.exit_url)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleWatchRecording(
                                session.session_id,
                                recordingUrl
                              )
                            }
                            disabled={recordingLoading}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            {recordingLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Video className="h-3 w-3" />
                            )}
                            {recordingLoading
                              ? "Loading…"
                              : "Watch Recording"}
                          </button>
                          <a
                            href={recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open session
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center space-y-2">
                <Video className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No session data yet. Sessions will appear once users visit
                  your site.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ListCard
          title="Top Pages"
          description="Most visited pages"
          icon={Eye}
          items={normalizeTopPages(insights?.top_pages ?? []).map((p) => ({
            label: tryPathname(p.url),
            value: p.count,
          }))}
          emptyMessage="No page data yet"
          renderItem={(item, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 text-sm py-1 border-b last:border-0"
            >
              <span className="truncate" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {item.value.toLocaleString()}
              </span>
            </div>
          )}
        />

        <ListCard
          title="User Locations"
          description="Top countries & cities"
          icon={Globe}
          items={(insights?.locations ?? []).map((l) => ({
            label:
              l.city !== "Unknown"
                ? `${l.city}, ${l.country}`
                : l.country,
            value: l.count,
          }))}
          emptyMessage="No location data yet"
        />

        <ListCard
          title="Browsers"
          description="Browser distribution"
          icon={Monitor}
          items={(insights?.browsers ?? []).map((b) => ({
            label: b.name,
            value: b.count,
          }))}
          emptyMessage="No browser data yet"
        />

        <ListCard
          title="Operating Systems"
          description="OS distribution"
          icon={Monitor}
          items={(insights?.operating_systems ?? []).map((o) => ({
            label: o.name,
            value: o.count,
          }))}
          emptyMessage="No OS data yet"
        />

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-medium">
                Device Types
              </CardTitle>
              <CardDescription className="text-xs">
                Desktop vs Mobile vs Tablet
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {(insights?.device_types?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {insights!.device_types.map((d, i) => {
                  const DevIcon = getDeviceIcon(d.name);
                  const total = insights!.device_types.reduce(
                    (s, x) => s + x.count,
                    0
                  );
                  const pct =
                    total > 0 ? Math.round((d.count / total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <DevIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{d.name}</span>
                          <span className="text-muted-foreground">
                            {d.count.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No device data yet
              </p>
            )}
          </CardContent>
        </Card>

        <ListCard
          title="Traffic Sources"
          description="Referring domains"
          icon={ExternalLink}
          items={(insights?.referrers ?? []).map((r) => ({
            label: r.domain,
            value: r.count,
          }))}
          emptyMessage="No referrer data yet"
        />
      </div>

      {/* Custom Events */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Custom Events</h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Event Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Custom events tracked on your site (excludes system events)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(insights?.custom_events?.length ?? 0) > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insights!.custom_events.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm font-medium truncate">
                      {e.event}
                    </span>
                    <span className="text-sm font-bold text-primary ml-2">
                      {e.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No custom events yet. Events like course_viewed, book_viewed,
                enrollment_initiated will appear here once tracked.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session recording modal */}
      <Dialog
        open={!!recordingEmbedUrl}
        onOpenChange={(open) => {
          if (!open) {
            setRecordingEmbedUrl(null);
            setIframeLoaded(false);
            setEmbedFailed(false);
            setDirectPostHogUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 pr-12 border-b shrink-0 flex flex-row items-center justify-between">
            <DialogTitle>Session Recording</DialogTitle>
            <DialogDescription className="sr-only">
              Watch the session replay. Use Open in new tab if the player does
              not load.
            </DialogDescription>
            <div className="flex items-center gap-3">
              {directPostHogUrl && (
                <a
                  href={directPostHogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open session
                </a>
              )}
              {recordingEmbedUrl && (
                <a
                  href={recordingEmbedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Embed link
                </a>
              )}
            </div>
          </DialogHeader>
          <div className="relative flex-1 min-h-0 p-4 overflow-hidden">
            {!iframeLoaded && !embedFailed && (
              <div className="absolute inset-4 flex items-center justify-center rounded-lg bg-muted/50">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            )}
            {embedFailed && (
              <div className="absolute inset-4 flex flex-col items-center justify-center rounded-lg bg-muted/30 gap-4">
                <Video className="h-12 w-12 text-muted-foreground" />
                <div className="text-center space-y-2 max-w-md">
                  <p className="text-sm font-medium">
                    Session replay is not available
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Session replay may be disabled
                    settings, or the recording may have been deleted. You can
                    still view session details directly.
                  </p>
                </div>
                {directPostHogUrl && (
                  <a
                    href={directPostHogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open session
                  </a>
                )}
              </div>
            )}
            {recordingEmbedUrl && !embedFailed && (
              <iframe
                src={recordingEmbedUrl}
                title="Session recording"
                className="w-full h-full min-h-[500px] rounded-lg border-0"
                allow="fullscreen"
                onLoad={() => setIframeLoaded(true)}
                onError={() => setEmbedFailed(true)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
