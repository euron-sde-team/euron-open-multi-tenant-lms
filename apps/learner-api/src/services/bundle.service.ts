/** @format */

import { sql } from "kysely";
import { db } from "../db/connection";
import { enrollment_status, test_series_enrollment_status } from "../db/enums";
import { UnauthorizedError } from "../errors/unauthorized.error";
import { NotFoundError } from "../errors/not-found.error";
import * as bookmarkService from "./bookmark.service";
import bundlesRepository from "../repositories/bundles.repository";
import userSubscriptionService from "./user-subscription.service";
import { getPriceMapsForEntities } from "../utils/price-resolver";

/**
 * Get a published bundle by slug for the given tenant.
 * When memberId is provided, checks whether the user already owns
 * ALL items in the bundle (every course enrolled + every book accessed).
 */
export async function getBundleBySlug(
  tenantId: string,
  slug: string,
  memberId?: string
) {
  let bundle = await bundlesRepository.findPublishedByTenantAndSlug(
    tenantId,
    slug
  );
  let isArchived = false;

  if (!bundle && memberId) {
    // Try including ARCHIVED, only serve if user owns all items
    bundle = await bundlesRepository.findPublishedByTenantAndSlug(
      tenantId,
      slug,
      { allowArchived: true }
    );
    if (bundle) {
      // Verify ownership of all items before serving archived bundle
      const hasAll = await checkBundleOwnership(
        tenantId,
        memberId,
        bundle.items
      );
      if (!hasAll) {
        throw new NotFoundError("Published bundle not found for this slug");
      }
      isArchived = true;
    }
  }

  if (!bundle) {
    throw new NotFoundError("Published bundle not found for this slug");
  }

  let hasAccess = false;
  if (isArchived) {
    hasAccess = true; // Already verified above
  } else if (memberId) {
    // Subscribers have access to all content (courses + books in bundle)
    hasAccess = await userSubscriptionService.hasActiveSubscription(
      tenantId,
      memberId
    );
    if (!hasAccess && bundle.items.length > 0) {
      hasAccess = await checkBundleOwnership(tenantId, memberId, bundle.items);
    }
    // Fallback: check if user purchased this specific bundle (via source_bundle_id)
    if (!hasAccess) {
      hasAccess = await checkBundlePurchase(tenantId, memberId, bundle.id);
    }
  }

  // Content-product-link gating removed, linked_products no longer displayed
  // const linkedProducts = await bundlesRepository.findLinkedProducts(tenantId, bundle.id);

  // Per-currency price map (additive alongside legacy priceInr/priceUsd fields)
  const priceMaps = await getPriceMapsForEntities(tenantId, "BUNDLE", [
    {
      id: bundle.id,
      price_inr: bundle.priceInr,
      price_usd: bundle.priceUsd,
      discount_inr: bundle.discountInr,
      discount_usd: bundle.discountUsd,
    },
  ]);

  return {
    ...bundle,
    prices: priceMaps.get(bundle.id) ?? {},
    has_access: hasAccess,
    is_archived: isArchived,
  };
}

