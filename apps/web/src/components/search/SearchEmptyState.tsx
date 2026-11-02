"use client";

import { Button } from "@open-mtlms/core";
import { SearchX, Lightbulb } from "lucide-react";

interface SearchEmptyStateProps {
  query: string | undefined;
  hasFilters: boolean;
  onClearFilters: () => void;
}

const SEARCH_TIPS = [
  "Try using fewer or broader keywords",
  "Check for spelling mistakes",
  "Remove some filters to broaden results",
  "Search by topic name or instructor",
];

const POPULAR_SEARCHES = [
  "Web Development",
  "Data Science",
  "Machine Learning",
  "UI/UX Design",
  "Cloud Computing",
];

export function SearchEmptyState({ query, hasFilters, onClearFilters }: SearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <SearchX className="h-10 w-10 text-muted-foreground/50" />
      </div>

      <h3 className="text-xl font-semibold">No results found</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {query
          ? `We couldn't find anything matching "${query}"${hasFilters ? " with the selected filters" : ""}.`
          : "No content matches the selected filters."}
      </p>

      {hasFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="mt-4"
        >
          Clear filters
        </Button>
      )}

      {/* Search tips */}
      <div className="mt-8 w-full max-w-sm rounded-lg border bg-muted/30 p-4 text-left">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Search tips
        </div>
        <ul className="space-y-1.5">
          {SEARCH_TIPS.map((tip) => (
            <li key={tip} className="text-xs text-muted-foreground">
              &bull; {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Popular searches */}
      <div className="mt-4">
        <p className="mb-2 text-xs text-muted-foreground">Popular searches</p>
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR_SEARCHES.map((term) => (
            <a
              key={term}
              href={`/search?q=${encodeURIComponent(term)}`}
              className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {term}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
