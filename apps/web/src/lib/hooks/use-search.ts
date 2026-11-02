/**
 * React Query hooks for search, infinite scroll results + dynamic filter options.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { searchContent, getSearchFilterOptions } from "@/lib/api/search";
import type { SearchFilters } from "@/lib/api/search";

const SEARCH_PAGE_SIZE = 12;

export function useSearchResults(filters: SearchFilters) {
  return useInfiniteQuery({
    queryKey: ["search", "results", filters],
    queryFn: async ({ pageParam }) => {
      return searchContent(filters, pageParam as number, SEARCH_PAGE_SIZE);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });
}

export function useSearchFilters(filters: SearchFilters) {
  return useQuery({
    queryKey: ["search", "filters", filters],
    queryFn: () => getSearchFilterOptions(filters),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}
