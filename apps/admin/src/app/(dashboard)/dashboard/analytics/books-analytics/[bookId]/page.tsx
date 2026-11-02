"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ChevronRight,
  Eye,
  MousePointerClick,
  ShoppingCart,
  TrendingUp,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { CHART_COLORS } from "@/components/analytics/chart-utils";
import {
  AnalyticsSkeleton,
  EntityBreakdownGrid,
  formatDuration,
  SessionsGrid,
} from "@/components/analytics/shared";
import { RevenueBreakdownDisplay } from "@/components/shared/RevenueBreakdown";
import { useBookDetailAnalytics } from "@/lib/hooks/use-analytics";

export default function BookDetailAnalyticsPage() {
  const params = useParams();
  const bookId = params?.bookId as string;
  const { data, isLoading } = useBookDetailAnalytics(bookId ?? null);

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/analytics/books-analytics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Books
        </Link>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Book not found or no analytics available.
        </div>
      </div>
    );
  }

  const { book, summary, daily_access, daily_revenue, daily_bookmarks, daily_cart_adds, daily_completions, posthog } = data;

  const referrerPieData = (posthog?.referrers ?? [])
    .filter((r) => (r.count ?? 0) > 0)
    .slice(0, 8)
    .map((r) => ({ name: r.domain || "Direct", value: r.count ?? 0 }));

  const combinedAccessRevenue = (() => {
    const byDate = new Map<string, { access: number; revenue: number }>();
    for (const r of daily_access ?? []) {
      const d = String(r.date ?? "").slice(0, 10);
      if (d) byDate.set(d, { ...(byDate.get(d) ?? { access: 0, revenue: 0 }), access: r.count ?? 0 });
    }
    for (const r of daily_revenue ?? []) {
      const d = String(r.date ?? "").slice(0, 10);
      if (d)
        byDate.set(d, {
          ...(byDate.get(d) ?? { access: 0, revenue: 0 }),
          revenue: r.amount?.combined_inr ?? 0,
        });
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, access: v.access, revenue: v.revenue }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics/books-analytics"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Books
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-full" title={book.title}>
            {book.title}
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Book Performance
        </h1>
        <p className="text-sm text-muted-foreground">
          {book.title}, {book.status}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Access</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.access_count ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{(summary.active_access ?? 0)} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.completed_count ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Completion: {(summary.completion_rate ?? 0)}%</p>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <span className="text-xs text-muted-foreground">{(summary.sales_count ?? 0)} sales</span>
          </CardHeader>
          <CardContent>
            <RevenueBreakdownDisplay value={summary.revenue} variant="inline" showSubnote />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bookmarks</CardTitle>
            <Bookmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.bookmark_count ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Cart</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.cart_count ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Web Vitals (date-independent) */}
      {posthog && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Web Vitals</h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(posthog.page_views ?? 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{(posthog.unique_visitors ?? 0)} unique visitors</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Sessions</CardTitle>
                <Video className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(posthog.session_count ?? 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Avg. {formatDuration(posthog.avg_session_duration_seconds ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(posthog.total_clicks ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Add to Cart</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(posthog.add_to_cart_count ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(posthog.book_purchase_count ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsLineChart
          title="Daily Access & Revenue"
          description="Book access and revenue over time"
          data={combinedAccessRevenue}
          lines={[
            { dataKey: "access", name: "Access", color: CHART_COLORS[0] },
            { dataKey: "revenue", name: "Revenue (₹)", color: CHART_COLORS[1], yAxisId: "right" },
          ]}
          height={260}
        />

        {posthog && (posthog.daily_views?.length ?? 0) > 0 && (
          <AnalyticsAreaChart
            title="Daily Page Views"
            description="Page views over time"
            data={posthog.daily_views}
            dataKey="count"
            name="Views"
            height={260}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(daily_bookmarks?.length ?? 0) > 0 && (
          <AnalyticsBarChart
            title="Daily Bookmarks"
            description="Book bookmarks added over time"
            data={daily_bookmarks}
            dataKey="count"
            name="Bookmarks"
            height={240}
          />
        )}

        {(daily_cart_adds?.length ?? 0) > 0 && (
          <AnalyticsBarChart
            title="Daily Add to Cart"
            description="Items added to cart over time"
            data={daily_cart_adds}
            dataKey="count"
            name="Cart Adds"
            height={240}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(daily_completions?.length ?? 0) > 0 && (
          <AnalyticsLineChart
            title="Daily Completions"
            description="Book reading completions over time"
            data={daily_completions}
            dataKey="count"
            name="Completions"
            height={240}
          />
        )}

        {(daily_revenue?.length ?? 0) > 0 && (
          <AnalyticsAreaChart
            title="Daily Revenue (≈ INR)"
            description="Combined revenue over time"
            data={daily_revenue.map((r) => ({
              date: r.date,
              count: r.amount?.combined_inr ?? 0,
            }))}
            dataKey="count"
            name="Revenue (≈ INR)"
            height={240}
          />
        )}
      </div>

      {(daily_access?.length ?? 0) > 0 && (
        <AnalyticsAreaChart
          title="Daily Access"
          description="Book access over time"
          data={daily_access}
          dataKey="count"
          name="Access"
          height={240}
        />
      )}

      {referrerPieData.length > 0 && (
        <AnalyticsPieChart
          title="Traffic Sources"
          description="Top referrers"
          data={referrerPieData}
          height={260}
        />
      )}

      {/* Locations, Browsers, OS, Devices */}
      {posthog && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Location & Device Breakdown</h2>
          <EntityBreakdownGrid
            locations={posthog.locations ?? []}
            browsers={posthog.browsers ?? []}
            operatingSystems={posthog.operating_systems ?? []}
            deviceTypes={posthog.device_types ?? []}
            referrers={(posthog.referrers ?? []).map((r) => ({ domain: r.domain, count: r.count }))}
          />
        </div>
      )}

      {/* Sessions */}
      {posthog && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-medium">Recent Sessions</CardTitle>
              <CardDescription className="text-xs">Sessions that visited this book page</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SessionsGrid
              sessions={(posthog.sessions ?? []).map((s) => ({
                session_id: s.session_id,
                distinct_id: s.distinct_id,
                start_time: s.start_time,
                duration_seconds: s.duration_seconds,
                page_count: s.page_count,
                entry_url: s.entry_url,
                exit_url: s.exit_url,
                country: s.country ?? "Unknown",
                city: s.city ?? "Unknown",
                browser: s.browser ?? "Unknown",
                os: s.os ?? "Unknown",
                device_type: s.device_type ?? "Unknown",
              }))}
              emptyMessage="No sessions for this book yet"
            />
          </CardContent>
        </Card>
      )}

      {!posthog && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No web analytics data yet for this book.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
