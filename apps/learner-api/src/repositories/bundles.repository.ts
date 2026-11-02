import config from "../config";
import { db } from "../db/connection";
import { bundle_status } from "../db/enums";

function resolveThumbnailUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:")) return v;
  const base = config.THUMBNAILS_BASE_URL;
  if (!base) return v;
  const key = v.startsWith("/") ? v.slice(1) : v;
  return `${base}/${key}`;
}

export interface PublishedBundleItem {
  id: string;
  itemType: "COURSE" | "BOOK" | "TEST_SERIES";
  courseId: string | null;
  bookId: string | null;
  testSeriesId: string | null;
  sortOrder: number;
  courseTitle: string | null;
  courseSlug: string | null;
  courseSubtitle: string | null;
  courseThumbnailKey: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
  bookPages: number | null;
  bookThumbnailUrl: string | null;
  testSeriesTitle: string | null;
  testSeriesSlug: string | null;
  testSeriesCoverImageKey: string | null;
}

export interface PublishedBundleListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  itemCount: number;
  sortOrder: number;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
  /** When true, only return bundles the member has bookmarked. Requires memberId. */
  bookmarkedOnly?: boolean;
  /** When true, include ARCHIVED bundles alongside PUBLISHED. */
  allowArchived?: boolean;
  memberId?: string;
}

export interface PublishedBundlesResult {
  bundles: PublishedBundleListItem[];
  pagination: PaginationMeta;
}

export interface PublishedBundleDetail extends PublishedBundleListItem {
  previewUrl: string | null;
  validityDays: number | null;
  updatedAt: string;
  items: PublishedBundleItem[];
}

