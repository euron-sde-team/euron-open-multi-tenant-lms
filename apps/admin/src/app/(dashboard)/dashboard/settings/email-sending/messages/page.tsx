"use client";

/**
 * Message log: Phase 14b.
 *
 * Read-only table of every email sent via the engine (custom-domain path).
 * Legacy SES sends (when the resolver fell back) don't write here, so the
 * log captures specifically the tenant-domain traffic.
 *
 * Filters: status, category, search (substring on to_address + subject),
 * date range. Pagination at 50 rows/page.
 *
 * No row actions; this is a forensic view. To re-allow a blocked recipient,
 * use the suppressions page.
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
import { ArrowLeft, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  EmailCategory,
  MessageStatus,
} from "@/lib/api/email-engine";
import { useMessages } from "@/lib/hooks/use-email-engine";

type StatusFilter = "" | MessageStatus;
type CategoryFilter = "" | EmailCategory;

export default function EmailMessagesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [category, setCategory] = useState<CategoryFilter>("");

  const { data, isLoading, isFetching } = useMessages({
    page,
    limit: 50,
    search: activeSearch || undefined,
    status: status || undefined,
    category: category || undefined,
  });

  const { toast: _toast } = useToast();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search.trim());
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
          <CardTitle className="text-lg">Message log</CardTitle>
          <CardDescription className="mt-1.5">
            Every email sent through your verified sending domain. Sends that
            fell back to the platform default sender don&apos;t appear here.
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
                placeholder="Search by recipient or subject"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="BOUNCED">Bounced</option>
              <option value="COMPLAINED">Complained</option>
              <option value="REJECTED">Rejected</option>
              <option value="FAILED">Failed</option>
              <option value="SUPPRESSED">Suppressed</option>
              <option value="FROZEN">Frozen</option>
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
              <option value="TRANSACTIONAL">Transactional</option>
              <option value="NOTIFICATION">Notification</option>
              <option value="MARKETING">Marketing</option>
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
                    Recipient
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Subject
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Sent
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline" />
                    </td>
                  </tr>
                ) : (data?.messages.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-12 text-center text-muted-foreground text-sm"
                    >
                      No messages match these filters.
                    </td>
                  </tr>
                ) : (
                  data?.messages.map((m) => (
                    <tr key={m.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-mono text-xs">
                        {m.toAddress}
                      </td>
                      <td className="px-3 py-2 text-xs max-w-[320px] truncate">
                        {m.subject}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-xs">
                          {m.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString()}
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

function StatusBadge({ status }: { status: MessageStatus }) {
  const map: Record<MessageStatus, { text: string; variant: "default" | "destructive" | "secondary"; className?: string }> = {
    QUEUED: { text: "Queued", variant: "secondary" },
    SENT: { text: "Sent", variant: "secondary" },
    DELIVERED: { text: "Delivered", variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
    BOUNCED: { text: "Bounced", variant: "destructive" },
    COMPLAINED: { text: "Complained", variant: "destructive" },
    REJECTED: { text: "Rejected", variant: "destructive" },
    FAILED: { text: "Failed", variant: "destructive" },
    SUPPRESSED: { text: "Suppressed", variant: "secondary" },
    FROZEN: { text: "Frozen", variant: "secondary" },
  };
  const entry = map[status];
  return (
    <Badge variant={entry.variant} className={`text-xs ${entry.className ?? ""}`}>
      {entry.text}
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
