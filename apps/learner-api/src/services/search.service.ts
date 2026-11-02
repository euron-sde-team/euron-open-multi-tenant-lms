/**
 * Search service, orchestrates search queries and maps results to response DTOs.
 */

import config from "../config";
import type { price_entity_type } from "../db/enums";
import searchRepository from "../repositories/search.repository";
import type { SearchFilters, SearchResultRow } from "../repositories/search.repository";
import { getPriceMapsForEntities } from "../utils/price-resolver";

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
  contentType: string;
  url: string;
  mode: string | null;
  difficulty: string | null;
  purchaseMode: string;
  priceInr: number | null;
  priceUsd: number | null;
  discountInr: number | null;
  discountUsd: number | null;
  /** Per-currency price map (additive alongside legacy priceInr/priceUsd fields). */
  prices: Record<string, { amount: number; discount: number }>;
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function computeUrl(contentType: string, slug: string): string {
  switch (contentType) {
    case "COURSE":
    case "SHORTS":
      return `/courses/${slug}`;
    case "BOOK":
      return `/books/${slug}`;
    case "BUNDLE":
      return `/bundles/${slug}`;
    default:
      return `/courses/${slug}`;
  }
}

function resolveThumbnail(
  contentType: string,
  thumbnail: string | null
): string | null {
  if (!thumbnail?.trim()) return null;
  // Courses store thumbnail_key (S3 key), others store full URL
  if (contentType === "COURSE" || contentType === "SHORTS") {
    const base = config.THUMBNAILS_BASE_URL;
    if (!base) return thumbnail;
    const cleanKey = thumbnail.startsWith("/") ? thumbnail.slice(1) : thumbnail;
    return `${base}/${cleanKey}`;
  }
  return thumbnail;
}

function parseDecimal(val: string | null): number | null {
  if (!val) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function parseInstructorsJson(
  jsonStr: string | null
): { id: string; name: string; avatarUrl: string | null }[] {
  if (!jsonStr) return [];
  try {
    const parsed = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((i: { id: string; name: string; avatar_url?: string | null }) => ({
      id: i.id,
      name: i.name,
      avatarUrl: i.avatar_url ?? null,
    }));
  } catch {
    return [];
  }
}

function mapRow(
  row: SearchResultRow,
  prices: Record<string, { amount: number; discount: number }> = {}
): SearchResult {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    thumbnailUrl: resolveThumbnail(row.content_type, row.thumbnail),
    contentType: row.content_type,
    url: computeUrl(row.content_type, row.slug),
    mode: row.mode,
    difficulty: row.difficulty,
    purchaseMode: row.purchase_mode,
    priceInr: parseDecimal(row.price_inr),
    priceUsd: parseDecimal(row.price_usd),
    discountInr: parseDecimal(row.discount_inr),
    discountUsd: parseDecimal(row.discount_usd),
    prices,
    language: row.language ?? [],
    categories: row.categories ?? [],
    instructors: parseInstructorsJson(row.instructors_json),
  };
}

/** Map a search row's content_type to the price-book entity type (SHORTS are courses). */
function priceEntityTypeFor(contentType: string): price_entity_type {
  switch (contentType) {
    case "SHORTS":
      return "COURSE";
    case "BOOK":
      return "BOOK";
    case "BUNDLE":
      return "BUNDLE";
    default:
      return "COURSE";
  }
}

/**
 * Batched per-currency price maps for a page of mixed-type search results.
 * One getPriceMapsForEntities call per entity type present in the page,
 * keyed back by `${entityType}:${id}`.
 */
async function getPriceMapsForResults(
  tenantId: string,
  rows: SearchResultRow[]
): Promise<Map<string, Record<string, { amount: number; discount: number }>>> {
  const byType = new Map<price_entity_type, SearchResultRow[]>();
  for (const row of rows) {
    const entityType = priceEntityTypeFor(row.content_type);
    const list = byType.get(entityType) ?? [];
    list.push(row);
    byType.set(entityType, list);
  }

  const combined = new Map<string, Record<string, { amount: number; discount: number }>>();
  await Promise.all(
    [...byType.entries()].map(async ([entityType, typeRows]) => {
      const maps = await getPriceMapsForEntities(tenantId, entityType, typeRows);
      for (const [id, map] of maps) {
        combined.set(`${entityType}:${id}`, map);
      }
    })
  );
  return combined;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class SearchService {
  async search(
    tenantId: string,
    filters: SearchFilters = {},
    page = 1,
    limit = 12
  ): Promise<SearchResponse> {
    const result = await searchRepository.search(tenantId, filters, page, limit);
    const totalPages = Math.ceil(result.total / result.limit);
    const priceMaps = await getPriceMapsForResults(tenantId, result.results);

    return {
      results: result.results.map((row) =>
        mapRow(row, priceMaps.get(`${priceEntityTypeFor(row.content_type)}:${row.id}`) ?? {})
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages,
      hasMore: result.page < totalPages,
    };
  }

  async getFilterOptions(tenantId: string, filters: SearchFilters = {}) {
    return searchRepository.getFilterOptions(tenantId, filters);
  }

  async refreshSearchIndex(): Promise<boolean> {
    return searchRepository.refreshMaterializedView();
  }
}

const searchService = new SearchService();
export default searchService;
