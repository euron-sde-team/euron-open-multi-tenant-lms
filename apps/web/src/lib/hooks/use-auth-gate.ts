"use client";

import { useCallback, useState } from "react";
import { useUserAuthStore } from "@/lib/stores/auth-store";

export function useAuthGate() {
  const isAuthenticated = useUserAuthStore((s) => s.isAuthenticated);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const requireAuth = useCallback(
    (callback: () => void) => {
      if (isAuthenticated) {
        callback();
      } else {
        setShowLoginPrompt(true);
      }
    },
    [isAuthenticated]
  );

  const closeLoginPrompt = useCallback(() => {
    setShowLoginPrompt(false);
  }, []);

  return { isAuthenticated, showLoginPrompt, requireAuth, closeLoginPrompt };
}
