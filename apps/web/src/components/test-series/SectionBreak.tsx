"use client";

import { Button } from "@open-mtlms/core";
import { Coffee, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface SectionBreakProps {
  /** ISO instant the break auto-ends (server-authoritative). */
  breakEndsAt: string | null;
  /** Name of the section that starts after the break (e.g. "Math"). */
  nextSectionName: string;
  /** Called when the learner clicks "Resume" or the timer reaches zero. */
  onResume: () => void;
  /** True while the resume request is in flight. */
  resuming?: boolean;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * Full-screen inter-section break (Digital-SAT style). The 10-minute clock is
 * server-authoritative, `breakEndsAt` is the source of truth, so a refresh or
 * reconnect resumes the same countdown. The learner may take the break or
 * proceed early; when the timer elapses we auto-resume the next section.
 */
export function SectionBreak({
  breakEndsAt,
  nextSectionName,
  onResume,
  resuming = false,
}: SectionBreakProps) {
  const endMs = breakEndsAt ? new Date(breakEndsAt).getTime() : Date.now();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((endMs - Date.now()) / 1000))
  );
  const [autoFired, setAutoFired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0 && !autoFired) {
        setAutoFired(true);
        onResume();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endMs]);

  return (
    <div
      className="bg-background fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-auto grid w-full max-w-4xl gap-8 md:grid-cols-2 md:items-center">
        {/* Left: countdown + action */}
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 text-primary mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <Coffee className="h-7 w-7" />
          </div>
          <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
            Remaining break time
          </p>
          <div className="text-foreground my-3 font-mono text-6xl font-bold tabular-nums">
            {fmt(remaining)}
          </div>
          <Button
            size="lg"
            className="mt-2 min-w-[200px]"
            onClick={onResume}
            disabled={resuming}
          >
            {resuming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resume testing now
          </Button>
          <p className="text-muted-foreground mt-3 max-w-xs text-xs">
            You can take the full break or proceed whenever you&apos;re ready.
            {nextSectionName ? ` Next up: ${nextSectionName}.` : ""} When the
            timer ends, the next section starts automatically.
          </p>
        </div>

        {/* Right: break rules (Bluebook parity) */}
        <div className="border-border bg-card rounded-xl border p-6 text-left shadow-sm">
          <h2 className="text-foreground text-lg font-bold">Take a break</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Do not close this window or refresh during the break, your timer
            keeps running on the server.
          </p>
          <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
            <li>1. Do not exit the test or close your browser.</li>
            <li>2. Do not access phones, notes, or the internet.</li>
            <li>3. The clock continues even if you step away.</li>
            <li>
              4. When the break ends, a <strong>Resume</strong> happens
              automatically and the next section begins.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
