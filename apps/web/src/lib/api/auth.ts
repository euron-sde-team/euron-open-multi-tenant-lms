/**
 * Auth API functions for end-user authentication.
 * Calls the learner-api at /api/v1/auth/*.
 */

import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";
import { deepDecodeHtmlEntities } from "../utils";

const API_URL = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL) || "http://localhost:5096/api/v1";

function getTenantHost(): string {
  if (typeof window !== "undefined") {
    return window.location.host;
  }
  return "";
}

async function authFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Host": getTenantHost(),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    const message =
      json.error?.message || json.message || "An error occurred";
    throw new Error(message);
  }

  return json.data as T;
}

// ------- Types -------

export interface AuthConfig {
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
}

export type EasyCheckoutSignupResult =
  | { ok: true; result: AuthResponse }
  | { ok: false; matchedIdentifier: string; channel: "email" };

export interface ProfileMetadata {
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    website?: string;
  };
  goals?: string;
  skills?: string[];
  location?: string;
  company?: string;
  jobTitle?: string;
  dateOfBirth?: string;
  languages?: string[];
  /**
   * How this account was created. Backend stamps `"EASY_CHECKOUT"` on auto-created
   * easy-checkout members; password / OAuth / phone-OTP signups leave this unset.
   * Used by guards to decide whether the verify-now nag applies to this member.
   */
  signupSource?: string;
}

export interface MemberPublic {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: string;
  nameConfirmedAt: string | null;
  about?: string | null;
  gender?: string | null;
  oauthProvider?: string | null;
  profileMetadata?: ProfileMetadata | null;
}

export interface AuthResponse {
  accessToken: string;
  member: MemberPublic;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  androidAppUrl?: string | null;
  iosAppUrl?: string | null;
}

// ------- API Functions -------

export const userAuthApi = {
  getTenantInfo: (): Promise<TenantInfo> => authFetch("/tenant/info"),

  getConfig: (): Promise<AuthConfig> => authFetch("/auth/config"),

  signup: (data: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthResponse> =>
    authFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: {
    email: string;
    password: string;
  }): Promise<AuthResponse> =>
    authFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  googleAuth: (data: { googleToken?: string; googleAccessToken?: string}): Promise<AuthResponse> =>
    authFetch("/auth/google", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  sendOtp: (data: {
    identifier: string;
    channel: "email";
  }): Promise<null> =>
    authFetch("/auth/otp/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyOtp: (data: {
    identifier: string;
    channel: "email";
    code: string;
    name?: string;
  }): Promise<AuthResponse> =>
    authFetch("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Easy Checkout signup. Returns { ok: false, matchedIdentifier, channel } when an
  // existing account collides on email or phone. The OTP for that identifier has
  // already been sent server-side; the modal switches to inline OTP recovery.
  easyCheckoutSignup: async (data: {
    email: string;
    phone: string;
    name?: string;
  }): Promise<EasyCheckoutSignupResult> => {
    const url = `${API_URL}/auth/easy-checkout`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Host": getTenantHost(),
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (res.status === 409 && json?.kind === "EASY_CHECKOUT_CONFLICT") {
      return {
        ok: false,
        matchedIdentifier: json.matchedIdentifier as string,
        channel: json.channel as "email",
      };
    }
    if (!res.ok || !json.success) {
      const message = json.error?.message || json.message || "Easy Checkout failed";
      throw new Error(message);
    }
    return { ok: true, result: json.data as AuthResponse };
  },

  getMe: (): Promise<MemberPublic> =>
    apiGet<MemberPublic>("/auth/me").then(deepDecodeHtmlEntities),

  updateProfile: (data: {
    name?: string;
    phone?: string;
    avatarUrl?: string;
    about?: string;
    gender?: string;
    profileMetadata?: ProfileMetadata;
  }): Promise<MemberPublic> => apiPatch("/auth/me", data),

  deleteProfile: (): Promise<void> => apiDelete("/auth/me"),

  uploadAvatar: async (file: File): Promise<MemberPublic> => {
    const formData = new FormData();
    formData.append("file", file);
    return apiPost<MemberPublic>("/auth/me/avatar", formData);
  },

  sendVerifyEmailOtp: (): Promise<null> =>
    apiPost<null>("/auth/me/send-verify-email-otp", {}),

  verifyEmail: (data: { code: string }): Promise<MemberPublic> =>
    apiPost<MemberPublic>("/auth/me/verify-email", data),

  // Name confirmation modal: send an OTP to a new email (phone based accounts only).
  sendConfirmNameEmailOtp: (email: string): Promise<null> =>
    apiPost<null>("/auth/me/confirm-name/send-email-otp", { email }),

  // Name confirmation modal: save the confirmed name (and optionally a new,
  // code verified email). Stamps name_confirmed_at so the modal never shows again.
  confirmName: (data: { name: string; email?: string; code?: string }): Promise<MemberPublic> =>
    apiPost<MemberPublic>("/auth/me/confirm-name", data),

  getPublicProfile: (userId: string): Promise<{ id: string; name: string; avatarUrl: string | null; about: string | null }> =>
    apiGet(`/profile/public/${userId}`),

  forgotPassword: (data: { email: string }): Promise<null> =>
    authFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  resetPassword: (data: { token: string; newPassword: string }): Promise<null> =>
    authFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: (): Promise<null> =>
    authFetch("/auth/logout", {
      method: "POST",
      headers: {
        Authorization: typeof window !== "undefined" ? `Bearer ${localStorage.getItem("authToken")}` : "",
      },
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<MemberPublic> =>
    apiPatch("/auth/me/password", data),
};
