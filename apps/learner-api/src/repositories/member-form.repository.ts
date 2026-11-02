import { ulid } from "ulid";

import { db } from "../db/connection";

export interface MemberFormConfigRow {
  id: string;
  tenant_id: string;
  name: string;
  mode: string;
  active: boolean;
  sort_order: number;
  reprompt_after_hours: number;
  title: string;
  description: string | null;
  fields: unknown;
  created_at: Date;
  updated_at: Date;
}

class MemberFormRepository {
  /** Active forms for a tenant, in the admin-defined appearance order. */
  async listActiveForms(tenantId: string): Promise<MemberFormConfigRow[]> {
    return db
      .selectFrom("tenant_member_form_config")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("active", "=", true)
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc")
      .execute();
  }

  /** A single active form (used to validate a submission target). */
  async getActiveForm(
    tenantId: string,
    formId: string
  ): Promise<MemberFormConfigRow | undefined> {
    return db
      .selectFrom("tenant_member_form_config")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", formId)
      .where("active", "=", true)
      .executeTakeFirst();
  }

  /** Set of form ids this member has already completed. */
  async getCompletedFormIds(
    tenantId: string,
    memberId: string
  ): Promise<Set<string>> {
    const rows = await db
      .selectFrom("tenant_member_form_responses")
      .select("form_id")
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .execute();
    return new Set(rows.map((r) => r.form_id));
  }

  /**
   * Idempotent per (tenant, form, member): the unique constraint guarantees a
   * single response row per form, so a re-submit updates the payload in place.
   */
  async upsertResponse(
    tenantId: string,
    formId: string,
    memberId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const now = new Date();
    const existing = await db
      .selectFrom("tenant_member_form_responses")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("form_id", "=", formId)
      .where("member_id", "=", memberId)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable("tenant_member_form_responses")
        .set({ data: JSON.stringify(data), updated_at: now })
        .where("tenant_id", "=", tenantId)
        .where("form_id", "=", formId)
        .where("member_id", "=", memberId)
        .execute();
      return;
    }

    await db
      .insertInto("tenant_member_form_responses")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        form_id: formId,
        member_id: memberId,
        data: JSON.stringify(data),
        completed_at: now,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
}

export default new MemberFormRepository();
