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
import { BookOpen, ChevronLeft, ChevronRight, Highlighter, Search } from "lucide-react";
import { useCallback, useState } from "react";

import { AnalyticsBarChart } from "@/components/analytics/chart-components";
import { ExportMenu } from "@/components/analytics/export-menu";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { buildAnalyticsReport, REPORT_COLORS, type ChartSpec } from "@/lib/export/analytics-report";
import { useAnalyticsBookReading } from "@/lib/hooks/use-analytics";

export default function BookReadingAnalyticsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useAnalyticsBookReading(page, search);
  const {
    dateRange: { label: dateLabel },
  } = useAnalyticsDateRange();

  // Graphical Excel report (KPIs + completions trend + top books) over the loaded set.
  const buildReport = useCallback(async () => {
    if (!data) return;
    const books = data.items ?? [];
    const completions = data.daily_completions ?? [];
    const byReaders = [...books].sort((a, b) => (b.readers ?? 0) - (a.readers ?? 0)).slice(0, 10);

    const charts: ChartSpec[] = [];
    if (completions.length)
      charts.push({
        kind: "line",
        title: "Daily book completions",
        labels: completions.map((d) => d.date),
        series: [{ name: "Completions", color: REPORT_COLORS.emerald, values: completions.map((d) => d.count) }],
      });
    if (byReaders.length)
      charts.push({
        kind: "bar",
        title: "Top books by readers",
        bars: byReaders.map((b) => ({ label: decodeHtmlEntities(b.title ?? "Unknown"), value: b.readers ?? 0 })),
      });

    await buildAnalyticsReport({
      fileName: "book-reading-analytics-report",
      title: "Book reading analytics report",
      subtitle: dateLabel,
      kpis: [
        { label: "Books in progress", value: (data.books_in_progress ?? 0).toLocaleString() },
        { label: "Books completed", value: (data.books_completed ?? 0).toLocaleString() },
        { label: "Total highlights", value: (data.total_highlights ?? 0).toLocaleString() },
        { label: "Page bookmarks", value: (data.total_page_bookmarks ?? 0).toLocaleString() },
      ],
      charts,
      sheets: [
        {
          name: "Books",
          columns: [
            { header: "Book", key: "Book", width: 30 },
            { header: "Readers", key: "Readers", width: 12, numFmt: "#,##0" },
            { header: "Completed", key: "Completed", width: 12, numFmt: "#,##0" },
            { header: "In Progress", key: "In Progress", width: 12, numFmt: "#,##0" },
            { header: "Highlights", key: "Highlights", width: 12, numFmt: "#,##0" },
            { header: "Page Bookmarks", key: "Page Bookmarks", width: 16, numFmt: "#,##0" },
          ],
          rows: books.map((b) => ({
            Book: decodeHtmlEntities(b.title ?? "Unknown"),
            Readers: b.readers,
            Completed: b.completed,
            "In Progress": b.in_progress,
            Highlights: b.highlights,
            "Page Bookmarks": b.page_bookmarks,
          })),
          dataBarColumn: "Readers",
        },
      ],
    });
  }, [data, dateLabel]);

  if (isLoading) return <AnalyticsSkeleton />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const exportData = items.map((b) => ({
    Book: b.title,
    Readers: b.readers,
    Completed: b.completed,
    "In Progress": b.in_progress,
    Highlights: b.highlights,
    "Page Bookmarks": b.page_bookmarks,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Book Reading Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Reading progress, highlights, and bookmarks
          </p>
        </div>
        <ExportMenu
          data={exportData}
          buildReport={{ run: buildReport }}
          fileName="book-reading-analytics"
          sheetName="Books"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search books..."
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
            <CardTitle className="text-sm font-medium">Books in Progress</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.books_in_progress ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Books Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{(data?.books_completed ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Highlights</CardTitle>
            <Highlighter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.total_highlights ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Page Bookmarks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.total_page_bookmarks ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {data?.daily_completions && data.daily_completions.length > 0 && (
        <AnalyticsBarChart
          title="Daily Book Completions"
          description="Books completed per day"
          data={data.daily_completions}
          dataKey="count"
          name="Completions"
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reading Progress by Book</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Book</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Readers</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Completed</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">In Progress</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Highlights</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Page Bookmarks</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No reading data found
                    </td>
                  </tr>
                ) : (
                  items.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="max-w-[250px] truncate px-4 py-3 font-medium" title={b.title}>
                        {b.title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{b.readers}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-600">{b.completed}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{b.in_progress}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{b.highlights}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{b.page_bookmarks}</td>
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
