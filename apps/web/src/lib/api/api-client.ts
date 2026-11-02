/**
 * Centralized API client for authenticated calls to the learner-api.
 * Single Axios instance with interceptors.
 * On 401 (JWT expired), clears auth state so navbar shows login.
 */

import axios, { type AxiosRequestConfig } from "axios";
import { getStoredToken } from "@/lib/auth-tokens";
import { useUserAuthStore } from "@/lib/stores/auth-store";

// ---------------------------------------------------------------------------
// Tenant status event system, detects runtime 403/503 from backend
// ---------------------------------------------------------------------------

export type TenantStatusEvent = "suspended" | "offline";
type StatusListener = (status: TenantStatusEvent) => void;

const statusListeners = new Set<StatusListener>();
let currentTenantStatus: TenantStatusEvent | null = null;

function emitTenantStatus(status: TenantStatusEvent) {
  if (currentTenantStatus === status) return; // dedupe
  currentTenantStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

export function onTenantStatusChange(callback: StatusListener): () => void {
  statusListeners.add(callback);
  return () => {
    statusListeners.delete(callback);
  };
}

export function getTenantStatusSnapshot(): TenantStatusEvent | null {
  return currentTenantStatus;
}

// ---------------------------------------------------------------------------
// Account status event system, the tenant admin suspended/deactivated this
// member, so the backend now 401s every request with a machine-readable code.
// ---------------------------------------------------------------------------

type AccountStatusListener = (message: string) => void;

const accountStatusListeners = new Set<AccountStatusListener>();
/**
 * Latched: a page in flight can have several requests fail at once, and the
 * learner should see one toast, not six. Never reset, once the account is
 * suspended there is nothing to un-notify within this page's lifetime.
 */
let accountSuspendedNotified = false;

function emitAccountSuspended(message: string) {
  if (accountSuspendedNotified) return;
  accountSuspendedNotified = true;
  accountStatusListeners.forEach((fn) => fn(message));
}

/** Subscribe to account suspension. Returns an unsubscribe function. */
export function onAccountSuspended(
  callback: AccountStatusListener,
): () => void {
  accountStatusListeners.add(callback);
  return () => {
    accountStatusListeners.delete(callback);
  };
}

/**
 * Custom error class that preserves the HTTP status code so callers can
 * branch on status (e.g. 404 → treat as "not found") while still
 * carrying the user-facing error message from the backend. Also retains
 * the raw response.data envelope so callers can read structured fields
 * (e.g. { kind, slug, title } on a 409 conflict) the global interceptor
 * would otherwise drop.
 */
export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const BASE_URL =
  ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL) || "http://localhost:5096/api/v1";

// Token storage lives in lib/auth-tokens.ts so the auth store can share it
// without deepening the api-client ↔ auth-store require cycle.
const getToken = getStoredToken;

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof window !== "undefined") {
      config.headers["X-Tenant-Host"] = window.location.host;
    }
    // FormData: let browser set Content-Type with boundary
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      config.headers["Content-Type"] = false as unknown as string;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorCode = error.response?.data?.error?.code as string | undefined;

    // A 401 means the session is gone, drop local auth so the UI stops
    // pretending otherwise. Skip /auth/logout: it is itself an authenticated
    // route, so it 401s once the session is dead, and reacting to that would
    // re-enter the very logout that issued it.
    const reqUrl = (error.config?.url as string | undefined) ?? "";
    if (error.response?.status === 401 && !reqUrl.includes("/auth/logout")) {
      // A tenant admin suspended this member mid-session. Emit BEFORE logout()
      // so the message is captured before auth state (and the AuthGuard
      // redirect it triggers) tears the page down.
      if (errorCode === "ACCOUNT_SUSPENDED" || errorCode === "ACCOUNT_DEACTIVATED") {
        const message = error.response?.data?.error?.message as string | undefined;
        emitAccountSuspended(
          message ?? "Your account is no longer active. Please contact support.",
        );
      }
      useUserAuthStore.getState().logout();
    }

    // Detect tenant status changes from backend guard middleware
    const errorMsg = error.response?.data?.error?.message as string | undefined;
    if (error.response?.status === 403 && errorMsg?.includes("temporarily unavailable")) {
      emitTenantStatus("suspended");
    } else if (error.response?.status === 503 && errorMsg?.includes("currently offline")) {
      emitTenantStatus("offline");
    }

    // Extract user-facing error message from API response so components
    // get a meaningful message via err.message instead of Axios's generic
    // "Request failed with status code 400". ApiError preserves the HTTP
    // status code so callers can still branch on it (e.g. 404 → not found).
    if (error.response?.data) {
      const errData = error.response.data as {
        error?: { message?: string };
      };
      // Only use error.message (user-facing); skip response.data.message
      // which contains diagnostic info (route path + rayId).
      const errorMessage =
        errData.error?.message ||
        "An error occurred";
      return Promise.reject(
        new ApiError(errorMessage, error.response.status, error.response.data),
      );
    }

    return Promise.reject(error);
  }
);

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: { message?: string };
}

async function unwrap<T>(res: { data: ApiResponse<T> }): Promise<T> {
  const json = res.data;
  if (!json?.success || json.data === undefined) {
    // Only use error.message (user-facing); skip json.message which
    // contains diagnostic info (route path + rayId).
    const msg = json?.error?.message || "Request failed";
    throw new Error(msg);
  }
  return json.data;
}

export async function apiGet<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await axiosInstance.get<ApiResponse<T>>(path, config);
  return unwrap(res);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await axiosInstance.post<ApiResponse<T>>(path, body, config);
  return unwrap(res);
}

export async function apiPut<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await axiosInstance.put<ApiResponse<T>>(path, body, config);
  return unwrap(res);
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await axiosInstance.patch<ApiResponse<T>>(path, body, config);
  return unwrap(res);
}

export async function apiDelete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await axiosInstance.delete<ApiResponse<T>>(path, config);
  return unwrap(res);
}
