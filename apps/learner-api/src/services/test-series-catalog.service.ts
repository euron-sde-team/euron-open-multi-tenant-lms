import config from "../config";
import { NotFoundError } from "../errors/not-found.error";
import testSeriesCatalogRepository, {
  type TestSeriesRow,
  type TestRow,
} from "../repositories/test-series-catalog.repository";
import testSeriesEnrollmentsRepository from "../repositories/test-series-enrollments.repository";
import testAttemptsRepository from "../repositories/test-attempts.repository";
import bundlesRepository from "../repositories/bundles.repository";
import { getPriceMapsForEntities } from "../utils/price-resolver";
import {
  resolveRuleCount,
  selectBlueprintQuestions,
  type BlueprintRule,
} from "../utils/test-blueprint.util";

export interface CatalogSeries {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageKey: string | null;
  category: string | null;
  pricingType: string;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  /** Per-currency price map (additive alongside legacy priceInr/priceUsd fields). */
  prices: Record<string, { amount: number; discount: number }>;
  currency: string | null;
  validityDays: number | null;
  visibility: string;
  accessMode: string;
  totalTests: number;
  /**
   * Whether the signed-in member already owns this series, so the card can
   * offer "Attempt now" instead of a price. Always false for logged-out
   * visitors, who see pricing as before.
   */
  hasAccess: boolean;
  /**
   * PUBLISHED bundles that include this series, so the card can show
   * "Part of <Bundle>". Empty when it belongs to none.
   */
  bundles: Array<{ id: string; title: string; slug: string }>;
}

export interface SeriesDetail extends CatalogSeries {
  tests: Array<{
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    totalMarks: string;
    orderIndex: number;
    isFreePreview: boolean;
    allowReattempt: boolean;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showSolutions: "IMMEDIATE" | "AFTER_SERIES_END" | "NEVER";
    passCriteriaPct: number | null;
    /** STANDARD = linear paper; ADAPTIVE = SAT-style multistage modules. */
    mode: "STANDARD" | "ADAPTIVE";
    /** Scheduling window; null = always available. ISO strings. */
    availableFrom: string | null;
    availableUntil: string | null;
    /** Status of the learner's most recent attempt for this test, if any. */
    lastAttemptStatus: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | null;
    lastAttemptId: string | null;
  }>;
  hasAccess: boolean;
}

function toCatalog(
  row: TestSeriesRow,
  totalTests: number,
  prices: Record<string, { amount: number; discount: number }> = {},
  // Defaults to empty so the detail view, which doesn't need the badge.
  // keeps working unchanged.
  bundles: Array<{ id: string; title: string; slug: string }> = [],
  hasAccess = false
): CatalogSeries {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverImageKey: resolveCoverImageUrl(row.cover_image_key),
    category: row.category,
    pricingType: String(row.pricing_type),
    priceInr: row.price_inr ? String(row.price_inr) : null,
    priceUsd: row.price_usd ? String(row.price_usd) : null,
    discountInr: row.discount_inr ? String(row.discount_inr) : null,
    discountUsd: row.discount_usd ? String(row.discount_usd) : null,
    prices,
    currency: (row.currency as unknown as string | null) ?? null,
    validityDays: row.validity_days,
    visibility: String(row.visibility),
    accessMode: String(row.access_mode),
    totalTests,
    hasAccess,
    bundles,
  };
}

/**
 * Marks a learner actually attempts, based on the served subset (blueprint rule
 * counts / random counts) estimated from the pool average, not the full pool.
 */
export function effectiveTotalMarks(
  totalMarks: number,
  servedCount: number,
  poolCount: number
): number {
  if (servedCount > 0 && poolCount > 0 && servedCount < poolCount) {
    return Math.round((servedCount / poolCount) * totalMarks);
  }
  return totalMarks;
}

type ServedMarksRow = {
  section_id: string;
  question_id: string;
  marks_override: string | null;
  marks: string;
  difficulty: string;
  subject_node_id: string | null;
  chapter_node_id: string | null;
  topic_node_id: string | null;
};

