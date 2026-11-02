import { ulid } from "ulid";
import type { Transaction } from "kysely";

import type {
  enrollment_status,
  member_status,
  tenant_bulk_import_scope_type,
  test_series_enrollment_status,
} from "../db/enums";
import type { DB } from "../db/types";
import { BadRequestError } from "../errors/bad-request.error";
import bulkImportsRepository from "../repositories/bulk-imports.repository";
import membersRepository from "../repositories/members.repository";
import grantNotificationService from "./grant-notification.service";
import type { GrantItemType } from "../queues/user-notification.queue";

import {
  buildReportCsv,
  grantPhase2PerMember,
} from "./bulk-imports.service";
import { defaultAdminGrantValidTill } from "./members.service";
import { uploadReport } from "./bulk-imports.s3";
import logger from "../utils/logger";
import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";
import type {
  BatchAction,
  BookAction,
  BulkImportCounters,
  CourseAction,
  PerRowReportEntry,
  TargetAction,
} from "../types/bulk-imports.type";

const SELECT_ALL_BATCH_SIZE = 500;
const MAX_SELECT_ALL_MEMBERS = 10_000;
const GRANT_CHUNK_SIZE = 500;

export type GenericTargetType =
  | "BATCH"
  | "TEST_SERIES"
  | "BUNDLE";

/**
 * Maps a grant target type to the item type the learner enrollment email
 * understands.
 */
const GRANT_ITEM_TYPE_BY_TARGET: Partial<Record<string, GrantItemType>> = {
  COURSE: "COURSE",
  BOOK: "BOOK",
  BUNDLE: "BUNDLE",
  TEST_SERIES: "TEST_SERIES",
  BATCH: "BATCH",
};

export interface BulkEnrollInput {
  tenantId: string;
  actingUserId: string;
  target:
    | { type: "COURSE"; id: string; batchId: string | null }
    | { type: "BOOK"; id: string }
    | { type: GenericTargetType; id: string };
  memberIds: string[] | null;
  selectAllFilter: { status?: member_status; search?: string } | null;
  validTill: Date | null;
  dryRun: boolean;
}

export interface BulkEnrollResult {
  jobId: string;
  counters: BulkImportCounters;
  totalMembers: number;
  perRow: PerRowReportEntry[];
  reportS3Key: string | null;
  /**
   * True when a selectAllFilter expansion was capped at MAX_SELECT_ALL_MEMBERS.
   * The frontend should warn the operator that members beyond the cap were
   * NOT enrolled and a second run with a narrower filter is needed.
   */
  truncated: boolean;
}

