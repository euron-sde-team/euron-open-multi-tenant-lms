"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useUserAuthStore } from "@/lib/stores/auth-store";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Client-side auth guard that redirects unauthenticated users to /login.
 * Waits for Zustand hydration before checking auth state.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useUserAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      const redirect = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground ml-3 text-sm">Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}
