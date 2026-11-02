import { sql, type Transaction } from "kysely";

import { db } from "../db/connection";
import type { DB } from "../db/types";
import type { tenant_bulk_import_scope_type } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import membersRepository from "../repositories/members.repository";
import bulkImportsRepository from "../repositories/bulk-imports.repository";
import { defaultAdminGrantValidTill } from "./members.service";
import type { BulkImportJobRow } from "../repositories/bulk-imports.repository";
import logger from "../utils/logger";

import {
  parseFile,
  generateCsvSample,
  generateXlsxSample,
} from "./bulk-imports.parser";
import {
  normalizeEmail,
  normalizePhone,
  runMatcher,
} from "./bulk-imports.matcher";
import { uploadInput, uploadReport, getReportSignedUrl } from "./bulk-imports.s3";
import {
  bulkImportsQueue,
  enqueueBulkImportJob,
  type BulkImportJobPayload,
} from "../queues/bulk-imports.queue";
import {
  BULK_IMPORT_CHUNK_SIZE,
  BULK_IMPORT_SYNC_THRESHOLD,
  type BatchAction,
  type BookAction,
  type BulkImportCounters,
  type CourseAction,
  type MatchedMemberSnapshot,
  type MemberLookup,
  type PerRowReportEntry,
  type PhaseOneOutcome,
  type RawParsedRow,
  type RowValidity,
  type ScopeContext,
} from "../types/bulk-imports.type";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunImportInput {
  tenantId: string;
  actingUserId: string;
  file: { buffer: Buffer; filename: string; mimetype?: string };
  scope: ScopeContext;
  dryRun: boolean;
}

export interface ImportSummary {
  jobId: string | null;
  syncResult: SyncResult | null;
  asyncStatus: "QUEUED" | null;
}

export interface SyncResult {
  counters: BulkImportCounters;
  totalRows: number;
  perRow: PerRowReportEntry[];
}

class BulkImportsService {
  /**
   * Entry point for all CSV/XLSX bulk-import requests. Validates the file,
   * dispatches sync or async based on row count and dryRun flag, persists a
   * tenant_bulk_imports row, and returns either the inline report (sync) or
   * the jobId to poll (async).
   */
  async runImport(input: RunImportInput): Promise<ImportSummary> {
    const rawRows = await parseFile(input.file);
    if (rawRows.length === 0) {
      throw new BadRequestError("File is empty after parsing.");
    }

    await preflightScope(input.tenantId, input.scope);

    // Dry run is always sync regardless of file size. The operator needs the
    // preview immediately.
    if (input.dryRun) {
      const result = await executeImport(input.tenantId, input.actingUserId, rawRows, input.scope, {
        dryRun: true,
      });
      return { jobId: null, syncResult: result, asyncStatus: null };
    }

    // Small files: process inline and return the full report.
    if (rawRows.length <= BULK_IMPORT_SYNC_THRESHOLD) {
      const job = await bulkImportsRepository.create({
        tenantId: input.tenantId,
        actingUserId: input.actingUserId,
        scopeType: input.scope.scopeType,
        scopeId: input.scope.scopeId,
        source: "CSV",
        originalFilename: input.file.filename,
        totalRows: rawRows.length,
      });
      await bulkImportsRepository.markProcessing(input.tenantId, job.id);

      try {
        const result = await executeImport(
          input.tenantId,
          input.actingUserId,
          rawRows,
          input.scope,
          { dryRun: false },
        );
        const reportKey = await uploadReport(
          input.tenantId,
          job.id,
          buildReportCsv(result.perRow),
        );
        await bulkImportsRepository.markCompleted(
          input.tenantId,
          job.id,
          result.counters,
          reportKey,
        );
        return { jobId: job.id, syncResult: result, asyncStatus: null };
      } catch (err) {
        await bulkImportsRepository.markFailed(
          input.tenantId,
          job.id,
          (err as Error).message,
        );
        throw err;
      }
    }

    // Large files: persist the parsed rows to S3, enqueue, return jobId.
    const job = await bulkImportsRepository.create({
      tenantId: input.tenantId,
      actingUserId: input.actingUserId,
      scopeType: input.scope.scopeType,
      scopeId: input.scope.scopeId,
      source: "CSV",
      originalFilename: input.file.filename,
      totalRows: rawRows.length,
    });
    const inputKey = await uploadInput(
      input.tenantId,
      job.id,
      Buffer.from(JSON.stringify({ rows: rawRows, scope: serializeScope(input.scope) }), "utf-8"),
    );
    const payload: BulkImportJobPayload = {
      jobId: job.id,
      tenantId: input.tenantId,
      actingUserId: input.actingUserId,
      inputS3Key: inputKey,
    };
    await enqueueBulkImportJob(payload);
    return { jobId: job.id, syncResult: null, asyncStatus: "QUEUED" };
  }

