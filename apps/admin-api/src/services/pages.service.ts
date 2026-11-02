import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { EntitlementForbiddenError } from "../errors/entitlement-forbidden.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import pagesRepository, {
  CreatePageInput,
  TenantPage,
  UpdatePageInput,
} from "../repositories/pages.repository";
import tenantRepository from "../repositories/tenant.repository";
import footerGeneratorService from "./footer-generator.service";

import entitlementsService from "./entitlements.service";
import usageService from "./usage.service";

// Response types for the API
export interface PageResponse {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  sections: unknown;
  theme: unknown;
  seo: unknown;
  isPublished: boolean;
  publishedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Custom-code pages
  renderMode: "SECTIONS" | "CUSTOM_CODE";
  customCodeKind: "SANITIZED_INLINE" | "SANDBOXED_IFRAME" | null;
  /** Published HTML that visitors are served (custom-code pages only). */
  customHtml: string | null;
  /** Work-in-progress HTML the admin editor edits (never served publicly). */
  customHtmlDraft: string | null;
  customAssets: unknown;
  moderationStatus: "ACTIVE" | "BLOCKED";
}

/** What the unauthenticated page route may reveal: published content only. */
export type PublicPageResponse = Omit<
  PageResponse,
  "createdBy" | "updatedBy" | "createdAt" | "customHtmlDraft" | "moderationStatus"
>;

