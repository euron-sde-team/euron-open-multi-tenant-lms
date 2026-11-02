"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Layout for LMS course player pages
 * Minimal layout without main site header/footer: LMS templates have their own navigation
 * Protected by authentication, requires login to access any /learn/* route
 */
export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="bg-background min-h-screen" suppressHydrationWarning>
        {children}
      </div>
    </AuthGuard>
  );
}
