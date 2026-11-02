import { customAlphabet } from "nanoid";
import { ulid } from "ulid";
import { db } from "../db/connection";
import { storefrontUrlForSlug } from "../utils/tenant-domain.util";
import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import {
  applyTemplatePickToProfile,
  deriveCreatorIntentProfile,
} from "../lib/creator-intent/derive-profile";
import { pickDefaultTemplate } from "../lib/creator-intent/template-mapping";
import { buildTenantLayout } from "../lib/page-seeds";
import type { CreatorIntentProfile, QuizAnswers } from "../lib/creator-intent/types";
import coursesRepository from "../repositories/courses.repository";
import pagesRepository from "../repositories/pages.repository";
import plansRepository from "../repositories/plans.repository";
import tenantDomainService from "./tenant-domain.service";
import organizationService from "./organization.service";
import academyPickAIService from "./academy-pick-ai.service";
import coursesService from "./courses.service";
import courseTitleAIService from "./course-title-ai.service";
import subscriptionBillingService from "./billing/subscription-billing.service";
// Import the submit helpers directly from their queue files (not the ../queues
// barrel). The barrel re-exports onboarding-finalize.worker, which imports THIS
// service, going through the barrel here would create a load-time import cycle.
import { submitCourseAIJob } from "../queues/course-ai.queue";
import {
  submitOnboardingFinalizeJob,
  type OnboardingFinalizeJobData,
} from "../queues/onboarding-finalize.queue";
import type { CourseAISectionKey } from "./course-ai.service";

const sampleCourseSlugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 4);

// Quiz `creator_type` → human-readable course title fragment for the
// auto-generated sample course. Mirrors the categories used by
// pickDefaultTemplate so the sample course matches the tenant's vertical.
// This is the deterministic fallback used when the AI title call fails or
// the AI_API_KEY is not configured. The hot path generates a richer
// domain-faithful title via courseTitleAIService.
const SAMPLE_COURSE_TITLE_BY_CREATOR_TYPE: Record<string, string> = {
  "Engineering / coding": "Programming Foundations Starter Course",
  "Competitive exams": "Exam Preparation Starter Course",
  "Fitness": "Fitness Foundations Starter Course",
  "Business coaching": "Business Skills Starter Course",
  "School coaching": "School Coaching Starter Course",
  "Language": "Language Foundations Starter Course",
  "Other": "Starter Course",
};

function buildDeterministicSampleCourseTitle(
  quizAnswers: QuizAnswers,
  orgName: string,
): string {
  const fromCreatorType = SAMPLE_COURSE_TITLE_BY_CREATOR_TYPE[quizAnswers.creator_type];
  return fromCreatorType ?? `${orgName} Starter Course`;
}

// ── Quiz → AI extraContext helpers ──────────────────────────────────────
// Mirrors the constants in
// `apps/admin/src/components/onboarding-quiz/build-business-info.ts`.
// Kept in sync manually, both files are tiny.
const INDUSTRY_BY_CREATOR_TYPE: Record<string, string> = {
  "Engineering / coding": "Engineering / coding education",
  "School coaching": "School-level academic coaching",
  "Competitive exams": "Competitive exam preparation",
  Fitness: "Fitness & wellness",
  "Business coaching": "Business & professional coaching",
  Language: "Language learning",
  "Arts & Design": "Arts, crafts & creative skills",
  Music: "Music & audio production",
  Cooking: "Cooking & culinary skills",
  "Kids education": "Kids learning & school tutoring",
  "Finance / Trading": "Finance, trading & investing",
  Other: "Online education",
};

