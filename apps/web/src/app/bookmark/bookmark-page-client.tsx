"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { emptyLayout } from "@/lib/default-layout";
import { AvailableRoutesProvider } from "@open-mtlms/core";
import type { PageConfig, SectionConfig, TenantLayout } from "@open-mtlms/shared";
import { getAvailableRoutesResponse } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";

const BOOKMARK_SECTION: SectionConfig = {
  id: "bookmark-system",
  type: "bookmark-page",
  variant: "default",
  order: 0,
  visible: true,
  deleted: false,
  content: {
    headline: "Your Bookmarks",
    subheadline: "Courses and content you've saved for later",
    emptyBookmarkMessage: "No bookmarks yet. Save courses to find them here!",
  },
  settings: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface BookmarkPageClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
}

export function BookmarkPageClient({ layout, pageConfig }: BookmarkPageClientProps) {
  const theme = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;

  return (
    <TenantThemeProvider theme={theme}>
      <AvailableRoutesProvider
        initialRoutes={pageConfig?.availableRoutes ?? getAvailableRoutesResponse()}
      >
        <LayoutWrapper layout={effectiveLayout} theme={theme}>
          <SectionRenderer sections={[BOOKMARK_SECTION]} editMode={false} />
        </LayoutWrapper>
      </AvailableRoutesProvider>
    </TenantThemeProvider>
  );
}
