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
import { BookOpen, ChevronLeft, ChevronRight, Package, Search, ShoppingCart } from "lucide-react";
import { useCallback, useState } from "react";

import { AnalyticsBarChart } from "@/components/analytics/chart-components";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsCart } from "@/lib/hooks/use-analytics";

export default function CartAnalyticsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useAnalyticsCart(page, search);

  // Graphical Excel report (KPIs + charts) over the current cart set.
  const buildReport = useCallback(async () => {
    const rows = data?.items ?? [];
    const exportRows = rows.map((c) => ({
      Member: c.member_name,
      Email: c.member_email ?? "-",
      "Item Type": c.item_type,
      "Item Title": decodeHtmlEntities(c.item_title),
      "Added At": c.created_at ? new Date(c.created_at).toLocaleString() : "-",
    }));

    const typeCounts: Record<string, number> = {
      Courses: data?.courses_in_cart ?? 0,
      Books: data?.books_in_cart ?? 0,
      Bundles: data?.bundles_in_cart ?? 0,
    };
    const typeSegments = Object.entries(typeCounts)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value }));
    const dailyAdded = data?.daily_items_added ?? [];

    const charts: ChartSpec[] = [];
    if (typeSegments.length)
      charts.push({ kind: "donut", title: "Cart items by type", segments: typeSegments });
    if (dailyAdded.length)
      charts.push({
        kind: "line",
        title: "Daily items added to cart",
        labels: dailyAdded.map((d) => d.date),
        series: [{ name: "Items", color: REPORT_COLORS.blue, values: dailyAdded.map((d) => d.count ?? 0) }],
      });

    await buildAnalyticsReport({
      fileName: "cart-report",
      title: "Cart report",
      kpis: [
        { label: "Total items", value: String(data?.total_items ?? 0) },
        { label: "Unique users", value: String(data?.unique_users ?? 0) },
        { label: "Courses in cart", value: String(data?.courses_in_cart ?? 0) },
        { label: "Books in cart", value: String(data?.books_in_cart ?? 0) },
        { label: "Bundles in cart", value: String(data?.bundles_in_cart ?? 0) },
      ],
      charts,
      sheets: [
        {
          name: "Cart Items",
          columns: [
            { header: "Member", key: "Member", width: 22 },
            { header: "Email", key: "Email", width: 26 },
            { header: "Item Type", key: "Item Type", width: 14 },
            { header: "Item Title", key: "Item Title", width: 30 },
            { header: "Added At", key: "Added At", width: 20 },
          ],
          rows: exportRows,
        },
      ],
    });
  }, [data]);

  if (isLoading) return <AnalyticsSkeleton />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const exportData = items.map((c) => ({
    Member: c.member_name,
    Email: c.member_email ?? "-",
    "Item Type": c.item_type,
    "Item Title": c.item_title,
    "Added At": c.created_at ? new Date(c.created_at).toLocaleString() : "-",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Cart Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Items added to cart and abandoned carts
          </p>
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="cart-analytics"
          sheetName="Cart Items"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by member or item..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            className="pl-9"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={() => { setSearch(searchInput); setPage(1); }}>
          Search
        </Button>
        {search && (
          <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.total_items ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.unique_users ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Courses in Cart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.courses_in_cart ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Books in Cart</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.books_in_cart ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bundles in Cart</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.bundles_in_cart ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {data?.daily_items_added && data.daily_items_added.length > 0 && (
        <AnalyticsBarChart
          title="Daily Items Added to Cart"
          description="Cart items added over time"
          data={data.daily_items_added}
          dataKey="count"
          name="Items"
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cart Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Member</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Item Type</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Item Title</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Added At</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No cart items found
                    </td>
                  </tr>
                ) : (
                  items.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.member_name}</div>
                        {c.member_email && (
                          <div className="text-xs text-muted-foreground">{c.member_email}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center text-xs font-medium">
                          {c.item_type}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3" title={c.item_title}>
                        {c.item_title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {items.length} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm font-medium">Page {page}</span>
            <Button size="sm" variant="outline" disabled={items.length < 20} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
