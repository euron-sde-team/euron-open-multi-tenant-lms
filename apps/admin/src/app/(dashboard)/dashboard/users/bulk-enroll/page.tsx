"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@open-mtlms/core";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Search,
  UserPlus,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import {
  useMembers,
  usePublishedBooks,
  usePublishedCourses,
} from "@/lib/hooks/use-members";
import { useBatches } from "@/lib/hooks/use-batches";
import { useBulkEnroll } from "@/lib/hooks/use-bulk-imports";
import { useBundles } from "@/lib/hooks/use-bundles";
import { useTestSeriesList } from "@/lib/hooks/use-test-series";
import type {
  BulkEnrollInput,
  BulkEnrollResult,
  MemberStatus,
  PerRowReportEntry,
} from "@/lib/types/bulk-imports";

function defaultValidTill(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type Mode = "INDIVIDUAL" | "FILTER";

type TargetTab =
  | "COURSE"
  | "BOOK"
  | "BATCH"
  | "BUNDLE"
  | "TEST_SERIES";

const TARGET_LABELS: Record<TargetTab, string> = {
  COURSE: "Course",
  BOOK: "Book",
  BATCH: "Batch",
  BUNDLE: "Bundle",
  TEST_SERIES: "Test Series",
};

export default function BulkEnrollExistingUsersPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TargetTab>("COURSE");
  const [mode, setMode] = useState<Mode>("INDIVIDUAL");

  // Member selection state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MemberStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Target state, one selected id per target type
  const [courseId, setCourseId] = useState<string>("");
  const [bookId, setBookId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [bundleId, setBundleId] = useState<string>("");
  const [testSeriesId, setTestSeriesId] = useState<string>("");
  const [validTill, setValidTill] = useState<string>(defaultValidTill());

  // Last run result (dry run or real) for the per-row results table
  const [lastRun, setLastRun] = useState<{
    result: BulkEnrollResult;
    dryRun: boolean;
    targetType: TargetTab;
  } | null>(null);

  const limit = 25;
  const membersQuery = useMembers({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    sortBy: "joined_at",
    sortOrder: "desc",
  });
  const coursesQuery = usePublishedCourses();
  const booksQuery = usePublishedBooks();
  const batchesQuery = useBatches(1, 200, { status: "PUBLISHED" });
  const bundlesQuery = useBundles(1, 200, { status: "PUBLISHED" });
  const testSeriesQuery = useTestSeriesList({
    page: 1,
    limit: 200,
    status: "PUBLISHED",
  });
  const bulkEnroll = useBulkEnroll();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
    const t = setTimeout(() => setDebouncedSearch(value), 400);
    return () => clearTimeout(t);
  }, []);

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const rows = membersQuery.data?.members ?? [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const m of rows) next.add(m.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedTargetId = (): string => {
    switch (tab) {
      case "COURSE":
        return courseId;
      case "BOOK":
        return bookId;
      case "BATCH":
        return batchId;
      case "BUNDLE":
        return bundleId;
      case "TEST_SERIES":
        return testSeriesId;
    }
  };

  const buildInput = (dryRun: boolean): { input: BulkEnrollInput; dryRun: boolean } => {
    const target: BulkEnrollInput["target"] =
      tab === "COURSE"
        ? { type: "COURSE" as const, id: courseId }
        : { type: tab, id: selectedTargetId() };
    const baseValidTill = validTill ? new Date(validTill).toISOString() : null;
    const input: BulkEnrollInput =
      mode === "INDIVIDUAL"
        ? {
            target,
            memberIds: Array.from(selectedIds),
            validTill: baseValidTill,
          }
        : {
            target,
            selectAllFilter: {
              status: statusFilter !== "all" ? statusFilter : undefined,
              search: debouncedSearch || undefined,
            },
            validTill: baseValidTill,
          };
    return { input, dryRun };
  };

  const handleRun = async (dryRun: boolean) => {
    if (!selectedTargetId()) {
      toast({
        title: `Pick a ${TARGET_LABELS[tab].toLowerCase()} first`,
        variant: "destructive",
      });
      return;
    }
    if (mode === "INDIVIDUAL" && selectedIds.size === 0) {
      toast({ title: "Select at least one member", variant: "destructive" });
      return;
    }
    try {
      const result = await bulkEnroll.mutateAsync(buildInput(dryRun));
      setLastRun({ result, dryRun, targetType: tab });
      toast({
        title: dryRun ? "Dry run complete" : "Enrollment processed",
        description: `${result.totalMembers} members targeted. ${result.counters.grantedCount} grants written.`,
      });
      if (result.truncated) {
        toast({
          title: "Filter result was truncated",
          description: `Only the first ${result.totalMembers} matching members were enrolled. Narrow the filter (e.g. add a search term) and re-run to enroll the rest.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Enrollment failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const total = membersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const targetSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    items: Array<{ id: string; title: string }>,
    placeholder: string
  ) => (
    <>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to users
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Bulk enroll existing users</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: member picker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Select members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={mode === "INDIVIDUAL" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("INDIVIDUAL")}
              >
                <UserPlus className="mr-2 h-4 w-4" /> Individual selection
              </Button>
              <Button
                variant={mode === "FILTER" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode("FILTER");
                  // Default to ACTIVE when entering filter mode so an
                  // operator doesn't accidentally bulk-enroll suspended /
                  // deactivated members across the whole tenant.
                  if (statusFilter === "all") setStatusFilter("ACTIVE");
                }}
              >
                <Filter className="mr-2 h-4 w-4" /> All matching filter
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as "all" | MemberStatus);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
              </SelectContent>
            </Select>

            {mode === "FILTER" ? (
              <div className="rounded border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Selection</p>
                <p className="text-muted-foreground">
                  All members matching the filter above (up to 10,000). The exact set is
                  resolved at job start.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllOnPage}>
                      Select page
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="max-h-96 overflow-auto rounded border">
                  {membersQuery.isLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/50">
                        <tr>
                          <th className="w-10 px-2 py-2"></th>
                          <th className="px-2 py-2 text-left">Name</th>
                          <th className="px-2 py-2 text-left">Contact</th>
                          <th className="px-2 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {membersQuery.data?.members.map((m) => (
                          <tr key={m.id} className="border-t hover:bg-muted/30">
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(m.id)}
                                onChange={() => toggleMember(m.id)}
                              />
                            </td>
                            <td className="px-2 py-1">{m.name}</td>
                            <td className="px-2 py-1 text-muted-foreground">
                              {m.email ?? m.phone ?? ""}
                            </td>
                            <td className="px-2 py-1">
                              <Badge
                                variant={m.status === "ACTIVE" ? "default" : "secondary"}
                              >
                                {m.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: target */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Pick target and confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TargetTab)}>
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="COURSE">Course</TabsTrigger>
                <TabsTrigger value="BOOK">Book</TabsTrigger>
                <TabsTrigger value="BATCH">Batch</TabsTrigger>
                <TabsTrigger value="BUNDLE">Bundle</TabsTrigger>
                <TabsTrigger value="TEST_SERIES">Test Series</TabsTrigger>
              </TabsList>
              <TabsContent value="COURSE" className="space-y-3">
                {targetSelect(
                  "Course",
                  courseId,
                  setCourseId,
                  (coursesQuery.data ?? []).map((c) => ({
                    id: c.id,
                    title: `${c.title} (${c.mode})`,
                  })),
                  "Select a course..."
                )}
              </TabsContent>
              <TabsContent value="BOOK" className="space-y-3">
                {targetSelect(
                  "Book",
                  bookId,
                  setBookId,
                  (booksQuery.data ?? []).map((b) => ({ id: b.id, title: b.title })),
                  "Select a book..."
                )}
              </TabsContent>
              <TabsContent value="BATCH" className="space-y-3">
                {targetSelect(
                  "Batch",
                  batchId,
                  setBatchId,
                  (batchesQuery.data?.batches ?? []).map((b) => ({
                    id: b.id,
                    title: b.title,
                  })),
                  "Select a batch..."
                )}
              </TabsContent>
              <TabsContent value="BUNDLE" className="space-y-3">
                {targetSelect(
                  "Bundle",
                  bundleId,
                  setBundleId,
                  (bundlesQuery.data?.bundles ?? []).map((b) => ({
                    id: b.id,
                    title: b.title,
                  })),
                  "Select a bundle..."
                )}
                <p className="text-xs text-muted-foreground">
                  Bundle contents (courses, books, test series) are granted
                  individually to each member.
                </p>
              </TabsContent>
              <TabsContent value="TEST_SERIES" className="space-y-3">
                {targetSelect(
                  "Test Series",
                  testSeriesId,
                  setTestSeriesId,
                  (testSeriesQuery.data?.series ?? []).map((s) => ({
                    id: s.id,
                    title: s.title,
                  })),
                  "Select a test series..."
                )}
              </TabsContent>
            </Tabs>

            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="valid-till">Access valid till</Label>
              <Input
                id="valid-till"
                type="date"
                value={validTill}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setValidTill(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => handleRun(true)}
                disabled={bulkEnroll.isPending}
              >
                {bulkEnroll.isPending && bulkEnroll.variables?.dryRun ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Dry run
              </Button>
              <Button
                onClick={() => handleRun(false)}
                disabled={bulkEnroll.isPending}
              >
                {bulkEnroll.isPending && !bulkEnroll.variables?.dryRun ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Enroll selected members
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {lastRun ? (
        <BulkEnrollResultPanel
          result={lastRun.result}
          dryRun={lastRun.dryRun}
          targetLabel={TARGET_LABELS[lastRun.targetType]}
        />
      ) : null}
    </div>
    </>
  );
}

function BulkEnrollResultPanel(props: {
  result: BulkEnrollResult;
  dryRun: boolean;
  targetLabel: string;
}) {
  const { result, dryRun, targetLabel } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          3. Result, {targetLabel} ({result.totalMembers} members
          {dryRun ? ", dry run" : ""})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultCounter
            label="Granted"
            value={result.counters.grantedCount}
            tone="ok"
          />
          <ResultCounter
            label="Merged"
            value={result.counters.mergedCount}
            tone="ok"
          />
          <ResultCounter
            label="Skipped"
            value={result.counters.skippedCount}
            tone="warn"
          />
          <ResultCounter
            label="Errors"
            value={result.counters.errorCount}
            tone="error"
          />
        </div>
        <div className="max-h-96 overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Outcome</th>
                <th className="px-2 py-2">Status@grant</th>
                <th className="px-2 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {result.perRow.map((r) => (
                <tr key={r.rowNumber} className="border-t">
                  <td className="px-2 py-1 font-mono">{r.rowNumber}</td>
                  <td className="px-2 py-1">{r.name ?? ""}</td>
                  <td className="px-2 py-1">{r.email ?? ""}</td>
                  <td className="px-2 py-1">{r.phone ?? ""}</td>
                  <td className="px-2 py-1">{rowOutcome(r)}</td>
                  <td className="px-2 py-1">{r.memberStatusAtGrant.join(",")}</td>
                  <td className="px-2 py-1 text-destructive">
                    {r.errorMessage ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Single outcome per row: courseAction / bookAction for the legacy targets,
 * targetAction (ACCESS_GRANTED / ACCESS_REACTIVATED / ACCESS_ALREADY_ACTIVE)
 * for batches, bundles and test series.
 */
function rowOutcome(r: PerRowReportEntry): string {
  return r.targetAction ?? r.courseAction ?? r.bookAction ?? "";
}

function ResultCounter(props: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "error";
}) {
  const Icon =
    props.tone === "ok"
      ? CheckCircle2
      : props.tone === "warn"
        ? AlertTriangle
        : XCircle;
  const color =
    props.tone === "ok"
      ? "text-emerald-600"
      : props.tone === "warn"
        ? "text-amber-600"
        : "text-destructive";
  return (
    <div className="rounded border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-4 w-4 ${color}`} /> {props.label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{props.value}</div>
    </div>
  );
}
