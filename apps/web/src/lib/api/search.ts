/**
 * API client for the search engine.
 * Client-side only, uses apiGet from api-client (handles auth + tenant host).
 */

import { apiGet } from "./api-client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  contentType: "COURSE" | "BOOK" | "BUNDLE";
  url: string;
  mode: string | null;
  difficulty: string | null;
  purchaseMode: string;
  priceInr: number | null;
  priceUsd: number | null;
  discountInr: number | null;
  discountUsd: number | null;
  language: string[];
  categories: string[];
  instructors: { id: string; name: string; avatarUrl: string | null }[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface SearchFilters {
  q?: string;
  type?: string;
  mode?: string;
  purchaseMode?: string;
  language?: string[];
  categories?: string[];
  difficulty?: string;
  instructors?: string[];
}

export interface FilterOptions {
  contentTypes: string[];
  modes: string[];
  purchaseModes: string[];
  languages: string[];
  categories: string[];
  difficulties: string[];
  instructors: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildParams(filters: SearchFilters, page?: number, limit?: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.type) params.type = filters.type;
  if (filters.mode) params.mode = filters.mode;
  if (filters.purchaseMode) params.purchaseMode = filters.purchaseMode;
  if (filters.difficulty) params.difficulty = filters.difficulty;
  if (filters.language && filters.language.length > 0) {
    params.language = filters.language.join(",");
  }
  if (filters.categories && filters.categories.length > 0) {
    params.categories = filters.categories.join(",");
  }
  if (filters.instructors && filters.instructors.length > 0) {
    params.instructors = filters.instructors.join(",");
  }
  if (page) params.page = String(page);
  if (limit) params.limit = String(limit);
  return params;
}

/* ------------------------------------------------------------------ */
/*  API functions                                                      */
/* ------------------------------------------------------------------ */

export async function searchContent(
  filters: SearchFilters,
  page = 1,
  limit = 12
): Promise<SearchResponse> {
  const params = buildParams(filters, page, limit);
  return apiGet<SearchResponse>("/search", { params });
}

export async function getSearchFilterOptions(
  filters: SearchFilters
): Promise<FilterOptions> {
  const params = buildParams(filters);
  return apiGet<FilterOptions>("/search/filters", { params });
}
