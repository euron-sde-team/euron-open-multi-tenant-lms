import { useCallback, useEffect, useRef, useState } from "react";

import bookAIApi, {
  type BookAIJobProgress,
  type GenerateBookContentRequest,
  type GeneratedBookContent,
} from "@/lib/api/book-ai";

export type BookAIGenerationState =
  | "idle"
  | "submitting"
  | "polling"
  | "completed"
  | "failed";

const POLL_INTERVAL_MS = 2500;

export interface UseBookAIGenerationReturn {
  state: BookAIGenerationState;
  jobId: string | null;
  progress: BookAIJobProgress | null;
  result: Partial<GeneratedBookContent> | null;
  error: string | null;
  /** True when submitting or polling (generation is in progress). */
  isActive: boolean;
  submit: (params: GenerateBookContentRequest) => Promise<void>;
  reset: () => void;
}

export function useBookAIGeneration(): UseBookAIGenerationReturn {
  const [state, setState] = useState<BookAIGenerationState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BookAIJobProgress | null>(null);
  const [result, setResult] = useState<Partial<GeneratedBookContent> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setState("idle");
    setJobId(null);
    setProgress(null);
    setResult(null);
    setError(null);
  }, [stopPolling]);

  const startPolling = useCallback(
    (id: string) => {
      // Clear any existing interval
      stopPolling();

      setState("polling");

      const poll = async () => {
        if (!mountedRef.current) {
          stopPolling();
          return;
        }

        try {
          const status = await bookAIApi.getGenerationStatus(id);

          if (!mountedRef.current) return;

          setProgress(status.progress);

          if (status.status === "completed") {
            stopPolling();
            setResult(status.progress?.result ?? null);
            setState("completed");
          } else if (status.status === "failed") {
            stopPolling();
            setError(
              status.failedReason ??
                status.progress?.error ??
                "Generation failed"
            );
            // Still set result for partial successes
            if (
              status.progress?.result &&
              Object.keys(status.progress.result).length > 0
            ) {
              setResult(status.progress.result);
            }
            setState("failed");
          }
          // "queued" and "processing" → keep polling
        } catch (err) {
          if (!mountedRef.current) return;

          // 404 means job expired
          const status = (err as import("@/lib/api/axios").ApiError).status;
          if (status === 404) {
            stopPolling();
            setError("Job expired. Please try again.");
            setState("failed");
            return;
          }

          // For other errors, keep polling, could be transient
          console.error("[useBookAIGeneration] Poll error:", err);
        }
      };

      // Poll immediately, then on interval
      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const submit = useCallback(
    async (params: GenerateBookContentRequest) => {
      // Reset any previous state
      stopPolling();
      setProgress(null);
      setResult(null);
      setError(null);
      setState("submitting");

      try {
        const { jobId: newJobId } =
          await bookAIApi.submitGeneration(params);

        if (!mountedRef.current) return;

        setJobId(newJobId);
        startPolling(newJobId);
      } catch (err) {
        if (!mountedRef.current) return;

        const message =
          err instanceof Error ? err.message : "Failed to submit generation";
        setError(message);
        setState("failed");
      }
    },
    [stopPolling, startPolling]
  );

  return {
    state,
    jobId,
    progress,
    result,
    error,
    isActive: state === "submitting" || state === "polling",
    submit,
    reset,
  };
}
