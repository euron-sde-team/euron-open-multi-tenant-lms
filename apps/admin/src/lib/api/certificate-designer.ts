import type { CertificateDesign } from "@open-mtlms/certificate-templates";

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface CertificateTemplateRow {
  id: string;
  name: string;
  page_size: string;
  orientation: string;
  background_asset_url: string | null;
  layout: CertificateDesign;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SaveTemplatePayload {
  name: string;
  pageSize?: string;
  orientation?: string;
  backgroundAssetUrl?: string | null;
  layout: CertificateDesign;
  isDefault?: boolean;
  status?: string;
}

export const certificateDesignerApi = {
  list: async (): Promise<CertificateTemplateRow[]> =>
    (
      await apiClient.get<ApiResponse<{ templates: CertificateTemplateRow[] }>>(
        "/tenant/certificate-designer",
      )
    ).data.data.templates,

  get: async (id: string): Promise<CertificateTemplateRow> =>
    (
      await apiClient.get<ApiResponse<{ template: CertificateTemplateRow }>>(
        `/tenant/certificate-designer/${id}`,
      )
    ).data.data.template,

  create: async (payload: SaveTemplatePayload): Promise<CertificateTemplateRow> =>
    (
      await apiClient.post<ApiResponse<{ template: CertificateTemplateRow }>>(
        "/tenant/certificate-designer",
        payload,
      )
    ).data.data.template,

  update: async (
    id: string,
    payload: Partial<SaveTemplatePayload>,
  ): Promise<CertificateTemplateRow> =>
    (
      await apiClient.put<ApiResponse<{ template: CertificateTemplateRow }>>(
        `/tenant/certificate-designer/${id}`,
        payload,
      )
    ).data.data.template,

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/tenant/certificate-designer/${id}`);
  },

  setDefault: async (id: string): Promise<CertificateTemplateRow> =>
    (
      await apiClient.post<ApiResponse<{ template: CertificateTemplateRow }>>(
        `/tenant/certificate-designer/${id}/default`,
      )
    ).data.data.template,

  uploadAsset: async (
    file: File,
    kind: "background" | "signature" | "logo" = "background",
  ): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    return (
      await apiClient.post<ApiResponse<{ url: string }>>(
        "/tenant/certificate-designer/asset",
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
    ).data.data.url;
  },
};
