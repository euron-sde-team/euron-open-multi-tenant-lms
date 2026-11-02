import { useCallback, useEffect, useRef, useState } from "react";

import courseAIApi, {
  type CourseAIJobProgress,
  type GenerateCourseContentRequest,
  type GeneratedCourseContent,
} from "@/lib/api/course-ai";

export type CourseAIGenerationState =
  | "idle"
  | "submitting"
  | "polling"
  | "completed"
  | "failed";

const POLL_INTERVAL_MS = 2500;

export interface UseCourseAIGenerationReturn {
  state: CourseAIGenerationState;
  jobId: string | null;
  progress: CourseAIJobProgress | null;
  result: Partial<GeneratedCourseContent> | null;
  error: string | null;
  /** True when submitting or polling (generation is in progress). */
  isActive: boolean;
  submit: (params: GenerateCourseContentRequest) => Promise<void>;
  reset: () => void;
}

export function useCourseAIGeneration(): UseCourseAIGenerationReturn {
  const [state, setState] = useState<CourseAIGenerationState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CourseAIJobProgress | null>(null);
  const [result, setResult] = useState<Partial<GeneratedCourseContent> | null>(
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
          const status = await courseAIApi.getGenerationStatus(id);

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
          console.error("[useCourseAIGeneration] Poll error:", err);
        }
      };

      // Poll immediately, then on interval
      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const submit = useCallback(
    async (params: GenerateCourseContentRequest) => {
      // Reset any previous state
      stopPolling();
      setProgress(null);
      setResult(null);
      setError(null);
      setState("submitting");

      try {
        const { jobId: newJobId } =
          await courseAIApi.submitGeneration(params);

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
