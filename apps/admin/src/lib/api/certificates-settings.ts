import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface CertificatesSettings {
  /** Whether the Certificates tab is shown to learners in their profile. Default: true. */
  certificate_tab_enabled: boolean;
}

export type UpdateCertificatesSettingsInput = {
  certificate_tab_enabled: boolean;
};

const BASE = "/tenant/certificates-settings";

export const certificatesSettingsApi = {
  get: async (): Promise<CertificatesSettings> => {
    const res = await apiClient.get<ApiResponse<CertificatesSettings>>(BASE);
    return res.data.data;
  },

  update: async (data: UpdateCertificatesSettingsInput): Promise<CertificatesSettings> => {
    const res = await apiClient.put<ApiResponse<CertificatesSettings>>(BASE, data);
    return res.data.data;
  },
};
