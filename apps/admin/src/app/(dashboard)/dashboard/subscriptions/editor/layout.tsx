"use client";

import { AuthGuard } from "@/lib/components/auth-guard";

/**
 * Subscription Editor Layout - Full screen without dashboard sidebar
 */
export default function SubscriptionEditorLayout({
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
