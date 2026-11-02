"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bookmarksApi, type BookmarkListItem, type BookmarkType } from "@/lib/api/bookmarks";
import { useUserAuthStore } from "@/lib/stores/auth-store";

export const BOOKMARKS_QUERY_KEY = ["bookmarks"] as const;

export interface BookmarkItem {
  productId: string;
  productType: "course" | "book" | "bundle";
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  subtitle?: string | null;
}

function flattenBookmarks(data: {
  courses: BookmarkListItem[];
  books: BookmarkListItem[];
  bundles: BookmarkListItem[];
}): BookmarkItem[] {
  return [
    ...data.courses.map((c) => ({ ...c, productType: "course" as const })),
    ...data.books.map((b) => ({ ...b, productType: "book" as const })),
    ...data.bundles.map((b) => ({ ...b, productType: "bundle" as const })),
  ];
}

export function useBookmarks() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useUserAuthStore();

  const {
    data,
    isLoading,
    isError,
    refetch: refetchBookmarks,
  } = useQuery({
    queryKey: BOOKMARKS_QUERY_KEY,
    queryFn: () => bookmarksApi.list(),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const items = useMemo(() => {
    if (!data) return [];
    return flattenBookmarks(data);
  }, [data]);

  const addMutation = useMutation({
    mutationFn: ({
      type,
      itemId,
    }: {
      type: BookmarkType;
      itemId: string;
      item?: BookmarkItem;
    }) => bookmarksApi.add(type, itemId),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: BOOKMARKS_QUERY_KEY });
      const previous = queryClient.getQueryData<{
        courses: BookmarkListItem[];
        books: BookmarkListItem[];
        bundles: BookmarkListItem[];
      }>(BOOKMARKS_QUERY_KEY);
      if (previous && variables.item) {
        const typeKey =
          variables.type === "COURSE"
            ? "courses"
            : variables.type === "BOOK"
              ? "books"
              : "bundles";
        const list = previous[typeKey];
        if (!list.some((i) => i.productId === variables.itemId)) {
          const newItem: BookmarkListItem = {
            productId: variables.item.productId,
            productType: variables.item.productType,
            title: variables.item.title,
            slug: variables.item.slug,
            thumbnailUrl: variables.item.thumbnailUrl,
            subtitle: variables.item.subtitle,
          };
          queryClient.setQueryData(BOOKMARKS_QUERY_KEY, {
            ...previous,
            [typeKey]: [...list, newItem],
          });
        }
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BOOKMARKS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOOKMARKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["books", "published", "infinite", "bookmarked"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ type, itemId }: { type: BookmarkType; itemId: string }) =>
      bookmarksApi.remove(type, itemId),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: BOOKMARKS_QUERY_KEY });
      const previous = queryClient.getQueryData<{
        courses: BookmarkListItem[];
        books: BookmarkListItem[];
        bundles: BookmarkListItem[];
      }>(BOOKMARKS_QUERY_KEY);
      if (previous) {
        const typeKey =
          variables.type === "COURSE"
            ? "courses"
            : variables.type === "BOOK"
              ? "books"
              : "bundles";
        const list = previous[typeKey].filter((i) => i.productId !== variables.itemId);
        queryClient.setQueryData(BOOKMARKS_QUERY_KEY, { ...previous, [typeKey]: list });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BOOKMARKS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOOKMARKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["books", "published", "infinite", "bookmarked"] });
    },
  });

  const addBookmark = useCallback(
    (type: BookmarkType, itemId: string, item?: BookmarkItem) => {
      addMutation.mutate({ type, itemId, item });
    },
    [addMutation]
  );

  const removeBookmark = useCallback(
    (type: BookmarkType, itemId: string) => {
      removeMutation.mutate({ type, itemId });
    },
    [removeMutation]
  );

  const toggleBookmark = useCallback(
    (item: BookmarkItem) => {
      const type = item.productType.toUpperCase() as BookmarkType;
      const isBooked = items.some((i) => i.productId === item.productId);
      if (isBooked) {
        removeMutation.mutate({ type, itemId: item.productId });
      } else {
        addMutation.mutate({ type, itemId: item.productId, item });
      }
    },
    [items, addMutation, removeMutation]
  );

  const isBookmarked = useCallback(
    (productId: string) => items.some((i) => i.productId === productId),
    [items]
  );

  return useMemo(
    () => ({
      items,
      data,
      isLoading,
      isError,
      addBookmark,
      removeBookmark,
      toggleBookmark,
      isBookmarked,
      refetchBookmarks,
      isAdding: addMutation.isPending,
      isRemoving: removeMutation.isPending,
    }),
    [
      items,
      data,
      isLoading,
      isError,
      addBookmark,
      removeBookmark,
      toggleBookmark,
      isBookmarked,
      refetchBookmarks,
      addMutation.isPending,
      removeMutation.isPending,
    ]
  );
}
