import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import testModulesRepository, {
  type TestModuleRow,
  type TestModuleQuestionRow,
  type TestModuleScoreScaleRow,
  type ScoreScaleInput,
  type TestNormTableRow,
} from "../repositories/test-modules.repository";
import testsRepository, { type TestRow } from "../repositories/tests.repository";
import testQuestionsRepository from "../repositories/test-questions.repository";

const MAX_STAGES = 4;
const MAX_RULES_PER_MODULE = 10;
const MAX_QUESTIONS_PER_MODULE = 200;
const MAX_PRETEST_PER_MODULE = 50;
const MAX_TIME_LIMIT_MIN = 600;
const MAX_SCALE_MAX = 10000;
const VARIANT_PATTERN = /^[A-Z0-9_]{1,32}$/;

export interface RoutingRule {
  min_correct: number;
  next_variant: string;
}

export interface TestModuleResponse {
  id: string;
  testId: string;
  sectionId: string;
  stageNo: number;
  variant: string;
  difficultyRank: number;
  questionCount: number;
  pretestCount: number;
  timeLimitMin: number;
  routingRules: RoutingRule[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleQuestionEntry {
  questionId: string;
  isPretest: boolean;
  orderIndex: number;
}

export interface ScoreScaleResponse {
  id: string;
  testId: string;
  sectionId: string;
  pathKey: string;
  scale: number[];
  scaleMax: number;
}

export interface NormTablePointResponse {
  score: number;
  percentile: number;
}

export interface NormTableResponse {
  testId: string;
  points: NormTablePointResponse[];
  maxScore: number;
}

export interface SectionPath {
  key: string;
  variants: string[];
  modules: TestModuleRow[];
}

export interface AdaptivePublishComputation {
  totalMarks: number;
  durationMin: number;
  warnings: string[];
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

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function normalizeVariant(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestError(`${label} is required`);
  }
  const variant = value.trim().toUpperCase();
  if (!VARIANT_PATTERN.test(variant)) {
    throw new BadRequestError(
      `${label} must be 1-32 characters of A-Z, 0-9 or underscore`
    );
  }
  return variant;
}

function parseRoutingRules(value: unknown): RoutingRule[] | null {
  const parsed = parseJson(value);
  if (parsed === null || parsed === undefined) return null;
  if (!Array.isArray(parsed)) return null;
  const rules: RoutingRule[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as { min_correct?: unknown; next_variant?: unknown };
    rules.push({
      min_correct: Number(e.min_correct ?? 0),
      next_variant: String(e.next_variant ?? ""),
    });
  }
  return rules.length > 0 ? rules : null;
}

/**
 * Validate and normalize incoming routing rules. Rules are stored sorted by
 * descending min_correct so runtime evaluation is a first-match scan.
 */
function validateRoutingRules(value: unknown, questionCount: number): RoutingRule[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestError("routing_rules must be a non-empty array");
  }
  if (value.length > MAX_RULES_PER_MODULE) {
    throw new BadRequestError(`At most ${MAX_RULES_PER_MODULE} routing rules allowed`);
  }
  const rules: RoutingRule[] = value.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new BadRequestError("Each routing rule must be an object");
    }
    const e = entry as { min_correct?: unknown; next_variant?: unknown };
    const minCorrect = e.min_correct;
    if (!Number.isInteger(minCorrect) || (minCorrect as number) < 0) {
      throw new BadRequestError("routing rule min_correct must be an integer >= 0");
    }
    if ((minCorrect as number) > questionCount) {
      throw new BadRequestError(
        `routing rule min_correct (${minCorrect}) cannot exceed question_count (${questionCount})`
      );
    }
    return {
      min_correct: minCorrect as number,
      next_variant: normalizeVariant(e.next_variant, "routing rule next_variant"),
    };
  });
  const seen = new Set<number>();
  for (const r of rules) {
    if (seen.has(r.min_correct)) {
      throw new BadRequestError("routing rules must have distinct min_correct values");
    }
    seen.add(r.min_correct);
  }
  rules.sort((a, b) => b.min_correct - a.min_correct);
  return rules;
}

