"use client";

import * as React from "react";
import { Grid3X3 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CategoryCardProps {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  iconUrl?: string | null;
  onClick?: () => void;
  className?: string;
}

export function CategoryCard({
  title,
  description,
  iconUrl,
  onClick,
  className,
}: CategoryCardProps) {
  return (
    <div
      className={cn(
        "group cursor-pointer transition-transform duration-200 hover:-translate-y-1",
        className,
      )}
      onClick={onClick}
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/30 bg-card transition-all duration-200 group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <Grid3X3 className="h-12 w-12 text-primary/40" />
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="mt-3 truncate text-center text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="mt-0.5 line-clamp-1 text-center text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

export function CategoryCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}
