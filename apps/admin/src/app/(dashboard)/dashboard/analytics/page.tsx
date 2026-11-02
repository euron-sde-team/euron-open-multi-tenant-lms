"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import {
  Award,
  BarChart3,
  Bookmark,
  BookOpen,
  CreditCard,
  DollarSign,
  GraduationCap,
  Highlighter,
  ShoppingCart,
  Ticket,
  Trophy,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AnalyticsDataTable } from "@/components/analytics/analytics-data-table";
import { CHART_COLORS } from "@/components/analytics/chart-utils";
import { ComparisonChart } from "@/components/analytics/comparison-chart";
import { ExportMenu } from "@/components/analytics/export-menu";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { formatNumber } from "@/components/analytics/number-formatters";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { TrendStat } from "@/components/analytics/trend-stat";
import { RevenueBreakdownDisplay } from "@/components/shared/RevenueBreakdown";
import type { RecentSignupItem } from "@/lib/api/analytics";
import {
  useAnalyticsOverview,
  useOverviewRecentOrders,
  useOverviewRecentSignups,
} from "@/lib/hooks/use-analytics";
import { useAnalyticsOverviewComparison } from "@/lib/hooks/use-analytics-comparison";
import { formatInr, formatUsd } from "@/lib/utils/currency";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

const SIGNUP_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "joined_at", label: "Joined", format: "date" as const },
  { key: "enrollments_count", label: "Enrolled", align: "right" as const, format: "number" as const },
  {
    key: "total_spent",
    label: "Spent",
    align: "right" as const,
    // Rendered as a multi-currency breakdown so admins can tell INR vs USD
    // purchases apart. See RevenueBreakdownDisplay (cell variant).
    render: (row: Record<string, unknown>) => {
      const spent = (row as unknown as RecentSignupItem).total_spent;
      return <RevenueBreakdownDisplay value={spent} variant="cell" />;
    },
  },
];

const ORDER_COLUMNS = [
  { key: "order_number", label: "Order #" },
  { key: "member_name", label: "Member" },
  {
    key: "total_amount",
    label: "Amount",
    align: "right" as const,
    // Each order has a single currency, render with its own symbol.
    render: (row: Record<string, unknown>) => {
      const amount = parseFloat(String(row.total_amount ?? "0"));
      const currency = String(row.currency ?? "INR");
      if (currency === "USD") return formatUsd(amount);
      return formatInr(amount);
    },
  },
  { key: "status", label: "Status" },
  { key: "order_type", label: "Type" },
  { key: "created_at", label: "Date", format: "date" as const },
];

