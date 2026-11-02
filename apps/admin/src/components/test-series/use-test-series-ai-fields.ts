"use client";

import { useEffect, useState } from "react";

import { uploadApi } from "@/lib/api/upload";
import {
  useSubmitTestSeriesAI,
  useTestSeriesAIJobStatus,
} from "@/lib/hooks/use-test-series";
import type { TestSeriesAIInput } from "@/lib/api/test-series";

/**
 * Submit + poll a single test-series AI job that produces text (title or
 * description). Mirrors the test-ai question pipeline: submit returns a
 * jobId, useTestSeriesAIJobStatus polls until terminal, then onComplete
 * receives the generated string.
 *
 * Sequential by design, only one job at a time per hook instance. Calling
 * generate() while a job is in flight cancels the previous job's wiring
 * (the server-side job continues but we stop reading it).
 */
export function useTestSeriesAITextField(onComplete: (text: string) => void) {
  const submitMut = useSubmitTestSeriesAI();
  const [jobId, setJobId] = useState<string | null>(null);
  const status = useTestSeriesAIJobStatus(jobId);

  useEffect(() => {
    const data = status.data;
    if (!data || data.jobId !== jobId) return;
    if (data.state === "completed") {
      const r = data.progress?.result;
      if (r && (r.kind === "title" || r.kind === "description")) {
        onComplete(r.text);
      }
      setJobId(null);
    } else if (data.state === "failed" || data.state === "not_found") {
      setJobId(null);
    }
  }, [status.data, jobId, onComplete]);

  const isActive =
    submitMut.isPending ||
    (jobId !== null &&
      (!status.data ||
        (status.data.state !== "completed" &&
          status.data.state !== "failed" &&
          status.data.state !== "not_found")));

  const generate = async (input: TestSeriesAIInput) => {
    const { jobId: newJobId } = await submitMut.mutateAsync(input);
    setJobId(newJobId);
  };

  return {
    generate,
    isActive,
    error: status.data?.failedReason ?? null,
  };
}

/**
 * Submit + poll a cover-image AI job. On completion, the worker hands back
 * a webp data URL; this hook converts it to a File, uploads it through the
 * existing uploadApi, and yields the resulting S3 key. Admin then patches
 * the series with cover_image_key the same way they would after a manual
 * upload.
 */
export function useTestSeriesAICoverField(onUploaded: (key: string) => void) {
  const submitMut = useSubmitTestSeriesAI();
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const status = useTestSeriesAIJobStatus(jobId);

  useEffect(() => {
    const data = status.data;
    if (!data || data.jobId !== jobId) return;

    if (data.state === "completed") {
      const r = data.progress?.result;
      if (!r || r.kind !== "cover") {
        setJobId(null);
        return;
      }
      const dataUrl = r.dataUrl;
      const [header, b64] = dataUrl.split(",");
      const mime = header.match(/:(.*?);/)?.[1] ?? "image/webp";
      const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], `ai-cover.${ext}`, { type: mime });

      setUploading(true);
      uploadApi
        .uploadFile(file, "test-series-thumbnails")
        .then((result) => {
          onUploaded(result.key);
        })
        .finally(() => {
          setUploading(false);
          setJobId(null);
        });
    } else if (data.state === "failed" || data.state === "not_found") {
      setJobId(null);
    }
  }, [status.data, jobId, onUploaded]);

  const polling =
    jobId !== null &&
    (!status.data ||
      (status.data.state !== "completed" &&
        status.data.state !== "failed" &&
        status.data.state !== "not_found"));
  const isActive = submitMut.isPending || polling || uploading;

  const generate = async (input: Extract<TestSeriesAIInput, { kind: "cover" }>) => {
    const { jobId: newJobId } = await submitMut.mutateAsync(input);
    setJobId(newJobId);
  };

  return {
    generate,
    isActive,
    isUploading: uploading,
    error: status.data?.failedReason ?? null,
  };
}
