"use client";

import { Button, Input, Label } from "@open-mtlms/core";
import { ArrowRight, Globe, Sparkles } from "lucide-react";

import { slugifyOrgName } from "@/stores/onboarding-quiz-store";

interface Props {
  /** Optional first name from signup, e.g. "Rahul", for a personal greeting. */
  firstName?: string;
  orgName: string;
  onChange: (name: string) => void;
  onContinue: () => void;
  rootHost: string;
}

// First step the user sees post-signup. Folds the welcome greeting + the
// org-name capture into one screen, no separate Welcome step in front of
// it. Big input, live subdomain preview. Submission happens after the quiz.
export function OrgNameStep({
  firstName,
  orgName,
  onChange,
  onContinue,
  rootHost,
}: Props) {
  const slug = slugifyOrgName(orgName);
  const previewSlug = slug || "your-academy";
  const canContinue = orgName.trim().length >= 2;
  const greeting = firstName ? `Welcome, ${firstName}` : "Welcome";

  return (
    <div className="flex w-full flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Animated sparkle badge */}
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 text-primary ring-1 ring-primary/15 shadow-sm shadow-primary/10">
        <Sparkles className="h-5 w-5 animate-float" />
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
        {greeting}
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        What's your academy called?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        This is your brand and your subdomain. You can change it any time
        from settings.
      </p>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canContinue) onContinue();
        }}
      >
        <div className="space-y-1.5">
          <Label
            htmlFor="org-name"
            className="text-xs font-semibold uppercase tracking-wider text-foreground/60"
          >
            Academy name
          </Label>
          <Input
            id="org-name"
            type="text"
            value={orgName}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Rahul's Coding Academy"
            required
            minLength={2}
            className="h-12 rounded-xl border-border/60 px-4 text-base shadow-sm transition-all duration-200 focus-visible:border-primary/50 focus-visible:shadow-md focus-visible:shadow-primary/10"
            autoFocus
          />
        </div>

        {/* Live URL preview, small status dot pulses while user types */}
        <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] p-4 transition-all duration-300">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Globe className="h-3 w-3" />
            Your live URL will be
            <span className="ml-auto flex items-center gap-1.5">
              <span
                className={
                  canContinue
                    ? "h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                    : "h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                }
              />
              <span className={canContinue ? "text-emerald-600 dark:text-emerald-400" : ""}>
                {canContinue ? "available" : "-"}
              </span>
            </span>
          </div>
          <div className="mt-1.5 break-all font-mono text-sm font-semibold text-foreground sm:text-base">
            <span
              key={previewSlug}
              className="inline-block animate-in fade-in slide-in-from-left-1 duration-200 text-primary"
            >
              {previewSlug}
            </span>
            <span className="text-muted-foreground">.{rootHost}</span>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            disabled={!canContinue}
            className="group h-11 rounded-xl px-6 text-sm font-medium shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 disabled:shadow-none"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-disabled:transform-none" />
          </Button>
        </div>
      </form>
    </div>
  );
}