export default function AnalyticsOverviewPage() {
  const { data, isLoading } = useAnalyticsOverview();
  const { data: comparisonData, isComparing } = useAnalyticsOverviewComparison();

  const [signupPage, setSignupPage] = useState(1);
  const [signupSearch, setSignupSearch] = useState("");
  const { data: signupsData } = useOverviewRecentSignups(signupPage, signupSearch);

  const [orderPage, setOrderPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState("");
  const { data: ordersData } = useOverviewRecentOrders(orderPage, orderSearch);

  if (isLoading || !data) return <AnalyticsSkeleton />;

  const signups = signupsData?.members ?? [];
  const signupsTotal = signupsData?.total ?? 0;

  const orders = ordersData?.orders ?? [];
  const ordersTotal = ordersData?.total ?? 0;

  const prev = isComparing && comparisonData ? comparisonData : null;

  const overviewExport = [
    { Metric: "Total Users", Value: data.total_users },
    { Metric: "Active Users", Value: data.active_users },
    { Metric: "New Users (Range)", Value: data.new_users_in_range },
    { Metric: "Revenue INR", Value: data.total_revenue.inr },
    { Metric: "Revenue USD", Value: data.total_revenue.usd },
    { Metric: "Revenue Combined (≈ INR)", Value: data.total_revenue.combined_inr },
    { Metric: "Revenue in Range INR", Value: data.revenue_in_range.inr },
    { Metric: "Revenue in Range USD", Value: data.revenue_in_range.usd },
    { Metric: "Revenue in Range Combined (≈ INR)", Value: data.revenue_in_range.combined_inr },
    { Metric: "Published Courses", Value: data.published_courses },
    { Metric: "Published Books", Value: data.published_books },
    { Metric: "Course Sales", Value: data.course_sales },
    { Metric: "Book Sales", Value: data.book_sales },
    { Metric: "Certificates", Value: data.certificates },
    { Metric: "Active Period Users", Value: data.active_period_users },
    { Metric: "Active Coupons", Value: data.active_coupons },
    { Metric: "Coupon Redemptions", Value: data.coupon_redemptions },
    { Metric: "Quiz Attempts (range)", Value: data.quiz_attempts_in_range },
    { Metric: "Quiz Pass Rate", Value: `${data.quiz_pass_rate}%` },
    { Metric: "Total Watch Time (sec)", Value: data.total_watch_time_seconds },
    { Metric: "Lectures Completed", Value: data.lectures_completed },
    { Metric: "Books in Progress", Value: data.books_in_progress },
    { Metric: "Books Completed", Value: data.books_completed },
    { Metric: "Total Cart Items", Value: data.total_cart_items },
    { Metric: "Total Bookmarks", Value: data.total_bookmarks },
    { Metric: "Total Highlights", Value: data.total_highlights },
  ];

  const enrollDistData = data.enrollment_distribution.filter((d: { count: number }) => d.count > 0);

  // revenue_by_type holds a full RevenueBreakdown for each order type. Flatten
  // to the combined-in-INR number for the pie chart; the legend/tooltip below
  // shows the full split.
  const revenueTypeData = data.revenue_by_type
    .filter((d) => d.count > 0)
    .map((d) => ({
      type: d.type,
      count: d.count,
      revenue: d.revenue.combined_inr,
      revenue_inr: d.revenue.inr,
      revenue_usd: d.revenue.usd,
    }));

  // Daily revenue chart: currently shows combined-in-INR. A currency toggle
  // lives on the payments analytics page (more chart real estate).
  const dailyRevenueChartData = data.daily_revenue.map((d) => ({
    date: d.date,
    amount: d.amount.combined_inr,
    amount_inr: d.amount.inr,
    amount_usd: d.amount.usd,
    count: d.count,
  }));

  // For comparison charts, flatten previous period too so the existing
  // ComparisonChart (expects number `amount`) keeps working.
  const prevDailyRevenueChartData = prev?.daily_revenue?.map((d) => ({
    date: d.date,
    amount: d.amount.combined_inr,
    count: d.count,
  }));

  const activeEnrollmentRate =
    data.total_enrollments > 0
      ? (data.active_enrollments / data.total_enrollments) * 100
      : 0;
  const prevActiveEnrollmentRate =
    prev && prev.total_enrollments > 0
      ? (prev.active_enrollments / prev.total_enrollments) * 100
      : undefined;

  return (
    <div className="space-y-6">
      {/* Section 1: Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Business Overview</h1>
          <p className="text-sm text-muted-foreground">
            Real-time insights across all platforms
          </p>
        </div>
        <ExportMenu data={overviewExport} fileName="analytics-overview" />
      </div>

      {/* Section 2: Business Health Score */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Multi-currency revenue card, replaces a single-number TrendStat.
            Shows INR / USD / Combined (INR-normalized) breakdown so admins
            can tell which currency generated how much. */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <RevenueBreakdownDisplay
              value={data.total_revenue}
              variant="inline"
              showSubnote
            />
            <p className="text-[10px] text-muted-foreground mt-2 border-t pt-2">
              In selected range: ≈ {formatInr(data.revenue_in_range.combined_inr)}
            </p>
          </CardContent>
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
        </Card>
        <TrendStat
          title="Total Users"
          value={data.total_users}
          previousValue={prev?.total_users}
          format="number"
          subtitle={`+${formatNumber(data.new_users_in_range)} new in range`}
          icon={Users}
          accentColor="bg-cyan-500"
          size="hero"
        />
        <TrendStat
          title="Active Enrollment Rate"
          value={activeEnrollmentRate}
          previousValue={prevActiveEnrollmentRate}
          format="percent"
          subtitle={`${formatNumber(data.active_enrollments)} of ${formatNumber(data.total_enrollments)} enrolled`}
          icon={UserCheck}
          accentColor="bg-blue-500"
          size="hero"
        />
        <TrendStat
          title="Course Completion Rate"
          value={data.enrollment_to_completion_rate}
          previousValue={prev?.enrollment_to_completion_rate}
          format="percent"
          subtitle={`${formatNumber(data.completed_enrollments)} completions`}
          icon={Trophy}
          accentColor="bg-purple-500"
          size="hero"
        />
      </div>

      {/* Section 3: Conversion Funnel */}
      <FunnelChart
        title="Conversion Funnel"
        description="User journey from signup to certification"
        stages={[
          { label: "Signups", value: data.total_users, color: "bg-cyan-500" },
          { label: "Enrolled", value: data.total_enrollments, color: "bg-blue-500" },
          { label: "Completed", value: data.completed_enrollments, color: "bg-emerald-500" },
          { label: "Certified", value: data.certificates, color: "bg-amber-500" },
        ]}
      />

      {/* Section 5: Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Daily New Users */}
        {isComparing && prev?.daily_new_users ? (
          <ComparisonChart
            title="Daily New Users"
            description="Registration trend comparison"
            currentData={data.daily_new_users}
            previousData={prev.daily_new_users}
            dataKey="count"
            currentLabel="This Period"
            previousLabel="Previous Period"
          />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily New Users</CardTitle>
              <CardDescription className="text-xs">Registration trend in range</CardDescription>
            </CardHeader>
            <CardContent>
              {data.daily_new_users.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.daily_new_users} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[7]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS[7]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} />
                    <Area type="monotone" dataKey="count" stroke={CHART_COLORS[7]} fill="url(#userGrad)" strokeWidth={2} name="Users" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-10 text-center">No data for selected range</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Daily Revenue, chart shows combined-in-INR; tooltip shows split */}
        {isComparing && prevDailyRevenueChartData ? (
          <ComparisonChart
            title="Daily Revenue (≈ INR)"
            description="INR-normalized revenue trend"
            currentData={dailyRevenueChartData}
            previousData={prevDailyRevenueChartData}
            dataKey="amount"
            currentLabel="This Period"
            previousLabel="Previous Period"
          />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily Revenue (≈ INR)</CardTitle>
              <CardDescription className="text-xs">
                Combined revenue trend · USD converted at 1 USD = ₹{data.conversion_rate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dailyRevenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyRevenueChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: unknown, _name: unknown, entry: unknown) => {
                        // Recharts passes the row as entry.payload.
                        const payload = (entry as { payload?: { amount_inr?: number; amount_usd?: number } })
                          ?.payload;
                        const inr = payload?.amount_inr ?? 0;
                        const usd = payload?.amount_usd ?? 0;
                        return [
                          `${formatInr(Number(value ?? 0))} (${formatInr(inr)} + ${formatUsd(usd)})`,
                          "Revenue",
                        ];
                      }}
                    />
                    <Area type="monotone" dataKey="amount" stroke={CHART_COLORS[1]} fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-10 text-center">No revenue data in range</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enrollment Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Enrollment Distribution</CardTitle>
            <CardDescription className="text-xs">Breakdown by status</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollDistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={enrollDistData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="status"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${String(name ?? "")} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {enrollDistData.map((_: unknown, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No enrollment data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 6: Product Performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue by Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Type</CardTitle>
            <CardDescription className="text-xs">Sales breakdown by product category</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={revenueTypeData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
                    paddingAngle={3}
                    dataKey="revenue"
                    nameKey="type"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${String(name ?? "").replace(/_/g, " ")} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {revenueTypeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, _n: unknown, entry: unknown) => {
                      const payload = (entry as { payload?: { revenue_inr?: number; revenue_usd?: number } })
                        ?.payload;
                      const inr = payload?.revenue_inr ?? 0;
                      const usd = payload?.revenue_usd ?? 0;
                      return [
                        `${formatInr(Number(value ?? 0))} (${formatInr(inr)} + ${formatUsd(usd)})`,
                        "Revenue",
                      ];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => value.replace(/_/g, " ")} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No revenue breakdown</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              Slices sized by combined (≈ INR) revenue · tooltip shows INR + USD split
            </p>
          </CardContent>
        </Card>

        {/* Top 5 Courses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Courses by Enrollment</CardTitle>
            <CardDescription className="text-xs">Most popular courses</CardDescription>
          </CardHeader>
          <CardContent>
            {data.top_courses.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.top_courses} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis type="category" dataKey="title" tick={{ fontSize: 10 }} width={120} className="text-muted-foreground" tickFormatter={(v: string) => v.length > 18 ? `${v.slice(0, 18)}...` : v} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="enrollment_count" name="Enrollments" radius={[0, 4, 4, 0]}>
                    {data.top_courses.map((_: unknown, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No courses yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 7: Top Books + Monthly Growth */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top 5 Books */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Books by Access</CardTitle>
            <CardDescription className="text-xs">Most accessed books</CardDescription>
          </CardHeader>
          <CardContent>
            {data.top_books.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.top_books} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis type="category" dataKey="title" tick={{ fontSize: 10 }} width={120} className="text-muted-foreground" tickFormatter={(v: string) => v.length > 18 ? `${v.slice(0, 18)}...` : v} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="access_count" name="Accesses" radius={[0, 4, 4, 0]}>
                    {data.top_books.map((_: unknown, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No books yet</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly User Growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly User Growth</CardTitle>
            <CardDescription className="text-xs">Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {data.monthly_growth.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.monthly_growth} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="New Users" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No growth data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 8: Quick Metrics Grid */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <TrendStat title="Published Courses" value={data.published_courses} icon={GraduationCap} accentColor="bg-blue-500" size="mini" />
        <TrendStat title="Course Sales" value={data.course_sales} icon={ShoppingCart} accentColor="bg-teal-500" size="mini" />
        <TrendStat title="Published Books" value={data.published_books} icon={BookOpen} accentColor="bg-indigo-500" size="mini" />
        <TrendStat title="Book Sales" value={data.book_sales} icon={TrendingUp} accentColor="bg-amber-500" size="mini" />
        <TrendStat title="Certificates" value={data.certificates} icon={Award} accentColor="bg-yellow-500" size="mini" />
        <TrendStat title="Coupons Redeemed" value={data.coupon_redemptions} icon={Ticket} accentColor="bg-rose-500" size="mini" />
        <TrendStat title="Quiz Attempts" value={data.quiz_attempts_in_range} icon={Trophy} accentColor="bg-amber-500" size="mini" />
        <TrendStat title="Quiz Pass Rate" value={data.quiz_pass_rate} format="percent" icon={Trophy} accentColor="bg-emerald-500" size="mini" />
        <TrendStat title="Watch Time" value={data.total_watch_time_seconds} format="duration" icon={Video} accentColor="bg-violet-500" size="mini" />
        <TrendStat title="Lectures Completed" value={data.lectures_completed} icon={Video} accentColor="bg-violet-600" size="mini" />
        <TrendStat title="Books in Progress" value={data.books_in_progress} icon={BookOpen} accentColor="bg-amber-600" size="mini" />
        <TrendStat title="Books Completed" value={data.books_completed} icon={BookOpen} accentColor="bg-emerald-600" size="mini" />
        <TrendStat title="Cart Items" value={data.total_cart_items} icon={ShoppingCart} accentColor="bg-orange-500" size="mini" />
        <TrendStat title="Bookmarks" value={data.total_bookmarks} icon={Bookmark} accentColor="bg-rose-500" size="mini" />
        <TrendStat title="Highlights" value={data.total_highlights} icon={Highlighter} accentColor="bg-yellow-600" size="mini" />
      </div>

      {/* Section 9: Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span>Total</span><span className="font-semibold">{formatNumber(data.total_enrollments)}</span></div>
            <div className="flex justify-between text-sm"><span>Active</span><span className="font-semibold text-emerald-500">{formatNumber(data.active_enrollments)}</span></div>
            <div className="flex justify-between text-sm"><span>Completed</span><span className="font-semibold text-blue-500">{formatNumber(data.completed_enrollments)}</span></div>
            <div className="flex justify-between text-sm"><span>In Range</span><span className="font-semibold text-amber-500">{formatNumber(data.enrollments_in_range)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span>Total</span><span className="font-semibold">{formatNumber(data.total_orders)}</span></div>
            <div className="flex justify-between text-sm"><span>Paid</span><span className="font-semibold text-emerald-500">{formatNumber(data.paid_orders)}</span></div>
            <div className="flex justify-between text-sm"><span>In Range</span><span className="font-semibold text-amber-500">{formatNumber(data.orders_in_range)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span>Courses</span><span className="font-semibold">{data.total_courses} ({data.published_courses} published)</span></div>
            <div className="flex justify-between text-sm"><span>Books</span><span className="font-semibold">{data.total_books} ({data.published_books} published)</span></div>
            <div className="flex justify-between text-sm"><span>Active Coupons</span><span className="font-semibold text-purple-500">{data.active_coupons}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Section 10: Recent Activity Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Signups */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Signups</CardTitle>
              </div>
              <ExportMenu
                data={signups.map((u) => ({
                  Name: u.name,
                  Email: u.email ?? "-",
                  Status: u.status,
                  Joined: u.joined_at ? new Date(String(u.joined_at)).toLocaleDateString() : "-",
                  Enrollments: u.enrollments_count,
                  "Spent INR": u.total_spent.inr,
                  "Spent USD": u.total_spent.usd,
                  "Spent Combined (≈ INR)": u.total_spent.combined_inr,
                }))}
                fileName="recent-signups"
                size="sm"
              />
            </div>
            <CardDescription className="text-xs">{signupsTotal} users in range</CardDescription>
          </CardHeader>
          <CardContent>
            <AnalyticsDataTable
              columns={SIGNUP_COLUMNS}
              data={signups as never[]}
              total={signupsTotal}
              page={signupPage}
              pageSize={10}
              onPageChange={setSignupPage}
              search={signupSearch}
              onSearchChange={(v) => { setSignupSearch(v); setSignupPage(1); }}
              searchPlaceholder="Search name or email..."
              emptyMessage="No signups found"
            />
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Orders</CardTitle>
              </div>
              <ExportMenu
                data={orders.map((o) => ({
                  "Order #": o.order_number,
                  Member: o.member_name ?? "-",
                  Email: o.member_email ?? "-",
                  Amount: o.total_amount,
                  Currency: o.currency,
                  Status: o.status,
                  Type: o.order_type,
                  Date: new Date(String(o.created_at)).toLocaleDateString(),
                }))}
                fileName="recent-orders"
                size="sm"
              />
            </div>
            <CardDescription className="text-xs">{ordersTotal} orders in range</CardDescription>
          </CardHeader>
          <CardContent>
            <AnalyticsDataTable
              columns={ORDER_COLUMNS}
              data={orders as never[]}
              total={ordersTotal}
              page={orderPage}
              pageSize={10}
              onPageChange={setOrderPage}
              search={orderSearch}
              onSearchChange={(v) => { setOrderSearch(v); setOrderPage(1); }}
              searchPlaceholder="Search name, email or order #..."
              emptyMessage="No orders found"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
