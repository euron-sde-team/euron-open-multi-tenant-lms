"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getToken } from "../api/axios";
import { useMe } from "../hooks/use-auth";
import { appendUtmToUrl } from "../utils/utm";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard component - protects routes that require authentication
 * Redirects to login page if user is not authenticated
 * Passes current path as callback URL for redirect after login
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const token = getToken();

  // Fetch user data if token exists
  const { isLoading, error } = useMe();

  useEffect(() => {
    // If no token, redirect to login immediately (preserve UTM params)
    if (!token) {
      const currentPath = (pathname ?? "/") + (typeof window !== "undefined" ? window.location.search : "");
      const loginUrl = appendUtmToUrl(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
      router.replace(loginUrl);
      return;
    }

    // If there's an error fetching user (e.g., token expired), redirect to login
    if (error) {
      const currentPath = (pathname ?? "/") + (typeof window !== "undefined" ? window.location.search : "");
      const loginUrl = appendUtmToUrl(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
      router.replace(loginUrl);
      return;
    }

    // If not loading and we have a token, we're good
    if (!isLoading) {
      setIsChecking(false);
    }
  }, [token, isLoading, error, pathname, router]);

  // Show loading state ONLY during the initial auth check (isChecking).
  // After the first /me succeeds, do NOT re-show the loader on subsequent
  // isLoading flickers, e.g. when /me's queryKey changes because the
  // selected tenant switched. Re-showing the loader unmounts children
  // and kills any in-flight client-side flow. The onboarding auto-provision
  // wizard hits exactly this: it switches the selected tenant immediately
  // after the backend creates one, which used to flicker isLoading=true
  // and unmount the wizard mid-build.
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
