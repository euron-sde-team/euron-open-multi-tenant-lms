/**
 * API client for fetching published books from the user server.
 * Used by the book showcase section on landing pages.
 */

// Get the API base URL from environment or fallback to localhost
function getApiBaseUrl(): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1`;
}

export interface PublishedBookListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  pages: number | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  language: string[];
  author: string | null;
  authors: { id: string; name: string }[];
  /** PUBLISHED bundles containing this book, powers the "Part of X" chip. */
  bundles?: { id: string; title: string; slug: string }[];
  hasEpubContent?: boolean;
  url?: string | null;
  /** Whether the current user has access to this book (purchased/enrolled) */
  has_access?: boolean;
  /** Content status, may include ARCHIVED for owned items */
  status?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PublishedBooksResponse {
  books: PublishedBookListItem[];
  pagination: PaginationMeta;
}

export interface BooksListParams {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
  purchaseMode?: "FREE" | "PAID";
  /** Filter to only return books the user owns/has access to */
  ownedOnly?: boolean;
  /** Filter to only return bookmarked books */
  bookmarkedOnly?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch published books for the current tenant.
 * Tenant is resolved from the request host header.
 */
export async function fetchPublishedBooks(
  params: BooksListParams = {},
  host?: string
): Promise<PublishedBooksResponse> {
  const { page = 1, limit = 8, sortBy = "sort_order", sortOrder = "asc", purchaseMode, bookmarkedOnly, ownedOnly } = params;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy,
    sortOrder,
  });
  if (purchaseMode) {
    queryParams.set("purchaseMode", purchaseMode);
  }
  if (bookmarkedOnly) {
    queryParams.set("bookmarked_only", "true");
  }
  if (ownedOnly) {
    queryParams.set("owned_only", "true");
  }

  const url = `${getApiBaseUrl()}/books?${queryParams.toString()}`;

  const headers: Record<string, string> = {};

  // Use provided host or try to get from window (client-side)
  const tenantHost = host || (typeof window !== "undefined" ? window.location.host : "");
  if (tenantHost) {
    headers["X-Tenant-Host"] = tenantHost;
  }

  // Include auth token so backend can check book access per user
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token") || localStorage.getItem("accessToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch books: ${response.status}`);
  }

  const json: ApiResponse<PublishedBooksResponse> = await response.json();

  if (!json.success || !json.data) {
    throw new Error("Invalid response from server");
  }

  return json.data;
}
