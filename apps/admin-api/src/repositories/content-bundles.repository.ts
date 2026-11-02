import { db } from "../db/connection";

export interface BundleRef {
  id: string;
  title: string;
  slug: string;
}

/**
 * "Which bundles contain this content?", the inverse of every other bundle
 * query, which all run bundle -> its items.
 *
 * Powers the "Part of <Bundle>" chip on course / book / test-series cards, so
 * an admin can see at a glance which catalog items are already packaged, and a
 * learner can find the better deal.
 *
 * ONE query for a whole page of cards, merged by id. Asking per card inside a
 * .map() is a round trip per row, the N+1 that makes a 200-row list crawl.
 *
 * Batches are absent by design: bundle_items has no batch_id column, so a
 * bundle cannot contain a batch.
 */
export async function findBundlesForContent(
  tenantId: string,
  ids: { courseIds?: string[]; bookIds?: string[]; testSeriesIds?: string[] }
): Promise<Map<string, BundleRef[]>> {
  const courseIds = ids.courseIds ?? [];
  const bookIds = ids.bookIds ?? [];
  const testSeriesIds = ids.testSeriesIds ?? [];
  const byContentId = new Map<string, BundleRef[]>();

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
    ])
    .where("bundle_items.tenant_id", "=", tenantId)
    .where("bundles.tenant_id", "=", tenantId)
    .where((eb) => {
      const clauses = [];
      if (courseIds.length)
        clauses.push(eb("bundle_items.course_id", "in", courseIds));
      if (bookIds.length) clauses.push(eb("bundle_items.book_id", "in", bookIds));
      if (testSeriesIds.length)
        clauses.push(eb("bundle_items.test_series_id", "in", testSeriesIds));
      return eb.or(clauses);
    })
    // Stable "first" bundle when an item is in several, so a card doesn't name
    // a different one on every refresh.
    .orderBy("bundles.sort_order", "asc")
    .orderBy("bundles.title", "asc")
    .execute();

  // Note: no status filter. Admin sees DRAFT bundles too, someone arranging
  // the catalog needs to know a course is already packaged even if that bundle
  // isn't live yet. The storefront copy of this deliberately filters to
  // PUBLISHED, since advertising a draft sends learners to a page they can't
  // buy from.
  for (const r of rows) {
    const contentId = r.course_id ?? r.book_id ?? r.test_series_id;
    if (!contentId) continue;
    const list = byContentId.get(contentId) ?? [];
    if (!list.some((b) => b.id === r.bundle_id)) {
      list.push({ id: r.bundle_id, title: r.bundle_title, slug: r.bundle_slug });
    }
    byContentId.set(contentId, list);
  }

  return byContentId;
}
