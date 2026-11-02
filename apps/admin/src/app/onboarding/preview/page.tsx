"use client";

import { useState } from "react";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { BuildSequence } from "@/components/onboarding-quiz/BuildSequence";
import { RevealCelebration } from "@/components/onboarding-quiz/RevealCelebration";
import { WizardLayout } from "@/components/onboarding-quiz/WizardLayout";
import type { AutoProvisionPhase } from "@/components/onboarding-quiz/use-auto-provision-academy";
import type {
  PageCreationStatus,
  PageProgress,
} from "@/components/pages/onboarding-wizard/types";
import { ROOT_DOMAIN } from "@/lib/brand";

// ---------------------------------------------------------------------------
// DEV-ONLY visual preview for the onboarding wizard's build + reveal screens.
//
// Renders the presentational BuildSequence / RevealCelebration components with
// MOCK data so you can iterate on the UI/UX without signing up or creating a
// tenant every time. It makes ZERO API calls and touches no real state.
//
// Open at:  /onboarding/preview   (only served in development)
// ---------------------------------------------------------------------------

const ROOT_HOST = ROOT_DOMAIN;

const BUILD_PHASES: AutoProvisionPhase[] = [
  "idle",
  "preparing",
  "creating",
  "ai-generating",
  "publishing",
  "saving-org",
  "done",
];

const PHASE_ORDER = BUILD_PHASES;

const MOCK_PAGES = [
  { slug: "home", title: "Home" },
  { slug: "about", title: "About Us" },
  { slug: "contact", title: "Contact Us" },
  { slug: "faq", title: "FAQ" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "terms", title: "Terms of Service" },
  { slug: "login", title: "Login" },
  { slug: "profile", title: "Profile" },
];

// Synthesize a believable per-page progress grid for the given phase so the
// build screen looks like a real in-flight run.
function mockProgresses(phase: AutoProvisionPhase): PageProgress[] {
  if (PHASE_ORDER.indexOf(phase) < PHASE_ORDER.indexOf("creating")) return [];
  return MOCK_PAGES.map((p, i) => {
    let status: PageCreationStatus = "pending";
    if (phase === "creating") status = i < 4 ? "created" : "creating";
    else if (phase === "ai-generating")
      status = i < 3 ? "ai-done" : i < 5 ? "ai-generating" : "created";
    else if (phase === "publishing")
      status = i < 5 ? "published" : "publishing";
    else if (phase === "saving-org" || phase === "done") status = "published";
    return { slug: p.slug, title: p.title, status };
  });
}

type View = "build" | "reveal";

export default function OnboardingPreviewRoute() {
  const [view, setView] = useState<View>("build");
  const [phase, setPhase] = useState<AutoProvisionPhase>("creating");
  // Bumped each time the user (re)opens the reveal screen so the confetti
  // re-fires on demand, without remounting on every unrelated render.
  const [revealNonce, setRevealNonce] = useState(0);

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        This preview is only available in development.
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[420px_1fr]">
      <AuthBrandPanel
        headline="Let's launch your academy"
        subcopy="Answer a few quick questions and our AI picks the best template, theme, and writes every page for you."
      />

      <main className="relative flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.04] via-background to-primary/[0.06] px-4 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
        {/* ── DEV control bar ─────────────────────────────────────────── */}
        <div className="mx-auto mb-8 w-full max-w-3xl rounded-2xl border border-dashed border-primary/30 bg-card/60 p-3 backdrop-blur">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preview controls (dev only)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setView("build")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "build"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              Build screen
            </button>
            <button
              type="button"
              onClick={() => {
                setView("reveal");
                setRevealNonce((n) => n + 1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "reveal"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              Reveal screen 🎉
            </button>

            {view === "build" && (
              <>
                <span className="mx-1 h-4 w-px bg-border" />
                {BUILD_PHASES.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => setPhase(ph)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      phase === ph
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {ph}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── The actual screen under test ────────────────────────────── */}
        <div className="flex flex-1 items-start justify-center lg:items-center">
          {view === "build" ? (
            <WizardLayout stage="live">
              <BuildSequence
                phase={phase}
                pageProgresses={mockProgresses(phase)}
                orgSlug="acme-academy"
                rootHost={ROOT_HOST}
                backendDone={PHASE_ORDER.indexOf(phase) >= 1}
              />
            </WizardLayout>
          ) : (
            <WizardLayout stage="live">
              {/* key bumps on each Reveal click so the confetti re-fires. */}
              <RevealCelebration
                key={revealNonce}
                orgName="Acme Academy"
                subdomainUrl={`https://acme-academy.${ROOT_HOST}`}
                onOpenDashboard={() => {
                  // eslint-disable-next-line no-console
                  console.log("[preview] Open dashboard clicked (no-op in preview)");
                }}
              />
            </WizardLayout>
          )}
        </div>
      </main>
    </div>
  );
}
