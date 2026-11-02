"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { useContentTerms } from "@/lib/hooks/use-content-terms";
import { useSearchParamsState } from "@/lib/hooks/use-search-params-state";
import { useSearchResults, useSearchFilters } from "@/lib/hooks/use-search";
import { SearchFilterPanel } from "./SearchFilterPanel";
import { SearchResultGrid, SearchResultGridSkeleton } from "./SearchResultGrid";
import { SearchEmptyState } from "./SearchEmptyState";

export function SearchContent() {
  const router = useRouter();
  const terms = useContentTerms();
  const searchPlaceholder = `Search ${terms.course.plural.toLowerCase()}, ${terms.book.plural.toLowerCase()}, ${terms.bundle.plural.toLowerCase()}...`;
  const { filters, setFilters, clearFilters, hasActiveFilters, setQuery } =
    useSearchParamsState();

  const {
    data: searchData,
    isLoading: isSearchLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useSearchResults(filters);

  const { data: filterOptions, isLoading: isFiltersLoading } =
    useSearchFilters(filters);

  const allResults = useMemo(
    () => searchData?.pages.flatMap((p) => p.results) ?? [],
    [searchData]
  );

  const totalResults = searchData?.pages[0]?.total ?? 0;

  // ----- Debounced search input -----
  const [localQuery, setLocalQuery] = useState(filters.q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync local input when URL query changes externally
  useEffect(() => {
    setLocalQuery(filters.q ?? "");
  }, [filters.q]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setQuery(value.trim() || undefined);
      }, 300);
    },
    [setQuery]
  );

  const handleClearQuery = useCallback(() => {
    setLocalQuery("");
    clearTimeout(debounceRef.current);
    setQuery(undefined);
  }, [setQuery]);

  // Cleanup timeout on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back button + Search bar */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Prominent search input */}
        <div className="relative mx-auto max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-12 w-full rounded-xl border bg-background pl-12 pr-10 text-base outline-none transition-shadow focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {localQuery && (
            <button
              type="button"
              onClick={handleClearQuery}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      {!isSearchLoading && (
        <div className="mb-5">
          <p className="text-sm text-muted-foreground">
            {totalResults === 0
              ? filters.q
                ? `No results for "${filters.q}"`
                : "No results"
              : `${totalResults} ${totalResults === 1 ? "result" : "results"}${filters.q ? ` for "${filters.q}"` : ""}`}
          </p>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col md:flex-row md:gap-8">
        {/* Filter sidebar (desktop) / trigger button (mobile) */}
        <SearchFilterPanel
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={setFilters}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          isLoading={isFiltersLoading}
          totalResults={totalResults}
        />

        {/* Results area */}
        <div className="min-w-0 flex-1">
          {isSearchLoading ? (
            <SearchResultGridSkeleton />
          ) : allResults.length === 0 ? (
            <SearchEmptyState
              query={filters.q}
              hasFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />
          ) : (
            <SearchResultGrid
              results={allResults}
              hasNextPage={!!hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
