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
import { BookOpen, Bookmark, ChevronLeft, ChevronRight, Package, Search, Users } from "lucide-react";
import { useCallback, useState } from "react";

import { AnalyticsBarChart } from "@/components/analytics/chart-components";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { analyticsApi } from "@/lib/api/analytics";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsBookmarkDetails, useAnalyticsBookmarks } from "@/lib/hooks/use-analytics";

const EXPORT_LIMIT = 20000;

export default function BookmarksAnalyticsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [detailsPage, setDetailsPage] = useState(1);
  const [detailsSearch, setDetailsSearch] = useState("");
  const [detailsSearchInput, setDetailsSearchInput] = useState("");

  const { data, isLoading } = useAnalyticsBookmarks(page, search);
  const { data: detailsData, isLoading: detailsLoading } = useAnalyticsBookmarkDetails(detailsPage, detailsSearch);
  const {
    dateRange: { startDate, endDate, label: dateLabel },
  } = useAnalyticsDateRange();

  // Graphical Excel report (KPIs + charts) over the full bookmarked-item set.
  const buildReport = useCallback(async () => {
    const res = await analyticsApi.getBookmarks(startDate, endDate, 1, EXPORT_LIMIT, search || undefined);
    const all = res.items ?? [];

    const byType = [
      { label: "Courses", value: res.course_bookmarks ?? 0 },
      { label: "Books", value: res.book_bookmarks ?? 0 },
      { label: "Bundles", value: res.bundle_bookmarks ?? 0 },
    ].filter((d) => d.value > 0);
    const daily = res.daily_bookmarks ?? [];
    const topItems = [...all].sort((a, b) => b.bookmark_count - a.bookmark_count).slice(0, 10);

    const charts: ChartSpec[] = [];
    if (daily.length)
      charts.push({
        kind: "line",
        title: "Daily bookmarks created",
        labels: daily.map((d) => d.date),
        series: [{ name: "Bookmarks", color: REPORT_COLORS.blue, values: daily.map((d) => d.count) }],
      });
    if (byType.length)
      charts.push({ kind: "donut", title: "Bookmarks by type", segments: byType });
    if (topItems.length)
      charts.push({
        kind: "bar",
        title: "Most bookmarked items",
        bars: topItems.map((b) => ({ label: decodeHtmlEntities(b.title ?? ""), value: b.bookmark_count })),
      });

    await buildAnalyticsReport({
      fileName: "bookmarks-report",
      title: "Bookmarks report",
      subtitle: dateLabel,
      kpis: [
        { label: "Total bookmarks", value: String(res.total_bookmarks ?? 0) },
        { label: "Course bookmarks", value: String(res.course_bookmarks ?? 0) },
        { label: "Book bookmarks", value: String(res.book_bookmarks ?? 0) },
        { label: "Bundle bookmarks", value: String(res.bundle_bookmarks ?? 0) },
      ],
      charts,
      sheets: [
        {
          name: "Bookmarks",
          columns: [
            { header: "Title", key: "Title", width: 36 },
            { header: "Type", key: "Type", width: 12 },
            { header: "Bookmark Count", key: "Bookmark Count", width: 16, numFmt: "#,##0" },
          ],
          rows: all.map((b) => ({
            Title: decodeHtmlEntities(b.title ?? ""),
            Type: b.type,
            "Bookmark Count": b.bookmark_count,
          })),
          dataBarColumn: "Bookmark Count",
        },
      ],
    });
  }, [startDate, endDate, search, dateLabel]);

  if (isLoading) return <AnalyticsSkeleton />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const exportData = items.map((b) => ({
    Title: b.title,
    Type: b.type,
    "Bookmark Count": b.bookmark_count,
  }));

  const detailsItems = detailsData?.items ?? [];
  const detailsTotal = detailsData?.total ?? 0;
  const detailsExportData = detailsItems.map((d) => ({
    Member: d.member_name,
    Email: d.member_email ?? "-",
    "Item Title": d.item_title,
    Type: d.bookmark_type,
    "Bookmarked At": d.created_at ? new Date(d.created_at).toLocaleString() : "-",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="h-6 w-6" />
            Bookmarks Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Most bookmarked courses, books, and bundles
          </p>
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="bookmarks-analytics"
          sheetName="Bookmarks"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
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

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Bookmarks</CardTitle>
            <Bookmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.total_bookmarks ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Course Bookmarks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.course_bookmarks ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Book Bookmarks</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.book_bookmarks ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bundle Bookmarks</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.bundle_bookmarks ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {data?.daily_bookmarks && data.daily_bookmarks.length > 0 && (
        <AnalyticsBarChart
          title="Daily Bookmarks Created"
          description="Bookmarks created over time"
          data={data.daily_bookmarks}
          dataKey="count"
          name="Bookmarks"
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Most Bookmarked Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Title</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Type</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Bookmarks</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                      No bookmarks found
                    </td>
                  </tr>
                ) : (
                  items.map((b) => (
                    <tr key={`${b.type}-${b.id}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="max-w-[300px] truncate px-4 py-3 font-medium" title={b.title}>
                        {b.title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            b.type === "COURSE"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : b.type === "BOOK"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          }`}
                        >
                          {b.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{b.bookmark_count}</td>
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

      {/* All Bookmarks - with user info */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              All Bookmarks (with user info)
            </CardTitle>
            <ExportMenu
              data={detailsExportData}
              fileName="bookmark-details"
              sheetName="Bookmark Details"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Individual bookmarks with member name and email
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by member or item..."
                value={detailsSearchInput}
                onChange={(e) => setDetailsSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setDetailsSearch(detailsSearchInput); setDetailsPage(1); } }}
                className="pl-9"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={() => { setDetailsSearch(detailsSearchInput); setDetailsPage(1); }}>
              Search
            </Button>
            {detailsSearch && (
              <Button size="sm" variant="ghost" onClick={() => { setDetailsSearch(""); setDetailsSearchInput(""); setDetailsPage(1); }}>
                Clear
              </Button>
            )}
          </div>
          {detailsLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Member</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Email</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Item Title</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Type</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Bookmarked At</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        No bookmark details found
                      </td>
                    </tr>
                  ) : (
                    detailsItems.map((d) => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{d.member_name}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground" title={d.member_email ?? ""}>
                          {d.member_email ?? "-"}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3" title={d.item_title}>
                          {d.item_title}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              d.bookmark_type === "COURSE"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : d.bookmark_type === "BOOK"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            }`}
                          >
                            {d.bookmark_type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {d.created_at ? new Date(d.created_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {detailsTotal > 0 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Showing {detailsItems.length} of {detailsTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={detailsPage <= 1} onClick={() => setDetailsPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span className="text-sm font-medium">Page {detailsPage}</span>
                <Button size="sm" variant="outline" disabled={detailsItems.length < 20} onClick={() => setDetailsPage((p) => p + 1)}>
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
