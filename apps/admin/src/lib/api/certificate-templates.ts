import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface CertificateTemplateInfo {
  id: string;
  name: string;
  description: string;
  previewLabel: string;
  available: boolean;
}

export interface SelectedCertificateTemplate {
  templateId: string | null;
  isPublished: boolean;
  template: CertificateTemplateInfo | null;
  logoUrl: string | null;
}

export const certificateTemplatesApi = {
  getTemplates: async (): Promise<{ templates: CertificateTemplateInfo[] }> => {
    const response = await apiClient.get<ApiResponse<{ templates: CertificateTemplateInfo[] }>>(
      "/tenant/certificate-templates"
    );
    return response.data.data;
  },

  getSelected: async (): Promise<SelectedCertificateTemplate> => {
    const response = await apiClient.get<ApiResponse<SelectedCertificateTemplate>>(
      "/tenant/certificate-templates/selected"
    );
    return response.data.data;
  },

  selectTemplate: async (
    templateId: string,
    logoUrl?: string | null
  ): Promise<{ templateId: string; template: CertificateTemplateInfo; logoUrl: string | null }> => {
    const response = await apiClient.put<
      ApiResponse<{ templateId: string; template: CertificateTemplateInfo; logoUrl: string | null }>
    >("/tenant/certificate-templates/select", { templateId, logoUrl });
    return response.data.data;
  },

  togglePublish: async (
    isPublished: boolean
  ): Promise<{ templateId: string; isPublished: boolean }> => {
    const response = await apiClient.post<
      ApiResponse<{ templateId: string; isPublished: boolean }>
    >("/tenant/certificate-templates/publish", { isPublished });
    return response.data.data;
  },
};
