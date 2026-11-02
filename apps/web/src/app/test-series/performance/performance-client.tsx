"use client";

import type { ThemeConfig, TenantLayout } from "@open-mtlms/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { TestPerformancePanel } from "@/components/profile/TestPerformancePanel";

interface Props {
  theme?: ThemeConfig;
  layout?: TenantLayout | null;
}

export function PerformanceClient({ theme, layout }: Props) {
  return (
    <LayoutWrapper layout={layout ?? null} theme={theme}>
      <TenantThemeProvider theme={theme}>
        <div className="bg-background min-h-screen">
          <div className="container mx-auto max-w-6xl px-4 py-8">
            <Link
              href="/test-series"
              className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to tests
            </Link>
            <div className="mb-6">
              <h1 className="text-foreground text-3xl font-bold tracking-tight">My Performance</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Your analytics across every test and practice session, in one place.
              </p>
            </div>
            <TestPerformancePanel />
          </div>
        </div>
      </TenantThemeProvider>
    </LayoutWrapper>
  );
}
