import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPublishedBooks } from "@/lib/api/books";

const PAGE_SIZE = 20;

export function useInfiniteOwnedBooks() {
  return useInfiniteQuery({
    queryKey: ["books", "owned", "infinite"],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await fetchPublishedBooks({
        page,
        limit: PAGE_SIZE,
        sortBy: "sort_order",
        sortOrder: "asc",
        ownedOnly: true,
      });
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
  });
}