  async getSample(
    format: "csv" | "xlsx",
    withValidity = false,
  ): Promise<{ body: Buffer; contentType: string; filename: string }> {
    if (format === "xlsx") {
      const body = await generateXlsxSample(withValidity);
      return {
        body,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: "bulk-import-sample.xlsx",
      };
    }
    return {
      body: generateCsvSample(withValidity),
      contentType: "text/csv",
      filename: "bulk-import-sample.csv",
    };
  }

  async getJob(tenantId: string, jobId: string): Promise<BulkImportJobRow> {
    const job = await bulkImportsRepository.findById(tenantId, jobId);
    if (!job) throw new NotFoundError("Bulk import job not found");
    return job;
  }

  async listJobs(
    tenantId: string,
    params: {
      page: number;
      limit: number;
      scopeType?: tenant_bulk_import_scope_type;
      scopeId?: string;
    },
  ): Promise<{ jobs: BulkImportJobRow[]; total: number; page: number; limit: number }> {
    const { jobs, total } = await bulkImportsRepository.list(tenantId, params);
    return { jobs, total, page: params.page, limit: params.limit };
  }

  async getReportUrl(tenantId: string, jobId: string): Promise<string> {
    const job = await this.getJob(tenantId, jobId);
    if (!job.report_s3_key) {
      throw new BadRequestError("Report is not available yet for this job.");
    }
    return getReportSignedUrl(job.report_s3_key);
  }
}

// ---------------------------------------------------------------------------
// Executor (also called from the BullMQ worker)
// ---------------------------------------------------------------------------

/**
 * Run the matcher across all rows (in-memory), then apply the writes in
 * chunked transactions. Each chunk re-validates the scope (closes the
 * preflight-vs-write TOCTOU window) and wraps bulk merges in savepoints
 * so race-aborts only kill the affected sub-step, not the whole chunk.
 *
 * Sync path (rawRows.length <= BULK_IMPORT_SYNC_THRESHOLD): one chunk.
 * Async path: multiple BULK_IMPORT_CHUNK_SIZE chunks, each its own trx.
 * Dry run: read-only, single transaction, no writes.
 */
export async function executeImport(
  tenantId: string,
  actingUserId: string,
  rawRows: RawParsedRow[],
  scope: ScopeContext,
  options: { dryRun: boolean },
): Promise<SyncResult> {
  const counters: BulkImportCounters = {
    createdCount: 0,
    mergedCount: 0,
    grantedCount: 0,
    skippedCount: 0,
    errorCount: 0,
  };

  // === Stage A: matcher (no transaction; one big read) ===
  // Phase 0 lookup spans ALL rows so in-file dedup and Case G detection
  // operate on the full file, not per-chunk slices.
  const { emails, phones } = collectContactKeys(rawRows);
  const snapshots = await membersRepository.batchLookupByContact(
    tenantId,
    emails,
    phones,
  );
  const { byEmail, byPhone } = buildLookupMaps(snapshots);
  const lookup: MemberLookup = {
    async byEmail(e) {
      return byEmail.get(e) ?? null;
    },
    async byPhone(p) {
      return byPhone.get(p) ?? null;
    },
  };
  const outcomes = await runMatcher(rawRows, lookup);

  // === Stage B: writes (chunked transactions) ===
  const CHUNK_SIZE = options.dryRun
    ? outcomes.length || 1
    : rawRows.length <= BULK_IMPORT_SYNC_THRESHOLD
      ? outcomes.length || 1
      : BULK_IMPORT_CHUNK_SIZE;

  const phase2Combined: Phase2Results = {
    courseByMember: new Map(),
    batchByMember: new Map(),
    bookByMember: new Map(),
  };

  for (let start = 0; start < outcomes.length; start += CHUNK_SIZE) {
    const chunk = outcomes.slice(start, start + CHUNK_SIZE);
    try {
      const chunkPhase2 = await db.transaction().execute(async (trx) => {
        await revalidateScope(trx, tenantId, scope);
        return executeChunkWrites(
          trx,
          tenantId,
          actingUserId,
          chunk,
          scope,
          options.dryRun,
        );
      });
      // Merge chunk's Phase 2 results into the combined map.
      for (const [k, v] of chunkPhase2.courseByMember) {
        phase2Combined.courseByMember.set(k, v);
      }
      for (const [k, v] of chunkPhase2.batchByMember) {
        phase2Combined.batchByMember.set(k, v);
      }
      for (const [k, v] of chunkPhase2.bookByMember) {
        phase2Combined.bookByMember.set(k, v);
      }
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(
        `[bulk-imports] chunk ${start}-${start + chunk.length - 1} failed: ${msg}`,
      );
      // Mark every actionable row in this chunk as ERROR_CHUNK_FAILED.
      // Already-error / already-skipped rows are left as-is.
      for (const o of chunk) {
        if (
          !o.action.startsWith("ERROR_") &&
          o.action !== "SKIPPED_DUPLICATE_IN_FILE" &&
          o.action !== "SKIPPED_LOOKS_LIKE_HEADER_ROW"
        ) {
          o.action = "ERROR_CHUNK_FAILED";
          o.errorMessage = `Chunk write failed: ${msg}`;
          o.memberIds = [];
          o.memberStatusAtGrant = [];
        }
      }
    }
  }

  // === Stage C: build per-row report ===
  const perRow = outcomes.map((o) =>
    buildReportEntry(o, rawRows, scope, phase2Combined),
  );
  for (const entry of perRow) tallyCounters(counters, entry);
  return { counters, totalRows: rawRows.length, perRow };
}

