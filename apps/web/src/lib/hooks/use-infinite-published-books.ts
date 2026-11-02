import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPublishedBooks } from "@/lib/api/books";
import { useUserAuthStore } from "@/lib/stores/auth-store";

const PAGE_SIZE = 20;

export type BookFilter = "all" | "FREE" | "PAID" | "bookmarked";

export function useInfinitePublishedBooks(filter: BookFilter) {
  const { isAuthenticated } = useUserAuthStore();
  const purchaseMode =
    filter === "all" || filter === "bookmarked" ? undefined : (filter as "FREE" | "PAID");
  const bookmarkedOnly = filter === "bookmarked";

  return useInfiniteQuery({
    queryKey: ["books", "published", "infinite", filter, isAuthenticated],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await fetchPublishedBooks({
        page,
        limit: PAGE_SIZE,
        sortBy: "sort_order",
        sortOrder: "asc",
        purchaseMode,
        bookmarkedOnly,
      });
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: !bookmarkedOnly || isAuthenticated,
  });
}
