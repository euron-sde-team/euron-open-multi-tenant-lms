"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Calendar,
  Eye,
  GraduationCap,
  MousePointerClick,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  AnalyticsSkeleton,
  EntityBreakdownGrid,
  formatDuration,
  formatTimeAgo,
  ListCard,
  SessionsGrid,
  StatCard,
  tryPathname,
} from "@/components/analytics/shared";
import { useUserAnalytics } from "@/lib/hooks/use-dashboard";
import { useTenantStore } from "@/lib/stores/tenant-store";

export default function UserAnalyticsPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const { selectedTenantId, selectedTenant } = useTenantStore();
  const { data, isLoading } = useUserAnalytics(selectedTenantId ?? undefined, userId, selectedTenant?.tenant_slug);

  if (isLoading) return <AnalyticsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/analytics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Analytics
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold">User Analytics</h1>
        <p className="text-muted-foreground">
          Activity and engagement for user <span className="font-mono font-medium text-foreground">{userId.slice(0, 12)}...</span>
        </p>
        {(!data || data.total_events === 0) && (
          <p className="text-sm text-muted-foreground mt-2">
            No web analytics data yet. Analytics appear when this user visits your site while logged in.
          </p>
        )}
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Events" value={data?.total_events ?? 0} icon={Activity} subtitle="All tracked events" />
        <StatCard title="Page Views" value={data?.total_pageviews ?? 0} icon={Eye} subtitle="Total pageviews" />
        <StatCard title="Sessions" value={data?.total_sessions ?? 0} icon={MousePointerClick} subtitle={`Avg. ${formatDuration(data?.avg_session_duration_seconds ?? 0)}`} />
        <StatCard
          title="Active Since"
          value={data?.first_seen ? formatTimeAgo(data.first_seen) : "-"}
          icon={Calendar}
          subtitle={data?.last_seen ? `Last seen ${formatTimeAgo(data.last_seen)}` : ""}
        />
      </div>

      {/* Courses & Books Viewed */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-medium">Courses Viewed</CardTitle>
              <CardDescription className="text-xs">course_viewed events by this user</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {(data?.courses_viewed?.length ?? 0) > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data!.courses_viewed.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-1">
                    <Link
                      href={`/dashboard/analytics/courses-analytics/${c.course_id}`}
                      className="text-primary hover:underline truncate"
                    >
                      {c.course_id}
                    </Link>
                    <span className="text-muted-foreground shrink-0 ml-2">{c.count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No courses viewed</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-medium">Books Viewed</CardTitle>
              <CardDescription className="text-xs">book_viewed events by this user</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {(data?.books_viewed?.length ?? 0) > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data!.books_viewed.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-1">
                    <Link
                      href={`/dashboard/analytics/books-analytics/${b.book_id}`}
                      className="text-primary hover:underline truncate"
                    >
                      {b.book_id}
                    </Link>
                    <span className="text-muted-foreground shrink-0 ml-2">{b.count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No books viewed</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Pages */}
      <ListCard
        title="Top Pages Visited"
        description="Most visited pages by this user"
        icon={Eye}
        items={(data?.top_pages ?? []).map((p) => ({
          label: tryPathname(p.url),
          value: p.count,
        }))}
        emptyMessage="No page data yet"
        renderItem={(item, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm py-1 border-b last:border-0">
            <span className="truncate" title={item.label}>{item.label}</span>
            <span className="shrink-0 text-muted-foreground">{item.value.toLocaleString()}</span>
          </div>
        )}
      />

      {/* Events Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Events Breakdown</CardTitle>
          <CardDescription className="text-xs">All events triggered by this user</CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.events_breakdown?.length ?? 0) > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data!.events_breakdown.map((e, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium truncate">{e.event}</span>
                  <span className="text-sm font-bold text-primary ml-2">{e.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No events yet</p>
          )}
        </CardContent>
      </Card>

      {/* Breakdowns */}
      <EntityBreakdownGrid
        locations={data?.locations ?? []}
        browsers={data?.browsers ?? []}
        operatingSystems={data?.operating_systems ?? []}
        deviceTypes={data?.device_types ?? []}
        referrers={[]}
      />

      {/* Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-sm font-medium">Recent Sessions</CardTitle>
            <CardDescription className="text-xs">This user&apos;s sessions</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SessionsGrid sessions={data?.sessions ?? []} emptyMessage="No sessions for this user yet" />
        </CardContent>
      </Card>
    </div>
  );
}
