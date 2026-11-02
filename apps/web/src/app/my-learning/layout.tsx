"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Layout for My Learning page.
 * Protected by authentication, requires login to access.
 */
export default function MyLearningLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background" suppressHydrationWarning>
        {children}
      </div>
    </AuthGuard>
  );
}
