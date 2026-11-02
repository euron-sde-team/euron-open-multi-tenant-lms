"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

import { cn } from "@open-mtlms/core";

import type {
  PageCreationStatus,
  PageProgress,
} from "@/components/pages/onboarding-wizard/types";

import type { AutoProvisionPhase } from "./use-auto-provision-academy";

interface Props {
  /** Phase reported by useAutoProvisionAcademy (driven by real API events). */
  phase: AutoProvisionPhase;
  /** Per-page progress entries. Empty until the orchestrator initializes. */
  pageProgresses: PageProgress[];
  /** True once the backend provisioning call has resolved (tenant exists). */
  backendDone: boolean;
  orgSlug?: string | null;
  rootHost: string;
}

// Status of one phase-row in the milestone list.
type RowStatus = "done" | "active" | "pending";

interface MilestoneRow {
  id: string;
  label: string;
  status: RowStatus;
  /** Optional sub-text (e.g. live URL preview, count of pages). */
  detail?: string;
}

function statusOfPhase(
  current: AutoProvisionPhase,
  target: AutoProvisionPhase,
  order: AutoProvisionPhase[],
): RowStatus {
  const currentIdx = order.indexOf(current);
  const targetIdx = order.indexOf(target);
  if (currentIdx === -1) return "pending";
  if (targetIdx < currentIdx) return "done";
  if (targetIdx === currentIdx) return "active";
  return "pending";
}

const PHASE_ORDER: AutoProvisionPhase[] = [
  "idle",
  "preparing",
  "creating",
  "ai-generating",
  "publishing",
  "saving-org",
  "done",
];

// Page-status → human label
const PAGE_STATUS_META: Record<
  PageCreationStatus,
  { label: string; tone: "neutral" | "active" | "done" | "error" }
> = {
  pending: { label: "Queued", tone: "neutral" },
  creating: { label: "Creating page", tone: "active" },
  created: { label: "Created", tone: "done" },
  "ai-generating": { label: "AI is writing content", tone: "active" },
  "ai-done": { label: "Content ready", tone: "done" },
  "ai-failed": { label: "Content (template fallback)", tone: "done" },
  publishing: { label: "Publishing", tone: "active" },
  published: { label: "Live", tone: "done" },
  error: { label: "Failed", tone: "error" },
};

// Per-page friendly label rotated based on slug (instead of generic "page X").
function pageLabel(slug: string, fallback: string): string {
  const map: Record<string, string> = {
    home: "Homepage",
    about: "About Us",
    contact: "Contact Us",
    faq: "FAQ",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    login: "Login",
    profile: "Profile",
  };
  return map[slug] ?? fallback;
}

// Rotating motivational lines that play under the hero. Tuned to feel
// like a mentor cheering you on, keep these short, present-tense, and
// emotionally resonant. Order matters: starts with the WHY, ends with
// the YOU.
const MOTIVATIONAL_LINES = [
  "You're seconds away from launching your education business.",
  "Crafting a brand that students will recognise from anywhere.",
  "Spinning up a real subdomain, yours, instantly.",
  "Writing your homepage with a tone that sounds like you.",
  "Designing pages students will love to scroll.",
  "One last polish… your academy is almost live.",
];