class BulkEnrollService {
  async enroll(input: BulkEnrollInput): Promise<BulkEnrollResult> {
    if (!input.memberIds && !input.selectAllFilter) {
      throw new BadRequestError(
        "Provide either memberIds[] or selectAllFilter to choose who to enroll.",
      );
    }
    if (input.memberIds && input.selectAllFilter) {
      throw new BadRequestError(
        "Provide only one of memberIds[] or selectAllFilter, not both.",
      );
    }
    if (input.validTill && input.validTill.getTime() <= Date.now()) {
      throw new BadRequestError("validTill must be in the future.");
    }

    await this.preflightTarget(input.tenantId, input.target);

    const scopeType: tenant_bulk_import_scope_type = input.target.type;
    const scopeId = input.target.id;

    const { members: resolvedMembers, truncated } = await this.resolveMembers(input);
    if (resolvedMembers.length === 0) {
      throw new BadRequestError("Selection resolved to zero members.");
    }

    const job = await bulkImportsRepository.create({
      tenantId: input.tenantId,
      actingUserId: input.actingUserId,
      scopeType,
      scopeId,
      source: "SELECT_EXISTING",
      originalFilename: null,
      totalRows: resolvedMembers.length,
    });
    if (!input.dryRun) {
      await bulkImportsRepository.markProcessing(input.tenantId, job.id);
    }

    try {
      const perRow: PerRowReportEntry[] = [];
      const counters: BulkImportCounters = {
        createdCount: 0,
        mergedCount: 0,
        grantedCount: 0,
        skippedCount: 0,
        errorCount: 0,
      };

      const memberIdList = resolvedMembers.map((m) => m.id);
      const isLegacyTarget =
        input.target.type === "COURSE" || input.target.type === "BOOK";

      // Course/book keep the shared CSV-import Phase 2 machinery; the other
      // target types run the leaner per-type grant below.
      const phase2 = isLegacyTarget
        ? await grantPhase2PerMember(
            input.tenantId,
            input.target.type === "COURSE"
              ? {
                  scopeType: "COURSE",
                  scopeId: input.target.id,
                  batchId: input.target.batchId ?? null,
                  validTill: input.validTill,
                }
              : {
                  scopeType: "BOOK",
                  scopeId: input.target.id,
                  batchId: null,
                  validTill: input.validTill,
                },
            memberIdList,
            input.dryRun,
          )
        : null;

      const targetByMember = isLegacyTarget
        ? new Map<string, TargetAction>()
        : await this.grantTargetPerMember(
            input.tenantId,
            input.target.type as GenericTargetType,
            input.target.id,
            memberIdList,
            input.validTill,
            input.dryRun,
          );

      let rowNumber = 1;
      // Members who were genuinely granted/reactivated this run, they get an
      // email (async, via the shared user-notification queue) after the report.
      const notifyMemberIds: string[] = [];
      for (const member of resolvedMembers) {
        const courseAction: CourseAction | null =
          input.target.type === "COURSE"
            ? phase2?.courseByMember.get(member.id) ?? null
            : null;
        const batchAction: BatchAction | null =
          input.target.type === "COURSE"
            ? input.target.batchId
              ? phase2?.batchByMember.get(member.id) ?? "N/A"
              : "N/A"
            : null;
        const bookAction: BookAction | null =
          input.target.type === "BOOK"
            ? phase2?.bookByMember.get(member.id) ?? null
            : null;
        const targetAction: TargetAction | null = isLegacyTarget
          ? null
          : targetByMember.get(member.id) ?? null;

        const entry: PerRowReportEntry = {
          rowNumber: rowNumber++,
          name: null,
          email: null,
          phone: null,
          memberAction: "SKIPPED_ALREADY_EXISTS", // Phase 1 is a no-op here
          memberIds: [member.id],
          memberStatusAtGrant: [member.status],
          courseAction,
          batchAction,
          bookAction,
          targetAction,
          rowValidTill: null,
          errorMessage: null,
        };
        perRow.push(entry);

        let grantedThisMember = false;
        if (
          courseAction === "ENROLLMENT_CREATED" ||
          courseAction === "ENROLLMENT_REACTIVATED"
        ) {
          counters.grantedCount++;
          grantedThisMember = true;
        }
        if (
          bookAction === "BOOK_ACCESS_CREATED" ||
          bookAction === "BOOK_ACCESS_REACTIVATED"
        ) {
          counters.grantedCount++;
          grantedThisMember = true;
        }
        if (
          targetAction === "ACCESS_GRANTED" ||
          targetAction === "ACCESS_REACTIVATED"
        ) {
          counters.grantedCount++;
          grantedThisMember = true;
        }
        if (grantedThisMember) notifyMemberIds.push(member.id);
      }

      let reportKey: string | null = null;
      if (!input.dryRun) {
        // The CSV report is a convenience download; without object storage
        // (no bucket configured locally) the grants still stand.
        try {
          reportKey = await uploadReport(
            input.tenantId,
            job.id,
            buildReportCsv(perRow),
          );
        } catch (err) {
          logger.warn(
            `[bulk-enroll] report upload failed for job ${job.id}: ${(err as Error).message}`,
          );
        }
        await bulkImportsRepository.markCompleted(
          input.tenantId,
          job.id,
          counters,
          reportKey,
        );

        // Email the newly-granted learners, async, from the tenant. Never let a
        // notification failure affect the bulk-enroll result.
        const itemType = GRANT_ITEM_TYPE_BY_TARGET[input.target.type];
        if (itemType && notifyMemberIds.length > 0) {
          void grantNotificationService.notifyBulkGrant(
            input.tenantId,
            itemType,
            input.target.id,
            notifyMemberIds,
          );
        }
      }

      return {
        jobId: job.id,
        counters,
        totalMembers: resolvedMembers.length,
        perRow,
        reportS3Key: reportKey,
        truncated,
      };
    } catch (err) {
      if (!input.dryRun) {
        await bulkImportsRepository.markFailed(
          input.tenantId,
          job.id,
          (err as Error).message,
        );
      }
      throw err;
    }
  }