/**
 * Apply writes for a single chunk of outcomes inside `trx`. Mutates the
 * outcomes in place (e.g. setting SKIPPED_RACE_CONFLICT on race losses).
 * Returns the chunk's Phase 2 action map. Throws on unrecoverable failure
 * (caller turns that into ERROR_CHUNK_FAILED on every row in the chunk).
 */
async function executeChunkWrites(
  trx: Transaction<DB>,
  tenantId: string,
  actingUserId: string,
  chunk: PhaseOneOutcome[],
  scope: ScopeContext,
  dryRun: boolean,
): Promise<Phase2Results> {
  const creates: PhaseOneOutcome[] = [];
  const mergePhones: PhaseOneOutcome[] = [];
  const mergeEmails: PhaseOneOutcome[] = [];

  for (const o of chunk) {
    switch (o.intent.kind) {
      case "CREATE":
        creates.push(o);
        break;
      case "MERGE_PHONE":
        mergePhones.push(o);
        break;
      case "MERGE_EMAIL":
        mergeEmails.push(o);
        break;
      case "NO_OP":
        break;
    }
  }

  if (!dryRun) {
    // --- Bulk create ---
    const createInputs = creates
      .map((o) => (o.intent.kind === "CREATE" ? o.intent : null))
      .filter((x): x is Extract<PhaseOneOutcome["intent"], { kind: "CREATE" }> => x !== null)
      .map((intent) => ({
        name: intent.name,
        email: intent.email,
        phone: intent.phone,
        invitedBy: actingUserId,
      }));
    const inserted = await membersRepository.bulkCreateMembers(
      tenantId,
      createInputs,
      trx,
    );
    const insertedByEmail = new Map<string, string>();
    const insertedByPhone = new Map<string, string>();
    for (const row of inserted) {
      if (row.email) insertedByEmail.set(row.email, row.id);
      if (row.phone) insertedByPhone.set(row.phone, row.id);
    }
    for (const o of creates) {
      if (o.intent.kind !== "CREATE") continue;
      const id =
        (o.intent.email && insertedByEmail.get(o.intent.email)) ||
        (o.intent.phone && insertedByPhone.get(o.intent.phone)) ||
        null;
      if (id) {
        o.memberIds = [id];
        o.memberStatusAtGrant = ["ACTIVE"];
      } else {
        o.action = "SKIPPED_RACE_CONFLICT";
        o.errorMessage = "Concurrent import claimed this email/phone first.";
        o.memberIds = [];
        o.memberStatusAtGrant = [];
      }
    }

    // --- Bulk merge phones (savepoint-wrapped so a unique-violation
    // doesn't kill the chunk's outer transaction) ---
    await applyBulkMergePhones(trx, tenantId, mergePhones);
    await applyBulkMergeEmails(trx, tenantId, mergeEmails);
  } else {
    // Dry-run: simulate CREATE intents without writing.
    for (const o of creates) {
      o.memberIds = [];
      o.memberStatusAtGrant = ["ACTIVE"];
    }
  }

  // --- Phase 2 grants for this chunk ---
  const targetMemberIds = new Set<string>();
  const validTillByMember = new Map<string, Date | "LIFETIME">();
  for (const o of chunk) {
    if (!isEligibleForPhase2(o, scope)) continue;
    for (const id of o.memberIds) {
      targetMemberIds.add(id);
      // Carry the row's per-row expiry through to the grant. null/undefined =
      // the cell was blank → the grant falls back to the batch default; a Date
      // or "LIFETIME" is an explicit per-row choice.
      if (o.validTill !== undefined && o.validTill !== null) {
        validTillByMember.set(id, o.validTill);
      }
    }
  }
  return runPhase2Grants(
    trx,
    tenantId,
    scope,
    Array.from(targetMemberIds),
    dryRun,
    validTillByMember,
  );
}

/**
 * Run `fn` inside a Postgres SAVEPOINT on the chunk's open transaction, so a
 * failure rolls back only this step and the outer transaction carries on.
 *
 * Written as SQL because Kysely refuses `trx.transaction()` on a Transaction
 * ("calling the transaction method for a Transaction is not supported"). That
 * call used to sit here and threw on EVERY import, before any UPDATE ran, so
 * every merge row was reported as SKIPPED_RACE_CONFLICT with nothing racing.
 */
async function withSavepoint<T>(
  trx: Transaction<DB>,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  await sql.raw(`SAVEPOINT ${name}`).execute(trx);
  try {
    const result = await fn();
    await sql.raw(`RELEASE SAVEPOINT ${name}`).execute(trx);
    return result;
  } catch (err) {
    await sql.raw(`ROLLBACK TO SAVEPOINT ${name}`).execute(trx);
    throw err;
  }
}

