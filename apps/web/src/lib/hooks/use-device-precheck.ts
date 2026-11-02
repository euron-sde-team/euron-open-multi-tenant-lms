"use client";

import { useCallback, useEffect, useState } from "react";

export type DevicePrecheckStatus =
  /** Nothing required, or access already granted. */
  | "granted"
  /** Required, not asked yet (or the browser will ask on click). */
  | "needed"
  | "checking"
  /** The student (or browser settings) refused. */
  | "denied"
  /** No camera / mic on this device, or the browser can't provide one. */
  | "unavailable";

/**
 * Camera / microphone permission, checked on the instructions screen BEFORE an
 * attempt exists.
 *
 * WHY: the player used to ask only after the attempt was created, the timer
 * was already running, and a student who clicked "Block" got a toast and took
 * the test anyway (tenant ticket, Skilldunia 2026-10-18). Asking here, with the
 * Start button gated on the answer, means a proctored test can't begin without
 * the devices it requires.
 *
 * The stream is opened only to obtain the permission and is stopped at once;
 * nothing is recorded. The player re-opens it for the liveness check.
 */
export function useDevicePrecheck(required: { camera: boolean; mic: boolean }) {
  const needsAny = required.camera || required.mic;
  const [status, setStatus] = useState<DevicePrecheckStatus>(needsAny ? "needed" : "granted");
  const [message, setMessage] = useState<string | null>(null);

  const what =
    required.camera && required.mic
      ? "camera and microphone"
      : required.camera
        ? "camera"
        : "microphone";

  // If the browser already remembers a decision, reflect it without a prompt,
  // and follow changes the student makes in site settings while on this page.
  useEffect(() => {
    if (!needsAny || typeof navigator === "undefined" || !navigator.permissions?.query) return;
    const names: PermissionName[] = [
      ...(required.camera ? (["camera"] as PermissionName[]) : []),
      ...(required.mic ? (["microphone"] as PermissionName[]) : []),
    ];
    let cancelled = false;
    const statuses: PermissionStatus[] = [];
    const evaluate = () => {
      if (cancelled || statuses.length !== names.length) return;
      if (statuses.every((s) => s.state === "granted")) {
        setStatus("granted");
        setMessage(null);
      } else if (statuses.some((s) => s.state === "denied")) {
        setStatus("denied");
        setMessage(blockedMessage(what));
      } else {
        setStatus((prev) => (prev === "granted" || prev === "denied" ? "needed" : prev));
      }
    };
    Promise.all(names.map((name) => navigator.permissions.query({ name })))
      .then((results) => {
        statuses.push(...results);
        results.forEach((s) => (s.onchange = evaluate));
        evaluate();
      })
      // Firefox/Safari may not support querying these names; the click still works.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      statuses.forEach((s) => (s.onchange = null));
    };
  }, [needsAny, required.camera, required.mic, what]);

  /** Ask for access. Must run from a click so the browser shows its prompt. */
  const request = useCallback(async (): Promise<boolean> => {
    if (!needsAny) return true;
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      setStatus("unavailable");
      setMessage(`This browser can't provide a ${what}. Please use the latest Chrome, Edge or Safari.`);
      return false;
    }
    setStatus("checking");
    try {
      const stream = await md.getUserMedia({ video: required.camera, audio: required.mic });
      stream.getTracks().forEach((t) => t.stop());
      setStatus("granted");
      setMessage(null);
      return true;
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        setStatus("unavailable");
        setMessage(`No ${what} was found on this device. Connect one and try again.`);
      } else if (name === "NotReadableError") {
        setStatus("unavailable");
        setMessage(`Your ${what} is being used by another app. Close it and try again.`);
      } else {
        setStatus("denied");
        setMessage(blockedMessage(what));
      }
      return false;
    }
  }, [needsAny, required.camera, required.mic, what]);

  return { status, message, request, what, required: needsAny };
}

function blockedMessage(what: string): string {
  return `Access to your ${what} is blocked. Click the lock icon next to the website address, allow ${what} access, then click "Try again".`;
}