/** Check if member owns all items in a bundle. */
async function checkBundleOwnership(
  tenantId: string,
  memberId: string,
  items: {
    itemType: string;
    courseId: string | null;
    bookId: string | null;
    testSeriesId: string | null;
  }[]
): Promise<boolean> {
  const courseIds = items
    .filter((i) => i.itemType === "COURSE" && i.courseId)
    .map((i) => i.courseId!);
  const bookIds = items
    .filter((i) => i.itemType === "BOOK" && i.bookId)
    .map((i) => i.bookId!);
  const testSeriesIds = items
    .filter((i) => i.itemType === "TEST_SERIES" && i.testSeriesId)
    .map((i) => i.testSeriesId!);

  let ownedCourses = 0;
  let ownedBooks = 0;
  let ownedTestSeries = 0;

  if (courseIds.length > 0) {
    const rows = await db
      .selectFrom("enrollments")
      .select("course_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("course_id", "in", courseIds)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .execute();
    ownedCourses = rows.length;
  }

  if (bookIds.length > 0) {
    const rows = await db
      .selectFrom("book_access")
      .select("book_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("book_id", "in", bookIds)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .execute();
    ownedBooks = rows.length;
  }

  if (testSeriesIds.length > 0) {
    const rows = await db
      .selectFrom("test_series_enrollments")
      .select("test_series_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("test_series_id", "in", testSeriesIds)
      .where("status", "=", test_series_enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .execute();
    ownedTestSeries = rows.length;
  }

  return (
    ownedCourses === courseIds.length &&
    ownedBooks === bookIds.length &&
    ownedTestSeries === testSeriesIds.length
  );
}

/** Check if member purchased this specific bundle (has any enrollment with source_bundle_id). */
async function checkBundlePurchase(
  tenantId: string,
  memberId: string,
  bundleId: string
): Promise<boolean> {
  const row = await db
    .selectFrom("enrollments")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("source_bundle_id", "=", bundleId)
    .where("status", "=", enrollment_status.ACTIVE)
    .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
    .limit(1)
    .executeTakeFirst();

  if (row) return true;

  const bookRow = await db
    .selectFrom("book_access")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("source_bundle_id", "=", bundleId)
    .where("status", "=", enrollment_status.ACTIVE)
    .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
    .limit(1)
    .executeTakeFirst();

  return !!bookRow;
}

/**
 * List published bundles for a tenant with pagination.
 * Used for the bundles listing page on the web app.
 */
export async function listPublishedBundles(
  tenantId: string,
  options?: {
    page?: number;
    limit?: number;
    sortBy?: "created_at" | "title" | "sort_order";
    sortOrder?: "asc" | "desc";
    bookmarkedOnly?: boolean;
  },
  memberId?: string
) {
  if (options?.bookmarkedOnly && !memberId) {
    throw new UnauthorizedError(
      "Authentication required to filter by bookmarks"
    );
  }

  const repoOptions = {
    ...options,
    bookmarkedOnly: options?.bookmarkedOnly,
    memberId: options?.bookmarkedOnly ? memberId : undefined,
  };
  const result = await bundlesRepository.findPublishedBundles(
    tenantId,
    repoOptions
  );

  // Per-currency price maps (additive alongside legacy priceInr/priceUsd fields)
  const priceMaps = await getPriceMapsForEntities(
    tenantId,
    "BUNDLE",
    result.bundles.map((b) => ({
      id: b.id,
      price_inr: b.priceInr,
      price_usd: b.priceUsd,
      discount_inr: b.discountInr,
      discount_usd: b.discountUsd,
    }))
  );

  let bookmarkIds = new Set<string>();
  if (memberId && result.bundles.length > 0) {
    const ids = await bookmarkService.getBookmarkIds(tenantId, memberId);
    bookmarkIds = new Set(ids.bundleIds);
  }

  // Determine has_access for each bundle
  const accessMap = new Map<string, boolean>();
  if (memberId && result.bundles.length > 0) {
    const isSubscriber = await userSubscriptionService.hasActiveSubscription(
      tenantId,
      memberId
    );
    if (isSubscriber) {
      // Subscribers have access to all bundles
      for (const b of result.bundles) {
        accessMap.set(b.id, true);
      }
    } else {
      // Non-subscriber: check ownership of all items per bundle
      const bundleIds = result.bundles.map((b) => b.id);
      const allItems = await db
        .selectFrom("bundle_items")
        .select(["bundle_id", "item_type", "course_id", "book_id", "test_series_id"])
        .where("tenant_id", "=", tenantId)
        .where("bundle_id", "in", bundleIds)
        .execute();

      // Group items by bundle
      const itemsByBundle = new Map<string, typeof allItems>();
      for (const item of allItems) {
        const list = itemsByBundle.get(item.bundle_id) || [];
        list.push(item);
        itemsByBundle.set(item.bundle_id, list);
      }

      // Collect all unique course/book/test series IDs across all bundles
      const allCourseIds = new Set<string>();
      const allBookIds = new Set<string>();
      const allTestSeriesIds = new Set<string>();
      for (const item of allItems) {
        if (String(item.item_type) === "COURSE" && item.course_id)
          allCourseIds.add(item.course_id);
        if (String(item.item_type) === "BOOK" && item.book_id)
          allBookIds.add(item.book_id);
        if (String(item.item_type) === "TEST_SERIES" && item.test_series_id)
          allTestSeriesIds.add(item.test_series_id);
      }

      // Batch query enrollments, book_access and test_series_enrollments
      const ownedCourseIds = new Set<string>();
      const ownedBookIds = new Set<string>();
      const ownedTestSeriesIds = new Set<string>();

      if (allCourseIds.size > 0) {
        const rows = await db
          .selectFrom("enrollments")
          .select("course_id")
          .where("tenant_id", "=", tenantId)
          .where("tenant_member_id", "=", memberId)
          .where("course_id", "in", [...allCourseIds])
          .where("status", "=", enrollment_status.ACTIVE)
          .where(
            sql<boolean>`(valid_till is null or valid_till > ${new Date()})`
          )
          .execute();
        for (const r of rows) ownedCourseIds.add(r.course_id);
      }

      if (allBookIds.size > 0) {
        const rows = await db
          .selectFrom("book_access")
          .select("book_id")
          .where("tenant_id", "=", tenantId)
          .where("tenant_member_id", "=", memberId)
          .where("book_id", "in", [...allBookIds])
          .where("status", "=", enrollment_status.ACTIVE)
          .where(
            sql<boolean>`(valid_till is null or valid_till > ${new Date()})`
          )
          .execute();
        for (const r of rows) ownedBookIds.add(r.book_id);
      }

      if (allTestSeriesIds.size > 0) {
        const rows = await db
          .selectFrom("test_series_enrollments")
          .select("test_series_id")
          .where("tenant_id", "=", tenantId)
          .where("tenant_member_id", "=", memberId)
          .where("test_series_id", "in", [...allTestSeriesIds])
          .where("status", "=", test_series_enrollment_status.ACTIVE)
          .where(
            sql<boolean>`(valid_till is null or valid_till > ${new Date()})`
          )
          .execute();
        for (const r of rows) ownedTestSeriesIds.add(r.test_series_id);
      }

      // Per bundle: has_access = true only if user owns ALL items
      for (const b of result.bundles) {
        const items = itemsByBundle.get(b.id) || [];
        if (items.length === 0) {
          accessMap.set(b.id, false);
          continue;
        }
        const ownsAll = items.every((item) => {
          if (String(item.item_type) === "COURSE" && item.course_id)
            return ownedCourseIds.has(item.course_id);
          if (String(item.item_type) === "BOOK" && item.book_id)
            return ownedBookIds.has(item.book_id);
          if (String(item.item_type) === "TEST_SERIES" && item.test_series_id)
            return ownedTestSeriesIds.has(item.test_series_id);
          return false;
        });
        accessMap.set(b.id, ownsAll);
      }
    }
  }

  return {
    ...result,
    bundles: result.bundles.map((b) => ({
      ...b,
      prices: priceMaps.get(b.id) ?? {},
      is_bookmarked: memberId ? bookmarkIds.has(b.id) : false,
      has_access: memberId ? accessMap.get(b.id) ?? false : false,
    })),
  };
}