function toModuleResponse(row: TestModuleRow): TestModuleResponse {
  return {
    id: row.id,
    testId: row.test_id,
    sectionId: row.section_id,
    stageNo: Number(row.stage_no),
    variant: row.variant,
    difficultyRank: Number(row.difficulty_rank ?? 0),
    questionCount: Number(row.question_count),
    pretestCount: Number(row.pretest_count ?? 0),
    timeLimitMin: Number(row.time_limit_min),
    routingRules: parseRoutingRules(row.routing_rules),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toScaleResponse(row: TestModuleScoreScaleRow): ScoreScaleResponse {
  const parsed = parseJson(row.scale);
  return {
    id: row.id,
    testId: row.test_id,
    sectionId: row.section_id,
    pathKey: row.path_key,
    scale: Array.isArray(parsed) ? parsed.map((v) => Number(v)) : [],
    scaleMax: Number(row.scale_max),
  };
}

function toNormTableResponse(row: TestNormTableRow | null): NormTableResponse | null {
  if (!row) return null;
  const parsed = parseJson(row.points);
  const points = Array.isArray(parsed)
    ? parsed.map((p) => {
        const obj = (p ?? {}) as { score?: unknown; percentile?: unknown };
        return { score: Number(obj.score ?? 0), percentile: Number(obj.percentile ?? 0) };
      })
    : [];
  return { testId: row.test_id, points, maxScore: Number(row.max_score) };
}

/**
 * Enumerate every reachable path through a section's module graph.
 * A path is the sequence of variants taken at stages >= 2 (stage 1 is common
 * to all takers). Reachability = named by a routing rule, or the fallback
 * (lowest difficulty_rank) of the next stage. Returns warnings for modules
 * that can never be served.
 */
export function enumerateSectionPaths(modules: TestModuleRow[]): {
  paths: SectionPath[];
  warnings: string[];
} {
  const byStage = new Map<number, TestModuleRow[]>();
  for (const m of modules) {
    const list = byStage.get(Number(m.stage_no)) ?? [];
    list.push(m);
    byStage.set(Number(m.stage_no), list);
  }
  const stage1 = byStage.get(1) ?? [];
  if (stage1.length !== 1) {
    throw new BadRequestError("Each section must have exactly one stage 1 module");
  }

  const paths: SectionPath[] = [];
  const visited = new Set<string>();

  const walk = (current: TestModuleRow, variants: string[], chain: TestModuleRow[]) => {
    visited.add(current.id);
    const nextStage = Number(current.stage_no) + 1;
    const nextModules = byStage.get(nextStage);
    if (!nextModules || nextModules.length === 0) {
      paths.push({ key: variants.join(">"), variants, modules: chain });
      return;
    }
    const targets = new Map<string, TestModuleRow>();
    const rules = parseRoutingRules(current.routing_rules) ?? [];
    for (const rule of rules) {
      const target = nextModules.find((m) => m.variant === rule.next_variant);
      if (target) targets.set(target.variant, target);
    }
    const fallback = [...nextModules].sort(
      (a, b) => Number(a.difficulty_rank ?? 0) - Number(b.difficulty_rank ?? 0)
    )[0];
    targets.set(fallback.variant, fallback);
    for (const target of targets.values()) {
      walk(target, [...variants, target.variant], [...chain, target]);
    }
  };

  walk(stage1[0], [], [stage1[0]]);

  const warnings: string[] = [];
  for (const m of modules) {
    if (!visited.has(m.id)) {
      warnings.push(
        `Module stage ${m.stage_no} "${m.variant}" is unreachable (no routing rule or fallback leads to it)`
      );
    }
  }
  return { paths, warnings };
}

/**
 * Default raw-to-scaled curve. Monotone piecewise-linear with a floor at 25%
 * of the path ceiling. The easiest path is capped at 80% of scale_max and the
 * hardest path reaches scale_max, mirroring how the digital SAT's lower-route
 * conversion tables top out below the section ceiling.
 */
export function generateDefaultScale(
  totalScored: number,
  scaleMax: number,
  pathRank: number,
  pathCount: number
): number[] {
  if (totalScored <= 0) return [0];
  const cap =
    pathCount <= 1 ? 1 : 0.8 + 0.2 * (pathRank / Math.max(1, pathCount - 1));
  const scale: number[] = [];
  for (let i = 0; i <= totalScored; i++) {
    scale.push(Math.round(cap * scaleMax * (0.25 + 0.75 * (i / totalScored))));
  }
  return scale;
}

class TestModulesService {
  private async ensureAdaptiveTest(tenantId: string, testId: string): Promise<TestRow> {
    const test = await testsRepository.findById(testId);
    if (!test) throw new NotFoundError("Test not found");
    if (test.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test");
    if (String(test.mode) !== "ADAPTIVE")
      throw new BadRequestError("Modules are only available on adaptive tests");
    return test;
  }

  private async ensureSection(tenantId: string, testId: string, sectionId: string) {
    const section = await testsRepository.findSectionById(sectionId, tenantId);
    if (!section) throw new NotFoundError("Section not found");
    if (section.test_id !== testId)
      throw new BadRequestError("Section does not belong to this test");
    return section;
  }

  async listForTest(
    tenantId: string,
    testId: string
  ): Promise<{
    modules: Array<TestModuleResponse & { questions: ModuleQuestionEntry[] }>;
    scoreScales: ScoreScaleResponse[];
    normTable: NormTableResponse | null;
  }> {
    await this.ensureAdaptiveTest(tenantId, testId);
    const [modules, moduleQuestions, scales, normTable] = await Promise.all([
      testModulesRepository.findModulesByTest(testId, tenantId),
      testModulesRepository.findQuestionsByTest(testId, tenantId),
      testModulesRepository.findScoreScalesByTest(testId, tenantId),
      testModulesRepository.findNormTableByTest(testId, tenantId),
    ]);
    const questionsByModule = new Map<string, ModuleQuestionEntry[]>();
    for (const mq of moduleQuestions) {
      const list = questionsByModule.get(mq.module_id) ?? [];
      list.push({
        questionId: mq.question_id,
        isPretest: Boolean(mq.is_pretest),
        orderIndex: Number(mq.order_index ?? 0),
      });
      questionsByModule.set(mq.module_id, list);
    }
    return {
      modules: modules.map((m) => ({
        ...toModuleResponse(m),
        questions: questionsByModule.get(m.id) ?? [],
      })),
      scoreScales: scales.map(toScaleResponse),
      normTable: toNormTableResponse(normTable),
    };
  }

  async createModule(
    tenantId: string,
    testId: string,
    sectionId: string,
    body: {
      stage_no?: unknown;
      variant?: unknown;
      difficulty_rank?: unknown;
      question_count?: unknown;
      pretest_count?: unknown;
      time_limit_min?: unknown;
      routing_rules?: unknown;
    }
  ): Promise<TestModuleResponse> {
    await this.ensureAdaptiveTest(tenantId, testId);
    await this.ensureSection(tenantId, testId, sectionId);

    const stageNo = body.stage_no;
    if (!Number.isInteger(stageNo) || (stageNo as number) < 1 || (stageNo as number) > MAX_STAGES)
      throw new BadRequestError(`stage_no must be an integer between 1 and ${MAX_STAGES}`);
    const variant = normalizeVariant(body.variant, "variant");

    const difficultyRank = body.difficulty_rank ?? 0;
    if (!Number.isInteger(difficultyRank) || (difficultyRank as number) < 0)
      throw new BadRequestError("difficulty_rank must be an integer >= 0");

    const questionCount = body.question_count;
    if (
      !Number.isInteger(questionCount) ||
      (questionCount as number) < 1 ||
      (questionCount as number) > MAX_QUESTIONS_PER_MODULE
    )
      throw new BadRequestError(
        `question_count must be an integer between 1 and ${MAX_QUESTIONS_PER_MODULE}`
      );

    const pretestCount = body.pretest_count ?? 0;
    if (
      !Number.isInteger(pretestCount) ||
      (pretestCount as number) < 0 ||
      (pretestCount as number) > MAX_PRETEST_PER_MODULE
    )
      throw new BadRequestError(
        `pretest_count must be an integer between 0 and ${MAX_PRETEST_PER_MODULE}`
      );

    const timeLimitMin = body.time_limit_min;
    if (
      !Number.isInteger(timeLimitMin) ||
      (timeLimitMin as number) < 1 ||
      (timeLimitMin as number) > MAX_TIME_LIMIT_MIN
    )
      throw new BadRequestError(
        `time_limit_min must be an integer between 1 and ${MAX_TIME_LIMIT_MIN}`
      );

    let routingRules: RoutingRule[] | null = null;
    if (body.routing_rules !== undefined && body.routing_rules !== null) {
      routingRules = validateRoutingRules(body.routing_rules, questionCount as number);
    }

    const existing = await testModulesRepository.findModulesBySection(sectionId, tenantId);
    if (
      existing.some(
        (m) => Number(m.stage_no) === stageNo && m.variant === variant
      )
    ) {
      throw new ConflictError(
        `A module for stage ${stageNo} variant "${variant}" already exists in this section`
      );
    }
    if (stageNo === 1 && existing.some((m) => Number(m.stage_no) === 1)) {
      throw new ConflictError("This section already has a stage 1 module");
    }

    const row = await testModulesRepository.createModule({
      tenant_id: tenantId,
      test_id: testId,
      section_id: sectionId,
      stage_no: stageNo as number,
      variant,
      difficulty_rank: difficultyRank as number,
      question_count: questionCount as number,
      pretest_count: pretestCount as number,
      time_limit_min: timeLimitMin as number,
      routing_rules: routingRules,
    });
    return toModuleResponse(row);
  }

  async updateModule(
    tenantId: string,
    testId: string,
    moduleId: string,
    body: {
      difficulty_rank?: unknown;
      question_count?: unknown;
      pretest_count?: unknown;
      time_limit_min?: unknown;
      routing_rules?: unknown;
    }
  ): Promise<TestModuleResponse> {
    await this.ensureAdaptiveTest(tenantId, testId);
    const existing = await testModulesRepository.findModuleById(moduleId, tenantId);
    if (!existing || existing.test_id !== testId)
      throw new NotFoundError("Module not found");

    const update: {
      difficulty_rank?: number;
      question_count?: number;
      pretest_count?: number;
      time_limit_min?: number;
      routing_rules?: RoutingRule[] | null;
    } = {};

    if (body.difficulty_rank !== undefined) {
      if (!Number.isInteger(body.difficulty_rank) || (body.difficulty_rank as number) < 0)
        throw new BadRequestError("difficulty_rank must be an integer >= 0");
      update.difficulty_rank = body.difficulty_rank as number;
    }
    if (body.question_count !== undefined) {
      if (
        !Number.isInteger(body.question_count) ||
        (body.question_count as number) < 1 ||
        (body.question_count as number) > MAX_QUESTIONS_PER_MODULE
      )
        throw new BadRequestError(
          `question_count must be an integer between 1 and ${MAX_QUESTIONS_PER_MODULE}`
        );
      update.question_count = body.question_count as number;
    }
    if (body.pretest_count !== undefined) {
      if (
        !Number.isInteger(body.pretest_count) ||
        (body.pretest_count as number) < 0 ||
        (body.pretest_count as number) > MAX_PRETEST_PER_MODULE
      )
        throw new BadRequestError(
          `pretest_count must be an integer between 0 and ${MAX_PRETEST_PER_MODULE}`
        );
      update.pretest_count = body.pretest_count as number;
    }
    if (body.time_limit_min !== undefined) {
      if (
        !Number.isInteger(body.time_limit_min) ||
        (body.time_limit_min as number) < 1 ||
        (body.time_limit_min as number) > MAX_TIME_LIMIT_MIN
      )
        throw new BadRequestError(
          `time_limit_min must be an integer between 1 and ${MAX_TIME_LIMIT_MIN}`
        );
      update.time_limit_min = body.time_limit_min as number;
    }

    const effectiveCount = update.question_count ?? Number(existing.question_count);
    if (body.routing_rules !== undefined) {
      update.routing_rules =
        body.routing_rules === null
          ? null
          : validateRoutingRules(body.routing_rules, effectiveCount);
    } else if (update.question_count !== undefined) {
      // question_count changed: re-check stored thresholds still fit.
      const stored = parseRoutingRules(existing.routing_rules);
      if (stored && stored.some((r) => r.min_correct > effectiveCount)) {
        throw new BadRequestError(
          "Existing routing rules exceed the new question_count; update routing_rules too"
        );
      }
    }

    const row = await testModulesRepository.updateModule(moduleId, tenantId, update);
    if (!row) throw new NotFoundError("Module not found");
    return toModuleResponse(row);
  }

  async deleteModule(tenantId: string, testId: string, moduleId: string): Promise<void> {
    await this.ensureAdaptiveTest(tenantId, testId);
    const existing = await testModulesRepository.findModuleById(moduleId, tenantId);
    if (!existing || existing.test_id !== testId)
      throw new NotFoundError("Module not found");
    const ok = await testModulesRepository.deleteModule(moduleId, tenantId);
    if (!ok) throw new NotFoundError("Module not found");
  }

  async addQuestions(
    tenantId: string,
    testId: string,
    moduleId: string,
    items: Array<{ question_id: string; is_pretest?: boolean; order_index?: number }>
  ): Promise<{ added: number }> {
    await this.ensureAdaptiveTest(tenantId, testId);
    const module = await testModulesRepository.findModuleById(moduleId, tenantId);
    if (!module || module.test_id !== testId) throw new NotFoundError("Module not found");
    if (!Array.isArray(items) || items.length === 0)
      throw new BadRequestError("items array is required");
    if (items.length > 500)
      throw new BadRequestError("At most 500 questions can be added per request");

    const questionIds = items.map((i) => i.question_id);
    const questions = await testQuestionsRepository.findByIds(questionIds, tenantId);
    if (questions.length !== new Set(questionIds).size) {
      throw new BadRequestError("One or more questions do not exist or are not accessible");
    }

    const existingCount = (
      await testModulesRepository.findQuestionsByModule(moduleId, tenantId)
    ).length;

    const payload = items.map((i, idx) => ({
      tenant_id: tenantId,
      test_id: testId,
      module_id: moduleId,
      question_id: i.question_id,
      is_pretest: Boolean(i.is_pretest),
      order_index: i.order_index ?? existingCount + idx,
    }));
    await testModulesRepository.addModuleQuestions(payload);
    return { added: payload.length };
  }

  async updateQuestion(
    tenantId: string,
    testId: string,
    moduleId: string,
    questionId: string,
    body: { is_pretest?: unknown; order_index?: unknown }
  ): Promise<void> {
    await this.ensureAdaptiveTest(tenantId, testId);
    const module = await testModulesRepository.findModuleById(moduleId, tenantId);
    if (!module || module.test_id !== testId) throw new NotFoundError("Module not found");
    const update: { is_pretest?: boolean; order_index?: number } = {};
    if (body.is_pretest !== undefined) update.is_pretest = Boolean(body.is_pretest);
    if (body.order_index !== undefined) {
      if (!Number.isInteger(body.order_index) || (body.order_index as number) < 0)
        throw new BadRequestError("order_index must be an integer >= 0");
      update.order_index = body.order_index as number;
    }
    const ok = await testModulesRepository.updateModuleQuestion(
      moduleId,
      questionId,
      tenantId,
      update
    );
    if (!ok) throw new NotFoundError("Module question not found");
  }

  async removeQuestion(
    tenantId: string,
    testId: string,
    moduleId: string,
    questionId: string
  ): Promise<void> {
    await this.ensureAdaptiveTest(tenantId, testId);
    const module = await testModulesRepository.findModuleById(moduleId, tenantId);
    if (!module || module.test_id !== testId) throw new NotFoundError("Module not found");
    const ok = await testModulesRepository.removeModuleQuestion(
      moduleId,
      questionId,
      tenantId
    );
    if (!ok) throw new NotFoundError("Module question not found");
  }

  // ---------- Score scales ----------
  async saveScoreScales(
    tenantId: string,
    testId: string,
    sectionId: string,
    scales: Array<{ path_key?: unknown; scale?: unknown; scale_max?: unknown }>
  ): Promise<ScoreScaleResponse[]> {
    await this.ensureAdaptiveTest(tenantId, testId);
    await this.ensureSection(tenantId, testId, sectionId);
    if (!Array.isArray(scales))
      throw new BadRequestError("scales array is required (empty array clears)");
    if (scales.length > 20) throw new BadRequestError("At most 20 score scales per section");

    const validated: ScoreScaleInput[] = scales.map((s) => {
      const rawKey = typeof s.path_key === "string" ? s.path_key : "";
      const segments = rawKey.split(">").map((seg) => normalizeVariant(seg, "path_key segment"));
      const pathKey = segments.join(">");

      const scaleMax = s.scale_max;
      if (!Number.isInteger(scaleMax) || (scaleMax as number) < 1 || (scaleMax as number) > MAX_SCALE_MAX)
        throw new BadRequestError(`scale_max must be an integer between 1 and ${MAX_SCALE_MAX}`);

      if (!Array.isArray(s.scale) || s.scale.length < 1 || s.scale.length > 501)
        throw new BadRequestError("scale must be an array of 1 to 501 values");
      const values = s.scale.map((v) => {
        if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > (scaleMax as number))
          throw new BadRequestError(
            `scale values must be integers between 0 and scale_max (${scaleMax})`
          );
        return v as number;
      });
      for (let i = 1; i < values.length; i++) {
        if (values[i] < values[i - 1])
          throw new BadRequestError(
            `scale for path "${pathKey}" must be monotone non-decreasing`
          );
      }
      return { path_key: pathKey, scale: values, scale_max: scaleMax as number };
    });

    const seen = new Set<string>();
    for (const s of validated) {
      if (seen.has(s.path_key))
        throw new BadRequestError(`Duplicate path_key "${s.path_key}"`);
      seen.add(s.path_key);
    }

    const rows = await testModulesRepository.replaceScoreScalesForSection(
      tenantId,
      testId,
      sectionId,
      validated
    );
    return rows.map(toScaleResponse);
  }

  async autoGenerateScoreScales(
    tenantId: string,
    testId: string,
    sectionId: string,
    scaleMaxInput: unknown
  ): Promise<ScoreScaleResponse[]> {
    await this.ensureAdaptiveTest(tenantId, testId);
    await this.ensureSection(tenantId, testId, sectionId);
    const scaleMax = scaleMaxInput;
    if (!Number.isInteger(scaleMax) || (scaleMax as number) < 1 || (scaleMax as number) > MAX_SCALE_MAX)
      throw new BadRequestError(`scale_max must be an integer between 1 and ${MAX_SCALE_MAX}`);

    const modules = await testModulesRepository.findModulesBySection(sectionId, tenantId);
    if (modules.length === 0)
      throw new BadRequestError("Add modules to this section before generating scales");
    const { paths } = enumerateSectionPaths(modules);

    // Rank paths easiest -> hardest by summed difficulty_rank so the cap rises with difficulty.
    const ranked = [...paths].sort((a, b) => {
      const rank = (p: SectionPath) =>
        p.modules.reduce((sum, m) => sum + Number(m.difficulty_rank ?? 0), 0);
      return rank(a) - rank(b);
    });

    const inputs: ScoreScaleInput[] = ranked.map((path, idx) => {
      const totalScored = path.modules.reduce(
        (sum, m) => sum + Number(m.question_count),
        0
      );
      return {
        path_key: path.key,
        scale: generateDefaultScale(totalScored, scaleMax as number, idx, ranked.length),
        scale_max: scaleMax as number,
      };
    });

    const rows = await testModulesRepository.replaceScoreScalesForSection(
      tenantId,
      testId,
      sectionId,
      inputs
    );
    return rows.map(toScaleResponse);
  }

  // ---------- Norm tables (score-to-percentile, per test) ----------
  /** Replace-all: null/empty points clears the norm table. */
  async saveNormTable(
    tenantId: string,
    testId: string,
    pointsInput: unknown,
    maxScoreInput: unknown
  ): Promise<NormTableResponse | null> {
    await this.ensureAdaptiveTest(tenantId, testId);
    if (pointsInput === null || pointsInput === undefined) {
      await testModulesRepository.replaceNormTableForTest(tenantId, testId, null);
      return null;
    }
    if (!Array.isArray(pointsInput))
      throw new BadRequestError("points must be an array (empty array or null clears)");
    if (pointsInput.length === 0) {
      await testModulesRepository.replaceNormTableForTest(tenantId, testId, null);
      return null;
    }
    if (pointsInput.length > 501)
      throw new BadRequestError("points must have at most 501 entries");

    const maxScore = maxScoreInput;
    if (
      !Number.isInteger(maxScore) ||
      (maxScore as number) < 1 ||
      (maxScore as number) > MAX_SCALE_MAX
    )
      throw new BadRequestError(`max_score must be an integer between 1 and ${MAX_SCALE_MAX}`);

    const points = pointsInput.map((p, i) => {
      const obj = (p ?? {}) as { score?: unknown; percentile?: unknown };
      const score = Number(obj.score);
      const percentile = Number(obj.percentile);
      if (!Number.isFinite(score) || score < 0 || score > (maxScore as number))
        throw new BadRequestError(
          `points[${i}].score must be a number between 0 and max_score (${maxScore})`
        );
      if (!Number.isFinite(percentile) || percentile < 0 || percentile > 100)
        throw new BadRequestError(`points[${i}].percentile must be a number between 0 and 100`);
      return { score, percentile };
    });
    for (let i = 1; i < points.length; i++) {
      if (points[i].score <= points[i - 1].score)
        throw new BadRequestError("points must be sorted by strictly ascending score");
      if (points[i].percentile < points[i - 1].percentile)
        throw new BadRequestError("points percentile must be monotone non-decreasing");
    }

    const row = await testModulesRepository.replaceNormTableForTest(tenantId, testId, {
      points,
      max_score: maxScore as number,
    });
    return toNormTableResponse(row);
  }

  /** Seed an editable, monotone linear curve (0 to 100th percentile across the score range). */
  async autoGenerateNormTable(
    tenantId: string,
    testId: string,
    maxScoreInput: unknown
  ): Promise<NormTableResponse | null> {
    await this.ensureAdaptiveTest(tenantId, testId);
    const maxScore = maxScoreInput;
    if (
      !Number.isInteger(maxScore) ||
      (maxScore as number) < 1 ||
      (maxScore as number) > MAX_SCALE_MAX
    )
      throw new BadRequestError(`max_score must be an integer between 1 and ${MAX_SCALE_MAX}`);
    const m = maxScore as number;
    const points = Array.from({ length: 11 }, (_, i) => ({
      score: Math.round((m * i) / 10),
      percentile: Math.round(1 + (i / 10) * 98),
    }));
    const row = await testModulesRepository.replaceNormTableForTest(tenantId, testId, {
      points,
      max_score: m,
    });
    return toNormTableResponse(row);
  }

  // ---------- Publish validation ----------
  /**
   * Full structural validation for publishing an adaptive test. Returns the
   * worst-case-path totals used as the test's display total_marks/duration_min.
   * Throws BadRequestError naming the offending section/module on any failure.
   */
  async validateForPublish(
    tenantId: string,
    testId: string
  ): Promise<AdaptivePublishComputation> {
    const sections = await testsRepository.findSectionsByTest(testId, tenantId);
    if (sections.length === 0)
      throw new BadRequestError("Test must have at least one section before publishing");

    const [modules, moduleQuestions, scaleRows, normTable] = await Promise.all([
      testModulesRepository.findModulesByTest(testId, tenantId),
      testModulesRepository.findQuestionsByTest(testId, tenantId),
      testModulesRepository.findScoreScalesByTest(testId, tenantId),
      testModulesRepository.findNormTableByTest(testId, tenantId),
    ]);
    if (modules.length === 0)
      throw new BadRequestError("Adaptive test has no modules; add modules to each section");

    const allQuestionIds = Array.from(new Set(moduleQuestions.map((mq) => mq.question_id)));
    if (allQuestionIds.length === 0)
      throw new BadRequestError("Adaptive test modules have no questions");
    const questions = await testQuestionsRepository.findByIds(allQuestionIds, tenantId);
    if (questions.length !== allQuestionIds.length)
      throw new BadRequestError(
        "One or more module questions do not exist or are not accessible"
      );
    const questionById = new Map(questions.map((q) => [q.id, q]));
    for (const q of questions) {
      // Descriptive questions are graded manually, no answer key required.
      if (String(q.type) === "DESCRIPTIVE") continue;
      if (q.correct_answer === null || q.correct_answer === undefined)
        throw new BadRequestError(
          `Question ${q.id} is missing a correct answer and cannot be published`
        );
    }

    const questionsByModule = new Map<string, TestModuleQuestionRow[]>();
    for (const mq of moduleQuestions) {
      const list = questionsByModule.get(mq.module_id) ?? [];
      list.push(mq);
      questionsByModule.set(mq.module_id, list);
    }
    const scalesBySection = new Map<string, TestModuleScoreScaleRow[]>();
    for (const s of scaleRows) {
      const list = scalesBySection.get(s.section_id) ?? [];
      list.push(s);
      scalesBySection.set(s.section_id, list);
    }

    const warnings: string[] = [];
    let totalMarks = 0;
    let durationMin = 0;

    for (const section of sections) {
      const label = `Section "${section.name}"`;
      const secModules = modules.filter((m) => m.section_id === section.id);
      if (secModules.length === 0)
        throw new BadRequestError(`${label} has no modules`);

      const stageNos = Array.from(
        new Set(secModules.map((m) => Number(m.stage_no)))
      ).sort((a, b) => a - b);
      if (stageNos[0] !== 1)
        throw new BadRequestError(`${label} is missing a stage 1 module`);
      for (let i = 1; i < stageNos.length; i++) {
        if (stageNos[i] !== stageNos[i - 1] + 1)
          throw new BadRequestError(
            `${label} has a gap in module stages (stage ${stageNos[i - 1] + 1} missing)`
          );
      }
      const stage1Count = secModules.filter((m) => Number(m.stage_no) === 1).length;
      if (stage1Count !== 1)
        throw new BadRequestError(`${label} must have exactly one stage 1 module`);
      const terminalStage = stageNos[stageNos.length - 1];
      if (terminalStage > 1) {
        for (const stageNo of stageNos.slice(1)) {
          const variants = secModules.filter((m) => Number(m.stage_no) === stageNo);
          if (variants.length < 2)
            warnings.push(
              `${label} stage ${stageNo} has a single variant; routing there is not adaptive`
            );
        }
      }

      // Per-module checks: pools, marks uniformity, routing rules.
      const marksByModule = new Map<string, { marks: number; negative: number }>();
      for (const m of secModules) {
        const mLabel = `${label} stage ${m.stage_no} "${m.variant}"`;
        const pool = questionsByModule.get(m.id) ?? [];
        const scoredPool = pool.filter((p) => !p.is_pretest);
        const pretestPool = pool.filter((p) => p.is_pretest);
        if (scoredPool.length < Number(m.question_count))
          throw new BadRequestError(
            `${mLabel}: pool has ${scoredPool.length} scored questions but serves ${m.question_count}`
          );
        if (pretestPool.length < Number(m.pretest_count ?? 0))
          throw new BadRequestError(
            `${mLabel}: pool has ${pretestPool.length} pretest questions but serves ${m.pretest_count}`
          );

        let uniform: { marks: number; negative: number } | null = null;
        for (const p of scoredPool) {
          const q = questionById.get(p.question_id);
          if (!q) continue;
          const marks = Number(q.marks ?? 0);
          const negative = Number(q.negative_marks ?? 0);
          if (uniform === null) {
            uniform = { marks, negative };
          } else if (uniform.marks !== marks || uniform.negative !== negative) {
            throw new BadRequestError(
              `${mLabel}: all scored pool questions must share identical marks and negative marks`
            );
          }
        }
        marksByModule.set(m.id, uniform ?? { marks: 0, negative: 0 });

        const rules = parseRoutingRules(m.routing_rules);
        const isTerminal = Number(m.stage_no) === terminalStage;
        if (isTerminal) {
          if (rules && rules.length > 0)
            throw new BadRequestError(
              `${mLabel}: terminal stage modules must not define routing rules`
            );
        } else {
          if (!rules || rules.length === 0)
            throw new BadRequestError(`${mLabel}: missing routing rules`);
          const nextVariants = new Set(
            secModules
              .filter((x) => Number(x.stage_no) === Number(m.stage_no) + 1)
              .map((x) => x.variant)
          );
          for (const rule of rules) {
            if (!nextVariants.has(rule.next_variant))
              throw new BadRequestError(
                `${mLabel}: routing rule targets unknown variant "${rule.next_variant}"`
              );
            if (rule.min_correct > Number(m.question_count))
              throw new BadRequestError(
                `${mLabel}: routing threshold ${rule.min_correct} exceeds question_count ${m.question_count}`
              );
          }
        }
      }

      // Equal-shape rule: every variant at the same stage must serve an
      // identical question_count, pretest_count, and time_limit_min. Otherwise
      // the routing path leaks (the intermission, palette, and timer would
      // differ between the easier and harder module) and cross-path comparison
      // is unfair. The SAT keeps both modules identical for exactly this reason.
      for (const stageNo of stageNos) {
        const variants = secModules.filter((m) => Number(m.stage_no) === stageNo);
        if (variants.length < 2) continue;
        const first = variants[0];
        for (const v of variants.slice(1)) {
          if (
            Number(v.question_count) !== Number(first.question_count) ||
            Number(v.pretest_count ?? 0) !== Number(first.pretest_count ?? 0) ||
            Number(v.time_limit_min) !== Number(first.time_limit_min)
          ) {
            throw new BadRequestError(
              `${label} stage ${stageNo} variants must share the same question count, pretest count, and time so the routing path stays hidden`
            );
          }
        }
      }

      const { paths, warnings: pathWarnings } = enumerateSectionPaths(secModules);
      warnings.push(...pathWarnings.map((w) => `${label}: ${w}`));

      // Scales: all-or-nothing per section against REACHABLE paths.
      const sectionScales = scalesBySection.get(section.id) ?? [];
      if (sectionScales.length > 0) {
        const reachableKeys = new Set(paths.map((p) => p.key));
        const providedKeys = new Set(sectionScales.map((s) => s.path_key));
        for (const key of reachableKeys) {
          if (!providedKeys.has(key))
            throw new BadRequestError(
              `${label}: score scale missing for path "${key}" (configure all paths or none)`
            );
        }
        for (const s of sectionScales) {
          if (!reachableKeys.has(s.path_key))
            throw new BadRequestError(
              `${label}: score scale for "${s.path_key}" does not match any reachable path`
            );
          const path = paths.find((p) => p.key === s.path_key)!;
          const totalScored = path.modules.reduce(
            (sum, m) => sum + Number(m.question_count),
            0
          );
          const parsed = parseJson(s.scale);
          if (!Array.isArray(parsed) || parsed.length !== totalScored + 1)
            throw new BadRequestError(
              `${label}: scale for path "${s.path_key}" must have ${totalScored + 1} entries (0..${totalScored} correct)`
            );
        }
      }

      // Worst-case-path totals for display fields.
      let sectionMarks = 0;
      let sectionDuration = 0;
      for (const path of paths) {
        const pathMarks = path.modules.reduce(
          (sum, m) =>
            sum + Number(m.question_count) * (marksByModule.get(m.id)?.marks ?? 0),
          0
        );
        const pathDuration = path.modules.reduce(
          (sum, m) => sum + Number(m.time_limit_min),
          0
        );
        sectionMarks = Math.max(sectionMarks, pathMarks);
        sectionDuration = Math.max(sectionDuration, pathDuration);
      }
      totalMarks += sectionMarks;
      durationMin += sectionDuration;
    }

    // Percentile uses the norm table when present; otherwise it falls back to a
    // peer comparison that is unstable for early takers. Nudge the author to add one.
    if (scaleRows.length > 0 && !normTable) {
      warnings.push(
        "Score scales are configured but no percentile norm table exists; reported percentile will fall back to peer comparison until enough attempts exist"
      );
    }

    return { totalMarks, durationMin, warnings };
  }
}

export default new TestModulesService();
