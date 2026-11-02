import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * Pulse placeholder block. Compose into layout-matching loading states
 * instead of a bare centered spinner so pages keep their shape while data
 * loads.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-muted animate-pulse rounded-md", className)}
      aria-hidden
      {...props}
    />
  );
}

/** Stack of full-width row placeholders for list/table loading states. */
function SkeletonRows({
  rows = 6,
  rowClassName,
  className,
}: {
  rows?: number;
  rowClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-12 w-full", rowClassName)} />
      ))}
    </div>
  );
}

/** Grid of card placeholders for card-list loading states. */
function SkeletonCards({
  count = 6,
  cardClassName,
  className,
}: {
  count?: number;
  cardClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn("border-border space-y-3 rounded-lg border p-4", cardClassName)}
        >
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCards, SkeletonRows };