  private async resolveMembers(
    input: BulkEnrollInput,
  ): Promise<{
    members: Array<{ id: string; status: member_status }>;
    truncated: boolean;
  }> {
    if (input.memberIds) {
      // Dedupe and verify membership in this tenant.
      const unique = Array.from(new Set(input.memberIds));
      if (unique.length === 0) {
        throw new BadRequestError("memberIds[] is empty.");
      }
      const rows = await membersRepository.findByIds(input.tenantId, unique);
      const found = new Set(rows.map((r) => r.id));
      const missing = unique.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new BadRequestError(
          `${missing.length} memberId(s) not found in this tenant.`,
        );
      }
      return { members: rows, truncated: false };
    }

    // selectAllFilter path: paginate in batches up to the cap. If we hit
    // the cap with a non-empty final batch, more rows likely exist beyond
    // it; surface that via the truncated flag so the UI can warn.
    const filter = input.selectAllFilter ?? {};
    const result: Array<{ id: string; status: member_status }> = [];
    let offset = 0;
    let lastBatchLen = 0;
    while (offset < MAX_SELECT_ALL_MEMBERS) {
      const batch = await membersRepository.findMemberIdsByFilter(
        input.tenantId,
        filter,
        offset,
        SELECT_ALL_BATCH_SIZE,
      );
      lastBatchLen = batch.length;
      if (batch.length === 0) break;
      result.push(...batch);
      offset += SELECT_ALL_BATCH_SIZE;
    }
    if (result.length === 0) {
      throw new BadRequestError("Filter matched zero members.");
    }
    // If we hit the cap AND the final batch came back full, there are
    // probably more rows past MAX_SELECT_ALL_MEMBERS that we skipped.
    const truncated =
      result.length >= MAX_SELECT_ALL_MEMBERS &&
      lastBatchLen === SELECT_ALL_BATCH_SIZE;
    return { members: result, truncated };
  }

  private async preflightTarget(
    tenantId: string,
    target: BulkEnrollInput["target"],
  ): Promise<void> {
    if (target.type === "COURSE") {
      const course = await db
        .selectFrom("courses")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("id", "=", target.id)
        .executeTakeFirst();
      if (!course) throw new NotFoundError("Course not found in this tenant.");
      if (target.batchId) {
        const batch = await db
          .selectFrom("batches")
          .select(["id", "enrollment_close_date"])
          .where("tenant_id", "=", tenantId)
          .where("id", "=", target.batchId)
          .executeTakeFirst();
        if (!batch) throw new NotFoundError("Batch not found in this tenant.");
        if (
          batch.enrollment_close_date &&
          batch.enrollment_close_date.getTime() < Date.now()
        ) {
          throw new BadRequestError("Batch enrollment is closed.");
        }
        const item = await db
          .selectFrom("batch_items")
          .select("id")
          .where("tenant_id", "=", tenantId)
          .where("batch_id", "=", target.batchId)
          .where("course_id", "=", target.id)
          .executeTakeFirst();
        if (!item) {
          throw new BadRequestError(
            "Selected batch does not contain this course.",
          );
        }
      }
    } else if (target.type === "BOOK") {
      const book = await db
        .selectFrom("books")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("id", "=", target.id)
        .executeTakeFirst();
      if (!book) throw new NotFoundError("Book not found in this tenant.");
    } else if (target.type === "BATCH") {
      const batch = await db
        .selectFrom("batches")
        .select(["id", "enrollment_close_date"])
        .where("tenant_id", "=", tenantId)
        .where("id", "=", target.id)
        .executeTakeFirst();
      if (!batch) throw new NotFoundError("Batch not found in this tenant.");
    } else if (target.type === "TEST_SERIES") {
      const series = await db
        .selectFrom("test_series")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("id", "=", target.id)
        .executeTakeFirst();
      if (!series) throw new NotFoundError("Test series not found in this tenant.");
    } else if (target.type === "BUNDLE") {
      const bundle = await db
        .selectFrom("bundles")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("id", "=", target.id)
        .executeTakeFirst();
      if (!bundle) throw new NotFoundError("Bundle not found in this tenant.");
    }
  }

  /**
   * Single-member convenience used by the member-detail endpoints. Same
   * engine as bulk enroll (per-type grant below), same revenue-share guard.
   */
  async grantSingle(
    tenantId: string,
    targetType: GenericTargetType,
    targetId: string,
    memberId: string,
    validTill: Date | null,
  ): Promise<TargetAction> {
    const members = await membersRepository.findByIds(tenantId, [memberId]);
    if (members.length === 0) {
      throw new NotFoundError("Member not found in this tenant.");
    }
    await this.preflightTarget(tenantId, { type: targetType, id: targetId });
    const actions = await this.grantTargetPerMember(
      tenantId,
      targetType,
      targetId,
      [memberId],
      validTill,
      false,
    );
    const action = actions.get(memberId) ?? "ACCESS_ALREADY_ACTIVE";
    if (action === "ACCESS_GRANTED" || action === "ACCESS_REACTIVATED") {
      const itemType = GRANT_ITEM_TYPE_BY_TARGET[targetType];
      if (itemType) {
        void grantNotificationService.notifyGrant(
          tenantId,
          memberId,
          itemType,
          targetId,
        );
      }
    }
    return action;
  }

  /**
   * Grant engine for the non course/book bulk-enroll targets. Mirrors the
   * Phase 2 trio (find -> insert / reactivate, ADMIN_GRANT source, default
   * 1-year validity) and, for composite targets (batch, bundle),
   * also mirrors the checkout fulfillment writes so the learner experience is
   * identical to a purchase.
   */
  private async grantTargetPerMember(
    tenantId: string,
    targetType: GenericTargetType,
    targetId: string,
    memberIds: string[],
    validTill: Date | null,
    dryRun: boolean,
  ): Promise<Map<string, TargetAction>> {
    const combined = new Map<string, TargetAction>();
    if (memberIds.length === 0) return combined;

    const chunkSize =
      dryRun || memberIds.length <= GRANT_CHUNK_SIZE
        ? memberIds.length
        : GRANT_CHUNK_SIZE;

    for (let start = 0; start < memberIds.length; start += chunkSize) {
      const slice = memberIds.slice(start, start + chunkSize);
      const chunk = await db.transaction().execute(async (trx) => {
        switch (targetType) {
          case "TEST_SERIES":
            return this.grantTestSeriesChunk(trx, tenantId, targetId, slice, validTill, dryRun);
          case "BATCH":
            return this.grantBatchChunk(trx, tenantId, targetId, slice, validTill, dryRun);
          case "BUNDLE":
            return this.grantBundleChunk(trx, tenantId, targetId, slice, validTill, dryRun);
        }
      });
      for (const [k, v] of chunk) combined.set(k, v);
    }

    return combined;
  }

  private async grantTestSeriesChunk(
    trx: Transaction<DB>,
    tenantId: string,
    testSeriesId: string,
    memberIds: string[],
    validTill: Date | null,
    dryRun: boolean,
  ): Promise<Map<string, TargetAction>> {
    const actions = new Map<string, TargetAction>();
    const effectiveValidTill = validTill ?? defaultAdminGrantValidTill();
    const existing = await membersRepository.bulkFindTestSeriesEnrollments(
      tenantId,
      testSeriesId,
      memberIds,
      trx,
    );
    const toCreate: string[] = [];
    const toReactivate: string[] = [];
    for (const memberId of memberIds) {
      const e = existing.get(memberId);
      if (!e) {
        toCreate.push(memberId);
        actions.set(memberId, "ACCESS_GRANTED");
      } else if (e.status === "ACTIVE") {
        actions.set(memberId, "ACCESS_ALREADY_ACTIVE");
      } else {
        toReactivate.push(e.id);
        actions.set(memberId, "ACCESS_REACTIVATED");
      }
    }
    if (!dryRun) {
      await membersRepository.bulkInsertTestSeriesEnrollments(
        tenantId, testSeriesId, toCreate, effectiveValidTill, trx,
      );
      await membersRepository.bulkReactivateTestSeriesEnrollments(
        tenantId, toReactivate, effectiveValidTill, trx,
      );
    }
    return actions;
  }

  private async grantBatchChunk(
    trx: Transaction<DB>,
    tenantId: string,
    batchId: string,
    memberIds: string[],
    validTill: Date | null,
    dryRun: boolean,
  ): Promise<Map<string, TargetAction>> {
    const actions = new Map<string, TargetAction>();
    const batch = await trx
      .selectFrom("batches")
      .select(["id", "end_date", "duration_days", "validity_days"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", batchId)
      .executeTakeFirst();
    if (!batch) throw new NotFoundError("Batch not found in this tenant.");

    // valid_till precedence mirrors the paid batch grant: explicit admin
    // choice > cohort end date > duration > validity window > 1-year default.
    const now = new Date();
    let effectiveValidTill = validTill;
    if (!effectiveValidTill) {
      if (batch.end_date) {
        effectiveValidTill = new Date(batch.end_date);
      } else if (batch.duration_days != null) {
        effectiveValidTill = new Date(now.getTime() + Number(batch.duration_days) * 24 * 60 * 60 * 1000);
      } else if (batch.validity_days != null) {
        effectiveValidTill = new Date(now.getTime() + Number(batch.validity_days) * 24 * 60 * 60 * 1000);
      } else {
        effectiveValidTill = defaultAdminGrantValidTill();
      }
    }

    const existing = await membersRepository.bulkFindBatchEnrollments(
      tenantId,
      batchId,
      memberIds,
      trx,
    );
    const toCreate: string[] = [];
    const toReactivate: string[] = [];
    for (const memberId of memberIds) {
      const e = existing.get(memberId);
      if (!e) {
        toCreate.push(memberId);
        actions.set(memberId, "ACCESS_GRANTED");
      } else if (e.status === "ACTIVE") {
        actions.set(memberId, "ACCESS_ALREADY_ACTIVE");
      } else {
        toReactivate.push(e.id);
        actions.set(memberId, "ACCESS_REACTIVATED");
      }
    }

    if (!dryRun) {
      await membersRepository.bulkInsertBatchEnrollments(
        tenantId, batchId, toCreate, effectiveValidTill, trx,
      );
      await membersRepository.bulkReactivateBatchEnrollments(
        tenantId, toReactivate, effectiveValidTill, trx,
      );

      // Per-child grants (source=BATCH) so /learn flows work exactly like a
      // purchased batch. Upserted for ALL members so reactivations also
      // revive their child rows.
      const items = await trx
        .selectFrom("batch_items")
        .select(["course_id", "book_id"])
        .where("tenant_id", "=", tenantId)
        .where("batch_id", "=", batchId)
        .execute();
      const courseIds = items.map((i) => i.course_id).filter((id): id is string => !!id);
      const bookIds = items.map((i) => i.book_id).filter((id): id is string => !!id);

      for (const courseId of courseIds) {
        await trx
          .insertInto("enrollments")
          .values(
            memberIds.map((memberId) => ({
              id: ulid(),
              tenant_id: tenantId,
              tenant_member_id: memberId,
              course_id: courseId,
              status: "ACTIVE" as enrollment_status,
              source: "BATCH" as const,
              source_batch_id: batchId,
              enrolled_at: now,
              valid_till: effectiveValidTill,
              created_at: now,
              updated_at: now,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["tenant_id", "tenant_member_id", "course_id"]).doUpdateSet({
              status: "ACTIVE",
              source: "BATCH",
              source_batch_id: batchId,
              valid_till: effectiveValidTill,
              updated_at: now,
            }),
          )
          .execute();
      }
      for (const bookId of bookIds) {
        await trx
          .insertInto("book_access")
          .values(
            memberIds.map((memberId) => ({
              id: ulid(),
              tenant_id: tenantId,
              tenant_member_id: memberId,
              book_id: bookId,
              status: "ACTIVE" as enrollment_status,
              source: "BATCH" as const,
              source_batch_id: batchId,
              valid_till: effectiveValidTill,
              created_at: now,
              updated_at: now,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["tenant_id", "tenant_member_id", "book_id"]).doUpdateSet({
              status: "ACTIVE",
              source: "BATCH",
              source_batch_id: batchId,
              valid_till: effectiveValidTill,
              updated_at: now,
            }),
          )
          .execute();
      }

      if (toCreate.length > 0) {
        await trx
          .updateTable("batches")
          .set((eb) => ({
            total_enrollments: eb("total_enrollments", "+", toCreate.length),
            updated_at: now,
          }))
          .where("tenant_id", "=", tenantId)
          .where("id", "=", batchId)
          .execute();
      }
    }

    return actions;
  }

  private async grantBundleChunk(
    trx: Transaction<DB>,
    tenantId: string,
    bundleId: string,
    memberIds: string[],
    validTill: Date | null,
    dryRun: boolean,
  ): Promise<Map<string, TargetAction>> {
    const actions = new Map<string, TargetAction>();
    const now = new Date();
    const effectiveValidTill = validTill ?? defaultAdminGrantValidTill();

    const items = await trx
      .selectFrom("bundle_items")
      .select(["course_id", "book_id", "test_series_id"])
      .where("tenant_id", "=", tenantId)
      .where("bundle_id", "=", bundleId)
      .execute();
    if (items.length === 0) {
      throw new BadRequestError("Bundle has no items to grant.");
    }

    // Bundle grants fan out to every child (source=BUNDLE + source_bundle_id,
    // exactly like checkout fulfillment). Upserts are idempotent, so the
    // outcome is reported uniformly as granted.
    for (const memberId of memberIds) actions.set(memberId, "ACCESS_GRANTED");
    if (dryRun) return actions;

    for (const item of items) {
      if (item.course_id) {
        const courseId = item.course_id;
        await trx
          .insertInto("enrollments")
          .values(
            memberIds.map((memberId) => ({
              id: ulid(),
              tenant_id: tenantId,
              tenant_member_id: memberId,
              course_id: courseId,
              status: "ACTIVE" as enrollment_status,
              source: "BUNDLE" as const,
              source_bundle_id: bundleId,
              enrolled_at: now,
              valid_till: effectiveValidTill,
              created_at: now,
              updated_at: now,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["tenant_id", "tenant_member_id", "course_id"]).doUpdateSet({
              status: "ACTIVE",
              source: "BUNDLE",
              source_bundle_id: bundleId,
              valid_till: effectiveValidTill,
              updated_at: now,
            }),
          )
          .execute();
      }
      if (item.book_id) {
        const bookId = item.book_id;
        await trx
          .insertInto("book_access")
          .values(
            memberIds.map((memberId) => ({
              id: ulid(),
              tenant_id: tenantId,
              tenant_member_id: memberId,
              book_id: bookId,
              status: "ACTIVE" as enrollment_status,
              source: "BUNDLE" as const,
              source_bundle_id: bundleId,
              valid_till: effectiveValidTill,
              created_at: now,
              updated_at: now,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["tenant_id", "tenant_member_id", "book_id"]).doUpdateSet({
              status: "ACTIVE",
              source: "BUNDLE",
              source_bundle_id: bundleId,
              valid_till: effectiveValidTill,
              updated_at: now,
            }),
          )
          .execute();
      }
      if (item.test_series_id) {
        const testSeriesId = item.test_series_id;
        await trx
          .insertInto("test_series_enrollments")
          .values(
            memberIds.map((memberId) => ({
              id: ulid(),
              tenant_id: tenantId,
              tenant_member_id: memberId,
              test_series_id: testSeriesId,
              status: "ACTIVE" as test_series_enrollment_status,
              source: "BUNDLE" as const,
              enrolled_at: now,
              valid_till: effectiveValidTill,
              created_at: now,
              updated_at: now,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["tenant_id", "tenant_member_id", "test_series_id"]).doUpdateSet({
              status: "ACTIVE",
              source: "BUNDLE",
              valid_till: effectiveValidTill,
              updated_at: now,
            }),
          )
          .execute();
      }
    }

    return actions;
  }
}

const bulkEnrollService = new BulkEnrollService();
export default bulkEnrollService;