const TONE_BY_CREATOR_TYPE: Record<string, string> = {
  "Engineering / coding":
    "practical and project-driven, with a focus on shipping real-world software skills",
  "School coaching":
    "supportive and structured, aligned with school curricula and exam patterns",
  "Competitive exams":
    "rigorous and discipline-led, focused on consistent practice and rank improvement",
  Fitness: "energetic and habit-building, focused on sustainable transformation",
  "Business coaching": "outcome-driven and grounded in lived business experience",
  Language: "conversational and immersion-focused, balancing fluency with accuracy",
  "Arts & Design":
    "hands-on and expressive, focused on building real creative skill and portfolio-worthy work",
  Music:
    "energetic and performance-focused, balancing technique with creative expression",
  Cooking:
    "warm and practical, focused on repeatable techniques and confidence in the kitchen",
  "Kids education":
    "friendly and encouraging, designed to keep young learners engaged and progressing",
  "Finance / Trading":
    "rigorous and results-driven, grounded in real market experience and risk discipline",
  Other: "structured and learner-first, designed for measurable progress",
};

function describeAudience(stage: string): string {
  switch (stage) {
    case "0–100":
      return "early adopters and motivated first learners";
    case "100–1000":
      return "a growing community of learners across India";
    case "1000–10000":
      return "thousands of active learners spanning multiple cohorts";
    case "10000+":
      return "a large established learner base with proven outcomes";
    default:
      return "online learners";
  }
}

/** Build the extraContext blob fed to courseAIService via the BullMQ job. */
function buildCourseAIExtraContext(
  quizAnswers: QuizAnswers,
  orgName: string,
): string {
  const industry =
    INDUSTRY_BY_CREATOR_TYPE[quizAnswers.creator_type] ?? "online education";
  const tone =
    TONE_BY_CREATOR_TYPE[quizAnswers.creator_type] ??
    "structured and learner-first";
  const audience = describeAudience(quizAnswers.business_stage);
  return [
    `Launch course for "${orgName}", a new academy specializing in ${industry}.`,
    `Format: ${quizAnswers.course_type.toLowerCase()}.`,
    `Audience: ${audience}.`,
    `Teaching tone: ${tone}.`,
  ].join(" ");
}

const ONBOARDING_COURSE_AI_SECTIONS: CourseAISectionKey[] = [
  "subtitle",
  "learningOutcomes",
  "curriculum",
  "offerings",
  "requirements",
  "description",
  "faqs",
  "thumbnails",
];

function slugifyCourseTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface ProvisionAcademyInput {
  org_name: string;
  quiz_answers: QuizAnswers;
  contact_email: string;
  owner_name: string;
  timezone?: string | null;
}

export interface ProvisionAcademyResult {
  tenant: { id: string; name: string; slug: string };
  subdomain_url: string;
  template_id: string;
  theme_id: string;
  /** "ai" if the AI model picked the template+theme, "fallback" if deterministic. */
  generation_source: "ai" | "fallback";
  ai_latency_ms: number;
  /** Quiz answers echoed back so the frontend can build its AI BusinessInfo. */
  quiz_answers: QuizAnswers;
  /**
   * Sample SELF_PACED course auto-created inside the provisioning trx.
   * `published` reflects whether the post-trx publish call succeeded, when
   * false the course exists as DRAFT and the tenant can publish it manually
   * from the dashboard.
   */
  sample_course: {
    id: string;
    slug: string;
    title: string;
    page_slug: string;
    published: boolean;
  } | null;
}

