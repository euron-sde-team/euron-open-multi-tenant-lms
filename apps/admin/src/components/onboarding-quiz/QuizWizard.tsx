"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@open-mtlms/core";

import type { ProvisionedAcademy } from "@/lib/api/organization";
import { useMe } from "@/lib/hooks/use-auth";
import { useCreateOrganization } from "@/lib/hooks/use-organization";
import {
  FIRST_QUIZ_STEP,
  STEP_ORG_NAME,
  useOnboardingQuizStore,
} from "@/stores/onboarding-quiz-store";

import type { QuizAnswers } from "@open-mtlms/shared";

import { BuildSequence } from "./BuildSequence";
import { OrgNameStep } from "./OrgNameStep";
import { QuizStep } from "./QuizStep";
import { QUIZ_QUESTIONS } from "./quiz.config";
import { RevealCelebration } from "./RevealCelebration";
import { WizardLayout } from "./WizardLayout";
import { buildBusinessInfoFromQuiz } from "./build-business-info";
import { useAutoProvisionAcademy } from "./use-auto-provision-academy";
import { ROOT_DOMAIN } from "@/lib/brand";

type Phase = "wizard" | "building" | "revealed";

const ROOT_HOST = ROOT_DOMAIN;

const TOTAL_QUESTIONS = QUIZ_QUESTIONS.length;
const LAST_QUIZ_STEP = FIRST_QUIZ_STEP + TOTAL_QUESTIONS - 1;

