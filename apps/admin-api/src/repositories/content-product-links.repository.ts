import { ulid } from "ulid";
import { db } from "../db/connection";
import type { LinkableContentType } from "../types/content-product-link.type";

interface LinkedProductDetails {
  link_id: string;
  product_code: string;
  product_title: string | null;
  constraint_type: string;
  unit: string | null;
  usage_scope: string;
  usage_window: string;
  feature_key: string;
  feature_name: string | null;
  is_active: boolean;
}

/**
 * Returns the content FK column and value for a given content type.
 */
function contentColumn(contentType: LinkableContentType): "course_id" | "book_id" | "bundle_id" {
  switch (contentType) {
    case "COURSE":
      return "course_id";
    case "BOOK":
      return "book_id";
    case "BUNDLE":
      return "bundle_id";
  }
}

class ContentProductLinksRepository {
  /**
   * Get linked products for a specific content item, with product + feature metadata.
   */
  async getByContent(
    tenantId: string,
    contentType: LinkableContentType,
    contentId: string
  ): Promise<LinkedProductDetails[]> {
    const col = contentColumn(contentType);

    const rows = await db
      .selectFrom("content_product_links")
      .innerJoin("products", "products.id", "content_product_links.product_id")
      .innerJoin("features", "features.id", "products.feature_id")
      .select([
        "content_product_links.id as link_id",
        "products.code as product_code",
        "products.title as product_title",
        "products.constraint_type",
        "products.unit",
        "products.usage_scope",
        "products.usage_window",
        "features.key as feature_key",
        "features.name as feature_name",
        "content_product_links.is_active",
      ])
      .where("content_product_links.tenant_id", "=", tenantId)
      .where(`content_product_links.${col}`, "=", contentId)
      .where("content_product_links.content_type", "=", contentType)
      .orderBy("features.key", "asc")
      .orderBy("products.code", "asc")
      .execute();

    return rows.map((r) => ({
      link_id: r.link_id,
      product_code: r.product_code,
      product_title: r.product_title,
      constraint_type: r.constraint_type as string,
      unit: r.unit,
      usage_scope: r.usage_scope as string,
      usage_window: r.usage_window as string,
      feature_key: r.feature_key,
      feature_name: r.feature_name,
      is_active: r.is_active as boolean,
    }));
  }

  /**
   * Batch query: get linked product codes for multiple content IDs.
   * Returns Map<contentId, product_code[]>.
   */
  async getByContentIds(
    tenantId: string,
    contentType: LinkableContentType,
    contentIds: string[]
  ): Promise<Map<string, string[]>> {
    if (contentIds.length === 0) return new Map();

    const col = contentColumn(contentType);

    const rows = await db
      .selectFrom("content_product_links")
      .select([`content_product_links.${col} as content_id`, "content_product_links.product_code"])
      .where("content_product_links.tenant_id", "=", tenantId)
      .where(`content_product_links.${col}`, "in", contentIds)
      .where("content_product_links.content_type", "=", contentType)
      .where("content_product_links.is_active", "=", true)
      .execute();

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const cid = row.content_id as string;
      if (!cid) continue;
      const existing = map.get(cid) ?? [];
      existing.push(row.product_code);
      map.set(cid, existing);
    }
    return map;
  }

  /**
   * Replace-all: atomically delete old links and insert new ones for a content item.
   * Follows the setCourseCategories pattern (delete + insert in transaction).
   */
  async setForContent(
    tenantId: string,
    contentType: LinkableContentType,
    contentId: string,
    entries: { product_id: string; product_code: string }[]
  ): Promise<void> {
    const col = contentColumn(contentType);
    const uniqueEntries = this.deduplicateEntries(entries);

    await db.transaction().execute(async (trx) => {
      // Delete all existing links for this content item
      await trx
        .deleteFrom("content_product_links")
        .where("tenant_id", "=", tenantId)
        .where(col, "=", contentId)
        .where("content_type", "=", contentType)
        .execute();

      // Insert new links
      for (const entry of uniqueEntries) {
        await trx
          .insertInto("content_product_links")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            product_id: entry.product_id,
            product_code: entry.product_code,
            content_type: contentType,
            [col]: contentId,
            is_active: true,
            updated_at: new Date(),
          })
          .execute();
      }
    });
  }

  /**
   * Deduplicate entries by product_code (keep first occurrence).
   */
  private deduplicateEntries(
    entries: { product_id: string; product_code: string }[]
  ): { product_id: string; product_code: string }[] {
    const seen = new Set<string>();
    return entries.filter((e) => {
      if (seen.has(e.product_code)) return false;
      seen.add(e.product_code);
      return true;
    });
  }
}

export default new ContentProductLinksRepository();