export function BuildSequence({
  phase,
  pageProgresses,
  backendDone,
  orgSlug,
  rootHost,
}: Props) {
  const slugLine = orgSlug
    ? `${orgSlug}.${rootHost}`
    : `your-academy.${rootHost}`;

  // Rotate the subhead copy every ~2.6s while building. Stops on "done"
  // so the final state doesn't keep cycling. Index uses modulo so we
  // never run past the array.
  const [tagIdx, setTagIdx] = useState(0);
  useEffect(() => {
    if (phase === "done") return;
    const id = setInterval(
      () => setTagIdx((i) => (i + 1) % MOTIVATIONAL_LINES.length),
      2600,
    );
    return () => clearInterval(id);
  }, [phase]);

  // Top-level milestones, driven by the orchestrator's phase.
  const milestones = useMemo<MilestoneRow[]>(() => {
    return [
      {
        id: "subdomain",
        label: "Reserved your subdomain",
        status: backendDone ? "done" : "active",
        detail: slugLine,
      },
      {
        id: "plan",
        label: "Setting up your platform",
        status: backendDone ? "done" : "pending",
      },
      {
        id: "create",
        label: "Creating your pages",
        status: statusOfPhase(phase, "creating", PHASE_ORDER),
      },
      {
        id: "ai",
        label: "AI is designing your homepage, about, FAQ, terms, privacy",
        status: statusOfPhase(phase, "ai-generating", PHASE_ORDER),
      },
      {
        id: "publish",
        label: "Publishing your academy",
        status: statusOfPhase(phase, "publishing", PHASE_ORDER),
      },
      {
        id: "finalize",
        label: "Saving your business profile",
        status: statusOfPhase(phase, "saving-org", PHASE_ORDER),
      },
    ];
  }, [phase, backendDone, slugLine]);

  // Smoothly-animated overall progress: half-credit for the active row
  // gives the bar a continuous feel instead of jumping in chunks.
  const overallPercent = useMemo(() => {
    const total = milestones.length;
    const doneCount = milestones.filter((m) => m.status === "done").length;
    const activeCount = milestones.filter((m) => m.status === "active").length;
    return Math.round(((doneCount + activeCount * 0.5) / total) * 100);
  }, [milestones]);

  const isFinalising = phase === "saving-org" || phase === "done";

  return (
    <div className="flex w-full flex-col items-center text-center animate-in fade-in duration-500">
      {/* Engineered glass-orb hero mark. A luminous accent ring orbits while
          building ("engine running"); on the brief "done" state it settles to
          the calm emerald success variant. */}
      <div
        className={cn(
          "onb-mark mb-6",
          phase === "done" && "onb-mark--success",
        )}
      >
        <span className="onb-mark-glow" aria-hidden />
        <span className="onb-mark-ring" aria-hidden />
        <div className="onb-mark-core h-[4.5rem] w-[4.5rem]">
          <Sparkles className="onb-mark-icon h-7 w-7" />
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {phase === "done"
          ? "Your academy is ready"
          : isFinalising
            ? "Almost there…"
            : "Building your academy"}
      </h1>

      {/* Rotating motivational subhead. Min-height stops layout shift as
          lines change, fade-in animates each new line. */}
      <div className="mt-3 min-h-[3.25rem] max-w-md sm:min-h-[2.5rem]">
        {phase === "done" ? (
          <p className="text-sm text-muted-foreground sm:text-base">
            Everything's set up, your students can start enrolling.
          </p>
        ) : (
          <p
            key={tagIdx}
            className="text-sm text-muted-foreground sm:text-base animate-in fade-in slide-in-from-bottom-1 duration-500"
          >
            {MOTIVATIONAL_LINES[tagIdx]}
          </p>
        )}
      </div>

      {/* Top-level milestone list */}
      <div className="mt-8 w-full max-w-xl space-y-2">
        {milestones.map((m, idx) => (
          <MilestoneRowView key={m.id} row={m} delayMs={idx * 60} />
        ))}
      </div>

      {/* Per-page progress grid, appears once page creation has started */}
      {pageProgresses.length > 0 && (
        <div className="mt-8 w-full">
          <div className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pages
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {pageProgresses.map((pp, idx) => {
              const meta = PAGE_STATUS_META[pp.status];
              const isActive =
                pp.status === "creating" ||
                pp.status === "ai-generating" ||
                pp.status === "publishing";
              const isDone =
                pp.status === "ai-done" ||
                pp.status === "published" ||
                pp.status === "ai-failed";
              const isError = pp.status === "error";
              return (
                <div
                  key={pp.slug}
                  style={{
                    animationDelay: `${idx * 30}ms`,
                    animationFillMode: "both",
                  }}
                  className={cn(
                    "relative overflow-hidden rounded-lg border p-2.5 text-left animate-in fade-in slide-in-from-bottom-1 duration-300",
                    "transition-all duration-200",
                    isActive &&
                      "border-primary/40 bg-primary/[0.04] shadow-sm shadow-primary/10",
                    isDone &&
                      "border-emerald-500/30 bg-emerald-500/[0.04]",
                    isError && "border-destructive/30 bg-destructive/[0.04]",
                    !isActive &&
                      !isDone &&
                      !isError &&
                      "border-border/40 bg-muted/20",
                  )}
                >
                  {/* Active rows shimmer to convey "right now" */}
                  {isActive && (
                    <span
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,transparent_30%,hsl(var(--primary)/0.08)_50%,transparent_70%,transparent_100%)] bg-[length:200%_100%] animate-shimmer"
                      aria-hidden
                    />
                  )}
                  <p
                    className={cn(
                      "relative mb-1 truncate text-xs font-semibold",
                      isActive || isDone
                        ? "text-foreground"
                        : "text-muted-foreground/80",
                    )}
                  >
                    {pageLabel(pp.slug, pp.title)}
                  </p>
                  <div
                    className={cn(
                      "relative inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      meta.tone === "neutral" &&
                        "bg-muted text-muted-foreground",
                      meta.tone === "active" && "bg-primary/15 text-primary",
                      meta.tone === "done" &&
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                      meta.tone === "error" &&
                        "bg-destructive/15 text-destructive",
                    )}
                  >
                    {meta.tone === "active" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : meta.tone === "done" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                    {meta.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Animated overall progress bar */}
      <div className="mt-8 w-full max-w-xl">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-[length:200%_100%] transition-all duration-700 ease-out"
            style={{
              width: `${overallPercent}%`,
              animation: phase !== "done" ? "gradient-shift 8s ease-in-out infinite" : undefined,
            }}
          />
          {phase !== "done" && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(110deg,transparent_0%,transparent_40%,hsl(var(--primary-foreground)/0.35)_50%,transparent_60%,transparent_100%)] bg-[length:200%_100%] animate-shimmer"
              style={{ width: `${overallPercent}%` }}
              aria-hidden
            />
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums font-medium">
            {overallPercent}% complete
          </span>
          {pageProgresses.length > 0 && (
            <span className="tabular-nums">
              {
                pageProgresses.filter(
                  (p) =>
                    p.status === "ai-done" ||
                    p.status === "ai-failed" ||
                    p.status === "published",
                ).length
              }{" "}
              / {pageProgresses.length} pages ready
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MilestoneRowView({
  row,
  delayMs,
}: {
  row: MilestoneRow;
  delayMs: number;
}) {
  const { status, label, detail } = row;
  return (
    <div
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "both" }}
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left animate-in fade-in slide-in-from-left-1 duration-400",
        "transition-all duration-300",
        status === "done" && "border-emerald-500/25 bg-emerald-500/[0.04]",
        status === "active" &&
          "border-primary/60 bg-primary/[0.06] shadow-sm shadow-primary/15",
        status === "pending" && "border-border/40 bg-muted/20 opacity-70",
      )}
    >
      {/* Active row shimmer */}
      {status === "active" && (
        <span
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,transparent_35%,hsl(var(--primary)/0.07)_50%,transparent_65%,transparent_100%)] bg-[length:200%_100%] animate-shimmer"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300",
          status === "done" && "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
          status === "active" && "bg-primary/20 text-primary",
          status === "pending" && "bg-muted text-muted-foreground/40",
        )}
      >
        {status === "done" ? (
          <Check className="h-4 w-4 animate-in zoom-in duration-300" />
        ) : status === "active" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span className="block h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      <div className="relative flex-1 min-w-0">
        <div
          className={cn(
            "text-sm font-medium transition-colors leading-tight",
            status !== "pending"
              ? "text-foreground"
              : "text-muted-foreground/70",
          )}
        >
          {label}
        </div>
        {detail && status !== "pending" && (
          <div className="mt-0.5 truncate font-mono text-[11px] text-primary/80">
            {detail}
          </div>
        )}
      </div>
      {status === "active" && (
        <span className="relative shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Working
        </span>
      )}
      {status === "done" && (
        <span className="relative shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Done
        </span>
      )}
    </div>
  );
}
