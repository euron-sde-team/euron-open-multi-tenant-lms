"use client";

import { useEffect, useRef } from "react";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { userAuthApi } from "@/lib/api/auth";

/**
 * Syncs auth state when authToken exists in localStorage but Zustand persist
 * has rehydrated with empty state (e.g. due to storage eviction, corruption,
 * or cross-tab desync). Calls /auth/me to validate the token and restore the session.
 * Runs after persist rehydration to avoid races.
 */
export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const didSyncRef = useRef(false);

  useEffect(() => {
    if (didSyncRef.current || typeof window === "undefined") return;

    const runSync = () => {
      if (didSyncRef.current) return;

      const authToken = localStorage.getItem("authToken");
      const { isAuthenticated, login } = useUserAuthStore.getState();

      if (!authToken || isAuthenticated) return;

      didSyncRef.current = true;

      userAuthApi
        .getMe()
        .then((member) => {
          const token = localStorage.getItem("authToken");
          if (token) {
            login(member, token);
          }
        })
        .catch(() => {
          // 401: interceptor already called logout. Other errors: leave token, user can retry.
        });
    };

    const persist = useUserAuthStore.persist;
    if (persist?.onFinishHydration) {
      persist.onFinishHydration(runSync);
    } else {
      runSync();
    }
    // Fallback: run after delay in case onFinishHydration already fired before we subscribed
    const fallback = setTimeout(runSync, 300);
    return () => clearTimeout(fallback);
  }, []);

  return <>{children}</>;
}