async function applyBulkMergePhones(
  trx: Transaction<DB>,
  tenantId: string,
  mergePhones: PhaseOneOutcome[],
): Promise<void> {
  const items = mergePhones
    .map((o) => (o.intent.kind === "MERGE_PHONE" ? o.intent : null))
    .filter((x): x is Extract<PhaseOneOutcome["intent"], { kind: "MERGE_PHONE" }> => x !== null)
    .map((intent) => ({ memberId: intent.memberId, phone: intent.phone }));

  if (items.length === 0) return;

  let mergedIds = new Set<string>();
  let bulkFailed: Error | null = null;
  try {
    // Savepoint: if the UPDATE throws (e.g. unique-violation from a
    // concurrent insert that the IS NULL/NOT EXISTS guards couldn't see),
    // only this savepoint rolls back and the chunk's outer trx continues.
    mergedIds = await withSavepoint(trx, "bulk_merge_phones", () =>
      membersRepository.bulkMergePhones(tenantId, items, trx),
    );
  } catch (err) {
    bulkFailed = err as Error;
    logger.warn(
      `[bulk-imports] bulkMergePhones savepoint rolled back: ${bulkFailed.message}`,
    );
  }

  for (const o of mergePhones) {
    if (o.intent.kind !== "MERGE_PHONE") continue;
    if (bulkFailed || !mergedIds.has(o.intent.memberId)) {
      o.action = "SKIPPED_RACE_CONFLICT";
      o.errorMessage = bulkFailed
        ? `race: bulk phone merge aborted (${bulkFailed.message})`
        : "race: phone already claimed by another member or slot filled concurrently";
      // memberIds preserved: the existing member still exists, Phase 2 may
      // still grant them access.
    }
  }
}

async function applyBulkMergeEmails(
  trx: Transaction<DB>,
  tenantId: string,
  mergeEmails: PhaseOneOutcome[],
): Promise<void> {
  const items = mergeEmails
    .map((o) => (o.intent.kind === "MERGE_EMAIL" ? o.intent : null))
    .filter((x): x is Extract<PhaseOneOutcome["intent"], { kind: "MERGE_EMAIL" }> => x !== null)
    .map((intent) => ({ memberId: intent.memberId, email: intent.email }));

  if (items.length === 0) return;

  let mergedIds = new Set<string>();
  let bulkFailed: Error | null = null;
  try {
    mergedIds = await withSavepoint(trx, "bulk_merge_emails", () =>
      membersRepository.bulkMergeEmails(tenantId, items, trx),
    );
  } catch (err) {
    bulkFailed = err as Error;
    logger.warn(
      `[bulk-imports] bulkMergeEmails savepoint rolled back: ${bulkFailed.message}`,
    );
  }

  for (const o of mergeEmails) {
    if (o.intent.kind !== "MERGE_EMAIL") continue;
    if (bulkFailed || !mergedIds.has(o.intent.memberId)) {
      o.action = "SKIPPED_RACE_CONFLICT";
      o.errorMessage = bulkFailed
        ? `race: bulk email merge aborted (${bulkFailed.message})`
        : "race: email already claimed by another member or slot filled concurrently";
    }
  }
}

/**
 * Re-check that the course / book / batch the operator selected still
 * exists. Called at the top of every write transaction so the preflight
 * does not race against another admin deleting the resource between
 * submission and execution.
 */
async function revalidateScope(
  trx: Transaction<DB>,
  tenantId: string,
  scope: ScopeContext,
): Promise<void> {
  if (scope.scopeType === "COURSE" && scope.scopeId) {
    const course = await trx
      .selectFrom("courses")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", scope.scopeId)
      .executeTakeFirst();
    if (!course) {
      throw new NotFoundError(
        "Course no longer exists in this tenant (deleted between submit and execute).",
      );
    }
    if (scope.batchId) {
      const batch = await trx
        .selectFrom("batches")
        .select(["id", "enrollment_close_date"])
        .where("tenant_id", "=", tenantId)
        .where("id", "=", scope.batchId)
        .executeTakeFirst();
      if (!batch) {
        throw new NotFoundError(
          "Batch no longer exists in this tenant (deleted between submit and execute).",
        );
      }
      if (
        batch.enrollment_close_date &&
        batch.enrollment_close_date.getTime() < Date.now()
      ) {
        throw new BadRequestError(
          "Batch enrollment closed between submit and execute.",
        );
      }
      const item = await trx
        .selectFrom("batch_items")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("batch_id", "=", scope.batchId)
        .where("course_id", "=", scope.scopeId)
        .executeTakeFirst();
      if (!item) {
        throw new BadRequestError(
          "Batch no longer contains this course (removed between submit and execute).",
        );
      }
    }
  } else if (scope.scopeType === "BOOK" && scope.scopeId) {
    const book = await trx
      .selectFrom("books")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", scope.scopeId)
      .executeTakeFirst();
    if (!book) {
      throw new NotFoundError(
        "Book no longer exists in this tenant (deleted between submit and execute).",
      );
    }
  }
}

