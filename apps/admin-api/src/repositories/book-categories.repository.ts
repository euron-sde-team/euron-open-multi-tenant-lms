import { ulid } from "ulid";
import { db } from "../db/connection";

/**
 * Get category IDs linked to a book (tenant-scoped).
 */
export async function getCategoryIdsByBookId(
  tenantId: string,
  bookId: string
): Promise<string[]> {
  const rows = await db
    .selectFrom("book_categories")
    .select("category_id")
    .where("tenant_id", "=", tenantId)
    .where("book_id", "=", bookId)
    .orderBy("category_id", "asc")
    .execute();
  return rows.map((r) => r.category_id);
}

/**
 * Get category IDs for multiple books in one query (tenant-scoped).
 * Returns a map of bookId -> category_id[].
 */
export async function getCategoryIdsByBookIds(
  tenantId: string,
  bookIds: string[]
): Promise<Map<string, string[]>> {
  if (bookIds.length === 0) return new Map();
  const rows = await db
    .selectFrom("book_categories")
    .select(["book_id", "category_id"])
    .where("tenant_id", "=", tenantId)
    .where("book_id", "in", bookIds)
    .orderBy("book_id", "asc")
    .orderBy("category_id", "asc")
    .execute();
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.book_id) ?? [];
    list.push(r.category_id);
    map.set(r.book_id, list);
  }
  return map;
}

/**
 * Replace all category associations for a book.
 * Only inserts category IDs that exist in the categories table for this tenant
 * (invalid/legacy IDs are skipped to avoid FK violations).
 */
export async function setBookCategories(
  tenantId: string,
  bookId: string,
  categoryIds: string[]
): Promise<void> {
  const uniqueIds = [...new Set(categoryIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    await db
      .deleteFrom("book_categories")
      .where("tenant_id", "=", tenantId)
      .where("book_id", "=", bookId)
      .execute();
    return;
  }

  const existing = await db
    .selectFrom("categories")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("id", "in", uniqueIds)
    .where("is_active", "=", true)
    .execute();
  const validIds = new Set(existing.map((r) => r.id));

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("book_categories")
      .where("tenant_id", "=", tenantId)
      .where("book_id", "=", bookId)
      .execute();

    for (const categoryId of uniqueIds) {
      if (!validIds.has(categoryId)) continue;
      await trx
        .insertInto("book_categories")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          book_id: bookId,
          category_id: categoryId,
        })
        .execute();
    }
  });
}
