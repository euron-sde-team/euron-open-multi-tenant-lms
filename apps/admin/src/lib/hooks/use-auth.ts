"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { authApi } from "../api/auth";
import { clearSessionState, getToken, setToken } from "../api/axios";
import { useAuthStore } from "../stores/auth-store";
import { useTenantStore } from "../stores/tenant-store";
import type { LoginRequest, SignupRequest, UserProfile } from "../types/auth";
import { appendUtmToUrl } from "../utils/utm";
import { useOnboardingQuizStore } from "@/stores/onboarding-quiz-store";

// Query keys
export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

/**
 * Hook for login mutation
 * Handles callback URL for redirecting back to original page after login
 */
export const useLogin = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: storeLogin } = useAuthStore();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authApi.login(credentials),
    onSuccess: (data) => {
      // Store token in localStorage
      setToken(data.token);

      // Update auth store
      storeLogin(data.user);

      // Clear stale tenant selection from any previous session so the
      // first /me call doesn't send an invalid X-Tenant-Id header
      useTenantStore.getState().clearTenantState();

      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: authKeys.me() });

      // Get callback URL from query params, default to dashboard
      // Preserve UTM params in the redirect so tracking persists post-login
      const callbackUrl = searchParams?.get("callbackUrl");
      const redirectTo = callbackUrl ? decodeURIComponent(callbackUrl) : "/dashboard";

      // Redirect to callback URL or dashboard with UTM params
      router.push(appendUtmToUrl(redirectTo));
    },
    onError: (error) => {
      // Error handling is done in the component
      console.error("Login error:", error);
    },
  });
};

/**
 * Hook for dispatching the signup phone OTP. Public, no auth required.
 * The backend no-ops WhatsApp dispatch in non-production so this can be
 * safely called from the signup form regardless of environment.
 */
export const useSendSignupPhoneOtp = () => {
  return useMutation({
    mutationFn: (phone: string) => authApi.sendSignupPhoneOtp(phone),
  });
};

/**
 * Hook for signup mutation
 * On success, stores token and redirects to dashboard (legacy default).
 *
 * Pass `redirectTo` to override the destination, used by the lean
 * signup flow at /start to push new users into the onboarding quiz wizard.
 */
export const useSignup = (options?: { redirectTo?: string }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { login: storeLogin } = useAuthStore();

  return useMutation({
    mutationFn: (data: SignupRequest) => authApi.signup(data),
    onSuccess: (data) => {
      setToken(data.token);
      storeLogin(data.user);
      useTenantStore.getState().clearTenantState();
      // Hard-reset the onboarding quiz store so a fresh signup never
      // inherits stale step/answers/orgName from a previous tenant or
      // a partially-completed quiz on the same browser. Without this,
      // a returning device lands mid-quiz with isReadyToSubmit() already
      // true and a single click submits the wizard with the OLD user's data.
      useOnboardingQuizStore.getState().reset();
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      router.push(appendUtmToUrl(options?.redirectTo ?? "/dashboard"));
    },
    onError: (error) => {
      console.error("Signup error:", error);
    },
  });
};

/**
 * Hook for fetching current user profile
 */
export const useMe = () => {
  const { login: storeLogin, setPermissions, setPlatformAdmin } = useAuthStore();
  const { setTenants, selectedTenantId } = useTenantStore();

  return useQuery({
    queryKey: [...authKeys.me(), selectedTenantId],
    queryFn: async (): Promise<UserProfile> => {
      const data = await authApi.getMe();
      // Update store with user data
      storeLogin({
        id: data.id,
        email: data.email,
        name: data.name,
      });
      // Set the platform-admin flag BEFORE setTenants: setTenants reads it to
      // decide whether to preserve a non-member selection, so it must be
      // current (not the persisted value) by the time we reconcile tenants.
      setPlatformAdmin(data.is_platform_admin ?? false);
      // Update tenant store with user's tenants
      if (data.tenants) {
        setTenants(data.tenants);
      }

      // If the backend flagged our selected tenant as invalid,
      // setTenants() already auto-selected a valid one (or cleared selection).
      // Sync the resolved tenant so subsequent requests use the right ID.
      if (data.tenant_access_denied && data.resolved_tenant_id) {
        const store = useTenantStore.getState();
        if (store.selectedTenantId !== data.resolved_tenant_id) {
          store.selectTenant(data.resolved_tenant_id);
        }
      }

      // Update permission state from /me response
      setPermissions(
        data.roles ?? [],
        data.permissions ?? [],
        data.is_owner ?? false,
      );
      return data;
    },
    enabled: !!getToken(), // Only fetch if token exists
    retry: false,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    refetchOnWindowFocus: true, // Refresh permissions when user returns to tab
    // CRITICAL: Without this, switching `selectedTenantId` (which is part
    // of the queryKey) creates a brand-new query with no cache, so
    // `isLoading` flickers true. AuthGuard + onboarding QuizPage gate
    // their render on isLoading and would unmount their children mid-flow,
    // killing the in-flight auto-provision orchestrator. Keeping previous
    // data during the swap means isLoading stays false and consumers stay
    // mounted while the new tenant's permissions silently load in.
    placeholderData: keepPreviousData,
  });
};

/**
 * Hook for logout mutation
 */
export const useLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // Clear all session state (token, cookie, auth/tenant/application stores)
      clearSessionState();

      // Clear all queries
      queryClient.clear();

      // Redirect to login
      router.push("/login");
    },
    onError: () => {
      // Even on error, clear all local state
      clearSessionState();
      queryClient.clear();
      router.push("/login");
    },
  });
};

/**
 * Hook for forgot password mutation
 */
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });
};

/**
 * Hook for reset password mutation
 */
export const useResetPassword = () => {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
  });
};

/**
 * Hook to check if user is authenticated
 */
export const useAuth = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { data: profile, isLoading, error } = useMe();

  return {
    user: profile || user,
    isAuthenticated: isAuthenticated && !!getToken(),
    isLoading,
    error,
  };
};

/**
 * Hook for updating user profile (name, designation)
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name?: string; designation?: string }) =>
      authApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};

/**
 * Hook for uploading user avatar
 */
export const useUploadAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};

/**
 * Hook for removing user avatar
 */
export const useRemoveAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.removeAvatar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};
