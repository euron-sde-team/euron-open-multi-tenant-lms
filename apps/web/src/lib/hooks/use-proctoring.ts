"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { testSeriesClientApi } from "@/lib/api/test-series";

export interface ProctoringConfig {
  enabled: boolean;
  camera: boolean;
  mic: boolean;
  fullscreen: boolean;
  blockCopyPaste: boolean;
  maxTabSwitches: number | null;
  action: "WARN" | "AUTO_SUBMIT";
  /**
   * Detect an extended desktop / second screen (projector, mirrored display).
   * Browsers cannot enumerate arbitrary USB peripherals from the sandbox, so
   * "external device" enforcement is limited to extra displays + focus loss.
   * Defaults on when proctoring is enabled.
   */
  blockExternalDisplay?: boolean;
  /**
   * How many warnings a learner gets before AUTO_SUBMIT enforcement kicks in.
   * Default 2 (i.e. the third violation ends the test when action=AUTO_SUBMIT).
   */
  maxWarnings?: number;
}

interface UseProctoringOpts {
  attemptId: string;
  /** enabled AND the attempt is live (status IN_PROGRESS). */
  active: boolean;
  config: ProctoringConfig;
  /** Show a non-blocking warning to the student. */
  onWarn: (message: string) => void;
  /** Called once when the configured limit is exceeded and action=AUTO_SUBMIT. */
  onAutoSubmit: () => void;
}

/**
 * Lightweight, client-side test proctoring. All detection runs in the browser
 *, no video frames are processed or uploaded, so it adds almost no load. Each
 * violation is POSTed to the existing `/proctoring-event` endpoint, which keeps
 * the authoritative tab-switch count and tells us when a limit is exceeded.
 *
 * Camera/mic, when required, are requested once for a permission + liveness
 * check (track `ended`/`mute` → FACE_LOST); the stream is never recorded.
 */
