import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { db } from "../db/connection";
import type { DB } from "../db/types";

export interface BulkCertItemInput {
  recipientName: string;
  email: string | null;
  tenantMemberId: string | null;
  certificateNumber: string;
  issuedAt: Date;
}

export interface RecipientContact {
  name: string;
  email: string;
}

class BulkCertificateRepository {
  /**
   * Returns the subset of `numbers` already taken by either the regular
   * certificates table or an existing bulk certificate for this tenant. Used to
   * guarantee a freshly generated certificate number is globally unique within
   * the tenant before it is inserted.
   */
  async findTakenCertNumbers(
    tenantId: string,
    numbers: string[],
    trx?: Transaction<DB>,
  ): Promise<Set<string>> {
    if (numbers.length === 0) return new Set();
    const conn = trx || db;
    const [bulk, regular] = await Promise.all([
      conn
        .selectFrom("bulk_certificates")
        .select("certificate_number")
        .where("tenant_id", "=", tenantId)
        .where("certificate_number", "in", numbers)
        .execute(),
      conn
        .selectFrom("certificates")
        .select("certificate_number")
        .where("tenant_id", "=", tenantId)
        .where("certificate_number", "in", numbers)
        .execute(),
    ]);
    const taken = new Set<string>();
    for (const r of bulk) taken.add(r.certificate_number);
    for (const r of regular) taken.add(r.certificate_number);
    return taken;
  }

