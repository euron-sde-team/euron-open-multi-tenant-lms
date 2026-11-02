"use client";

import {
  type AvailableRoutesResponse,
  type SectionConfig,
  type TenantLayout,
  type ThemeConfig,
  getAvailableRoutesResponse,
} from "@open-mtlms/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { AvailableRoutesProvider } from "@open-mtlms/core";

interface ProfileClientProps {
  layout?: TenantLayout | null;
  theme?: ThemeConfig | null;
  sections: SectionConfig[];
  availableRoutes?: AvailableRoutesResponse | null;
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

export function ProfileClient({
  layout,
  theme,
  sections,
  availableRoutes,
}: ProfileClientProps) {
  const router = useRouter();
  const { isAuthenticated } = useUserAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/profile");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated) {
    return <LoadingSpinner />;
  }

  return (
    <TenantThemeProvider theme={theme ?? undefined}>
      <AvailableRoutesProvider
        initialRoutes={availableRoutes ?? getAvailableRoutesResponse()}
      >
        <LayoutWrapper layout={layout ?? null}>
          <SectionRenderer sections={sections} editMode={false} />
        </LayoutWrapper>
      </AvailableRoutesProvider>
    </TenantThemeProvider>
  );
}
