"use client";

import { Button, cn } from "@open-mtlms/core";
import { Filter, X, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import type { ContentTerms } from "@open-mtlms/shared";

import { useContentTerms } from "@/lib/hooks/use-content-terms";
import type { FilterOptions, SearchFilters } from "@/lib/api/search";
import { SearchFilterSection } from "./SearchFilterSection";

/* ------------------------------------------------------------------ */
/*  Label helpers                                                      */
/* ------------------------------------------------------------------ */

/** Content-type filter labels, using the tenant's renamed plural terms. */
function contentTypeLabels(terms: ContentTerms): Record<string, string> {
  return {
    COURSE: terms.course.plural,
    BOOK: terms.book.plural,
    BUNDLE: terms.bundle.plural,
  };
}

const MODE_LABELS: Record<string, string> = {
  SELF_PACED: "Self-Paced",
  LIVE: "Live",
  HYBRID: "Hybrid",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  NONE: "Not Specified",
};

function toFilterOptions(
  values: string[],
  labels?: Record<string, string>
): { value: string; label: string }[] {
  return values.map((v) => ({
    value: v,
    label: labels?.[v] ?? v,
  }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SearchFilterPanelProps {
  filters: SearchFilters;
  filterOptions: FilterOptions | undefined;
  onFilterChange: (updates: Partial<SearchFilters>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  isLoading: boolean;
  totalResults: number;
}

function FilterContent({
  filters,
  filterOptions,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  isLoading,
}: Omit<SearchFilterPanelProps, "totalResults">) {
  const terms = useContentTerms();
  if (isLoading || !filterOptions) {
    return (
      <div className="space-y-5 p-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2.5">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-3/4 animate-pulse rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const contentTypeLabelMap = contentTypeLabels(terms);
  const showMode =
    !filters.type ||
    filters.type === "COURSE";
  const showDifficulty = showMode;

  return (
    <div className="space-y-1">
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mb-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <X className="h-3 w-3" />
          Clear all filters
        </button>
      )}

      <SearchFilterSection
        title="Content Type"
        options={toFilterOptions(filterOptions.contentTypes, contentTypeLabelMap)}
        selected={filters.type}
        onChange={(v) =>
          onFilterChange({
            type: v as string | undefined,
            ...(v && v !== "COURSE"
              ? { mode: undefined, difficulty: undefined }
              : {}),
          })
        }
      />

      {showMode && filterOptions.modes.length > 0 && (
        <SearchFilterSection
          title="Learning Mode"
          options={toFilterOptions(filterOptions.modes, MODE_LABELS)}
          selected={filters.mode}
          onChange={(v) => onFilterChange({ mode: v as string | undefined })}
        />
      )}

      {showDifficulty && filterOptions.difficulties.length > 0 && (
        <SearchFilterSection
          title="Difficulty"
          options={toFilterOptions(filterOptions.difficulties, DIFFICULTY_LABELS)}
          selected={filters.difficulty}
          onChange={(v) => onFilterChange({ difficulty: v as string | undefined })}
        />
      )}

      {filterOptions.languages.length > 0 && (
        <SearchFilterSection
          title="Language"
          options={toFilterOptions(filterOptions.languages)}
          selected={filters.language}
          onChange={(v) => onFilterChange({ language: v as string[] | undefined })}
          multiSelect
        />
      )}

      {filterOptions.categories.length > 0 && (
        <SearchFilterSection
          title="Category"
          options={toFilterOptions(filterOptions.categories)}
          selected={filters.categories}
          onChange={(v) => onFilterChange({ categories: v as string[] | undefined })}
          multiSelect
          defaultOpen={false}
        />
      )}

      {filterOptions.instructors.length > 0 && (
        <SearchFilterSection
          title="Instructor"
          options={toFilterOptions(filterOptions.instructors)}
          selected={filters.instructors}
          onChange={(v) => onFilterChange({ instructors: v as string[] | undefined })}
          multiSelect
          defaultOpen={false}
        />
      )}
    </div>
  );
}

export function SearchFilterPanel(props: SearchFilterPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hide filters when 0 results and no active filters
  const shouldHide = props.totalResults === 0 && !props.hasActiveFilters && !props.isLoading;
  if (shouldHide) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-20 overflow-y-auto pr-2" style={{ maxHeight: "calc(100vh - 6rem)" }}>
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Filters</h3>
          </div>
          <FilterContent {...props} />
        </div>
      </aside>

      {/* Mobile trigger */}
      <div className="md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(true)}
          className="gap-2 rounded-full"
        >
          <Filter className="h-4 w-4" />
          Filters
          {props.hasActiveFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              !
            </span>
          )}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className={cn(
            "absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-background p-6 shadow-xl",
            "animate-in slide-in-from-bottom duration-300"
          )}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Filters</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <FilterContent {...props} />
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  props.onClearFilters();
                  setMobileOpen(false);
                }}
                className="flex-1"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setMobileOpen(false)}
                className="flex-1"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
