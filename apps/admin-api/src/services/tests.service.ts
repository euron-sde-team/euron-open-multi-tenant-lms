import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { db } from "../db/connection";
import testsRepository, {
  type TestRow,
  type TestSectionRow,
  type TestSectionQuestionRow,
  type CreateTestInput,
  type UpdateTestInput,
  type CreateTestSectionInput,
  type UpdateTestSectionInput,
  type TestsListParams,
} from "../repositories/tests.repository";
import testQuestionsRepository from "../repositories/test-questions.repository";
import testQuestionsService, {
  type TestQuestionResponse,
} from "./test-questions.service";
import testEntitlementsService from "./test-entitlements.service";
import testModulesService from "./test-modules.service";
import { servedQuestionOrder, shuffleArray } from "../utils/shuffle.util";

const MAX_SECTIONS = 10;
const VALID_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const VALID_SHOW_SOLUTIONS = new Set(["IMMEDIATE", "AFTER_SERIES_END", "NEVER"]);
const VALID_MODES = new Set(["STANDARD", "ADAPTIVE"]);

export interface TestResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  coverImageKey: string | null;
  durationMin: number;
  totalMarks: string;
  status: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showSolutions: string;
  allowReattempt: boolean;
  maxAttempts: number | null;
  proctoringEnabled: boolean;
  proctorCamera: boolean;
  proctorMaxTabSwitches: number | null;
  proctorMic: boolean;
  proctorFullscreen: boolean;
  proctorBlockCopyPaste: boolean;
  proctorAction: string;
  availableFrom: string | null;
  availableUntil: string | null;
  certificateEnabled: boolean;
  certificateTemplateId: string | null;
  certificateMinScorePct: string | null;
  calculatorMode: string;
  passCriteriaPct: string | null;
  targetExam: string | null;
  targetRankCurveId: string | null;
  randomQuestionCount: number | null;
  /** Questions actually served per attempt (blueprint rule counts + random
   * counts + full-serve sections). Equals the pool when nothing limits it. */
  servedQuestionCount: number;
  /**
   * Lowest and highest total a learner could be served. Equal unless a single
   * section's pool mixes marks, in which case the builder warns, because the
   * cohort would be scored out of different totals.
   */
  servedMarksMin: number | null;
  servedMarksMax: number | null;
  mode: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Non-blocking publish findings (e.g., unreachable adaptive modules). */
  publishWarnings?: string[];
}

export interface TestSectionResponse {
  id: string;
  tenantId: string;
  testId: string;
  name: string;
  instructions: string | null;
  timeLimitMin: number | null;
  orderIndex: number;
  markingScheme: unknown;
  questionSelection: unknown;
  questionBankId: string | null;
  randomQuestionCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestSectionQuestionResponse {
  id: string;
  testId: string;
  sectionId: string;
  questionId: string;
  orderIndex: number;
  marksOverride: string | null;
}

function parseJson(value: unknown): unknown {
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

const VALID_PROCTOR_ACTIONS = new Set(["WARN", "AUTO_SUBMIT"]);

/**
 * Validate the new scheduling / proctoring / certificate config on a test
 * create or update payload. All fields are optional; only present values are
 * checked. Throws BadRequestError on invalid input.
 */
function validateTestConfig(data: {
  available_from?: Date | string | null;
  available_until?: Date | string | null;
  proctor_action?: string;
  certificate_min_score_pct?: number | null;
}): void {
  const from = data.available_from ? new Date(data.available_from) : null;
  const until = data.available_until ? new Date(data.available_until) : null;
  if (from && isNaN(from.getTime()))
    throw new BadRequestError("available_from is not a valid date");
  if (until && isNaN(until.getTime()))
    throw new BadRequestError("available_until is not a valid date");
  if (from && until && from.getTime() >= until.getTime())
    throw new BadRequestError("available_from must be before available_until");
  if (
    data.proctor_action !== undefined &&
    !VALID_PROCTOR_ACTIONS.has(data.proctor_action)
  )
    throw new BadRequestError("proctor_action must be WARN or AUTO_SUBMIT");
  if (
    data.certificate_min_score_pct !== undefined &&
    data.certificate_min_score_pct !== null &&
    (data.certificate_min_score_pct < 0 || data.certificate_min_score_pct > 100)
  )
    throw new BadRequestError("certificate_min_score_pct must be between 0 and 100");
}

/**
 * `random_question_count` is optional. When provided it must be a positive
 * integer (>= 1); `null` clears it (serve all questions). Mirrors the quiz
 * validation so admin behaviour is consistent across quizzes and tests.
 */
function validateRandomQuestionCount(value: number | null | undefined): void {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestError(
      "random_question_count must be a positive integer (>= 1) or null to clear"
    );
  }
}

/** Mirror of the runtime rule-count resolution (learner-api test-blueprint.util). */
function resolveBlueprintRuleCount(
  rule: { mode?: string; value?: number },
  totalCount?: number
): number {
  if (rule.mode === "PERCENT")
    return Math.round(((rule.value ?? 0) / 100) * (totalCount ?? 0));
  return Math.max(0, Math.floor(rule.value ?? 0));
}

function parseBlueprintForServe(
  raw: unknown
): { totalCount?: number; rules: Array<{ mode?: string; value?: number }> } | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const rules = (obj as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) return null;
  return {
    totalCount: (obj as { totalCount?: number }).totalCount,
    rules: rules as Array<{ mode?: string; value?: number }>,
  };
}

/**
 * Questions actually served per attempt across a test's sections: blueprint
 * rule counts (capped at the section pool), else a section random count, else
 * the whole section. Matches the runtime serve logic so the displayed count
 * and marks reflect what a learner gets, not the full pool.
 */
function computeServedCount(
  sections: Array<{
    id: string;
    question_selection: unknown;
    random_question_count: number | null;
  }>,
  countBySection: Map<string, number>,
  testRandomCount: number | null
): number {
  let served = 0;
  let anyConfig = false;
  for (const s of sections) {
    const poolN = countBySection.get(s.id) ?? 0;
    const bp = parseBlueprintForServe(s.question_selection);
    const rules = bp?.rules ?? [];
    if (rules.length > 0) {
      anyConfig = true;
      let need = 0;
      for (const r of rules) need += resolveBlueprintRuleCount(r, bp?.totalCount);
      served += Math.min(need, poolN);
    } else {
      const rqc = Number(s.random_question_count ?? 0);
      if (rqc > 0) anyConfig = true;
      served += rqc > 0 ? Math.min(rqc, poolN) : poolN;
    }
  }
  // With no section-level config the test-level random count still caps what a
  // learner sees, so the builder must report that rather than the whole pool.
  if (!anyConfig) {
    const n = Number(testRandomCount ?? 0);
    if (Number.isInteger(n) && n > 0 && n < served) return n;
  }
  return served;
}

interface FullBlueprintRule {
  subjectNodeId?: string | null;
  chapterNodeId?: string | null;
  topicNodeId?: string | null;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "ANY";
  mode?: "COUNT" | "PERCENT";
  value?: number;
}

/** Like parseBlueprintForServe but keeps each rule's node/difficulty filters,
 *  needed to match questions when summing served MARKS (not just counts). */
function parseFullBlueprint(
  raw: unknown
): { totalCount?: number; rules: FullBlueprintRule[] } | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const rules = (obj as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) return null;
  return {
    totalCount: (obj as { totalCount?: number }).totalCount,
    rules: rules.filter((r): r is FullBlueprintRule => Boolean(r)),
  };
}

