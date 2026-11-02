"use client";

import { decodeHtmlEntities } from "@open-mtlms/shared";
import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { AnalyticsDataTable } from "@/components/analytics/analytics-data-table";
import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { TrendStat } from "@/components/analytics/trend-stat";
import { RevenueBreakdownDisplay } from "@/components/shared/RevenueBreakdown";
import type { AnalyticsBookItem } from "@/lib/api/analytics";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsBooks } from "@/lib/hooks/use-analytics";
import { formatInr } from "@/lib/utils/currency";

export default function BooksAnalyticsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useAnalyticsBooks(page, search);

  const books = useMemo(() => data?.items ?? [], [data?.items]);

  const topBooksByAccess = useMemo(() => {
    const sorted = [...books].sort((a, b) => (b.access_count ?? 0) - (a.access_count ?? 0));
    return sorted.slice(0, 10).map((b) => ({
      date: String(b.title ?? "Unknown").slice(0, 20),
      count: b.access_count ?? 0,
    }));
  }, [books]);

  const topBooksByRevenue = useMemo(() => {
    // Ranked by combined ≈ INR so INR + USD books are comparable.
    const sorted = [...books].sort(
      (a, b) => (b.revenue?.combined_inr ?? 0) - (a.revenue?.combined_inr ?? 0),
    );
    return sorted.slice(0, 8).map((b) => ({
      date: String(b.title ?? "Unknown").slice(0, 25),
      count: b.revenue?.combined_inr ?? 0,
    }));
  }, [books]);

  const statusDistribution = useMemo(() => {
    const dist = data?.status_distribution ?? [];
    return dist
      .filter((d) => (d.count ?? 0) > 0)
      .map((d) => ({ name: String(d.status ?? "Unknown"), value: d.count ?? 0 }));
  }, [data?.status_distribution]);

  // Graphical Excel report (KPIs + charts) over the current book set.
  const buildReport = useCallback(async () => {
    const all = data?.items ?? [];
    const totalAccess = data?.sum_access ?? all.reduce((s, b) => s + (b.access_count ?? 0), 0);
    const totalSales = data?.sum_sales ?? all.reduce((s, b) => s + (b.sales_count ?? 0), 0);
    const totalRevenueCombined =
      data?.sum_revenue?.combined_inr ??
      all.reduce((s, b) => s + (b.revenue?.combined_inr ?? 0), 0);

    const topByAccess = [...all]
      .sort((a, b) => (b.access_count ?? 0) - (a.access_count ?? 0))
      .slice(0, 10);
    const topByRevenue = [...all]
      .sort((a, b) => (b.revenue?.combined_inr ?? 0) - (a.revenue?.combined_inr ?? 0))
      .slice(0, 8);

    const charts: ChartSpec[] = [];
    if (data?.daily_access?.length)
      charts.push({
        kind: "line",
        title: "Daily book sales",
        labels: data.daily_access.map((d) => d.date),
        series: [
          {
            name: "Sales",
            color: REPORT_COLORS.blue,
            values: data.daily_access.map((d) => d.count),
          },
        ],
      });
    if (data?.daily_revenue?.length)
      charts.push({
        kind: "line",
        title: "Daily book revenue (INR eq.)",
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
    if (topByAccess.length)
      charts.push({
        kind: "bar",
        title: "Top books by access",
        bars: topByAccess.map((b) => ({
          label: decodeHtmlEntities(b.title ?? "Unknown"),
          value: b.access_count ?? 0,
        })),
      });
    if (topByRevenue.some((b) => (b.revenue?.combined_inr ?? 0) > 0))
      charts.push({
        kind: "bar",
        title: "Top books by revenue (INR eq.)",
        bars: topByRevenue.map((b) => ({
          label: decodeHtmlEntities(b.title ?? "Unknown"),
          value: Math.round(b.revenue?.combined_inr ?? 0),
        })),
        valueFormat: formatInr,
      });

    await buildAnalyticsReport({
      fileName: "books-report",
      title: "Books report",
      kpis: [
        { label: "Total books", value: String(data?.total ?? all.length) },
        { label: "Total access", value: String(totalAccess) },
        { label: "Total sales", value: String(totalSales) },
        { label: "Total revenue (INR eq.)", value: formatInr(totalRevenueCombined) },
      ],
      charts,
      sheets: [
        {
          name: "Books",
          columns: [
            { header: "Title", key: "Title", width: 32 },
            { header: "Status", key: "Status", width: 12 },
            { header: "Purchase Mode", key: "Purchase Mode", width: 14 },
            { header: "Price INR", key: "Price INR", width: 12, numFmt: "#,##0" },
            { header: "Price USD", key: "Price USD", width: 12, numFmt: "#,##0" },
            { header: "Access Count", key: "Access Count", width: 14, numFmt: "#,##0" },
            { header: "Active Access", key: "Active Access", width: 14, numFmt: "#,##0" },
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
            "Access Count": b.access_count ?? 0,
            "Active Access": b.active_access ?? 0,
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
    data?.sum_access,
    data?.sum_sales,
    data?.sum_revenue,
    data?.daily_access,
    data?.daily_revenue,
    statusDistribution,
  ]);

  if (isLoading) return <AnalyticsSkeleton />;
  const total = data?.total ?? 0;
  const sumAccess = data?.sum_access ?? 0;
  const sumRevenue = data?.sum_revenue;
  const sumSales = data?.sum_sales ?? 0;

  const exportData = books.map((b) => ({
    Title: b.title,
    Status: b.status,
    "Purchase Mode": b.purchase_mode,
    "Price INR": b.price_inr ?? 0,
    "Price USD": b.price_usd ?? 0,
    "Access Count": b.access_count ?? 0,
    "Active Access": b.active_access ?? 0,
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
            <BookOpen className="h-6 w-6" />
            Books Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} books total
          </p>
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="books-analytics"
          sheetName="Books"
        />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <TrendStat title="Total Books" value={data?.total ?? total} icon={BookOpen} />
        <TrendStat title="Total Access" value={sumAccess} />
        <TrendStat title="Total Sales" value={sumSales} />
      </div>

      {sumRevenue && (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            Total Revenue
          </p>
          <RevenueBreakdownDisplay value={sumRevenue} variant="inline" showSubnote />
        </div>
      )}

      {data?.daily_access != null && data.daily_access.length > 0 && (
        <AnalyticsAreaChart
          title="Daily Book Sales"
          description="Book purchases over time"
          data={data.daily_access}
          dataKey="count"
          name="Sales"
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {statusDistribution.length > 0 && (
          <AnalyticsPieChart
            title="Book Status Distribution"
            description="Breakdown by status"
            data={statusDistribution}
          />
        )}
        {topBooksByAccess.length > 0 && (
          <AnalyticsBarChart
            title="Top Books by Access"
            description="From current page"
            data={topBooksByAccess}
            dataKey="count"
            name="Access"
            layout="vertical"
          />
        )}
      </div>

      {topBooksByRevenue.length > 0 && topBooksByRevenue.some((r) => r.count > 0) && (
        <AnalyticsBarChart
          title="Top Books by Revenue"
          description="Ranked by combined ≈ INR"
          data={topBooksByRevenue}
          dataKey="count"
          name="Revenue (≈ INR)"
          layout="vertical"
        />
      )}

      {data?.daily_revenue != null && data.daily_revenue.length > 0 && (
        <AnalyticsAreaChart
          title="Daily Book Revenue (≈ INR)"
          description="Combined revenue from book sales over time"
          data={data.daily_revenue.map((r) => ({ date: r.date, count: r.amount.combined_inr }))}
          dataKey="count"
          name="Revenue (≈ INR)"
        />
      )}

      <AnalyticsDataTable
        columns={[
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
          { key: "access_count", label: "Access Count", align: "right", format: "number" },
          { key: "active_access", label: "Active Access", align: "right", format: "number" },
          {
            key: "revenue",
            label: "Revenue",
            align: "right",
            render: (row) => {
              const rev = (row as unknown as AnalyticsBookItem).revenue;
              return <RevenueBreakdownDisplay value={rev} variant="cell" />;
            },
          },
          { key: "sales_count", label: "Sales", align: "right", format: "number" },
        ]}
        data={books as unknown as Record<string, unknown>[]}
        total={data?.total ?? 0}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        onRowClick={(row) => router.push(`/dashboard/analytics/books-analytics/${row.id}`)}
        emptyMessage="No books found"
        searchPlaceholder="Search books..."
      />
    </div>
  );
}
