import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";
import batchesRepository, {
  type PublishedBatchDetail,
  type PaginationOptions,
  type PublishedBatchesResult,
} from "../repositories/batches.repository";
import { getPriceMapsForEntities } from "../utils/price-resolver";

/** Per-currency price map (additive alongside legacy priceInr/priceUsd fields). */
type BatchPriceMap = Record<string, { amount: number; discount: number }>;

/** Batched price-map lookup keyed by batch id. */
async function getBatchPriceMaps(
  tenantId: string,
  batches: Array<{
    id: string;
    priceInr: string | null;
    priceUsd: string | null;
    discountInr: string | null;
    discountUsd: string | null;
  }>
): Promise<Map<string, BatchPriceMap>> {
  return getPriceMapsForEntities(
    tenantId,
    "BATCH",
    batches.map((b) => ({
      id: b.id,
      price_inr: b.priceInr,
      price_usd: b.priceUsd,
      discount_inr: b.discountInr,
      discount_usd: b.discountUsd,
    }))
  );
}

export interface BatchDashboardResponse {
  batch: PublishedBatchDetail & { prices: BatchPriceMap };
  countdown: {
    startsAt: string;
    secondsUntilStart: number;
    inProgress: boolean;
    ended: boolean;
  };
  progress: {
    lessonsCompleted: number;
    totalLessons: number;
    lessonCompletionPct: number;
    overallCompletionPct: number;
  };
}

/**
 * Public read of a batch by slug (no auth required).
 * Includes `hasAccess` when memberId is provided.
 */
export async function getBatchPublic(
  tenantId: string,
  slug: string,
  memberId?: string
): Promise<PublishedBatchDetail & { prices: BatchPriceMap; hasAccess: boolean }> {
  const batch = await batchesRepository.findPublishedBySlug(tenantId, slug);
  if (!batch) {
    throw new NotFoundError("Published batch not found for this slug");
  }
  let hasAccess = false;
  if (memberId) {
    const enrollment = await batchesRepository.findActiveEnrollment(
      tenantId,
      batch.id,
      memberId
    );
    hasAccess = !!enrollment;
  }
  const priceMaps = await getBatchPriceMaps(tenantId, [batch]);
  return { ...batch, prices: priceMaps.get(batch.id) ?? {}, hasAccess };
}

/**
 * Public list of published batches.
 */
export async function listPublishedBatches(
  tenantId: string,
  options?: PaginationOptions
): Promise<
  Omit<PublishedBatchesResult, "batches"> & {
    batches: Array<PublishedBatchesResult["batches"][number] & { prices: BatchPriceMap }>;
  }
> {
  const result = await batchesRepository.listPublishedByTenant(tenantId, options);
  const priceMaps = await getBatchPriceMaps(tenantId, result.batches);
  return {
    ...result,
    batches: result.batches.map((b) => ({
      ...b,
      prices: priceMaps.get(b.id) ?? {},
    })),
  };
}

export async function listMyBatches(tenantId: string, memberId: string) {
  return batchesRepository.listMyBatches(tenantId, memberId);
}

/**
 * Resolve a published batch by slug; throws NotFoundError if it doesn't
 * exist. Used by the public read endpoints (content/leaderboard).
 * they no longer require enrollment so visitors can preview the schedule and
 * decide whether to join.
 */
async function resolvePublishedBatch(
  tenantId: string,
  slug: string
): Promise<PublishedBatchDetail> {
  const batch = await batchesRepository.findPublishedBySlug(tenantId, slug);
  if (!batch) {
    throw new NotFoundError("Published batch not found for this slug");
  }
  return batch;
}

export async function getBatchContent(tenantId: string, slug: string) {
  // Items are the same list the About tab exposes, public.
  const batch = await resolvePublishedBatch(tenantId, slug);
  return { batchId: batch.id, items: batch.items };
}

export async function getBatchDashboard(
  tenantId: string,
  slug: string,
  memberId: string | null
): Promise<BatchDashboardResponse> {
  // Auth-optional: visitors see the public counters (total lessons across the
  // batch's courses) with their own completed count pinned at zero.
  const batch = await resolvePublishedBatch(tenantId, slug);
  const now = new Date();

  // Lesson completion across all batch courses
  const courseIds = batch.items
    .filter((i) => i.itemType === "COURSE" && i.courseId)
    .map((i) => i.courseId as string);

  let totalLessons = 0;
  let completedLessons = 0;
  if (courseIds.length > 0) {
    const totalRow = await db
      .selectFrom("lectures")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("course_id", "in", courseIds)
      .executeTakeFirst();
    totalLessons = Number(totalRow?.count ?? 0);

    if (memberId) {
      const completedRow = await db
        .selectFrom("member_lecture_progress")
        .innerJoin(
          "lectures",
          "lectures.id",
          "member_lecture_progress.lecture_id"
        )
        .select(db.fn.count<number>("member_lecture_progress.id").as("count"))
        .where("member_lecture_progress.tenant_id", "=", tenantId)
        .where("member_lecture_progress.tenant_member_id", "=", memberId)
        .where("member_lecture_progress.completed", "=", true)
        .where("lectures.course_id", "in", courseIds)
        .executeTakeFirst();
      completedLessons = Number(completedRow?.count ?? 0);
    }
  }

  const startsAt = new Date(batch.startDate);
  const ended = !!batch.endDate && new Date(batch.endDate).getTime() < now.getTime();
  const inProgress = startsAt.getTime() <= now.getTime() && !ended;
  const secondsUntilStart = Math.max(
    0,
    Math.floor((startsAt.getTime() - now.getTime()) / 1000)
  );

  const lessonCompletionPct =
    totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;
  const overallCompletionPct = lessonCompletionPct;

  const priceMaps = await getBatchPriceMaps(tenantId, [batch]);

  return {
    batch: { ...batch, prices: priceMaps.get(batch.id) ?? {} },
    countdown: {
      startsAt: batch.startDate,
      secondsUntilStart,
      inProgress,
      ended,
    },
    progress: {
      lessonsCompleted: completedLessons,
      totalLessons,
      lessonCompletionPct,
      overallCompletionPct,
    },
  };
}
