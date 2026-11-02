import type { ApiResponse } from "../types/auth";
import type {
  BulkEnrollInput,
  BulkEnrollResult,
  BulkImportJob,
  BulkImportJobsListResult,
  BulkImportScope,
  BulkImportScopeType,
  ImportSummary,
} from "../types/bulk-imports";

import { apiClient } from "./axios";

function buildScopePath(scope: BulkImportScope): string {
  if (scope.type === "TENANT") return "/tenant/bulk-imports/tenant";
  if (scope.type === "COURSE") return `/tenant/bulk-imports/courses/${scope.courseId}`;
  return `/tenant/bulk-imports/books/${scope.bookId}`;
}

function buildScopeQuery(
  scope: BulkImportScope,
  dryRun: boolean,
): Record<string, string> {
  const q: Record<string, string> = { dryRun: dryRun ? "true" : "false" };
  if (scope.type === "COURSE") {
    if (scope.batchId) q.batchId = scope.batchId;
    if (scope.validTill) q.validTill = scope.validTill;
  }
  if (scope.type === "BOOK") {
    if (scope.validTill) q.validTill = scope.validTill;
  }
  return q;
}

export const bulkImportsApi = {
  downloadSample(format: "csv" | "xlsx", withValidity = false): Promise<Blob> {
    return apiClient
      .get("/tenant/bulk-imports/sample", {
        params: withValidity ? { format, validity: "true" } : { format },
        responseType: "blob",
      })
      .then((r) => r.data as Blob);
  },

  async runImport(
    scope: BulkImportScope,
    file: File,
    dryRun: boolean,
  ): Promise<ImportSummary> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post<ApiResponse<ImportSummary>>(
      buildScopePath(scope),
      formData,
      {
        params: buildScopeQuery(scope, dryRun),
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return res.data.data;
  },

  async listJobs(params: {
    page?: number;
    limit?: number;
    scopeType?: BulkImportScopeType;
    scopeId?: string;
  }): Promise<BulkImportJobsListResult> {
    const res = await apiClient.get<ApiResponse<BulkImportJobsListResult>>(
      "/tenant/bulk-imports/jobs",
      { params },
    );
    return res.data.data;
  },

  async getJob(jobId: string): Promise<BulkImportJob> {
    const res = await apiClient.get<ApiResponse<BulkImportJob>>(
      `/tenant/bulk-imports/jobs/${jobId}`,
    );
    return res.data.data;
  },

  async getReportUrl(jobId: string): Promise<string> {
    const res = await apiClient.get<ApiResponse<{ url: string }>>(
      `/tenant/bulk-imports/jobs/${jobId}/report`,
    );
    return res.data.data.url;
  },

  async runBulkEnroll(
    input: BulkEnrollInput,
    dryRun: boolean,
  ): Promise<BulkEnrollResult> {
    const res = await apiClient.post<ApiResponse<BulkEnrollResult>>(
      "/tenant/members/bulk-enroll",
      input,
      { params: { dryRun: dryRun ? "true" : "false" } },
    );
    return res.data.data;
  },

  async listEligibleBatches(courseId: string): Promise<
    Array<{
      id: string;
      title: string;
      start_date: string;
      enrollment_close_date: string | null;
      status: string;
    }>
  > {
    const res = await apiClient.get<
      ApiResponse<
        Array<{
          id: string;
          title: string;
          start_date: string;
          enrollment_close_date: string | null;
          status: string;
        }>
      >
    >(`/tenant/courses/${courseId}/eligible-batches`);
    return res.data.data;
  },
};
