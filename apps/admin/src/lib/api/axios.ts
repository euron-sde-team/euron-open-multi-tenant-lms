import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

import { useOnboardingQuizStore } from "@/stores/onboarding-quiz-store";

import { API_BASE_URL } from "../config/env";
import { useApplicationStore } from "../stores/application-store";
import { useAuthStore } from "../stores/auth-store";
import { useFeatureAccessStore } from "../stores/feature-access-store";
import { useTenantStore } from "../stores/tenant-store";

/**
 * Custom error class that preserves the HTTP status code so callers can
 * branch on status (e.g. 404 → treat as "not found") while still
 * carrying the user-facing error message from the backend.
 */
export class ApiError extends Error {
  status: number;
  /**
   * Optional structured code from the server payload (e.g. "STALE_CURRICULUM").
   * Preserved by the response interceptor for status codes where the backend
   * publishes a stable error contract.
   */
  code?: string;
  /**
   * The full `error` object from the response body, for callers that need
   * more than the message (the daily AI limit 429 carries today's usage).
   */
  details?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Use the Next.js rewrite proxy to avoid CORS issues.
// Browser requests go to /api/proxy/... on the same origin,
// and Next.js server forwards them to the actual backend.
const baseURL =
  typeof window !== "undefined"
    ? "/api/proxy" // In browser: use proxy (same-origin, no CORS)
    : API_BASE_URL; // On server: call backend directly

// Create axios instance
export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000, // 60 seconds - increased for large page payloads
});

// Token storage key
const TOKEN_KEY = "admin_auth_token";

// Cookie helpers for middleware auth check
const setCookie = (name: string, value: string, days = 7): void => {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
};

const removeCookie = (name: string): void => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

// Helper functions for token management
export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  // Also set cookie for middleware to read
  setCookie(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  // Also remove cookie
  removeCookie(TOKEN_KEY);
};

/**
 * Clear all session state: token, cookie, and all persisted Zustand stores.
 * Call this on 401 (session expired) or logout to prevent stale data
 * from leaking across user sessions.
 */
export const clearSessionState = (): void => {
  removeToken();
  // Clear Zustand in-memory stores so any remaining components
  // don't read stale state before the hard redirect completes.
  // Onboarding quiz store is included so a logout-then-signup on
  // the same browser doesn't inherit the previous user's quiz answers
  // / orgName, which would silently submit on the first quiz click.
  useAuthStore.getState().logout();
  useTenantStore.getState().clearTenantState();
  useApplicationStore.getState().clearApplicationState();
  useFeatureAccessStore.getState().clearFeatureAccess();
  useOnboardingQuizStore.getState().reset();
};

// Request interceptor - adds auth token and tenant context to requests
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const tenantId = useTenantStore.getState().selectedTenantId;
    if (tenantId && config.headers) {
      config.headers["x-tenant-id"] = tenantId;
    }
    // For FormData (file uploads), remove Content-Type so browser sets multipart/form-data with boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handles errors globally
apiClient.interceptors.response.use(
  (response) => {
    // Return the response data directly
    return response;
  },
  (error: AxiosError<{
    message?: string;
    error?: {
      message?: string;
      code?: string;
      productCode?: string;
      featureKey?: string;
      currentUsed?: number;
      limit?: number;
      isUnlimited?: boolean;
    };
  }>) => {
    if (error.code === "ERR_CANCELED" || error.message === "canceled") {
      console.warn("Request was canceled:", error.config?.url);
      return Promise.reject(new Error("Request was canceled."));
    }

    if (error.response) {
      const status = error.response.status;
      const errData = error.response.data?.error;
      const code = errData?.code;
      const isEntitlementError =
        status === 403 &&
        (code === "ENTITLEMENT_LIMIT_REACHED" ||
          code === "ENTITLEMENT_FEATURE_DISABLED");

      // Preserve 404 status so callers (e.g. getCourseBySlug) can treat it as "not found",
      // but still extract the user-facing error message from the response.
      if (status === 404) {
        const msg = errData?.message || "Not found";
        return Promise.reject(new ApiError(msg, 404, code, errData));
      }

      // Preserve 409 status + structured code so callers can detect specific
      // conflict types (e.g. STALE_CURRICULUM from bulk reorder) and pick the
      // right recovery (refetch and retry vs prompt user to reload).
      if (status === 409) {
        const msg = errData?.message || "Conflict";
        return Promise.reject(new ApiError(msg, 409, code, errData));
      }

      if (status === 401) {
        clearSessionState();
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          const currentPath = window.location.pathname + window.location.search;
          const callbackUrl = encodeURIComponent(currentPath);
          window.location.href = `/login?callbackUrl=${callbackUrl}`;
        }
      }

      // Safety net: if an endpoint returns 403 because the user's tenant
      // context is stale or missing, clear the selection so the next /me
      // refetch picks a valid tenant (or shows "create organization").
      if (
        status === 403 &&
        !isEntitlementError &&
        typeof errData?.message === "string"
      ) {
        const msg = errData.message.toLowerCase();
        if (
          msg.includes("do not have access to this tenant") ||
          msg.includes("tenant context required")
        ) {
          useTenantStore.getState().clearTenantState();
        }
      }

      // Only use errData.message (user-facing from error.message in JSON);
      // skip error.response.data.message which contains diagnostic info
      // (route path + rayId).
      const errorMessage =
        errData?.message ||
        "An error occurred";

      if (isEntitlementError) {
        const e = new Error(errorMessage) as Error & {
          code: string;
          productCode?: string;
          featureKey?: string;
          currentUsed?: number;
          limit?: number;
          isUnlimited?: boolean;
        };
        e.code = code!;
        e.productCode = errData?.productCode;
        e.featureKey = errData?.featureKey;
        e.currentUsed = errData?.currentUsed;
        e.limit = errData?.limit;
        e.isUnlimited = errData?.isUnlimited;
        return Promise.reject(e);
      }

      // Any other error that carries a structured code keeps it, with the
      // full payload on `details`. A 429 for the daily AI limit used to
      // collapse to a bare Error here, which is why the portal swallowed it.
      if (typeof code === "string" && code) {
        return Promise.reject(new ApiError(errorMessage, status, code, errData));
      }

      return Promise.reject(new Error(errorMessage));
    }

    // Handle timeout errors
    if (error.code === "ECONNABORTED") {
      console.error("Request timeout:", error.config?.url);
      return Promise.reject(new Error("Request timed out. Please try again."));
    }

    // Handle network errors
    if (error.request) {
      console.error("Network error details:", {
        url: error.config?.url,
        method: error.config?.method,
        code: error.code,
        message: error.message,
      });
      return Promise.reject(new Error("Network error. Please check your connection."));
    }

    // Handle other errors
    return Promise.reject(error);
  }
);