/**
 * EXACT marks a learner is served per attempt = the sum of the real marks of
 * the blueprint/random selection, NOT a count-proportional estimate.
 *
 * The old `(servedCount / poolCount) * totalMarks` estimate assumes every
 * question is worth the pool's *average* mark, so a blueprint that deliberately
 * serves the higher-value questions (e.g. all the 2-mark ones) reported far too
 * few marks, a 40×1 + 10×2 test (60 marks) showed 50. Here we run the real
 * serve logic and add up the actual marks. The picker is deterministic (first N
 * of a matching set): the SUM is exact whenever marks are uniform within a rule
 * or section (the real-world configuration) and a stable representative value
 * otherwise. Grading is unaffected, it already sums the frozen served set.
 */
async function computeServedMarks(
  sections: Array<{
    id: string;
    question_selection: unknown;
    random_question_count: number | null;
  }>,
  rows: ServedMarksRow[],
  fullTotalMarks: number
): Promise<number> {
  if (rows.length === 0) return fullTotalMarks;

  const sectionQuestions = rows.map((r) => ({
    section_id: r.section_id,
    question_id: r.question_id,
  }));
  const questionsLite = rows.map((r) => ({
    id: r.question_id,
    subject_node_id: r.subject_node_id,
    chapter_node_id: r.chapter_node_id,
    topic_node_id: r.topic_node_id,
    difficulty: String(r.difficulty),
  }));
  // Marks per question, a per-section override wins, mirroring grading.
  const marksById = new Map<string, number>();
  for (const r of rows) {
    if (marksById.has(r.question_id)) continue;
    marksById.set(
      r.question_id,
      r.marks_override != null ? Number(r.marks_override) : Number(r.marks ?? 0)
    );
  }

  const servedIds = await selectBlueprintQuestions(
    sections,
    sectionQuestions,
    questionsLite,
    (pool, n) => Promise.resolve(pool.slice(0, n))
  );

  // No per-section blueprint/random config → the whole pool is served, so the
  // stored full total is exact. (A test-level random count is handled at attempt
  // time; the catalog keeps showing the full total, as it always has.)
  if (servedIds === null) return fullTotalMarks;
  return servedIds.reduce((sum, id) => sum + (marksById.get(id) ?? 0), 0);
}

/**
 * Questions served per attempt across a test's sections: blueprint rule counts
 * (capped at the section pool), else a section random count, else the whole
 * section. Mirrors the runtime serve logic (test-blueprint.util).
 */
function servedForSections(
  sections: Array<{
    id: string;
    question_selection: unknown;
    random_question_count: number | null;
  }>,
  countBySection: Map<string, number>
): number {
  let served = 0;
  for (const s of sections) {
    const poolN = countBySection.get(s.id) ?? 0;
    let obj: unknown = s.question_selection;
    if (typeof obj === "string") {
      try {
        obj = JSON.parse(obj);
      } catch {
        obj = null;
      }
    }
    const bp =
      obj && typeof obj === "object"
        ? (obj as { rules?: unknown; totalCount?: number })
        : null;
    const rules =
      bp && Array.isArray(bp.rules) ? (bp.rules as BlueprintRule[]) : [];
    if (rules.length > 0) {
      let need = 0;
      for (const r of rules) need += resolveRuleCount(r, bp?.totalCount);
      served += Math.min(need, poolN);
    } else {
      const rqc = Number(s.random_question_count ?? 0);
      served += rqc > 0 ? Math.min(rqc, poolN) : poolN;
    }
  }
  return served;
}

