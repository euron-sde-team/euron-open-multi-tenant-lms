"use client";

import { Button } from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { TestAnalyticsCard } from "@/components/test-series/TestAnalyticsCard";
import { testsApi } from "@/lib/api/test-series";

export default function TestAnalyticsPage() {
  const params = useParams();
  const testId = String(params?.testId ?? "");

  const { data: test } = useQuery({
    queryKey: ["test", testId, "meta"],
    queryFn: () => testsApi.get(testId),
    enabled: !!testId,
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/test-series/tests">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to tests
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {test?.name ? `${test.name}: Analytics` : "Test Analytics"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Test-wise performance, insights, and a detailed Excel export.
        </p>
      </div>

      {testId && <TestAnalyticsCard testId={testId} />}
    </div>
  );
}
