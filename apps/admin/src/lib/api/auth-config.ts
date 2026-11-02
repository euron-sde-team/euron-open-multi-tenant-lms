import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface AuthConfig {
  id: string;
  tenantId: string;
  emailPasswordEnabled: boolean;
  googleOauthEnabled: boolean;
  googleClientId: string | null;
  emailOtpEnabled: boolean;
  phoneOtpEnabled: boolean;
  signupEnabled: boolean;
  autoSignupOnLogin: boolean;
  phoneNumberRequired: boolean;
  easyCheckoutEnabled: boolean;
  nameConfirmationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Populated on PUT responses when the backend transparently auto-enables a
   * dependency (e.g., Email OTP and Phone OTP get auto-enabled when Easy
   * Checkout is turned on). Surface these to the admin so they understand
   * what the system did on their behalf.
   */
  warnings?: string[];
}

export interface UpdateAuthConfigRequest {
  emailPasswordEnabled?: boolean;
  googleOauthEnabled?: boolean;
  emailOtpEnabled?: boolean;
  phoneOtpEnabled?: boolean;
  signupEnabled?: boolean;
  autoSignupOnLogin?: boolean;
  phoneNumberRequired?: boolean;
  easyCheckoutEnabled?: boolean;
  nameConfirmationEnabled?: boolean;
}

export interface SaveGoogleClientIdRequest {
  googleClientId: string;
}

export const authConfigApi = {
  getConfig: async (): Promise<AuthConfig> => {
    const res = await apiClient.get<ApiResponse<AuthConfig>>(
      "/tenant/auth-config"
    );
    return res.data.data;
  },

  updateConfig: async (
    data: UpdateAuthConfigRequest
  ): Promise<AuthConfig> => {
    const res = await apiClient.put<ApiResponse<AuthConfig>>(
      "/tenant/auth-config",
      data
    );
    return res.data.data;
  },

  saveGoogleClientId: async (
    data: SaveGoogleClientIdRequest
  ): Promise<AuthConfig> => {
    const res = await apiClient.put<ApiResponse<AuthConfig>>(
      "/tenant/auth-config/google-oauth/client-id",
      data
    );
    return res.data.data;
  },

  clearGoogleClientId: async (): Promise<AuthConfig> => {
    const res = await apiClient.delete<ApiResponse<AuthConfig>>(
      "/tenant/auth-config/google-oauth/client-id"
    );
    return res.data.data;
  },
};
