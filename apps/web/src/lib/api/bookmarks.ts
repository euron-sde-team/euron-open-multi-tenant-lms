/**
 * Bookmark API functions for end-user bookmark management.
 * Calls the learner-api at /api/v1/bookmarks.
 * Uses api-client: on 401 (JWT expired), auth is cleared.
 */

import { apiDelete, apiGet, apiPost } from "./api-client";

export type BookmarkType = "COURSE" | "BOOK" | "BUNDLE";

export interface BookmarkListItem {
  productId: string;
  productType: "course" | "book" | "bundle";
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  subtitle?: string | null;
}

export interface ListBookmarksResponse {
  courses: BookmarkListItem[];
  books: BookmarkListItem[];
  bundles: BookmarkListItem[];
}

export const bookmarksApi = {
  list: (): Promise<ListBookmarksResponse> => apiGet("/bookmarks"),

  add: (type: BookmarkType, itemId: string): Promise<{ added: boolean }> =>
    apiPost("/bookmarks", { type, item_id: itemId }),

  remove: (type: BookmarkType, itemId: string): Promise<{ removed: boolean }> =>
    apiDelete("/bookmarks", { params: { type, item_id: itemId } }),
};
