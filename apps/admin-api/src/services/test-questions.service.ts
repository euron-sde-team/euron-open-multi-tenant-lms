import logger from "../utils/logger";
import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import testQuestionsRepository, {
  type TestQuestionRow,
  type CreateTestQuestionInput,
  type UpdateTestQuestionInput,
  type TestQuestionsListParams,
} from "../repositories/test-questions.repository";
import testsRepository from "../repositories/tests.repository";
import testEntitlementsService from "./test-entitlements.service";
import { generateQuestionDescription } from "./test-question-description-ai.parser";
import { italicizeStemTitles } from "./test-question-italics-ai.parser";
import testsService from "./tests.service";

const VALID_TYPES = new Set([
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "TRUE_FALSE",
  "FIB",
  "NAT",
  "DRAG_DROP",
  "DESCRIPTIVE",
]);

/** Pull the plain-text of a stem that may be a string or { text } JSON. */
function stemText(stem: unknown): string {
  if (typeof stem === "string") return stem;
  if (stem && typeof stem === "object") {
    const t = (stem as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return "";
}

/** True when the stem JSON already carries a `description` key (any value). */
function stemHasDescription(stem: unknown): boolean {
  return !!stem && typeof stem === "object" && "description" in stem;
}

/** Visible labels of a question's options (handles {id,label} or string items). */
function optionLabels(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => {
      if (typeof o === "string") return o;
      if (o && typeof o === "object") {
        const label = (o as { label?: unknown }).label;
        if (typeof label === "string") return label;
      }
      return "";
    })
    .filter((s) => s.length > 0);
}

/**
 * Return a stem object that carries `description`, preserving the original text
 * and any image fields. Always returns object form so the `description` key is
 * present (which is how a seeded question is recognised on re-runs).
 */
function withStemDescription(stem: unknown, description: string): Record<string, unknown> {
  const base =
    stem && typeof stem === "object" ? { ...(stem as Record<string, unknown>) } : {};
  return { ...base, text: stemText(stem), description };
}

/** Replace a stem's text while preserving all other fields; mark it processed. */
function withStemText(stem: unknown, text: string): Record<string, unknown> {
  const base =
    stem && typeof stem === "object" ? { ...(stem as Record<string, unknown>) } : {};
  return { ...base, text, _titlesItalicized: true };
}

/** True once a stem has been through the title-italicization pass. */
function stemTitlesChecked(stem: unknown): boolean {
  return (
    !!stem && typeof stem === "object" && "_titlesItalicized" in (stem as object)
  );
}
const VALID_DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"]);
const VALID_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const VALID_CREATED_VIAS = new Set(["MANUAL", "IMPORT", "AI"]);

export interface TestQuestionResponse {
  id: string;
  tenantId: string;
  questionBankId: string;
  type: string;
  stem: unknown;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  marks: string;
  negativeMarks: string;
  difficulty: string;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  subjectNodeId: string | null;
  chapterNodeId: string | null;
  topicNodeId: string | null;
  source: string | null;
  status: string;
  createdVia: string;
  aiMetadata: unknown;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseJsonField(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function toResponse(row: TestQuestionRow): TestQuestionResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    questionBankId: row.question_bank_id,
    type: String(row.type),
    stem: parseJsonField(row.stem),
    options: parseJsonField(row.options),
    correctAnswer: parseJsonField(row.correct_answer),
    explanation: row.explanation,
    marks: String(row.marks),
    negativeMarks: String(row.negative_marks),
    difficulty: String(row.difficulty),
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    subjectNodeId: row.subject_node_id ?? null,
    chapterNodeId: row.chapter_node_id ?? null,
    topicNodeId: row.topic_node_id ?? null,
    source: row.source,
    status: String(row.status),
    createdVia: String(row.created_via),
    aiMetadata: parseJsonField(row.ai_metadata),
    createdBy: row.created_by,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

export interface RandomPickParams {
  question_bank_ids: string[];
  count: number;
  distribution: { easy: number; medium: number; hard: number };
  exclude_question_ids?: string[];
}

export interface RandomPickResult {
  questions: TestQuestionResponse[];
  summary: {
    requested: { easy: number; medium: number; hard: number };
    picked: { easy: number; medium: number; hard: number };
    shortfall: number;
  };
}

interface ValidatedInput {
  type: string;
  stem: unknown;
  options: unknown;
  correct_answer: unknown;
}

function validateAndNormalize(
  payload: Partial<CreateTestQuestionInput>,
  forCreate: boolean
): ValidatedInput {
  if (forCreate || payload.type !== undefined) {
    if (!payload.type || !VALID_TYPES.has(payload.type)) {
      throw new BadRequestError(
        `Invalid question type. Must be one of: ${Array.from(VALID_TYPES).join(", ")}`
      );
    }
  }
  if (forCreate && !payload.stem) {
    throw new BadRequestError("Question stem is required");
  }
  // Descriptive (free-text) questions have no answer key, they are graded
  // manually by an evaluator, so correct_answer / options are not required.
  if (
    forCreate &&
    payload.correct_answer === undefined &&
    payload.type !== "DESCRIPTIVE"
  ) {
    throw new BadRequestError("correct_answer is required");
  }
  if (payload.difficulty !== undefined && !VALID_DIFFICULTIES.has(payload.difficulty)) {
    throw new BadRequestError(
      `Invalid difficulty. Must be one of: ${Array.from(VALID_DIFFICULTIES).join(", ")}`
    );
  }
  if (payload.status !== undefined && !VALID_STATUSES.has(payload.status)) {
    throw new BadRequestError(
      `Invalid status. Must be one of: ${Array.from(VALID_STATUSES).join(", ")}`
    );
  }
  if (payload.created_via !== undefined && !VALID_CREATED_VIAS.has(payload.created_via)) {
    throw new BadRequestError(
      `Invalid created_via. Must be one of: ${Array.from(VALID_CREATED_VIAS).join(", ")}`
    );
  }
  // Type-specific shape checks
  const t = payload.type;
  if (
    t === "MCQ_SINGLE" ||
    t === "MCQ_MULTI" ||
    t === "TRUE_FALSE" ||
    t === "DRAG_DROP"
  ) {
    if (forCreate && (!Array.isArray(payload.options) || payload.options.length < 2)) {
      throw new BadRequestError("Options array (min 2) is required for MCQ/TF/drag-drop questions");
    }
  }
  // DRAG_DROP: the stem must mark the blank with "___" (three underscores).
  if (t === "DRAG_DROP" && (forCreate || payload.stem !== undefined)) {
    if (!stemText(payload.stem).includes("___")) {
      throw new BadRequestError(
        "Drag-and-drop questions must contain \"___\" (three underscores) in the stem to mark the blank."
      );
    }
  }

  // Descriptive questions never carry options or an answer key.
  const isDescriptive = payload.type === "DESCRIPTIVE";
  return {
    type: payload.type as string,
    stem: payload.stem,
    options: isDescriptive ? null : (payload.options ?? null),
    correct_answer: isDescriptive ? null : payload.correct_answer,
  };
}

class TestQuestionsService {
  async list(tenantId: string, params: TestQuestionsListParams) {
    // No separate bank-existence round-trip: findByTenantId already scopes by
    // tenant_id + question_bank_id, so a missing or foreign bank just yields an
    // empty page (no data leak). This avoids a query on every filter change.
    const result = await testQuestionsRepository.findByTenantId(tenantId, params);
    return {
      questions: result.questions.map(toResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getById(tenantId: string, questionId: string): Promise<TestQuestionResponse> {
    const row = await testQuestionsRepository.findById(questionId);
    if (!row) throw new NotFoundError("Question not found");
    if (row.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this question");
    return toResponse(row);
  }

  async getByIds(tenantId: string, ids: string[]): Promise<TestQuestionResponse[]> {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const rows = await testQuestionsRepository.findByIds(ids, tenantId);
    return rows.map(toResponse);
  }

  async create(
    tenantId: string,
    data: Omit<CreateTestQuestionInput, "tenant_id">,
    createdBy?: string
  ): Promise<TestQuestionResponse> {
    await testEntitlementsService.ensureTestSeriesEnabled(tenantId);

    const bankExists = await testQuestionsRepository.questionBankExistsForTenant(
      data.question_bank_id,
      tenantId
    );
    if (!bankExists) throw new NotFoundError("Question bank not found");

    validateAndNormalize(data, true);

    // Auto-populate a reference description with AI when the author didn't give
    // one, so every question carries context by default. Best-effort + inline
    // (a single question): never blocks the create on an AI error.
    let stem = data.stem;
    if (!stemHasDescription(stem)) {
      const desc = await generateQuestionDescription(
        stemText(stem),
        optionLabels(parseJsonField(data.options))
      );
      if (desc) stem = withStemDescription(stem, desc);
    }

    const row = await testQuestionsRepository.create({
      ...data,
      stem,
      tenant_id: tenantId,
      created_by: createdBy ?? data.created_by ?? null,
    });
    return toResponse(row);
  }

  /**
   * Background helper: AI-seed descriptions for every question in a bank that
   * doesn't have one yet. Used (fire-and-forget) right after an AI file import
   * so uploaded questions get context automatically. Bounded so a giant bank
   * can't loop forever; idempotent (skips stems that already carry one).
   */
  async autoSeedBankDescriptions(tenantId: string, bankId: string): Promise<void> {
    // Gated 2026-09-18 during a the AI model cost investigation. Both callers invoke
    // this with `void` after a file import, so up to 60 x 60 = 3,600 model
    // calls could fan out with nobody having asked for them, and the bare
    // `catch {}` below meant failures, and the spend, were silent.
    // Descriptions can still be seeded explicitly via seedDescriptions().
    if (!config.AI_AUTO_GENERATION_ENABLED) {
      logger.warn(
        `[test-questions] autoSeedBankDescriptions skipped for bank ${bankId} - AI_AUTO_GENERATION_ENABLED is false`
      );
      return;
    }
    try {
      for (let i = 0; i < 60; i++) {
        const r = await this.seedDescriptions(tenantId, {
          questionBankId: bankId,
          limit: 60,
        });
        if (r.remaining === 0 || r.processed === 0) break;
      }
    } catch {
      // best-effort, import already succeeded; descriptions can be re-seeded.
    }
  }

  async bulkCreate(
    tenantId: string,
    bankId: string,
    items: Array<Omit<CreateTestQuestionInput, "tenant_id" | "question_bank_id">>,
    createdBy?: string
  ): Promise<{
    created: number;
    failed: Array<{ index: number; error: string }>;
    skipped: number;
    duplicates: Array<{ question: string; reason: string }>;
  }> {
    // The two gate checks hit different tables and are independent, so run them
    // concurrently instead of paying their latencies back to back.
    const [, bankExists] = await Promise.all([
      testEntitlementsService.ensureTestSeriesEnabled(tenantId),
      testQuestionsRepository.questionBankExistsForTenant(bankId, tenantId),
    ]);
    if (!bankExists) throw new NotFoundError("Question bank not found");

    const failed: Array<{ index: number; error: string }> = [];
    const validInputs: CreateTestQuestionInput[] = [];

    items.forEach((item, idx) => {
      try {
        validateAndNormalize(item, true);
        validInputs.push({
          ...item,
          tenant_id: tenantId,
          question_bank_id: bankId,
          created_by: createdBy ?? item.created_by ?? null,
          created_via: item.created_via ?? "IMPORT",
        });
      } catch (err) {
        failed.push({
          index: idx,
          error: err instanceof Error ? err.message : "Validation failed",
        });
      }
    });

    if (validInputs.length === 0) {
      return { created: 0, failed, skipped: 0, duplicates: [] };
    }

    // Duplicate detection: skip questions whose normalized stem already exists
    // in this bank, or repeats earlier in the same upload, and report them so
    // the UI can highlight what was dropped.
    const normalizeStem = (stem: unknown): string =>
      stemText(stem)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const existingStems = await testQuestionsRepository.findStemsByBank(
      bankId,
      tenantId
    );
    const existingKeys = new Set(
      existingStems.map(normalizeStem).filter(Boolean)
    );
    const seen = new Set<string>();
    const duplicates: Array<{ question: string; reason: string }> = [];
    const toInsert: CreateTestQuestionInput[] = [];
    for (const input of validInputs) {
      const key = normalizeStem(input.stem);
      const preview = stemText(input.stem)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      if (key && existingKeys.has(key)) {
        duplicates.push({ question: preview, reason: "Already in this bank" });
        continue;
      }
      if (key && seen.has(key)) {
        duplicates.push({ question: preview, reason: "Duplicate in this file" });
        continue;
      }
      if (key) seen.add(key);
      toInsert.push(input);
    }

    // A single multi-row INSERT is atomic on its own; no surrounding transaction
    // (and its extra BEGIN/COMMIT round-trips) is needed.
    const insertedIds = toInsert.length
      ? await testQuestionsRepository.createMany(toInsert)
      : [];

    return {
      created: insertedIds.length,
      failed,
      skipped: duplicates.length,
      duplicates,
    };
  }

  async update(
    tenantId: string,
    questionId: string,
    data: UpdateTestQuestionInput
  ): Promise<TestQuestionResponse> {
    const existing = await testQuestionsRepository.findById(questionId);
    if (!existing) throw new NotFoundError("Question not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this question");

    if (Object.keys(data).length > 0) {
      validateAndNormalize(data as Partial<CreateTestQuestionInput>, false);
    }

    const row = await testQuestionsRepository.update(questionId, tenantId, data);
    if (!row) throw new NotFoundError("Question not found");

    // Editing a question's marks changes the total of every test it is attached
    // to. Without this the stored total keeps whatever the marks were at attach
    // time, a 1-mark question promoted to 2 marks would never move the total.
    if (data.marks !== undefined && Number(data.marks) !== Number(existing.marks ?? 0)) {
      await testsService.recomputeTotalMarksForQuestion(tenantId, questionId);
    }
    return toResponse(row);
  }

  async delete(tenantId: string, questionId: string): Promise<void> {
    const existing = await testQuestionsRepository.findById(questionId);
    if (!existing) throw new NotFoundError("Question not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this question");
    // Capture the affected tests before the row (and its attachments) go away.
    const affectedTestIds = await testsRepository.findTestIdsUsingQuestion(
      questionId,
      tenantId
    );
    const ok = await testQuestionsRepository.delete(questionId, tenantId);
    if (!ok) throw new NotFoundError("Question not found");
    for (const testId of affectedTestIds) {
      await testsService.recomputeTotalMarks(tenantId, testId);
    }
  }

  /**
   * Randomly pick `count` PUBLISHED questions across one or more banks,
   * targeting a difficulty mix (percentages summing to 100). When a bucket
   * can't be filled, the deficit is backfilled from the other difficulties
   * (MEDIUM first, then EASY, then HARD) so the caller still gets `count`
   * questions whenever the pool allows; the summary reports the actual mix.
   */
  async randomPick(
    tenantId: string,
    params: RandomPickParams
  ): Promise<RandomPickResult> {
    const bankIds = Array.from(new Set(params.question_bank_ids ?? []));
    if (
      bankIds.length === 0 ||
      bankIds.length > 50 ||
      bankIds.some((id) => typeof id !== "string" || !id)
    ) {
      throw new BadRequestError("question_bank_ids must be 1-50 bank IDs");
    }
    const count = params.count;
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      throw new BadRequestError("count must be an integer between 1 and 200");
    }
    const dist = params.distribution;
    const pcts = [dist?.easy, dist?.medium, dist?.hard];
    if (pcts.some((p) => !Number.isInteger(p) || (p as number) < 0)) {
      throw new BadRequestError(
        "distribution.easy/medium/hard must be non-negative integers"
      );
    }
    if ((dist.easy as number) + dist.medium + dist.hard !== 100) {
      throw new BadRequestError("distribution percentages must sum to 100");
    }
    const excludeIds = Array.from(
      new Set(
        (params.exclude_question_ids ?? []).filter(
          (id): id is string => typeof id === "string" && id.length > 0
        )
      )
    );
    if (excludeIds.length > 2000) {
      throw new BadRequestError("At most 2000 question IDs can be excluded");
    }

    const ownedBanks = await testQuestionsRepository.countBanksForTenant(
      bankIds,
      tenantId
    );
    if (ownedBanks !== bankIds.length) {
      throw new NotFoundError("One or more question banks not found");
    }

    // Largest-remainder rounding so the three targets sum exactly to `count`.
    const order = ["EASY", "MEDIUM", "HARD"] as const;
    const pctByDifficulty = { EASY: dist.easy, MEDIUM: dist.medium, HARD: dist.hard };
    const exact = order.map((d) => (count * pctByDifficulty[d]) / 100);
    const targets = exact.map(Math.floor);
    let remainder = count - targets.reduce((a, b) => a + b, 0);
    order
      .map((d, i) => ({ i, frac: exact[i] - targets[i] }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i)
      .forEach(({ i }) => {
        if (remainder > 0) {
          targets[i] += 1;
          remainder -= 1;
        }
      });
    const requested = {
      easy: targets[0],
      medium: targets[1],
      hard: targets[2],
    };

    const primary = await Promise.all(
      order.map((difficulty, i) =>
        testQuestionsRepository.findRandomByDifficulty({
          tenantId,
          bankIds,
          difficulty,
          excludeIds,
          limit: targets[i],
        })
      )
    );

    const picked: TestQuestionRow[] = primary.flat();
    const pickedCount = { EASY: 0, MEDIUM: 0, HARD: 0 };
    primary.forEach((rows, i) => {
      pickedCount[order[i]] = rows.length;
    });

    // Backfill: medium is the most acceptable substitute in either direction,
    // and easy is preferred over hard so a backfilled paper never gets harder
    // than requested.
    const backfillOrder = ["MEDIUM", "EASY", "HARD"] as const;
    for (const difficulty of backfillOrder) {
      const deficit = count - picked.length;
      if (deficit <= 0) break;
      const extra = await testQuestionsRepository.findRandomByDifficulty({
        tenantId,
        bankIds,
        difficulty,
        excludeIds: [...excludeIds, ...picked.map((q) => q.id)],
        limit: deficit,
      });
      picked.push(...extra);
      pickedCount[difficulty] += extra.length;
    }

    // Shuffle (Fisher-Yates) so sections don't get difficulty-ordered blocks.
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }

    return {
      questions: picked.map(toResponse),
      summary: {
        requested,
        picked: {
          easy: pickedCount.EASY,
          medium: pickedCount.MEDIUM,
          hard: pickedCount.HARD,
        },
        shortfall: count - picked.length,
      },
    };
  }

  async bulkUpdateStatus(
    tenantId: string,
    questionIds: string[],
    status: string
  ): Promise<{ updated: number }> {
    if (!VALID_STATUSES.has(status)) {
      throw new BadRequestError("Invalid status");
    }
    const updated = await testQuestionsRepository.bulkUpdateStatus(
      questionIds,
      tenantId,
      status
    );
    return { updated };
  }

  /**
   * AI-seed a reference "description" (context/passage) onto existing questions
   * and store it inside the stem JSON (no schema change, the attempt serves the
   * whole stem, so `description` rides along). Idempotent + resumable: a question
   * whose stem already carries a `description` key is skipped unless `overwrite`,
   * so repeated calls converge and a gateway timeout never double-writes. Pass a
   * modest `limit` to keep each request under the gateway timeout and call again
   * until `remaining` is 0. Self-contained questions are marked done with an
   * empty description (the player shows the "no additional description" fallback).
   */
  async seedDescriptions(
    tenantId: string,
    opts: { questionBankId?: string; limit?: number; overwrite?: boolean } = {}
  ): Promise<{
    processed: number;
    withContext: number;
    selfContained: number;
    remaining: number;
    totalCandidates: number;
  }> {
    const limit = Math.min(60, Math.max(1, opts.limit ?? 40));
    const overwrite = opts.overwrite === true;

    // Collect every candidate (paginate 200 at a time) so we can report how many
    // still need seeding after this batch.
    const candidates: TestQuestionRow[] = [];
    for (let page = 1; ; page++) {
      const { questions, total } = await testQuestionsRepository.findByTenantId(
        tenantId,
        { question_bank_id: opts.questionBankId, page, limit: 200 }
      );
      for (const q of questions) {
        if (overwrite || !stemHasDescription(q.stem)) candidates.push(q);
      }
      if (page * 200 >= total || questions.length === 0) break;
    }

    const batch = candidates.slice(0, limit);
    let withContext = 0;
    let selfContained = 0;

    // Bounded concurrency so we don't hammer the model / connection pool.
    const CONCURRENCY = 5;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const slice = batch.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (q) => {
          const text = stemText(q.stem);
          const labels = optionLabels(parseJsonField(q.options));
          const description = await generateQuestionDescription(text, labels);
          if (description) withContext++;
          else selfContained++;
          const newStem = withStemDescription(q.stem, description);
          await testQuestionsRepository.update(q.id, tenantId, { stem: newStem });
        })
      );
    }

    return {
      processed: batch.length,
      withContext,
      selfContained,
      remaining: Math.max(0, candidates.length - batch.length),
      totalCandidates: candidates.length,
    };
  }

  /**
   * Italicize long-work titles (books/plays/novels/newspapers/films…) in
   * Reading & Writing question stems, author names left plain: SAT typography.
   * Conservative + idempotent: only changes a stem when the model finds a real
   * title, marks processed stems with `_titlesItalicized`, and (integrity-
   * guarded) never alters non-title text. `dryRun` returns before/after samples
   * WITHOUT writing, so the owner can approve before a full apply.
   */
  async italicizeTitles(
    tenantId: string,
    opts: {
      questionBankId?: string;
      limit?: number;
      overwrite?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<{
    processed: number;
    italicized: number;
    remaining: number;
    totalCandidates: number;
    dryRun: boolean;
    samples: Array<{ id: string; before: string; after: string }>;
  }> {
    const limit = Math.min(80, Math.max(1, opts.limit ?? 40));
    const overwrite = opts.overwrite === true;
    const dryRun = opts.dryRun === true;

    // Candidates = Reading & Writing questions not yet processed (titles rarely
    // appear in Math, so we skip it to save calls).
    const candidates: TestQuestionRow[] = [];
    for (let page = 1; ; page++) {
      const { questions, total } = await testQuestionsRepository.findByTenantId(
        tenantId,
        { question_bank_id: opts.questionBankId, page, limit: 200 }
      );
      for (const q of questions) {
        const subj = String(q.subject ?? "").toLowerCase();
        const isRW = subj.includes("reading") || subj.includes("writing") || subj.includes("english");
        if (!isRW) continue;
        if (!overwrite && stemTitlesChecked(q.stem)) continue;
        candidates.push(q);
      }
      if (page * 200 >= total || questions.length === 0) break;
    }

    const batch = candidates.slice(0, limit);
    let italicized = 0;
    const samples: Array<{ id: string; before: string; after: string }> = [];

    const CONCURRENCY = 5;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const slice = batch.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (q) => {
          const before = stemText(q.stem);
          const { changed, stem: after } = await italicizeStemTitles(before);
          if (changed) {
            italicized++;
            if (samples.length < 25) samples.push({ id: q.id, before, after });
          }
          if (!dryRun) {
            // Always mark processed (even when unchanged) so re-runs skip it;
            // only rewrite the text when a title was actually italicized.
            const newStem = withStemText(q.stem, changed ? after : before);
            await testQuestionsRepository.update(q.id, tenantId, { stem: newStem });
          }
        })
      );
    }

    return {
      processed: batch.length,
      italicized,
      remaining: Math.max(0, candidates.length - batch.length),
      totalCandidates: candidates.length,
      dryRun,
      samples,
    };
  }
}

export default new TestQuestionsService();
