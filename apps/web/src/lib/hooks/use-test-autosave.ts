"use client";

import { useCallback, useEffect, useRef } from "react";
import { testSeriesClientApi } from "@/lib/api/test-series";

interface PendingPatch {
  question_id: string;
  answer: unknown;
  marked_for_review?: boolean;
  time_spent_sec?: number;
}

interface UseTestAutosaveOptions {
  attemptId: string | null;
  /** Debounce window in ms */
  debounceMs?: number;
  /** Called when a flush succeeds (for UI status) */
  onFlush?: () => void;
  /** Called when a flush fails, caller may show a toast */
  onError?: (err: unknown) => void;
  /**
   * Called when a patch is rejected as stale (HTTP 400, e.g. the answer
   * belongs to a module the server has already advanced past). This is benign:
   * the queued answer is dropped (never retried) and the caller can re-sync the
   * attempt state. No scary error toast.
   */
  onStale?: () => void;
}

function statusOf(err: unknown): number | undefined {
  return (
    (err as { status?: number })?.status ??
    (err as { response?: { status?: number } })?.response?.status
  );
}

export function useTestAutosave({
  attemptId,
  debounceMs = 1500,
  onFlush,
  onError,
  onStale,
}: UseTestAutosaveOptions) {
  const queueRef = useRef<Map<string, PendingPatch>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tail of the in-flight flush chain. `flush()` chains onto this so a caller
  // can `await` it and be guaranteed every prior patch has settled, critical
  // before submitting a module so a previous module's answer can never land
  // after the server has advanced (which the server rejects with a 400).
  const tailRef = useRef<Promise<void>>(Promise.resolve());

  const drainOnce = useCallback(async () => {
    if (!attemptId) return;
    if (queueRef.current.size === 0) return;

    const batch = Array.from(queueRef.current.values());
    queueRef.current.clear();

    try {
      // Send patches sequentially, small payloads, simple ordering
      for (const patch of batch) {
        await testSeriesClientApi.patchAnswer(attemptId, patch);
      }
      onFlush?.();
    } catch (err) {
      const status = statusOf(err);
      // 401/403: auth gone, don't infinite-retry. Drop the queue and let the
      // user know. They can refresh after re-logging-in to resume.
      if (status === 401 || status === 403) {
        onError?.(err);
        return;
      }
      // 400: the patch is stale (question not in the active module, the module
      // already advanced). Re-queueing would loop forever against an advanced
      // server, so DROP it and signal the caller to re-sync instead of alarming
      // the learner with a red error.
      if (status === 400) {
        onStale?.();
        return;
      }
      // Other errors (5xx, network): re-queue for retry
      for (const p of batch) {
        if (!queueRef.current.has(p.question_id)) {
          queueRef.current.set(p.question_id, p);
        }
      }
      onError?.(err);
    }
  }, [attemptId, onFlush, onError, onStale]);

  // Serialize flushes onto a single chain so concurrent callers never overlap
  // and `await flush()` resolves only once this flush's patches have settled.
  const flush = useCallback(async (): Promise<void> => {
    const next = tailRef.current.then(() => drainOnce());
    // Keep the chain alive even if a drain throws (it shouldn't, drainOnce
    // swallows its own errors, but be defensive).
    tailRef.current = next.catch(() => undefined);
    return next;
  }, [drainOnce]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, debounceMs);
  }, [flush, debounceMs]);

  const queue = useCallback(
    (patch: PendingPatch) => {
      // Coalesce: only the latest patch per question_id is sent
      queueRef.current.set(patch.question_id, patch);
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const flushNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Drain fully: a 5xx retry may re-queue, so flush until the queue is empty
    // (bounded so a persistent failure can't spin forever).
    for (let i = 0; i < 5 && queueRef.current.size > 0; i++) {
      await flush();
    }
    // Always await the tail so any in-flight flush has settled before we return.
    await tailRef.current;
  }, [flush]);

  // Best-effort flush before unload
  useEffect(() => {
    const handler = () => {
      if (queueRef.current.size > 0) {
        void flush();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { queue, flushNow };
}
