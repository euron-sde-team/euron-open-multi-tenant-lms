"use client";

import { useEffect, useState } from "react";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { AuthBrandPanel } from "./auth-brand-panel";
import { userAuthApi, type TenantInfo } from "@/lib/api/auth";
import type { ThemeConfig } from "@open-mtlms/shared";

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  theme?: ThemeConfig;
}

export function AuthSplitLayout({ children, theme }: AuthSplitLayoutProps) {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);

  useEffect(() => {
    userAuthApi.getTenantInfo().then(setTenantInfo).catch(() => {});
  }, []);

  return (
    <TenantThemeProvider theme={theme}>
      <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
        {/* ── Brand Panel (desktop only) ── */}
        <AuthBrandPanel tenantInfo={tenantInfo} />

        {/* ── Form Panel ── */}
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 lg:min-h-0 lg:px-16">
          {/* Mobile-only tenant logo */}
          {tenantInfo?.logoUrl && (
            <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md shadow-black/5 dark:bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tenantInfo.logoUrl}
                  alt={tenantInfo.name}
                  className="h-14 w-14 object-contain"
                />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                {tenantInfo.name}
              </h1>
            </div>
          )}

          {/* Auth form content */}
          {children}

          {/* Mobile-only footer */}
          {tenantInfo && (
            <footer className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
              &copy; {new Date().getFullYear()} {tenantInfo.name}. All rights reserved.
            </footer>
          )}
        </div>
      </div>
    </TenantThemeProvider>
  );
}
