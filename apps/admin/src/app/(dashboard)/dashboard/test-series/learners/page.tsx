"use client";

import {
  Button,
  Card,
  CardContent,
  Input,
  SkeletonRows,
} from "@open-mtlms/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { testsApi } from "@/lib/api/test-series";
import { testSeriesKeys } from "@/lib/hooks/use-test-series";

const PAGE_SIZE = 25;

/** Debounce the search box so typing does not fire a request per keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

/**
 * Learner-first entry point into the test reports.
 *
 * The per test and per series reports answer "how did this test go". Faculty
 * also need the other direction: pick a person, see everything they have sat.
 * Driven off attempts, so it lists people who actually took something rather
 * than every member on the tenant.
 */
export default function TestLearnersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: testSeriesKeys.tests.learners({ debouncedSearch, page }),
    queryFn: () =>
      testsApi.listLearners({
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const learners = data?.learners ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to test series
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learners</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everyone who has attempted a test. Open a learner to see every test
          they have taken and review their answers question by question.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-muted-foreground ml-auto text-xs">
          {isFetching ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching…
            </span>
          ) : (
            `${total} ${total === 1 ? "learner" : "learners"}`
          )}
        </span>
      </div>

      {isLoading ? (
        <SkeletonRows rows={8} rowClassName="h-14" />
      ) : learners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {debouncedSearch
                ? "No learner matches that search"
                : "No one has attempted a test yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Learner</th>
                <th className="px-3 py-2 text-right font-medium">Tests</th>
                <th className="px-3 py-2 text-right font-medium">Attempts</th>
                <th className="px-3 py-2 text-right font-medium">Submitted</th>
                <th className="px-3 py-2 text-right font-medium">Avg score</th>
                <th className="px-3 py-2 text-right font-medium">Last test</th>
                <th className="px-3 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.learnerId} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {l.email ?? l.phone ?? l.learnerId}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{l.testCount}</td>
                  <td className="px-3 py-2 text-right">{l.attemptCount}</td>
                  <td className="px-3 py-2 text-right">{l.submittedCount}</td>
                  <td className="px-3 py-2 text-right">
                    {l.avgPercentage != null ? `${l.avgPercentage}%` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {fmtDate(l.lastSubmittedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/dashboard/test-series/learners/${l.learnerId}`}
                      className="text-primary text-xs hover:underline"
                    >
                      View tests
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
