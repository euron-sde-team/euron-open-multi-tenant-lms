"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TestAnalyticsCard } from "@/components/test-series/TestAnalyticsCard";
import { testsApi } from "@/lib/api/test-series";

export default function TestSeriesAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tests", "for-analytics"],
    queryFn: () => testsApi.list({ limit: 200 }),
  });

  const tests = useMemo(() => data?.tests ?? [], [data]);
  const [testId, setTestId] = useState("");

  // Default to the first test once the list loads.
  useEffect(() => {
    if (!testId && tests.length > 0) setTestId(tests[0].id);
  }, [tests, testId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardCheck className="h-6 w-6" /> Test Series Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Test-wise performance, insights, and a detailed Excel export.
          </p>
        </div>
        <Select value={testId} onValueChange={setTestId} disabled={isLoading}>
          <SelectTrigger className="w-full sm:w-[340px]">
            <SelectValue
              placeholder={isLoading ? "Loading tests…" : "Select a test"}
            />
          </SelectTrigger>
          <SelectContent>
            {tests.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {testId ? (
        <TestAnalyticsCard testId={testId} />
      ) : (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          {isLoading
            ? "Loading tests…"
            : tests.length === 0
              ? "No tests yet. Create a test to see analytics."
              : "Select a test to view its analytics."}
        </div>
      )}
    </div>
  );
}
