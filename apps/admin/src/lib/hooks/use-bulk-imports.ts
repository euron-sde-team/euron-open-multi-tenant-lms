import { useMutation, useQuery } from "@tanstack/react-query";

import { bulkImportsApi } from "../api/bulk-imports";
import type {
  BulkEnrollInput,
  BulkImportScope,
  BulkImportScopeType,
} from "../types/bulk-imports";

export function useBulkImport() {
  return useMutation({
    mutationFn: async (input: {
      scope: BulkImportScope;
      file: File;
      dryRun: boolean;
    }) => bulkImportsApi.runImport(input.scope, input.file, input.dryRun),
  });
}

export function useBulkImportJob(jobId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["bulk-imports", "job", jobId],
    enabled: enabled && !!jobId,
    queryFn: () => bulkImportsApi.getJob(jobId as string),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 2000;
      if (data.status === "COMPLETED" || data.status === "FAILED") return false;
      return 2000;
    },
  });
}

export function useBulkImportJobs(params: {
  page?: number;
  limit?: number;
  scopeType?: BulkImportScopeType;
  scopeId?: string;
}) {
  return useQuery({
    queryKey: ["bulk-imports", "jobs", params],
    queryFn: () => bulkImportsApi.listJobs(params),
    placeholderData: (prev) => prev,
  });
}

export function useDownloadSample() {
  return useMutation({
    mutationFn: async (vars: {
      format: "csv" | "xlsx";
      withValidity?: boolean;
    }) => {
      const { format, withValidity } = vars;
      const blob = await bulkImportsApi.downloadSample(format, withValidity);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "csv" ? "bulk-import-sample.csv" : "bulk-import-sample.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}

export function useDownloadReport() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      const url = await bulkImportsApi.getReportUrl(jobId);
      window.open(url, "_blank");
    },
  });
}

export function useBulkEnroll() {
  return useMutation({
    mutationFn: async (input: { input: BulkEnrollInput; dryRun: boolean }) =>
      bulkImportsApi.runBulkEnroll(input.input, input.dryRun),
  });
}

export function useEligibleBatches(courseId: string | null) {
  return useQuery({
    queryKey: ["bulk-imports", "eligible-batches", courseId],
    enabled: !!courseId,
    queryFn: () => bulkImportsApi.listEligibleBatches(courseId as string),
  });
}