  async createBatchWithItems(params: {
    tenantId: string;
    title: string;
    templateId: string;
    /** A custom design and its snapshot, when the batch uses one. */
    certificateTemplateId?: string | null;
    templateSnapshot?: unknown;
    signatoryName: string | null;
    signatoryTitle: string | null;
    createdBy: string | null;
    items: BulkCertItemInput[];
  }): Promise<{ batchId: string }> {
    const batchId = ulid();
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("certificate_batches")
        .values({
          id: batchId,
          tenant_id: params.tenantId,
          title: params.title,
          template_id: params.templateId,
          certificate_template_id: params.certificateTemplateId ?? null,
          // U+0000 is rejected by PostgreSQL JSON, so strip it from user text.
          template_snapshot:
            params.templateSnapshot == null
              ? null
              : JSON.stringify(params.templateSnapshot).replace(/\\u0000/g, ""),
          signatory_name: params.signatoryName,
          signatory_title: params.signatoryTitle,
          total_count: params.items.length,
          created_by: params.createdBy,
          created_at: now,
          updated_at: now,
        })
        .execute();

      if (params.items.length > 0) {
        await trx
          .insertInto("bulk_certificates")
          .values(
            params.items.map((it) => ({
              id: ulid(),
              tenant_id: params.tenantId,
              batch_id: batchId,
              recipient_name: it.recipientName,
              email: it.email,
              tenant_member_id: it.tenantMemberId,
              certificate_number: it.certificateNumber,
              // Set explicitly rather than trusting the column default, so rows
              // are always a valid status and stay sendable.
              status: "ISSUED",
              issued_at: it.issuedAt,
              created_at: now,
              updated_at: now,
            })),
          )
          .execute();
      }
    });

    return { batchId };
  }

  async listBatches(tenantId: string) {
    return db
      .selectFrom("certificate_batches")
      .select([
        "id",
        "title",
        "template_id",
        "certificate_template_id",
        "template_snapshot",
        "signatory_name",
        "signatory_title",
        "total_count",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .execute();
  }

  async getBatch(tenantId: string, batchId: string) {
    return db
      .selectFrom("certificate_batches")
      .select([
        "id",
        "title",
        "template_id",
        "certificate_template_id",
        "template_snapshot",
        "signatory_name",
        "signatory_title",
        "total_count",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", batchId)
      .executeTakeFirst();
  }

  async getBatchItems(tenantId: string, batchId: string) {
    return db
      .selectFrom("bulk_certificates")
      .select([
        "id",
        "recipient_name",
        "email",
        "tenant_member_id",
        "certificate_number",
        "status",
        "issued_at",
        "emailed_at",
      ])
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .orderBy("created_at", "asc")
      .execute();
  }

  /** Map normalized email → active member { id, name } for this tenant. */
  async findMembersByEmail(
    tenantId: string,
    emails: string[],
  ): Promise<Map<string, { id: string; name: string }>> {
    const map = new Map<string, { id: string; name: string }>();
    const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
    if (unique.length === 0) return map;
    const rows = await db
      .selectFrom("tenant_members")
      .select(["id", "name", "email"])
      .where("tenant_id", "=", tenantId)
      .where("email", "in", unique)
      .execute();
    for (const r of rows) {
      if (r.email) map.set(r.email.toLowerCase(), { id: r.id, name: r.name });
    }
    return map;
  }

  /** Resolve active members enrolled in a course → { name, email }. */
  async getCourseRecipients(
    tenantId: string,
    courseId: string,
  ): Promise<RecipientContact[]> {
    const rows = await db
      .selectFrom("enrollments")
      .innerJoin("tenant_members", "tenant_members.id", "enrollments.tenant_member_id")
      .select(["tenant_members.name as name", "tenant_members.email as email"])
      .where("enrollments.tenant_id", "=", tenantId)
      .where("enrollments.course_id", "=", courseId)
      .where("enrollments.status", "=", "ACTIVE")
      .where("tenant_members.email", "is not", null)
      .execute();
    return rows
      .filter((r): r is { name: string; email: string } => !!r.email)
      .map((r) => ({ name: r.name, email: r.email.toLowerCase() }));
  }

  /** Resolve active purchasers/grantees of a book → { name, email }. */
  async getBookRecipients(
    tenantId: string,
    bookId: string,
  ): Promise<RecipientContact[]> {
    const rows = await db
      .selectFrom("book_access")
      .innerJoin("tenant_members", "tenant_members.id", "book_access.tenant_member_id")
      .select(["tenant_members.name as name", "tenant_members.email as email"])
      .where("book_access.tenant_id", "=", tenantId)
      .where("book_access.book_id", "=", bookId)
      .where("book_access.status", "=", "ACTIVE")
      .where("tenant_members.email", "is not", null)
      .execute();
    return rows
      .filter((r): r is { name: string; email: string } => !!r.email)
      .map((r) => ({ name: r.name, email: r.email.toLowerCase() }));
  }

  /** Sendable items for a batch: those with a recipient email. */
  async getSendableItems(tenantId: string, batchId: string) {
    return db
      .selectFrom("bulk_certificates")
      .select(["id", "recipient_name", "email", "certificate_number", "emailed_at"])
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      // Send anything that isn't revoked. Null-safe on purpose: rows created
      // without an explicit status must still be sendable, otherwise a strict
      // `status = 'ISSUED'` match silently drops every recipient.
      .where(sql<boolean>`(status is null or status <> 'REVOKED')`)
      .where("email", "is not", null)
      // Never re-send to an already-emailed recipient. Failed sends are NOT
      // stamped emailed_at (see sendBatch), so they stay sendable on retry.
      .where("emailed_at", "is", null)
      .execute();
  }

  /** Stamp emailed_at on the given bulk certificate rows. */
  async markEmailed(
    tenantId: string,
    ids: string[],
    when: Date,
  ): Promise<void> {
    if (ids.length === 0) return;
    await db
      .updateTable("bulk_certificates")
      .set({ emailed_at: when, updated_at: when })
      .where("tenant_id", "=", tenantId)
      .where("id", "in", ids)
      .execute();
  }

  async deleteBatch(tenantId: string, batchId: string): Promise<number> {
    const res = await db
      .deleteFrom("certificate_batches")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", batchId)
      .executeTakeFirst();
    return Number(res.numDeletedRows ?? 0);
  }
}

export const bulkCertificateRepository = new BulkCertificateRepository();
export default bulkCertificateRepository;