function toCatalogTest(
  t: TestRow,
  orderIndex: number,
  isFreePreview: boolean,
  lastAttempt: { id: string; status: string } | null,
  poolCount = 0,
  servedCount = 0,
  servedMarks?: number
) {
  const served =
    servedCount > 0 && servedCount < poolCount ? servedCount : poolCount;
  const status = lastAttempt
    ? (lastAttempt.status as "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED")
    : null;
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    durationMin: Number(t.duration_min ?? 0),
    // Exact served marks (sum of the served questions' real marks). Falls back
    // to the stored full total only if the served-marks input wasn't provided.
    totalMarks: String(
      servedMarks != null ? servedMarks : Number(t.total_marks ?? 0)
    ),
    servedQuestionCount: served,
    orderIndex,
    isFreePreview,
    allowReattempt: Boolean(t.allow_reattempt),
    shuffleQuestions: Boolean(t.shuffle_questions),
    shuffleOptions: Boolean(t.shuffle_options),
    showSolutions: (String(t.show_solutions ?? "AFTER_SERIES_END") as
      | "IMMEDIATE"
      | "AFTER_SERIES_END"
      | "NEVER"),
    passCriteriaPct:
      t.pass_criteria_pct != null
        ? Number(t.pass_criteria_pct as unknown as string)
        : null,
    mode: (String(t.mode ?? "STANDARD") === "ADAPTIVE" ? "ADAPTIVE" : "STANDARD") as
      | "STANDARD"
      | "ADAPTIVE",
    availableFrom: toIso(t.available_from),
    availableUntil: toIso(t.available_until),
    lastAttemptStatus: status,
    lastAttemptId: lastAttempt?.id ?? null,
    // The instructions screen needs these to ask for camera / mic BEFORE the
    // attempt starts. Without them the player only asked once the timer was
    // already running, and a student who said no could still take the test.
    proctoring: {
      enabled: Boolean(t.proctoring_enabled),
      camera: Boolean(t.proctoring_enabled && t.proctor_camera),
      mic: Boolean(t.proctoring_enabled && t.proctor_mic),
      fullscreen: Boolean(t.proctoring_enabled && t.proctor_fullscreen),
    },
  };
}

/**
 * Resolve a cover-image S3 key to a full public URL using this server's own
 * thumbnails base (dev/prod picked from the learner-api's NODE_ENV, which
 * matches the tenant-admin backend that uploaded the image). Returning a full
 * URL here means the web renders it directly instead of guessing the bucket.
 * the web's `next start` runs with NODE_ENV=production even locally, so its
 * client-side guess pointed at the prod bucket and 404'd for dev-uploaded
 * covers. Absolute URLs / data URIs pass through untouched. Mirrors
 * resolveThumbnailUrl in bundles.repository.
 */
function resolveCoverImageUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:"))
    return v;
  const base = config.THUMBNAILS_BASE_URL;
  if (!base) return v;
  const key = v.startsWith("/") ? v.slice(1) : v;
  return `${base}/${key}`;
}

/** Normalize a nullable DB timestamp to an ISO string (or null). */
function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

class TestSeriesCatalogService {
  async listCatalog(
    tenantId: string,
    params: {
      search?: string;
      category?: string;
      pricing?: string;
      /** Apply the admin-arranged order (the tenant's ordered-products switch). */
      ordered?: boolean;
    } = {},
    memberId: string | null = null
  ): Promise<CatalogSeries[]> {
    const series = await testSeriesCatalogRepository.findPublishedByTenant(
      tenantId,
      params
    );
    if (series.length === 0) return [];
    // Single batched price-map lookup for the whole catalog page
    const priceMaps = await getPriceMapsForEntities(tenantId, "TEST_SERIES", series);
    // One query for the whole page, not one per series.
    const bundleMap = await bundlesRepository.findBundlesForContent(tenantId, {
      testSeriesIds: series.map((s) => s.id),
    });
    // Likewise one query, not hasActiveAccess() per card.
    const ownedIds = memberId
      ? await testSeriesEnrollmentsRepository.findActiveSeriesIds(
          tenantId,
          memberId,
          series.map((s) => s.id)
        )
      : new Set<string>();
    const results: CatalogSeries[] = [];
    for (const s of series) {
      const tests = await testSeriesCatalogRepository.listSeriesTests(tenantId, s.id);
      results.push(
        toCatalog(
          s,
          tests.length,
          priceMaps.get(s.id) ?? {},
          bundleMap.get(s.id) ?? [],
          ownedIds.has(s.id)
        )
      );
    }
    return results;
  }

