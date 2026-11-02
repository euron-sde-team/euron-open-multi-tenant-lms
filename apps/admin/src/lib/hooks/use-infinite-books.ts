import { useInfiniteQuery } from "@tanstack/react-query";

import { booksApi, type Book } from "@/lib/api/books";

const PAGE_SIZE = 20;

export type BookFilter = "all" | "FREE" | "PAID";

export function useInfiniteBooks(tenantId: string | null, filter: BookFilter) {
  const purchaseMode = filter === "all" ? undefined : (filter as "FREE" | "PAID");

  return useInfiniteQuery({
    queryKey: ["books", "infinite", tenantId, filter],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await booksApi.getBooks(page, PAGE_SIZE, {
        status: "PUBLISHED",
        purchaseMode,
      });
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, limit, total } = lastPage;
      const hasMore = page * limit < total;
      return hasMore ? page + 1 : undefined;
    },
    enabled: !!tenantId,
  });
}

export type BookDisplay = {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl?: string;
  purchaseMode: string;
  status: string;
  pages: number | null;
  author: string | null;
};

export function bookToDisplay(book: Book): BookDisplay {
  return {
    id: book.id,
    title: book.title,
    slug: book.slug,
    thumbnailUrl: book.thumbnailUrl || undefined,
    purchaseMode: book.purchaseMode,
    status: book.status,
    pages: book.pages,
    author: book.author,
  };
}
