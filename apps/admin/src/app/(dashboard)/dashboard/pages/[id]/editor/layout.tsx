"use client";

import { AuthGuard } from "@/lib/components/auth-guard";

/**
 * Editor Layout - Full screen without dashboard sidebar
 * This overrides the dashboard layout for the editor pages
 */
export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="fixed inset-0 z-50 bg-background">
        {children}
      </div>
    </AuthGuard>
  );
}
