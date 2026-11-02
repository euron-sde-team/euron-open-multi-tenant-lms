import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, test_exam_rank_curves } from "../db/types";

export type TestRankCurveRow = test_exam_rank_curves;

export interface CurvePoint {
  percentile: number;
  rank: number;
}

export interface CreateRankCurveInput {
  tenant_id: string;
  exam_name: string;
  year: number;
  total_candidates: number;
  curve: CurvePoint[];
}

export interface UpdateRankCurveInput {
  exam_name?: string;
  year?: number;
  total_candidates?: number;
  curve?: CurvePoint[];
}

class TestRankCurvesRepository {
  async findByTenant(tenantId: string): Promise<TestRankCurveRow[]> {
    const rows = await db
      .selectFrom("test_exam_rank_curves")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("year", "desc")
      .orderBy("exam_name", "asc")
      .execute();
    return rows as unknown as TestRankCurveRow[];
  }

  async findById(id: string, tenantId?: string): Promise<TestRankCurveRow | null> {
    let q = db.selectFrom("test_exam_rank_curves").selectAll().where("id", "=", id);
    if (tenantId) q = q.where("tenant_id", "=", tenantId);
    const row = await q.executeTakeFirst();
    return (row as unknown as TestRankCurveRow) ?? null;
  }

  async create(
    data: CreateRankCurveInput,
    trx?: Transaction<DB>
  ): Promise<TestRankCurveRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_exam_rank_curves")
      .values({
        id,
        tenant_id: data.tenant_id,
        exam_name: data.exam_name,
        year: data.year,
        total_candidates: data.total_candidates,
        curve: JSON.stringify(data.curve),
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestRankCurveRow;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateRankCurveInput,
    trx?: Transaction<DB>
  ): Promise<TestRankCurveRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.exam_name !== undefined) updateData.exam_name = data.exam_name;
    if (data.year !== undefined) updateData.year = data.year;
    if (data.total_candidates !== undefined)
      updateData.total_candidates = data.total_candidates;
    if (data.curve !== undefined) updateData.curve = JSON.stringify(data.curve);

    const row = await (trx || db)
      .updateTable("test_exam_rank_curves")
      .set(updateData)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestRankCurveRow) ?? null;
  }

  async delete(id: string, tenantId: string, trx?: Transaction<DB>): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_exam_rank_curves")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }
}

export default new TestRankCurvesRepository();
