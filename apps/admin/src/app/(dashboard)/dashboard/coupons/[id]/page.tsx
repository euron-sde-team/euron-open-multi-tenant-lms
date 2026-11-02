"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@open-mtlms/core";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  Percent,
  ReceiptText,
  Tag,
  TrendingDown,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
} from "@/components/analytics/chart-components";
import { CouponForm } from "@/components/coupons/CouponForm";
import {
  useCoupon,
  useCouponDetailedAnalytics,
  useCouponRedemptions,
} from "@/lib/hooks/use-coupons";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrencyEntries(
  entries: Array<{ currency: string; total?: number; avg?: number }>,
  field: "total" | "avg",
): string {
  if (!entries || entries.length === 0) return "0";
  return entries
    .map((e) => `${e.currency} ${Number(e[field] ?? 0).toLocaleString()}`)
    .join(", ");
}

function computeRevenueTotal(
  revenueImpact: Array<{ currency: string; total_original_amount: number }>,
): string {
  if (!revenueImpact || revenueImpact.length === 0) return "0";
  return revenueImpact
    .map(
      (r) =>
        `${r.currency} ${Number(r.total_original_amount ?? 0).toLocaleString()}`,
    )
    .join(", ");
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EditCouponPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { data: coupon, isLoading, isError } = useCoupon(id);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !coupon) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="py-12 text-center text-sm text-muted-foreground">
          Coupon not found.{" "}
          <Link href="/dashboard/coupons" className="text-primary underline">
            Back to coupons
          </Link>
        </div>
      </div>
    );
  }

  const discountInfo = `${coupon.discountValue}% off`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/coupons">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Coupon: {coupon.code}
          </h1>
          <p className="text-sm text-muted-foreground">{discountInfo}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: analytics (~2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <CouponAnalyticsCards couponId={id} />
          <CouponRedemptionTimeline couponId={id} />
          <CouponChartsRow couponId={id} />
          <CouponTopUsers couponId={id} />
          <CouponRedemptionsTable couponId={id} />
        </div>

        {/* Right column: edit form (~1/3) */}
        <div>
          <CouponForm coupon={coupon} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Header (reused for error state)
// ---------------------------------------------------------------------------

function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/dashboard/coupons">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Coupon Details
        </h1>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Cards (2 rows x 3)
// ---------------------------------------------------------------------------

function CouponAnalyticsCards({ couponId }: { couponId: string }) {
  const { data: analytics, isLoading } = useCouponDetailedAnalytics(couponId);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  const stats = [
    {
      title: "Total Redemptions",
      value: String(analytics.total_redemptions ?? 0),
      icon: ReceiptText,
    },
    {
      title: "Unique Users",
      value: String(analytics.unique_users ?? 0),
      icon: Users,
    },
    {
      title: "Usage Rate",
      value:
        analytics.usage_rate != null
          ? `${analytics.usage_rate}%`
          : "Unlimited",
      icon: Percent,
    },
    {
      title: "Total Discount Given",
      value: formatCurrencyEntries(
        analytics.total_discount_by_currency ?? [],
        "total",
      ),
      icon: Tag,
    },
    {
      title: "Avg Discount / Redemption",
      value: formatCurrencyEntries(
        analytics.avg_discount_by_currency ?? [],
        "avg",
      ),
      icon: TrendingDown,
    },
    {
      title: "Revenue Generated",
      value: computeRevenueTotal(analytics.revenue_impact ?? []),
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Redemption Timeline Chart
// ---------------------------------------------------------------------------

function CouponRedemptionTimeline({ couponId }: { couponId: string }) {
  const { data: analytics, isLoading } = useCouponDetailedAnalytics(couponId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const dailyData = analytics?.daily_redemptions ?? [];
  if (dailyData.length === 0) return null;

  return <AnalyticsAreaChart title="Redemption Timeline" data={dailyData} />;
}

// ---------------------------------------------------------------------------
// Item Breakdown + Applicable Items (side by side)
// ---------------------------------------------------------------------------

function CouponChartsRow({ couponId }: { couponId: string }) {
  const { data: analytics, isLoading } = useCouponDetailedAnalytics(couponId);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) return null;

  const itemBreakdown = (analytics.item_breakdown ?? []).map((item) => ({
    date: item.item_name,
    count: item.redemption_count,
  }));

  const applicableItems = analytics.applicable_items ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {itemBreakdown.length > 0 ? (
        <AnalyticsBarChart
          title="Top Items by Redemption"
          data={itemBreakdown}
          layout="vertical"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Items by Redemption</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-8 text-center text-sm text-muted-foreground">
              No item data yet.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applicable Items</CardTitle>
        </CardHeader>
        <CardContent>
          {applicableItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Applies to all products
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {applicableItems.map((item) => (
                <Badge key={item.item_id} variant="secondary">
                  {item.item_type}: {item.item_name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top Users
// ---------------------------------------------------------------------------

function CouponTopUsers({ couponId }: { couponId: string }) {
  const { data: analytics, isLoading } = useCouponDetailedAnalytics(couponId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const topUsers = analytics?.top_users ?? [];
  if (topUsers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Users</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground">
                  Email
                </th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground">
                  Redemptions
                </th>
                <th className="pb-2 font-medium text-muted-foreground">
                  Total Discount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topUsers.map((user) => (
                <tr key={user.member_id}>
                  <td className="py-2.5 pr-4 font-medium">
                    {user.name || "Unknown"}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="py-2.5 pr-4">{user.redemption_count}</td>
                  <td className="py-2.5">
                    {Number(user.total_discount ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Redemptions table with pagination
// ---------------------------------------------------------------------------

function CouponRedemptionsTable({ couponId }: { couponId: string }) {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, isLoading } = useCouponRedemptions(couponId, page, limit);

  const redemptions = data?.redemptions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (isLoading && page === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Redemption History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Redemption History</CardTitle>
      </CardHeader>
      <CardContent>
        {redemptions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No redemptions yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">
                      User
                    </th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">
                      Order
                    </th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">
                      Discount
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {redemptions.map(
                    (r: Record<string, unknown>, idx: number) => (
                      <tr key={String(r.id ?? idx)}>
                        <td className="py-2.5 pr-4">
                          <div className="font-medium">
                            {String(r.userName ?? r.userEmail ?? "Unknown")}
                          </div>
                          {Boolean(r.userEmail) && Boolean(r.userName) && (
                            <div className="text-xs text-muted-foreground">
                              {String(r.userEmail)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {String(r.orderId ?? "-")}
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.currency ? `${String(r.currency)} ` : ""}
                          {Number(r.discountAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {r.redeemedAt
                            ? new Date(
                                String(r.redeemedAt),
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
