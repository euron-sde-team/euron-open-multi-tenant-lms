/**
 * Suppression, per-tenant block list.
 *
 * Two scopes:
 *   - category_scope = NULL    -> blocks ALL categories (full unsubscribe,
 *                                 hard bounce, admin block)
 *   - category_scope = X       -> blocks only category X (e.g. user
 *                                 unsubscribed from marketing only)
 *
 * A suppression with category_scope=NULL OR matching the send category is a
 * block. Tested in a single query.
 *
 * Lowercase the email at every boundary before compare/insert; the schema
 * stores lowercased rows.
 */

import { ulid } from "ulid";
import { sql } from "kysely";
import { db } from "../../db/connection";
import type { email_message_category, email_suppression_reason } from "../../db/enums";

export interface SuppressionRow {
  id: string;
  tenantId: string;
  email: string;
  reason: email_suppression_reason;
  sourceMessageId: string | null;
  categoryScope: email_message_category | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddSuppressionInput {
  tenantId: string;
  email: string;
  reason: email_suppression_reason;
  sourceMessageId?: string | null;
  categoryScope?: email_message_category | null;
  notes?: string | null;
}

export interface ListSuppressionsParams {
  page?: number;
  limit?: number;
  search?: string;
  reason?: email_suppression_reason;
  categoryScope?: email_message_category | null;
}

export interface ListSuppressionsResult {
  rows: SuppressionRow[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Check whether `email` is blocked from receiving `category` for `tenantId`.
 * Returns true if ANY row exists with category_scope = NULL OR = category.
 */
export async function isSuppressed(
  tenantId: string,
  email: string,
  category: email_message_category,
): Promise<boolean> {
  const lowercased = email.toLowerCase();
  const row = await db
    .selectFrom("tenant_email_suppressions")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("email", "=", lowercased)
    .where((eb) =>
      eb.or([
        eb("category_scope", "is", null),
        eb("category_scope", "=", category),
      ]),
    )
    .limit(1)
    .executeTakeFirst();
  return !!row;
}

/**
 * Add a suppression. Idempotent via the (tenant_id, email, category_scope)
 * unique constraint, duplicates are silently skipped.
 */
export async function addSuppression(input: AddSuppressionInput): Promise<void> {
  const lowercased = input.email.toLowerCase();
  const now = new Date();
  await db
    .insertInto("tenant_email_suppressions")
    .values({
      id: ulid(),
      tenant_id: input.tenantId,
      email: lowercased,
      reason: input.reason,
      source_message_id: input.sourceMessageId ?? null,
      category_scope: input.categoryScope ?? null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.columns(["tenant_id", "email", "category_scope"]).doNothing(),
    )
    .execute();
}

/**
 * Remove a suppression. If category_scope omitted, removes ALL suppressions
 * for that email (both global and category-scoped).
 */
export async function removeSuppression(
  tenantId: string,
  email: string,
  categoryScope?: email_message_category | null,
): Promise<void> {
  const lowercased = email.toLowerCase();
  let query = db
    .deleteFrom("tenant_email_suppressions")
    .where("tenant_id", "=", tenantId)
    .where("email", "=", lowercased);
  if (categoryScope !== undefined) {
    query =
      categoryScope === null
        ? query.where("category_scope", "is", null)
        : query.where("category_scope", "=", categoryScope);
  }
  await query.execute();
}

export async function listSuppressions(
  tenantId: string,
  params: ListSuppressionsParams = {},
): Promise<ListSuppressionsResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));
  const offset = (page - 1) * limit;

  let countQuery = db
    .selectFrom("tenant_email_suppressions")
    .select(db.fn.count<number>("id").as("count"))
    .where("tenant_id", "=", tenantId);
  let listQuery = db
    .selectFrom("tenant_email_suppressions")
    .selectAll()
    .where("tenant_id", "=", tenantId);

  if (params.search) {
    const pattern = `%${params.search.toLowerCase()}%`;
    countQuery = countQuery.where("email", "like", pattern);
    listQuery = listQuery.where("email", "like", pattern);
  }
  if (params.reason) {
    countQuery = countQuery.where("reason", "=", params.reason);
    listQuery = listQuery.where("reason", "=", params.reason);
  }
  if (params.categoryScope !== undefined) {
    if (params.categoryScope === null) {
      countQuery = countQuery.where("category_scope", "is", null);
      listQuery = listQuery.where("category_scope", "is", null);
    } else {
      countQuery = countQuery.where("category_scope", "=", params.categoryScope);
      listQuery = listQuery.where("category_scope", "=", params.categoryScope);
    }
  }

  const [countResult, rows] = await Promise.all([
    countQuery.executeTakeFirst(),
    listQuery
      .orderBy("created_at", sql`DESC`)
      .limit(limit)
      .offset(offset)
      .execute(),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      email: r.email,
      reason: r.reason,
      sourceMessageId: r.source_message_id,
      categoryScope: r.category_scope,
      notes: r.notes,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    })),
    total: Number(countResult?.count ?? 0),
    page,
    limit,
  };
}
