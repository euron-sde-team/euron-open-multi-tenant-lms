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
import { ChevronLeft, ChevronRight, Package, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { RevenueBreakdownDisplay } from "@/components/shared/RevenueBreakdown";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsBundles } from "@/lib/hooks/use-analytics";
import { formatInr } from "@/lib/utils/currency";

export default function BundlesAnalyticsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useAnalyticsBundles(page, search);

  const topBundlesBySales = useMemo(() => {
    const items = data?.items ?? [];
    const sorted = [...items].sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0));
    return sorted.slice(0, 10).map((b) => ({
      date: String(b.title ?? "Unknown").slice(0, 20),
      count: b.sales_count ?? 0,
    }));
  }, [data?.items]);

  const statusDistribution = useMemo(() => {
    const dist = data?.status_distribution ?? [];
    return dist
      .filter((d) => (d.count ?? 0) > 0)
      .map((d) => ({ name: String(d.status ?? "Unknown"), value: d.count ?? 0 }));
  }, [data?.status_distribution]);

  // Graphical Excel report (KPIs + charts) over the current bundle set.
  const buildReport = useCallback(async () => {
    const all = data?.items ?? [];
    const totalItems = data?.sum_items ?? all.reduce((s, b) => s + (b.item_count ?? 0), 0);
    const totalSales = data?.sum_sales ?? all.reduce((s, b) => s + (b.sales_count ?? 0), 0);
    const totalRevenueCombined =
      data?.sum_revenue?.combined_inr ??
      all.reduce((s, b) => s + (b.revenue?.combined_inr ?? 0), 0);

    const topBySales = [...all]
      .sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0))
      .slice(0, 10);

    const charts: ChartSpec[] = [];
    if (data?.daily_sales?.length)
      charts.push({
        kind: "line",
        title: "Daily bundle sales",
        labels: data.daily_sales.map((d) => d.date),
        series: [
          {
            name: "Sales",
            color: REPORT_COLORS.blue,
            values: data.daily_sales.map((d) => d.count),
          },
        ],
      });
    if (data?.daily_revenue?.length)
      charts.push({
        kind: "line",
        title: "Daily revenue (INR eq.)",
        labels: data.daily_revenue.map((d) => d.date),
        series: [
          {
            name: "Revenue (≈ INR)",
            color: REPORT_COLORS.emerald,
            values: data.daily_revenue.map((d) => d.amount.combined_inr),
          },
        ],
      });
    if (statusDistribution.length)
      charts.push({
        kind: "donut",
        title: "Status distribution",
        segments: statusDistribution.map((d) => ({ label: d.name, value: d.value })),
      });
    if (topBySales.some((b) => (b.sales_count ?? 0) > 0))
      charts.push({
        kind: "bar",
        title: "Top bundles by sales",
        bars: topBySales.map((b) => ({
          label: decodeHtmlEntities(b.title ?? "Unknown"),
          value: b.sales_count ?? 0,
        })),
      });

    await buildAnalyticsReport({
      fileName: "bundles-report",
      title: "Bundles report",
      kpis: [
        { label: "Total bundles", value: String(data?.total ?? all.length) },
        { label: "Total items", value: String(totalItems) },
        { label: "Total sales", value: String(totalSales) },
        { label: "Total revenue (INR eq.)", value: formatInr(totalRevenueCombined) },
      ],
      charts,
      sheets: [
        {
          name: "Bundles",
          columns: [
            { header: "Title", key: "Title", width: 32 },
            { header: "Status", key: "Status", width: 12 },
            { header: "Purchase Mode", key: "Purchase Mode", width: 14 },
            { header: "Price INR", key: "Price INR", width: 12, numFmt: "#,##0" },
            { header: "Price USD", key: "Price USD", width: 12, numFmt: "#,##0" },
            { header: "Items", key: "Items", width: 10, numFmt: "#,##0" },
            { header: "Revenue INR", key: "Revenue INR", width: 14, numFmt: "#,##0" },
            { header: "Revenue USD", key: "Revenue USD", width: 14, numFmt: "#,##0" },
            { header: "Revenue Combined (INR eq.)", key: "Revenue Combined (≈ INR)", width: 22, numFmt: "#,##0" },
            { header: "Sales", key: "Sales", width: 10, numFmt: "#,##0" },
          ],
          rows: all.map((b) => ({
            Title: decodeHtmlEntities(b.title ?? ""),
            Status: b.status,
            "Purchase Mode": b.purchase_mode,
            "Price INR": b.price_inr ?? 0,
            "Price USD": b.price_usd ?? 0,
            Items: b.item_count ?? 0,
            "Revenue INR": b.revenue.inr,
            "Revenue USD": b.revenue.usd,
            "Revenue Combined (≈ INR)": b.revenue.combined_inr,
            Sales: b.sales_count ?? 0,
          })),
          dataBarColumn: "Revenue Combined (≈ INR)",
        },
      ],
    });
  }, [
    data?.items,
    data?.total,
    data?.sum_items,
    data?.sum_sales,
    data?.sum_revenue,
    data?.daily_sales,
    data?.daily_revenue,
    statusDistribution,
  ]);

  if (isLoading) return <AnalyticsSkeleton />;

  const bundles = data?.items ?? [];
  const total = data?.total ?? 0;
  const sumItems = data?.sum_items ?? 0;
  const sumRevenue = data?.sum_revenue;
  const sumSales = data?.sum_sales ?? 0;

  const exportData = bundles.map((b) => ({
    Title: b.title,
    Status: b.status,
    "Purchase Mode": b.purchase_mode,
    "Price INR": b.price_inr ?? 0,
    "Price USD": b.price_usd ?? 0,
    Items: b.item_count ?? 0,
    "Revenue INR": b.revenue.inr,
    "Revenue USD": b.revenue.usd,
    "Revenue Combined (≈ INR)": b.revenue.combined_inr,
    Sales: b.sales_count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Bundles Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} bundles total
          </p>
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="bundles-analytics"
          sheetName="Bundles"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bundles..."
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

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Bundles</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sumItems.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sumSales.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {sumRevenue && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBreakdownDisplay value={sumRevenue} variant="inline" showSubnote />
          </CardContent>
        </Card>
      )}

      {data?.daily_sales && data.daily_sales.length > 0 && (
        <AnalyticsAreaChart
          title="Daily Bundle Sales"
          description="Bundle sales over time"
          data={data.daily_sales}
          dataKey="count"
          name="Sales"
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {statusDistribution.length > 0 && (
          <AnalyticsPieChart
            title="Status Distribution"
            description="Bundles by status"
            data={statusDistribution}
          />
        )}
        {topBundlesBySales.length > 0 && (
          <AnalyticsBarChart
            title="Top Bundles by Sales"
            description="Highest selling bundles"
            data={topBundlesBySales}
            dataKey="count"
            name="Sales"
            layout="vertical"
          />
        )}
      </div>

      {data?.daily_revenue && data.daily_revenue.length > 0 && (
        <AnalyticsLineChart
          title="Daily Revenue (≈ INR)"
          description="Combined revenue trend over time"
          data={data.daily_revenue.map((r) => ({
            date: r.date,
            amount: r.amount.combined_inr,
            count: r.count,
          }))}
          lines={[
            { dataKey: "amount", name: "Revenue (≈ INR)" },
          ]}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Title</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Items</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Sales</th>
                </tr>
              </thead>
              <tbody>
                {bundles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No bundles found
                    </td>
                  </tr>
                ) : (
                  bundles.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="max-w-[250px] truncate px-4 py-3 font-medium" title={b.title}>
                        {b.title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            b.status === "PUBLISHED"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{b.item_count}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <RevenueBreakdownDisplay value={b.revenue} variant="cell" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{b.sales_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {(data?.total ?? 0) > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {bundles.length} of {data?.total ?? 0}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span className="text-sm font-medium">Page {page}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bundles.length < 20}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
