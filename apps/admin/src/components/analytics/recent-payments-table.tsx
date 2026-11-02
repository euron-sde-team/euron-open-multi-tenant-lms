"use client";

import { decodeHtmlEntities } from "@open-mtlms/shared";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { AnalyticsDataTable } from "@/components/analytics/analytics-data-table";
import type { RecentSuccessfulPayment } from "@/lib/api/analytics";
import { useAnalyticsRecentPayments } from "@/lib/hooks/use-analytics";
import { formatAmountWithCurrency } from "@/lib/utils/currency";

/**
 * Where each purchased item lives in the dashboard.
 *
 * Courses point at their analytics detail page rather than
 * `/dashboard/courses/<id>/lms`: those editor routes read `params.id` as a
 * `tenant_pages` id (see `components/courses/course-page-link-button.tsx`) and
 * would 404 on the course id this table carries.
 */
const ITEM_ROUTES: Record<string, (id: string) => string> = {
  COURSE: (id) => `/dashboard/analytics/courses-analytics/${id}`,
  BOOK: (id) => `/dashboard/books/${id}/editor`,
  BUNDLE: (id) => `/dashboard/bundles/${id}`,
  BATCH: (id) => `/dashboard/batches/${id}`,
  TEST_SERIES: (id) => `/dashboard/test-series/series/${id}`,
};

const TYPE_LABELS: Record<string, string> = {
  COURSE: "Course",
  BOOK: "Book",
  BUNDLE: "Bundle",
  BATCH: "Batch",
  TEST_SERIES: "Test Series",
};

function typeLabel(row: RecentSuccessfulPayment): string {
  return TYPE_LABELS[row.item_type] ?? "Item";
}

/** Hover uses `muted`, never `accent`, accent is tenant-controlled and can be any vivid colour. */
const LINK_CLASS =
  "font-medium text-foreground underline-offset-4 hover:underline hover:text-primary";

const columns = [
  {
    key: "member_name",
    label: "Buyer",
    render: (row: Record<string, unknown>) => {
      const p = row as unknown as RecentSuccessfulPayment;
      const name = decodeHtmlEntities(p.member_name) || "Unknown";
      return (
        <Link href={`/dashboard/users/${p.member_id}`} className={LINK_CLASS}>
          {name}
        </Link>
      );
    },
  },
  {
    key: "member_email",
    label: "Email",
    render: (row: Record<string, unknown>) => {
      const p = row as unknown as RecentSuccessfulPayment;
      return (
        <span className="text-muted-foreground">{p.member_email ?? "-"}</span>
      );
    },
  },
  {
    key: "item_name",
    label: "Item",
    render: (row: Record<string, unknown>) => {
      const p = row as unknown as RecentSuccessfulPayment;
      const name = decodeHtmlEntities(p.item_name ?? "") || "Item unavailable";
      const href = p.item_id ? ITEM_ROUTES[p.item_type]?.(p.item_id) : undefined;
      // No route (unknown type) or a deleted entity renders as plain text
      // rather than a link that would land on a 404.
      if (!href) return <span>{name}</span>;
      return (
        <Link href={href} className={LINK_CLASS}>
          {name}
        </Link>
      );
    },
  },
  {
    key: "item_type",
    label: "Type",
    render: (row: Record<string, unknown>) => (
      <span className="text-muted-foreground">
        {typeLabel(row as unknown as RecentSuccessfulPayment)}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "right" as const,
    render: (row: Record<string, unknown>) => {
      const p = row as unknown as RecentSuccessfulPayment;
      return (
        <span className="font-medium">
          {formatAmountWithCurrency(parseFloat(p.amount) || 0, p.currency)}
        </span>
      );
    },
  },
  { key: "paid_at", label: "Paid on", format: "date" as const },
  { key: "order_number", label: "Order #" },
];

/**
 * Successful payments, one row per purchased item, a cart order appears once
 * per line so each item gets its own name, type and link.
 */
export function RecentPaymentsTable({ enabled = true }: { enabled?: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAnalyticsRecentPayments(page, search, enabled);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const rows = useMemo(
    () => (data?.payments ?? []) as unknown as Record<string, unknown>[],
    [data?.payments],
  );

  if (isLoading && !data) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <AnalyticsDataTable
      columns={columns}
      data={rows}
      total={data?.total ?? 0}
      page={page}
      pageSize={data?.limit ?? 10}
      onPageChange={setPage}
      search={search}
      onSearchChange={handleSearchChange}
      emptyMessage="No successful payments in this period"
      searchPlaceholder="Search by buyer, item or order number..."
    />
  );
}
