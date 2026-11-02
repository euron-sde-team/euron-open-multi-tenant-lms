import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { sql } from "kysely";
import { db } from "../db/connection";
import type { DB, test_questions } from "../db/types";
import type {
  test_question_type,
  test_question_difficulty,
  test_question_status,
  test_question_created_via,
} from "../db/enums";

/**
 * Serialize an arbitrary value as a Postgres JSON literal.
 *
 * Postgres `Json` columns require valid JSON syntax, a plain string like
 * `"What is 2+2?"` is NOT valid JSON, it has to be quoted. So we always
 * `JSON.stringify`, which produces:
 * - `"\"What is 2+2?\""` for a string (a JSON string literal)
 * - `'{"text":"..."}'` for an object
 * - `'["A","B"]'` for an array
 *
 * Also strips the U+0000 null byte which Postgres rejects in JSON.
 */
function serializeJson(value: unknown): string {
  return JSON.stringify(value).replace(/\\u0000/g, "");
}

/**
 * The global XSS sanitizer entity-encodes every string on the way in, so a stem
 * saved as `Rock & Roll` is stored as `Rock &amp; Roll`, and the same encoding
 * is applied to the incoming `search` term. A raw ILIKE over the stored text
 * therefore misses anything containing `& < > " '`. Decoding both sides before
 * comparing makes search behave the way an admin expects.
 *
 * `&amp;` must be decoded LAST, otherwise `&amp;lt;` would collapse to `<`.
 */
const HTML_ENTITIES: Array<[entity: string, char: string]> = [
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", "\""],
  ["&#x27;", "'"],
  ["&#39;", "'"],
  ["&#x2F;", "/"],
  ["&nbsp;", " "],
  ["&amp;", "&"],
];

function decodeEntities(value: string): string {
  let out = value;
  for (const [entity, char] of HTML_ENTITIES) out = out.split(entity).join(char);
  return out;
}

/** Collapse every run of whitespace to one space, so line breaks stop mattering. */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Normalise the incoming term the same way the stored stem is normalised below:
 * decode the sanitizer's entities, then flatten whitespace.
 */
function normaliseSearchTerm(value: string): string {
  return collapseWhitespace(decodeEntities(value));
}

/**
 * SQL that renders a stem as flat, comparable text.
 *
 * Two transforms, both load-bearing:
 *  - decode the sanitizer's HTML entities (see HTML_ENTITIES)
 *  - flatten line breaks. `stem::text` on a jsonb column emits a real newline as
 *    the two-character escape `\n`, not as whitespace, so a phrase spanning a
 *    line break can never match. Nearly half the stems in the bank are
 *    multi-line, which is why a specific question could resist search while
 *    single-line ones nearby were found. The escape sequences are replaced
 *    first, then any remaining whitespace is collapsed.
 */
function normalisedStemExpression() {
  let expr = sql`stem::text`;
  for (const [entity, char] of HTML_ENTITIES) {
    expr = sql`replace(${expr}, ${sql.lit(entity)}, ${sql.lit(char)})`;
  }
  for (const escape of ["\\n", "\\r", "\\t"]) {
    expr = sql`replace(${expr}, ${sql.lit(escape)}, ' ')`;
  }
  return sql`regexp_replace(${expr}, '\\s+', ' ', 'g')`;
}

