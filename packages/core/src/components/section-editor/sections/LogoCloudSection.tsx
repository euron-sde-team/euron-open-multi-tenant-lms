"use client";

import type { LogoCloudContent, SectionConfig } from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface LogoCloudSectionProps {
  section: SectionConfig;
}

export function LogoCloudSection({ section }: LogoCloudSectionProps) {
  const content = section.content as LogoCloudContent;
  const { EditableText, EditableImage, isEditMode, updateSectionContent } =
    useSectionEditor();

  const handleContentUpdate = (
    key: keyof LogoCloudContent,
    value: unknown,
  ) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleLogoUpdate = (index: number, key: string, value: string) => {
    const newLogos = [...(content.logos || [])];
    newLogos[index] = { ...newLogos[index], [key]: value };
    handleContentUpdate("logos", newLogos);
  };

  return (
    <section className="section-padding">
      <div className="container-custom">
        {/* Headline */}
        {content.headline && (
          <div className="mx-auto max-w-3xl text-center">
            <EditableText
              value={content.headline}
              onChange={(value) => handleContentUpdate("headline", value)}
              styleKey="headline"
              as="h2"
              className="text-lg font-medium text-muted-foreground"
            />
          </div>
        )}

        {/* Logos */}
        <div
          className={cn(
            "mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6",
            !content.headline && "mt-0",
          )}
        >
          {content.logos?.map((logo, index) => (
            <div
              key={logo.id || index}
              className="flex flex-col items-center gap-2 opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
            >
              {isEditMode ? (
                <EditableImage
                  src={logo.logo || ""}
                  alt={logo.name}
                  onChange={(src) => handleLogoUpdate(index, "logo", src)}
                  className="h-12 w-auto max-w-[120px] object-contain"
                  aspectRatio="auto"
                  placeholder={logo.name}
                />
              ) : logo.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo.logo}
                  alt={logo.name}
                  className="h-12 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <span className="text-lg font-semibold text-muted-foreground">
                  {logo.name}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
