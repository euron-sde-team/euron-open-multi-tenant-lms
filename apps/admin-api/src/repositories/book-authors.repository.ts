import { ulid } from "ulid";
import { db } from "../db/connection";

/**
 * Get author (instructor) IDs linked to a book (tenant-scoped).
 */
export async function getAuthorIdsByBookId(
  tenantId: string,
  bookId: string
): Promise<string[]> {
  const rows = await db
    .selectFrom("book_authors")
    .select("instructor_id")
    .where("tenant_id", "=", tenantId)
    .where("book_id", "=", bookId)
    .orderBy("sort_order", "asc")
    .execute();
  return rows.map((r) => r.instructor_id);
}

/**
 * Get author (instructor) IDs for multiple books in one query (tenant-scoped).
 * Returns a map of bookId -> instructor_id[].
 */
export async function getAuthorIdsByBookIds(
  tenantId: string,
  bookIds: string[]
): Promise<Map<string, string[]>> {
  if (bookIds.length === 0) return new Map();
  const rows = await db
    .selectFrom("book_authors")
    .select(["book_id", "instructor_id"])
    .where("tenant_id", "=", tenantId)
    .where("book_id", "in", bookIds)
    .orderBy("book_id", "asc")
    .orderBy("sort_order", "asc")
    .execute();
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.book_id) ?? [];
    list.push(r.instructor_id);
    map.set(r.book_id, list);
  }
  return map;
}

/**
 * Replace all author (instructor) associations for a book.
 * Only inserts instructor IDs that exist in the instructors table for this tenant.
 */
export async function setBookAuthors(
  tenantId: string,
  bookId: string,
  authorIds: string[]
): Promise<void> {
  const uniqueIds = [...new Set(authorIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    await db
      .deleteFrom("book_authors")
      .where("tenant_id", "=", tenantId)
      .where("book_id", "=", bookId)
      .execute();
    return;
  }

  const existing = await db
    .selectFrom("instructors")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("id", "in", uniqueIds)
    .execute();
  const validIds = new Set(existing.map((r) => r.id));

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("book_authors")
      .where("tenant_id", "=", tenantId)
      .where("book_id", "=", bookId)
      .execute();

    let sortOrder = 0;
    for (const instructorId of uniqueIds) {
      if (!validIds.has(instructorId)) continue;
      await trx
        .insertInto("book_authors")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          book_id: bookId,
          instructor_id: instructorId,
          sort_order: sortOrder++,
        })
        .execute();
    }
  });
}
