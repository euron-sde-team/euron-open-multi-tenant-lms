import type { CertificateDesign } from "@open-mtlms/certificate-templates";

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface BulkCertBatchSummary {
  id: string;
  title: string;
  templateId: string;
  /** Set when the batch uses a custom design. */
  certificateTemplateId: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  totalCount: number;
  createdAt: string;
}

export interface BulkCertItem {
  id: string;
  recipientName: string;
  email: string | null;
  /** Set when the recipient email matched a registered learner account. */
  mappedMemberId: string | null;
  certificateNumber: string;
  status: string;
  issuedAt: string;
  formattedIssuedAt: string;
  emailedAt: string | null;
  verifyUrl: string;
}

export interface BulkCertBatchDetail {
  batch: BulkCertBatchSummary;
  templateId: string;
  /** The custom design the batch was issued with, else null (stock template). */
  design: CertificateDesign | null;
  tenantName: string;
  logoUrl: string;
  directorName: string;
  directorTitle: string;
  items: BulkCertItem[];
}

export interface CreateBatchInput {
  file: File;
  title: string;
  /** A stock template id, or null when certificateTemplateId is set. */
  templateId: string | null;
  /** One of the academy's custom designs. */
  certificateTemplateId?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
}

export interface RecipientContact {
  name: string;
  email: string;
}

export type RecipientSource =
  | { type: "course"; id: string }
  | { type: "book"; id: string }
  | { type: "emails"; contacts: RecipientContact[] };

export interface CreateFromSourceInput {
  title: string;
  templateId: string | null;
  certificateTemplateId?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  source: RecipientSource;
}

export interface SendBatchResult {
  sent: number;
  failed: number;
  skipped: number;
}

export const bulkCertificatesApi = {
  downloadSample(format: "csv" | "xlsx"): Promise<Blob> {
    return apiClient
      .get("/tenant/certificates/sample", {
        params: { format },
        responseType: "blob",
      })
      .then((r) => r.data as Blob);
  },

  async createBatch(input: CreateBatchInput): Promise<BulkCertBatchDetail> {
    const formData = new FormData();
    formData.append("file", input.file);
    formData.append("title", input.title);
    if (input.templateId) formData.append("templateId", input.templateId);
    if (input.certificateTemplateId) {
      formData.append("certificateTemplateId", input.certificateTemplateId);
    }
    if (input.signatoryName) formData.append("signatoryName", input.signatoryName);
    if (input.signatoryTitle) formData.append("signatoryTitle", input.signatoryTitle);

    const res = await apiClient.post<ApiResponse<BulkCertBatchDetail>>(
      "/tenant/certificates/batches",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data.data;
  },

  async listBatches(): Promise<{ batches: BulkCertBatchSummary[] }> {
    const res = await apiClient.get<ApiResponse<{ batches: BulkCertBatchSummary[] }>>(
      "/tenant/certificates/batches",
    );
    return res.data.data;
  },

  async getBatchDetail(batchId: string): Promise<BulkCertBatchDetail> {
    const res = await apiClient.get<ApiResponse<BulkCertBatchDetail>>(
      `/tenant/certificates/batches/${batchId}`,
    );
    return res.data.data;
  },

  async deleteBatch(batchId: string): Promise<void> {
    await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
      `/tenant/certificates/batches/${batchId}`,
    );
  },

  async resolveRecipients(
    source: RecipientSource,
  ): Promise<{ recipients: RecipientContact[]; count: number }> {
    const res = await apiClient.post<
      ApiResponse<{ recipients: RecipientContact[]; count: number }>
    >("/tenant/certificates/recipients", { source });
    return res.data.data;
  },

  async createFromSource(
    input: CreateFromSourceInput,
  ): Promise<BulkCertBatchDetail> {
    const res = await apiClient.post<ApiResponse<BulkCertBatchDetail>>(
      "/tenant/certificates/from-source",
      input,
    );
    return res.data.data;
  },

  async sendBatch(batchId: string): Promise<SendBatchResult> {
    const res = await apiClient.post<ApiResponse<SendBatchResult>>(
      `/tenant/certificates/batches/${batchId}/send`,
    );
    return res.data.data;
  },
};
