"use client";

import { createSectionConfig } from "@open-mtlms/shared";
import type { SectionType } from "@open-mtlms/shared";
import { defaultThemeConfig, sectionRegistry } from "@open-mtlms/ui-config";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { SectionRenderer } from "@/components/sections/section-renderer";

/**
 * Standalone page that renders a single section at full size.
 * Used as the iframe src for live section previews in Add Section and Change Style modals.
 * No dashboard layout, no sidebar, just the raw rendered section.
 */
export default function SectionPreviewPage() {
  const params = useParams<{ type: string; variant: string }>();
  const typeParam = params?.type ?? "";
  const variantParam = params?.variant ?? "";

  const sectionConfig = useMemo(() => {
    const type = decodeURIComponent(typeParam) as SectionType;
    const variant = decodeURIComponent(variantParam);

    const registry = sectionRegistry[type as keyof typeof sectionRegistry];
    if (!registry) return null;

    const variantExists = registry.variants.some((v) => v.id === variant);
    if (!variantExists) return null;

    return createSectionConfig(type, variant, registry.defaultContent, 0);
  }, [typeParam, variantParam]);

  if (!sectionConfig) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Section not found</p>
      </div>
    );
  }

  return (
    <div className="section-preview-root">
      <SectionRenderer
        sections={[sectionConfig]}
        theme={defaultThemeConfig}
        editMode={false}
      />
    </div>
  );
}
