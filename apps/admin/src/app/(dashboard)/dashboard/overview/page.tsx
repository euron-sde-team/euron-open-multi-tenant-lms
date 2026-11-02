"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@open-mtlms/core";
import {
  Users,
  GraduationCap,
  DollarSign,
  UserPlus,
  BookOpen,
  TrendingUp,
  Target,
  Lock,
} from "lucide-react";
import { useState } from "react";

import { AcademyLiveCard } from "../../../../components/dashboard/AcademyLiveCard";
import { ContentOverviewCard } from "../../../../components/dashboard/ContentOverviewCard";
import { LaunchChecklist } from "../../../../components/dashboard/LaunchChecklist";
import { QuickAccessCard } from "../../../../components/dashboard/QuickAccessCard";
import { RecentEnrollmentsCard } from "../../../../components/dashboard/RecentEnrollmentsCard";
import { RecentOrdersCard } from "../../../../components/dashboard/RecentOrdersCard";
import { SetupOrganizationCard } from "../../../../components/dashboard/SetupOrganizationCard";
import { StatCard } from "../../../../components/dashboard/StatCard";
import { TopCoursesCard } from "../../../../components/dashboard/TopCoursesCard";
import {
  AvgOrderValueDisplay,
  RevenueBreakdownDisplay,
} from "../../../../components/shared/RevenueBreakdown";
import {
  useDashboard,
  useCourseStats,
  useBookStats,
  useEnrollmentBreakdown,
  useBookAccessBreakdown,
} from "../../../../lib/hooks/use-dashboard";
import {
  useTenantDomains,
  useTenantWebBaseUrl,
} from "../../../../lib/hooks/use-tenant-domain-url";
import { useTenantStore } from "../../../../lib/stores/tenant-store";
import type { RevenueOverview } from "../../../../lib/types/dashboard";
import { formatInr, formatUsd } from "../../../../lib/utils/currency";

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-16 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-32 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-10 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DashboardError({ message }: { message: string }) {
  // Not having dashboard access is a NORMAL state for a scoped role, an
  // Educator may legitimately never see revenue figures. Rendering it as a red
  // "Failed to load" makes a working account look broken on its very first
  // screen. Say what happened, in their words, and point them somewhere useful.
  const isPermission = /permission|forbidden|not allowed/i.test(message);

  if (isPermission) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          You don&apos;t have access to the dashboard
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Your role doesn&apos;t include the overview page. Everything else you
          have access to is in the menu on the left, or ask an admin to give
          your role &ldquo;Can see the dashboard&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">
            Failed to load dashboard
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { tenants, selectedTenantId } = useTenantStore();
  const { data, isLoading, error } = useDashboard(selectedTenantId ?? undefined);
  const { data: courseStats } = useCourseStats(selectedTenantId ?? undefined);
  const { data: bookStats } = useBookStats(selectedTenantId ?? undefined);
  const { data: enrollmentBreakdown } = useEnrollmentBreakdown(
    selectedTenantId ?? undefined,
    10
  );
  const { data: bookAccessBreakdown } = useBookAccessBreakdown(
    selectedTenantId ?? undefined,
    10
  );
  const academyBaseUrl = useTenantWebBaseUrl();
  const { data: domainsData, isPending: domainsPending } = useTenantDomains();
  const academyUrlLoading = domainsPending || domainsData === undefined;
  // Show the setup card only when there is genuinely no active tenant. A
  // platform admin has no memberships (tenants.length === 0) yet operates a
  // selected tenant, so gate on the active selection, not the membership list.
  if (tenants.length === 0 && !selectedTenantId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <SetupOrganizationCard />
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <DashboardError message={error.message} />;
  if (!data) return <DashboardSkeleton />;

  const { content, members, enrollments, revenue } = data;

  // AcademyLiveCard URL is sourced from the tenant_domains table via
  // useTenantWebBaseUrl: primary ACTIVE first, then first ACTIVE, then env-based
  // fallback. We always render the card so onboarding surfaces stay stable; the
  // card itself shows a skeleton URL while the domains query is in flight.
  const academyUrl = academyBaseUrl || null;

  return (
    <div className="space-y-6">
      {/* Floating support actions, only on the main dashboard page */}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your learning platform
        </p>
      </div>

      {/* Onboarding surfaces, top-of-fold for newly provisioned tenants */}
      {(academyUrlLoading || academyUrl) && (
        <>
          <AcademyLiveCard
            academyUrl={academyUrl}
            isLoading={academyUrlLoading}
          />
          <LaunchChecklist />
        </>
      )}

      {/* Quick access, jump to common settings in a new tab */}
      <QuickAccessCard />

      {/* Primary Stats */}
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={members.total_members.toLocaleString()}
          icon={Users}
          trend={
            members.members_joined_last_30_days > 0
              ? {
                  value: `+${members.members_joined_last_30_days} in last 30 days`,
                  positive: true,
                }
              : undefined
          }
          subtitle={`${members.active_members} active`}
        />
        <StatCard
          title="Total Enrollments"
          value={enrollments.total_enrollments.toLocaleString()}
          icon={GraduationCap}
          subtitle={`${enrollments.active_enrollments} active · ${enrollments.completed_enrollments} completed`}
        />
        <TotalRevenueCard revenue={revenue} />
        <StatCard
          title="Published Courses"
          value={content.published_courses}
          icon={BookOpen}
          subtitle={`${content.total_courses} total · ${content.draft_courses} drafts`}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="New Students (30d)"
          value={members.members_joined_last_30_days}
          icon={UserPlus}
          subtitle="Joined in the last 30 days"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <AvgOrderValueDisplay
              inr={revenue.average_order_value_inr}
              usd={revenue.average_order_value_usd}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {revenue.total_orders} total orders
            </p>
          </CardContent>
        </Card>
        <StatCard
          title="Completion Rate"
          value={
            enrollments.total_enrollments > 0
              ? `${Math.round((enrollments.completed_enrollments / enrollments.total_enrollments) * 100)}%`
              : "-"
          }
          icon={Target}
          subtitle={`${enrollments.completed_enrollments} of ${enrollments.total_enrollments} enrollments`}
        />
      </div>

      {/* Content + Activity */}
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
        <ContentOverviewCard content={content} />
        <RecentEnrollmentsCard enrollments={data.recent_enrollments} />
        <RecentOrdersCard orders={data.recent_orders} />
      </div>

      {/* Course Stats by Mode */}
      {courseStats && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Course Stats by Mode</h2>
          <div className="grid gap-x-8 gap-y-2 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Self-Paced</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{courseStats.self_paced}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Book Stats */}
      {bookStats && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Book Stats</h2>
          <div className="grid gap-x-8 gap-y-2 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Books</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{bookStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {bookStats.published} published · {bookStats.draft} draft
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Book Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{bookStats.total_access}</div>
                <p className="text-xs text-muted-foreground">Active access grants</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Enrollment by Course & Book Access */}
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
        {enrollmentBreakdown && enrollmentBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Enrollment by Course</CardTitle>
              <CardDescription>Top courses by enrollment count</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {enrollmentBreakdown.map((item) => (
                  <div
                    key={item.course_id}
                    className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                  >
                    <span className="truncate flex-1">{item.course_title}</span>
                    <span className="text-muted-foreground ml-2">
                      {item.enrollment_count} enrollments
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {bookAccessBreakdown && bookAccessBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Book Access by Book</CardTitle>
              <CardDescription>Top books by access count</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bookAccessBreakdown.map((item) => (
                  <div
                    key={item.book_id}
                    className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                  >
                    <span className="truncate flex-1">{item.book_title}</span>
                    <span className="text-muted-foreground ml-2">
                      {item.access_count} access
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Courses + Enrollment Breakdown */}
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
        <TopCoursesCard courses={data.top_courses} />

        <Card>
          <CardHeader>
            <CardTitle>Enrollment Breakdown</CardTitle>
            <CardDescription>How students are enrolling</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollments.total_enrollments === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No enrollments yet
              </p>
            ) : (
              <div className="space-y-3">
                <EnrollmentBar
                  label="Purchased"
                  count={enrollments.paid_enrollments}
                  total={enrollments.total_enrollments}
                  color="bg-primary"
                />
                <EnrollmentBar
                  label="Free / Granted"
                  count={enrollments.free_enrollments}
                  total={enrollments.total_enrollments}
                  color="bg-emerald-500"
                />
                <EnrollmentBar
                  label="Active"
                  count={enrollments.active_enrollments}
                  total={enrollments.total_enrollments}
                  color="bg-blue-500"
                />
                <EnrollmentBar
                  label="Completed"
                  count={enrollments.completed_enrollments}
                  total={enrollments.total_enrollments}
                  color="bg-amber-500"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function EnrollmentBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Total Revenue card with INR / USD / Combined toggle
// -----------------------------------------------------------------------------
//
// Behaviour:
// - Three pill tabs: INR, USD, ≈ All.
// - INR tab shows raw INR revenue (no conversion), INR-only 30d trend,
//   INR-only paid order count.
// - USD tab shows raw USD revenue (no conversion), USD-only 30d trend,
//   USD-only paid order count.
// - All tab shows the three-row INR/USD/Combined-in-INR breakdown plus a
//   combined 30d trend.
// - Initial tab is auto-picked based on whichever currency contributed more
//   INR-normalized revenue (raw INR amount vs USD × conversion_rate). Ties
//   go to INR. User clicks override the auto-pick via useState for the
//   remainder of the mount. On route change / reload we fall back to auto
//   pick again, per the user's "auto-pick" preference.
// - Nothing here converts numbers across currencies for display, the raw
//   values from the backend are rendered as-is.

type RevenueMode = "INR" | "USD" | "ALL";

function TotalRevenueCard({ revenue }: { revenue: RevenueOverview }) {
  const autoMode: RevenueMode =
    revenue.total_revenue.inr >=
    revenue.total_revenue.usd * revenue.conversion_rate
      ? "INR"
      : "USD";
  const [override, setOverride] = useState<RevenueMode | null>(null);
  const active: RevenueMode = override ?? autoMode;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
          <CardTitle className="text-sm font-medium truncate">
            Total Revenue
          </CardTitle>
        </div>
        <div
          role="tablist"
          aria-label="Revenue currency"
          className="flex items-center gap-0.5 rounded-md border bg-background p-0.5 shrink-0"
        >
          {(["INR", "USD", "ALL"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={active === m}
              onClick={() => setOverride(m)}
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors tabular-nums",
                active === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "ALL" ? "≈ All" : m}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {active === "INR" && (
          <>
            <div className="text-2xl font-bold tabular-nums">
              {formatInr(revenue.total_revenue.inr)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {revenue.paid_orders_inr} INR paid order
              {revenue.paid_orders_inr === 1 ? "" : "s"}
              {revenue.revenue_last_30_days.inr > 0 && (
                <>
                  {" · "}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    +{formatInr(revenue.revenue_last_30_days.inr)} in 30d
                  </span>
                </>
              )}
            </p>
          </>
        )}
        {active === "USD" && (
          <>
            <div className="text-2xl font-bold tabular-nums">
              {formatUsd(revenue.total_revenue.usd)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {revenue.paid_orders_usd} USD paid order
              {revenue.paid_orders_usd === 1 ? "" : "s"}
              {revenue.revenue_last_30_days.usd > 0 && (
                <>
                  {" · "}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    +{formatUsd(revenue.revenue_last_30_days.usd)} in 30d
                  </span>
                </>
              )}
            </p>
          </>
        )}
        {active === "ALL" && (
          <>
            <RevenueBreakdownDisplay
              value={revenue.total_revenue}
              variant="inline"
              showSubnote={false}
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              {revenue.paid_orders_inr + revenue.paid_orders_usd} paid orders
              {revenue.revenue_last_30_days.combined_inr > 0 && (
                <>
                  {" · "}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    +
                    {formatInr(revenue.revenue_last_30_days.combined_inr)} in 30d
                  </span>
                </>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
