"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AttemptsReport } from "@/components/test-series/AttemptsReport";
import { TestAnalyticsCard } from "@/components/test-series/TestAnalyticsCard";
import { testsApi, type Test } from "@/lib/api/test-series";
import { useSeriesTests, useTestSeries } from "@/lib/hooks/use-test-series";

/** One test in the series, links to that test's own full analytics. */
function SeriesTestAnalyticsRow({ testId }: { testId: string }) {
  const [test, setTest] = useState<Test | null>(null);

  useEffect(() => {
    let cancelled = false;
    testsApi.get(testId).then((t) => {
      if (!cancelled) setTest(t);
    });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        {test ? (
          <>
            <div className="flex items-center gap-2">
              <p className="text-foreground truncate font-medium">{test.name}</p>
              <Badge variant={test.status === "PUBLISHED" ? "default" : "secondary"}>
                {test.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {test.durationMin} min · {test.totalMarks} marks
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}
      </div>
      <Link href={`/dashboard/test-series/tests/${testId}/analytics`}>
        <Button size="sm" variant="outline">
          <BarChart3 className="mr-1 h-3.5 w-3.5" />
          View analytics
        </Button>
      </Link>
    </div>
  );
}

export default function SeriesAnalyticsPage() {
  const params = useParams<{ seriesId: string }>();
  const seriesId = params?.seriesId ?? "";

  const { data: series } = useTestSeries(seriesId);
  const { data: seriesTests } = useSeriesTests(seriesId);
  const { data: attempts, isLoading } = useQuery({
    queryKey: ["series-attempts-report", seriesId],
    queryFn: () => testsApi.listSeriesAttempts(seriesId),
    enabled: !!seriesId,
  });

  const sortedTests = (seriesTests ?? [])
    .slice()
    .sort((x, y) => x.orderIndex - y.orderIndex);

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series/series"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to series
      </Link>

      <div>
        <h1 className="text-2xl font-bold">
          {series?.title ? `${series.title}, analytics` : "Series analytics"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Performance aggregated across every test in this series.
        </p>
      </div>

      {/* Rich analytics, same visuals + Excel export as a single test */}
      <TestAnalyticsCard seriesId={seriesId} />

      {/* Drill down into any individual test's analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tests in this series</CardTitle>
          <p className="text-muted-foreground text-sm">
            Open any test for its own analytics, charts, topic and difficulty
            accuracy, insights and the detailed Excel export.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {sortedTests.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              No tests in this series yet.
            </p>
          ) : (
            sortedTests.map((t) => (
              <SeriesTestAnalyticsRow key={t.id} testId={t.testId} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Per-attempt proctoring report across all tests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attempt report (batch-wise)</CardTitle>
          <p className="text-muted-foreground text-sm">
            Every learner attempt across all tests in this series, name, email,
            phone, score, scaled score, percentile, rank, time and proctoring.
          </p>
        </CardHeader>
        <CardContent>
          <AttemptsReport
            attempts={attempts ?? []}
            loading={isLoading}
            showTest
            filename={`series-attempts-${(series?.title || seriesId)
              .replace(/[^a-z0-9]+/gi, "-")
              .toLowerCase()}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
