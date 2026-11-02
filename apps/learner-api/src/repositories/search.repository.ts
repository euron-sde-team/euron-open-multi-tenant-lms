/**
 * Search repository, queries the tenant_search_mv materialized view.
 * Uses raw SQL via Kysely's sql template tag for full-text search,
 * trigram similarity, and dynamic filter options.
 */

import { sql } from "kysely";
import { db } from "../db/connection";
import logger from "../utils/logger";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SearchFilters {
  q?: string;
  contentType?: string;
  mode?: string;
  purchaseMode?: string;
  language?: string[];
  categories?: string[];
  difficulty?: string;
  instructors?: string[];
}

export interface SearchResultRow {
  id: string;
  tenant_id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  slug: string;
  thumbnail: string | null;
  content_type: string;
  mode: string | null;
  difficulty: string | null;
  purchase_mode: string;
  price_inr: string | null;
  price_usd: string | null;
  discount_inr: string | null;
  discount_usd: string | null;
  language: string[];
  categories: string[];
  instructors_json: string;
  instructor_names: string[];
  created_at: Date;
}

export interface SearchRepoResult {
  results: SearchResultRow[];
  total: number;
  page: number;
  limit: number;
}

export interface FilterOptionsResult {
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

/**
 * Sanitize user query for tsquery, strip special characters
 * and build prefix-matching query (term1:* & term2:*).
 */
function sanitizeSearchQuery(query: string): string {
  const cleaned = query
    .replace(/[&|!:*()\\'"<>-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return "";
  return cleaned.map((t) => t + ":*").join(" & ");
}

/** Stable advisory lock key for MV refresh dedup. */
const MV_REFRESH_LOCK_KEY = 984371265;

/* ------------------------------------------------------------------ */
/*  Repository                                                         */
/* ------------------------------------------------------------------ */

class SearchRepository {
  /**
   * Full-text search with filters, trigram similarity, and 3-tier ranking.
   */
  async search(
    tenantId: string,
    filters: SearchFilters = {},
    page = 1,
    limit = 12
  ): Promise<SearchRepoResult> {
    page = Math.max(1, page);
    limit = Math.min(50, Math.max(1, limit));
    const offset = (page - 1) * limit;
    const hasQuery = !!filters.q?.trim();

    // Build WHERE conditions
    const conditions: ReturnType<typeof sql>[] = [
      sql`tenant_id = ${tenantId}`,
    ];

    let tsqueryStr = "";
    if (hasQuery) {
      tsqueryStr = sanitizeSearchQuery(filters.q!);
      if (tsqueryStr) {
        conditions.push(
          sql`(search_vector @@ to_tsquery('english', ${tsqueryStr}) OR similarity(title, ${filters.q!.trim()}) > 0.125)`
        );
      }
    }

    if (filters.contentType) {
      conditions.push(sql`content_type = ${filters.contentType}`);
    }
    if (filters.mode) {
      conditions.push(sql`mode = ${filters.mode}`);
    }
    if (filters.purchaseMode) {
      conditions.push(sql`purchase_mode = ${filters.purchaseMode}`);
    }
    if (filters.difficulty) {
      conditions.push(sql`difficulty = ${filters.difficulty}`);
    }
    if (filters.language && filters.language.length > 0) {
      conditions.push(
        sql`language && ${sql.val(filters.language)}::text[]`
      );
    }
    if (filters.categories && filters.categories.length > 0) {
      conditions.push(
        sql`categories && ${sql.val(filters.categories)}::text[]`
      );
    }
    if (filters.instructors && filters.instructors.length > 0) {
      conditions.push(
        sql`instructor_names && ${sql.val(filters.instructors)}::text[]`
      );
    }

    const whereClause = conditions.reduce(
      (acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`),
    );

    // Build ORDER BY
    let orderBy;
    if (hasQuery && tsqueryStr) {
      orderBy = sql`
        CASE content_type
          WHEN 'COURSE' THEN 1
          WHEN 'BOOK' THEN 3
          WHEN 'BUNDLE' THEN 4
          ELSE 5
        END ASC,
        CASE
          WHEN lower(title) LIKE ${filters.q!.trim().toLowerCase() + "%"} THEN 3
          WHEN lower(title) LIKE ${"%" + filters.q!.trim().toLowerCase() + "%"} THEN 2
          ELSE 1
        END DESC,
        ts_rank(search_vector, to_tsquery('english', ${tsqueryStr})) DESC,
        similarity(title, ${filters.q!.trim()}) DESC
      `;
    } else {
      orderBy = sql`
        CASE content_type
          WHEN 'COURSE' THEN 1
          WHEN 'BOOK' THEN 3
          WHEN 'BUNDLE' THEN 4
          ELSE 5
        END ASC,
        created_at DESC
      `;
    }

    // Count query
    const countResult = await sql<{ count: string }>`
      SELECT count(*)::text AS count
      FROM tenant_search_mv
      WHERE ${whereClause}
    `.execute(db);
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    // Results query
    const results = await sql<SearchResultRow>`
      SELECT
        id, tenant_id, title, subtitle, description, slug, thumbnail,
        content_type, mode, difficulty, purchase_mode,
        price_inr::text, price_usd::text, discount_inr::text, discount_usd::text,
        language, categories, instructors_json::text, instructor_names,
        created_at
      FROM tenant_search_mv
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `.execute(db);

    return {
      results: results.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * Get dynamic filter options based on current filters.
   * Returns only values that exist in the filtered result set.
   */
  async getFilterOptions(
    tenantId: string,
    filters: SearchFilters = {}
  ): Promise<FilterOptionsResult> {
    // Build base WHERE (same logic as search but without the specific filter we're computing options for)
    const conditions: ReturnType<typeof sql>[] = [
      sql`tenant_id = ${tenantId}`,
    ];

    if (filters.q?.trim()) {
      const tsqueryStr = sanitizeSearchQuery(filters.q);
      if (tsqueryStr) {
        conditions.push(
          sql`(search_vector @@ to_tsquery('english', ${tsqueryStr}) OR similarity(title, ${filters.q.trim()}) > 0.125)`
        );
      }
    }
    if (filters.contentType) {
      conditions.push(sql`content_type = ${filters.contentType}`);
    }
    if (filters.mode) {
      conditions.push(sql`mode = ${filters.mode}`);
    }
    if (filters.purchaseMode) {
      conditions.push(sql`purchase_mode = ${filters.purchaseMode}`);
    }
    if (filters.difficulty) {
      conditions.push(sql`difficulty = ${filters.difficulty}`);
    }
    if (filters.language && filters.language.length > 0) {
      conditions.push(
        sql`language && ${sql.val(filters.language)}::text[]`
      );
    }
    if (filters.categories && filters.categories.length > 0) {
      conditions.push(
        sql`categories && ${sql.val(filters.categories)}::text[]`
      );
    }
    if (filters.instructors && filters.instructors.length > 0) {
      conditions.push(
        sql`instructor_names && ${sql.val(filters.instructors)}::text[]`
      );
    }

    const whereClause = conditions.reduce(
      (acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`),
    );

    const result = await sql<{
      content_types: string[];
      modes: string[];
      purchase_modes: string[];
      languages: string[];
      categories: string[];
      difficulties: string[];
      instructors: string[];
    }>`
      WITH filtered AS (
        SELECT * FROM tenant_search_mv WHERE ${whereClause}
      )
      SELECT
        (SELECT coalesce(array_agg(DISTINCT content_type), '{}') FROM filtered) AS content_types,
        (SELECT coalesce(array_agg(DISTINCT mode), '{}') FROM filtered WHERE mode IS NOT NULL) AS modes,
        (SELECT coalesce(array_agg(DISTINCT purchase_mode), '{}') FROM filtered) AS purchase_modes,
        (SELECT coalesce(array_agg(DISTINCT lang), '{}') FROM filtered, unnest(language) AS lang) AS languages,
        (SELECT coalesce(array_agg(DISTINCT cat), '{}') FROM filtered, unnest(categories) AS cat) AS categories,
        (SELECT coalesce(array_agg(DISTINCT difficulty), '{}') FROM filtered WHERE difficulty IS NOT NULL) AS difficulties,
        (SELECT coalesce(array_agg(DISTINCT inst), '{}') FROM filtered, unnest(instructor_names) AS inst) AS instructors
    `.execute(db);

    const row = result.rows[0];
    return {
      contentTypes: row?.content_types ?? [],
      modes: row?.modes ?? [],
      purchaseModes: row?.purchase_modes ?? [],
      languages: row?.languages ?? [],
      categories: row?.categories ?? [],
      difficulties: row?.difficulties ?? [],
      instructors: row?.instructors ?? [],
    };
  }

  /**
   * Refresh the materialized view with advisory lock to prevent concurrent refreshes.
   */
  async refreshMaterializedView(): Promise<boolean> {
    try {
      // Session advisory locks belong to one connection, so lock, refresh and
      // unlock all run on a single pinned pool connection.
      return await db.connection().execute(async (conn) => {
        const lockResult = await sql<{ locked: boolean }>`
          SELECT pg_try_advisory_lock(${MV_REFRESH_LOCK_KEY}) AS locked
        `.execute(conn);

        if (!lockResult.rows[0]?.locked) {
          logger.info("Search MV refresh skipped, another worker is refreshing");
          return false;
        }

        try {
          await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_search_mv`.execute(conn);
          logger.info("Search MV refreshed successfully");
          return true;
        } finally {
          await sql`SELECT pg_advisory_unlock(${MV_REFRESH_LOCK_KEY})`.execute(conn);
        }
      });
    } catch (error) {
      logger.error("Search MV refresh failed:", error);
      return false;
    }
  }
}

const searchRepository = new SearchRepository();
export default searchRepository;