export function useProctoring({
  attemptId,
  active,
  config,
  onWarn,
  onAutoSubmit,
}: UseProctoringOpts) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // Bumped by retryMedia() to ask for camera/mic again.
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const tabSwitchRef = useRef(0);
  const submittedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep latest callbacks without re-subscribing listeners every render.
  const onWarnRef = useRef(onWarn);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onWarnRef.current = onWarn;
  onAutoSubmitRef.current = onAutoSubmit;

  const report = useCallback(
    async (type: string, extra?: { count?: number; detail?: string }) => {
      try {
        const res = await testSeriesClientApi.recordProctoringEvent(attemptId, {
          type,
          ...extra,
        });
        if (typeof res?.tabSwitchCount === "number") {
          setTabSwitchCount(res.tabSwitchCount);
        }
        if (res?.limitExceeded && !submittedRef.current) {
          if (config.action === "AUTO_SUBMIT") {
            submittedRef.current = true;
            onAutoSubmitRef.current();
          } else {
            onWarnRef.current(
              `You have left the test ${res.tabSwitchCount} times. This is recorded for review.`
            );
          }
        }
      } catch {
        // best-effort, never block the attempt on a proctoring report failure
      }
    },
    [attemptId, config.action]
  );

  // Unified "N warnings then enforce" model. Every flagged violation
  // (external display, fullscreen exit, focus loss…) increments a strike,
  // shows "Warning X of N", and is recorded server-side. Once strikes exceed
  // the allowance, an AUTO_SUBMIT-configured test ends; otherwise it keeps
  // warning. Tab-switch counting still also honours the server limit.
  const strikesRef = useRef(0);
  const maxWarnings =
    typeof config.maxWarnings === "number" && config.maxWarnings >= 0
      ? config.maxWarnings
      : 2;
  const escalate = useCallback(
    (type: string, baseMessage: string, extra?: { detail?: string }) => {
      strikesRef.current += 1;
      const n = strikesRef.current;
      void report(type, { count: n, ...extra });
      if (n > maxWarnings && !submittedRef.current) {
        if (config.action === "AUTO_SUBMIT") {
          submittedRef.current = true;
          onWarnRef.current("Proctoring limit reached, your test is being submitted.");
          onAutoSubmitRef.current();
          return;
        }
        onWarnRef.current(`${baseMessage} (final warning, this is recorded).`);
        return;
      }
      onWarnRef.current(`${baseMessage} Warning ${Math.min(n, maxWarnings)} of ${maxWarnings}.`);
    },
    [report, maxWarnings, config.action]
  );

  const requestFullscreen = useCallback(() => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const fn = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (fn) void fn.call(el).catch(() => undefined);
  }, []);

  // --- Tab switch / window blur ------------------------------------------
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        tabSwitchRef.current += 1;
        escalate("TAB_SWITCH", "Leaving the test screen is not allowed.");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, escalate]);

  // --- Fullscreen enforcement --------------------------------------------
  useEffect(() => {
    if (!active || !config.fullscreen) return;
    const onChange = () => {
      if (!document.fullscreenElement) {
        escalate("FULLSCREEN_EXIT", "Please stay in fullscreen for this proctored test.");
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [active, config.fullscreen, escalate]);

  // --- External display / projector detection ----------------------------
  // `screen.isExtended` is true when more than one monitor is connected. A
  // projector or second screen connecting mid-test flips it; we warn once per
  // transition into the extended state. (Browsers can't see USB peripherals,
  // so this is the enforceable subset of "external devices".)
  useEffect(() => {
    if (!active || config.blockExternalDisplay === false) return;
    const scr = typeof window !== "undefined" ? (window.screen as Screen & { isExtended?: boolean }) : undefined;
    if (!scr || typeof scr.isExtended === "undefined") return; // unsupported browser
    let wasExtended = false;
    const check = () => {
      const extended = Boolean((window.screen as Screen & { isExtended?: boolean }).isExtended);
      if (extended && !wasExtended) {
        escalate(
          "EXTERNAL_DISPLAY",
          "An external display was detected. Disconnect projectors / second monitors."
        );
      }
      wasExtended = extended;
    };
    check();
    // Re-check on resize (a display connect/disconnect fires resize) + a slow poll.
    window.addEventListener("resize", check);
    const id = window.setInterval(check, 5000);
    return () => {
      window.removeEventListener("resize", check);
      window.clearInterval(id);
    };
  }, [active, config.blockExternalDisplay, escalate]);

  // --- Copy / paste / right-click block ----------------------------------
  useEffect(() => {
    if (!active || !config.blockCopyPaste) return;
    const block = (type: string) => (e: Event) => {
      e.preventDefault();
      void report(type);
    };
    const onCopy = block("COPY");
    const onPaste = block("PASTE");
    const onCut = block("COPY");
    const onContext = block("RIGHT_CLICK");
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("cut", onCut);
    document.addEventListener("contextmenu", onContext);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onContext);
    };
  }, [active, config.blockCopyPaste, report]);

  // --- Camera / mic permission + liveness --------------------------------
  //
  // A required device that is refused or switched off is a violation, not a
  // notice: the player blocks the questions while `mediaError` is set, and it
  // counts as a strike, so an AUTO_SUBMIT test ends if it keeps happening.
  // (It used to be a toast plus a log line, and the student carried on.)
  useEffect(() => {
    if (!active || (!config.camera && !config.mic)) return;
    let cancelled = false;
    const what =
      config.camera && config.mic ? "Camera & microphone" : config.camera ? "Camera" : "Microphone";
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      setMediaError("This device/browser can't provide the required camera or mic.");
      return;
    }
    md.getUserMedia({ video: config.camera, audio: config.mic })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setMediaError(null);
        stream.getTracks().forEach((track) => {
          track.addEventListener("ended", () => {
            if (cancelled) return;
            setMediaError(`${what} was turned off. Turn it back on to continue the test.`);
            escalate("FACE_LOST", `${what} was turned off.`, { detail: track.kind });
          });
          track.addEventListener("mute", () => void report("FACE_LOST", { detail: `${track.kind}-muted` }));
        });
      })
      .catch(() => {
        if (cancelled) return;
        setMediaError(`${what} access is required for this test.`);
        escalate("FACE_LOST", `${what} access was denied.`, { detail: "permission-denied" });
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active, config.camera, config.mic, report, escalate, mediaAttempt]);

  /** Ask for camera/mic again (from a click, after the student re-allows it). */
  const retryMedia = useCallback(() => setMediaAttempt((n) => n + 1), []);

  return { tabSwitchCount, mediaError, requestFullscreen, retryMedia };
}