function collectContactKeys(rawRows: RawParsedRow[]): { emails: string[]; phones: string[] } {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const r of rawRows) {
    const e = normalizeEmail(r.email);
    if (e) emails.add(e);
    const p = normalizePhone(r.phone);
    if (p) phones.add(p);
  }
  return { emails: Array.from(emails), phones: Array.from(phones) };
}

function buildLookupMaps(
  snapshots: Awaited<ReturnType<typeof membersRepository.batchLookupByContact>>,
): {
  byEmail: Map<string, MatchedMemberSnapshot>;
  byPhone: Map<string, MatchedMemberSnapshot>;
} {
  const byEmail = new Map<string, MatchedMemberSnapshot>();
  const byPhone = new Map<string, MatchedMemberSnapshot>();
  for (const s of snapshots) {
    const snap: MatchedMemberSnapshot = {
      id: s.id,
      status: s.status,
      hadEmail: s.email !== null,
      hadPhone: s.phone !== null,
    };
    if (s.email) byEmail.set(s.email, snap);
    if (s.phone) byPhone.set(s.phone, snap);
  }
  return { byEmail, byPhone };
}

function isEligibleForPhase2(o: PhaseOneOutcome, scope: ScopeContext): boolean {
  if (o.memberIds.length === 0) return false;
  if (o.action.startsWith("ERROR_")) return false;
  if (o.action === "SKIPPED_DUPLICATE_IN_FILE") return false;
  // Race-conflict on CREATE clears memberIds (above), so this only catches
  // merge race conflicts where memberIds still points at the existing member.
  // We still grant Phase 2 access to them, same as the prior per-row code.
  if (scope.scopeType === "TENANT") return false;
  if (scope.scopeType === "COURSE" && !scope.scopeId) return false;
  if (scope.scopeType === "BOOK" && !scope.scopeId) return false;
  // Case G ambiguous match is processed for course/book scopes (both members).
  return true;
}

interface Phase2Results {
  courseByMember: Map<string, CourseAction>;
  batchByMember: Map<string, BatchAction>;
  bookByMember: Map<string, BookAction>;
}

