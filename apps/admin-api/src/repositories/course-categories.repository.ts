import { ulid } from "ulid";
import { db } from "../db/connection";

/**
 * Get category IDs linked to a course (tenant-scoped).
 */
export async function getCategoryIdsByCourseId(
  tenantId: string,
  courseId: string
): Promise<string[]> {
  const rows = await db
    .selectFrom("course_categories")
    .select("category_id")
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .orderBy("category_id", "asc")
    .execute();
  return rows.map((r) => r.category_id);
}

/**
 * Get category IDs for multiple courses in one query (tenant-scoped).
 * Returns a map of courseId -> category_id[].
 */
export async function getCategoryIdsByCourseIds(
  tenantId: string,
  courseIds: string[]
): Promise<Map<string, string[]>> {
  if (courseIds.length === 0) return new Map();
  const rows = await db
    .selectFrom("course_categories")
    .select(["course_id", "category_id"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "in", courseIds)
    .orderBy("course_id", "asc")
    .orderBy("category_id", "asc")
    .execute();
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.course_id) ?? [];
    list.push(r.category_id);
    map.set(r.course_id, list);
  }
  return map;
}

/**
 * Replace all category associations for a course.
 * Only inserts category IDs that exist in the categories table for this tenant
 * (invalid/legacy IDs like "cat-1" are skipped to avoid FK violations).
 */
export async function setCourseCategories(
  tenantId: string,
  courseId: string,
  categoryIds: string[]
): Promise<void> {
  const uniqueIds = [...new Set(categoryIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    await db
      .deleteFrom("course_categories")
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
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
      .deleteFrom("course_categories")
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
      .execute();

    for (const categoryId of uniqueIds) {
      if (!validIds.has(categoryId)) continue;
      await trx
        .insertInto("course_categories")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          course_id: courseId,
          category_id: categoryId,
        })
        .execute();
    }
  });
}
