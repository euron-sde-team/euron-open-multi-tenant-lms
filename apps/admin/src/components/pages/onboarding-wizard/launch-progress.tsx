"use client";

import {
  AlertCircle,
  Check,
  FileText,
  Globe,
  Loader2,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { LaunchPhase, PageProgress } from "./types";

interface LaunchProgressProps {
  pageProgresses: PageProgress[];
  launchPhase: LaunchPhase;
  launchError: string | null;
}

const PHASE_CONFIG: Record<
  LaunchPhase,
  { label: string; subtitle: string; icon: React.ReactNode; color: string }
> = {
  idle: { label: "", subtitle: "", icon: null, color: "" },
  creating: {
    label: "Building Your Pages",
    subtitle: "Setting up the foundation for your website",
    icon: <Zap className="h-6 w-6" />,
    color: "text-blue-500",
  },
  "ai-generating": {
    label: "AI is Crafting Content",
    subtitle: "Generating unique, tailored content for each page",
    icon: <Sparkles className="h-6 w-6" />,
    color: "text-amber-500",
  },
  publishing: {
    label: "Going Live",
    subtitle: "Publishing your pages to the world",
    icon: <Upload className="h-6 w-6" />,
    color: "text-emerald-500",
  },
  done: {
    label: "All Done!",
    subtitle: "Your website is ready",
    icon: <Check className="h-6 w-6" />,
    color: "text-emerald-500",
  },
  error: {
    label: "Something Went Wrong",
    subtitle: "Some pages couldn't be processed",
    icon: <AlertCircle className="h-6 w-6" />,
    color: "text-destructive",
  },
};

function getStatusMeta(status: string) {
  switch (status) {
    case "creating":
      return {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        label: "Creating",
        bg: "bg-blue-500/10",
        text: "text-blue-600 dark:text-blue-400",
        ring: "ring-blue-500/20",
      };
    case "ai-generating":
      return {
        icon: <Sparkles className="h-3.5 w-3.5 animate-pulse" />,
        label: "Generating",
        bg: "bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-400",
        ring: "ring-amber-500/20",
      };
    case "publishing":
      return {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        label: "Publishing",
        bg: "bg-emerald-500/10",
        text: "text-emerald-600 dark:text-emerald-400",
        ring: "ring-emerald-500/20",
      };
    case "created":
    case "ai-done":
      return {
        icon: <Check className="h-3.5 w-3.5" />,
        label: status === "created" ? "Created" : "Content Ready",
        bg: "bg-blue-500/10",
        text: "text-blue-600 dark:text-blue-400",
        ring: "ring-blue-500/20",
      };
    case "published":
      return {
        icon: <Globe className="h-3.5 w-3.5" />,
        label: "Live",
        bg: "bg-emerald-500/10",
        text: "text-emerald-600 dark:text-emerald-400",
        ring: "ring-emerald-500/20",
      };
    case "ai-failed":
      return {
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        label: "Partial",
        bg: "bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-400",
        ring: "ring-amber-500/20",
      };
    case "error":
      return {
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        label: "Failed",
        bg: "bg-destructive/10",
        text: "text-destructive",
        ring: "ring-destructive/20",
      };
    default:
      return {
        icon: <FileText className="h-3.5 w-3.5" />,
        label: "Queued",
        bg: "bg-muted",
        text: "text-muted-foreground",
        ring: "ring-border",
      };
  }
}

export function LaunchProgress({ pageProgresses, launchPhase, launchError }: LaunchProgressProps) {
  const completedCount = pageProgresses.filter(
    (p) => p.status === "published" || p.status === "ai-done" || p.status === "ai-failed",
  ).length;
  const total = pageProgresses.length;
  const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const phaseConfig = PHASE_CONFIG[launchPhase];

  return (
    <div className="flex min-h-[420px] flex-col items-center space-y-8 py-6">
      {/* Phase Header */}
      <div className="text-center">
        <div
          className={cn(
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
            launchPhase === "error"
              ? "bg-destructive/10"
              : launchPhase === "done"
                ? "bg-emerald-500/10"
                : "bg-primary/10",
          )}
        >
          <span className={phaseConfig.color}>
            {launchPhase === "creating" || launchPhase === "publishing" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              phaseConfig.icon
            )}
          </span>
        </div>
        <h2 className="text-lg font-bold tracking-tight">{phaseConfig.label}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{phaseConfig.subtitle}</p>
        {launchError && (
          <p className="text-destructive mt-2 text-sm">{launchError}</p>
        )}
      </div>

      {/* Progress Ring + Bar */}
      <div className="flex w-full max-w-xl flex-col items-center gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {progressPercent}%
          </span>
          <span className="text-muted-foreground">
            {completedCount}/{total} pages
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              launchPhase === "error" ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Page Cards Grid */}
      <div className="w-full">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {pageProgresses.map((pp) => {
            const meta = getStatusMeta(pp.status);
            const isActive =
              pp.status === "creating" ||
              pp.status === "ai-generating" ||
              pp.status === "publishing";
            const isDone = pp.status === "published";
            const isError = pp.status === "error";

            return (
              <div
                key={pp.slug}
                className={cn(
                  "group relative overflow-hidden rounded-xl border p-3 transition-all duration-300",
                  isActive && "ring-1 shadow-sm",
                  isActive && meta.ring,
                  isDone && "border-emerald-500/30 bg-emerald-500/5",
                  isError && "border-destructive/30 bg-destructive/5",
                  !isActive && !isDone && !isError && "border-border/60 bg-card",
                )}
              >
                {/* Active glow effect */}
                {isActive && (
                  <div className="absolute inset-0 -z-10 opacity-30">
                    <div
                      className={cn(
                        "absolute -left-4 -top-4 h-16 w-16 rounded-full blur-2xl",
                        pp.status === "creating" && "bg-blue-500",
                        pp.status === "ai-generating" && "bg-amber-500",
                        pp.status === "publishing" && "bg-emerald-500",
                      )}
                    />
                  </div>
                )}

                {/* Page title */}
                <p className="mb-2 truncate text-xs font-semibold text-foreground">
                  {pp.title}
                </p>

                {/* Status badge */}
                <div
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                    meta.bg,
                    meta.text,
                  )}
                >
                  {meta.icon}
                  {meta.label}
                </div>

                {/* Error tooltip */}
                {pp.error && (
                  <p className="mt-1.5 truncate text-[10px] text-destructive" title={pp.error}>
                    {pp.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
