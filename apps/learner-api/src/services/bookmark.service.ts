/**
 * Bookmark service, add/remove/list bookmarks for courses, books, bundles.
 * All operations require tenant_id and tenant_member_id.
 */

import config from "../config";
import { db } from "../db/connection";
import { book_status, bookmark_type, bundle_status } from "../db/enums";
import type { bookmark_type as BookmarkType } from "../db/enums";
import { NotFoundError } from "../errors/not-found.error";
import * as bookmarksRepo from "../repositories/bookmarks.repository";

/** Validate that a published course exists. */
async function validateCourseExists(tenantId: string, courseId: string): Promise<void> {
  const row = await db
    .selectFrom("courses")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", courseId)
    .where("status", "=", "PUBLISHED")
    .executeTakeFirst();
  if (!row) throw new NotFoundError("Course not found");
}

/** Validate that a published book exists. */
async function validateBookExists(tenantId: string, bookId: string): Promise<void> {
  const row = await db
    .selectFrom("books")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", bookId)
    .where("status", "=", book_status.PUBLISHED)
    .executeTakeFirst();
  if (!row) throw new NotFoundError("Book not found");
}

/** Validate that a published bundle exists. */
async function validateBundleExists(tenantId: string, bundleId: string): Promise<void> {
  const row = await db
    .selectFrom("bundles")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", bundleId)
    .where("status", "=", bundle_status.PUBLISHED)
    .executeTakeFirst();
  if (!row) throw new NotFoundError("Bundle not found");
}

function validateItemExists(
  tenantId: string,
  type: BookmarkType,
  itemId: string
): Promise<void> {
  if (type === bookmark_type.COURSE) return validateCourseExists(tenantId, itemId);
  if (type === bookmark_type.BOOK) return validateBookExists(tenantId, itemId);
  return validateBundleExists(tenantId, itemId);
}

/** Add a bookmark. Validates item exists and is published. Idempotent. */
export async function addBookmark(
  tenantId: string,
  memberId: string,
  type: BookmarkType,
  itemId: string
): Promise<void> {
  await validateItemExists(tenantId, type, itemId);
  await bookmarksRepo.add(tenantId, memberId, type, itemId);
}

/** Remove a bookmark. Idempotent. */
export async function removeBookmark(
  tenantId: string,
  memberId: string,
  type: BookmarkType,
  itemId: string
): Promise<void> {
  await bookmarksRepo.remove(tenantId, memberId, type, itemId);
}

/** Get all bookmark IDs for a member, grouped by type. */
export async function getBookmarkIds(
  tenantId: string,
  memberId: string
): Promise<{ courseIds: string[]; bookIds: string[]; bundleIds: string[] }> {
  return bookmarksRepo.findByMember(tenantId, memberId);
}

/** Bookmark list item for API response. */
export interface BookmarkListItem {
  productId: string;
  productType: "course" | "book" | "bundle";
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  subtitle?: string | null;
}

/** List all bookmarks with full item metadata for the bookmark page. */
export async function listBookmarks(
  tenantId: string,
  memberId: string
): Promise<{ courses: BookmarkListItem[]; books: BookmarkListItem[]; bundles: BookmarkListItem[] }> {
  const { courseIds, bookIds, bundleIds } = await bookmarksRepo.findByMember(
    tenantId,
    memberId
  );

  const thumbnailBase = config.THUMBNAILS_BASE_URL ?? "";

  const resolveThumbnail = (key: string | null): string | null => {
    if (!key?.trim()) return null;
    const k = key.trim();
    if (k.startsWith("http://") || k.startsWith("https://") || k.startsWith("data:"))
      return k;
    if (thumbnailBase) {
      const path = k.startsWith("/") ? k.slice(1) : k;
      return `${thumbnailBase}/${path}`;
    }
    return k;
  };

  const courses: BookmarkListItem[] = [];
  if (courseIds.length > 0) {
    const rows = await db
      .selectFrom("courses")
      .select(["id", "title", "slug", "subtitle", "thumbnail_key"])
      .where("tenant_id", "=", tenantId)
      .where("id", "in", courseIds)
      .where("status", "in", ["PUBLISHED", "ARCHIVED"])
      .execute();
    for (const r of rows) {
      courses.push({
        productId: r.id,
        productType: "course",
        title: r.title,
        slug: r.slug,
        thumbnailUrl: resolveThumbnail(r.thumbnail_key),
        subtitle: r.subtitle,
      });
    }
  }

  const books: BookmarkListItem[] = [];
  if (bookIds.length > 0) {
    const rows = await db
      .selectFrom("books")
      .select(["id", "title", "slug", "thumbnail_url"])
      .where("tenant_id", "=", tenantId)
      .where("id", "in", bookIds)
      .where("status", "in", [book_status.PUBLISHED, book_status.ARCHIVED])
      .execute();
    for (const r of rows) {
      const thumb = r.thumbnail_url?.trim();
      books.push({
        productId: r.id,
        productType: "book",
        title: r.title,
        slug: r.slug,
        thumbnailUrl:
          thumb && (thumb.startsWith("http") || thumb.startsWith("data:"))
            ? thumb
            : thumb && thumbnailBase
              ? `${thumbnailBase}/${thumb.startsWith("/") ? thumb.slice(1) : thumb}`
              : null,
        subtitle: null,
      });
    }
  }

  const bundles: BookmarkListItem[] = [];
  if (bundleIds.length > 0) {
    const rows = await db
      .selectFrom("bundles")
      .select(["id", "title", "slug", "subtitle", "thumbnail_url"])
      .where("tenant_id", "=", tenantId)
      .where("id", "in", bundleIds)
      .where("status", "in", [bundle_status.PUBLISHED, bundle_status.ARCHIVED])
      .execute();
    for (const r of rows) {
      const thumb = r.thumbnail_url?.trim();
      bundles.push({
        productId: r.id,
        productType: "bundle",
        title: r.title,
        slug: r.slug,
        thumbnailUrl:
          thumb && (thumb.startsWith("http") || thumb.startsWith("data:"))
            ? thumb
            : thumb && thumbnailBase
              ? `${thumbnailBase}/${thumb.startsWith("/") ? thumb.slice(1) : thumb}`
              : null,
        subtitle: r.subtitle,
      });
    }
  }

  return { courses, books, bundles };
}
