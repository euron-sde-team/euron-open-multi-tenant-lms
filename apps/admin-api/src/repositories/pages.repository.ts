import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import { ulid } from "ulid";

/**
 * Slugs a homepage has been stored under, in order of preference.
 *
 * "home" is what every tenant uses today; "/" and "" are legacy forms that the
 * admin app used to accept when it scanned the page list client-side. Matching
 * all three keeps that behaviour intact. Note these must be matched literally:
 * pagesService.normalizeSlug() strips slashes, so a by-slug lookup can never
 * reach a page stored as "/".
 */
export const HOMEPAGE_SLUGS: string[] = ["home", "/", ""];

// Define proper types for repository use
export type PageRenderMode = "SECTIONS" | "CUSTOM_CODE";
export type CustomCodeKind = "SANITIZED_INLINE" | "SANDBOXED_IFRAME";
export type PageModerationStatus = "ACTIVE" | "BLOCKED";

export interface TenantPage {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  sections: unknown; // JSON array of SectionConfig
  theme: unknown; // JSON ThemeConfig
  seo: unknown; // JSON SEOConfig
  is_published: boolean;
  published_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  // Custom-code pages (opt-in). render_mode="SECTIONS" for all normal pages.
  render_mode: PageRenderMode;
  custom_code_kind: CustomCodeKind | null;
  custom_html: string | null; // published HTML served to visitors
  custom_html_draft: string | null; // work-in-progress HTML (admin preview only)
  custom_assets: unknown;
  moderation_status: PageModerationStatus;
}

export interface CreatePageInput {
  tenant_id: string;
  slug: string;
  title: string;
  sections: unknown;
  theme: unknown;
  seo: unknown;
  is_published?: boolean;
  created_by?: string;
  render_mode?: PageRenderMode;
  custom_code_kind?: CustomCodeKind | null;
  custom_html?: string | null;
  custom_html_draft?: string | null;
  custom_assets?: unknown;
}

export interface UpdatePageInput {
  slug?: string;
  title?: string;
  sections?: unknown;
  theme?: unknown;
  seo?: unknown;
  is_published?: boolean;
  updated_by?: string;
  render_mode?: PageRenderMode;
  custom_code_kind?: CustomCodeKind | null;
  custom_html?: string | null;
  custom_html_draft?: string | null;
  custom_assets?: unknown;
  moderation_status?: PageModerationStatus;
}

export interface PagesListResult {
  pages: TenantPage[];
  total: number;
  page: number;
  limit: number;
}

