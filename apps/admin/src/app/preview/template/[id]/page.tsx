"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { SectionRenderer } from "@/components/sections/section-renderer";
import { getTemplateById } from "@/lib/data/page-templates";

/**
 * Standalone page that renders a template's sections at full size.
 * Used as the iframe src for live template previews in the template picker.
 * No dashboard layout, no sidebar, just the raw rendered template.
 */
export default function TemplatePreviewPage() {
  return (
    <Suspense fallback={null}>
      <TemplatePreview />
    </Suspense>
  );
}

function TemplatePreview() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const templateId = params?.id ?? "";
  const template = useMemo(() => getTemplateById(templateId), [templateId]);

  // Honor ?mode=dark|light. We pass the mode straight into SectionRenderer
  // rather than toggling the root `.dark` class, because the app's next-themes
  // provider pins the root class to light and would immediately override it.
  const colorMode = searchParams?.get("mode") === "dark" ? "dark" : "light";

  if (!template) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Template not found</p>
      </div>
    );
  }

  return (
    <div className="template-preview-root">
      {/* Preview-only: let the browser skip layout/paint for sections outside
          the iframe viewport. contain-intrinsic-size keeps scroll geometry
          stable for the hover-to-scroll preview cards. */}
      <style>{`
        .template-preview-root section {
          content-visibility: auto;
          contain-intrinsic-size: auto 700px;
        }
      `}</style>
      <SectionRenderer
        sections={template.sections}
        theme={template.theme}
        editMode={false}
        forceColorMode={colorMode}
      />
    </div>
  );
}
