/**
 * Repository for member bookmarks (courses, books, bundles).
 * All queries are tenant-scoped and member-scoped.
 */

import { db } from "../db/connection";
import { bookmark_type } from "../db/enums";
import type { bookmark_type as BookmarkType } from "../db/enums";
import { ulid } from "ulid";

export interface BookmarkIds {
  courseIds: string[];
  bookIds: string[];
  bundleIds: string[];
}

/** Find all bookmark IDs for a member, grouped by type. */
export async function findByMember(
  tenantId: string,
  memberId: string
): Promise<BookmarkIds> {
  const rows = await db
    .selectFrom("member_bookmarks")
    .select(["bookmark_type", "course_id", "book_id", "bundle_id"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .execute();

  const courseIds: string[] = [];
  const bookIds: string[] = [];
  const bundleIds: string[] = [];

  for (const row of rows) {
    if (row.course_id) courseIds.push(row.course_id);
    if (row.book_id) bookIds.push(row.book_id);
    if (row.bundle_id) bundleIds.push(row.bundle_id);
  }

  return { courseIds, bookIds, bundleIds };
}

/** Check if a bookmark exists. */
export async function exists(
  tenantId: string,
  memberId: string,
  type: BookmarkType,
  itemId: string
): Promise<boolean> {
  let q = db
    .selectFrom("member_bookmarks")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId);

  if (type === bookmark_type.COURSE) {
    q = q.where("course_id", "=", itemId) as typeof q;
  } else if (type === bookmark_type.BOOK) {
    q = q.where("book_id", "=", itemId) as typeof q;
  } else {
    q = q.where("bundle_id", "=", itemId) as typeof q;
  }

  const row = await q.executeTakeFirst();
  return !!row;
}

/** Add a bookmark. Idempotent: if exists, returns without error. */
export async function add(
  tenantId: string,
  memberId: string,
  type: BookmarkType,
  itemId: string
): Promise<void> {
  const now = new Date();
  const id = ulid();

  const courseId = type === bookmark_type.COURSE ? itemId : null;
  const bookId = type === bookmark_type.BOOK ? itemId : null;
  const bundleId = type === bookmark_type.BUNDLE ? itemId : null;

  const existing = await exists(tenantId, memberId, type, itemId);
  if (existing) return;

  await db
    .insertInto("member_bookmarks")
    .values({
      id,
      tenant_id: tenantId,
      tenant_member_id: memberId,
      bookmark_type: type,
      course_id: courseId,
      book_id: bookId,
      bundle_id: bundleId,
      updated_at: now,
    })
    .execute();
}

/** Remove a bookmark. Idempotent: if not exists, returns without error. */
export async function remove(
  tenantId: string,
  memberId: string,
  type: BookmarkType,
  itemId: string
): Promise<void> {
  let q = db
    .deleteFrom("member_bookmarks")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId);

  if (type === bookmark_type.COURSE) {
    q = q.where("course_id", "=", itemId) as typeof q;
  } else if (type === bookmark_type.BOOK) {
    q = q.where("book_id", "=", itemId) as typeof q;
  } else {
    q = q.where("bundle_id", "=", itemId) as typeof q;
  }

  await q.execute();
}
