import { sql } from "kysely";

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

export interface CreateMemberFormConfigData {
  name: string;
  mode: string;
  active: boolean;
  sort_order: number;
  reprompt_after_hours: number;
  title: string;
  description: string | null;
  fields: unknown[];
}

export interface UpdateMemberFormConfigData {
  name: string;
  mode: string;
  active: boolean;
  reprompt_after_hours: number;
  title: string;
  description: string | null;
  fields: unknown[];
}

export interface MemberFormResponseRow {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string | null;
  member_phone: string | null;
  data: unknown;
  completed_at: Date;
}

export interface MemberResponseAcrossFormsRow {
  form_id: string;
  form_name: string;
  fields: unknown;
  data: unknown;
  completed_at: Date;
}

export interface ListResponsesResult {
  responses: MemberFormResponseRow[];
  total: number;
}

/** Lightweight projection for the forms list page (no `fields` blob). */
export interface MemberFormSummaryRow {
  id: string;
  name: string;
  mode: string;
  active: boolean;
  sort_order: number;
  updated_at: Date;
  field_count: number;
  response_count: number;
}

const toInt = (val: unknown): number =>
  typeof val === "string" ? parseInt(val, 10) : Number(val ?? 0);

class MemberFormConfigRepository {
  /** All forms for a tenant, in appearance order. */
  async listByTenant(tenantId: string): Promise<MemberFormConfigRow[]> {
    return db
      .selectFrom("tenant_member_form_config")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc")
      .execute();
  }

  async findById(
    tenantId: string,
    formId: string
  ): Promise<MemberFormConfigRow | undefined> {
    return db
      .selectFrom("tenant_member_form_config")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", formId)
      .executeTakeFirst();
  }

  /**
   * One-shot summary for the forms list page. Optimised so the list endpoint
   * stays fast as response volume grows:
   *  - field count is computed in SQL via jsonb_array_length, so we never
   *    transfer the (potentially large) `fields` JSON for every form;
   *  - per-form response counts are aggregated once in a grouped LEFT JOIN that
   *    rides the (tenant_id, form_id) index, in a single round trip;
   *  - a jsonb_typeof guard keeps a malformed row from erroring the whole list.
   */
  async listSummariesByTenant(
    tenantId: string
  ): Promise<MemberFormSummaryRow[]> {
    const result = await sql<{
      id: string;
      name: string;
      mode: string;
      active: boolean;
      sort_order: number;
      updated_at: Date;
      field_count: number | string;
      response_count: number | string;
    }>`
      SELECT
        c.id,
        c.name,
        c.mode,
        c.active,
        c.sort_order,
        c.updated_at,
        COALESCE(
          CASE WHEN jsonb_typeof(c.fields) = 'array'
               THEN jsonb_array_length(c.fields) END,
          0
        ) AS field_count,
        COALESCE(r.cnt, 0) AS response_count
      FROM tenant_member_form_config c
      LEFT JOIN (
        SELECT form_id, COUNT(*) AS cnt
        FROM tenant_member_form_responses
        WHERE tenant_id = ${tenantId}
        GROUP BY form_id
      ) r ON r.form_id = c.id
      WHERE c.tenant_id = ${tenantId}
      ORDER BY c.sort_order ASC, c.created_at ASC
    `.execute(db);

    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      mode: r.mode,
      active: r.active,
      sort_order: toInt(r.sort_order),
      updated_at: r.updated_at,
      field_count: toInt(r.field_count),
      response_count: toInt(r.response_count),
    }));
  }

  async maxSortOrder(tenantId: string): Promise<number> {
    const row = await db
      .selectFrom("tenant_member_form_config")
      .select((eb) => eb.fn.max("sort_order").as("max"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return row?.max == null ? -1 : toInt(row.max);
  }

  async create(
    id: string,
    tenantId: string,
    data: CreateMemberFormConfigData
  ): Promise<MemberFormConfigRow> {
    const now = new Date();
    await db
      .insertInto("tenant_member_form_config")
      .values({
        id,
        tenant_id: tenantId,
        name: data.name,
        mode: data.mode,
        active: data.active,
        sort_order: data.sort_order,
        reprompt_after_hours: data.reprompt_after_hours,
        title: data.title,
        description: data.description,
        fields: JSON.stringify(data.fields),
        created_at: now,
        updated_at: now,
      })
      .execute();
    return (await this.findById(tenantId, id))!;
  }

  async update(
    tenantId: string,
    formId: string,
    data: UpdateMemberFormConfigData
  ): Promise<MemberFormConfigRow | undefined> {
    const result = await db
      .updateTable("tenant_member_form_config")
      .set({
        name: data.name,
        mode: data.mode,
        active: data.active,
        reprompt_after_hours: data.reprompt_after_hours,
        title: data.title,
        description: data.description,
        fields: JSON.stringify(data.fields),
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", formId)
      .executeTakeFirst();

    if (!result.numUpdatedRows || Number(result.numUpdatedRows) === 0) {
      return undefined;
    }
    return this.findById(tenantId, formId);
  }

  async delete(tenantId: string, formId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("tenant_member_form_config")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", formId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  /** Persist a new appearance order; index in the array becomes sort_order. */
  async reorder(tenantId: string, orderedIds: string[]): Promise<void> {
    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await trx
          .updateTable("tenant_member_form_config")
          .set({ sort_order: i, updated_at: new Date() })
          .where("tenant_id", "=", tenantId)
          .where("id", "=", orderedIds[i])
          .execute();
      }
    });
  }

  async listResponses(
    tenantId: string,
    formId: string,
    page: number,
    limit: number
  ): Promise<ListResponsesResult> {
    const offset = (page - 1) * limit;

    const [rows, countRow] = await Promise.all([
      db
        .selectFrom("tenant_member_form_responses as r")
        .innerJoin("tenant_members as m", "m.id", "r.member_id")
        .select([
          "r.id as id",
          "r.member_id as member_id",
          "m.name as member_name",
          "m.email as member_email",
          "m.phone as member_phone",
          "r.data as data",
          "r.completed_at as completed_at",
        ])
        .where("r.tenant_id", "=", tenantId)
        .where("r.form_id", "=", formId)
        .orderBy("r.completed_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      db
        .selectFrom("tenant_member_form_responses")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("tenant_id", "=", tenantId)
        .where("form_id", "=", formId)
        .executeTakeFirst(),
    ]);

    return { responses: rows, total: toInt(countRow?.count) };
  }

  async getResponseForMember(
    tenantId: string,
    formId: string,
    memberId: string
  ): Promise<{ data: unknown; completed_at: Date } | undefined> {
    return db
      .selectFrom("tenant_member_form_responses")
      .select(["data", "completed_at"])
      .where("tenant_id", "=", tenantId)
      .where("form_id", "=", formId)
      .where("member_id", "=", memberId)
      .executeTakeFirst();
  }

  /** Every form response a single member submitted, with the form's name+fields. */
  async listResponsesForMember(
    tenantId: string,
    memberId: string
  ): Promise<MemberResponseAcrossFormsRow[]> {
    return db
      .selectFrom("tenant_member_form_responses as r")
      .innerJoin("tenant_member_form_config as c", "c.id", "r.form_id")
      .select([
        "r.form_id as form_id",
        "c.name as form_name",
        "c.fields as fields",
        "r.data as data",
        "r.completed_at as completed_at",
      ])
      .where("r.tenant_id", "=", tenantId)
      .where("r.member_id", "=", memberId)
      .orderBy("c.sort_order", "asc")
      .execute();
  }
}

export default new MemberFormConfigRepository();