function matchesRule(
  q: {
    difficulty: string;
    subject_node_id: string | null;
    chapter_node_id: string | null;
    topic_node_id: string | null;
  },
  rule: FullBlueprintRule
): boolean {
  if (rule.subjectNodeId && q.subject_node_id !== rule.subjectNodeId) return false;
  if (rule.chapterNodeId && q.chapter_node_id !== rule.chapterNodeId) return false;
  if (rule.topicNodeId && q.topic_node_id !== rule.topicNodeId) return false;
  if (
    rule.difficulty &&
    rule.difficulty !== "ANY" &&
    String(q.difficulty) !== rule.difficulty
  )
    return false;
  return true;
}

interface ServedMarksRow {
  section_id: string;
  question_id: string;
  order_index: number | null;
  marks_override: string | null;
  marks: string;
  difficulty: string;
  subject_node_id: string | null;
  chapter_node_id: string | null;
  topic_node_id: string | null;
}

/**
 * EXACT marks a learner is served per attempt = the sum of the real marks of
 * the blueprint/random selection, mirroring the runtime serve logic
 * (selectBlueprintQuestions in learner-api). Returns null when no section
 * defines a blueprint/random config, so the caller keeps the full stored total.
 *
 * Replaces the old `(servedCount / poolCount) * total` estimate, which assumed
 * every question was worth the pool's *average* mark and therefore mis-reported
 * non-uniform tests (40×1 + 10×2 = 60 marks showed as 50). The picker is
 * deterministic (first N of a matching set): the SUM is exact whenever marks are
 * uniform within a rule/section (the real-world setup).
 */
function computeServedMarks(
  sections: Array<{
    id: string;
    question_selection: unknown;
    random_question_count: number | null;
  }>,
  rows: ServedMarksRow[],
  testRandomCount: number | null
): number | null {
  if (rows.length === 0) return null;

  const poolBySection = new Map<string, string[]>();
  const qById = new Map<string, ServedMarksRow>();
  const marksById = new Map<string, number>();
  for (const r of rows) {
    const arr = poolBySection.get(r.section_id) ?? [];
    arr.push(r.question_id);
    poolBySection.set(r.section_id, arr);
    if (!qById.has(r.question_id)) qById.set(r.question_id, r);
    if (!marksById.has(r.question_id)) {
      marksById.set(
        r.question_id,
        r.marks_override != null ? Number(r.marks_override) : Number(r.marks ?? 0)
      );
    }
  }

  const chosen = new Set<string>();
  let anyConfig = false;
  let served = 0;
  const take = (ids: string[]) => {
    for (const id of ids) {
      if (chosen.has(id)) continue;
      chosen.add(id);
      served += marksById.get(id) ?? 0;
    }
  };

  for (const section of sections) {
    const poolIds = poolBySection.get(section.id) ?? [];
    const bp = parseFullBlueprint(section.question_selection);
    const rules = bp?.rules ?? [];
    const randomCount = Number(section.random_question_count ?? 0);

    if (rules.length > 0) {
      anyConfig = true;
      for (const rule of rules) {
        const need = resolveBlueprintRuleCount(rule, bp?.totalCount);
        if (need <= 0) continue;
        const q = (id: string) => qById.get(id);
        const matching = poolIds.filter((id) => {
          const row = q(id);
          return !chosen.has(id) && row != null && matchesRule(row, rule);
        });
        take(matching.slice(0, Math.min(need, matching.length)));
      }
    } else if (Number.isInteger(randomCount) && randomCount > 0) {
      anyConfig = true;
      const avail = poolIds.filter((id) => !chosen.has(id));
      take(avail.slice(0, Math.min(randomCount, avail.length)));
    } else {
      take(poolIds);
    }
  }

  // Same fallback as the range helper: a test-level random count still limits
  // what a learner is served even when no section configures anything.
  if (!anyConfig) {
    const n = Number(testRandomCount ?? 0);
    if (!Number.isInteger(n) || n <= 0 || n >= rows.length) return null;
    const sorted = [...rows.map((r) => marksById.get(r.question_id) ?? 0)].sort(
      (a, b) => a - b
    );
    // Indicative only: which N the picker lands on is random when marks differ.
    return sorted.slice(0, n).reduce((t, m) => t + m, 0);
  }
  return served;
}


/**
 * Lowest and highest total a learner could be served, when the test hands out a
 * random subset.
 *
 * Randomness only produces unequal totals when a single section's pool mixes
 * marks: draw 3 from a pool holding 2, 4 and 6 mark questions and one learner
 * sits a paper worth 6 while another sits one worth 16. Keep the marks uniform
 * inside a section and the range collapses to a single number, which is how the
 * picker is meant to be configured.
 *
 * Rules are measured independently rather than replaying the greedy exclusion
 * the runtime does, so on overlapping rules the range is indicative and errs
 * wide. It is a warning, not a score.
 */
function computeServedMarksRange(
  sections: Array<{
    id: string;
    question_selection: unknown;
    random_question_count: number | null;
  }>,
  rows: ServedMarksRow[],
  testRandomCount: number | null
): { min: number; max: number } | null {
  if (rows.length === 0) return null;

  const poolBySection = new Map<string, ServedMarksRow[]>();
  const marksOf = (r: ServedMarksRow) =>
    r.marks_override != null ? Number(r.marks_override) : Number(r.marks ?? 0);
  for (const r of rows) {
    const arr = poolBySection.get(r.section_id) ?? [];
    arr.push(r);
    poolBySection.set(r.section_id, arr);
  }

  const sumOfN = (marks: number[], n: number, smallest: boolean): number => {
    const sorted = [...marks].sort((a, b) => (smallest ? a - b : b - a));
    return sorted.slice(0, Math.min(n, sorted.length)).reduce((t, m) => t + m, 0);
  };

  let anyConfig = false;
  let min = 0;
  let max = 0;

  for (const section of sections) {
    const pool = poolBySection.get(section.id) ?? [];
    const bp = parseFullBlueprint(section.question_selection);
    const rules = bp?.rules ?? [];
    const randomCount = Number(section.random_question_count ?? 0);

    if (rules.length > 0) {
      anyConfig = true;
      for (const rule of rules) {
        const need = resolveBlueprintRuleCount(rule, bp?.totalCount);
        if (need <= 0) continue;
        const marks = pool.filter((r) => matchesRule(r, rule)).map(marksOf);
        min += sumOfN(marks, need, true);
        max += sumOfN(marks, need, false);
      }
    } else if (Number.isInteger(randomCount) && randomCount > 0) {
      anyConfig = true;
      const marks = pool.map(marksOf);
      min += sumOfN(marks, randomCount, true);
      max += sumOfN(marks, randomCount, false);
    } else {
      const whole = pool.reduce((t, r) => t + marksOf(r), 0);
      min += whole;
      max += whole;
    }
  }

  // No section configures its own selection, so the test-level random count
  // applies across the whole pool. Mirrors the runtime fallback order in
  // learner-api: blueprint, then test-level random, then serve everything.
  if (!anyConfig) {
    const n = Number(testRandomCount ?? 0);
    const all = rows.map(marksOf);
    if (!Number.isInteger(n) || n <= 0 || n >= all.length) return null;
    return { min: sumOfN(all, n, true), max: sumOfN(all, n, false) };
  }
  return { min, max };
}

/**
 * Sets servedQuestionCount and the effective (served) total marks a learner
 * actually attempts, instead of the full pool total. poolCount = questions
 * attached across sections; servedCount = questions served per attempt;
 * servedMarks = exact sum of the served questions' marks (null → keep the full
 * stored total, i.e. no per-attempt subsetting).
 */