export function QuizWizard() {
  const router = useRouter();
  const { data: me } = useMe();
  const {
    step,
    answers,
    orgName,
    setStep,
    next,
    prev,
    setAnswer,
    toggleTool,
    setOrgName,
    setOrgNameFromSignupHint,
    ensureOwner,
    setWizardActive,
    reset,
    isReadyToSubmit,
  } = useOnboardingQuizStore();
  // Reactively-tracked fields. useOnboardingQuizStore.getState() is
  // imperative and does not subscribe, using selectors so render gates
  // / redirect guards re-evaluate when these change.
  const storeUserId = useOnboardingQuizStore((s) => s.userId);
  const wizardActive = useOnboardingQuizStore((s) => s.wizardActive);

  // Stamp the store with the authenticated user's id. If the persisted
  // state belongs to a different user (e.g. previous signup on this
  // browser), ensureOwner() resets the whole store BEFORE the orgName
  // hint / step clamp effects below run, guarantees a fresh signup
  // never inherits someone else's mid-quiz state. Runs synchronously
  // on /me arrival and is a no-op on subsequent renders.
  useEffect(() => {
    if (me?.id) ensureOwner(me.id);
  }, [me?.id, ensureOwner]);

  const [phase, setPhase] = useState<Phase>("wizard");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionedAcademy | null>(null);

  const createOrg = useCreateOrganization();
  const autoProvision = useAutoProvisionAcademy();

  // Pre-fill the org-name field with "{firstName}'s Academy" when we first
  // know the user's name. setOrgNameFromSignupHint is a no-op when the user
  // has already typed something (preserves resumed state across refresh).
  useEffect(() => {
    const firstName = me?.name?.trim().split(/\s+/)[0];
    if (firstName) setOrgNameFromSignupHint(firstName);
  }, [me?.name, setOrgNameFromSignupHint]);

  // Already-has-tenant guard.
  //
  // The wizard's job is to create the FIRST tenant for a logged-in user.
  // If they land here already owning one (e.g., refresh on /onboarding/quiz
  // after a previous successful signup), bounce them to the dashboard.
  //
  // Two independent gates guard against mid-build redirects:
  //   (1) phase !== "wizard", local state. Set to "building" by handleSubmit
  //       BEFORE the backend call, so a same-mount /me refetch is harmless.
  //   (2) wizardActive, persisted Zustand flag. Survives a remount even if
  //       phase is reset to its initial value. Set true on submit, cleared
  //       on "Open Dashboard". Without this, an unrelated remount (tenant
  //       switch flickering useMe queryKey, browser tab restore, fast
  //       refresh during dev, etc.) reset phase to "wizard" + observed
  //       hasTenant=true and bounced the user to /dashboard with a
  //       half-provisioned tenant.
  useEffect(() => {
    if (phase !== "wizard") return;
    if (wizardActive) return;
    if ((me?.tenants?.length ?? 0) > 0) {
      router.replace("/dashboard");
    }
  }, [phase, wizardActive, me?.tenants, router]);

  // Step bounds + prerequisite guard. Persisted store could carry:
  //   (a) an out-of-range value if we ever change the step layout
  //   (b) a quiz step (>= FIRST_QUIZ_STEP) without an orgName, which would
  //       drop the user mid-quiz with no academy name set, they'd see only
  //       one question and submit would fail validation.
  // Clamp on first paint so neither case strands the user.
  useEffect(() => {
    if (step < STEP_ORG_NAME || step > LAST_QUIZ_STEP) {
      setStep(STEP_ORG_NAME);
    } else if (step >= FIRST_QUIZ_STEP && orgName.trim().length < 2) {
      setStep(STEP_ORG_NAME);
    }
  }, [step, orgName, setStep]);

  const handleSubmit = async () => {
    if (!isReadyToSubmit()) {
      setSubmitError("Please complete all questions and name your academy.");
      return;
    }
    setSubmitError(null);
    setPhase("building");
    // Mark wizard active in the persisted store BEFORE the backend call
    // so even if a remount happens during the build (tenant switch
    // flickering useMe, fast refresh in dev, etc.) the already-has-tenant
    // redirect stays suppressed. Cleared in handleOpenDashboard.
    setWizardActive(true);

    let provision: ProvisionedAcademy;
    try {
      // Step 1: backend creates the tenant SHELL (tenant + plan + intent
      // profile + subdomain). Picks template+theme via Gemini.
      // eslint-disable-next-line no-console
      console.log("[wizard] submitting POST /tenant/organization…");
      provision = await createOrg.mutateAsync({
        name: orgName.trim(),
        quiz_answers: answers as QuizAnswers,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      // eslint-disable-next-line no-console
      console.log("[wizard] provision response:", {
        id: provision.id,
        slug: provision.slug,
        template_id: provision.template_id,
        theme_id: provision.theme_id,
        subdomainUrl: provision.subdomainUrl,
        generation_source: provision.generation_source,
      });
      setResult(provision);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[wizard] provisioning POST failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setSubmitError(msg);
      setPhase("wizard");
      setStep(LAST_QUIZ_STEP);
      // Clear so the user is back in the wizard and the
      // already-has-tenant redirect resumes its normal duty (which is
      // still gated on hasTenant, so will be a no-op here since the
      // backend call failed before any tenant was created).
      setWizardActive(false);
      return;
    }

    // Step 2: frontend takes over and runs the per-section AI engine
    // (same one the existing /dashboard/pages onboarding wizard uses) for
    // every page in the AI-picked template, including About, FAQ, Terms,
    // Privacy, Contact, Home. This gives full per-section parity with the
    // pre-update flow.
    if (!provision.id || !provision.template_id || !provision.theme_id) {
      // Backend response is missing the bits we need, treat as success
      // anyway (subdomain exists, dashboard works) and skip AI generation.
      // eslint-disable-next-line no-console
      console.error(
        "[wizard] response missing id/template_id/theme_id, skipping autoProvision",
        {
          id: provision.id,
          template_id: provision.template_id,
          theme_id: provision.theme_id,
        },
      );
      setPhase("revealed");
      return;
    }

    const businessInfo = buildBusinessInfoFromQuiz({
      orgName: provision.name ?? orgName.trim(),
      signupName: me?.name?.trim() ?? null,
      signupEmail: me?.email ?? "",
      quizAnswers: answers as QuizAnswers,
    });

    try {
      // eslint-disable-next-line no-console
      console.log("[wizard] calling autoProvision.run()…");
      const ok = await autoProvision.run({
        tenantId: provision.id,
        templateId: provision.template_id,
        themeId: provision.theme_id,
        businessInfo,
      });
      // eslint-disable-next-line no-console
      console.log("[wizard] autoProvision.run() resolved with:", ok);
    } catch (err) {
      // AI orchestration is best-effort, the tenant + subdomain already
      // exist, so we always reveal even if some pages failed to AI-fill.
      // eslint-disable-next-line no-console
      console.error(
        "[wizard] autoProvision.run() THREW (this is the bug source if pages aren't created):",
        err,
      );
    }

    // eslint-disable-next-line no-console
    console.log("[wizard] setPhase('revealed')");
    setPhase("revealed");
  };

  const handleOpenDashboard = () => {
    reset();
    autoProvision.reset();
    router.push("/dashboard");
  };

  // ----- Build / reveal phases supersede the wizard UI -----

  if (phase === "building") {
    return (
      <WizardLayout stage="live">
        <BuildSequence
          phase={autoProvision.phase}
          pageProgresses={autoProvision.pageProgresses}
          orgSlug={(result?.slug as string) ?? orgName}
          rootHost={ROOT_HOST}
          backendDone={!!result}
        />
      </WizardLayout>
    );
  }

  if (phase === "revealed" && result) {
    const subdomainUrl =
      result.subdomainUrl ?? `https://${result.slug}.${ROOT_HOST}`;
    return (
      <WizardLayout stage="live">
        <RevealCelebration
          orgName={result.name ?? orgName}
          subdomainUrl={subdomainUrl}
          onOpenDashboard={handleOpenDashboard}
        />
      </WizardLayout>
    );
  }

  // ----- Wizard phase -----

  // Gate rendering on /me + ensureOwner having stamped the store. Without
  // this, a render that lands BEFORE /me resolves reads the persisted
  // (potentially stale) state and a single click on an auto-advance
  // single-select can fire handleSubmit with the wrong user's answers.
  // We render a minimal hold state until both conditions are true.
  const isStoreOwnedByMe = !!me?.id && storeUserId === me.id;
  if (!me || !isStoreOwnedByMe) {
    return (
      <WizardLayout stage="about">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </WizardLayout>
    );
  }

  const firstName = me?.name?.trim().split(/\s+/)[0];

  if (step === STEP_ORG_NAME) {
    return (
      <WizardLayout stage="about">
        <OrgNameStep
          firstName={firstName}
          orgName={orgName}
          onChange={setOrgName}
          onContinue={next}
          rootHost={ROOT_HOST}
        />
      </WizardLayout>
    );
  }

  // Quiz steps: FIRST_QUIZ_STEP..LAST_QUIZ_STEP map to QUIZ_QUESTIONS[0..n-1].
  if (step >= FIRST_QUIZ_STEP && step <= LAST_QUIZ_STEP) {
    const questionIndex = step - FIRST_QUIZ_STEP;
    const q = QUIZ_QUESTIONS[questionIndex];
    const selectedSingle = (answers as Record<string, string | undefined>)[
      q.id
    ];
    const selectedMulti = answers.current_tools ?? [];
    const isLastQuestion = step === LAST_QUIZ_STEP;

    const handleSelectSingle = (value: string) => {
      setAnswer(q.id as keyof QuizAnswers, value as never);
      // Single-select auto-advance. If this is the final question (only
      // possible if the final question is single-select, currently it's
      // multi-select, but defend against config changes), submit instead.
      setTimeout(() => {
        if (isLastQuestion) handleSubmit();
        else next();
      }, 200);
    };

    const handleNextOrSubmit = () => {
      if (isLastQuestion) handleSubmit();
      else next();
    };

    return (
      <WizardLayout
        stage="quiz"
        subProgress={
          <ProgressDots
            current={questionIndex + 1}
            total={TOTAL_QUESTIONS}
          />
        }
      >
        {submitError && (
          <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}
        <QuizStep
          question={q}
          questionIndex={questionIndex}
          totalQuestions={TOTAL_QUESTIONS}
          selectedSingle={selectedSingle as string | undefined}
          selectedMulti={selectedMulti}
          onSelectSingle={handleSelectSingle}
          onToggleMulti={toggleTool}
          onBack={prev}
          onNext={handleNextOrSubmit}
        />
      </WizardLayout>
    );
  }

  // Defensive fallback (out-of-bound step), render the org-name step.
  return (
    <WizardLayout stage="about">
      <OrgNameStep
        firstName={firstName}
        orgName={orgName}
        onChange={setOrgName}
        onContinue={next}
        rootHost={ROOT_HOST}
      />
    </WizardLayout>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  const dots = useMemo(
    () => Array.from({ length: total }, (_, i) => i + 1),
    [total],
  );
  return (
    <div className="flex items-center gap-1.5">
      {dots.map((d) => (
        <span
          key={d}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            d <= current ? "w-8 bg-primary" : "w-4 bg-muted",
          )}
        />
      ))}
    </div>
  );
}
