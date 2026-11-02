"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Hash,
  Search,
  Ticket,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { CHART_COLORS } from "@/components/analytics/chart-utils";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsCoupons } from "@/lib/hooks/use-analytics";

export default function CouponsAnalyticsPage() {
  const { dateRange } = useAnalyticsDateRange();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { data, isLoading } = useAnalyticsCoupons(page, search);

  const total = data?.total ?? 0;
  const active = data?.active ?? 0;
  const totalUsage = data?.total_usage ?? 0;
  const coupons = useMemo(() => data?.coupons ?? [], [data?.coupons]);
  const couponsTotal = data?.coupons_total ?? 0;
  const dailyRedemptions = useMemo(() => data?.daily_redemptions ?? [], [data?.daily_redemptions]);

  const inactive = Math.max(0, total - active);
  const usageRate = total > 0 ? (totalUsage / total).toFixed(1) : "0";

  const activeVsInactivePieData = useMemo(() => {
    const items: Array<{ name: string; value: number }> = [];
    if (active > 0) items.push({ name: "Active", value: active });
    if (inactive > 0) items.push({ name: "Inactive", value: inactive });
    return items;
  }, [active, inactive]);

  const discountTypePieData = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const c of coupons) {
      const type = c.discount_type ?? "Unknown";
      grouped[type] = (grouped[type] ?? 0) + 1;
    }
    return Object.entries(grouped)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: String(name).replace(/_/g, " "),
        value,
      }));
  }, [coupons]);

  const topCouponsChartData = useMemo(() => {
    return coupons
      .slice(0, 10)
      .map((c) => ({
        date: String(c.code ?? "Unknown").slice(0, 20),
        count: c.used_count ?? 0,
      }));
  }, [coupons]);

  const cumulativeRedemptions = useMemo(() => {
    let cum = 0;
    return dailyRedemptions.map((d) => {
      cum += d.count ?? 0;
      return { date: d.date, count: cum };
    });
  }, [dailyRedemptions]);

  const totalVsUsedChartData = useMemo(() => {
    return [
      { date: "Total Coupons", count: total },
      { date: "Total Used", count: totalUsage },
    ];
  }, [total, totalUsage]);

  const exportData = coupons.map((c) => ({
    Code: c.code ?? "",
    "Discount Type": c.discount_type ?? "",
    "Discount Value": c.discount_value ?? 0,
    Active: c.is_active ? "Yes" : "No",
    "Used Count": c.used_count ?? 0,
    "Max Uses": c.max_uses ?? "Unlimited",
    "Valid From": c.valid_from ? new Date(c.valid_from).toLocaleDateString() : "-",
    "Valid To": c.valid_to ? new Date(c.valid_to).toLocaleDateString() : "-",
    Created: new Date(c.created_at ?? "").toLocaleDateString(),
  }));

  // Graphical Excel report (KPIs + charts) over the current coupon set.
  const buildReport = useCallback(async () => {
    const charts: ChartSpec[] = [];
    if (activeVsInactivePieData.length)
      charts.push({
        kind: "donut",
        title: "Active vs Inactive coupons",
        segments: activeVsInactivePieData.map((d) => ({ label: d.name, value: d.value })),
      });
    if (discountTypePieData.length)
      charts.push({
        kind: "donut",
        title: "Discount type distribution",
        segments: discountTypePieData.map((d) => ({ label: d.name, value: d.value })),
      });
    if (dailyRedemptions.length)
      charts.push({
        kind: "line",
        title: "Daily coupon redemptions",
        labels: dailyRedemptions.map((d) => d.date),
        series: [{ name: "Redemptions", color: REPORT_COLORS.blue, values: dailyRedemptions.map((d) => d.count ?? 0) }],
      });
    if (topCouponsChartData.length)
      charts.push({
        kind: "bar",
        title: "Top coupons by usage",
        bars: topCouponsChartData.map((d) => ({ label: decodeHtmlEntities(d.date), value: d.count })),
      });

    await buildAnalyticsReport({
      fileName: "coupons-report",
      title: "Coupons report",
      subtitle: dateRange?.label,
      kpis: [
        { label: "Total coupons", value: String(total) },
        { label: "Active coupons", value: String(active) },
        { label: "Inactive coupons", value: String(inactive) },
        { label: "Total usage", value: String(totalUsage) },
        { label: "Avg uses per coupon", value: usageRate },
      ],
      charts,
      sheets: [
        {
          name: "Coupons",
          columns: [
            { header: "Code", key: "Code", width: 18 },
            { header: "Discount Type", key: "Discount Type", width: 16 },
            { header: "Discount Value", key: "Discount Value", width: 14, numFmt: "#,##0" },
            { header: "Active", key: "Active", width: 10 },
            { header: "Used Count", key: "Used Count", width: 12, numFmt: "#,##0" },
            { header: "Max Uses", key: "Max Uses", width: 12 },
            { header: "Valid From", key: "Valid From", width: 14 },
            { header: "Valid To", key: "Valid To", width: 14 },
            { header: "Created", key: "Created", width: 14 },
          ],
          rows: exportData,
          dataBarColumn: "Used Count",
        },
      ],
    });
  }, [
    activeVsInactivePieData,
    discountTypePieData,
    dailyRedemptions,
    topCouponsChartData,
    exportData,
    dateRange?.label,
    total,
    active,
    inactive,
    totalUsage,
    usageRate,
  ]);

  const couponsTotalPages = couponsTotal === 0 ? 1 : Math.ceil(couponsTotal / 20);

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data) return <p className="text-sm text-muted-foreground py-10 text-center">No coupon data available</p>;

  const filterLabel =
    dateRange?.label ??
    (dateRange?.startDate && dateRange?.endDate
      ? `${new Date(dateRange.startDate).toLocaleDateString()} – ${new Date(dateRange.endDate).toLocaleDateString()}`
      : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6" />
            Coupons Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Coupon performance and usage
          </p>
          {filterLabel && (
            <p className="text-xs text-muted-foreground mt-1">
              Date range: {filterLabel}
            </p>
          )}
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="coupons-analytics"
          sheetName="Coupons"
        />
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Coupons</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{active.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inactive Coupons</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactive.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Uses per Coupon</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageRate}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {total > 0 ? "Usage rate" : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active vs Inactive pie */}
      {activeVsInactivePieData.length > 0 && (
        <AnalyticsPieChart
          title="Active vs Inactive Coupons"
          description="Coupon status distribution"
          data={activeVsInactivePieData}
          height={260}
        />
      )}

      {/* Total vs Used bar chart */}
      {(total > 0 || totalUsage > 0) && (
        <AnalyticsBarChart
          title="Total Coupons vs Total Used"
          description="High-level comparison of coupons and redemption count"
          data={totalVsUsedChartData}
          dataKey="count"
          name="Count"
          layout="vertical"
          height={180}
        />
      )}

      {/* Daily Redemptions - Line chart */}
      <AnalyticsLineChart
        title="Daily Coupon Redemptions"
        description="Redemptions over time"
        data={dailyRedemptions}
        dataKey="count"
        name="Redemptions"
        height={280}
      />

      {/* Cumulative Redemptions - Area chart */}
      {cumulativeRedemptions.length > 0 && (
        <AnalyticsAreaChart
          title="Cumulative Redemptions"
          description="Running total of redemptions in selected period"
          data={cumulativeRedemptions}
          dataKey="count"
          name="Cumulative"
          height={280}
          color={CHART_COLORS[1]}
        />
      )}

      {/* Discount Type Distribution pie */}
      {discountTypePieData.length > 0 && (
        <AnalyticsPieChart
          title="Discount Type Distribution"
          description="Percentage vs Fixed discount coupons"
          data={discountTypePieData}
          height={260}
        />
      )}

      {/* Top Coupons by Usage - Bar chart */}
      {topCouponsChartData.length > 0 && (
        <AnalyticsBarChart
          title="Top Coupons by Usage"
          description="Most-used coupon codes"
          data={topCouponsChartData}
          dataKey="count"
          name="Uses"
          layout="vertical"
          height={Math.min(400, 120 + topCouponsChartData.length * 36)}
        />
      )}

      {/* Coupons table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coupons</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSearch(searchInput);
                      setPage(1);
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch(searchInput);
                  setPage(1);
                }}
              >
                Search
              </Button>
              {search && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Code</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Type</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Discount</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Active</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Used / Max</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Valid From</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Valid To</th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No coupons found
                    </td>
                  </tr>
                ) : (
                  coupons.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 font-mono font-medium">{c.code ?? "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground capitalize">
                        {String(c.discount_type ?? "").replace(/_/g, " ")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        {c.discount_type === "PERCENTAGE"
                          ? `${c.discount_value ?? 0}%`
                          : `₹${c.discount_value ?? 0}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.is_active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {c.is_active ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {c.used_count ?? 0} / {c.max_uses ?? "∞"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {c.valid_from ? new Date(c.valid_from).toLocaleDateString() : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {c.valid_to ? new Date(c.valid_to).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {coupons.length} of {couponsTotal}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm font-medium">Page {page} of {couponsTotalPages}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= couponsTotalPages}
                onClick={() => setPage((p) => Math.min(couponsTotalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