class BundlesRepository {
  /**
   * Find a published bundle by slug for the given tenant.
   */
  async findPublishedByTenantAndSlug(
    tenantId: string,
    slug: string,
    options?: { allowArchived?: boolean }
  ): Promise<PublishedBundleDetail | null> {
    const normalizedSlug = slug.startsWith("bundles/")
      ? slug.replace(/^bundles\/?/, "")
      : slug;
    if (!normalizedSlug) return null;

    const statusFilter = options?.allowArchived
      ? [bundle_status.PUBLISHED, bundle_status.ARCHIVED]
      : [bundle_status.PUBLISHED];

    const bundle = await db
      .selectFrom("bundles")
      .select([
        "id",
        "title",
        "slug",
        "subtitle",
        "description",
        "thumbnail_url",
        "preview_url",
        "price_inr",
        "price_usd",
        "discount_inr",
        "discount_usd",
        "purchase_mode",
        "validity_days",
        "sort_order",
        "created_at",
        "updated_at",
      ])
      .where("tenant_id", "=", tenantId)
      .where("status", "in", statusFilter)
      .where("slug", "=", normalizedSlug)
      .executeTakeFirst();

    if (!bundle) return null;

    const itemCountResult = await db
      .selectFrom("bundle_items")
      .select(db.fn.count("id").as("cnt"))
      .where("bundle_id", "=", bundle.id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const itemCount = Number(itemCountResult?.cnt || 0);

    const items = await this.findItemsWithDetailsByBundleId(bundle.id, tenantId);

    return {
      id: bundle.id,
      title: bundle.title,
      slug: bundle.slug,
      subtitle: bundle.subtitle,
      description: bundle.description,
      thumbnailUrl: resolveThumbnailUrl(bundle.thumbnail_url) ?? bundle.thumbnail_url,
      previewUrl: bundle.preview_url,
      priceInr: bundle.price_inr,
      priceUsd: bundle.price_usd,
      discountInr: bundle.discount_inr,
      discountUsd: bundle.discount_usd,
      purchaseMode: String(bundle.purchase_mode ?? "PAID"),
      itemCount,
      sortOrder: bundle.sort_order,
      validityDays: bundle.validity_days,
      createdAt: bundle.created_at.toISOString(),
      updatedAt: bundle.updated_at.toISOString(),
      items,
    };
  }

  /**
   * Get bundle items with course/book details for display.
   */
  /**
   * `tenantId` is required, not optional: every sibling method here scopes by
   * it, and this one didn't, a bundle id from one tenant would have resolved
   * against another's rows. Required so a caller cannot forget it.
   */
  async findItemsWithDetailsByBundleId(
    bundleId: string,
    tenantId: string
  ): Promise<PublishedBundleItem[]> {
    const rows = await db
      .selectFrom("bundle_items")
      .leftJoin("courses", "bundle_items.course_id", "courses.id")
      .leftJoin("books", "bundle_items.book_id", "books.id")
      .leftJoin("test_series", "bundle_items.test_series_id", "test_series.id")
      .select([
        "bundle_items.id",
        "bundle_items.item_type",
        "bundle_items.course_id",
        "bundle_items.book_id",
        "bundle_items.test_series_id",
        "bundle_items.sort_order",
        "courses.title as course_title",
        "courses.slug as course_slug",
        "courses.subtitle as course_subtitle",
        "courses.thumbnail_key as course_thumbnail_key",
        "books.title as book_title",
        "books.slug as book_slug",
        "books.author as book_author",
        "books.pages as book_pages",
        "books.thumbnail_url as book_thumbnail_url",
        "test_series.title as test_series_title",
        "test_series.slug as test_series_slug",
        "test_series.cover_image_key as test_series_cover_image_key",
      ])
      .where("bundle_items.bundle_id", "=", bundleId)
      .where("bundle_items.tenant_id", "=", tenantId)
      .orderBy("bundle_items.sort_order", "asc")
      .execute();

    return rows.map((r) => ({
      id: r.id,
      itemType: String(r.item_type) as "COURSE" | "BOOK" | "TEST_SERIES",
      courseId: r.course_id,
      bookId: r.book_id,
      testSeriesId: r.test_series_id,
      sortOrder: Number(r.sort_order ?? 0),
      courseTitle: r.course_title ?? null,
      courseSlug: r.course_slug ?? null,
      courseSubtitle: (r as Record<string, unknown>).course_subtitle as string | null ?? null,
      courseThumbnailKey: resolveThumbnailUrl(r.course_thumbnail_key) ?? r.course_thumbnail_key ?? null,
      bookTitle: r.book_title ?? null,
      bookSlug: r.book_slug ?? null,
      bookAuthor: (r as Record<string, unknown>).book_author as string | null ?? null,
      bookPages: (r as Record<string, unknown>).book_pages != null ? Number((r as Record<string, unknown>).book_pages) : null,
      bookThumbnailUrl: resolveThumbnailUrl(r.book_thumbnail_url) ?? r.book_thumbnail_url ?? null,
      testSeriesTitle: r.test_series_title ?? null,
      testSeriesSlug: r.test_series_slug ?? null,
      testSeriesCoverImageKey: resolveThumbnailUrl(r.test_series_cover_image_key) ?? r.test_series_cover_image_key ?? null,
    }));
  }
  /**
   * Find published bundles for a tenant with pagination.
   * Returns bundle list items with item count.
   */
  async findPublishedBundles(
    tenantId: string,
    options: PaginationOptions = {}
  ): Promise<PublishedBundlesResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 8));
    const sortBy = options.sortBy || "sort_order";
    const sortOrder = options.sortOrder || "asc";
    const offset = (page - 1) * limit;
    const bookmarkedOnly = options.bookmarkedOnly && options.memberId;
    const statusFilter = options.allowArchived
      ? [bundle_status.PUBLISHED, bundle_status.ARCHIVED]
      : [bundle_status.PUBLISHED];

    let countQuery = db
      .selectFrom("bundles")
      .select(db.fn.count("bundles.id").as("count"))
      .where("bundles.tenant_id", "=", tenantId)
      .where("bundles.status", "in", statusFilter);

    let bundlesQuery = db
      .selectFrom("bundles")
      .select([
        "bundles.id",
        "bundles.title",
        "bundles.slug",
        "bundles.subtitle",
        "bundles.description",
        "bundles.thumbnail_url",
        "bundles.price_inr",
        "bundles.price_usd",
        "bundles.discount_inr",
        "bundles.discount_usd",
        "bundles.purchase_mode",
        "bundles.sort_order",
        "bundles.created_at",
      ])
      .where("bundles.tenant_id", "=", tenantId)
      .where("bundles.status", "in", statusFilter);

    if (bookmarkedOnly) {
      countQuery = countQuery
        .innerJoin("member_bookmarks", "member_bookmarks.bundle_id", "bundles.id")
        .where("member_bookmarks.tenant_id", "=", tenantId)
        .where("member_bookmarks.tenant_member_id", "=", options.memberId!)
        .where("member_bookmarks.bookmark_type", "=", "BUNDLE");
      bundlesQuery = bundlesQuery
        .innerJoin("member_bookmarks", "member_bookmarks.bundle_id", "bundles.id")
        .where("member_bookmarks.tenant_id", "=", tenantId)
        .where("member_bookmarks.tenant_member_id", "=", options.memberId!)
        .where("member_bookmarks.bookmark_type", "=", "BUNDLE");
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    const bundlesRaw = await bundlesQuery
      .orderBy(`bundles.${sortBy}`, sortOrder)
      .offset(offset)
      .limit(limit)
      .execute();

    const bundleIds = bundlesRaw.map((b) => b.id);
    const itemCountMap = new Map<string, number>();

    if (bundleIds.length > 0) {
      const counts = await db
        .selectFrom("bundle_items")
        .select(["bundle_id", db.fn.count("id").as("cnt")])
        .where("bundle_id", "in", bundleIds)
        .groupBy("bundle_id")
        .execute();

      for (const row of counts) {
        itemCountMap.set(row.bundle_id, Number(row.cnt));
      }
    }

    const bundles: PublishedBundleListItem[] = bundlesRaw.map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      subtitle: b.subtitle,
      description: b.description,
      thumbnailUrl: resolveThumbnailUrl(b.thumbnail_url) ?? b.thumbnail_url,
      priceInr: b.price_inr,
      priceUsd: b.price_usd,
      discountInr: b.discount_inr,
      discountUsd: b.discount_usd,
      purchaseMode: String(b.purchase_mode ?? "PAID"),
      itemCount: itemCountMap.get(b.id) ?? 0,
      sortOrder: b.sort_order,
      createdAt: b.created_at.toISOString(),
    }));

    return {
      bundles,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }
  // Content-product-link gating removed, findLinkedProducts no longer needed
  // Preserved for future reference in git history.

  /**
   * The reverse of every other query here: given content, which PUBLISHED
   * bundles contain it? Powers the "Part of <Bundle>" badge on course, book and
   * test-series cards so a learner can see the bundle exists and go buy it.
   *
   * ONE query for a whole page of cards. The obvious implementation, ask per
   * card inside a .map(), is one round trip per row, which is exactly the N+1
   * that makes a 200-row catalog take ~20s against RDS.
   *
   * Batches are absent by design: bundle_items has no batch_id column, so a
   * bundle cannot contain a batch. Callers pass only the three that can.
   */
  async findBundlesForContent(
    tenantId: string,
    ids: {
      courseIds?: string[];
      bookIds?: string[];
      testSeriesIds?: string[];
    }
  ): Promise<Map<string, Array<{ id: string; title: string; slug: string }>>> {
    const courseIds = ids.courseIds ?? [];
    const bookIds = ids.bookIds ?? [];
    const testSeriesIds = ids.testSeriesIds ?? [];
    const byContentId = new Map<
      string,
      Array<{ id: string; title: string; slug: string }>
    >();

    // Nothing to look up, skip the round trip entirely.
    if (!courseIds.length && !bookIds.length && !testSeriesIds.length) {
      return byContentId;
    }

    const rows = await db
      .selectFrom("bundle_items")
      .innerJoin("bundles", "bundles.id", "bundle_items.bundle_id")
      .select([
        "bundle_items.course_id",
        "bundle_items.book_id",
        "bundle_items.test_series_id",
        "bundles.id as bundle_id",
        "bundles.title as bundle_title",
        "bundles.slug as bundle_slug",
        "bundles.sort_order as bundle_sort_order",
      ])
      .where("bundle_items.tenant_id", "=", tenantId)
      .where("bundles.tenant_id", "=", tenantId)
      // A draft bundle isn't purchasable, so advertising it on a card would
      // send the learner to a page they can't buy from.
      .where("bundles.status", "=", bundle_status.PUBLISHED)
      .where((eb) => {
        const clauses = [];
        if (courseIds.length)
          clauses.push(eb("bundle_items.course_id", "in", courseIds));
        if (bookIds.length)
          clauses.push(eb("bundle_items.book_id", "in", bookIds));
        if (testSeriesIds.length)
          clauses.push(eb("bundle_items.test_series_id", "in", testSeriesIds));
        return eb.or(clauses);
      })
      // Stable "first" bundle when an item belongs to several, so the card
      // doesn't name a different one on every refresh.
      .orderBy("bundles.sort_order", "asc")
      .orderBy("bundles.title", "asc")
      .execute();

    for (const r of rows) {
      const contentId = r.course_id ?? r.book_id ?? r.test_series_id;
      if (!contentId) continue;
      const list = byContentId.get(contentId) ?? [];
      // An item can legitimately appear in a bundle twice via different rows;
      // the badge should still count that bundle once.
      if (!list.some((b) => b.id === r.bundle_id)) {
        list.push({
          id: r.bundle_id,
          title: r.bundle_title,
          slug: r.bundle_slug,
        });
      }
      byContentId.set(contentId, list);
    }

    return byContentId;
  }
}

export default new BundlesRepository();
