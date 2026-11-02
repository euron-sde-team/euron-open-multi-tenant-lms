import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { db } from "../db/connection";
import testSeriesCatalogRepository, {
  type TestRow,
  type TestSectionRow,
  type TestSectionQuestionRow,
  type TestQuestionRow,
  type TestModuleRow,
  type AdaptiveTestConfig,
} from "../repositories/test-series-catalog.repository";
import testAttemptsRepository, {
  type TestAttemptRow,
  type TestAttemptModuleRow,
} from "../repositories/test-attempts.repository";
import testRankPredictorService from "./test-rank-predictor.service";
import testAnalyticsService from "./test-analytics.service";
import testRewardsService from "./test-rewards.service";
import logger from "../utils/logger";
import {
  gradeAnswer,
  parseJson,
  shuffleArray,
} from "../utils/test-grading.util";
import {
  lookupPercentile,
  peerPercentile,
  type NormPoint,
} from "../utils/test-percentile.util";
import type { AttemptStateResponse, StartAttemptInput } from "./test-attempt.service";
import type { test_attempt_status } from "../db/enums";

export interface RoutingRule {
  min_correct: number;
  next_variant: string;
}

export interface AdaptiveAttemptInfo {
  attemptModuleId: string | null;
  moduleOrdinal: number;
  totalModules: number;
  sectionName: string | null;
  moduleNumberInSection: number | null;
  moduleStartedAt: string | null;
  moduleDeadline: string | null;
  completedModules: Array<{
    attemptModuleId: string;
    sectionName: string;
    moduleNumberInSection: number;
    questionCount: number;
    answeredCount: number;
  }>;
}

export interface AdaptiveSubmitResult {
  attemptId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  percentile: number | null;
  rank: number | null;
  scaledScore: number | null;
  scaledScoreMax: number | null;
}

export type ModuleSubmitOutcome =
  | { outcome: "NEXT_MODULE"; state: AttemptStateResponse }
  | { outcome: "ON_BREAK"; state: AttemptStateResponse }
  | { outcome: "COMPLETED"; result: AdaptiveSubmitResult };

interface AdaptiveContext {
  tenantId: string;
  test: TestRow;
  sections: TestSectionRow[];
  config: AdaptiveTestConfig;
  questionById: Map<string, TestQuestionRow>;
  moduleById: Map<string, TestModuleRow>;
  modulesBySection: Map<string, TestModuleRow[]>;
  sectionById: Map<string, TestSectionRow>;
  /** Expected modules in a complete attempt = one per stage per section. */
  totalModules: number;
}

type AdvanceStatus =
  | "ADVANCED"
  | "NO_MORE_MODULES"
  | "LOST_RACE"
  | "ON_BREAK";

