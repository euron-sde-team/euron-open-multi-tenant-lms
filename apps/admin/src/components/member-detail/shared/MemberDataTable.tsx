"use client";

import { cn } from "@open-mtlms/core";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render: (item: T) => ReactNode;
}

interface MemberDataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
  keyExtractor: (item: T) => string;
}

export function MemberDataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "No data yet.",
  emptyIcon: EmptyIcon = Inbox,
  keyExtractor,
}: MemberDataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <EmptyIcon className="h-8 w-8 mb-2" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-3 py-2 font-medium",
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="border-b">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-3 py-2",
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left"
                  )}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
