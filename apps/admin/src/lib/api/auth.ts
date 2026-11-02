import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  SignupRequest,
  UserProfile,
} from "../types/auth";
import { getUtmParams, buildUtmForBackend } from "../utils/utm";

import { apiClient } from "./axios";

/**
 * Auth API service
 * Handles all authentication-related API calls
 */
export const authApi = {
  /**
   * Signup with name, email, and password
   * Captures timezone and UTM params automatically
   */
  signup: async (data: SignupRequest): Promise<LoginResponse> => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const all = getUtmParams();
    const ref = all.ref || undefined;
    const click_id = all.click_id || undefined;
    const utm = buildUtmForBackend(all);

    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      "/tenant/auth/signup",
      { ...data, timezone, ...(ref && { ref }), ...(click_id && { click_id }), ...(utm && { utm }) }
    );
    return response.data.data;
  },

  /**
   * Login with email and password
   * Captures timezone and UTM params automatically
   */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const all = getUtmParams();
    const ref = all.ref || undefined;
    const click_id = all.click_id || undefined;
    const utm = buildUtmForBackend(all);

    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      "/tenant/auth/login",
      { ...credentials, timezone, ...(ref && { ref }), ...(click_id && { click_id }), ...(utm && { utm }) }
    );
    return response.data.data;
  },

  /**
   * Get current user profile
   */
  getMe: async (): Promise<UserProfile> => {
    const response = await apiClient.get<ApiResponse<UserProfile>>("/tenant/auth/me");
    return response.data.data;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    await apiClient.post("/tenant/auth/logout");
  },

  /**
   * Request password reset email
   */
  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post("/tenant/auth/forgot-password", { email });
  },

  /**
   * Reset password using token
   */
  resetPassword: async (token: string, password: string): Promise<void> => {
    await apiClient.post("/tenant/auth/reset-password", { token, password });
  },

  /**
   * Send OTP to verify phone number via WhatsApp
   */
  sendVerifyPhoneOtp: async (phone: string): Promise<void> => {
    await apiClient.post("/tenant/auth/me/send-verify-phone-otp", { phone });
  },

  /**
   * Send WhatsApp OTP to a phone number during signup (public endpoint, no auth).
   * Used before the account exists so phone can be verified at signup time.
   */
  sendSignupPhoneOtp: async (phone: string): Promise<void> => {
    await apiClient.post("/tenant/auth/signup/send-phone-otp", { phone });
  },

  /**
   * Verify phone OTP and update user record.
   * Optionally includes partner attribution data so the lead is created
   * only after phone verification (not on signup).
   */
  verifyPhone: async (data: {
    phone: string;
    code: string;
    ref?: string;
    click_id?: string;
    utm_params?: Record<string, string>;
  }): Promise<UserProfile> => {
    const response = await apiClient.post<ApiResponse<UserProfile>>(
      "/tenant/auth/me/verify-phone",
      data
    );
    return response.data.data;
  },

  /**
   * Update user profile (name, designation)
   */
  updateProfile: async (data: { name?: string; designation?: string }): Promise<UserProfile> => {
    const response = await apiClient.patch<ApiResponse<UserProfile>>(
      "/tenant/auth/me/profile",
      data
    );
    return response.data.data;
  },

  /**
   * Upload user avatar
   */
  uploadAvatar: async (file: File): Promise<UserProfile> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<ApiResponse<UserProfile>>(
      "/tenant/auth/me/avatar",
      formData
    );
    return response.data.data;
  },

  /**
   * Remove user avatar
   */
  removeAvatar: async (): Promise<UserProfile> => {
    const response = await apiClient.delete<ApiResponse<UserProfile>>(
      "/tenant/auth/me/avatar"
    );
    return response.data.data;
  },
};
