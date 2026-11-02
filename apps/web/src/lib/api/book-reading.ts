/**
 * Book reading API functions for progress, highlights, and bookmarks.
 * Calls the learner-api at /api/v1/books/:bookId/*.
 */

const API_URL = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL) || "http://localhost:5096/api/v1";

function getTenantHost(): string {
  if (typeof window !== "undefined") {
    return window.location.host;
  }
  return "";
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // Check all possible token storage keys (authToken is primary, others are legacy)
  const authToken = localStorage.getItem("authToken");
  if (authToken) return authToken;
  const legacy = localStorage.getItem("auth_token");
  if (legacy) return legacy;
  return localStorage.getItem("accessToken");
}

async function bookReadingFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Host": getTenantHost(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    const message =
      json.error?.message || json.message || "An error occurred";
    throw new Error(message);
  }

  return json.data as T;
}

// ------- Types -------

export interface BookHighlight {
  id: string;
  tenantId: string;
  tenantMemberId: string;
  bookId: string;
  cfiRange: string;
  text: string;
  color: string;
  createdAt: string;
}

export interface BookPageBookmark {
  id: string;
  tenantId: string;
  tenantMemberId: string;
  bookId: string;
  cfiLocation: string;
  label: string | null;
  createdAt: string;
}

export interface ReadingProgress {
  id: string;
  tenantId: string;
  tenantMemberId: string;
  bookId: string;
  location: string | null;
  lastPage: number | null;
  completed: boolean;
}

export interface FullReadingData {
  progress: ReadingProgress | null;
  highlights: BookHighlight[];
  bookmarks: BookPageBookmark[];
}

// ------- API Functions -------

export const bookReadingApi = {
  /**
   * Get full reading data (progress, highlights, bookmarks) for a book
   */
  getReadingData: (bookId: string): Promise<FullReadingData> =>
    bookReadingFetch(`/books/${bookId}/reading`),

  /**
   * Save reading progress (location)
   */
  saveProgress: (bookId: string, location: string): Promise<{ success: boolean }> =>
    bookReadingFetch(`/books/${bookId}/reading/progress`, {
      method: "POST",
      body: JSON.stringify({ location }),
    }),

  /**
   * Get all highlights for a book
   */
  getHighlights: (bookId: string): Promise<BookHighlight[]> =>
    bookReadingFetch(`/books/${bookId}/highlights`),

  /**
   * Add a highlight
   */
  addHighlight: (
    bookId: string,
    cfiRange: string,
    text: string,
    color: string
  ): Promise<BookHighlight> =>
    bookReadingFetch(`/books/${bookId}/highlights`, {
      method: "POST",
      body: JSON.stringify({ cfiRange, text, color }),
    }),

  /**
   * Remove a highlight
   */
  removeHighlight: (bookId: string, highlightId: string): Promise<{ success: boolean }> =>
    bookReadingFetch(`/books/${bookId}/highlights/${highlightId}`, {
      method: "DELETE",
    }),

  /**
   * Get all page bookmarks for a book
   */
  getPageBookmarks: (bookId: string): Promise<BookPageBookmark[]> =>
    bookReadingFetch(`/books/${bookId}/page-bookmarks`),

  /**
   * Add a page bookmark
   */
  addPageBookmark: (
    bookId: string,
    cfiLocation: string,
    label?: string
  ): Promise<BookPageBookmark> =>
    bookReadingFetch(`/books/${bookId}/page-bookmarks`, {
      method: "POST",
      body: JSON.stringify({ cfiLocation, label }),
    }),

  /**
   * Remove a page bookmark
   */
  removePageBookmark: (bookId: string, bookmarkId: string): Promise<{ success: boolean }> =>
    bookReadingFetch(`/books/${bookId}/page-bookmarks/${bookmarkId}`, {
      method: "DELETE",
    }),
};