class PagesRepository {
  /**
   * Find pages by tenant ID with pagination
   */
  async findByTenantId(
    tenantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PagesListResult> {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db
      .selectFrom("tenant_pages")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const total = Number(countResult?.count ?? 0);

    // Get pages with pagination - exclude sections/theme/seo for faster list loading
    const results = await db
      .selectFrom("tenant_pages")
      .select([
        "id",
        "tenant_id",
        "slug",
        "title",
        "is_published",
        "published_at",
        "created_by",
        "updated_by",
        "created_at",
        "updated_at",
        // Needed so the pages list can flag which pages are on custom code.
        "render_mode",
      ])
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const pages = results.map((r) => this.mapToTenantPageList(r));

    return {
      pages,
      total,
      page,
      limit,
    };
  }

  /**
   * Find page by ID
   */
  async findById(id: string, tenantId?: string): Promise<TenantPage | undefined> {
    let query = db
      .selectFrom("tenant_pages")
      .selectAll()
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantPage(result);
  }

  /**
   * Find page by tenant ID and slug (for web app rendering)
   */
  /**
   * Find the tenant's homepage, matching every historical homepage slug.
   *
   * Single indexed lookup on (tenant_id, slug). Unlike scanning a page of the
   * list it cannot miss the row because the tenant owns more pages than the
   * list limit returns.
   */
  async findHomepage(
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TenantPage | undefined> {
    const results = await (trx || db)
      .selectFrom("tenant_pages")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "in", HOMEPAGE_SLUGS)
      .execute();

    // Prefer "home" if a tenant somehow has more than one of the legacy forms.
    for (const slug of HOMEPAGE_SLUGS) {
      const match = results.find((r) => r.slug === slug);
      if (match) return this.mapToTenantPage(match);
    }

    return undefined;
  }

  async findByTenantAndSlug(
    tenantId: string,
    slug: string,
    trx?: Transaction<DB>
  ): Promise<TenantPage | undefined> {
    const result = await (trx || db)
      .selectFrom("tenant_pages")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantPage(result);
  }

  /**
   * Find published page by tenant ID and slug (public endpoint)
   */
  async findPublishedByTenantAndSlug(
    tenantId: string,
    slug: string
  ): Promise<TenantPage | undefined> {
    const result = await db
      .selectFrom("tenant_pages")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .where("is_published", "=", true)
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantPage(result);
  }

  /**
   * Create a new page
   */
  async create(data: CreatePageInput, trx?: Transaction<DB>): Promise<TenantPage> {
    const id = ulid();
    const now = new Date();

    const result = await (trx || db)
      .insertInto("tenant_pages")
      .values({
        id,
        tenant_id: data.tenant_id,
        slug: data.slug,
        title: data.title,
        sections: JSON.stringify(data.sections),
        theme: JSON.stringify(data.theme),
        seo: JSON.stringify(data.seo),
        is_published: data.is_published ?? false,
        published_at: data.is_published ? now : null,
        created_by: data.created_by ?? null,
        updated_by: data.created_by ?? null,
        created_at: now,
        updated_at: now,
        render_mode: data.render_mode ?? "SECTIONS",
        custom_code_kind: data.custom_code_kind ?? null,
        custom_html: data.custom_html ?? null,
        custom_html_draft: data.custom_html_draft ?? null,
        custom_assets:
          data.custom_assets !== undefined && data.custom_assets !== null
            ? JSON.stringify(data.custom_assets)
            : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToTenantPage(result);
  }

  /**
   * Update a page
   */
  async update(id: string, data: UpdatePageInput, trx?: Transaction<DB>, tenantId?: string): Promise<TenantPage | undefined> {
    const now = new Date();
    const updateData: Record<string, unknown> = {
      updated_at: now,
    };

    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.sections !== undefined) updateData.sections = JSON.stringify(data.sections);
    if (data.theme !== undefined) updateData.theme = JSON.stringify(data.theme);
    if (data.seo !== undefined) updateData.seo = JSON.stringify(data.seo);
    if (data.updated_by !== undefined) updateData.updated_by = data.updated_by;

    // Custom-code fields (only set when explicitly provided).
    if (data.render_mode !== undefined) updateData.render_mode = data.render_mode;
    if (data.custom_code_kind !== undefined)
      updateData.custom_code_kind = data.custom_code_kind;
    if (data.custom_html !== undefined) updateData.custom_html = data.custom_html;
    if (data.custom_html_draft !== undefined)
      updateData.custom_html_draft = data.custom_html_draft;
    if (data.custom_assets !== undefined)
      updateData.custom_assets =
        data.custom_assets === null ? null : JSON.stringify(data.custom_assets);
    if (data.moderation_status !== undefined)
      updateData.moderation_status = data.moderation_status;

    // Handle publish status change
    if (data.is_published !== undefined) {
      updateData.is_published = data.is_published;
      updateData.published_at = data.is_published ? now : null;
    }

    let query = (trx || db)
      .updateTable("tenant_pages")
      .set(updateData)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantPage(result);
  }

  /**
   * Update only publish status (lightweight - no sections/theme/seo)
   */
  async updatePublishStatus(id: string, isPublished: boolean, tenantId?: string): Promise<TenantPage | undefined> {
    const now = new Date();
    const updateData: Record<string, unknown> = {
      updated_at: now,
      is_published: isPublished,
      published_at: isPublished ? now : null,
    };

    let query = db
      .updateTable("tenant_pages")
      .set(updateData)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantPage(result);
  }

  /**
   * Delete a page
   */
  async delete(id: string, trx?: Transaction<DB>, tenantId?: string): Promise<boolean> {
    let query = (trx || db)
      .deleteFrom("tenant_pages")
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();

    return result.numDeletedRows > 0;
  }

  /**
   * Find page IDs by tenant and slug list
   */
  async findIdsByTenantAndSlugs(
    tenantId: string,
    slugs: string[]
  ): Promise<Array<{ id: string; slug: string }>> {
    if (slugs.length === 0) return [];
    const results = await db
      .selectFrom("tenant_pages")
      .select(["id", "slug"])
      .where("tenant_id", "=", tenantId)
      .where("slug", "in", slugs)
      .execute();
    return results.map((r) => ({ id: r.id, slug: r.slug }));
  }

  /**
   * Check if slug exists for a tenant
   */
  async slugExistsForTenant(
    tenantId: string,
    slug: string,
    excludeId?: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    let query = (trx || db)
      .selectFrom("tenant_pages")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Duplicate a page with a new slug
   */
  async duplicate(id: string, newSlug?: string): Promise<TenantPage | undefined> {
    const original = await this.findById(id);
    if (!original) return undefined;

    // Generate a unique slug if not provided
    let slug = newSlug ?? `${original.slug}-copy`;
    let counter = 1;

    // Ensure slug is unique
    while (await this.slugExistsForTenant(original.tenant_id, slug)) {
      slug = newSlug
        ? `${newSlug}-${counter}`
        : `${original.slug}-copy-${counter}`;
      counter++;
    }

    return this.create({
      tenant_id: original.tenant_id,
      slug,
      title: `${original.title} (Copy)`,
      sections: original.sections,
      theme: original.theme,
      seo: original.seo,
      is_published: false,
      created_by: original.created_by ?? undefined,
    });
  }

  /**
   * Map lightweight list result to TenantPage (sections, theme, seo as empty)
   */
  private mapToTenantPageList(result: Record<string, unknown>): TenantPage {
    return {
      ...this.mapToTenantPage(result),
      sections: [],
      theme: {},
      seo: {},
    };
  }

  /**
   * Map database result to TenantPage
   */
  private mapToTenantPage(result: Record<string, unknown>): TenantPage {
    return {
      id: result.id as string,
      tenant_id: result.tenant_id as string,
      slug: result.slug as string,
      title: result.title as string,
      sections: typeof result.sections === "string"
        ? JSON.parse(result.sections)
        : result.sections,
      theme: typeof result.theme === "string"
        ? JSON.parse(result.theme)
        : result.theme,
      seo: typeof result.seo === "string"
        ? JSON.parse(result.seo)
        : result.seo,
      is_published: result.is_published as boolean,
      published_at: result.published_at ? new Date(result.published_at as string) : null,
      created_by: result.created_by as string | null,
      updated_by: result.updated_by as string | null,
      created_at: new Date(result.created_at as string),
      updated_at: new Date(result.updated_at as string),
      render_mode: (result.render_mode as PageRenderMode) ?? "SECTIONS",
      custom_code_kind: (result.custom_code_kind as CustomCodeKind | null) ?? null,
      custom_html: (result.custom_html as string | null) ?? null,
      custom_html_draft: (result.custom_html_draft as string | null) ?? null,
      custom_assets:
        typeof result.custom_assets === "string"
          ? JSON.parse(result.custom_assets)
          : (result.custom_assets ?? null),
      moderation_status: (result.moderation_status as PageModerationStatus) ?? "ACTIVE",
    };
  }

  // --- Custom-code page version history ------------------------------------

  async createRevision(
    data: {
      tenant_id: string;
      page_id: string;
      custom_html: string;
      custom_code_kind?: string | null;
      label?: string | null;
      created_by?: string | null;
    },
    trx?: Transaction<DB>
  ): Promise<string> {
    const id = ulid();
    await (trx || db)
      .insertInto("tenant_page_revisions")
      .values({
        id,
        tenant_id: data.tenant_id,
        page_id: data.page_id,
        custom_html: data.custom_html,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        custom_code_kind: (data.custom_code_kind ?? null) as any,
        label: data.label ?? null,
        created_by: data.created_by ?? null,
        created_at: new Date(),
      })
      .execute();
    return id;
  }

  async listRevisions(tenantId: string, pageId: string, limit = 20) {
    return db
      .selectFrom("tenant_page_revisions")
      .select(["id", "custom_code_kind", "label", "created_by", "created_at"])
      .where("tenant_id", "=", tenantId)
      .where("page_id", "=", pageId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute();
  }

  async getRevision(tenantId: string, revisionId: string) {
    return db
      .selectFrom("tenant_page_revisions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", revisionId)
      .executeTakeFirst();
  }

  /** Keep only the newest `keep` revisions for a page; delete the rest. */
  async pruneRevisions(tenantId: string, pageId: string, keep = 20, trx?: Transaction<DB>) {
    const stale = await (trx || db)
      .selectFrom("tenant_page_revisions")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("page_id", "=", pageId)
      .orderBy("created_at", "desc")
      .offset(keep)
      .limit(1000)
      .execute();
    if (stale.length > 0) {
      await (trx || db)
        .deleteFrom("tenant_page_revisions")
        .where(
          "id",
          "in",
          stale.map((r) => r.id)
        )
        .execute();
    }
  }
}

export default new PagesRepository();
