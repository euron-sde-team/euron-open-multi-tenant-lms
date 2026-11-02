"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function BookReaderLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="bg-background min-h-screen" suppressHydrationWarning>
        {children}
      </div>
    </AuthGuard>
  );
}
