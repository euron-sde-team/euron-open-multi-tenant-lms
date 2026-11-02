import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPublishedBundles } from "@/lib/api/bundles";
import { useUserAuthStore } from "@/lib/stores/auth-store";

export const BUNDLES_PAGE_SIZE = 20;
export const BUNDLES_QUERY_KEY = ["bundles", "published", "infinite"] as const;

export type BundleFilter = "all" | "bookmarked";

export function useInfinitePublishedBundles(host?: string, filter?: BundleFilter) {
  const { isAuthenticated } = useUserAuthStore();
  const bookmarkedOnly = filter === "bookmarked";

  return useInfiniteQuery({
    queryKey: [...BUNDLES_QUERY_KEY, host ?? "client", filter ?? "all", isAuthenticated],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await fetchPublishedBundles(
        {
          page,
          limit: BUNDLES_PAGE_SIZE,
          sortBy: "sort_order",
          sortOrder: "asc",
          bookmarkedOnly,
        },
        host
      );
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: !bookmarkedOnly || isAuthenticated,
  });
}