function withServedInfo(
  resp: TestResponse,
  poolCount: number,
  servedCount: number,
  servedMarks: number | null,
  servedRange?: { min: number; max: number } | null
): TestResponse {
  const served =
    servedCount > 0 && servedCount < poolCount ? servedCount : poolCount;
  const totalMarks =
    servedMarks != null ? String(servedMarks) : resp.totalMarks;
  return {
    ...resp,
    totalMarks,
    servedQuestionCount: served,
    servedMarksMin: servedRange?.min ?? null,
    servedMarksMax: servedRange?.max ?? null,
  };
}

function toTestResponse(row: TestRow): TestResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    coverImageKey: row.cover_image_key,
    durationMin: Number(row.duration_min ?? 0),
    totalMarks: String(row.total_marks ?? 0),
    status: String(row.status),
    shuffleQuestions: Boolean(row.shuffle_questions),
    shuffleOptions: Boolean(row.shuffle_options),
    showSolutions: String(row.show_solutions),
    allowReattempt: Boolean(row.allow_reattempt),
    maxAttempts:
      row.max_attempts === null || row.max_attempts === undefined
        ? null
        : Number(row.max_attempts),
    proctoringEnabled: Boolean(row.proctoring_enabled),
    proctorCamera: Boolean(row.proctor_camera),
    proctorMaxTabSwitches:
      row.proctor_max_tab_switches === null ||
      row.proctor_max_tab_switches === undefined
        ? null
        : Number(row.proctor_max_tab_switches),
    proctorMic: Boolean(row.proctor_mic),
    proctorFullscreen: Boolean(row.proctor_fullscreen),
    proctorBlockCopyPaste: Boolean(row.proctor_block_copy_paste),
    proctorAction: String(row.proctor_action ?? "WARN"),
    availableFrom:
      row.available_from == null
        ? null
        : row.available_from instanceof Date
          ? row.available_from.toISOString()
          : String(row.available_from),
    availableUntil:
      row.available_until == null
        ? null
        : row.available_until instanceof Date
          ? row.available_until.toISOString()
          : String(row.available_until),
    certificateEnabled: Boolean(row.certificate_enabled),
    certificateTemplateId: row.certificate_template_id ?? null,
    certificateMinScorePct: row.certificate_min_score_pct
      ? String(row.certificate_min_score_pct)
      : null,
    calculatorMode: String(row.calculator_mode ?? "NONE"),
    passCriteriaPct: row.pass_criteria_pct ? String(row.pass_criteria_pct) : null,
    targetExam: row.target_exam,
    targetRankCurveId: row.target_rank_curve_id,
    randomQuestionCount:
      row.random_question_count === null || row.random_question_count === undefined
        ? null
        : Number(row.random_question_count),
    servedQuestionCount: 0,
    servedMarksMin: null,
    servedMarksMax: null,
    mode: String(row.mode ?? "STANDARD"),
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

function toSectionResponse(row: TestSectionRow): TestSectionResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    testId: row.test_id,
    name: row.name,
    instructions: row.instructions,
    timeLimitMin: row.time_limit_min,
    orderIndex: Number(row.order_index ?? 0),
    markingScheme: parseJson(row.marking_scheme),
    questionSelection: parseJson(row.question_selection),
    questionBankId: row.question_bank_id ?? null,
    randomQuestionCount:
      row.random_question_count == null
        ? null
        : Number(row.random_question_count),
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

function toSectionQuestionResponse(
  row: TestSectionQuestionRow
): TestSectionQuestionResponse {
  return {
    id: row.id,
    testId: row.test_id,
    sectionId: row.section_id,
    questionId: row.question_id,
    orderIndex: Number(row.order_index ?? 0),
    marksOverride: row.marks_override ? String(row.marks_override) : null,
  };
}

class TestsService {
  /** Per-test served-question count + pool count, so displayed marks and
   *  question counts reflect what a learner actually gets per attempt. */
  private async servedCountsByTest(
    tenantId: string,
    testIds: string[]
  ): Promise<{
    served: Map<string, number>;
    pool: Map<string, number>;
    servedMarks: Map<string, number | null>;
    servedRange: Map<string, { min: number; max: number } | null>;
  }> {
    const pool = await testsRepository.countSectionQuestionsByTestIds(
      tenantId,
      testIds
    );
    if (testIds.length === 0)
      return {
        served: new Map(),
        pool,
        servedMarks: new Map(),
        servedRange: new Map(),
      };
    const sections = await testsRepository.findSectionsByTestIds(tenantId, testIds);
    const sectionCounts = await testsRepository.countSectionQuestionsBySectionIds(
      tenantId,
      sections.map((s) => s.id)
    );
    const randomCounts = await testsRepository.findRandomCountsByTestIds(
      tenantId,
      testIds
    );
    const marksRows = await testsRepository.findServedMarksInputByTestIds(
      tenantId,
      testIds
    );
    const byTest = new Map<string, typeof sections>();
    for (const s of sections) {
      const arr = byTest.get(s.test_id) ?? [];
      arr.push(s);
      byTest.set(s.test_id, arr);
    }
    const marksByTest = new Map<string, ServedMarksRow[]>();
    for (const r of marksRows) {
      const arr = marksByTest.get(r.test_id) ?? [];
      arr.push(r);
      marksByTest.set(r.test_id, arr);
    }
    const served = new Map<string, number>();
    const servedMarks = new Map<string, number | null>();
    const servedRange = new Map<string, { min: number; max: number } | null>();
    for (const id of testIds) {
      served.set(
        id,
        computeServedCount(
          byTest.get(id) ?? [],
          sectionCounts,
          randomCounts.get(id) ?? null
        )
      );
      servedMarks.set(
        id,
        computeServedMarks(
          byTest.get(id) ?? [],
          marksByTest.get(id) ?? [],
          randomCounts.get(id) ?? null
        )
      );
      servedRange.set(
        id,
        computeServedMarksRange(
          byTest.get(id) ?? [],
          marksByTest.get(id) ?? [],
          randomCounts.get(id) ?? null
        )
      );
    }
    return { served, pool, servedMarks, servedRange };
  }