class TenantProvisioningService {
  /**
   * Provision the *shell* of an academy from quiz answers:
   *   1. Resolve latest published FREE plan (fail-fast if missing).
   *   2. Pick template + theme via the AI model (with deterministic fallback).
   *   3. Single transaction:
   *       - create tenant + membership
   *       - auto-assign FREE plan (entitlements + tenant_applications)
   *       - persist creator_intent_profile + quiz answers on tenant_users
   *       - register subdomain in tenant_domains
   *
   * Page creation + per-section AI content generation are NOT done here.
   * the frontend takes over after this returns and runs the same
   * pageAIService.generateSection chain that the rich /dashboard/pages
   * onboarding wizard uses. That gives About / FAQ / Terms / Privacy /
   * Contact / Home full per-section AI parity with the pre-update flow.
   *
   * Idempotency: the owner-already-has-tenant guard at the top + the
   * subdomain unique constraint inside the trx make safe-retry trivial.
   * the whole trx rolls back together.
   */
  async provisionAcademy(
    ownerUserId: string,
    input: ProvisionAcademyInput,
  ): Promise<ProvisionAcademyResult> {
    const orgName = input.org_name?.trim();
    if (!orgName || orgName.length < 2) {
      throw new BadRequestError(
        "Organization name is required and must be at least 2 characters",
      );
    }

    // Any tenant user may own multiple organizations (the DB one-owner-per-user
    // UNIQUE constraint is dropped). The onboarding wizard is still first-run
    // only in practice: the frontend QuizWizard bounces users who already have
    // a tenant, and its phase/wizardActive gates prevent double-submit.

    // 0a. Pre-flight check that the FREE plan exists, so we fail loudly
    // *before* any DB writes if ops haven't published one. The actual
    // allocation runs INSIDE the provisioning trx via
    // subscriptionBillingService.activateFreePlanWithExistingTrx, this
    // lookup is just a 400 gate.
    const freePlan = await plansRepository.findLatestPublishedFreePlanVersion();
    if (!freePlan) {
      throw new BadRequestError(
        "No PUBLISHED FREE plan_version is configured. " +
          "An operator must publish a FREE plan version before tenants can sign up.",
      );
    }

    // 1. Deterministic baseline (also fed to the AI model as anchor).
    const detPick = pickDefaultTemplate(input.quiz_answers, orgName);
    const baseProfile = deriveCreatorIntentProfile(input.quiz_answers, orgName);

    // 2. the AI model picks template + theme. This is the ONE AI call that MUST
    //    stay on the synchronous request path: the frontend needs
    //    template_id/theme_id in the response to drive its per-section page
    //    generation (QuizWizard early-returns and skips all page creation if
    //    either is missing). Everything else, the sample course, its AI
    //    title/content, publish is deferred
    //    to the onboarding-finalize BullMQ job so the request stays fast and
    //    small (see finalizeAcademyProvisioning below).
    //
    //    The helper is internally fail-safe (returns the deterministic shape
    //    on any the AI model error). We wrap in try/catch as a final belt-and-braces
    //    so an unexpected helper throw drops to the deterministic baseline
    //    rather than failing provisioning.
    type TemplatePickResult = Awaited<
      ReturnType<typeof academyPickAIService.pickTemplateAndTheme>
    >;
    let templateResult: TemplatePickResult;
    try {
      templateResult = await academyPickAIService.pickTemplateAndTheme({
        quiz_answers: input.quiz_answers,
        org_name: orgName,
        deterministic_default: {
          template_id: detPick.template_id,
          theme_id: detPick.theme_id,
        },
      });
    } catch (err) {
      logger.warn(
        `the AI model template pick threw (unexpected), falling back: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      templateResult = {
        pick: {
          template_id: detPick.template_id,
          theme_id: detPick.theme_id,
          rationale:
            "Deterministic default (template helper threw unexpectedly).",
        },
        source: "fallback",
        latency_ms: 0,
      };
    }
    const { pick, source, latency_ms } = templateResult;

    // Fold the model's choice back into the persisted intent profile.
    const profile: CreatorIntentProfile =
      source === "ai"
        ? applyTemplatePickToProfile(baseProfile, {
            template_id: pick.template_id,
            theme_id: pick.theme_id,
          })
        : baseProfile;

    // 3. Slug + tenant ids.
    const slug = await organizationService.generateUniqueSlug(orgName);
    const now = new Date();
    const tenantId = ulid();
    const membershipId = ulid();

    // Plan allocation result captured inside the trx so we can fire the
    // canonical post-trx hooks (subscription_events / tenant.status /
    // welcome email) AFTER the provisioning trx commits, same hooks the
    // self-serve subscribe flow runs.
    type AllocationT = Awaited<
      ReturnType<
        typeof subscriptionBillingService.activateFreePlanWithExistingTrx
      >
    >;
    let allocation: AllocationT | undefined;

    // 4. Single transaction, atomicity across tenant + plan + subdomain.
    await db.transaction().execute(async (trx) => {
      // 4a. Tenant + membership.
      await trx
        .insertInto("tenants")
        .values({
          id: tenantId,
          name: orgName,
          slug,
          custom_domain: null,
          owner_user_id: ownerUserId,
          status: "ACTIVE",
          layout: JSON.stringify(
            buildTenantLayout(profile.theme_id, profile.template_id, orgName),
          ),
          updated_at: now,
        })
        .execute();

      await trx
        .insertInto("tenant_staff_memberships")
        .values({
          id: membershipId,
          tenant_id: tenantId,
          user_id: ownerUserId,
          status: "ACTIVE",
          invited_by: null,
          invited_at: null,
          joined_at: now,
          created_at: now,
          updated_at: now,
        })
        .execute();

      // 4b. Auto-assign the latest published FREE plan by composing the
      // canonical `subscriptionBillingService.activateFreePlan` flow
      // INSIDE this trx via its trx-accepting variant. This produces rows
      // byte-identical to a self-serve "Subscribe" on the plans page:
      //   - 1 `subscriptions` row (status=ACTIVE, billing_cycle=YEARLY,
      //     billing_provider_name=FREE, period_end=now+10y, prices=0)
      //   - N `entitlements` rows (source='PLAN', linked via
      //     source_subscription_id)
      //   - M `tenant_applications` rows (source='SUBSCRIPTION', linked
      //     via source_subscription_id)
      // The post-trx hooks (subscription_events audit, tenants.status
      // activation, FREE_PLAN_ACTIVATED welcome email) are fired AFTER
      // this trx commits, see `runFreePlanActivationPostTrx` below.
      allocation =
        await subscriptionBillingService.activateFreePlanWithExistingTrx(
          tenantId,
          freePlan.id,
          trx,
        );

      // 4c. Persist quiz + intent profile on tenant_users (existing dormant
      // columns). profile_completed_at goes in the same trx so a transient
      // DB error on a separate post-commit write can't strand the user with
      // a tenant that exists but a "failed signup" response.
      await trx
        .updateTable("tenant_users")
        .set({
          signup_quiz_answers: JSON.stringify(input.quiz_answers),
          creator_intent_profile: JSON.stringify(profile),
          profile_completed_at: now,
          ...(input.timezone ? { timezone: input.timezone } : {}),
          updated_at: now,
        })
        .where("id", "=", ownerUserId)
        .execute();

      // 4d. Register subdomain in the same trx so the tenant + its public
      // hostname mapping commit atomically. If registration fails (e.g.
      // domain_name collision from a race), the entire trx rolls back.
      // keeping retry safe and never returning a subdomain URL whose
      // DB mapping doesn't exist.
      await tenantDomainService.registerSubdomain(tenantId, slug, trx);

      // NOTE: the sample SELF_PACED course + its landing page are NOT created
      // here anymore. They (plus publish and the course-ai content job) are
      // deferred to the onboarding-finalize BullMQ
      // job, see finalizeAcademyProvisioning below. This keeps the request
      // light so it never crosses the dev-proxy timeout on a remote DB. The
      // tenant committed by this trx is already fully valid and usable.
    });

    const subdomainUrl = storefrontUrlForSlug(slug);

    // 6. Fire the canonical post-trx hooks for the free-plan activation.
    // Mirrors what `subscriptionBillingService.activateFreePlan` runs
    // after its own trx commits in the self-serve flow:
    //   - subscription_events row with event_type=CREATED, source=API
    //   - tenants.status = ACTIVE (idempotent, already set in the trx)
    //   - FREE_PLAN_ACTIVATED welcome email queued (BullMQ, fire-and-forget)
    // Each underlying helper swallows its own errors, so this call cannot
    // throw, we still wrap to be explicit about the contract.
    if (allocation) {
      try {
        await subscriptionBillingService.runFreePlanActivationPostTrx({
          subscriptionId: allocation.subscription_id,
          tenantId,
          planName: allocation.plan_name,
        });
      } catch (err) {
        logger.warn(
          `Free-plan post-trx hooks failed (non-fatal, provisioning already committed) ` +
            `tenant=${tenantId} sub=${allocation.subscription_id} reason=${
              err instanceof Error ? err.message : String(err)
            }`,
        );
      }
    }

    // 6b. Enqueue the deferred finalize step. This runs the heavy tail.
    // sample course creation + AI title/content and publish, in the background so the request can return
    // now. Enqueue failure is non-fatal: the tenant is already fully valid
    // (tenant + membership + FREE plan/entitlements + subdomain), it just
    // won't get an auto-seeded sample course until re-triggered.
    try {
      const finalizeJobId = await submitOnboardingFinalizeJob({
        tenantId,
        orgName,
        quiz_answers: input.quiz_answers,
      });
      logger.info(
        `[onboarding] enqueued finalize job tenant=${tenantId} jobId=${finalizeJobId}`,
      );
    } catch (err) {
      logger.warn(
        `[onboarding] finalize enqueue failed (tenant is valid; no sample course seeded) ` +
          `tenant=${tenantId} reason=${
            err instanceof Error ? err.message : String(err)
          }`,
      );
    }

    // Inline the key fields into the message so they survive Winston's
    // current format. template_id / theme_id are CRITICAL: if either is
    // undefined the frontend's QuizWizard early-returns and skips all page
    // creation ("finishes at step 2" symptom).
    logger.info(
      `Provisioned academy: tenant=${tenantId} owner=${ownerUserId} slug=${slug} ` +
        `template_id=${profile.template_id ?? "MISSING"} theme_id=${profile.theme_id ?? "MISSING"} ` +
        `template_pick_source=${source} (sample course deferred to finalize job)`,
      {
        event: "tenant_provisioning.completed",
        owner_user_id: ownerUserId,
        tenant_id: tenantId,
        slug,
        template_id: profile.template_id,
        theme_id: profile.theme_id,
        template_pick_source: source,
        ai_latency_ms: latency_ms,
        free_plan_version_id: freePlan.id,
        free_plan_code: allocation ? allocation.plan_code : undefined,
        free_plan_name: allocation ? allocation.plan_name : undefined,
        subscription_id: allocation ? allocation.subscription_id : undefined,
      },
    );

    return {
      tenant: { id: tenantId, name: orgName, slug },
      subdomain_url: subdomainUrl,
      template_id: profile.template_id,
      theme_id: profile.theme_id,
      generation_source: source,
      ai_latency_ms: latency_ms,
      quiz_answers: input.quiz_answers,
      // Sample course is created asynchronously by the finalize job.
      sample_course: null,
    };
  }

  /**
   * Deferred second half of academy provisioning, run by the
   * onboarding-finalize BullMQ worker after `provisionAcademy` has already
   * returned the usable tenant to the client. Everything here is best-effort
   * and idempotent, the tenant is fully functional without it:
   *   1. Generate the sample-course title via the AI model (deterministic fallback).
   *   2. Create the sample SELF_PACED course + its `courses/{slug}` page.
   *   3. Publish both (CAS counter-init path).
   *   4. Enqueue the course-ai job that fills the course with AI content.
   *
   * Idempotency: if a sample course already exists for the tenant (a re-run
   * of this job), steps 1–4 are skipped; step 5 is internally idempotent.
   */
  async finalizeAcademyProvisioning(
    data: OnboardingFinalizeJobData,
  ): Promise<void> {
    const { tenantId, orgName, quiz_answers } = data;

    // Idempotency guard, never create a second sample course for a tenant.
    const existingCourse = await db
      .selectFrom("courses")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .limit(1)
      .executeTakeFirst();

    if (existingCourse) {
      logger.info(
        `[onboarding-finalize] tenant=${tenantId} already has a course, skipping sample-course creation`,
      );
    } else {
      // 1. Sample-course title, the AI model with deterministic fallback. Fully
      //    isolated: a title-AI failure must never block course creation.
      const deterministicCourseTitle = buildDeterministicSampleCourseTitle(
        quiz_answers,
        orgName,
      );
      let sampleCourseTitle = deterministicCourseTitle;
      try {
        const titleResult = await courseTitleAIService.generateCourseTitle({
          quiz_answers,
          org_name: orgName,
          deterministic_fallback: deterministicCourseTitle,
        });
        sampleCourseTitle = titleResult.courseTitle;
      } catch (err) {
        logger.warn(
          `[onboarding-finalize] course-title AI threw, using deterministic title ` +
            `tenant=${tenantId} reason=${
              err instanceof Error ? err.message : String(err)
            }`,
        );
      }

      const sampleCourseSlug = `${slugifyCourseTitle(sampleCourseTitle) || "sample-starter-course"}-${sampleCourseSlugSuffix()}`;
      const sampleCoursePageSlug = `courses/${sampleCourseSlug}`;

      // 2. Create the sample course + companion landing page atomically.
      let sampleCourseId = "";
      let samplePageId = "";
      await db.transaction().execute(async (trx) => {
        const createdCourse = await coursesRepository.create(
          {
            tenant_id: tenantId,
            title: sampleCourseTitle,
            slug: sampleCourseSlug,
            subtitle: null,
            description: null,
            purchase_mode: "FREE",
            status: "DRAFT",
            mode: "SELF_PACED",
            difficulty: "BEGINNER",
            course_type: "NORMAL",
            language: ["English"],
            learning_outcomes: [],
          },
          trx,
        );
        sampleCourseId = createdCourse.id;

        const createdPage = await pagesRepository.create(
          {
            tenant_id: tenantId,
            slug: sampleCoursePageSlug,
            title: sampleCourseTitle,
            sections: [],
            theme: {},
            seo: { title: sampleCourseTitle },
            is_published: false,
          },
          trx,
        );
        samplePageId = createdPage.id;
      });

      // 3. Publish course + landing page (best-effort). Publish uses the CAS
      //    counter-init path, which can't run in the same trx that created
      //    the entitlement row, hence it's split out here.
      let sampleCoursePublished = false;
      try {
        await coursesService.togglePublish(sampleCourseId, tenantId, true);
        sampleCoursePublished = true;
      } catch (err) {
        logger.warn(
          `[onboarding-finalize] sample course publish failed (remains DRAFT) ` +
            `tenant=${tenantId} course=${sampleCourseId} reason=${
              err instanceof Error ? err.message : String(err)
            }`,
        );
      }

      if (sampleCoursePublished && samplePageId) {
        try {
          await pagesRepository.update(samplePageId, { is_published: true });
        } catch (err) {
          logger.warn(
            `[onboarding-finalize] sample course landing page publish failed ` +
              `tenant=${tenantId} reason=${
                err instanceof Error ? err.message : String(err)
              }`,
          );
        }
      }

      // 4. Enqueue the course-ai job (auto-apply) to fill the sample course
      //    with on-brand AI content. Same worker as the manual "Generate all
      //    with AI" flow; jobIdOverride keeps it in its own ID namespace.
      if (sampleCourseId && samplePageId) {
        try {
          const onboardingJobId = `course-ai-onboarding-${tenantId}-${sampleCourseId}`;
          await submitCourseAIJob(
            {
              tenantId,
              courseTitle: sampleCourseTitle,
              sections: ONBOARDING_COURSE_AI_SECTIONS,
              extraContext: buildCourseAIExtraContext(quiz_answers, orgName),
              industry: INDUSTRY_BY_CREATOR_TYPE[quiz_answers.creator_type],
              difficultyLevel: "beginner",
              courseId: sampleCourseId,
              pageId: samplePageId,
              applyToDb: true,
              courseMode: "SELF_PACED",
            },
            { jobIdOverride: onboardingJobId },
          );
          logger.info(
            `[onboarding-finalize] enqueued course-ai job tenant=${tenantId} course=${sampleCourseId} jobId=${onboardingJobId}`,
          );
        } catch (err) {
          logger.warn(
            `[onboarding-finalize] course-ai enqueue failed (sample course remains as empty shell) ` +
              `tenant=${tenantId} reason=${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    logger.info(
      `[onboarding-finalize] completed tenant=${tenantId}`,
    );
  }
}

export default new TenantProvisioningService();