  async getDetailBySlug(
    tenantId: string,
    slug: string,
    memberId: string | null
  ): Promise<SeriesDetail> {
    const series = await testSeriesCatalogRepository.findBySlugForCatalog(
      tenantId,
      slug
    );
    if (!series) throw new NotFoundError("Series not found");

    const seriesTests = await testSeriesCatalogRepository.listSeriesTests(
      tenantId,
      series.id
    );

    const [hasAccess, lastAttempts, priceMaps, poolCounts] = await Promise.all([
      memberId
        ? testSeriesEnrollmentsRepository.hasActiveAccess(
            tenantId,
            memberId,
            series.id
          )
        : Promise.resolve(false),
      memberId
        ? testAttemptsRepository.findLatestByLearnerForTests(
            tenantId,
            memberId,
            seriesTests.map((st) => st.test_id)
          )
        : Promise.resolve(
            new Map<string, { id: string; status: string; startedAt: Date | string }>()
          ),
      getPriceMapsForEntities(tenantId, "TEST_SERIES", [series]),
      testSeriesCatalogRepository.countSectionQuestionsByTestIds(
        tenantId,
        seriesTests.map((st) => st.test_id)
      ),
    ]);

    // Served-per-attempt counts (blueprint + random) so displayed marks and
    // question counts reflect what a learner actually gets, not the full pool.
    const testIds = seriesTests.map((st) => st.test_id);
    const sections = await testSeriesCatalogRepository.findSectionsByTestIds(
      tenantId,
      testIds
    );
    const sectionCounts =
      await testSeriesCatalogRepository.countSectionQuestionsBySectionIds(
        tenantId,
        sections.map((s) => s.id)
      );
    const sectionsByTest = new Map<string, typeof sections>();
    for (const s of sections) {
      const arr = sectionsByTest.get(s.test_id) ?? [];
      arr.push(s);
      sectionsByTest.set(s.test_id, arr);
    }
    const servedCounts = new Map<string, number>();
    for (const id of testIds) {
      servedCounts.set(id, servedForSections(sectionsByTest.get(id) ?? [], sectionCounts));
    }

    // Exact served marks per test (sum of the served questions' real marks),
    // instead of the count-proportional estimate that mis-reports non-uniform
    // marks (e.g. 40×1 + 10×2 as 50 instead of 60).
    const marksRows =
      await testSeriesCatalogRepository.findServedMarksInputByTestIds(
        tenantId,
        testIds
      );
    const marksRowsByTest = new Map<string, ServedMarksRow[]>();
    for (const r of marksRows) {
      const arr = marksRowsByTest.get(r.test_id) ?? [];
      arr.push(r);
      marksRowsByTest.set(r.test_id, arr);
    }
    const servedMarks = new Map<string, number>();
    for (const st of seriesTests) {
      const id = st.test_id;
      servedMarks.set(
        id,
        await computeServedMarks(
          (sectionsByTest.get(id) ?? []).map((s) => ({
            id: s.id,
            question_selection: s.question_selection,
            random_question_count: s.random_question_count,
          })),
          marksRowsByTest.get(id) ?? [],
          Number(st.test.total_marks ?? 0)
        )
      );
    }

    return {
      ...toCatalog(series, seriesTests.length, priceMaps.get(series.id) ?? {}),
      tests: seriesTests.map((st) =>
        toCatalogTest(
          st.test,
          Number(st.order_index ?? 0),
          Boolean(st.is_free_preview),
          lastAttempts.get(st.test_id) ?? null,
          poolCounts.get(st.test_id) ?? 0,
          servedCounts.get(st.test_id) ?? 0,
          servedMarks.get(st.test_id)
        )
      ),
      hasAccess,
    };
  }

  async getSeriesById(
    tenantId: string,
    seriesId: string
  ): Promise<TestSeriesRow | null> {
    return testSeriesCatalogRepository.findById(tenantId, seriesId);
  }
}

export default new TestSeriesCatalogService();