export interface PagesListResponse {
  pages: PageResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CreatePageData {
  tenantId: string;
  slug: string;
  title: string;
  sections: unknown;
  theme: unknown;
  seo: unknown;
  isPublished?: boolean;
  userId?: string;
  renderMode?: "SECTIONS" | "CUSTOM_CODE";
  customCodeKind?: "SANITIZED_INLINE" | "SANDBOXED_IFRAME" | null;
  customHtmlDraft?: string | null;
  customAssets?: unknown;
}

export interface UpdatePageData {
  slug?: string;
  title?: string;
  sections?: unknown;
  theme?: unknown;
  seo?: unknown;
  isPublished?: boolean;
  userId?: string;
  renderMode?: "SECTIONS" | "CUSTOM_CODE";
  customCodeKind?: "SANITIZED_INLINE" | "SANDBOXED_IFRAME" | null;
  /** Editor content, saved to the draft copy, never served until publish. */
  customHtmlDraft?: string | null;
  customAssets?: unknown;
}

/** Max size for a custom-code HTML document (~512 KB, per plan). */
const MAX_CUSTOM_HTML_BYTES = 512 * 1024;

class PagesService {
  /**
   * Get all pages for a tenant with pagination
   */
  async getPages(
    tenantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PagesListResponse> {
    if (!tenantId) {
      throw new BadRequestError("Tenant ID is required");
    }

    // Validate pagination
    // NOTE: 100 silently truncated tenants with many course pages. The pages
    // dashboard asks for 200 to build its slug -> category map; anything the
    // clamp dropped rendered as "Not Created". Raised to 500 as a stopgap.
    // See tasks/todo.md "Pages list limit clamp" for the real fix.
    if (page < 1) page = 1;
    if (limit < 1) limit = 1;
    if (limit > 500) limit = 500;

    const result = await pagesRepository.findByTenantId(tenantId, page, limit);

    return {
      pages: result.pages.map(this.mapToPageResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * Get a page by ID
   */
  async getPageById(pageId: string, tenantId?: string): Promise<PageResponse> {
    if (!pageId) {
      throw new BadRequestError("Page ID is required");
    }

    const page = await pagesRepository.findById(pageId, tenantId);

    if (!page) {
      throw new NotFoundError("Page not found");
    }

    if (tenantId && page.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this page");
    }

    return this.mapToPageResponse(page);
  }

  /**
   * Get the tenant's homepage, or null when the tenant does not have one yet.
   *
   * Returns null instead of throwing because "no homepage" is a normal state
   * (a tenant mid-onboarding), and every caller falls back to the default theme.
   * Matches all historical homepage slugs; see HOMEPAGE_SLUGS.
   */
  async getHomepage(tenantId: string): Promise<PageResponse | null> {
    if (!tenantId) {
      throw new BadRequestError("Tenant ID is required");
    }

    const page = await pagesRepository.findHomepage(tenantId);

    return page ? this.mapToPageResponse(page) : null;
  }

  /**
   * Get a page by tenant ID and slug (for authenticated users)
   */
  async getPageBySlug(tenantId: string, slug: string): Promise<PageResponse> {
    if (!tenantId || !slug) {
      throw new BadRequestError("Tenant ID and slug are required");
    }

    const normalizedSlug = this.normalizeSlug(slug);
    const page = await pagesRepository.findByTenantAndSlug(tenantId, normalizedSlug);

    if (!page) {
      throw new NotFoundError("Page not found");
    }

    return this.mapToPageResponse(page);
  }

  /**
   * Get a published page by tenant ID and slug (for public rendering)
   */
  async getPublishedPageBySlug(tenantId: string, slug: string): Promise<PublicPageResponse> {
    if (!tenantId || !slug) {
      throw new BadRequestError("Tenant ID and slug are required");
    }

    const normalizedSlug = this.normalizeSlug(slug);
    const page = await pagesRepository.findPublishedByTenantAndSlug(tenantId, normalizedSlug);

    if (!page) {
      throw new NotFoundError("Page not found");
    }

    // Public route: no drafts, no staff ids, and a moderated page serves no
    // custom code.
    const blocked = page.moderation_status === "BLOCKED";
    return {
      id: page.id,
      tenantId: page.tenant_id,
      slug: page.slug,
      title: page.title,
      sections: page.sections,
      theme: page.theme,
      seo: page.seo,
      isPublished: page.is_published,
      publishedAt: page.published_at?.toISOString() ?? null,
      updatedAt: page.updated_at.toISOString(),
      renderMode: page.render_mode,
      customCodeKind: page.custom_code_kind,
      customHtml: blocked ? null : page.custom_html,
      customAssets: blocked ? null : page.custom_assets,
    };
  }

  /**
   * Create a new page.
   * For `courses/` slugs: the courses service owns entitlement checks, no entitlement logic here.
   * For `books/` slugs: checks books_enabled entitlement (consumption deferred to publish).
   */
  async createPage(data: CreatePageData): Promise<PageResponse> {
    // Validate required fields
    if (!data.tenantId) {
      throw new BadRequestError("Tenant ID is required");
    }

    if (!data.slug) {
      throw new BadRequestError("Slug is required");
    }

    if (!data.title) {
      throw new BadRequestError("Title is required");
    }

    // Normalize and validate slug
    const normalizedSlug = this.normalizeSlug(data.slug);
    this.validateSlug(normalizedSlug);

    const isBookPage = normalizedSlug.startsWith("books/");

    // For book pages, ensure the books feature is enabled
    if (isBookPage) {
      await entitlementsService.ensureBooleanEntitlement(
        data.tenantId,
        "books_enabled",
        "books",
        "Books are not enabled on your plan. Upgrade to add books."
      );
    }

    // Custom-code pages are available to all tenants (no entitlement gate).
    // Size cap still applies. Only fires when created in CUSTOM_CODE mode.
    if (data.renderMode === "CUSTOM_CODE") {
      this.validateCustomHtml(data.customHtmlDraft);
    }

    // Check for duplicate slug
    const existingPage = await pagesRepository.findByTenantAndSlug(
      data.tenantId,
      normalizedSlug
    );

    if (existingPage) {
      // For course pages, the courses service creates the page atomically inside
      // a transaction. If the frontend also calls this endpoint (old behavior),
      // return the existing page instead of a 409 so both flows coexist safely.
      if (normalizedSlug.startsWith("courses/")) {
        return this.mapToPageResponse(existingPage);
      }
      throw new ConflictError(`Page with slug "${normalizedSlug}" already exists`);
    }

    const createInput: CreatePageInput = {
      tenant_id: data.tenantId,
      slug: normalizedSlug,
      title: data.title.trim(),
      sections: data.sections ?? [],
      theme: data.theme ?? {},
      seo: data.seo ?? { title: data.title },
      is_published: data.isPublished ?? false,
      created_by: data.userId,
      render_mode: data.renderMode ?? "SECTIONS",
      custom_code_kind: data.customCodeKind ?? null,
      custom_html_draft: data.customHtmlDraft ?? null,
      custom_assets: data.customAssets,
    };

    const page = await pagesRepository.create(createInput);

    // Homepage creation = tenant site is born → generate full footer
    // Initialize footer on homepage creation
    if (normalizedSlug === "home" || normalizedSlug === "") {
      this.initializeFooter(data.tenantId);
    }

    return this.mapToPageResponse(page);
  }

  /**
   * Update a page
   */
  async updatePage(pageId: string, tenantId: string, data: UpdatePageData): Promise<PageResponse> {
    if (!pageId) {
      throw new BadRequestError("Page ID is required");
    }
    if (!tenantId) {
      throw new BadRequestError("Tenant ID is required");
    }

    // Check if page exists and belongs to tenant
    const existingPage = await pagesRepository.findById(pageId, tenantId);

    if (!existingPage) {
      throw new NotFoundError("Page not found");
    }

    if (existingPage.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this page");
    }

    // If slug is being updated and is different from current, validate and check for duplicates
    // Skip slug validation if slug is empty string or same as current
    if (data.slug !== undefined && data.slug !== "" && data.slug !== existingPage.slug) {
      const normalizedSlug = this.normalizeSlug(data.slug);
      this.validateSlug(normalizedSlug);

      const slugExists = await pagesRepository.slugExistsForTenant(
        existingPage.tenant_id,
        normalizedSlug,
        pageId
      );

      if (slugExists) {
        throw new ConflictError(`Page with slug "${normalizedSlug}" already exists`);
      }

      data.slug = normalizedSlug;
    } else {
      // Don't update slug if it's empty or unchanged
      data.slug = undefined;
    }

    // Sync seo.title with page title, page title is the single source of truth
    if (data.title) {
      const existingSeo = data.seo ?? (typeof existingPage.seo === "string"
        ? JSON.parse(existingPage.seo as string)
        : existingPage.seo) ?? {};
      data.seo = { ...existingSeo, title: data.title.trim() };
    }

    // Custom-code write: gate (fail-closed) + size cap whenever the resulting
    // page is in CUSTOM_CODE mode or custom code is being saved. Editor content
    // is written to the DRAFT copy; it is only served after an explicit publish.
    const targetMode = data.renderMode ?? (existingPage.render_mode as "SECTIONS" | "CUSTOM_CODE");
    if (targetMode === "CUSTOM_CODE" || data.customHtmlDraft !== undefined) {
      this.validateCustomHtml(data.customHtmlDraft);
    }

    const updateInput: UpdatePageInput = {
      slug: data.slug,
      title: data.title?.trim(),
      sections: data.sections,
      theme: data.theme,
      seo: data.seo,
      is_published: data.isPublished,
      updated_by: data.userId,
      render_mode: data.renderMode,
      custom_code_kind: data.customCodeKind,
      custom_html_draft: data.customHtmlDraft,
      custom_assets: data.customAssets,
    };

    const page = await pagesRepository.update(pageId, updateInput, undefined, tenantId);

    if (!page) {
      throw new NotFoundError("Page not found");
    }

    return this.mapToPageResponse(page);
  }

  /**
   * Delete a page.
   * Course entitlement release is handled by courses.service, not here.
   * Book page entitlement release: if the book page was published, release books_count.
   */
  async deletePage(pageId: string, tenantId: string): Promise<void> {
    if (!pageId) {
      throw new BadRequestError("Page ID is required");
    }
    if (!tenantId) {
      throw new BadRequestError("Tenant context is required");
    }

    const page = await pagesRepository.findById(pageId, tenantId);
    if (!page) {
      throw new NotFoundError("Page not found");
    }
    if (page.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this page");
    }

    const isBookPage = page.slug.startsWith("books/");
    const wasPublished = page.is_published;

    const deleted = await pagesRepository.delete(pageId, undefined, tenantId);
    if (!deleted) {
      throw new NotFoundError("Page not found");
    }

    // Release book counter only if it was published (published books consume a slot)
    if (isBookPage && wasPublished) {
      await usageService.release(tenantId, "books_count", 1, {
        resourceType: "BOOK",
        resourceId: pageId,
      });
    }

  }

  /**
   * Toggle page publish status.
   * For book pages: handles entitlement consume on publish, release on unpublish.
   * For course pages: entitlement handled by courses.service.togglePublish, no action here.
   */
  async togglePublish(
    pageId: string,
    tenantId: string,
    isPublished: boolean
  ): Promise<PageResponse> {
    if (!pageId) {
      throw new BadRequestError("Page ID is required");
    }
    if (!tenantId) {
      throw new BadRequestError("Tenant ID is required");
    }

    const existing = await pagesRepository.findById(pageId, tenantId);
    if (!existing) {
      throw new NotFoundError("Page not found");
    }

    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this page");
    }

    const isBookPage = existing.slug.startsWith("books/");
    const wasPublished = existing.is_published;
    const resolvedTenantId = tenantId;

    // Custom-code page: publishing promotes the draft HTML into the served copy
    // (custom_html). No entitlement gate; still block if moderation-flagged.
    if (existing.render_mode === "CUSTOM_CODE" && isPublished) {
      if (existing.moderation_status === "BLOCKED") {
        throw new ForbiddenError(
          "This page has been blocked and cannot be published. Contact support."
        );
      }
      const promoted = await pagesRepository.update(
        pageId,
        { is_published: true, custom_html: existing.custom_html_draft ?? "" },
        undefined,
        resolvedTenantId
      );
      if (!promoted) throw new NotFoundError("Page not found");
      // Snapshot the just-published HTML into version history, keep newest 20.
      const publishedHtml = existing.custom_html_draft ?? "";
      if (publishedHtml) {
        try {
          await pagesRepository.createRevision({
            tenant_id: resolvedTenantId,
            page_id: pageId,
            custom_html: publishedHtml,
            custom_code_kind: existing.custom_code_kind ?? null,
          });
          await pagesRepository.pruneRevisions(resolvedTenantId, pageId, 20);
        } catch {
          /* revision history is best-effort; never block a publish */
        }
      }
      return this.mapToPageResponse(promoted);
    }

    // Book entitlement handling on publish/unpublish
    if (isBookPage) {
      if (isPublished && !wasPublished) {
        // Publishing a book: check capacity and consume
        const capacity = await entitlementsService.checkCapacity(
          resolvedTenantId,
          "books_count",
          1
        );
        if (!capacity.allowed) {
          throw new EntitlementForbiddenError(
            "Book limit reached. Upgrade your plan to add more books.",
            {
              code: "ENTITLEMENT_LIMIT_REACHED",
              productCode: "books_count",
              featureKey: "books",
              currentUsed: capacity.currentUsed,
              limit: capacity.limit,
              isUnlimited: capacity.isUnlimited,
            }
          );
        }
        await usageService.consume(resolvedTenantId, "books_count", 1, {
          resourceType: "BOOK",
          resourceId: pageId,
        });
      } else if (!isPublished && wasPublished) {
        // Unpublishing a book: release the slot
        await usageService.release(resolvedTenantId, "books_count", 1, {
          resourceType: "BOOK",
          resourceId: pageId,
        });
      }
    }

    const page = await pagesRepository.updatePublishStatus(pageId, isPublished, tenantId);

    if (!page) {
      throw new NotFoundError("Page not found");
    }

    return this.mapToPageResponse(page);
  }

  /**
   * Duplicate a page.
   * Entitlement checks: course duplication deferred to courses service;
   * book duplication checks books_enabled (consumption deferred to publish).
   */
  async duplicatePage(
    pageId: string,
    tenantId: string,
    newSlug?: string
  ): Promise<PageResponse> {
    if (!pageId) {
      throw new BadRequestError("Page ID is required");
    }
    if (!tenantId) {
      throw new BadRequestError("Tenant context is required");
    }

    const original = await pagesRepository.findById(pageId, tenantId);
    if (!original) {
      throw new NotFoundError("Page not found");
    }
    if (original.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this page");
    }

    const wouldBeBookSlug =
      original.slug.startsWith("books/") ||
      (typeof newSlug === "string" && this.normalizeSlug(newSlug).startsWith("books/"));

    if (wouldBeBookSlug) {
      await entitlementsService.ensureBooleanEntitlement(
        tenantId,
        "books_enabled",
        "books",
        "Books are not enabled on your plan. Upgrade to add books."
      );
    }

    // Validate new slug if provided
    let normalizedNewSlug: string | undefined;
    if (newSlug) {
      normalizedNewSlug = this.normalizeSlug(newSlug);
      this.validateSlug(normalizedNewSlug);
    }

    const page = await pagesRepository.duplicate(pageId, normalizedNewSlug);

    if (!page) {
      throw new NotFoundError("Page not found");
    }

    return this.mapToPageResponse(page);
  }

  /**
   * Normalize slug (lowercase, trim, remove special chars)
   */
  private normalizeSlug(slug: string): string {
    return slug
      .toLowerCase()
      .trim()
      .replace(/^\/+|\/+$/g, "") // Remove leading/trailing slashes
      .replace(/[^a-z0-9\-/]/g, "-") // Replace special chars with hyphens (keep slashes)
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  }

  /**
   * Validate slug format
   */
  private validateSlug(slug: string): void {
    // Allow "home" as special case for root page
    if (slug === "home" || slug === "") {
      return;
    }

    // Slug should be lowercase alphanumeric with hyphens
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

    if (!slugRegex.test(slug)) {
      throw new BadRequestError(
        "Invalid slug format. Use lowercase letters, numbers, and hyphens only."
      );
    }

    // Check max length
    if (slug.length > 200) {
      throw new BadRequestError("Slug is too long (max 200 characters)");
    }
  }

  /**
   * Generate full footer when homepage is created (fire-and-forget).
   * Writes the complete footer config (columns, social links, contact, copyright)
   * into the tenant layout so the footer is ready immediately.
   */
  private initializeFooter(tenantId: string): void {
    footerGeneratorService.generateFooter(tenantId).then(async (footer) => {
      const rawLayout = await tenantRepository.getLayout(tenantId);
      const layout = (rawLayout && typeof rawLayout === "object" ? rawLayout : {}) as Record<string, unknown>;
      layout.footer = { ...(typeof layout.footer === "object" && layout.footer ? layout.footer as Record<string, unknown> : {}), ...footer };
      await tenantRepository.updateLayout(tenantId, layout);
    }).catch(() => {});
  }

  /**
   * Validate a custom-code HTML document: size cap only (the untrusted content
   * is isolated at render time via a sandboxed iframe, so we don't reject on
   * content here, just guard the payload size).
   */
  private validateCustomHtml(html: string | null | undefined): void {
    if (html == null) return;
    const bytes = Buffer.byteLength(html, "utf8");
    if (bytes > MAX_CUSTOM_HTML_BYTES) {
      throw new BadRequestError(
        `Custom code is too large (${Math.round(bytes / 1024)} KB). Maximum is ${
          MAX_CUSTOM_HTML_BYTES / 1024
        } KB.`
      );
    }
  }

  /**
   * Map database entity to API response
   */
  private mapToPageResponse(page: TenantPage): PageResponse {
    return {
      id: page.id,
      tenantId: page.tenant_id,
      slug: page.slug,
      title: page.title,
      sections: page.sections,
      theme: page.theme,
      seo: page.seo,
      isPublished: page.is_published,
      publishedAt: page.published_at?.toISOString() ?? null,
      createdBy: page.created_by,
      updatedBy: page.updated_by,
      createdAt: page.created_at.toISOString(),
      updatedAt: page.updated_at.toISOString(),
      renderMode: page.render_mode,
      customCodeKind: page.custom_code_kind,
      customHtml: page.custom_html,
      customHtmlDraft: page.custom_html_draft,
      customAssets: page.custom_assets,
      moderationStatus: page.moderation_status,
    };
  }

  /** List saved versions (newest first) for a custom-code page. */
  async listRevisions(tenantId: string, pageId: string) {
    const rows = await pagesRepository.listRevisions(tenantId, pageId, 20);
    return rows.map((r) => ({
      id: r.id,
      customCodeKind: r.custom_code_kind,
      label: r.label,
      createdBy: r.created_by,
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : new Date(r.created_at as unknown as string).toISOString(),
    }));
  }

  /**
   * Restore a saved version into the page's DRAFT (not live). The admin can
   * then review it in the editor and Publish to make it live.
   */
  async restoreRevision(tenantId: string, pageId: string, revisionId: string) {
    const revision = await pagesRepository.getRevision(tenantId, revisionId);
    if (!revision || revision.page_id !== pageId) {
      throw new NotFoundError("Version not found");
    }
    const updated = await pagesRepository.update(
      pageId,
      {
        render_mode: "CUSTOM_CODE",
        custom_code_kind: (revision.custom_code_kind ?? undefined) as
          | "SANITIZED_INLINE"
          | "SANDBOXED_IFRAME"
          | undefined,
        custom_html_draft: revision.custom_html,
      },
      undefined,
      tenantId
    );
    if (!updated) throw new NotFoundError("Page not found");
    return this.mapToPageResponse(updated);
  }

  /**
   * What a section calls itself, for matching and for error messages: the
   * first heading-ish string in its content, else its type.
   */
  private sectionLabel(section: Record<string, unknown>): string {
    const content = (section.content ?? {}) as Record<string, unknown>;
    for (const key of ["headline", "heading", "title"]) {
      const v = content[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return String(section.type ?? "section");
  }

  /**
   * Remove ONE section from a page, server-side.
   *
   * WHY A ROUTE AND NOT "SEND THE ARRAY BACK WITHOUT IT"
   * ----------------------------------------------------
   * The same reason the menu got /nav routes: a plan is written before any
   * step runs, so "remove the section headed X" cannot be expressed as a
   * filtered array, the caller does not have the array yet. Asked exactly
   * that, the assistant correctly planned only the read and told the user
   * nothing was removed. The filter has to happen where the current sections
   * are in hand: here.
   *
   * Matching is by section id when given, else by heading text
   * (case-insensitive, exact). Zero matches is a 404 that lists what IS on
   * the page; more than one match is a 409 rather than a guess, deleting
   * the wrong section from a live page is not a recoverable style of wrong.
   */
  async removeSection(
    tenantId: string,
    pageId: string,
    match: { sectionId?: string; heading?: string }
  ) {
    if (!match.sectionId && !match.heading) {
      throw new BadRequestError("Say which section: pass section_id or heading.");
    }
    const existing = await pagesRepository.findById(pageId);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new NotFoundError("Page not found");
    }
    const sections = (Array.isArray(existing.sections) ? existing.sections : []) as Array<
      Record<string, unknown>
    >;

    const wanted = (match.heading ?? "").trim().toLowerCase();
    const hits = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) =>
        match.sectionId
          ? String(section.id ?? "") === match.sectionId
          : this.sectionLabel(section).toLowerCase() === wanted
      );

    if (hits.length === 0) {
      throw new NotFoundError(
        `No section matching ${match.sectionId ? `id "${match.sectionId}"` : `"${match.heading}"`}. ` +
          `This page has: ${sections.map((s) => `"${this.sectionLabel(s)}"`).join(", ") || "no sections"}.`
      );
    }
    if (hits.length > 1) {
      throw new ConflictError(
        `${hits.length} sections match "${match.heading}". Pass the section_id of the one you mean.`
      );
    }

    const { section: removed, index } = hits[0]!;
    const remaining = sections.filter((_, i) => i !== index);
    const updated = await pagesRepository.update(pageId, { sections: remaining }, undefined, tenantId);
    if (!updated) throw new NotFoundError("Page not found");

    return {
      removed: { ...removed, label: this.sectionLabel(removed) },
      index,
      sectionsRemaining: remaining.length,
      page: this.mapToPageResponse(updated),
    };
  }

  /**
   * Insert ONE section at a position, server-side, removeSection's inverse,
   * so removing a section is undoable without the caller holding the array.
   */
  async insertSection(
    tenantId: string,
    pageId: string,
    section: Record<string, unknown>,
    index?: number
  ) {
    if (!section || typeof section !== "object" || Array.isArray(section) || !section.type) {
      throw new BadRequestError("section must be a section object with at least a type.");
    }
    const existing = await pagesRepository.findById(pageId);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new NotFoundError("Page not found");
    }
    const sections = (Array.isArray(existing.sections) ? existing.sections : []) as Array<
      Record<string, unknown>
    >;
    const at = index === undefined ? sections.length : Math.max(0, Math.min(index, sections.length));
    const next = [...sections.slice(0, at), section, ...sections.slice(at)];
    const updated = await pagesRepository.update(pageId, { sections: next }, undefined, tenantId);
    if (!updated) throw new NotFoundError("Page not found");
    return {
      inserted: { ...section, label: this.sectionLabel(section) },
      index: at,
      sectionsTotal: next.length,
      page: this.mapToPageResponse(updated),
    };
  }
}

export default new PagesService();
