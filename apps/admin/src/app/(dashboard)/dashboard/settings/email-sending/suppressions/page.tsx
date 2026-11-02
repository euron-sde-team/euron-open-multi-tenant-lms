"use client";

/**
 * Suppression list: Phase 14b.
 *
 * Read-write surface for the per-tenant block list. Rows arrive here from
 * four sources:
 *
 *   - HARD_BOUNCE: SES events consumer writes one on every permanent bounce
 *   - COMPLAINT: SES events consumer writes one on every spam complaint
 *   - MANUAL_UNSUBSCRIBE: storefront /u/[token] flow writes one when a
 *     recipient clicks unsubscribe
 *   - ADMIN_BLOCK / IMPORTED: not yet exposed; reserved for ops tooling
 *
 * Operator/tenant admin can REMOVE a row to re-enable sends to that
 * recipient. Be careful with HARD_BOUNCE removals, the mailbox is likely
 * still dead and sends will just bounce again.
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from "@open-mtlms/core";
import { ArrowLeft, Loader2, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  EmailCategory,
  Suppression,
  SuppressionReason,
} from "@/lib/api/email-engine";
import { useHasPermission } from "@/lib/hooks/use-permissions";
import {
  useRemoveSuppression,
  useSuppressions,
} from "@/lib/hooks/use-email-engine";

type CategoryFilter = "" | EmailCategory | "ALL";
type ReasonFilter = "" | SuppressionReason;

export default function SuppressionsPage() {
  const canManage = useHasPermission("email_sending.manage");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<ReasonFilter>("");
  const [category, setCategory] = useState<CategoryFilter>("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data, isLoading, isFetching } = useSuppressions({
    page,
    limit: 50,
    search: activeSearch || undefined,
    reason: reason || undefined,
    category: category || undefined,
  });

  const remove = useRemoveSuppression();
  const { toast } = useToast();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search.trim());
  };

  const handleRemove = (s: Suppression) => {
    if (
      !confirm(
        `Remove suppression for ${s.email}${s.categoryScope ? ` (category: ${s.categoryScope})` : " (all categories)"}?`,
      )
    )
      return;
    remove.mutate(s.id, {
      onSuccess: () => toast({ title: "Suppression removed" }),
      onError: (err: Error) =>
        toast({
          title: "Remove failed",
          description: err.message,
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <Link
          href="/dashboard/settings/email-sending"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Email Sending
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suppression list</CardTitle>
          <CardDescription className="mt-1.5">
            Recipients we will not send to. Hard bounces and complaints are
            automatic and global (block all categories). Manual unsubscribes
            from the storefront page are category-scoped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={handleSearch}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value as ReasonFilter);
                setPage(1);
              }}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All reasons</option>
              <option value="HARD_BOUNCE">Hard bounce</option>
              <option value="COMPLAINT">Complaint</option>
              <option value="MANUAL_UNSUBSCRIBE">Manual unsubscribe</option>
              <option value="ADMIN_BLOCK">Admin block</option>
              <option value="IMPORTED">Imported</option>
            </select>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as CategoryFilter);
                setPage(1);
              }}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              <option value="ALL">Global (all categories)</option>
              <option value="TRANSACTIONAL">Transactional only</option>
              <option value="NOTIFICATION">Notification only</option>
              <option value="MARKETING">Marketing only</option>
            </select>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Reason
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Scope
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Added
                  </th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline" />
                    </td>
                  </tr>
                ) : (data?.rows.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-12 text-center text-muted-foreground text-sm"
                    >
                      No suppressions match these filters.
                    </td>
                  </tr>
                ) : (
                  data?.rows.map((s) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-mono text-xs">{s.email}</td>
                      <td className="px-3 py-2">
                        <ReasonBadge reason={s.reason} />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {s.categoryScope ?? (
                          <span className="text-muted-foreground italic">all</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage || remove.isPending}
                          onClick={() => handleRemove(s)}
                          className="text-destructive hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            limit={data?.limit ?? 50}
            total={data?.total ?? 0}
            isFetching={isFetching}
            onChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ReasonBadge({ reason }: { reason: SuppressionReason }) {
  const labels: Record<SuppressionReason, { text: string; variant: "default" | "destructive" | "secondary" }> = {
    HARD_BOUNCE: { text: "Hard bounce", variant: "destructive" },
    COMPLAINT: { text: "Complaint", variant: "destructive" },
    MANUAL_UNSUBSCRIBE: { text: "Unsubscribed", variant: "secondary" },
    ADMIN_BLOCK: { text: "Admin block", variant: "secondary" },
    IMPORTED: { text: "Imported", variant: "secondary" },
  };
  const { text, variant } = labels[reason];
  return (
    <Badge variant={variant} className="text-xs">
      {text}
    </Badge>
  );
}

function Pagination({
  page,
  limit,
  total,
  isFetching,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  isFetching: boolean;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground">
        {isFetching ? (
          <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
        ) : null}
        {total === 0 ? "0 results" : `${start}–${end} of ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
