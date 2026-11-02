import { ulid } from "ulid";

import { db } from "../db/connection";
import type {
  tenant_bulk_import_scope_type,
  tenant_bulk_import_source,
  tenant_bulk_import_status,
} from "../db/enums";
import type { BulkImportCounters } from "../types/bulk-imports.type";

export interface CreateJobInput {
  tenantId: string;
  actingUserId: string;
  scopeType: tenant_bulk_import_scope_type;
  scopeId: string | null;
  source: tenant_bulk_import_source;
  originalFilename: string | null;
  totalRows: number;
}

export interface BulkImportJobRow {
  id: string;
  tenant_id: string;
  acting_user_id: string;
  scope_type: tenant_bulk_import_scope_type;
  scope_id: string | null;
  source: tenant_bulk_import_source;
  status: tenant_bulk_import_status;
  original_filename: string | null;
  total_rows: number;
  created_count: number;
  merged_count: number;
  granted_count: number;
  skipped_count: number;
  error_count: number;
  report_s3_key: string | null;
  failure_reason: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

class BulkImportsRepository {
  async create(input: CreateJobInput): Promise<BulkImportJobRow> {
    const now = new Date();
    const row = await db
      .insertInto("tenant_bulk_imports")
      .values({
        id: ulid(),
        tenant_id: input.tenantId,
        acting_user_id: input.actingUserId,
        scope_type: input.scopeType,
        scope_id: input.scopeId,
        source: input.source,
        status: "QUEUED",
        original_filename: input.originalFilename,
        total_rows: input.totalRows,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as BulkImportJobRow;
  }

  async markProcessing(tenantId: string, jobId: string): Promise<void> {
    await db
      .updateTable("tenant_bulk_imports")
      .set({
        status: "PROCESSING",
        started_at: new Date(),
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", jobId)
      .execute();
  }

  async markCompleted(
    tenantId: string,
    jobId: string,
    counters: BulkImportCounters,
    reportS3Key: string | null,
  ): Promise<void> {
    const now = new Date();
    await db
      .updateTable("tenant_bulk_imports")
      .set({
        status: "COMPLETED",
        created_count: counters.createdCount,
        merged_count: counters.mergedCount,
        granted_count: counters.grantedCount,
        skipped_count: counters.skippedCount,
        error_count: counters.errorCount,
        report_s3_key: reportS3Key,
        completed_at: now,
        updated_at: now,
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", jobId)
      .execute();
  }

  async markFailed(
    tenantId: string,
    jobId: string,
    failureReason: string,
  ): Promise<void> {
    const now = new Date();
    await db
      .updateTable("tenant_bulk_imports")
      .set({
        status: "FAILED",
        failure_reason: failureReason,
        completed_at: now,
        updated_at: now,
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", jobId)
      .execute();
  }

  async findById(
    tenantId: string,
    jobId: string,
  ): Promise<BulkImportJobRow | undefined> {
    return db
      .selectFrom("tenant_bulk_imports")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", jobId)
      .executeTakeFirst() as Promise<BulkImportJobRow | undefined>;
  }

  async list(
    tenantId: string,
    params: {
      page: number;
      limit: number;
      scopeType?: tenant_bulk_import_scope_type;
      scopeId?: string;
    },
  ): Promise<{ jobs: BulkImportJobRow[]; total: number }> {
    let q = db
      .selectFrom("tenant_bulk_imports")
      .where("tenant_id", "=", tenantId);

    if (params.scopeType) q = q.where("scope_type", "=", params.scopeType);
    if (params.scopeId) q = q.where("scope_id", "=", params.scopeId);

    const countRow = await q
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    const total =
      typeof countRow.count === "string"
        ? parseInt(countRow.count, 10)
        : Number(countRow.count ?? 0);

    const jobs = (await q
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(params.limit)
      .offset((params.page - 1) * params.limit)
      .execute()) as BulkImportJobRow[];

    return { jobs, total };
  }
}

export default new BulkImportsRepository();
