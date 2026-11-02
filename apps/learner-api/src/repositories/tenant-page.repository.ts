/**
 * Tenant Page Repository
 *
 * Database queries for tenant page management.
 * User-facing API: only returns published pages.
 */

import { db } from "../db/connection";
import {
  TenantPageResponse,
  TenantPageSection,
  TenantPageSeo,
  TenantPageSummary,
  TenantPageTheme,
} from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

interface TenantPageRow {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  sections: unknown;
  theme: unknown;
  seo: unknown;
  is_published: boolean;
  published_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// REPOSITORY
// ============================================

class TenantPageRepository {
  /**
   * Find a published page by tenant ID and page slug
   * Only returns published pages for user-facing APIs.
   */
  async findPublishedByTenantAndSlug(
    tenantId: string,
    pageSlug: string
  ): Promise<TenantPageResponse | null> {
    const page = await db
      .selectFrom("tenant_pages")
      .select([
        "id",
        "tenant_id",
        "slug",
        "title",
        "sections",
        "theme",
        "seo",
        "is_published",
        "published_at",
        "created_at",
        "updated_at",
      ])
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", pageSlug)
      .where("is_published", "=", true)
      .executeTakeFirst();

    return page ? this.mapToResponse(page as TenantPageRow) : null;
  }

  /**
   * List all published pages for a tenant
   * Returns summary data (id, slug, title) for list view.
   * Ordered by created_at descending.
   */
  async findPublishedByTenant(tenantId: string): Promise<TenantPageSummary[]> {
    const pages = await db
      .selectFrom("tenant_pages")
      .select(["id", "slug", "title"])
      .where("tenant_id", "=", tenantId)
      .where("is_published", "=", true)
      .orderBy("created_at", "asc")
      .execute();

    return pages.map((page) => this.mapToSummary(page));
  }

  /**
   * Check if a page exists for a tenant (regardless of published status)
   */
  async exists(tenantId: string, pageSlug: string): Promise<boolean> {
    const result = await db
      .selectFrom("tenant_pages")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", pageSlug)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Check if a published page exists for a tenant
   */
  async publishedExists(tenantId: string, pageSlug: string): Promise<boolean> {
    const result = await db
      .selectFrom("tenant_pages")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", pageSlug)
      .where("is_published", "=", true)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Count published pages for a tenant
   */
  async countPublished(tenantId: string): Promise<number> {
    const result = await db
      .selectFrom("tenant_pages")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId)
      .where("is_published", "=", true)
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToResponse(row: TenantPageRow): TenantPageResponse {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      sections: this.parseSections(row.sections),
      theme: this.parseTheme(row.theme),
      seo: this.parseSeo(row.seo),
      published_at: row.published_at,
    };
  }

  private mapToSummary(row: { id: string; slug: string; title: string }): TenantPageSummary {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
    };
  }

  private parseSections(raw: unknown): TenantPageSection[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as TenantPageSection[];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private parseTheme(raw: unknown): TenantPageTheme {
    if (!raw) return {};
    if (typeof raw === "object" && raw !== null) return raw as TenantPageTheme;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as TenantPageTheme;
      } catch {
        return {};
      }
    }
    return {};
  }

  private parseSeo(raw: unknown): TenantPageSeo {
    if (!raw) return {};
    if (typeof raw === "object" && raw !== null) return raw as TenantPageSeo;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as TenantPageSeo;
      } catch {
        return {};
      }
    }
    return {};
  }
}

export default new TenantPageRepository();
