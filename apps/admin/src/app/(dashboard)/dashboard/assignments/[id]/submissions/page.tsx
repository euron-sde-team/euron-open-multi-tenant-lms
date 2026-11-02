"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-mtlms/core";
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { assignmentsApi } from "@/lib/api/assignments";
import { useTenantStore } from "@/lib/stores/tenant-store";

const LIMIT_OPTIONS = [10, 20, 50, 100];

export default function AssignmentSubmissionsPage() {
  const params = useParams();
  const id = params?.id as string;
  const { selectedTenantId } = useTenantStore();

  const [assignment, setAssignment] = useState<{ title: string } | null>(null);
  const [submissions, setSubmissions] = useState<
    Array<{
      id: string;
      member_name: string;
      member_email: string | null;
      status: string;
      submitted_at: string | null;
      content_type: string;
      score: number | null;
      max_score: number | null;
      feedback: string | null;
      evaluated_at: string | null;
    }>
  >([]);
  const [total, setTotal] = useState(0);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !selectedTenantId) return;
    setIsLoading(true);
    try {
      const [a, res] = await Promise.all([
        assignmentsApi.get(id),
        assignmentsApi.listSubmissions(id, {
          page,
          limit,
          status: statusFilter || undefined,
          submitted_from: dateFrom || undefined,
          submitted_to: dateTo || undefined,
        }),
      ]);
      setAssignment(a);
      setSubmissions(res.data);
      setTotal(res.total);
      setStatusOptions(res.status_options ?? []);
    } catch (err) {
      console.error("Failed to load submissions:", err);
      setSubmissions([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [id, selectedTenantId, page, limit, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / limit) || 1;
  const formatDate = (s: string | null) => {
    if (!s) return "-";
    return new Date(s).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const v = status === "EVALUATED" ? "default" : status === "SUBMITTED" ? "secondary" : "outline";
    return <Badge variant={v}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/assignments/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            Submissions {assignment ? `, ${assignment.title}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm">
            View and grade student submissions for this assignment.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filters - API-driven status options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter by status and submission date range</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) => {
                setStatusFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger id="status" className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-from">From date</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-[160px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">To date</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-[160px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      )}

      {!isLoading && submissions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-center">
              No submissions yet. Students will appear here once they submit.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Submissions ({total})</CardTitle>
            <CardDescription>
              Click on a submission to view details and evaluate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {submissions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{s.member_name}</p>
                    {s.member_email && (
                      <p className="text-muted-foreground text-sm">{s.member_email}</p>
                    )}
                    <p className="text-muted-foreground text-xs mt-1">
                      Submitted {formatDate(s.submitted_at)} · {s.content_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(s.status)}
                    {s.score != null && s.max_score != null && (
                      <span className="text-sm text-muted-foreground">
                        {s.score}/{s.max_score}
                      </span>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/assignments/${id}/submissions/${s.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="limit" className="text-sm text-muted-foreground">
                  Per page
                </Label>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => {
                    setLimit(parseInt(v, 10));
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="limit" className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {total} total
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