/** Escape the LIKE metacharacters so a literal `%` or `_` is not a wildcard. */
function escapeLikeTerm(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

export type TestQuestionRow = test_questions;

export interface TestQuestionsListParams {
  question_bank_id?: string;
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  difficulty?: string;
  status?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  subject_node_id?: string;
  chapter_node_id?: string;
  topic_node_id?: string;
  created_via?: string;
}

export interface TestQuestionsListResult {
  questions: TestQuestionRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTestQuestionInput {
  tenant_id: string;
  question_bank_id: string;
  type: string;
  stem: unknown;
  options?: unknown;
  correct_answer: unknown;
  explanation?: string | null;
  marks?: number;
  negative_marks?: number;
  difficulty?: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  subject_node_id?: string | null;
  chapter_node_id?: string | null;
  topic_node_id?: string | null;
  source?: string | null;
  status?: string;
  created_via?: string;
  ai_metadata?: unknown;
  created_by?: string | null;
}

export interface UpdateTestQuestionInput {
  type?: string;
  stem?: unknown;
  options?: unknown;
  correct_answer?: unknown;
  explanation?: string | null;
  marks?: number;
  negative_marks?: number;
  difficulty?: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  subject_node_id?: string | null;
  chapter_node_id?: string | null;
  topic_node_id?: string | null;
  source?: string | null;
  status?: string;
}

class TestQuestionsRepository {
  async findByTenantId(
    tenantId: string,
    params: TestQuestionsListParams = {}
  ): Promise<TestQuestionsListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("test_questions")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    let listQuery = db
      .selectFrom("test_questions")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.question_bank_id) {
      countQuery = countQuery.where("question_bank_id", "=", params.question_bank_id);
      listQuery = listQuery.where("question_bank_id", "=", params.question_bank_id);
    }
    if (params.type) {
      countQuery = countQuery.where("type", "=", params.type as test_question_type);
      listQuery = listQuery.where("type", "=", params.type as test_question_type);
    }
    if (params.difficulty) {
      countQuery = countQuery.where("difficulty", "=", params.difficulty as test_question_difficulty);
      listQuery = listQuery.where("difficulty", "=", params.difficulty as test_question_difficulty);
    }
    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status as test_question_status);
      listQuery = listQuery.where("status", "=", params.status as test_question_status);
    }
    if (params.subject) {
      countQuery = countQuery.where("subject", "=", params.subject);
      listQuery = listQuery.where("subject", "=", params.subject);
    }
    if (params.chapter) {
      countQuery = countQuery.where("chapter", "=", params.chapter);
      listQuery = listQuery.where("chapter", "=", params.chapter);
    }
    if (params.topic) {
      countQuery = countQuery.where("topic", "=", params.topic);
      listQuery = listQuery.where("topic", "=", params.topic);
    }
    // Taxonomy filters. Questions tagged through the editor's subject → chapter →
    // topic dropdowns carry node ids; bulk-imported ones often only have the
    // free-text columns above, so both paths stay available.
    if (params.subject_node_id) {
      countQuery = countQuery.where("subject_node_id", "=", params.subject_node_id);
      listQuery = listQuery.where("subject_node_id", "=", params.subject_node_id);
    }
    if (params.chapter_node_id) {
      countQuery = countQuery.where("chapter_node_id", "=", params.chapter_node_id);
      listQuery = listQuery.where("chapter_node_id", "=", params.chapter_node_id);
    }
    if (params.topic_node_id) {
      countQuery = countQuery.where("topic_node_id", "=", params.topic_node_id);
      listQuery = listQuery.where("topic_node_id", "=", params.topic_node_id);
    }
    if (params.created_via) {
      countQuery = countQuery.where("created_via", "=", params.created_via as test_question_created_via);
      listQuery = listQuery.where("created_via", "=", params.created_via as test_question_created_via);
    }
    if (params.search && params.search.trim().length > 0) {
      // Normalise both sides identically: decode the sanitizer's entities and
      // flatten line breaks, so pasting a multi-line question still matches.
      const normalised = normaliseSearchTerm(params.search);
      if (normalised.length > 0) {
        const term = `%${escapeLikeTerm(normalised)}%`;
        const stem = normalisedStemExpression();
        countQuery = countQuery.where(stem as any, "ilike", term);
        listQuery = listQuery.where(stem as any, "ilike", term);
      }
    }

    // count and the page of rows are independent: run them concurrently so the
    // endpoint pays one round-trip of latency instead of two.
    const [countResult, rows] = await Promise.all([
      countQuery.executeTakeFirst(),
      listQuery
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
    ]);
    const total = Number(countResult?.count ?? 0);

    return {
      questions: rows as unknown as TestQuestionRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<TestQuestionRow | null> {
    let query = db.selectFrom("test_questions").selectAll().where("id", "=", id);
    if (tenantId) query = query.where("tenant_id", "=", tenantId);
    const row = await query.executeTakeFirst();
    return (row as unknown as TestQuestionRow) ?? null;
  }

  /** Stems of every question in a bank, used for duplicate detection on import. */
  async findStemsByBank(bankId: string, tenantId: string): Promise<unknown[]> {
    const rows = await db
      .selectFrom("test_questions")
      .select("stem")
      .where("tenant_id", "=", tenantId)
      .where("question_bank_id", "=", bankId)
      .execute();
    return rows.map((r) => r.stem as unknown);
  }

  async findByIds(ids: string[], tenantId: string): Promise<TestQuestionRow[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .selectFrom("test_questions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "in", ids)
      .execute();
    return rows as unknown as TestQuestionRow[];
  }

  private buildInsertValues(
    data: CreateTestQuestionInput
  ): Record<string, unknown> {
    const id = ulid();
    const now = new Date();
    return {
      id,
      tenant_id: data.tenant_id,
      question_bank_id: data.question_bank_id,
      type: data.type as test_question_type,
      stem: serializeJson(data.stem),
      options:
        data.options === undefined || data.options === null
          ? null
          : serializeJson(data.options),
      // Descriptive questions have no answer key (nullable column).
      correct_answer:
        data.correct_answer === undefined || data.correct_answer === null
          ? null
          : serializeJson(data.correct_answer),
      explanation: data.explanation ?? null,
      marks: (data.marks ?? 4) as unknown as string,
      negative_marks: (data.negative_marks ?? 1) as unknown as string,
      difficulty: (data.difficulty ?? "MEDIUM") as test_question_difficulty,
      subject: data.subject ?? null,
      chapter: data.chapter ?? null,
      topic: data.topic ?? null,
      subject_node_id: data.subject_node_id ?? null,
      chapter_node_id: data.chapter_node_id ?? null,
      topic_node_id: data.topic_node_id ?? null,
      source: data.source ?? null,
      status: (data.status ?? "DRAFT") as test_question_status,
      created_via: (data.created_via ?? "MANUAL") as test_question_created_via,
      ai_metadata:
        data.ai_metadata === undefined || data.ai_metadata === null
          ? null
          : serializeJson(data.ai_metadata),
      created_by: data.created_by ?? null,
      created_at: now,
      updated_at: now,
    };
  }

  async create(
    data: CreateTestQuestionInput,
    trx?: Transaction<DB>
  ): Promise<TestQuestionRow> {
    const values = this.buildInsertValues(data);
    const row = await (trx || db)
      .insertInto("test_questions")
      .values(values as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestQuestionRow;
  }

  /**
   * Bulk insert in a single multi-row INSERT (one round-trip, atomic on its
   * own). Returns only the inserted ids: callers need the count, not the full
   * rows, so we avoid shipping every row's large JSON columns back over the wire.
   */
  async createMany(
    items: CreateTestQuestionInput[],
    trx?: Transaction<DB>
  ): Promise<string[]> {
    if (items.length === 0) return [];
    const valuesList = items.map((i) => this.buildInsertValues(i));
    const rows = await (trx || db)
      .insertInto("test_questions")
      .values(valuesList as never[])
      .returning("id")
      .execute();
    return rows.map((r) => r.id);
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateTestQuestionInput,
    trx?: Transaction<DB>
  ): Promise<TestQuestionRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.type !== undefined) updateData.type = data.type as test_question_type;
    if (data.stem !== undefined) updateData.stem = serializeJson(data.stem);
    if (data.options !== undefined)
      updateData.options = data.options === null ? null : serializeJson(data.options);
    if (data.correct_answer !== undefined)
      updateData.correct_answer = serializeJson(data.correct_answer);
    if (data.explanation !== undefined) updateData.explanation = data.explanation;
    if (data.marks !== undefined) updateData.marks = data.marks;
    if (data.negative_marks !== undefined) updateData.negative_marks = data.negative_marks;
    if (data.difficulty !== undefined)
      updateData.difficulty = data.difficulty as test_question_difficulty;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.chapter !== undefined) updateData.chapter = data.chapter;
    if (data.topic !== undefined) updateData.topic = data.topic;
    if (data.subject_node_id !== undefined)
      updateData.subject_node_id = data.subject_node_id;
    if (data.chapter_node_id !== undefined)
      updateData.chapter_node_id = data.chapter_node_id;
    if (data.topic_node_id !== undefined)
      updateData.topic_node_id = data.topic_node_id;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.status !== undefined) updateData.status = data.status as test_question_status;

    const row = await (trx || db)
      .updateTable("test_questions")
      .set(updateData)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestQuestionRow) ?? null;
  }

  /**
   * Count questions available for a blueprint rule: bank + optional taxonomy
   * node ids + optional difficulty. Used by the availability check that powers
   * the "Only X questions available" authoring prompt.
   */
  async countAvailable(
    tenantId: string,
    filter: {
      question_bank_id?: string;
      subject_node_id?: string | null;
      chapter_node_id?: string | null;
      topic_node_id?: string | null;
      difficulty?: string;
      status?: string;
    }
  ): Promise<number> {
    let q = db
      .selectFrom("test_questions")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    if (filter.question_bank_id)
      q = q.where("question_bank_id", "=", filter.question_bank_id);
    if (filter.subject_node_id)
      q = q.where("subject_node_id", "=", filter.subject_node_id);
    if (filter.chapter_node_id)
      q = q.where("chapter_node_id", "=", filter.chapter_node_id);
    if (filter.topic_node_id)
      q = q.where("topic_node_id", "=", filter.topic_node_id);
    if (filter.difficulty)
      q = q.where("difficulty", "=", filter.difficulty as test_question_difficulty);
    if (filter.status)
      q = q.where("status", "=", filter.status as test_question_status);
    const r = await q.executeTakeFirst();
    return Number(r?.count ?? 0);
  }

  /**
   * All question ids in a bank matching a blueprint rule filter
   * (subject/chapter/topic/difficulty). Used to materialize a section's pool
   * from the bank. No status filter, so the pooled count matches the
   * availability count shown in the blueprint editor.
   */
  async findIdsByRule(
    tenantId: string,
    filter: {
      question_bank_id: string;
      subject_node_id?: string | null;
      chapter_node_id?: string | null;
      topic_node_id?: string | null;
      difficulty?: string;
    }
  ): Promise<string[]> {
    let q = db
      .selectFrom("test_questions")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("question_bank_id", "=", filter.question_bank_id);
    if (filter.subject_node_id)
      q = q.where("subject_node_id", "=", filter.subject_node_id);
    if (filter.chapter_node_id)
      q = q.where("chapter_node_id", "=", filter.chapter_node_id);
    if (filter.topic_node_id)
      q = q.where("topic_node_id", "=", filter.topic_node_id);
    if (filter.difficulty && filter.difficulty !== "ANY")
      q = q.where("difficulty", "=", filter.difficulty as test_question_difficulty);
    const rows = await q.execute();
    return rows.map((r) => r.id);
  }

  /** Distinct free-text (subject, chapter, topic) combos, for taxonomy import. */
  async findDistinctTags(
    tenantId: string
  ): Promise<Array<{ subject: string | null; chapter: string | null; topic: string | null }>> {
    const rows = await db
      .selectFrom("test_questions")
      .select(["subject", "chapter", "topic"])
      .distinct()
      .where("tenant_id", "=", tenantId)
      .where("subject", "is not", null)
      .execute();
    return rows as Array<{
      subject: string | null;
      chapter: string | null;
      topic: string | null;
    }>;
  }

  /** Link questions matching a free-text (subject, chapter, topic) to node ids. */
  async setNodeIdsByTags(
    tenantId: string,
    match: { subject: string; chapter: string | null; topic: string | null },
    nodeIds: {
      subject_node_id: string | null;
      chapter_node_id: string | null;
      topic_node_id: string | null;
    }
  ): Promise<number> {
    let q = db
      .updateTable("test_questions")
      .set({
        subject_node_id: nodeIds.subject_node_id,
        chapter_node_id: nodeIds.chapter_node_id,
        topic_node_id: nodeIds.topic_node_id,
      })
      .where("tenant_id", "=", tenantId)
      .where("subject", "=", match.subject);
    q = match.chapter === null ? q.where("chapter", "is", null) : q.where("chapter", "=", match.chapter);
    q = match.topic === null ? q.where("topic", "is", null) : q.where("topic", "=", match.topic);
    const res = await q.executeTakeFirst();
    return Number(res.numUpdatedRows ?? 0);
  }

  async delete(id: string, tenantId: string, trx?: Transaction<DB>): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_questions")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  async bulkUpdateStatus(
    ids: string[],
    tenantId: string,
    status: string
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db
      .updateTable("test_questions")
      .set({ status: status as test_question_status, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "in", ids)
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0);
  }

  async countByTenant(tenantId: string, status?: string): Promise<number> {
    let query = db
      .selectFrom("test_questions")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    if (status) query = query.where("status", "=", status as test_question_status);
    const row = await query.executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async questionBankExistsForTenant(
    bankId: string,
    tenantId: string
  ): Promise<boolean> {
    const row = await db
      .selectFrom("test_question_banks")
      .select("id")
      .where("id", "=", bankId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return !!row;
  }

  async countBanksForTenant(bankIds: string[], tenantId: string): Promise<number> {
    if (bankIds.length === 0) return 0;
    const row = await db
      .selectFrom("test_question_banks")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("id", "in", bankIds)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async findRandomByDifficulty(params: {
    tenantId: string;
    bankIds: string[];
    difficulty: string;
    excludeIds: string[];
    limit: number;
  }): Promise<TestQuestionRow[]> {
    if (params.limit <= 0 || params.bankIds.length === 0) return [];
    let query = db
      .selectFrom("test_questions")
      .selectAll()
      .where("tenant_id", "=", params.tenantId)
      .where("question_bank_id", "in", params.bankIds)
      .where("status", "=", "PUBLISHED" as test_question_status)
      .where("difficulty", "=", params.difficulty as test_question_difficulty);
    if (params.excludeIds.length > 0) {
      query = query.where("id", "not in", params.excludeIds);
    }
    const rows = await query
      .orderBy(sql`random()`)
      .limit(params.limit)
      .execute();
    return rows as unknown as TestQuestionRow[];
  }

  /**
   * Random PUBLISHED questions from a single bank for in-course quiz import,
   * filtered by the bank's tags and excluding questions already imported into
   * the quiz. Sampling + exclusion happen in SQL (ORDER BY random()) so the
   * ENTIRE bank is eligible, not just the newest page, and re-pulls draw
   * fresh questions instead of returning the same 200-row window forever.
   */
  async findRandomForImport(params: {
    tenantId: string;
    questionBankId: string;
    subject?: string;
    chapter?: string;
    topic?: string;
    difficulty?: string;
    excludeIds: string[];
    limit: number;
  }): Promise<TestQuestionRow[]> {
    if (params.limit <= 0 || !params.questionBankId) return [];
    let query = db
      .selectFrom("test_questions")
      .selectAll()
      .where("tenant_id", "=", params.tenantId)
      .where("question_bank_id", "=", params.questionBankId)
      .where("status", "=", "PUBLISHED" as test_question_status);
    if (params.subject) query = query.where("subject", "=", params.subject);
    if (params.chapter) query = query.where("chapter", "=", params.chapter);
    if (params.topic) query = query.where("topic", "=", params.topic);
    if (params.difficulty) {
      query = query.where(
        "difficulty",
        "=",
        params.difficulty as test_question_difficulty
      );
    }
    if (params.excludeIds.length > 0) {
      query = query.where("id", "not in", params.excludeIds);
    }
    const rows = await query
      .orderBy(sql`random()`)
      .limit(params.limit)
      .execute();
    return rows as unknown as TestQuestionRow[];
  }
}

export default new TestQuestionsRepository();
