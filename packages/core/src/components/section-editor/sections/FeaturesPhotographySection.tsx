"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  FeaturesPhotographyContent,
  FeaturesPhotographyItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Download, MessageCircle, Plus, Trash2, Users, Video } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  video: Video,
  users: Users,
  "message-circle": MessageCircle,
  download: Download,
};

interface FeaturesPhotographySectionProps {
  section: SectionConfig;
}

export function FeaturesPhotographySection({ section }: FeaturesPhotographySectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as FeaturesPhotographyContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof FeaturesPhotographyContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const features = content.features ?? [];

  const handleFeatureUpdate = (index: number, updates: Partial<FeaturesPhotographyItem>) => {
    const newFeatures = [...features];
    newFeatures[index] = { ...newFeatures[index], ...updates };
    handleContentUpdate("features", newFeatures);
  };

  const addFeature = () => {
    handleContentUpdate("features", [
      ...features,
      { id: `feat-${Date.now()}`, icon: "video", title: "New Feature", description: "Feature description" },
    ]);
  };

  const removeFeature = (index: number) => {
    if (features.length <= 1) return;
    handleContentUpdate("features", features.filter((_: FeaturesPhotographyItem, i: number) => i !== index));
  };

  return (
    <section
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-16 text-center">
          <h2
            className="text-[clamp(2.5rem,5vw,4rem)] font-black uppercase tracking-tighter"
            style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
          >
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="span"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
            />
          </h2>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
          {features.map((feature, index) => {
            const IconComp = iconMap[feature.icon || "video"] || Video;
            return (
              <div
                key={feature.id}
                className="relative p-5 text-center transition-all hover:-translate-y-2 sm:p-8"
                style={{
                  border: "3px solid hsl(var(--foreground))",
                  boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
                  backgroundColor: "hsl(var(--card))",
                }}
              >
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <div
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center"
                  style={{
                    border: "3px solid hsl(var(--foreground))",
                    backgroundColor: "hsl(var(--muted))",
                  }}
                >
                  <IconComp className="h-9 w-9 text-primary" />
                </div>
                <h3 className="mb-4 text-2xl font-bold uppercase">
                  <EditableText
                    value={feature.title}
                    onChange={(v) => handleFeatureUpdate(index, { title: v })}
                    as="span"
                  />
                </h3>
                <p className="text-lg text-muted-foreground">
                  <EditableText
                    value={feature.description}
                    onChange={(v) => handleFeatureUpdate(index, { description: v })}
                    as="span"
                  />
                </p>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addFeature}>
              <Plus className="mr-1 h-4 w-4" /> Add Feature
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
