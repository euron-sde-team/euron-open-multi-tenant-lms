/**
 * Books API Client
 *
 * Book records live in the `books` table (dedicated backend).
 * This API provides CRUD operations for books with entitlement management.
 */

import type { ContentPrice } from "@open-mtlms/shared";

import type { ApiResponse } from "../types/auth";
import { generateSlug } from "../utils/slug";

import { apiClient } from "./axios";

// Book response from the backend
export interface Book {
  id: string;
  /** Bundles containing this book, drives the "Part of X" chip. */
  bundles?: { id: string; title: string; slug: string }[];
  tenantId: string;
  title: string;
  slug: string;
  author: string | null;
  description: string | null;
  summary: string | null;
  pages: number | null;
  url: string | null;
  pageImages: string[];
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  /** Multi-currency price book (returned on detail GETs). */
  prices?: ContentPrice[];
  purchaseMode: "FREE" | "PAID";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  language: string[];
  thumbnailUrl: string | null;
  previewUrl: string | null;
  sortOrder: number;
  validityDays: number | null;
  rating: number | null;
  ratingTotalCount: number | null;
  sampleEnabled: boolean;
  samplePages: number;
  fileFormat: "EPUB" | "PDF";
  authorIds: string[];
  categoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BooksListResponse {
  books: Book[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateBookRequest {
  title: string;
  slug?: string;
  author?: string | null;
  description?: string | null;
  summary?: string | null;
  pages?: number | null;
  url?: string | null;
  page_images?: string[];
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  prices?: ContentPrice[];
  purchase_mode?: "FREE" | "PAID";
  status?: "DRAFT" | "PUBLISHED";
  language?: string[];
  thumbnail_url?: string | null;
  preview_url?: string | null;
  sort_order?: number;
  validity_days?: number | null;
  rating?: string | number | null;
  rating_total_count?: number | null;
  sample_enabled?: boolean;
  sample_pages?: number;
  file_format?: "EPUB" | "PDF";
}

export interface UpdateBookRequest {
  title?: string;
  slug?: string;
  author?: string | null;
  description?: string | null;
  summary?: string | null;
  pages?: number | null;
  url?: string | null;
  page_images?: string[];
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  prices?: ContentPrice[];
  purchase_mode?: "FREE" | "PAID";
  status?: "DRAFT" | "PUBLISHED";
  language?: string[];
  thumbnail_url?: string | null;
  preview_url?: string | null;
  sort_order?: number;
  validity_days?: number | null;
  rating?: string | number | null;
  rating_total_count?: number | null;
  sample_enabled?: boolean;
  sample_pages?: number;
  file_format?: "EPUB" | "PDF";
  author_ids?: string[];
  category_ids?: string[];
}

export const booksApi = {
  /**
   * List books for a tenant from the books table.
   */
  getBooks: async (
    page = 1,
    limit = 100,
    filters?: { status?: string; purchaseMode?: string }
  ): Promise<BooksListResponse> => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filters?.status) params.set("status", filters.status);
    if (filters?.purchaseMode) params.set("purchaseMode", filters.purchaseMode);

    const response = await apiClient.get<ApiResponse<BooksListResponse>>(
      `/tenant/books?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get a single book by ID.
   */
  getBook: async (bookId: string): Promise<Book> => {
    const response = await apiClient.get<ApiResponse<Book>>(
      `/tenant/books/${bookId}`
    );
    return response.data.data;
  },

  /**
   * Get a book by slug.
   */
  getBookBySlug: async (slug: string): Promise<Book> => {
    const response = await apiClient.get<ApiResponse<Book>>(
      `/tenant/books/by-slug/${encodeURIComponent(slug)}`
    );
    return response.data.data;
  },

  /**
   * Create a new book.
   * The backend handles entitlement checks (books_enabled).
   */
  createBook: async (data: CreateBookRequest): Promise<Book> => {
    const slug = data.slug || generateSlug(data.title);
    if (!slug) {
      throw new Error("Invalid book title, cannot generate slug");
    }

    const response = await apiClient.post<ApiResponse<Book>>("/tenant/books", {
      ...data,
      slug,
    });
    return response.data.data;
  },

  /**
   * Update an existing book.
   */
  updateBook: async (bookId: string, data: UpdateBookRequest): Promise<Book> => {
    const response = await apiClient.put<ApiResponse<Book>>(
      `/tenant/books/${bookId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete a book.
   * The backend handles entitlement release if the book was published.
   */
  deleteBook: async (bookId: string): Promise<void> => {
    await apiClient.delete(`/tenant/books/${bookId}`);
  },

  /**
   * Toggle publish: calls the dedicated backend endpoint that handles
   * entitlement consume (on publish) / release (on unpublish).
   */
  togglePublish: async (bookId: string, isPublished: boolean): Promise<Book> => {
    const response = await apiClient.post<ApiResponse<Book>>(
      `/tenant/books/${bookId}/toggle-publish`,
      { publish: isPublished }
    );
    return response.data.data;
  },

  /**
   * Get book recommendations.
   */
  getRecommendations: async (
    bookId: string
  ): Promise<
    Array<{
      id: string;
      bookId: string;
      title: string;
      slug: string;
      thumbnailUrl: string | null;
      sortOrder: number;
    }>
  > => {
    const response = await apiClient.get<
      ApiResponse<
        Array<{
          id: string;
          bookId: string;
          title: string;
          slug: string;
          thumbnailUrl: string | null;
          sortOrder: number;
        }>
      >
    >(`/tenant/books/${bookId}/recommendations`);
    return response.data.data;
  },

  /**
   * Sync book recommendations (bulk replace).
   */
  syncRecommendations: async (
    bookId: string,
    recommendedBookIds: string[]
  ): Promise<
    Array<{
      id: string;
      bookId: string;
      title: string;
      slug: string;
      thumbnailUrl: string | null;
      sortOrder: number;
    }>
  > => {
    const response = await apiClient.put<
      ApiResponse<
        Array<{
          id: string;
          bookId: string;
          title: string;
          slug: string;
          thumbnailUrl: string | null;
          sortOrder: number;
        }>
      >
    >(`/tenant/books/${bookId}/recommendations/sync`, {
      recommendedBookIds,
    });
    return response.data.data;
  },
};
