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
  Award,
  Bookmark,
  BookOpen,
  Calendar,
  ChevronRight,
  CreditCard,
  Eye,
  GraduationCap,
  Mail,
  Phone,
  ShoppingCart,
  TrendingUp,
  User,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  AnalyticsBarChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import {
  AnalyticsSkeleton,
  EntityBreakdownGrid,
  formatDuration,
  formatTimeAgo,
  SessionsGrid,
  StatCard,
  tryPathname,
} from "@/components/analytics/shared";
import { MemberWatchTimeSection } from "@/components/analytics/member-watch-time-section";
import { RevenueBreakdownDisplay } from "@/components/shared/RevenueBreakdown";
import { useUserDetailAnalytics } from "@/lib/hooks/use-analytics";
import { formatInr, formatUsd } from "@/lib/utils/currency";

export default function UserDetailAnalyticsPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const { data, isLoading } = useUserDetailAnalytics(userId ?? null);

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/analytics/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          User not found
        </div>
      </div>
    );
  }

  const { profile, summary, enrollments, book_access, orders, certificates, posthog } = data;

  const locationPieData = (posthog?.locations ?? [])
    .filter((l) => (l.count ?? 0) > 0)
    .slice(0, 8)
    .map((l) => ({
      name: l.city !== "Unknown" ? `${l.city}, ${l.country}` : l.country,
      value: l.count,
    }));

  const browserPieData = (posthog?.browsers ?? [])
    .filter((b) => (b.count ?? 0) > 0)
    .map((b) => ({ name: b.name, value: b.count }));

  const devicePieData = (posthog?.device_types ?? [])
    .filter((d) => (d.count ?? 0) > 0)
    .map((d) => ({ name: d.name, value: d.count }));

  const topPagesBarData = (posthog?.top_pages ?? []).map((p) => ({
    date: tryPathname(p.url),
    count: p.count,
  }));

  const eventsBarData = (posthog?.events_breakdown ?? []).map((e) => ({
    date: e.event,
    count: e.count,
  }));

  const coursesViewedBarData = (posthog?.courses_viewed ?? []).map((c) => ({
    date: c.course_id,
    count: c.count,
  }));

  const booksViewedBarData = (posthog?.books_viewed ?? []).map((b) => ({
    date: b.book_id,
    count: b.count,
  }));

  const posthogSessions = (posthog?.sessions ?? []).map((s) => ({
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
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics/users"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-full" title={profile.name}>
            {profile.name}
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          User Detail Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.name}, {profile.status}
        </p>
      </div>

      {/* Contact & Profile Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Name</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate" title={profile.name}>{profile.name}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm truncate" title={profile.email ?? ""}>{profile.email ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Phone</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{profile.phone ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                profile.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {profile.status}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Joined</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {profile.joined_at ? new Date(profile.joined_at).toLocaleDateString() : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Login</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {profile.last_login_at ? formatTimeAgo(profile.last_login_at) : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Enrollments" value={summary.enrollments_count} icon={GraduationCap} />
        <StatCard title="Books" value={summary.book_access_count} icon={BookOpen} />
        <StatCard title="Completed" value={summary.completed_enrollments} icon={TrendingUp} />
        <StatCard title="Certificates" value={summary.certificates_count} icon={Award} />
        <StatCard title="Cart Items" value={summary.cart_count} icon={ShoppingCart} />
        <StatCard title="Bookmarks" value={summary.bookmark_count} icon={Bookmark} />
      </div>

      {/* Total Spent, multi-currency breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Total Spent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueBreakdownDisplay
            value={summary.total_spent}
            variant="inline"
            showSubnote
          />
        </CardContent>
      </Card>

      {/* Web Analytics Stats (date-independent) */}
      {posthog && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Events" value={posthog.total_events} icon={Video} subtitle="All tracked events" />
          <StatCard title="Page Views" value={posthog.total_pageviews} icon={Eye} subtitle="Total pageviews" />
          <StatCard
            title="Sessions"
            value={posthog.total_sessions}
            icon={Eye}
            subtitle={`Avg. ${formatDuration(posthog.avg_session_duration_seconds ?? 0)}`}
          />
          <StatCard
            title="First/Last Seen"
            value={posthog.first_seen ? formatTimeAgo(posthog.first_seen) : "-"}
            icon={Calendar}
            subtitle={posthog.last_seen ? `Last ${formatTimeAgo(posthog.last_seen)}` : ""}
          />
        </div>
      )}

      {!posthog && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No web analytics data yet for this user.
          </CardContent>
        </Card>
      )}

      {/* Web Analytics Charts */}
      {posthog && (
        <div className="grid gap-4 lg:grid-cols-2">
          {locationPieData.length > 0 && (
            <AnalyticsPieChart
              title="Location Distribution"
              description="Top locations"
              data={locationPieData}
            />
          )}
          {browserPieData.length > 0 && (
            <AnalyticsPieChart
              title="Browser Distribution"
              description="Top browsers"
              data={browserPieData}
            />
          )}
          {devicePieData.length > 0 && (
            <AnalyticsPieChart
              title="Device Types"
              description="Desktop vs Mobile vs Tablet"
              data={devicePieData}
            />
          )}
        </div>
      )}

      {posthog && (
        <div className="grid gap-4 lg:grid-cols-2">
          {topPagesBarData.length > 0 ? (
            <AnalyticsBarChart
              title="Top Pages Visited"
              description="Most visited pages by this user"
              data={topPagesBarData}
              dataKey="count"
              name="Views"
              layout="vertical"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Pages Visited</CardTitle>
                <CardDescription>Most visited pages by this user</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground py-4 text-center">No page data yet</p>
              </CardContent>
            </Card>
          )}
          {eventsBarData.length > 0 ? (
            <AnalyticsBarChart
              title="Events Breakdown"
              description="All events triggered by this user"
              data={eventsBarData}
              dataKey="count"
              name="Count"
              layout="vertical"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Events Breakdown</CardTitle>
                <CardDescription>All events triggered by this user</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground py-4 text-center">No events yet</p>
              </CardContent>
            </Card>
          )}
          {coursesViewedBarData.length > 0 ? (
            <AnalyticsBarChart
              title="Courses Viewed"
              description="course_viewed events by this user"
              data={coursesViewedBarData}
              dataKey="count"
              name="Views"
              layout="vertical"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Courses Viewed</CardTitle>
                <CardDescription>course_viewed events by this user</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground py-4 text-center">No courses viewed</p>
              </CardContent>
            </Card>
          )}
          {booksViewedBarData.length > 0 ? (
            <AnalyticsBarChart
              title="Books Viewed"
              description="book_viewed events by this user"
              data={booksViewedBarData}
              dataKey="count"
              name="Views"
              layout="vertical"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Books Viewed</CardTitle>
                <CardDescription>book_viewed events by this user</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground py-4 text-center">No books viewed</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* DB Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollments</CardTitle>
            <CardDescription>Course enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollments.length > 0 ? (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Course</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link
                            href={`/dashboard/analytics/courses-analytics/${e.course_id}`}
                            className="text-primary hover:underline truncate max-w-[180px] block"
                          >
                            {e.course_title}
                          </Link>
                        </td>
                        <td className="py-2">{e.status}</td>
                        <td className="py-2 text-muted-foreground">
                          {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No enrollments for selected range</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Book Access</CardTitle>
            <CardDescription>Books accessed</CardDescription>
          </CardHeader>
          <CardContent>
            {book_access.length > 0 ? (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Book</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book_access.map((ba) => (
                      <tr key={ba.id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link
                            href={`/dashboard/analytics/books-analytics/${ba.book_id}`}
                            className="text-primary hover:underline truncate max-w-[180px] block"
                          >
                            {ba.book_title}
                          </Link>
                        </td>
                        <td className="py-2">{ba.status}</td>
                        <td className="py-2 text-muted-foreground">
                          {ba.created_at ? new Date(ba.created_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No book access for selected range</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders</CardTitle>
            <CardDescription>Payment orders</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length > 0 ? (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Order</th>
                      <th className="text-left py-2 font-medium">Amount</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const amount = parseFloat(o.total_amount);
                      return (
                        <tr key={o.id} className="border-b last:border-0">
                          <td className="py-2 font-mono text-xs">{o.order_number}</td>
                          <td className="py-2">
                            {o.currency === "USD" ? formatUsd(amount) : formatInr(amount)}
                          </td>
                          <td className="py-2">{o.status}</td>
                          <td className="py-2 text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No orders for selected range</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certificates</CardTitle>
            <CardDescription>Issued certificates</CardDescription>
          </CardHeader>
          <CardContent>
            {certificates.length > 0 ? (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Course</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 truncate max-w-[180px]">{c.course_title}</td>
                        <td className="py-2">{c.status}</td>
                        <td className="py-2 text-muted-foreground">
                          {c.issued_at ? new Date(c.issued_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No certificates for selected range</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sessions Grid */}
      {posthog && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-medium">Recent Sessions</CardTitle>
              <CardDescription className="text-xs">This user&apos;s sessions</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SessionsGrid sessions={posthogSessions} emptyMessage="No sessions for this user yet" />
          </CardContent>
        </Card>
      )}

      {/* Location & Device Breakdown */}
      {posthog && (
        <EntityBreakdownGrid
          locations={posthog.locations ?? []}
          browsers={posthog.browsers ?? []}
          operatingSystems={posthog.operating_systems ?? []}
          deviceTypes={posthog.device_types ?? []}
          referrers={[]}
        />
      )}

      {/* Watch time, sessions table + 90-day hot window. */}
      <MemberWatchTimeSection userId={userId} />
    </div>
  );
}
