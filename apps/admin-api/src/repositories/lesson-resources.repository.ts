import { Transaction } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";
import type { DB, lesson_resources } from "../db/types";
import type { lesson_resource_type } from "../db/enums";

type Trx = Transaction<DB>;

export type LessonResourceRow = lesson_resources;

export interface CreateLessonResourceInput {
  tenant_id: string;
  course_id: string;
  lesson_id: string;
  type: lesson_resource_type;
  title: string;
  url?: string | null;
  content?: string | null;
  downloadable?: boolean;
  sort_order?: number;
}

export interface UpdateLessonResourceInput {
  title?: string;
  url?: string | null;
  content?: string | null;
  downloadable?: boolean;
  sort_order?: number;
}

export async function findResourcesByLessonId(
  tenantId: string,
  lessonId: string,
  trx?: Trx
): Promise<LessonResourceRow[]> {
  const rows = await (trx || db)
    .selectFrom("lesson_resources")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("lesson_id", "=", lessonId)
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();
  return rows as unknown as LessonResourceRow[];
}

export async function findResourceById(
  resourceId: string,
  tenantId: string,
  trx?: Trx
): Promise<LessonResourceRow | null> {
  const row = await (trx || db)
    .selectFrom("lesson_resources")
    .selectAll()
    .where("id", "=", resourceId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return (row as unknown as LessonResourceRow) ?? null;
}

/**
 * Highest sort_order among a lesson's existing resources, or -1 if none.
 * Used to append new resources after the current ones when the caller
 * doesn't specify an explicit sort_order.
 */
export async function getMaxResourceSortOrder(
  tenantId: string,
  lessonId: string,
  trx?: Trx
): Promise<number> {
  const r = await (trx || db)
    .selectFrom("lesson_resources")
    .select(({ fn }) => fn.max<number | null>("sort_order").as("max_sort"))
    .where("tenant_id", "=", tenantId)
    .where("lesson_id", "=", lessonId)
    .executeTakeFirst();
  const max = r?.max_sort;
  return max == null ? -1 : Number(max);
}

export async function createLessonResource(
  data: CreateLessonResourceInput,
  trx?: Trx
): Promise<LessonResourceRow> {
  const id = ulid();
  const now = new Date();
  const sortOrder =
    data.sort_order ??
    (await getMaxResourceSortOrder(data.tenant_id, data.lesson_id, trx)) + 1;
  const row = await (trx || db)
    .insertInto("lesson_resources")
    .values({
      id,
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      lesson_id: data.lesson_id,
      type: data.type,
      title: data.title,
      url: data.url ?? null,
      content: data.content ?? null,
      downloadable: data.downloadable ?? false,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as LessonResourceRow;
}

export async function updateLessonResource(
  resourceId: string,
  tenantId: string,
  data: UpdateLessonResourceInput,
  trx?: Trx
): Promise<LessonResourceRow | null> {
  const updateData: Record<string, unknown> = { updated_at: new Date() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.url !== undefined) updateData.url = data.url;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.downloadable !== undefined) updateData.downloadable = data.downloadable;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
  const row = await (trx || db)
    .updateTable("lesson_resources")
    .set(updateData)
    .where("id", "=", resourceId)
    .where("tenant_id", "=", tenantId)
    .returningAll()
    .executeTakeFirst();
  return (row as unknown as LessonResourceRow) ?? null;
}

export async function deleteLessonResource(
  resourceId: string,
  tenantId: string,
  trx?: Trx
): Promise<boolean> {
  const result = await (trx || db)
    .deleteFrom("lesson_resources")
    .where("id", "=", resourceId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}
