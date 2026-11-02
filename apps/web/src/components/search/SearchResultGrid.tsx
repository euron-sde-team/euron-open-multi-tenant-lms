"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

import type { SearchResult } from "@/lib/api/search";
import { SearchResultCard, SearchResultCardSkeleton } from "./SearchResultCard";

interface SearchResultGridProps {
  results: SearchResult[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function SearchResultGrid({
  results,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: SearchResultGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => (
          <SearchResultCard key={`${result.contentType}-${result.id}`} result={result} />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function SearchResultGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SearchResultCardSkeleton key={i} />
      ))}
    </div>
  );
}
