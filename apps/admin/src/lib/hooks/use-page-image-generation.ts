import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiError } from "@/lib/api/axios";
import pageAIApi, { type PageImageJobProgress } from "@/lib/api/page-ai";

export type PageImageGenerationState = "idle" | "submitting" | "polling" | "completed" | "failed";

const POLL_INTERVAL_MS = 2500;

export interface UsePageImageGenerationReturn {
  state: PageImageGenerationState;
  jobId: string | null;
  progress: PageImageJobProgress | null;
  result: { url: string } | null;
  error: string | null;
  isActive: boolean;
  submit: (params: {
    prompt: string;
    aspectRatio?: string;
    sectionContext?: {
      sectionType?: string;
      headline?: string;
      description?: string;
      badge?: string;
    };
  }) => Promise<void>;
  reset: () => void;
}

export function usePageImageGeneration(): UsePageImageGenerationReturn {
  const [state, setState] = useState<PageImageGenerationState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<PageImageJobProgress | null>(null);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

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
      stopPolling();
      setState("polling");

      const poll = async () => {
        if (!mountedRef.current) {
          stopPolling();
          return;
        }

        try {
          const status = await pageAIApi.getImageGenerationStatus(id);

          if (!mountedRef.current) return;

          setProgress(status.progress);

          if (status.status === "completed") {
            stopPolling();
            setResult(status.progress?.result ?? null);
            setState("completed");
          } else if (status.status === "failed") {
            stopPolling();
            setError(status.failedReason ?? status.progress?.error ?? "Image generation failed");
            setState("failed");
          }
        } catch (err) {
          if (!mountedRef.current) return;

          const apiStatus = (err as ApiError).status;
          if (apiStatus === 404) {
            stopPolling();
            setError("Job expired. Please try again.");
            setState("failed");
            return;
          }

          console.error("[usePageImageGeneration] Poll error:", err);
        }
      };

      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const submit = useCallback(
    async (params: {
      prompt: string;
      aspectRatio?: string;
      sectionContext?: {
        sectionType?: string;
        headline?: string;
        description?: string;
        badge?: string;
      };
    }) => {
      stopPolling();
      setProgress(null);
      setResult(null);
      setError(null);
      setState("submitting");

      try {
        const { jobId: newJobId } = await pageAIApi.submitImageGeneration(params);

        if (!mountedRef.current) return;

        setJobId(newJobId);
        startPolling(newJobId);
      } catch (err) {
        if (!mountedRef.current) return;

        const message = err instanceof Error ? err.message : "Failed to submit image generation";
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
