"use client";

import { AuthBrandPanel } from "./AuthBrandPanel";
import { ADMIN_APP_NAME, PLATFORM_LOGO_URL, PLATFORM_NAME } from "@/lib/brand";

const LOGO = PLATFORM_LOGO_URL;

interface AuthPageLayoutProps {
  children: React.ReactNode;
}

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <AuthBrandPanel />

      {/* ── Form Panel ── */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 lg:min-h-0 lg:px-16">
        {/* Mobile-only logo */}
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <div className="flex h-14 w-14 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO}
              alt={PLATFORM_NAME}
              className="h-14 w-14 object-contain"
            />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {ADMIN_APP_NAME}
          </h1>
        </div>

        {children}

        <footer className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
          &copy; {new Date().getFullYear()} {PLATFORM_NAME}
        </footer>
      </div>
    </div>
  );
}