  async list(tenantId: string, params: TestsListParams) {
    const result = await testsRepository.findByTenantId(tenantId, params);
    const ids = result.tests.map((t) => t.id);
    const { served, pool, servedMarks, servedRange } =
      await this.servedCountsByTest(tenantId, ids);
    return {
      tests: result.tests.map((row) =>
        withServedInfo(
          toTestResponse(row),
          pool.get(row.id) ?? 0,
          served.get(row.id) ?? 0,
          servedMarks.get(row.id) ?? null,
          servedRange.get(row.id) ?? null
        )
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getById(tenantId: string, testId: string): Promise<TestResponse> {
    const row = await testsRepository.findById(testId);
    if (!row) throw new NotFoundError("Test not found");
    if (row.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test");
    const { served, pool, servedMarks, servedRange } =
      await this.servedCountsByTest(tenantId, [testId]);
    return withServedInfo(
      toTestResponse(row),
      pool.get(testId) ?? 0,
      served.get(testId) ?? 0,
      servedMarks.get(testId) ?? null,
      servedRange.get(testId) ?? null
    );
  }

  async getFullTree(
    tenantId: string,
    testId: string
  ): Promise<{
    test: TestResponse;
    sections: Array<TestSectionResponse & { questions: TestSectionQuestionResponse[] }>;
    questions: TestQuestionResponse[];
  }> {
    // Self-heal a stale stored total_marks before reading, so the builder shows
    // the correct total even for tests last edited before totals were kept in
    // sync (no-op when already correct, skipped for adaptive tests).
    await this.recomputeTotalMarks(tenantId, testId);

    // Three SQL round-trips, one batched per relation. No N+1 from the client.
    // - SELECT test by id
    // - SELECT sections WHERE test_id
    // - SELECT section_questions WHERE test_id
    // - SELECT questions WHERE id IN (...)  -- batched via findByIds
    const [test, sections, sectionQuestions] = await Promise.all([
      this.getById(tenantId, testId),
      testsRepository.findSectionsByTest(testId, tenantId),
      testsRepository.findSectionQuestionsByTest(testId, tenantId),
    ]);

    const questionsBySection = new Map<string, TestSectionQuestionRow[]>();
    for (const sq of sectionQuestions) {
      const list = questionsBySection.get(sq.section_id) ?? [];
      list.push(sq);
      questionsBySection.set(sq.section_id, list);
    }

    const questionIds = Array.from(
      new Set(sectionQuestions.map((sq) => sq.question_id))
    );
    const questions = await testQuestionsService.getByIds(tenantId, questionIds);

    // `test` comes from getById, which already applies effective (served) marks
    // when random_question_count is set.
    return {
      test,
      sections: sections.map((s) => ({
        ...toSectionResponse(s),
        questions: (questionsBySection.get(s.id) ?? []).map(toSectionQuestionResponse),
      })),
      questions,
    };
  }

  async create(
    tenantId: string,
    data: Omit<CreateTestInput, "tenant_id">,
    createdBy?: string
  ): Promise<TestResponse> {
    await testEntitlementsService.ensureTestSeriesEnabled(tenantId);
    if (!data.name?.trim()) throw new BadRequestError("Test name is required");
    if (!data.duration_min || data.duration_min <= 0)
      throw new BadRequestError("Duration must be greater than 0 minutes");
    if (data.show_solutions && !VALID_SHOW_SOLUTIONS.has(data.show_solutions))
      throw new BadRequestError("Invalid show_solutions value");
    validateRandomQuestionCount(data.random_question_count);
    validateTestConfig(data);
    const mode = data.mode ?? "STANDARD";
    if (!VALID_MODES.has(mode)) throw new BadRequestError("Invalid mode");
    if (mode === "ADAPTIVE" && data.random_question_count != null)
      throw new BadRequestError(
        "Adaptive tests cannot use random_question_count; module question_count controls sampling"
      );

    const row = await testsRepository.create({
      ...data,
      tenant_id: tenantId,
      name: data.name.trim(),
      created_by: createdBy ?? data.created_by ?? null,
    });
    return toTestResponse(row);
  }

  /** Parse a section's blueprint JSON into its list of rules. */
  private parseBlueprintRules(raw: unknown): Array<{
    subjectNodeId?: string | null;
    chapterNodeId?: string | null;
    topicNodeId?: string | null;
    difficulty?: string;
  }> {
    let obj: unknown = raw;
    if (typeof raw === "string") {
      try {
        obj = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!obj || typeof obj !== "object") return [];
    const rules = (obj as { rules?: unknown }).rules;
    return Array.isArray(rules)
      ? (rules as Array<{
          subjectNodeId?: string | null;
          chapterNodeId?: string | null;
          topicNodeId?: string | null;
          difficulty?: string;
        }>)
      : [];
  }

  /**
   * Resolve a section's concrete question pool. When the section pools from a
   * bank, the pool is materialized from that bank by the blueprint rules
   * (subject/chapter/topic/difficulty), unioned and de-duplicated. With a bank
   * but no rules the whole bank is the pool. Without a bank we keep the
   * caller-supplied manual question_ids.
   */
  private async resolveSectionPool(
    tenantId: string,
    section: {
      question_bank_id?: string | null;
      question_selection?: unknown;
      question_ids?: string[];
    }
  ): Promise<string[]> {
    const bankId = section.question_bank_id;
    if (!bankId) return section.question_ids ?? [];

    const rules = this.parseBlueprintRules(section.question_selection);
    if (rules.length === 0) {
      return testQuestionsRepository.findIdsByRule(tenantId, {
        question_bank_id: bankId,
      });
    }
    const seen = new Set<string>();
    const pool: string[] = [];
    for (const rule of rules) {
      const ids = await testQuestionsRepository.findIdsByRule(tenantId, {
        question_bank_id: bankId,
        subject_node_id: rule.subjectNodeId ?? undefined,
        chapter_node_id: rule.chapterNodeId ?? undefined,
        topic_node_id: rule.topicNodeId ?? undefined,
        difficulty:
          rule.difficulty && rule.difficulty !== "ANY"
            ? rule.difficulty
            : undefined,
      });
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          pool.push(id);
        }
      }
    }
    return pool;
  }

  /**
   * One-shot creation: test plus sections plus question links in a single
   * transaction. Used by the streamlined admin wizard so the creator does
   * not have to navigate test, then add section, then add questions.
   * Returns the assembled tree so the client can hydrate the detail page
   * without a follow-up GET.
   */
  async createFull(
    tenantId: string,
    data: {
      name: string;
      description?: string | null;
      cover_image_key?: string | null;
      duration_min: number;
      pass_criteria_pct?: number | null;
      shuffle_questions?: boolean;
      shuffle_options?: boolean;
      show_solutions?: string;
      allow_reattempt?: boolean;
      max_attempts?: number | null;
      calculator_mode?: string;
      target_exam?: string | null;
      sections: Array<{
        name: string;
        instructions?: string | null;
        time_limit_min?: number | null;
        order_index?: number;
        marking_scheme?: unknown;
        question_selection?: unknown;
        question_bank_id?: string | null;
        random_question_count?: number | null;
        question_ids: string[];
      }>;
    },
    createdBy?: string
  ): Promise<{
    test: TestResponse;
    sections: Array<TestSectionResponse & { questions: TestSectionQuestionResponse[] }>;
  }> {
    await testEntitlementsService.ensureTestSeriesEnabled(tenantId);
    if ((data as { mode?: string }).mode === "ADAPTIVE")
      throw new BadRequestError(
        "Adaptive tests cannot be created via /full; create the test with mode ADAPTIVE, then add sections and modules"
      );
    if (!data.name?.trim()) throw new BadRequestError("Test name is required");
    if (!data.duration_min || data.duration_min <= 0)
      throw new BadRequestError("Duration must be greater than 0 minutes");
    if (data.show_solutions && !VALID_SHOW_SOLUTIONS.has(data.show_solutions))
      throw new BadRequestError("Invalid show_solutions value");
    if (!Array.isArray(data.sections) || data.sections.length === 0)
      throw new BadRequestError("At least one section is required");
    if (data.sections.length > MAX_SECTIONS)
      throw new BadRequestError(`A test can have at most ${MAX_SECTIONS} sections`);
    for (const s of data.sections) {
      if (!s.name?.trim()) throw new BadRequestError("Each section needs a name");
    }

    // Resolve each section's concrete pool. When a section pools from a bank we
    // materialize the pool from that bank by the blueprint rules; otherwise we
    // keep the manually selected question_ids.
    const resolvedSections = await Promise.all(
      data.sections.map(async (s) => ({
        ...s,
        question_ids: await this.resolveSectionPool(tenantId, s),
      }))
    );

    // Validate every referenced question exists for the tenant before opening the trx
    const allQuestionIds = Array.from(
      new Set(resolvedSections.flatMap((s) => s.question_ids ?? []))
    );
    let totalMarks = 0;
    if (allQuestionIds.length > 0) {
      const questions = await testQuestionsRepository.findByIds(allQuestionIds, tenantId);
      if (questions.length !== allQuestionIds.length) {
        throw new BadRequestError(
          "One or more selected questions do not exist or are not accessible"
        );
      }
      const marksById = new Map(questions.map((q) => [q.id, Number(q.marks ?? 0)]));
      for (const s of resolvedSections) {
        for (const qid of s.question_ids ?? []) {
          totalMarks += marksById.get(qid) ?? 0;
        }
      }
    }

    const result = await db.transaction().execute(async (trx) => {
      const testRow = await testsRepository.create(
        {
          tenant_id: tenantId,
          name: data.name.trim(),
          description: data.description ?? null,
          cover_image_key: data.cover_image_key ?? null,
          duration_min: data.duration_min,
          total_marks: totalMarks,
          shuffle_questions: data.shuffle_questions ?? false,
          shuffle_options: data.shuffle_options ?? false,
          show_solutions: data.show_solutions ?? "AFTER_SERIES_END",
          allow_reattempt: data.allow_reattempt ?? false,
          max_attempts: data.max_attempts ?? null,
          calculator_mode: data.calculator_mode ?? "NONE",
          pass_criteria_pct: data.pass_criteria_pct ?? null,
          target_exam: data.target_exam ?? null,
          target_rank_curve_id: null,
          created_by: createdBy ?? null,
        },
        trx
      );

      const sectionRows: TestSectionRow[] = [];
      const sectionQuestionRows: TestSectionQuestionRow[] = [];
      for (let i = 0; i < resolvedSections.length; i++) {
        const s = resolvedSections[i];
        const sectionRow = await testsRepository.createSection(
          {
            tenant_id: tenantId,
            test_id: testRow.id,
            name: s.name.trim(),
            instructions: s.instructions ?? null,
            time_limit_min: s.time_limit_min ?? null,
            order_index: s.order_index ?? i,
            marking_scheme: s.marking_scheme ?? null,
            question_selection: s.question_selection ?? null,
            question_bank_id: s.question_bank_id ?? null,
            random_question_count: s.random_question_count ?? null,
          },
          trx
        );
        sectionRows.push(sectionRow);

        const items = (s.question_ids ?? []).map((qid, idx) => ({
          tenant_id: tenantId,
          test_id: testRow.id,
          section_id: sectionRow.id,
          question_id: qid,
          order_index: idx,
          marks_override: null,
        }));
        if (items.length > 0) {
          await testsRepository.addSectionQuestions(items, trx);
          const persisted = await testsRepository.findSectionQuestions(
            sectionRow.id,
            tenantId,
            trx
          );
          sectionQuestionRows.push(...persisted);
        }
      }

      return { testRow, sectionRows, sectionQuestionRows };
    });

    const questionsBySection = new Map<string, TestSectionQuestionRow[]>();
    for (const sq of result.sectionQuestionRows) {
      const list = questionsBySection.get(sq.section_id) ?? [];
      list.push(sq);
      questionsBySection.set(sq.section_id, list);
    }

    return {
      test: toTestResponse(result.testRow),
      sections: result.sectionRows.map((s) => ({
        ...toSectionResponse(s),
        questions: (questionsBySection.get(s.id) ?? []).map(toSectionQuestionResponse),
      })),
    };
  }

  async update(
    tenantId: string,
    testId: string,
    data: UpdateTestInput
  ): Promise<TestResponse> {
    const existing = await testsRepository.findById(testId);
    if (!existing) throw new NotFoundError("Test not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test");
    if (data.name !== undefined && !data.name.trim())
      throw new BadRequestError("Test name cannot be empty");
    if (data.duration_min !== undefined && data.duration_min <= 0)
      throw new BadRequestError("Duration must be greater than 0 minutes");
    if (data.status !== undefined && !VALID_STATUSES.has(data.status))
      throw new BadRequestError("Invalid status");
    if (data.show_solutions !== undefined && !VALID_SHOW_SOLUTIONS.has(data.show_solutions))
      throw new BadRequestError("Invalid show_solutions value");
    validateRandomQuestionCount(data.random_question_count);
    validateTestConfig(data);
    const requestedMode = (data as { mode?: string }).mode;
    if (requestedMode !== undefined && requestedMode !== String(existing.mode))
      throw new BadRequestError("Test mode cannot be changed after creation");
    if (String(existing.mode) === "ADAPTIVE" && data.random_question_count != null)
      throw new BadRequestError(
        "Adaptive tests cannot use random_question_count; module question_count controls sampling"
      );

    const row = await testsRepository.update(testId, tenantId, {
      ...data,
      name: data.name?.trim(),
    });
    if (!row) throw new NotFoundError("Test not found");
    return toTestResponse(row);
  }

  async delete(tenantId: string, testId: string): Promise<void> {
    const existing = await testsRepository.findById(testId);
    if (!existing) throw new NotFoundError("Test not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test");
    const ok = await testsRepository.delete(testId, tenantId);
    if (!ok) throw new NotFoundError("Test not found");
  }

  /** Attempts for a test with a per-attempt proctoring summary (admin report). */
  /**
   * The denominator to SHOW, or null when we cannot vouch for it.
   *
   * `attemptTotalMarksSql` reconstructs the served set from the test as it
   * stands today. For an attempt that froze its own subset that is exact. For
   * one served the whole pool it falls back to `tests.total_marks`, which is
   * recomputed whenever questions are added, removed or repriced, so if the
   * test changed after the attempt, the reconstruction no longer describes it.
   *
   * The stored percentage is what the learner was actually given, and the whole
   * point of showing a denominator is to explain that number. A denominator
   * that fails to reproduce it would make the report more confusing, not less,
   * so in that case show nothing and leave the percentage to stand alone.
   * (Measured on dev: 52 of 58 scored attempts agree, and every disagreement is
   * a whole-pool attempt on a test edited since.)
   */
  private displayTotalMarks(
    score: number | null,
    percentage: number | null,
    computed: number | null
  ): number | null {
    if (computed == null || computed <= 0) return null;
    if (score == null || percentage == null) return computed;
    const implied = (score / computed) * 100;
    return Math.abs(implied - percentage) <= 0.05 ? computed : null;
  }

  /** Shared shape for the admin attempt reports (per-test + per-series). */
  private mapAttemptReportRow(r: Record<string, unknown>) {
    const toIso = (v: unknown) =>
      v == null ? null : v instanceof Date ? v.toISOString() : String(v);
    const startedAt = toIso(r.started_at);
    const submittedAt = toIso(r.submitted_at);
    const durationSec =
      startedAt && submittedAt
        ? Math.max(0, Math.round((Date.parse(submittedAt) - Date.parse(startedAt)) / 1000))
        : null;
    const flagsRaw = r.proctoring_flags;
    const flags = Array.isArray(flagsRaw)
      ? (flagsRaw as Array<Record<string, unknown>>)
      : [];
    const num = (v: unknown) => (v != null ? Number(v) : null);
    return {
      id: String(r.id),
      testId: r.test_id != null ? String(r.test_id) : undefined,
      testName: r.test_name != null ? String(r.test_name) : undefined,
      seriesId: r.test_series_id != null ? String(r.test_series_id) : undefined,
      seriesTitle: r.series_title != null ? String(r.series_title) : undefined,
      learnerId: String(r.learner_id),
      learnerName: (r.learner_name as string) ?? "Unknown",
      learnerEmail: (r.learner_email as string) ?? null,
      learnerPhone: (r.learner_phone as string) ?? null,
      status: String(r.status),
      score: num(r.score),
      percentage: num(r.percentage),
      // The marks this attempt was graded out of. Not always the test's total:
      // random-X / blueprint tests serve a different subset per learner, so the
      // same score can legitimately produce a different percentage. Showing the
      // denominator alongside the score is what makes that legible.
      totalMarks: this.displayTotalMarks(
        num(r.score),
        num(r.percentage),
        num(r.attempt_total_marks)
      ),
      scaledScore: num(r.scaled_score),
      scaledScoreMax: r.scaled_score_max != null ? Number(r.scaled_score_max) : null,
      percentile: num(r.percentile),
      rank: r.rank != null ? Number(r.rank) : null,
      startedAt: startedAt ?? "",
      submittedAt,
      durationSec,
      tabSwitchCount: Number(r.tab_switch_count ?? 0),
      flagCount: flags.length,
      flags: flags.map((f) => ({
        type: String(f.type ?? "EVENT"),
        at: String(f.at ?? ""),
        detail: f.detail != null ? String(f.detail) : undefined,
      })),
    };
  }

  async listAttempts(tenantId: string, testId: string) {
    const existing = await testsRepository.findById(testId);
    if (!existing) throw new NotFoundError("Test not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test");
    const rows = await testsRepository.listAttemptsForTest(tenantId, testId);
    return rows.map((r) => this.mapAttemptReportRow(r as Record<string, unknown>));
  }

  /** Batch-wise report: every attempt across all tests in a series. */
  async listSeriesAttempts(tenantId: string, seriesId: string) {
    const rows = await testsRepository.listAttemptsForSeries(tenantId, seriesId);
    return rows.map((r) => this.mapAttemptReportRow(r as Record<string, unknown>));
  }

  /** Learners who have sat any test, for the staff learner picker. */
  async listLearners(
    tenantId: string,
    params: { search?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const { learners, total } = await testsRepository.listLearnersWithAttempts(
      tenantId,
      { search: params.search, page, limit }
    );
    const num = (v: unknown) => (v != null ? Number(v) : null);
    return {
      learners: learners.map((r) => ({
        learnerId: r.learner_id,
        name: r.learner_name ?? "Unknown",
        email: r.learner_email ?? null,
        phone: r.learner_phone ?? null,
        attemptCount: Number(r.attempt_count ?? 0),
        testCount: Number(r.test_count ?? 0),
        submittedCount: Number(r.submitted_count ?? 0),
        avgPercentage: num(r.avg_percentage),
        lastSubmittedAt:
          r.last_submitted_at instanceof Date
            ? r.last_submitted_at.toISOString()
            : (r.last_submitted_at as string | null),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Every test one learner has taken, across all series.
   *
   * The per test and per series reports answer "how did this test go". Faculty
   * also asked the other question, "show me a specific test taken by a
   * specific user", which needs a learner-first entry point, since they do not
   * necessarily know which series the test sat in.
   */
  async listLearnerAttempts(tenantId: string, learnerId: string) {
    const rows = await testsRepository.listAttemptsForLearner(tenantId, learnerId);
    const attempts = rows.map((r) =>
      this.mapAttemptReportRow(r as Record<string, unknown>)
    );

    const first = attempts[0];
    const submitted = attempts.filter(
      (a) => a.submittedAt && a.percentage != null
    );
    const avg =
      submitted.length > 0
        ? submitted.reduce((s, a) => s + (a.percentage ?? 0), 0) / submitted.length
        : null;

    return {
      learner: {
        learnerId,
        name: first?.learnerName ?? "Unknown",
        email: first?.learnerEmail ?? null,
        phone: first?.learnerPhone ?? null,
      },
      summary: {
        attemptCount: attempts.length,
        testCount: new Set(attempts.map((a) => a.testId)).size,
        submittedCount: submitted.length,
        avgPercentage: avg == null ? null : Math.round(avg * 100) / 100,
      },
      attempts,
    };
  }

  /**
   * One learner's attempt replayed question by question, for staff.
   *
   * The learner already gets this on their own result page; faculty need the
   * same view to see where a cohort is losing marks. Unlike the learner's view
   * this ignores the test's `show_solutions` setting, the correct answer and
   * explanation are always included, because the whole point is diagnosing gaps.
   */
  async getAttemptReview(tenantId: string, attemptId: string) {
    const data = await testsRepository.getAttemptReview(tenantId, attemptId);
    if (!data) throw new NotFoundError("Attempt not found");
    const { attempt, answers, sectionQuestions, modules } = data;

    const num = (v: unknown) => (v != null ? Number(v) : null);
    const toIso = (v: unknown) =>
      v == null ? null : v instanceof Date ? v.toISOString() : String(v);

    const answerByQuestion = new Map(answers.map((a) => [a.question_id, a]));

    // Resolve the served questions, in the order the learner saw them.
    type ReviewQuestion = {
      questionId: string;
      sectionId: string | null;
      sectionName: string | null;
      type: string;
      difficulty: string | null;
      stem: unknown;
      options: unknown;
      correctAnswer: unknown;
      explanation: string | null;
      marks: number;
      negativeMarks: number;
      subject: string | null;
      chapter: string | null;
      topic: string | null;
      isPretest: boolean;
    };
    let served: ReviewQuestion[] = [];

    if (modules.length > 0) {
      // Adaptive: the served set lives on the attempt's modules and adaptive
      // tests keep no test_section_questions rows. Pretest questions are shown
      // but flagged, since they carry no marks.
      const sectionNameById = new Map(
        sectionQuestions.map((sq) => [sq.section_id, sq.section_name])
      );
      const ordered: Array<{ id: string; sectionId: string; isPretest: boolean }> = [];
      for (const m of modules) {
        const scored = (m.question_ids ?? []) as unknown as string[];
        const pretest = (m.pretest_ids ?? []) as unknown as string[];
        const pretestSet = new Set(pretest);
        // Same display order as the player (learner-api servedIds): scored and
        // pretest are mixed by a seeded shuffle whenever the module has pretest.
        const display =
          pretest.length === 0
            ? scored
            : shuffleArray([...scored, ...pretest], attempt.id + m.module_id + ":serve");
        for (const qid of display)
          ordered.push({ id: qid, sectionId: m.section_id, isPretest: pretestSet.has(qid) });
      }
      const rows = await testsRepository.findQuestionsForReview(
        tenantId,
        Array.from(new Set(ordered.map((o) => o.id)))
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      served = ordered.flatMap(({ id, sectionId, isPretest }) => {
        const q = byId.get(id);
        if (!q) return [];
        return [
          {
            questionId: q.id,
            sectionId,
            sectionName: sectionNameById.get(sectionId) ?? null,
            type: String(q.type),
            difficulty: q.difficulty != null ? String(q.difficulty) : null,
            stem: q.stem,
            options: q.options,
            correctAnswer: q.correct_answer,
            explanation: q.explanation ?? null,
            marks: Number(q.marks ?? 0),
            negativeMarks: Number(q.negative_marks ?? 0),
            subject: q.subject ?? null,
            chapter: q.chapter ?? null,
            topic: q.topic ?? null,
            isPretest,
          },
        ];
      });
    } else {
      // Standard: an empty question_ids means the whole pool was served.
      const frozen = (attempt.question_ids ?? []) as unknown as string[];
      const allowed = frozen.length > 0 ? new Set(frozen) : null;
      // Rows arrive in section order; reproduce the attempt's per-section
      // shuffle so "#7" here is the learner's question 7. A question attached
      // to two sections of the same test is reviewed once.
      const sectionIds = Array.from(new Set(sectionQuestions.map((sq) => sq.section_id)));
      const order = servedQuestionOrder({
        attemptId: attempt.id,
        sections: sectionIds.map((id) => ({ id })),
        sectionQuestions,
        isServed: (id) => !allowed || allowed.has(id),
        shuffleQuestions: Boolean(attempt.shuffle_questions),
      });
      const firstRow = new Map<string, (typeof sectionQuestions)[number]>();
      for (const sq of sectionQuestions)
        if (!firstRow.has(sq.question_id)) firstRow.set(sq.question_id, sq);
      served = order.flatMap((qid) => {
        const sq = firstRow.get(qid);
        if (!sq) return [];
        return [
          {
            questionId: sq.question_id,
            sectionId: sq.section_id,
            sectionName: sq.section_name,
            type: String(sq.type),
            difficulty: sq.difficulty != null ? String(sq.difficulty) : null,
            stem: sq.stem,
            options: sq.options,
            correctAnswer: sq.correct_answer,
            explanation: sq.explanation ?? null,
            marks: Number(sq.marks_override ?? sq.marks ?? 0),
            negativeMarks: Number(sq.negative_marks ?? 0),
            subject: sq.subject ?? null,
            chapter: sq.chapter ?? null,
            topic: sq.topic ?? null,
            isPretest: false,
          },
        ];
      });
    }

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let pendingReview = 0;

    // Options in the order the learner saw them (player seed: attempt.id +
    // question id). Staff then read "C." exactly where the learner saw "C.";
    // grading is by option id, so this changes nothing about the marks.
    const shuffleOptions = Boolean(attempt.shuffle_options);
    const asLearnerSaw = (questionId: string, options: unknown): unknown => {
      let parsed = options;
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return options;
        }
      }
      return shuffleOptions && Array.isArray(parsed)
        ? shuffleArray(parsed as unknown[], attempt.id + questionId)
        : parsed;
    };

    const questions = served.map((q, index) => {
      const a = answerByQuestion.get(q.questionId);
      const answered = a != null && a.answer !== null && a.answer !== undefined;
      const gradingStatus = String(a?.grading_status ?? "AUTO_GRADED");
      let outcome: "CORRECT" | "WRONG" | "SKIPPED" | "PENDING_REVIEW";
      if (gradingStatus === "PENDING_REVIEW") outcome = "PENDING_REVIEW";
      else if (!answered) outcome = "SKIPPED";
      else if (a?.is_correct === true) outcome = "CORRECT";
      else outcome = "WRONG";

      if (outcome === "CORRECT") correct += 1;
      else if (outcome === "WRONG") wrong += 1;
      else if (outcome === "SKIPPED") skipped += 1;
      else pendingReview += 1;

      return {
        ...q,
        options: asLearnerSaw(q.questionId, q.options),
        order: index + 1,
        outcome,
        learnerAnswer: a ? a.answer : null,
        isCorrect: a ? (a.is_correct ?? null) : null,
        marksAwarded: a ? Number(a.marks_awarded ?? 0) : 0,
        timeSpentSec: a ? Number(a.time_spent_sec ?? 0) : 0,
        markedForReview: a ? Boolean(a.marked_for_review) : false,
        gradingStatus,
        graderRemarks: a ? (a.grader_remarks ?? null) : null,
      };
    });

    const startedAt = toIso(attempt.started_at);
    const submittedAt = toIso(attempt.submitted_at);

    return {
      attempt: {
        id: attempt.id,
        testId: attempt.test_id,
        testName: attempt.test_name,
        testMode: String(attempt.test_mode ?? "STANDARD"),
        seriesId: attempt.test_series_id,
        seriesTitle: attempt.series_title ?? null,
        learnerId: attempt.learner_id,
        learnerName: attempt.learner_name ?? "Unknown",
        learnerEmail: attempt.learner_email ?? null,
        learnerPhone: attempt.learner_phone ?? null,
        status: String(attempt.status),
        gradingStatus: String(attempt.grading_status),
        score: num(attempt.score),
        totalMarks: this.displayTotalMarks(
          num(attempt.score),
          num(attempt.percentage),
          num(attempt.attempt_total_marks)
        ),
        percentage: num(attempt.percentage),
        percentile: num(attempt.percentile),
        rank: attempt.rank != null ? Number(attempt.rank) : null,
        scaledScore: num(attempt.scaled_score),
        scaledScoreMax:
          attempt.scaled_score_max != null ? Number(attempt.scaled_score_max) : null,
        passCriteriaPct: num(attempt.pass_criteria_pct),
        tabSwitchCount: Number(attempt.tab_switch_count ?? 0),
        startedAt,
        submittedAt,
        durationSec:
          startedAt && submittedAt
            ? Math.max(
                0,
                Math.round((Date.parse(submittedAt) - Date.parse(startedAt)) / 1000)
              )
            : null,
        correctCount: correct,
        wrongCount: wrong,
        skippedCount: skipped,
        pendingReviewCount: pendingReview,
      },
      questions,
    };
  }

  /**
   * Publish a test. Validates: ≥1 section, ≥1 question per section, all questions have correct_answer,
   * duration > 0. Computes total_marks from attached questions.
   */
  async publish(tenantId: string, testId: string): Promise<TestResponse> {
    const existing = await testsRepository.findById(testId);
    if (!existing) throw new NotFoundError("Test not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test");
    if (Number(existing.duration_min ?? 0) <= 0)
      throw new BadRequestError("Duration must be > 0 to publish");

    if (String(existing.mode) === "ADAPTIVE") {
      // Adaptive tests validate module structure instead of section questions.
      // total_marks/duration_min become worst-case-path sums (display only;
      // runtime totals derive from each attempt's served questions/modules).
      const computed = await testModulesService.validateForPublish(tenantId, testId);
      const row = await testsRepository.update(testId, tenantId, {
        status: "PUBLISHED",
        total_marks: computed.totalMarks,
        duration_min:
          computed.durationMin > 0
            ? computed.durationMin
            : Number(existing.duration_min ?? 0),
      });
      if (!row) throw new NotFoundError("Test not found");
      const response = toTestResponse(row);
      if (computed.warnings.length > 0) response.publishWarnings = computed.warnings;
      return response;
    }

    const sections = await testsRepository.findSectionsByTest(testId, tenantId);
    if (sections.length === 0)
      throw new BadRequestError("Test must have at least one section before publishing");

    const sectionQuestions = await testsRepository.findSectionQuestionsByTest(
      testId,
      tenantId
    );
    const questionIds = sectionQuestions.map((sq) => sq.question_id);
    if (questionIds.length === 0)
      throw new BadRequestError("Test must have at least one question before publishing");

    // Each section must have ≥1 question
    const counts = new Map<string, number>();
    for (const sq of sectionQuestions) {
      counts.set(sq.section_id, (counts.get(sq.section_id) ?? 0) + 1);
    }
    for (const s of sections) {
      if ((counts.get(s.id) ?? 0) === 0)
        throw new BadRequestError(`Section "${s.name}" has no questions`);
    }

    // All referenced questions must have correct_answer set and exist for this tenant
    const questions = await testQuestionsRepository.findByIds(questionIds, tenantId);
    if (questions.length !== questionIds.length) {
      throw new BadRequestError(
        "One or more attached questions do not exist or are not accessible"
      );
    }
    for (const q of questions) {
      // Descriptive questions are graded manually by an evaluator, so they have
      // no answer key, don't block publishing on a missing correct_answer.
      if (String(q.type) === "DESCRIPTIVE") continue;
      if (q.correct_answer === null || q.correct_answer === undefined) {
        throw new BadRequestError(
          `Question ${q.id} is missing a correct answer and cannot be published`
        );
      }
    }

    // Same summation the builder and read-path self-heal use, so publishing can
    // never disagree with the total shown while editing.
    const totalMarks = await this.sumSectionQuestionMarks(tenantId, sectionQuestions);

    const row = await testsRepository.update(testId, tenantId, {
      status: "PUBLISHED",
      total_marks: totalMarks,
    });
    if (!row) throw new NotFoundError("Test not found");
    return toTestResponse(row);
  }

  async unpublish(tenantId: string, testId: string): Promise<TestResponse> {
    const existing = await testsRepository.findById(testId);
    if (!existing) throw new NotFoundError("Test not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test");
    const row = await testsRepository.update(testId, tenantId, {
      status: "DRAFT",
    });
    if (!row) throw new NotFoundError("Test not found");
    return toTestResponse(row);
  }

  // ---------- Sections ----------
  async listSections(tenantId: string, testId: string): Promise<TestSectionResponse[]> {
    await this.getById(tenantId, testId);
    const rows = await testsRepository.findSectionsByTest(testId, tenantId);
    return rows.map(toSectionResponse);
  }

  async createSection(
    tenantId: string,
    testId: string,
    data: Omit<CreateTestSectionInput, "tenant_id" | "test_id">
  ): Promise<TestSectionResponse> {
    await this.getById(tenantId, testId);
    if (!data.name?.trim()) throw new BadRequestError("Section name is required");
    const existing = await testsRepository.findSectionsByTest(testId, tenantId);
    if (existing.length >= MAX_SECTIONS) {
      throw new BadRequestError(`A test can have at most ${MAX_SECTIONS} sections`);
    }
    const row = await testsRepository.createSection({
      ...data,
      tenant_id: tenantId,
      test_id: testId,
      name: data.name.trim(),
      order_index: data.order_index ?? existing.length,
    });
    // Sections that pool from a bank get their questions materialized from it.
    if (row.question_bank_id) {
      const ids = await this.resolveSectionPool(tenantId, {
        question_bank_id: row.question_bank_id,
        question_selection: row.question_selection,
      });
      await testsRepository.replaceSectionQuestions(row.id, tenantId, testId, ids);
      await this.recomputeTotalMarks(tenantId, testId);
    }
    return toSectionResponse(row);
  }

  async updateSection(
    tenantId: string,
    sectionId: string,
    data: UpdateTestSectionInput
  ): Promise<TestSectionResponse> {
    const existing = await testsRepository.findSectionById(sectionId, tenantId);
    if (!existing) throw new NotFoundError("Section not found");
    const row = await testsRepository.updateSection(sectionId, tenantId, {
      ...data,
      name: data.name?.trim(),
    });
    if (!row) throw new NotFoundError("Section not found");
    // Re-pool from the bank when the bank or its rules changed (rule-based add
    // of questions after the test was created).
    if (
      (data.question_bank_id !== undefined ||
        data.question_selection !== undefined) &&
      row.question_bank_id
    ) {
      const ids = await this.resolveSectionPool(tenantId, {
        question_bank_id: row.question_bank_id,
        question_selection: row.question_selection,
      });
      await testsRepository.replaceSectionQuestions(
        sectionId,
        tenantId,
        row.test_id,
        ids
      );
      await this.recomputeTotalMarks(tenantId, row.test_id);
    }
    return toSectionResponse(row);
  }

  async deleteSection(tenantId: string, sectionId: string): Promise<void> {
    const existing = await testsRepository.findSectionById(sectionId, tenantId);
    if (!existing) throw new NotFoundError("Section not found");
    const ok = await testsRepository.deleteSection(sectionId, tenantId);
    if (!ok) throw new NotFoundError("Section not found");
    await this.recomputeTotalMarks(tenantId, existing.test_id);
  }

  // ---------- Section questions ----------
  /**
   * Recompute and persist a standard test's total_marks from its currently
   * attached section questions (a per-question marks_override wins over the
   * question's own marks). Called after any change to section questions so the
   * stored total, shown in the builder and on the learner test-info, never
   * goes stale between edits and publish. Adaptive tests derive their totals
   * from modules at publish time, so they are skipped here.
   */
  async recomputeTotalMarks(tenantId: string, testId: string): Promise<void> {
    const test = await testsRepository.findById(testId);
    if (!test || test.tenant_id !== tenantId) return;
    if (String(test.mode) === "ADAPTIVE") return;

    const sectionQuestions = await testsRepository.findSectionQuestionsByTest(
      testId,
      tenantId
    );
    const totalMarks = await this.sumSectionQuestionMarks(tenantId, sectionQuestions);
    // Skip the write when nothing changed so read-path self-healing is a no-op
    // for tests whose stored total is already correct.
    if (Number(test.total_marks ?? 0) === totalMarks) return;
    await testsRepository.update(testId, tenantId, { total_marks: totalMarks });
  }

  /**
   * The one place marks are added up. Sums over ATTACHMENTS (not distinct
   * questions), so a question attached to two sections counts twice, and treats
   * a marks_override of 0 as a real override rather than falling back to the
   * question's own marks.
   */
  private async sumSectionQuestionMarks(
    tenantId: string,
    sectionQuestions: Array<{ question_id: string; marks_override: unknown }>
  ): Promise<number> {
    if (sectionQuestions.length === 0) return 0;
    const qIds = Array.from(new Set(sectionQuestions.map((sq) => sq.question_id)));
    const questions = await testQuestionsRepository.findByIds(qIds, tenantId);
    const marksById = new Map(questions.map((q) => [q.id, Number(q.marks ?? 0)]));
    let total = 0;
    for (const sq of sectionQuestions) {
      const override = (sq.marks_override as string | null) ?? null;
      total +=
        override !== null ? Number(override) : marksById.get(sq.question_id) ?? 0;
    }
    return total;
  }

  /**
   * Refresh every test that attaches this question. Called when the question's
   * own marks change or it is removed from the bank, without this the stored
   * total silently keeps the marks the question had when it was attached.
   */
  async recomputeTotalMarksForQuestion(
    tenantId: string,
    questionId: string
  ): Promise<void> {
    const testIds = await testsRepository.findTestIdsUsingQuestion(questionId, tenantId);
    for (const testId of testIds) {
      await this.recomputeTotalMarks(tenantId, testId);
    }
  }

  async addSectionQuestions(
    tenantId: string,
    testId: string,
    sectionId: string,
    items: Array<{ question_id: string; order_index?: number; marks_override?: number | null }>
  ): Promise<{ added: number }> {
    await this.getById(tenantId, testId);
    const section = await testsRepository.findSectionById(sectionId, tenantId);
    if (!section) throw new NotFoundError("Section not found");
    if (section.test_id !== testId)
      throw new BadRequestError("Section does not belong to this test");

    const questionIds = items.map((i) => i.question_id);
    const questions = await testQuestionsRepository.findByIds(questionIds, tenantId);
    if (questions.length !== questionIds.length) {
      throw new BadRequestError("One or more questions do not exist or are not accessible");
    }

    const existingCount = (await testsRepository.findSectionQuestions(sectionId, tenantId))
      .length;

    const payload = items.map((i, idx) => ({
      tenant_id: tenantId,
      test_id: testId,
      section_id: sectionId,
      question_id: i.question_id,
      order_index: i.order_index ?? existingCount + idx,
      marks_override: i.marks_override ?? null,
    }));

    await db.transaction().execute(async (trx) => {
      await testsRepository.addSectionQuestions(payload, trx);
    });
    await this.recomputeTotalMarks(tenantId, testId);
    return { added: payload.length };
  }

  async removeSectionQuestion(
    tenantId: string,
    sectionId: string,
    questionId: string
  ): Promise<void> {
    const section = await testsRepository.findSectionById(sectionId, tenantId);
    if (!section) throw new NotFoundError("Section not found");
    const ok = await testsRepository.removeSectionQuestion(
      sectionId,
      questionId,
      tenantId
    );
    if (!ok) throw new NotFoundError("Section-question link not found");
    await this.recomputeTotalMarks(tenantId, section.test_id);
  }

  async reorderSectionQuestions(
    tenantId: string,
    sectionId: string,
    orderedQuestionIds: string[]
  ): Promise<{ reordered: number }> {
    const section = await testsRepository.findSectionById(sectionId, tenantId);
    if (!section) throw new NotFoundError("Section not found");
    await db.transaction().execute(async (trx) => {
      await testsRepository.reorderSectionQuestions(
        sectionId,
        tenantId,
        orderedQuestionIds,
        trx
      );
    });
    return { reordered: orderedQuestionIds.length };
  }
}

export default new TestsService();
