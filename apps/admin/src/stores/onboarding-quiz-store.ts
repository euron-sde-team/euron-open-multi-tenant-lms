"use client";

import type { QuizAnswers } from "@open-mtlms/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type PartialAnswers = Partial<Omit<QuizAnswers, "current_tools">> & {
  current_tools?: string[];
};

// Step indices for the wizard. Org name is the FIRST thing a freshly
// signed-up user sees, no separate Welcome screen, the greeting is folded
// into the org-name step header itself. This eliminates a click of friction.
//
//   0 = Organisation name (with personal greeting)
//   1..5 = Quiz questions (5 total)
//
// BuildSequence + RevealCelebration phases are handled outside the step
// counter (see QuizWizard's local Phase state).
export const STEP_ORG_NAME = 0;
export const FIRST_QUIZ_STEP = 1;

interface OnboardingQuizStore {
  step: number;
  answers: PartialAnswers;
  orgName: string;
  /**
   * The user.id this state belongs to. QuizWizard stamps it via
   * ensureOwner() on mount; if it doesn't match the authenticated user
   * the whole store is reset before the stamp. This prevents a previous
   * user's persisted answers/orgName from leaking into a fresh signup
   * on the same browser (which manifested as "only one question shows
   * up, then auto-submit with someone else's data").
   */
  userId: string | null;
  /**
   * True from the moment handleSubmit fires (tenant being created) until
   * the user clicks "Open Dashboard" on the reveal screen. Persisted so
   * it survives accidental remounts, the QuizWizard's "already-has-tenant"
   * redirect skips while this flag is set, guaranteeing a mid-build
   * remount can never bounce the user away to /dashboard with a
   * half-provisioned tenant. Also doubles as a "wizard in progress"
   * signal any other component might want to read.
   */
  wizardActive: boolean;
  setStep: (step: number) => void;
  next: () => void;
  prev: () => void;
  setAnswer: <K extends keyof QuizAnswers>(
    key: K,
    value: QuizAnswers[K],
  ) => void;
  toggleTool: (tool: string) => void;
  setOrgName: (name: string) => void;
  /**
   * One-time pre-fill from the signup name. No-op if the user has already
   * typed something into the org-name field (preserves resumed state).
   */
  setOrgNameFromSignupHint: (firstName: string) => void;
  /**
   * Idempotent ownership stamp. If `userId` is already set to a different
   * user, the store is reset before stamping, guarantees mid-quiz state
   * never carries across users on the same browser.
   */
  ensureOwner: (userId: string) => void;
  /** Set wizardActive flag (true on submit, false when reveal screen acknowledged). */
  setWizardActive: (active: boolean) => void;
  reset: () => void;
  /** True once required answers are filled (all 5 quiz answers + org name). */
  isReadyToSubmit: () => boolean;
}

const initialState = {
  step: STEP_ORG_NAME,
  answers: { current_tools: [] } as PartialAnswers,
  orgName: "",
  userId: null as string | null,
  wizardActive: false,
};

export const useOnboardingQuizStore = create<OnboardingQuizStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setStep: (step) => set({ step }),
      next: () => set((s) => ({ step: s.step + 1 })),
      prev: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
      setAnswer: (key, value) =>
        set((s) => ({ answers: { ...s.answers, [key]: value } })),
      toggleTool: (tool) =>
        set((s) => {
          const cur = new Set(s.answers.current_tools ?? []);
          if (cur.has(tool)) cur.delete(tool);
          else cur.add(tool);
          return {
            answers: { ...s.answers, current_tools: Array.from(cur) },
          };
        }),
      setOrgName: (orgName) => set({ orgName }),
      setOrgNameFromSignupHint: (firstName) => {
        const trimmed = firstName.trim();
        if (!trimmed) return;
        if (get().orgName.trim().length > 0) return; // never overwrite user input
        set({ orgName: `${trimmed}'s Academy` });
      },
      ensureOwner: (userId) => {
        const current = get().userId;
        if (current === userId) return;
        // Either fresh state (current === null) or a different user owned
        // this state, wipe completely before stamping the new owner.
        set({ ...initialState, userId });
      },
      setWizardActive: (active) => set({ wizardActive: active }),
      reset: () => set(initialState),
      isReadyToSubmit: () => {
        const a = get().answers;
        return Boolean(
          a.course_type &&
            a.creator_type &&
            a.business_stage &&
            a.revenue_intent &&
            get().orgName.trim().length >= 2,
        );
      },
    }),
    {
      // v4, added wizardActive flag (defends against mid-build remount
      // redirects when /me's tenant context flips and AuthGuard / QuizPage
      // would otherwise unmount → remount the wizard with phase reset).
      // Bump invalidates v3 storage; existing users start clean.
      name: "onboarding-quiz-storage-v4",
      version: 4,
    },
  ),
);

// Slugify util, mirrors backend organizationService.generateSlug for the
// frontend live-preview "→ {slug}.<ROOT_DOMAIN>" hint. Trailing collision
// suffix is added server-side; the preview here is best-effort.
export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
