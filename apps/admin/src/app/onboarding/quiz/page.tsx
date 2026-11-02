"use client";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { QuizWizard } from "@/components/onboarding-quiz/QuizWizard";
import { AuthGuard } from "@/lib/components/auth-guard";
import { PLATFORM_LOGO_URL, PLATFORM_NAME } from "@/lib/brand";

const LOGO = PLATFORM_LOGO_URL;

// Auto-provisioning quiz wizard. Lives at /onboarding/quiz, sits between the
// lean signup at /start and the populated dashboard.
//
// IMPORTANT: This page does NOT gate render on useMe.isLoading. Doing so
// caused the wizard to unmount mid-build whenever /me refetched (e.g., on
// tenant-context switch immediately after the backend created the tenant),
// losing all local state, phase, page progresses, the in-flight
// autoProvision orchestrator, and triggering an unwanted redirect to
// /dashboard with a half-provisioned tenant. AuthGuard handles initial
// auth-loading state; QuizWizard handles its own owner/me-readiness gate.
//
// "Already has a tenant" handling lives INSIDE QuizWizard, gated on
// `phase !== "wizard"` and the persisted `wizardActive` flag, so a
// mid-build remount cannot bounce the user to /dashboard.
//
// Layout: shares the same hero shell as /start (left brand panel, right
// content) so signup and quiz feel like one continuous flow.
function QuizPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[420px_1fr]">
      <AuthBrandPanel
        headline="Let's launch your academy"
        subcopy="Answer a few quick questions and our AI picks the best template, theme, and writes every page for you."
      />

      {/* Right panel, wider than the standard auth panel so the
          wizard's max-w-3xl card has room to breathe. */}
      <main className="relative flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.04] via-background to-primary/[0.06] px-4 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
        {/* Mobile-only logo header */}
        <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO}
              alt={PLATFORM_NAME}
              className="h-9 w-9 object-contain"
            />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            {PLATFORM_NAME}
          </span>
        </div>

        <div className="flex flex-1 items-start justify-center lg:items-center">
          <QuizWizard />
        </div>
      </main>
    </div>
  );
}

export default function OnboardingQuizRoute() {
  return (
    <AuthGuard>
      <QuizPage />
    </AuthGuard>
  );
}
