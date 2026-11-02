"use client";

import { cn } from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { BookOpen, GraduationCap, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { ContentTermKey } from "@open-mtlms/shared";

import { useContentTerms } from "@/lib/hooks/use-content-terms";
import type { SearchResult } from "@/lib/api/search";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CONTENT_TYPE_CONFIG: Record<
  string,
  { label: string; bgClass: string; textClass: string; icon: typeof GraduationCap }
> = {
  COURSE: { label: "Course", bgClass: "bg-blue-500/10 dark:bg-blue-400/15", textClass: "text-blue-700 dark:text-blue-300", icon: GraduationCap },
  BOOK: { label: "Book", bgClass: "bg-emerald-500/10 dark:bg-emerald-400/15", textClass: "text-emerald-700 dark:text-emerald-300", icon: BookOpen },
  BUNDLE: { label: "Bundle", bgClass: "bg-orange-500/10 dark:bg-orange-400/15", textClass: "text-orange-700 dark:text-orange-300", icon: Package },
};

/** Search content types that carry a tenant-renameable term (singular form). */
const CONTENT_TYPE_TO_TERM: Record<string, ContentTermKey> = {
  COURSE: "course",
  BOOK: "book",
  BUNDLE: "bundle",
};

const MODE_LABELS: Record<string, string> = {
  SELF_PACED: "Self-Paced",
  LIVE: "Live",
  HYBRID: "Hybrid",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SearchResultCardProps {
  result: SearchResult;
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const terms = useContentTerms();
  const typeConfig = CONTENT_TYPE_CONFIG[result.contentType] ?? CONTENT_TYPE_CONFIG.COURSE;
  const TypeIcon = typeConfig.icon;
  const termKey = CONTENT_TYPE_TO_TERM[result.contentType];
  const typeLabel = termKey ? terms[termKey].singular : typeConfig.label;
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      href={result.url}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {result.thumbnailUrl && !imgError ? (
          <img
            src={result.thumbnailUrl}
            alt={decodeHtmlEntities(result.title)}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <TypeIcon className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}
        {/* Gradient overlay for badge readability */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/30 to-transparent" />
        {/* Content type badge */}
        <span
          className={cn(
            "absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm",
            typeConfig.bgClass,
            typeConfig.textClass
          )}
        >
          <TypeIcon className="h-3 w-3" />
          {typeLabel}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
          {decodeHtmlEntities(result.title)}
        </h3>

        {result.subtitle && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {decodeHtmlEntities(result.subtitle)}
          </p>
        )}

        {/* Instructors */}
        {result.instructors.length > 0 && (
          <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
            {decodeHtmlEntities(result.instructors[0].name)}
            {result.instructors.length > 1 && (
              <span className="ml-1 opacity-60">
                +{result.instructors.length - 1} more
              </span>
            )}
          </p>
        )}

        {/* Tags row */}
        <div className="mt-auto flex flex-wrap gap-1.5 overflow-hidden pt-3" style={{ maxHeight: "2rem" }}>
          {result.mode && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {MODE_LABELS[result.mode] ?? result.mode}
            </span>
          )}
          {result.language.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {result.language[0]}
              {result.language.length > 1 && ` +${result.language.length - 1}`}
            </span>
          )}
          {result.difficulty && result.difficulty !== "NONE" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {result.difficulty.charAt(0) + result.difficulty.slice(1).toLowerCase()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

export function SearchResultCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="aspect-video w-full animate-pulse bg-muted" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="mt-auto flex gap-1.5 pt-3">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
