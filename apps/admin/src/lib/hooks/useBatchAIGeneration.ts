import { useCallback, useEffect, useRef, useState } from "react";

import batchAIApi, {
  type BatchAIJobProgress,
  type GenerateBatchContentRequest,
  type GeneratedBatchContent,
} from "@/lib/api/batch-ai";

export type BatchAIGenerationState =
  | "idle"
  | "submitting"
  | "polling"
  | "completed"
  | "failed";

const POLL_INTERVAL_MS = 2500;

export interface UseBatchAIGenerationReturn {
  state: BatchAIGenerationState;
  jobId: string | null;
  progress: BatchAIJobProgress | null;
  result: Partial<GeneratedBatchContent> | null;
  error: string | null;
  isActive: boolean;
  submit: (params: GenerateBatchContentRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Submit-and-poll hook for batch AI generation. Mirrors `useBookAIGeneration`
 * with two differences:
 *  - the polling endpoint requires `batchId` + `jobId`, so we keep the batch
 *    id around for the lifetime of the in-flight job;
 *  - on partial failure (some sections succeed, others fail), we still set
 *    `result` so the modal can apply the successful slices.
 */
export function useBatchAIGeneration(): UseBatchAIGenerationReturn {
  const [state, setState] = useState<BatchAIGenerationState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchAIJobProgress | null>(null);
  const [result, setResult] = useState<Partial<GeneratedBatchContent> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const batchIdRef = useRef<string | null>(null);

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
    batchIdRef.current = null;
  }, [stopPolling]);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      setState("polling");

      const poll = async () => {
        if (!mountedRef.current || !batchIdRef.current) {
          stopPolling();
          return;
        }
        try {
          const status = await batchAIApi.getGenerationStatus(
            batchIdRef.current,
            id
          );
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
            if (
              status.progress?.result &&
              Object.keys(status.progress.result).length > 0
            ) {
              setResult(status.progress.result);
            }
            setState("failed");
          }
        } catch (err) {
          if (!mountedRef.current) return;
          const httpStatus = (err as import("@/lib/api/axios").ApiError).status;
          if (httpStatus === 404) {
            stopPolling();
            setError("Job expired. Please try again.");
            setState("failed");
            return;
          }
          // Transient errors, keep polling.
          console.error("[useBatchAIGeneration] Poll error:", err);
        }
      };

      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const submit = useCallback(
    async (params: GenerateBatchContentRequest) => {
      stopPolling();
      setProgress(null);
      setResult(null);
      setError(null);
      setState("submitting");
      batchIdRef.current = params.batchId;
      try {
        const { jobId: newJobId } = await batchAIApi.submitGeneration(params);
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
