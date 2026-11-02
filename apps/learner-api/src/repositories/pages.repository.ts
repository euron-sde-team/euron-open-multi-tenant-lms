import { db } from "../db/connection";

export interface PageConfigResponse {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  sections: unknown;
  theme: unknown;
  seo: unknown;
  isPublished: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Custom-code pages (optional, absent/undefined means a normal SECTIONS page,
  // so the synthetic page builders for roadmaps/books/webinars need not set them).
  renderMode?: "SECTIONS" | "CUSTOM_CODE";
  customCodeKind?: "SANITIZED_INLINE" | "SANDBOXED_IFRAME" | null;
  /** Published HTML served to visitors (never the draft). */
  customHtml?: string | null;
  moderationStatus?: "ACTIVE" | "BLOCKED";
}

class PagesRepository {
  /**
   * Find published page by tenant ID and slug (for public endpoint)
   */
  async findPublishedByTenantAndSlug(
    tenantId: string,
    slug: string
  ): Promise<PageConfigResponse | undefined> {
    const result = await db
      .selectFrom("tenant_pages")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .where("is_published", "=", true)
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToPageConfig(result);
  }

  private mapToPageConfig(result: Record<string, unknown>): PageConfigResponse {
    return {
      id: result.id as string,
      tenantId: result.tenant_id as string,
      slug: result.slug as string,
      title: result.title as string,
      sections: typeof result.sections === "string"
        ? JSON.parse(result.sections as string)
        : result.sections,
      theme: typeof result.theme === "string"
        ? JSON.parse(result.theme as string)
        : result.theme,
      seo: typeof result.seo === "string"
        ? JSON.parse(result.seo as string)
        : result.seo,
      isPublished: result.is_published as boolean,
      createdAt: new Date(result.created_at as string).toISOString(),
      updatedAt: new Date(result.updated_at as string).toISOString(),
      renderMode:
        (result.render_mode as "SECTIONS" | "CUSTOM_CODE") ?? "SECTIONS",
      customCodeKind:
        (result.custom_code_kind as
          | "SANITIZED_INLINE"
          | "SANDBOXED_IFRAME"
          | null) ?? null,
      customHtml: (result.custom_html as string | null) ?? null,
      moderationStatus:
        (result.moderation_status as "ACTIVE" | "BLOCKED") ?? "ACTIVE",
    };
  }
}

export default new PagesRepository();
