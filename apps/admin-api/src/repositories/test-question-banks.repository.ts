import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, test_question_banks } from "../db/types";

export type TestQuestionBankRow = test_question_banks;

export interface TestQuestionBanksListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface TestQuestionBanksListResult {
  banks: TestQuestionBankRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTestQuestionBankInput {
  tenant_id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
}

export interface UpdateTestQuestionBankInput {
  name?: string;
  description?: string | null;
}

class TestQuestionBanksRepository {
  async findByTenantId(
    tenantId: string,
    params: TestQuestionBanksListParams = {}
  ): Promise<TestQuestionBanksListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("test_question_banks")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    let listQuery = db
      .selectFrom("test_question_banks")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.search) {
      const term = `%${params.search}%`;
      countQuery = countQuery.where("name", "ilike", term);
      listQuery = listQuery.where("name", "ilike", term);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      banks: rows as unknown as TestQuestionBankRow[],
      total,
      page,
      limit,
    };
  }

  /** Exact-name lookup within a tenant, used for idempotent library install. */
  async findByTenantAndName(
    tenantId: string,
    name: string
  ): Promise<TestQuestionBankRow | null> {
    const row = await db
      .selectFrom("test_question_banks")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("name", "=", name)
      .executeTakeFirst();
    return (row as unknown as TestQuestionBankRow) ?? null;
  }

  async findById(id: string, tenantId?: string): Promise<TestQuestionBankRow | null> {
    let query = db
      .selectFrom("test_question_banks")
      .selectAll()
      .where("id", "=", id);
    if (tenantId) query = query.where("tenant_id", "=", tenantId);
    const row = await query.executeTakeFirst();
    return (row as unknown as TestQuestionBankRow) ?? null;
  }

  async create(
    data: CreateTestQuestionBankInput,
    trx?: Transaction<DB>
  ): Promise<TestQuestionBankRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_question_banks")
      .values({
        id,
        tenant_id: data.tenant_id,
        name: data.name,
        description: data.description ?? null,
        created_by: data.created_by ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestQuestionBankRow;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateTestQuestionBankInput,
    trx?: Transaction<DB>
  ): Promise<TestQuestionBankRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const row = await (trx || db)
      .updateTable("test_question_banks")
      .set(updateData)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestQuestionBankRow) ?? null;
  }

  async delete(id: string, tenantId: string, trx?: Transaction<DB>): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_question_banks")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  async countByTenant(tenantId: string): Promise<number> {
    const row = await db
      .selectFrom("test_question_banks")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }
}

export default new TestQuestionBanksRepository();
