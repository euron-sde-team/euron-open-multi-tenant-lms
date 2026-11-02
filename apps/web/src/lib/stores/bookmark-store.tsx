"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useBookmarks, type BookmarkItem } from "@/lib/hooks/use-bookmarks";

export type { BookmarkItem };

interface BookmarkContextValue {
  items: BookmarkItem[];
  addBookmark: (item: BookmarkItem) => void;
  removeBookmark: (productId: string) => void;
  toggleBookmark: (item: BookmarkItem) => void;
  isBookmarked: (productId: string) => boolean;
}

const BookmarkContext = createContext<BookmarkContextValue | null>(null);

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const {
    items,
    toggleBookmark,
    isBookmarked,
    addBookmark: addBookmarkApi,
    removeBookmark: removeBookmarkApi,
  } = useBookmarks();

  const addBookmark = useCallback(
    (item: BookmarkItem) => {
      const type = item.productType.toUpperCase() as "COURSE" | "BOOK" | "BUNDLE";
      addBookmarkApi(type, item.productId, item);
    },
    [addBookmarkApi]
  );

  const removeBookmark = useCallback(
    (productId: string) => {
      const item = items.find((i) => i.productId === productId);
      if (item) {
        const type = item.productType.toUpperCase() as "COURSE" | "BOOK" | "BUNDLE";
        removeBookmarkApi(type, productId);
      }
    },
    [items, removeBookmarkApi]
  );

  const value = useMemo<BookmarkContextValue>(
    () => ({
      items,
      addBookmark,
      removeBookmark,
      toggleBookmark,
      isBookmarked,
    }),
    [items, addBookmark, removeBookmark, toggleBookmark, isBookmarked]
  );

  return (
    <BookmarkContext.Provider value={value}>
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmark(): BookmarkContextValue {
  const ctx = useContext(BookmarkContext);
  if (!ctx) {
    throw new Error("useBookmark must be used within BookmarkProvider");
  }
  return ctx;
}

export function useBookmarkOptional(): BookmarkContextValue | null {
  return useContext(BookmarkContext);
}
