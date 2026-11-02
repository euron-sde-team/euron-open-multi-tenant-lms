"use client";

import { Button } from "@open-mtlms/core";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface ModuleIntermissionProps {
  finishedOrdinal: number;
  nextOrdinal: number;
  totalModules: number;
  nextSectionName: string;
  nextQuestionCount: number;
  nextDurationSec: number;
  onContinue: () => void;
}

const AUTO_CONTINUE_SEC = 8;

/**
 * Full-screen interstitial between adaptive modules. Informational only: the
 * next module's server-side timer is ALREADY running when this shows, so it
 * auto-continues and says so explicitly.
 */
export function ModuleIntermission({
  finishedOrdinal,
  nextOrdinal,
  totalModules,
  nextSectionName,
  nextQuestionCount,
  nextDurationSec,
  onContinue,
}: ModuleIntermissionProps) {
  const [countdown, setCountdown] = useState(AUTO_CONTINUE_SEC);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          onContinue();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="bg-background/95 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card border-border w-full max-w-md rounded-xl border p-8 text-center shadow-xl">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className="text-foreground mt-4 text-xl font-bold">
          Module {finishedOrdinal} complete
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Up next: Module {nextOrdinal} of {totalModules}
          {nextSectionName ? ` · ${nextSectionName}` : ""}
        </p>
        <div className="text-muted-foreground mt-4 flex items-center justify-center gap-4 text-sm">
          <span>{nextQuestionCount} questions</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {Math.round(nextDurationSec / 60)} min
          </span>
        </div>
        <p className="text-destructive mt-4 text-xs font-medium">
          The next module&apos;s timer has already started.
        </p>
        <Button className="mt-5 w-full" onClick={onContinue}>
          Continue now
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <p className="text-muted-foreground mt-2 text-xs">
          Continuing automatically in {countdown}s
        </p>
      </div>
    </div>
  );
}
