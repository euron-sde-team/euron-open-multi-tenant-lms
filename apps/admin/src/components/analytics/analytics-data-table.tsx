"use client";

import { Button, cn, Input } from "@open-mtlms/core";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatNumber, formatCurrency, formatPercent, formatDuration } from "./number-formatters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  format?: "number" | "currency" | "percent" | "duration" | "date";
  align?: "left" | "right" | "center";
  className?: string;
  /**
   * Optional custom renderer. When provided, this takes precedence over
   * `format`, letting callers render JSX (e.g. multi-currency breakdowns
   * with tooltips) instead of plain formatted strings.
   */
  render?: (row: AnyRow) => ReactNode;
}

interface AnalyticsDataTableProps {
  columns: Column[];
  data: AnyRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
  onRowClick?: (row: AnyRow) => void;
  emptyMessage?: string;
  searchPlaceholder?: string;
}

function formatCell(value: unknown, format?: Column["format"]): string {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : Number(value);

  switch (format) {
    case "number":
      return isNaN(num) ? String(value) : formatNumber(num);
    case "currency":
      return isNaN(num) ? String(value) : formatCurrency(num);
    case "percent":
      return isNaN(num) ? String(value) : formatPercent(num);
    case "duration":
      return isNaN(num) ? String(value) : formatDuration(num);
    case "date": {
      try {
        return new Date(String(value)).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      } catch {
        return String(value);
      }
    }
    default:
      return String(value);
  }
}

export function AnalyticsDataTable({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  search,
  onSearchChange,
  onRowClick,
  emptyMessage = "No data available",
  searchPlaceholder = "Search...",
}: AnalyticsDataTableProps) {
  const [searchInput, setSearchInput] = useState(search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search ?? "");
  }, [search]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange?.(value);
      }, 300);
    },
    [onSearchChange],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="space-y-3">
      {onSearchChange && (
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    col.className,
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b transition-colors hover:bg-muted/30",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-2 whitespace-nowrap",
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                        col.className,
                      )}
                    >
                      {col.render ? col.render(row) : formatCell(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {startItem}–{endItem} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