async function runPhase2Grants(
  trx: Transaction<DB>,
  tenantId: string,
  scope: ScopeContext,
  memberIds: string[],
  dryRun: boolean,
  validTillByMember: Map<string, Date | "LIFETIME"> = new Map(),
): Promise<Phase2Results> {
  const courseByMember = new Map<string, CourseAction>();
  const batchByMember = new Map<string, BatchAction>();
  const bookByMember = new Map<string, BookAction>();

  if (memberIds.length === 0) {
    return { courseByMember, batchByMember, bookByMember };
  }

  // Per-row expiry from the file wins; otherwise the batch-level "Access valid
  // till"; otherwise the 1-year admin-grant default. Members are grouped by
  // their effective expiry so each distinct date is a single bulk write.
  const batchDefaultValidTill = scope.validTill ?? defaultAdminGrantValidTill();
  const effectiveValidTill = (memberId: string): Date | null => {
    const v = validTillByMember.get(memberId);
    if (v === undefined) return batchDefaultValidTill; // row left it blank
    if (v === "LIFETIME") return null; // explicit lifetime → null valid_till
    return v; // a specific date
  };
  const groupByValidTill = (
    entries: Array<{ id: string; memberId: string }>,
  ): Array<{ validTill: Date | null; ids: string[] }> => {
    const groups = new Map<string, { validTill: Date | null; ids: string[] }>();
    for (const { id, memberId } of entries) {
      const vt = effectiveValidTill(memberId);
      const key = vt ? String(vt.getTime()) : "null";
      let g = groups.get(key);
      if (!g) {
        g = { validTill: vt, ids: [] };
        groups.set(key, g);
      }
      g.ids.push(id);
    }
    return Array.from(groups.values());
  };

  if (scope.scopeType === "COURSE" && scope.scopeId) {
    const existing = await membersRepository.bulkFindEnrollmentsForCourse(
      tenantId,
      scope.scopeId,
      memberIds,
      trx,
    );

    const toCreate: Array<{ id: string; memberId: string }> = []; // id = memberId
    const toReactivate: Array<{ id: string; memberId: string }> = []; // id = enrollment id
    for (const memberId of memberIds) {
      const e = existing.get(memberId);
      if (!e) {
        toCreate.push({ id: memberId, memberId });
        courseByMember.set(memberId, "ENROLLMENT_CREATED");
      } else if (e.status === "ACTIVE") {
        courseByMember.set(memberId, "ENROLLMENT_ALREADY_ACTIVE");
      } else {
        toReactivate.push({ id: e.id, memberId });
        courseByMember.set(memberId, "ENROLLMENT_REACTIVATED");
      }
    }

    if (!dryRun) {
      for (const g of groupByValidTill(toCreate)) {
        await membersRepository.bulkInsertEnrollments(
          tenantId,
          scope.scopeId,
          g.ids,
          g.validTill,
          trx,
        );
      }
      for (const g of groupByValidTill(toReactivate)) {
        await membersRepository.bulkReactivateEnrollments(
          tenantId,
          g.ids,
          g.validTill,
          trx,
        );
      }
    }

    if (scope.batchId) {
      const existingBatch = await membersRepository.bulkFindBatchEnrollments(
        tenantId,
        scope.batchId,
        memberIds,
        trx,
      );
      const batchToCreate: Array<{ id: string; memberId: string }> = [];
      const batchToReactivate: Array<{ id: string; memberId: string }> = [];
      for (const memberId of memberIds) {
        const e = existingBatch.get(memberId);
        if (!e) {
          batchToCreate.push({ id: memberId, memberId });
          batchByMember.set(memberId, "BATCH_ENROLLMENT_CREATED");
        } else if (e.status === "ACTIVE") {
          batchByMember.set(memberId, "BATCH_ENROLLMENT_ALREADY_ACTIVE");
        } else {
          batchToReactivate.push({ id: e.id, memberId });
          batchByMember.set(memberId, "BATCH_ENROLLMENT_REACTIVATED");
        }
      }
      if (!dryRun) {
        for (const g of groupByValidTill(batchToCreate)) {
          await membersRepository.bulkInsertBatchEnrollments(
            tenantId,
            scope.batchId,
            g.ids,
            g.validTill,
            trx,
          );
        }
        for (const g of groupByValidTill(batchToReactivate)) {
          await membersRepository.bulkReactivateBatchEnrollments(
            tenantId,
            g.ids,
            g.validTill,
            trx,
          );
        }
      }
    }
  } else if (scope.scopeType === "BOOK" && scope.scopeId) {
    const existing = await membersRepository.bulkFindBookAccessForBook(
      tenantId,
      scope.scopeId,
      memberIds,
      trx,
    );
    const toCreate: Array<{ id: string; memberId: string }> = [];
    const toReactivate: Array<{ id: string; memberId: string }> = [];
    for (const memberId of memberIds) {
      const e = existing.get(memberId);
      if (!e) {
        toCreate.push({ id: memberId, memberId });
        bookByMember.set(memberId, "BOOK_ACCESS_CREATED");
      } else if (e.status === "ACTIVE") {
        bookByMember.set(memberId, "BOOK_ACCESS_ALREADY_ACTIVE");
      } else {
        toReactivate.push({ id: e.id, memberId });
        bookByMember.set(memberId, "BOOK_ACCESS_REACTIVATED");
      }
    }
    if (!dryRun) {
      for (const g of groupByValidTill(toCreate)) {
        await membersRepository.bulkInsertBookAccess(
          tenantId,
          scope.scopeId,
          g.ids,
          g.validTill,
          trx,
        );
      }
      for (const g of groupByValidTill(toReactivate)) {
        await membersRepository.bulkReactivateBookAccess(
          tenantId,
          g.ids,
          g.validTill,
          trx,
        );
      }
    }
  }

  return { courseByMember, batchByMember, bookByMember };
}

function buildReportEntry(
  outcome: PhaseOneOutcome,
  rawRows: RawParsedRow[],
  scope: ScopeContext,
  phase2: Phase2Results,
): PerRowReportEntry {
  const raw = rawRows.find((r) => r.rowNumber === outcome.rowNumber);
  let courseAction: CourseAction | null = null;
  let batchAction: BatchAction | null = scope.scopeType === "COURSE" ? "N/A" : null;
  let bookAction: BookAction | null = null;

  if (isEligibleForPhase2(outcome, scope)) {
    if (scope.scopeType === "COURSE") {
      courseAction = pickCourseAction(outcome.memberIds, phase2.courseByMember);
      if (scope.batchId) {
        batchAction = pickBatchAction(outcome.memberIds, phase2.batchByMember);
      }
    } else if (scope.scopeType === "BOOK") {
      bookAction = pickBookAction(outcome.memberIds, phase2.bookByMember);
    }
  }

  return {
    rowNumber: outcome.rowNumber,
    name: raw?.name ?? null,
    email: raw?.email ?? null,
    phone: raw?.phone ?? null,
    memberAction: outcome.action,
    memberIds: outcome.memberIds,
    memberStatusAtGrant: outcome.memberStatusAtGrant,
    courseAction,
    batchAction,
    bookAction,
    rowValidTill: formatRowValidTill(outcome.validTill),
    errorMessage: outcome.errorMessage ?? null,
  };
}

/**
 * Renders a row's parsed valid_till for the per-row report:
 * an explicit date as "YYYY-MM-DD", explicit lifetime as "LIFETIME",
 * and a blank cell as null (the row falls back to the batch default).
 */
function formatRowValidTill(validTill: RowValidity | undefined): string | null {
  if (validTill === "LIFETIME") return "LIFETIME";
  if (validTill instanceof Date) return validTill.toISOString().slice(0, 10);
  return null;
}

