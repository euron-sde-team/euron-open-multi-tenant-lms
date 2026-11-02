import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface StorefrontSettings {
  access_managed_enabled: boolean;
  access_managed_enabled_at: string | null;
}

export type UpdateStorefrontSettingsInput = {
  access_managed_enabled: boolean;
};

const BASE = "/tenant/storefront-settings";

export const storefrontSettingsApi = {
  get: async (): Promise<StorefrontSettings> => {
    const res = await apiClient.get<ApiResponse<StorefrontSettings>>(BASE);
    return res.data.data;
  },

  update: async (data: UpdateStorefrontSettingsInput): Promise<StorefrontSettings> => {
    const res = await apiClient.put<ApiResponse<StorefrontSettings>>(BASE, data);
    return res.data.data;
  },
};
