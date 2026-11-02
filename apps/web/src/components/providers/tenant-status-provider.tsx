"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTenantStatus } from "@/lib/hooks/use-tenant-status";

export function TenantStatusProvider({ children }: { children: React.ReactNode }) {
  const { isSuspended, isOffline } = useTenantStatus();

  // Hard redirect to maintenance page when tenant goes offline
  useEffect(() => {
    if (isOffline && typeof window !== "undefined") {
      window.location.href = "/maintenance";
    }
  }, [isOffline]);

  return (
    <>
      {isSuspended && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          This academy is temporarily unavailable for new enrollments and
          purchases. You can continue browsing existing content.
        </div>
      )}
      {children}
    </>
  );
}