const COURSE_PRIORITY: Record<CourseAction, number> = {
  ENROLLMENT_CREATED: 3,
  ENROLLMENT_REACTIVATED: 2,
  ENROLLMENT_ALREADY_ACTIVE: 1,
};
const BATCH_PRIORITY: Record<BatchAction, number> = {
  BATCH_ENROLLMENT_CREATED: 3,
  BATCH_ENROLLMENT_REACTIVATED: 2,
  BATCH_ENROLLMENT_ALREADY_ACTIVE: 1,
  "N/A": 0,
};
const BOOK_PRIORITY: Record<BookAction, number> = {
  BOOK_ACCESS_CREATED: 3,
  BOOK_ACCESS_REACTIVATED: 2,
  BOOK_ACCESS_ALREADY_ACTIVE: 1,
};

function pickCourseAction(memberIds: string[], byMember: Map<string, CourseAction>): CourseAction | null {
  let best: CourseAction | null = null;
  for (const id of memberIds) {
    const a = byMember.get(id);
    if (!a) continue;
    if (!best || COURSE_PRIORITY[a] > COURSE_PRIORITY[best]) best = a;
  }
  return best;
}

function pickBatchAction(memberIds: string[], byMember: Map<string, BatchAction>): BatchAction {
  let best: BatchAction = "N/A";
  for (const id of memberIds) {
    const a = byMember.get(id);
    if (!a) continue;
    if (BATCH_PRIORITY[a] > BATCH_PRIORITY[best]) best = a;
  }
  return best;
}

function pickBookAction(memberIds: string[], byMember: Map<string, BookAction>): BookAction | null {
  let best: BookAction | null = null;
  for (const id of memberIds) {
    const a = byMember.get(id);
    if (!a) continue;
    if (!best || BOOK_PRIORITY[a] > BOOK_PRIORITY[best]) best = a;
  }
  return best;
}

/**
 * Legacy single-action helpers retained for the companion bulk-enroll flow.
 * Both delegate to runPhase2Grants and aggregate per-member outcomes into
 * the single-priority action enum the older callers expect.
 */
export async function grantCourseAccessForMembers(
  tenantId: string,
  memberIds: string[],
  courseId: string,
  batchId: string | null,
  validTill: Date | null,
  dryRun: boolean,
): Promise<{ courseAction: CourseAction; batchAction: BatchAction }> {
  if (memberIds.length === 0) {
    return {
      courseAction: "ENROLLMENT_ALREADY_ACTIVE",
      batchAction: batchId ? "BATCH_ENROLLMENT_ALREADY_ACTIVE" : "N/A",
    };
  }
  const scope: ScopeContext = {
    scopeType: "COURSE",
    scopeId: courseId,
    batchId,
    validTill,
  };
  const phase2 = await db.transaction().execute((trx) =>
    runPhase2Grants(trx, tenantId, scope, memberIds, dryRun),
  );
  const courseAction =
    pickCourseAction(memberIds, phase2.courseByMember) ?? "ENROLLMENT_ALREADY_ACTIVE";
  const batchAction = batchId
    ? pickBatchAction(memberIds, phase2.batchByMember)
    : "N/A";
  return { courseAction, batchAction };
}

export async function grantBookAccessForMembers(
  tenantId: string,
  memberIds: string[],
  bookId: string,
  validTill: Date | null,
  dryRun: boolean,
): Promise<BookAction> {
  if (memberIds.length === 0) return "BOOK_ACCESS_ALREADY_ACTIVE";
  const scope: ScopeContext = {
    scopeType: "BOOK",
    scopeId: bookId,
    batchId: null,
    validTill,
  };
  const phase2 = await db.transaction().execute((trx) =>
    runPhase2Grants(trx, tenantId, scope, memberIds, dryRun),
  );
  return pickBookAction(memberIds, phase2.bookByMember) ?? "BOOK_ACCESS_ALREADY_ACTIVE";
}

/**
 * Per-member variant used by the companion bulk-enroll flow. Re-validates
 * the scope INSIDE the transaction (closes TOCTOU vs. preflight), then
 * runs a single batched Phase 2 across all members.
 *
 * Large memberId sets are chunked the same way the CSV flow chunks, so a
 * single chunk failure doesn't kill the rest of the enrollment.
 */
export async function grantPhase2PerMember(
  tenantId: string,
  scope: ScopeContext,
  memberIds: string[],
  dryRun: boolean,
): Promise<Phase2Results> {
  const combined: Phase2Results = {
    courseByMember: new Map(),
    batchByMember: new Map(),
    bookByMember: new Map(),
  };
  if (memberIds.length === 0) return combined;

  const chunkSize = dryRun || memberIds.length <= BULK_IMPORT_CHUNK_SIZE
    ? memberIds.length
    : BULK_IMPORT_CHUNK_SIZE;

  for (let start = 0; start < memberIds.length; start += chunkSize) {
    const slice = memberIds.slice(start, start + chunkSize);
    try {
      const chunkResults = await db.transaction().execute(async (trx) => {
        await revalidateScope(trx, tenantId, scope);
        return runPhase2Grants(trx, tenantId, scope, slice, dryRun);
      });
      for (const [k, v] of chunkResults.courseByMember) combined.courseByMember.set(k, v);
      for (const [k, v] of chunkResults.batchByMember) combined.batchByMember.set(k, v);
      for (const [k, v] of chunkResults.bookByMember) combined.bookByMember.set(k, v);
    } catch (err) {
      logger.error(
        `[bulk-enroll] chunk ${start}-${start + slice.length - 1} failed: ${(err as Error).message}`,
      );
      // Don't mark per-member outcomes, the caller (bulk-enroll service)
      // sees missing entries in the action maps and treats them as the
      // default ("no grant action") so the per-row report stays consistent.
    }
  }

  return combined;
}

