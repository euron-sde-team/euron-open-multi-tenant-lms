"use client";

import { AuthGuard } from "@/lib/components/auth-guard";

export default function CourseEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </AuthGuard>
  );
}