function parseRoutingRules(value: unknown): RoutingRule[] | null {
  const parsed = parseJson(value);
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

function parseNormPoints(
  row: { points: unknown } | null | undefined
): NormPoint[] | null {
  if (!row) return null;
  const parsed = parseJson(row.points);
  if (!Array.isArray(parsed)) return null;
  const points = parsed
    .map((p) => {
      const obj = (p ?? {}) as { score?: unknown; percentile?: unknown };
      return { score: Number(obj.score ?? 0), percentile: Number(obj.percentile ?? 0) };
    })
    .filter((p) => Number.isFinite(p.score) && Number.isFinite(p.percentile));
  return points.length > 0 ? points : null;
}

function toMs(value: unknown): number {
  if (!value) return 0;
  return (value instanceof Date ? value : new Date(value as string)).getTime();
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return (value instanceof Date ? value : new Date(value as string)).toISOString();
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Grace (seconds) added to the next module's start on an EXPLICIT submit.
 * Bluebook parity: 0, the player moves straight into the next module (no
 * interstitial), so its clock starts the moment it is served and a 32-min
 * module reads exactly 32:00. Any positive value shows up to the student as
 * extra time (the "32:05" bug). The auto-expiry cascade ignores this either
 * way (clock continuity).
 */
const INTERMISSION_GRACE_SEC = 0;

class TestAdaptiveAttemptService {
  // ---------------------------------------------------------------- context

  async loadContext(
    tenantId: string,
    testId: string,
    prefetched?: { test: TestRow; sections: TestSectionRow[] }
  ): Promise<AdaptiveContext> {
    let test = prefetched?.test;
    let sections = prefetched?.sections;
    if (!test || !sections) {
      const tree = await testSeriesCatalogRepository.getTestForAttempt(tenantId, testId);
      if (!tree) throw new NotFoundError("Test not found");
      test = tree.test;
      sections = tree.sections;
    }
    const config = await testSeriesCatalogRepository.getAdaptiveConfigForTest(
      tenantId,
      testId
    );

    const modulesBySection = new Map<string, TestModuleRow[]>();
    for (const m of config.modules) {
      const list = modulesBySection.get(m.section_id) ?? [];
      list.push(m);
      modulesBySection.set(m.section_id, list);
    }
    let totalModules = 0;
    for (const list of modulesBySection.values()) {
      totalModules += Math.max(0, ...list.map((m) => Number(m.stage_no)));
    }

    return {
      tenantId,
      test,
      sections: [...sections].sort(
        (a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0)
      ),
      config,
      questionById: new Map(config.questions.map((q) => [q.id, q])),
      moduleById: new Map(config.modules.map((m) => [m.id, m])),
      modulesBySection,
      sectionById: new Map(sections.map((s) => [s.id, s])),
      totalModules,
    };
  }

  // ---------------------------------------------------------------- routing

  /**
   * THE routing decision: which next-stage module does a learner get after
   * completing a module with `rawCorrect` scored answers?
   *
   * Contract:
   * - `rules` come from authoring already sorted by min_correct DESCENDING;
   *   the first rule whose min_correct the learner meets (rawCorrect >=
   *   min_correct) names the winning variant.
   * - A rule may name a variant that no longer exists in `nextStageModules`
   *   (admin edited post-publish): treat it as no match.
   * - When NO rule matches (or the named variant is missing), fall back to
   *   the EASIEST candidate: the module with the lowest difficulty_rank.
   * - `nextStageModules` is never empty when this is called.
   */
  private resolveNextVariant(
    rawCorrect: number,
    rules: RoutingRule[],
    nextStageModules: TestModuleRow[]
  ): TestModuleRow {
    const byVariant = new Map(nextStageModules.map((m) => [m.variant, m]));
    const sorted = [...rules].sort((a, b) => b.min_correct - a.min_correct);
    for (const rule of sorted) {
      if (rawCorrect < rule.min_correct) continue;
      const target = byVariant.get(rule.next_variant);
      if (target) return target;
      logger.warn(
        `[test-adaptive] routing rule targets missing variant "${rule.next_variant}"; trying next rule`
      );
    }
    return [...nextStageModules].sort(
      (a, b) => Number(a.difficulty_rank ?? 0) - Number(b.difficulty_rank ?? 0)
    )[0];
  }

  // ---------------------------------------------------------------- sampling

  /**
   * Deterministic frozen sample for a module. Seed = attemptId + moduleId so
   * resume always reproduces the same set while a new attempt gets a fresh
   * draw. Pool == count degenerates to a fixed form.
   */
  private sampleForModule(
    attemptId: string,
    module: TestModuleRow,
    config: AdaptiveTestConfig,
    shuffleQuestions: boolean
  ): { scored: string[]; pretest: string[] } {
    // Only sample questions that STILL EXIST. A module's question pool can
    // reference questions that were later deleted (e.g. a question-bank
    // re-seed), and serving those dead ids yields a blank/unanswerable module
    // ("No questions in this section" / "not part of the active module"). The
    // live set == the questions the config could actually load.
    const liveIds = new Set(config.questions.map((q) => q.id));
    const pool = config.moduleQuestions.filter(
      (mq) => mq.module_id === module.id && liveIds.has(mq.question_id)
    );
    const scoredPool = pool.filter((p) => !p.is_pretest).map((p) => p.question_id);
    const pretestPool = pool.filter((p) => p.is_pretest).map((p) => p.question_id);
    // Defensive: a missing/zero question_count must NOT silently serve an empty
    // module, fall back to the whole scored pool.
    const rawWant = Number(module.question_count);
    const wantScored =
      Number.isFinite(rawWant) && rawWant > 0 ? rawWant : scoredPool.length;
    const wantPretest = Number(module.pretest_count ?? 0);
    if (scoredPool.length < wantScored) {
      logger.warn(
        `[test-adaptive] module ${module.id} pool has ${scoredPool.length} scored questions, serving fewer than configured ${wantScored}`
      );
    }
    // When the test opts into shuffling, draw a frozen random sample per
    // attempt. Otherwise honour the admin-defined order_index sequence (fixed
    // form), `config.moduleQuestions` is already sorted by order_index, so a
    // section can follow standard ordering (e.g. SAT: Words-in-Context first).
    const scored = (
      shuffleQuestions
        ? shuffleArray(scoredPool, attemptId + module.id)
        : scoredPool
    ).slice(0, Math.min(wantScored, scoredPool.length));
    const pretest =
      wantPretest > 0
        ? (shuffleQuestions
            ? shuffleArray(pretestPool, attemptId + module.id + ":pre")
            : pretestPool
          ).slice(0, Math.min(wantPretest, pretestPool.length))
        : [];
    return { scored, pretest };
  }

  /** Display order merges scored + pretest with no marker the client can sniff. */
  private servedIds(attemptId: string, row: TestAttemptModuleRow): string[] {
    const scored = strArray(row.question_ids);
    const pretest = strArray(row.pretest_ids);
    if (pretest.length === 0) return scored;
    return shuffleArray([...scored, ...pretest], attemptId + row.module_id + ":serve");
  }

  // ---------------------------------------------------------------- creation

  async createAttempt(
    tenantId: string,
    memberId: string,
    input: StartAttemptInput,
    prefetched: { test: TestRow; sections: TestSectionRow[] }
  ): Promise<TestAttemptRow> {
    const ctx = await this.loadContext(tenantId, input.testId, prefetched);
    if (ctx.config.modules.length === 0) {
      throw new BadRequestError("This adaptive test has no modules configured");
    }

    // Stage-1 rows are created for every section up front (frozen samples);
    // later stages are created only when routing decides them.
    const sectionPlans: Array<{
      section: TestSectionRow;
      stage1: TestModuleRow;
      baseOrder: number;
    }> = [];
    let runningOrder = 0;
    for (const section of ctx.sections) {
      const mods = ctx.modulesBySection.get(section.id) ?? [];
      if (mods.length === 0) continue;
      const stage1 = mods.find((m) => Number(m.stage_no) === 1);
      if (!stage1) {
        throw new BadRequestError(
          `Section "${section.name}" is missing its stage 1 module`
        );
      }
      sectionPlans.push({ section, stage1, baseOrder: runningOrder });
      runningOrder += Math.max(0, ...mods.map((m) => Number(m.stage_no)));
    }
    if (sectionPlans.length === 0) {
      throw new BadRequestError("This adaptive test has no modules configured");
    }

    const totalSec = Number(ctx.test.duration_min ?? 0) * 60;
    const now = new Date();

    return db.transaction().execute(async (trx) => {
      const attempt = await testAttemptsRepository.create(
        {
          tenant_id: tenantId,
          learner_id: memberId,
          test_id: input.testId,
          test_series_id: input.seriesId,
          time_remaining_sec: totalSec,
          question_ids: [],
        },
        trx
      );

      for (let i = 0; i < sectionPlans.length; i++) {
        const plan = sectionPlans[i];
        const sample = this.sampleForModule(
          attempt.id,
          plan.stage1,
          ctx.config,
          Boolean(ctx.test.shuffle_questions)
        );
        const isFirst = i === 0;
        await testAttemptsRepository.createAttemptModule(
          {
            tenant_id: tenantId,
            attempt_id: attempt.id,
            module_id: plan.stage1.id,
            section_id: plan.section.id,
            stage_no: Number(plan.stage1.stage_no),
            variant: plan.stage1.variant,
            order_index: plan.baseOrder,
            status: isFirst ? "IN_PROGRESS" : "PENDING",
            question_ids: sample.scored,
            pretest_ids: sample.pretest,
            time_limit_sec: Number(plan.stage1.time_limit_min) * 60,
            started_at: isFirst ? now : null,
          },
          trx
        );
        if (isFirst) {
          await testAttemptsRepository.appendQuestionIds(
            attempt.id,
            tenantId,
            [...sample.scored, ...sample.pretest],
            trx
          );
        }
      }
      return attempt;
    });
  }

  // ---------------------------------------------------------------- advance

  /**
   * Grade the current module, route, and atomically activate the successor.
   * `activationTime` carries clock continuity on expiry cascades (successor
   * starts at the predecessor's deadline, not "now").
   */
  private async advanceFromModule(
    ctx: AdaptiveContext,
    attempt: TestAttemptRow,
    current: TestAttemptModuleRow,
    opts: { auto: boolean; activationTime: Date }
  ): Promise<AdvanceStatus> {
    const tenantId = ctx.tenantId;
    const answers = await testAttemptsRepository.findAnswers(attempt.id, tenantId);
    const answersByQ = new Map(answers.map((a) => [a.question_id, a]));

    let rawCorrect = 0;
    let rawScore = 0;
    const gradeOps: Array<{ answerId: string; isCorrect: boolean; marksAwarded: number }> =
      [];

    for (const qid of strArray(current.question_ids)) {
      const a = answersByQ.get(qid);
      if (!a) continue;
      const q = ctx.questionById.get(qid);
      if (!q) continue;
      const r = gradeAnswer(
        String(q.type),
        q.correct_answer,
        parseJson(a.answer),
        Number(q.marks ?? 0),
        Number(q.negative_marks ?? 0)
      );
      gradeOps.push({ answerId: a.id, isCorrect: r.isCorrect, marksAwarded: r.marksAwarded });
      if (r.isCorrect) rawCorrect += 1;
      rawScore += r.marksAwarded;
    }
    // Pretest answers are graded for item statistics but excluded from
    // raw_correct/raw_score, routing and scaled scoring.
    for (const qid of strArray(current.pretest_ids)) {
      const a = answersByQ.get(qid);
      if (!a) continue;
      const q = ctx.questionById.get(qid);
      if (!q) continue;
      const r = gradeAnswer(
        String(q.type),
        q.correct_answer,
        parseJson(a.answer),
        Number(q.marks ?? 0),
        Number(q.negative_marks ?? 0)
      );
      gradeOps.push({ answerId: a.id, isCorrect: r.isCorrect, marksAwarded: 0 });
    }

    // Routing decision happens outside the transaction (pure computation).
    const authModule = ctx.moduleById.get(current.module_id);
    const rules = authModule ? parseRoutingRules(authModule.routing_rules) : null;
    let nextAuthModule: TestModuleRow | null = null;
    if (rules && rules.length > 0) {
      const nextStageModules = (ctx.modulesBySection.get(current.section_id) ?? []).filter(
        (m) => Number(m.stage_no) === Number(current.stage_no) + 1
      );
      if (nextStageModules.length > 0) {
        nextAuthModule = this.resolveNextVariant(rawCorrect, rules, nextStageModules);
      } else {
        logger.warn(
          `[test-adaptive] module ${current.module_id} has routing rules but no next-stage modules`
        );
      }
    }
    // Pre-sample the routed module. If it has NO live questions (its pool was
    // emptied by a question delete/re-seed), fall back to any sibling variant
    // that still has questions; if none do, drop stage-2 entirely so the
    // section simply ends at this stage rather than serving a blank module.
    let nextSample: { scored: string[]; pretest: string[] } | null = null;
    if (nextAuthModule) {
      nextSample = this.sampleForModule(
        attempt.id,
        nextAuthModule,
        ctx.config,
        Boolean(ctx.test.shuffle_questions)
      );
      if (nextSample.scored.length === 0) {
        const siblings = (ctx.modulesBySection.get(current.section_id) ?? []).filter(
          (m) =>
            Number(m.stage_no) === Number(current.stage_no) + 1 &&
            m.id !== nextAuthModule!.id
        );
        let recovered = false;
        for (const cand of siblings) {
          const s = this.sampleForModule(
            attempt.id,
            cand,
            ctx.config,
            Boolean(ctx.test.shuffle_questions)
          );
          if (s.scored.length > 0) {
            logger.warn(
              `[test-adaptive] routed variant "${nextAuthModule.variant}" had no live questions; falling back to "${cand.variant}"`
            );
            nextAuthModule = cand;
            nextSample = s;
            recovered = true;
            break;
          }
        }
        if (!recovered) {
          logger.error(
            `[test-adaptive] no next-stage module in section ${current.section_id} has live questions; ending section after stage ${current.stage_no}`
          );
          nextAuthModule = null;
          nextSample = null;
        }
      }
    }
    const routedVariant = nextAuthModule?.variant ?? null;

    return db.transaction().execute(async (trx): Promise<AdvanceStatus> => {
      const completed = await testAttemptsRepository.completeModule(
        current.id,
        tenantId,
        {
          completed_at: opts.activationTime,
          raw_correct: rawCorrect,
          raw_score: rawScore,
          routed_to_variant: routedVariant,
          auto_completed: opts.auto,
        },
        trx
      );
      if (!completed) return "LOST_RACE";

      for (const op of gradeOps) {
        await testAttemptsRepository.updateAnswerCorrectness(
          op.answerId,
          tenantId,
          op.isCorrect,
          op.marksAwarded,
          trx
        );
      }

      // On an explicit submit, push the next module's clock forward by a short
      // grace so the intermission/transition is not billed to it. On the
      // auto-expiry cascade the successor must start at the predecessor deadline
      // (no grace) to keep the clock continuous across disconnects.
      const nextStartedAt = opts.auto
        ? opts.activationTime
        : new Date(opts.activationTime.getTime() + INTERMISSION_GRACE_SEC * 1000);

      if (nextAuthModule && nextSample) {
        const sample = nextSample;
        await testAttemptsRepository.createAttemptModule(
          {
            tenant_id: tenantId,
            attempt_id: attempt.id,
            module_id: nextAuthModule.id,
            section_id: nextAuthModule.section_id,
            stage_no: Number(nextAuthModule.stage_no),
            variant: nextAuthModule.variant,
            order_index: Number(current.order_index) + 1,
            status: "IN_PROGRESS",
            question_ids: sample.scored,
            pretest_ids: sample.pretest,
            time_limit_sec: Number(nextAuthModule.time_limit_min) * 60,
            started_at: nextStartedAt,
          },
          trx
        );
        await testAttemptsRepository.appendQuestionIds(
          attempt.id,
          tenantId,
          [...sample.scored, ...sample.pretest],
          trx
        );
        return "ADVANCED";
      }

      // Terminal module of this section: activate the next section's stage 1.
      const all = await testAttemptsRepository.findModules(attempt.id, tenantId, trx);
      const pending = all
        .filter((m) => String(m.status) === "PENDING")
        .sort((a, b) => Number(a.order_index) - Number(b.order_index))[0];
      if (pending) {
        // Inter-section break: if THIS section is configured with a break and
        // the learner finished it normally (not an expiry cascade), pause here
        // instead of starting the next section. The next module stays PENDING;
        // a resume (early click or break-timer expiry) activates it.
        const breakSec = Number(
          ctx.sectionById.get(current.section_id)?.break_after_sec ?? 0
        );
        if (!opts.auto && breakSec > 0) {
          await testAttemptsRepository.enterBreak(
            attempt.id,
            tenantId,
            new Date(opts.activationTime.getTime() + breakSec * 1000),
            trx
          );
          return "ON_BREAK";
        }
        const activated = await testAttemptsRepository.activateModule(
          pending.id,
          tenantId,
          nextStartedAt,
          trx
        );
        if (activated) {
          await testAttemptsRepository.appendQuestionIds(
            attempt.id,
            tenantId,
            [...strArray(activated.question_ids), ...strArray(activated.pretest_ids)],
            trx
          );
          return "ADVANCED";
        }
      }
      return "NO_MORE_MODULES";
    });
  }

  /**
   * Activate the next (PENDING) section module and clear the break. The new
   * module's clock starts at `resumeAt`, an early resume passes "now"; the
   * break-timer auto-resume passes the break-end instant for clock continuity.
   * Returns false if there was nothing to resume.
   */
  private async resumeBreakInternal(
    ctx: AdaptiveContext,
    attemptId: string,
    resumeAt: Date
  ): Promise<boolean> {
    const tenantId = ctx.tenantId;
    return db.transaction().execute(async (trx) => {
      const all = await testAttemptsRepository.findModules(attemptId, tenantId, trx);
      const pending = all
        .filter((m) => String(m.status) === "PENDING")
        .sort((a, b) => Number(a.order_index) - Number(b.order_index))[0];
      if (!pending) {
        // No next section to start, just clear the break.
        return testAttemptsRepository.clearBreak(attemptId, tenantId, trx);
      }
      const activated = await testAttemptsRepository.activateModule(
        pending.id,
        tenantId,
        resumeAt,
        trx
      );
      if (!activated) return false;
      await testAttemptsRepository.appendQuestionIds(
        attemptId,
        tenantId,
        [...strArray(activated.question_ids), ...strArray(activated.pretest_ids)],
        trx
      );
      return testAttemptsRepository.clearBreak(attemptId, tenantId, trx);
    });
  }

  /**
   * Resume early from an inter-section break (learner clicked "Resume now").
   * No-op if the attempt is not on a break. Returns the fresh attempt state.
   */
  async resumeBreak(
    tenantId: string,
    memberId: string,
    attempt: TestAttemptRow
  ): Promise<AttemptStateResponse> {
    void memberId; // ownership verified by caller
    const ctx = await this.loadContext(tenantId, attempt.test_id);
    if (String(attempt.status) === "ON_BREAK") {
      await this.resumeBreakInternal(ctx, attempt.id, new Date());
    }
    const refreshed =
      (await testAttemptsRepository.findById(attempt.id, tenantId)) ?? attempt;
    const reconciled = await this.reconcile(ctx, refreshed);
    return this.stateFromModules(ctx, reconciled.attempt, reconciled.modules);
  }

  // ---------------------------------------------------------------- reconcile

  /**
   * Server-authoritative clock enforcement. Walks expired modules in order:
   * each is graded + completed (auto) and its successor starts at the
   * predecessor's DEADLINE, not "now", disconnection never pauses the exam.
   * Finalizes the attempt as AUTO_SUBMITTED when everything has expired.
   */
  async reconcile(
    ctx: AdaptiveContext,
    attempt: TestAttemptRow
  ): Promise<{ attempt: TestAttemptRow; modules: TestAttemptModuleRow[] }> {
    let guard = 0;
    let liveAttempt = attempt;
    for (;;) {
      if (String(liveAttempt.status) === "ON_BREAK") {
        const endsMs = toMs(liveAttempt.break_ends_at);
        if (liveAttempt.break_ends_at && Date.now() >= endsMs) {
          // Break timer elapsed, auto-resume the next section. Its clock starts
          // at the break-end instant (not "now"), so a learner who reconnects
          // late doesn't get bonus time, same no-pause model as expiry.
          await this.resumeBreakInternal(ctx, liveAttempt.id, new Date(endsMs));
          liveAttempt =
            (await testAttemptsRepository.findById(liveAttempt.id, ctx.tenantId)) ??
            liveAttempt;
          continue;
        }
        const modules = await testAttemptsRepository.findModules(
          liveAttempt.id,
          ctx.tenantId
        );
        return { attempt: liveAttempt, modules };
      }
      if (String(liveAttempt.status) !== "IN_PROGRESS") {
        const modules = await testAttemptsRepository.findModules(
          liveAttempt.id,
          ctx.tenantId
        );
        return { attempt: liveAttempt, modules };
      }
      const modules = await testAttemptsRepository.findModules(
        liveAttempt.id,
        ctx.tenantId
      );
      const current = modules.find((m) => String(m.status) === "IN_PROGRESS");
      if (!current) {
        if (
          modules.length > 0 &&
          modules.every((m) => String(m.status) === "COMPLETED")
        ) {
          // Crash window: last module completed but the attempt was never
          // finalized. Finish the job now.
          await this.finalizeAttempt(ctx, liveAttempt, { autoSubmit: true });
          liveAttempt =
            (await testAttemptsRepository.findById(liveAttempt.id, ctx.tenantId)) ??
            liveAttempt;
        }
        return { attempt: liveAttempt, modules };
      }

      const deadlineMs = toMs(current.started_at) + Number(current.time_limit_sec) * 1000;
      if (Date.now() < deadlineMs) {
        return { attempt: liveAttempt, modules };
      }

      if (++guard > 50) {
        logger.error(`[test-adaptive] reconcile guard tripped for attempt ${attempt.id}`);
        return { attempt: liveAttempt, modules };
      }

      const status = await this.advanceFromModule(ctx, liveAttempt, current, {
        auto: true,
        activationTime: new Date(deadlineMs),
      });
      if (status === "NO_MORE_MODULES") {
        await this.finalizeAttempt(ctx, liveAttempt, { autoSubmit: true });
        liveAttempt =
          (await testAttemptsRepository.findById(liveAttempt.id, ctx.tenantId)) ??
          liveAttempt;
      }
      // ADVANCED and LOST_RACE both loop: re-read and re-evaluate deadlines.
    }
  }

  // ---------------------------------------------------------------- state

  async buildState(
    tenantId: string,
    attempt: TestAttemptRow,
    prefetched: { test: TestRow; sections: TestSectionRow[] }
  ): Promise<AttemptStateResponse> {
    const ctx = await this.loadContext(tenantId, attempt.test_id, prefetched);
    const reconciled = await this.reconcile(ctx, attempt);
    return this.stateFromModules(ctx, reconciled.attempt, reconciled.modules);
  }

  private async stateFromModules(
    ctx: AdaptiveContext,
    attempt: TestAttemptRow,
    modules: TestAttemptModuleRow[]
  ): Promise<AttemptStateResponse> {
    let current =
      String(attempt.status) === "IN_PROGRESS"
        ? modules.find((m) => String(m.status) === "IN_PROGRESS") ?? null
        : null;
    const completedRows = modules
      .filter((m) => String(m.status) === "COMPLETED")
      .sort((a, b) => Number(a.order_index) - Number(b.order_index));

    const answerRows = await testAttemptsRepository.findAnswers(
      attempt.id,
      ctx.tenantId
    );
    const answeredIds = new Set(
      answerRows
        .filter((a) => a.answer !== null && a.answer !== undefined)
        .map((a) => a.question_id)
    );

    const completedModules = completedRows.map((m) => {
      const served = [...strArray(m.question_ids), ...strArray(m.pretest_ids)];
      return {
        attemptModuleId: m.id,
        sectionName: ctx.sectionById.get(m.section_id)?.name ?? "Section",
        moduleNumberInSection: Number(m.stage_no),
        questionCount: served.length,
        answeredCount: served.filter((qid) => answeredIds.has(qid)).length,
      };
    });

    const adaptive: AdaptiveAttemptInfo = {
      attemptModuleId: current?.id ?? null,
      moduleOrdinal: completedRows.length + (current ? 1 : 0),
      totalModules: ctx.totalModules,
      sectionName: current
        ? ctx.sectionById.get(current.section_id)?.name ?? "Section"
        : null,
      moduleNumberInSection: current ? Number(current.stage_no) : null,
      moduleStartedAt: current ? toIso(current.started_at) : null,
      moduleDeadline: current
        ? new Date(
            toMs(current.started_at) + Number(current.time_limit_sec) * 1000
          ).toISOString()
        : null,
      completedModules,
    };

    // Envelope is scoped to the CURRENT module: sections has one entry whose
    // questionIds are the frozen served order; questions/answers are limited
    // to those ids. Later-stage questions never reach the wire.
    let sections: AttemptStateResponse["sections"] = [];
    let questionsPayload: AttemptStateResponse["questions"] = [];
    const answers: AttemptStateResponse["answers"] = {};
    let timeRemainingSec = 0;
    let totalDurationSec = 0;

    if (current) {
      // Self-heal: if the active module has no LIVE served questions, either it
      // was created without a sample, or every served id points at a question
      // that has since been deleted (bank re-seed), re-sample now from the
      // live pool and persist so the learner is never shown an empty section.
      const liveServedNow = [
        ...strArray(current.question_ids),
        ...strArray(current.pretest_ids),
      ].filter((qid) => ctx.questionById.has(qid));
      if (liveServedNow.length === 0) {
        const auth = ctx.moduleById.get(current.module_id);
        if (auth) {
          const resample = this.sampleForModule(
            attempt.id,
            auth,
            ctx.config,
            Boolean(ctx.test.shuffle_questions)
          );
          if (resample.scored.length > 0 || resample.pretest.length > 0) {
            await testAttemptsRepository.setModuleQuestionIds(
              current.id,
              ctx.tenantId,
              resample.scored,
              resample.pretest
            );
            await testAttemptsRepository.appendQuestionIds(attempt.id, ctx.tenantId, [
              ...resample.scored,
              ...resample.pretest,
            ]);
            current = {
              ...current,
              question_ids: resample.scored,
              pretest_ids: resample.pretest,
            } as unknown as TestAttemptModuleRow;
          }
        }
      }
      const served = this.servedIds(attempt.id, current);
      const servedSet = new Set(served);
      const section = ctx.sectionById.get(current.section_id);
      totalDurationSec = Number(current.time_limit_sec);
      timeRemainingSec = Math.max(
        0,
        Math.floor(
          (toMs(current.started_at) +
            Number(current.time_limit_sec) * 1000 -
            Date.now()) /
            1000
        )
      );
      sections = [
        {
          id: current.section_id,
          name: section?.name ?? "Section",
          instructions: section?.instructions ?? null,
          timeLimitMin: Math.round(Number(current.time_limit_sec) / 60),
          orderIndex: Number(section?.order_index ?? 0),
          questionIds: served,
        },
      ];
      questionsPayload = served
        .map((qid) => ctx.questionById.get(qid))
        .filter((q): q is TestQuestionRow => Boolean(q))
        .map((q) => {
          let options = parseJson(q.options);
          if (ctx.test.shuffle_options && Array.isArray(options)) {
            options = shuffleArray(options as unknown[], attempt.id + q.id);
          }
          return {
            id: q.id,
            type: String(q.type),
            stem: parseJson(q.stem),
            options,
            marks: String(q.marks),
            negativeMarks: String(q.negative_marks),
          };
        });
      for (const a of answerRows) {
        if (!servedSet.has(a.question_id)) continue;
        answers[a.question_id] = {
          answer: parseJson(a.answer),
          markedForReview: Boolean(a.marked_for_review),
        };
      }
    }

    // On an inter-section break the timer counts down to the break end.
    const onBreak = String(attempt.status) === "ON_BREAK";
    const breakEndsAt = onBreak ? toIso(attempt.break_ends_at) : null;
    if (onBreak && attempt.break_ends_at) {
      timeRemainingSec = Math.max(
        0,
        Math.floor((toMs(attempt.break_ends_at) - Date.now()) / 1000)
      );
    }

    const startedAtMs = toMs(attempt.started_at);
    return {
      attemptId: attempt.id,
      status: String(attempt.status),
      testId: attempt.test_id,
      seriesId: attempt.test_series_id,
      startedAt: new Date(startedAtMs).toISOString(),
      submittedAt: toIso(attempt.submitted_at),
      timeRemainingSec,
      totalDurationSec,
      breakEndsAt,
      mode: "ADAPTIVE",
      test: {
        id: ctx.test.id,
        name: ctx.test.name,
        description: ctx.test.description,
        durationMin: Number(ctx.test.duration_min ?? 0),
        totalMarks: String(ctx.test.total_marks ?? 0),
        showSolutions: String(ctx.test.show_solutions),
        shuffleQuestions: Boolean(ctx.test.shuffle_questions),
        shuffleOptions: Boolean(ctx.test.shuffle_options),
        proctoringEnabled: Boolean(ctx.test.proctoring_enabled),
        proctorCamera: Boolean(ctx.test.proctor_camera),
        proctorMaxTabSwitches:
          ctx.test.proctor_max_tab_switches === null ||
          ctx.test.proctor_max_tab_switches === undefined
            ? null
            : Number(ctx.test.proctor_max_tab_switches),
        proctorMic: Boolean(ctx.test.proctor_mic),
        proctorFullscreen: Boolean(ctx.test.proctor_fullscreen),
        proctorBlockCopyPaste: Boolean(ctx.test.proctor_block_copy_paste),
        proctorAction: String(ctx.test.proctor_action ?? "WARN"),
        calculatorMode: String(ctx.test.calculator_mode ?? "NONE"),
      },
      sections,
      questions: questionsPayload,
      answers,
      adaptive,
    };
  }

  // ---------------------------------------------------------------- guards

  /**
   * Autosave guard. Fast path avoids loading the full adaptive config: when
   * the current module is live and owns the question, accept immediately.
   * Slow path (deadline passed) loads context, reconciles, then re-checks.
   */
  async guardPatch(
    tenantId: string,
    attempt: TestAttemptRow,
    modules: TestAttemptModuleRow[],
    questionId: string
  ): Promise<void> {
    const current = modules.find((m) => String(m.status) === "IN_PROGRESS");
    if (current) {
      const deadlineMs =
        toMs(current.started_at) + Number(current.time_limit_sec) * 1000;
      if (Date.now() < deadlineMs) {
        const served = new Set([
          ...strArray(current.question_ids),
          ...strArray(current.pretest_ids),
        ]);
        if (!served.has(questionId)) {
          throw new BadRequestError("Question is not part of the active module");
        }
        return;
      }
    }
    // Deadline passed (or no live module): reconcile, then re-validate.
    const ctx = await this.loadContext(tenantId, attempt.test_id);
    const reconciled = await this.reconcile(ctx, attempt);
    if (String(reconciled.attempt.status) !== "IN_PROGRESS") {
      throw new BadRequestError("This attempt is no longer in progress");
    }
    const live = reconciled.modules.find((m) => String(m.status) === "IN_PROGRESS");
    if (!live) throw new BadRequestError("This attempt is no longer in progress");
    const served = new Set([
      ...strArray(live.question_ids),
      ...strArray(live.pretest_ids),
    ]);
    if (!served.has(questionId)) {
      throw new BadRequestError("Question is not part of the active module");
    }
  }

  // ---------------------------------------------------------------- submit

  async submitModule(
    tenantId: string,
    memberId: string,
    attempt: TestAttemptRow,
    attemptModuleId: string
  ): Promise<ModuleSubmitOutcome> {
    void memberId; // ownership verified by caller
    const ctx = await this.loadContext(tenantId, attempt.test_id);
    let { attempt: liveAttempt, modules } = await this.reconcile(ctx, attempt);

    const target = modules.find((m) => m.id === attemptModuleId);
    if (!target) throw new NotFoundError("Attempt module not found");

    if (String(liveAttempt.status) !== "IN_PROGRESS") {
      return {
        outcome: "COMPLETED",
        result: await this.resultSummary(ctx, liveAttempt, modules),
      };
    }

    if (String(target.status) === "COMPLETED") {
      // Idempotent: double-click / second tab. Return the current state.
      return {
        outcome: "NEXT_MODULE",
        state: await this.stateFromModules(ctx, liveAttempt, modules),
      };
    }
    if (String(target.status) !== "IN_PROGRESS") {
      throw new BadRequestError("This module is not active yet");
    }

    const status = await this.advanceFromModule(ctx, liveAttempt, target, {
      auto: false,
      activationTime: new Date(),
    });

    if (status === "NO_MORE_MODULES") {
      const result = await this.finalizeAttempt(ctx, liveAttempt, { autoSubmit: false });
      return { outcome: "COMPLETED", result };
    }

    if (status === "ON_BREAK") {
      // Section finished; the learner is now on an inter-section break. The
      // next section stays PENDING until resume (early click or timer expiry).
      liveAttempt =
        (await testAttemptsRepository.findById(liveAttempt.id, tenantId)) ?? liveAttempt;
      modules = await testAttemptsRepository.findModules(liveAttempt.id, tenantId);
      return {
        outcome: "ON_BREAK",
        state: await this.stateFromModules(ctx, liveAttempt, modules),
      };
    }

    // ADVANCED or LOST_RACE: re-read and respond with the live state.
    liveAttempt =
      (await testAttemptsRepository.findById(liveAttempt.id, tenantId)) ?? liveAttempt;
    modules = await testAttemptsRepository.findModules(liveAttempt.id, tenantId);
    if (String(liveAttempt.status) !== "IN_PROGRESS") {
      return {
        outcome: "COMPLETED",
        result: await this.resultSummary(ctx, liveAttempt, modules),
      };
    }
    return {
      outcome: "NEXT_MODULE",
      state: await this.stateFromModules(ctx, liveAttempt, modules),
    };
  }

  /** "End test early": grade + complete every remaining module, then finalize. */
  async endTestEarly(
    tenantId: string,
    memberId: string,
    attempt: TestAttemptRow,
    options: { autoSubmit?: boolean } = {}
  ): Promise<AdaptiveSubmitResult> {
    void memberId;
    const ctx = await this.loadContext(tenantId, attempt.test_id);
    const reconciled = await this.reconcile(ctx, attempt);
    const liveAttempt = reconciled.attempt;
    let modules = reconciled.modules;
    if (String(liveAttempt.status) !== "IN_PROGRESS") {
      return this.resultSummary(ctx, liveAttempt, modules);
    }

    let guard = 0;
    for (;;) {
      if (++guard > 50) {
        logger.error(`[test-adaptive] endTestEarly guard tripped for ${attempt.id}`);
        break;
      }
      modules = await testAttemptsRepository.findModules(liveAttempt.id, tenantId);
      const current = modules.find((m) => String(m.status) === "IN_PROGRESS");
      if (!current) break;
      const status = await this.advanceFromModule(ctx, liveAttempt, current, {
        auto: false,
        activationTime: new Date(),
      });
      if (status === "NO_MORE_MODULES") break;
    }

    return this.finalizeAttempt(ctx, liveAttempt, {
      autoSubmit: Boolean(options.autoSubmit),
    });
  }

  // ---------------------------------------------------------------- scoring

  private async resultSummary(
    ctx: AdaptiveContext,
    attempt: TestAttemptRow,
    modules: TestAttemptModuleRow[]
  ): Promise<AdaptiveSubmitResult> {
    return {
      attemptId: attempt.id,
      score: Number(attempt.score ?? 0),
      totalMarks: this.totalMarksForModules(ctx, modules),
      percentage: Number(attempt.percentage ?? 0),
      percentile:
        attempt.percentile === null || attempt.percentile === undefined
          ? null
          : Number(attempt.percentile),
      rank: attempt.rank,
      scaledScore:
        attempt.scaled_score === null || attempt.scaled_score === undefined
          ? null
          : Number(attempt.scaled_score),
      scaledScoreMax: attempt.scaled_score_max ?? null,
    };
  }

  private totalMarksForModules(
    ctx: AdaptiveContext,
    modules: TestAttemptModuleRow[]
  ): number {
    let total = 0;
    for (const m of modules) {
      for (const qid of strArray(m.question_ids)) {
        total += Number(ctx.questionById.get(qid)?.marks ?? 0);
      }
    }
    return total;
  }

  /** Path key = variants taken at stages >= 2, joined '>' ("HARDER", "MEDIUM>HARD"). */
  private pathKeyForSection(modules: TestAttemptModuleRow[]): string {
    return modules
      .filter((m) => Number(m.stage_no) >= 2)
      .sort((a, b) => Number(a.stage_no) - Number(b.stage_no))
      .map((m) => m.variant)
      .join(">");
  }

  private async finalizeAttempt(
    ctx: AdaptiveContext,
    attempt: TestAttemptRow,
    opts: { autoSubmit: boolean }
  ): Promise<AdaptiveSubmitResult> {
    const tenantId = ctx.tenantId;
    const modules = await testAttemptsRepository.findModules(attempt.id, tenantId);
    const completed = modules.filter((m) => String(m.status) === "COMPLETED");

    const score = completed.reduce((sum, m) => sum + Number(m.raw_score ?? 0), 0);
    const totalMarks = this.totalMarksForModules(ctx, completed);
    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

    // Scaled score: all-or-nothing across sections. Any section whose taken
    // path has no configured scale leaves the attempt unscaled.
    let scaledScore: number | null = 0;
    let scaledScoreMax: number | null = 0;
    const scalesByKey = new Map(
      ctx.config.scoreScales.map((s) => [`${s.section_id}|${s.path_key}`, s])
    );
    if (ctx.config.scoreScales.length === 0) {
      scaledScore = null;
      scaledScoreMax = null;
    } else {
      for (const section of ctx.sections) {
        const secModules = completed.filter((m) => m.section_id === section.id);
        if (secModules.length === 0) {
          // Unattempted section: floor it at the section's configured minimum
          // (scale index 0) and still count its full scale_max, so the total
          // stays out of the combined maximum (e.g. SAT 1600) and never drops
          // below the combined section floors (e.g. 400). If the section has no
          // scale configured at all, the attempt isn't scalable (all-or-nothing).
          const anyScale = ctx.config.scoreScales.find(
            (s) => s.section_id === section.id
          );
          const anyArr = anyScale ? parseJson(anyScale.scale) : null;
          if (!anyScale || !Array.isArray(anyArr) || anyArr.length === 0) {
            scaledScore = null;
            scaledScoreMax = null;
            break;
          }
          scaledScore = (scaledScore ?? 0) + Number(anyArr[0] ?? 0);
          scaledScoreMax =
            (scaledScoreMax ?? 0) + Number(anyScale.scale_max ?? 0);
          continue;
        }
        const pathKey = this.pathKeyForSection(secModules);
        const scaleRow = scalesByKey.get(`${section.id}|${pathKey}`);
        if (!scaleRow) {
          scaledScore = null;
          scaledScoreMax = null;
          break;
        }
        const scaleArr = parseJson(scaleRow.scale);
        if (!Array.isArray(scaleArr) || scaleArr.length === 0) {
          scaledScore = null;
          scaledScoreMax = null;
          break;
        }
        const rawTotal = secModules.reduce(
          (sum, m) => sum + Number(m.raw_correct ?? 0),
          0
        );
        const idx = Math.max(0, Math.min(rawTotal, scaleArr.length - 1));
        scaledScore = (scaledScore ?? 0) + Number(scaleArr[idx] ?? 0);
        scaledScoreMax = (scaledScoreMax ?? 0) + Number(scaleRow.scale_max ?? 0);
      }
    }

    // Percentile basis: scaled when available (cross-path comparable), raw
    // otherwise. Different paths answer different questions, so raw-score
    // percentile across paths is a documented approximation.
    const basisScore = scaledScore ?? score;
    const otherScores = (
      scaledScore !== null
        ? await testAttemptsRepository.findAllScaledScoresForTest(
            tenantId,
            attempt.test_id
          )
        : await testAttemptsRepository.findAllScoresForTest(tenantId, attempt.test_id)
    ).map((s) => s.score);
    // Rank stays peer-relative: position among this test's takers (incl. self).
    const allScores = [...otherScores, basisScore];
    const sortedDesc = [...allScores].sort((a, b) => b - a);
    const rank = sortedDesc.findIndex((s) => s === basisScore) + 1;
    // Percentile: prefer the admin norm table (stable from the first attempt);
    // otherwise a ties-aware peer comparison, suppressed below MIN_COHORT so
    // early takers never see a misleading 0th percentile.
    const normPoints = parseNormPoints(ctx.config.normTable);
    const percentile =
      normPoints && scaledScore !== null
        ? lookupPercentile(normPoints, basisScore)
        : peerPercentile(otherScores, basisScore);

    let predictedRankMin: number | null = null;
    let predictedRankMax: number | null = null;
    if (percentile !== null) {
      try {
        const prediction = await testRankPredictorService.predictForTest(
          tenantId,
          attempt.test_id,
          percentile
        );
        if (prediction) {
          predictedRankMin = prediction.min;
          predictedRankMax = prediction.max;
        }
      } catch (err) {
        logger.warn("[test-adaptive] rank prediction failed", err);
      }
    }

    // Advanced analytics over SERVED SCORED questions only; synthetic
    // section rows substitute for test_section_questions.
    let analytics: unknown = null;
    try {
      const answers = await testAttemptsRepository.findAnswers(attempt.id, tenantId);
      const scoredServed = new Set(
        completed.flatMap((m) => strArray(m.question_ids))
      );
      const servedQuestions = ctx.config.questions.filter((q) =>
        scoredServed.has(q.id)
      );
      const syntheticSectionQuestions = completed.flatMap((m) =>
        strArray(m.question_ids).map(
          (qid, idx) =>
            ({
              id: `${m.id}:${idx}`,
              tenant_id: tenantId,
              test_id: attempt.test_id,
              section_id: m.section_id,
              question_id: qid,
              order_index: idx,
              marks_override: null,
              created_at: new Date(),
            }) as unknown as TestSectionQuestionRow
        )
      );
      analytics = await testAnalyticsService.compute({
        tenantId,
        learnerId: attempt.learner_id,
        testId: attempt.test_id,
        testSeriesId: attempt.test_series_id,
        questions: servedQuestions,
        sectionQuestions: syntheticSectionQuestions,
        answers: answers.filter((a) => scoredServed.has(a.question_id)),
        totalDurationSec: completed.reduce(
          (sum, m) => sum + Number(m.time_limit_sec),
          0
        ),
        scorePct: percentage,
      });
    } catch (err) {
      logger.warn("[test-adaptive] advanced analytics failed", err);
    }

    await testAttemptsRepository.finalize(attempt.id, tenantId, {
      status: (opts.autoSubmit ? "AUTO_SUBMITTED" : "SUBMITTED") as test_attempt_status,
      score,
      total_marks: totalMarks,
      percentage,
      percentile,
      rank,
      predicted_rank_min: predictedRankMin,
      predicted_rank_max: predictedRankMax,
      analytics,
      scaled_score: scaledScore,
      scaled_score_max: scaledScoreMax,
    });

    // Certificates + scholarships (best-effort, never blocks completion).
    await testRewardsService.onAttemptGraded({
      tenantId,
      memberId: attempt.learner_id,
      testId: attempt.test_id,
      seriesId: attempt.test_series_id,
      attemptId: attempt.id,
      percentage,
      scaledScore,
    });

    return {
      attemptId: attempt.id,
      score,
      totalMarks,
      percentage,
      percentile,
      rank,
      scaledScore,
      scaledScoreMax,
    };
  }
}

export default new TestAdaptiveAttemptService();