function tallyCounters(counters: BulkImportCounters, entry: PerRowReportEntry): void {
  if (entry.memberAction === "CREATED") counters.createdCount++;
  else if (entry.memberAction.startsWith("MERGED_")) counters.mergedCount++;
  else if (entry.memberAction.startsWith("SKIPPED_")) counters.skippedCount++;
  else if (entry.memberAction.startsWith("ERROR_")) counters.errorCount++;

  // Each granted enrollment/book access counts once (per resolved member id).
  if (entry.courseAction === "ENROLLMENT_CREATED" || entry.courseAction === "ENROLLMENT_REACTIVATED") {
    counters.grantedCount += entry.memberIds.length;
  }
  if (entry.bookAction === "BOOK_ACCESS_CREATED" || entry.bookAction === "BOOK_ACCESS_REACTIVATED") {
    counters.grantedCount += entry.memberIds.length;
  }
}

async function preflightScope(tenantId: string, scope: ScopeContext): Promise<void> {
  if (scope.validTill && scope.validTill.getTime() <= Date.now()) {
    throw new BadRequestError("validTill must be in the future.");
  }

  if (scope.scopeType === "COURSE") {
    if (!scope.scopeId) throw new BadRequestError("courseId is required for course scope.");
    const course = await db
      .selectFrom("courses")
      .select(["id", "mode"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", scope.scopeId)
      .executeTakeFirst();
    if (!course) throw new NotFoundError("Course not found in this tenant.");

    if (scope.batchId) {
      const batch = await db
        .selectFrom("batches")
        .select(["id", "enrollment_close_date"])
        .where("tenant_id", "=", tenantId)
        .where("id", "=", scope.batchId)
        .executeTakeFirst();
      if (!batch) throw new NotFoundError("Batch not found in this tenant.");
      if (batch.enrollment_close_date && batch.enrollment_close_date.getTime() < Date.now()) {
        throw new BadRequestError("Batch enrollment is closed.");
      }
      const item = await db
        .selectFrom("batch_items")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("batch_id", "=", scope.batchId)
        .where("course_id", "=", scope.scopeId)
        .executeTakeFirst();
      if (!item) {
        throw new BadRequestError("Selected batch does not contain this course.");
      }
    }
  }

  if (scope.scopeType === "BOOK") {
    if (!scope.scopeId) throw new BadRequestError("bookId is required for book scope.");
    const book = await db
      .selectFrom("books")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", scope.scopeId)
      .executeTakeFirst();
    if (!book) throw new NotFoundError("Book not found in this tenant.");
  }
}

function serializeScope(scope: ScopeContext): {
  scopeType: tenant_bulk_import_scope_type;
  scopeId: string | null;
  batchId: string | null;
  validTill: string | null;
} {
  return {
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    batchId: scope.batchId,
    validTill: scope.validTill ? scope.validTill.toISOString() : null,
  };
}

export function deserializeScope(input: ReturnType<typeof serializeScope>): ScopeContext {
  return {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    batchId: input.batchId,
    validTill: input.validTill ? new Date(input.validTill) : null,
  };
}

export function buildReportCsv(perRow: PerRowReportEntry[]): Buffer {
  const header =
    "row_number,name,email,phone,member_action,member_ids,member_status_at_grant,course_action,batch_action,book_action,target_action,valid_till,error_message";
  const lines = [header];
  for (const r of perRow) {
    lines.push(
      [
        r.rowNumber,
        csvField(r.name),
        csvField(r.email),
        csvField(r.phone),
        r.memberAction,
        csvField(r.memberIds.join("|")),
        csvField(r.memberStatusAtGrant.join("|")),
        r.courseAction ?? "",
        r.batchAction ?? "",
        r.bookAction ?? "",
        r.targetAction ?? "",
        csvField(r.rowValidTill),
        csvField(r.errorMessage),
      ].join(","),
    );
  }
  return Buffer.from(lines.join("\n") + "\n", "utf-8");
}

function csvField(v: string | null | undefined): string {
  if (v === null || v === undefined) return "";
  const needsQuote = /[",\n\r]/.test(v);
  const escaped = v.replace(/"/g, "\"\"");
  return needsQuote ? `"${escaped}"` : escaped;
}

// Re-export so workers can call directly without re-importing internals.
export { bulkImportsQueue };

const bulkImportsService = new BulkImportsService();
export default bulkImportsService;
