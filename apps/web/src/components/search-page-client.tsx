"use client";

import type { PageConfig, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { Suspense } from "react";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { SearchContent } from "@/components/search/SearchContent";
import { emptyLayout } from "@/lib/default-layout";
import { Loader2 } from "lucide-react";

const LAYOUT_SETTINGS_KEY = "__tenantLayout__";

function extractLayoutFromSections(sections: PageConfig["sections"]): TenantLayout | null {
  if (!sections || sections.length === 0) return null;
  const firstSection = sections[0];
  const settings = firstSection.settings as Record<string, unknown> | undefined;
  if (settings && settings[LAYOUT_SETTINGS_KEY]) {
    return settings[LAYOUT_SETTINGS_KEY] as TenantLayout;
  }
  return null;
}

interface SearchPageClientProps {
  initialPageConfig: PageConfig | null;
}

export function SearchPageClient({ initialPageConfig }: SearchPageClientProps) {
  const layout =
    (initialPageConfig?.layout as TenantLayout) ??
    extractLayoutFromSections(initialPageConfig?.sections ?? []) ??
    emptyLayout;
  const theme: ThemeConfig = initialPageConfig?.theme ?? defaultThemeConfig;

  return (
    <LayoutWrapper layout={layout} theme={theme}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <SearchContent />
      </Suspense>
    </LayoutWrapper>
  );
}
