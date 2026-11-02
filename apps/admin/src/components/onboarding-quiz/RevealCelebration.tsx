"use client";

import { Button } from "@open-mtlms/core";
import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  PartyPopper,
  Settings,
  Sparkles,
} from "lucide-react";

interface Props {
  orgName: string;
  subdomainUrl: string;
  onOpenDashboard: () => void;
}

// Quick-action cards shown under the live URL. Keeping these self-
// contained inside the file, they're presentational only and only
// rendered here.
const QUICK_ACTIONS: Array<{
  id: string;
  icon: typeof Sparkles;
  label: string;
  detail: string;
}> = [
  {
    id: "course",
    icon: BookOpen,
    label: "Polish your sample course",
    detail: "Replace placeholder content with your real curriculum.",
  },
  {
    id: "brand",
    icon: Sparkles,
    label: "Tweak your brand",
    detail: "Logo, colours, and homepage hero, yours to refine.",
  },
  {
    id: "settings",
    icon: Settings,
    label: "Wire up payments",
    detail: "Connect a payment provider to start enrolling students.",
  },
];

export function RevealCelebration({
  orgName,
  subdomainUrl,
  onOpenDashboard,
}: Props) {
  const [copied, setCopied] = useState(false);
  // Guard against double-firing in React 18 StrictMode (which mounts/
  // unmounts/remounts in dev). Without this, the page detonates two
  // confetti blasts on top of each other in dev.
  const hasFiredConfettiRef = useRef(false);

  // Fire the confetti cascade on mount: a centred burst + two side
  // cannons after a short delay. canvas-confetti renders to a transient
  // canvas appended to body that auto-cleans when the particles settle.
  useEffect(() => {
    if (hasFiredConfettiRef.current) return;
    hasFiredConfettiRef.current = true;

    const colors = [
      "#facc15", // amber
      "#22c55e", // emerald
      "#06b6d4", // cyan
      "#8b5cf6", // violet
      "#ec4899", // pink
    ];

    // Centre burst
    confetti({
      particleCount: 130,
      spread: 90,
      startVelocity: 50,
      origin: { x: 0.5, y: 0.45 },
      colors,
      scalar: 1.05,
      ticks: 220,
      gravity: 0.85,
    });

    // Left cannon
    const leftId = window.setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 70,
        startVelocity: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        ticks: 200,
      });
    }, 180);

    // Right cannon
    const rightId = window.setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 70,
        startVelocity: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        ticks: 200,
      });
    }, 320);

    // Soft "fairy dust" trickle that overlaps the next 1.5s for a
    // celebratory tail, small particles, slow gravity.
    const trickleEnd = Date.now() + 1500;
    const trickleId = window.setInterval(() => {
      if (Date.now() > trickleEnd) {
        clearInterval(trickleId);
        return;
      }
      confetti({
        particleCount: 4,
        angle: 90,
        spread: 360,
        startVelocity: 12,
        origin: { x: Math.random(), y: Math.random() * 0.4 },
        colors,
        scalar: 0.7,
        gravity: 0.4,
        ticks: 120,
      });
    }, 90);

    return () => {
      window.clearTimeout(leftId);
      window.clearTimeout(rightId);
      window.clearInterval(trickleId);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(subdomainUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked in iframes / non-secure contexts.
      // Silently fail, the URL is also visible/selectable as text.
    }
  };

  const subdomainDisplay = subdomainUrl.replace(/^https?:\/\//, "");

  return (
    <div className="flex w-full flex-col items-center text-center">
      {/* Engineered glass-orb hero mark, calm emerald "success" variant, with
          a slowly orbiting accent ring and a gently breathing icon. */}
      <div className="onb-mark onb-mark--success mb-6 animate-in zoom-in fade-in duration-500">
        <span className="onb-mark-glow" aria-hidden />
        <span className="onb-mark-ring" aria-hidden />
        <div className="onb-mark-core h-[4.75rem] w-[4.75rem]">
          <PartyPopper className="onb-mark-icon h-7 w-7" />
        </div>
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-bottom-1 duration-500">
        Your academy is live
      </div>

      {/* Org name with character-by-character entrance for that "name
          stamp" feel, uses CSS gradient text for a premium look */}
      <h1
        className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-2 duration-700"
        style={{ animationDelay: "120ms", animationFillMode: "both" }}
      >
        {orgName}
      </h1>

      <p
        className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base animate-in fade-in duration-700"
        style={{ animationDelay: "300ms", animationFillMode: "both" }}
      >
        Your homepage, sample course, and brand are all set up. Share the
        link or jump into your dashboard to keep building.
      </p>

      {/* Live URL card with pulsing status dot */}
      <div
        className="mt-7 w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-700"
        style={{ animationDelay: "400ms", animationFillMode: "both" }}
      >
        <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.06] via-emerald-500/[0.03] to-transparent p-4 shadow-sm shadow-emerald-500/10">
          {/* Decorative gradient sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl"
          />
          <div className="relative flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live at
          </div>
          <a
            href={subdomainUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative mt-1.5 inline-flex max-w-full items-center gap-1.5 break-all font-mono text-base font-semibold text-foreground transition-colors hover:text-emerald-700 sm:text-lg dark:hover:text-emerald-300"
          >
            <span className="truncate">{subdomainDisplay}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" />
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="relative mt-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy link
              </>
            )}
          </button>
        </div>
      </div>

      {/* CTAs, primary "Open dashboard", secondary "Visit academy" */}
      <div
        className="mt-6 flex w-full max-w-md flex-col gap-2.5 sm:flex-row sm:justify-center animate-in fade-in slide-in-from-bottom-2 duration-700"
        style={{ animationDelay: "500ms", animationFillMode: "both" }}
      >
        <Button
          size="lg"
          onClick={onOpenDashboard}
          className="group h-11 flex-1 rounded-xl px-6 text-sm font-medium shadow-md shadow-primary/25 transition-all duration-200 hover:shadow-lg hover:shadow-primary/35 sm:flex-initial"
        >
          Open dashboard
          <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="group h-11 flex-1 rounded-xl px-6 text-sm font-medium transition-all duration-200 hover:border-primary/40 sm:flex-initial"
        >
          <a href={subdomainUrl} target="_blank" rel="noopener noreferrer">
            Visit academy
            <ExternalLink className="ml-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        </Button>
      </div>

      {/* What's next, three quick action cards. Decorative; clicking
          "Open dashboard" is the real next step. */}
      <div
        className="mt-8 w-full max-w-xl animate-in fade-in duration-700"
        style={{ animationDelay: "650ms", animationFillMode: "both" }}
      >
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          What's next
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {QUICK_ACTIONS.map((action, idx) => (
            <div
              key={action.id}
              style={{
                animationDelay: `${700 + idx * 60}ms`,
                animationFillMode: "both",
              }}
              className="group rounded-xl border border-border/50 bg-card/50 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 animate-in fade-in slide-in-from-bottom-1 duration-500"
            >
              <div className="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <action.icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs font-semibold leading-tight text-foreground">
                {action.label}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {action.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
